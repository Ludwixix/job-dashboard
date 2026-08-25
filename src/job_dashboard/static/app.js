const state = { jobs: [], generating: new Set() };
const byId = id => document.getElementById(id);

const savedTheme = localStorage.getItem('job-desk-theme');
if (savedTheme === 'dark') document.documentElement.dataset.theme = 'dark';
byId('theme-toggle').textContent = savedTheme === 'dark' ? 'Day mode' : 'Night mode';
byId('theme-toggle').addEventListener('click', event => {
  const dark = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  localStorage.setItem('job-desk-theme', dark ? 'light' : 'dark');
  event.target.textContent = dark ? 'Night mode' : 'Day mode';
});

function filteredJobs() {
  const query = byId('search').value.toLowerCase();
  const stream = byId('stream').value;
  const source = byId('source').value;
  const minimum = Number(byId('minimum').value || 0);
  return state.jobs.filter(job => {
    const searchable = `${job.title} ${job.company} ${job.description} ${job.matched_skills.join(' ')}`.toLowerCase();
    return (!query || searchable.includes(query)) && (!stream || job.stream === stream) &&
      (!source || job.source === source) && job.score >= minimum;
  });
}

function renderHighlights() {
  const highlights = byId('highlights');
  highlights.replaceChildren();
  const jobs = [...state.jobs].sort((left, right) => right.score - left.score).slice(0, 3);
  for (const job of jobs) {
    const button = document.createElement('button');
    button.className = 'highlight-job';
    button.dataset.jobId = job.id;
    const title = document.createElement('strong');
    title.textContent = job.title || 'Untitled role';
    const meta = document.createElement('span');
    meta.textContent = `${job.score}% · ${job.company || 'Company not listed'}`;
    button.append(title, meta);
    highlights.append(button);
  }
}

function renderCategoryCounts() {
  const counts = { all: state.jobs.length, 'core-it': 0, bridge: 0, traineeship: 0, Adzuna: 0, Seek: 0, Indeed: 0, 70: 0 };
  for (const job of state.jobs) {
    if (counts[job.stream] !== undefined) counts[job.stream] += 1;
    if (counts[job.source] !== undefined) counts[job.source] += 1;
    if (job.score >= 70) counts[70] += 1;
  }
  for (const count of document.querySelectorAll('.category-count')) count.textContent = counts[count.dataset.count] ?? 0;
}

function ensureCriteriaPanel() {
  if (byId('criteria-editor')) return;
  const panel = document.createElement('div');
  panel.className = 'side-group criteria';
  panel.innerHTML = '<h2>Search criteria</h2><textarea id="criteria-editor" rows="6" placeholder="cloud engineer | core-it | Melbourne, VIC"></textarea><button id="save-criteria">Save criteria</button><span id="criteria-status" class="side-empty"></span>';
  byId('sidebar').insertBefore(panel, byId('highlights').closest('.side-group'));
  byId('save-criteria').addEventListener('click', async event => {
    const queries = byId('criteria-editor').value.split('\n').map(line => {
      const [term, stream = 'core-it', location = 'Melbourne, VIC'] = line.split('|').map(value => value.trim());
      return {term, stream, location};
    }).filter(query => query.term);
    const response = await fetch('/api/search-criteria', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({queries})});
    const result = await response.json();
    byId('criteria-status').textContent = response.ok ? `${result.queries.length} saved` : result.error || 'Save failed';
  });
}

function render() {
  const jobs = filteredJobs();
  ensureCriteriaPanel();
  renderCategoryCounts();
  renderHighlights();
  byId('count').textContent = `${jobs.length} job${jobs.length === 1 ? '' : 's'}`;
  byId('status').textContent = state.jobs.length ? `${state.jobs.length} saved listings` : 'No saved listings yet';
  const container = byId('jobs');
  container.replaceChildren();
  for (const job of jobs) {
    const node = byId('card').content.cloneNode(true);
    const jobId = job.id;
    node.querySelector('.job-card').dataset.jobId = jobId;
    node.querySelector('.job-card').classList.add(`status-${job.status || 'sourced'}`);
    const generated = node.querySelector('.generated');
    const generateButton = node.querySelector('.generate');
    node.querySelector('.source').textContent = `${job.source || 'Unknown'} / ${job.stream}`;
    node.querySelector('h2').textContent = job.title || 'Untitled role';
    node.querySelector('.company').textContent = job.company || 'Company not listed';
    node.querySelector('.score').textContent = `${job.score}%`;
    node.querySelector('.meta').textContent = [job.location, job.posted_age].filter(Boolean).join(' · ') || 'Location not listed';
    node.querySelector('.salary').textContent = job.salary || (job.remote ? 'Remote' : '');
    node.querySelector('.description').textContent = job.description || 'No description captured.';
    node.querySelector('.fit').textContent = job.fit;
    node.querySelector('.matched').textContent = job.matched_skills.length ? `Matched: ${job.matched_skills.slice(0, 3).join(', ')}` : 'No matched skills';
    node.querySelector('.listing').href = job.url || '#';
    const emailLink = node.querySelector('.email-link');
    if (job.email_url) {
      emailLink.href = job.email_url;
      emailLink.hidden = false;
    }
    node.querySelector('.status').value = job.status || 'sourced';
    const tags = node.querySelector('.tags');
    for (const tag of job.matched_skills.slice(0, 5)) {
      const span = document.createElement('span');
      span.textContent = tag;
      tags.append(span);
    }
    const attachLinks = (result) => {
      const output = [];
      const mdLinks = result && (result.resume_pdf || result.cover_letter_pdf || result.application_id);
      if (mdLinks) {
        const appId = result.application_id || jobId;
        output.push(`<a href="/applications/${appId}_resume.pdf" target="_blank" rel="noreferrer">Download CV PDF</a>`);
        output.push(`<a href="/applications/${appId}_cover_letter.pdf" target="_blank" rel="noreferrer">Download letter PDF</a>`);
      }
      generated.innerHTML = output.join(' · ');
    };
    const setDownloadButton = (result) => {
      if (!result || !(result.resume_pdf || result.cover_letter_pdf || result.application_id)) return;
      generateButton.textContent = 'Download CV + letter';
      generateButton.disabled = false;
      generateButton.onclick = () => {
        const appId = result.application_id || jobId;
        window.open(`/applications/${appId}_resume.pdf`, '_blank', 'noopener');
        window.open(`/applications/${appId}_cover_letter.pdf`, '_blank', 'noopener');
      };
    };
    const existing = job.generated || {};
    if (existing.resume_pdf || existing.cover_letter_pdf || existing.application_id) {
      attachLinks(existing);
      setDownloadButton(existing);
    }
    if (existing.status === 'needs_review') {
      generated.insertAdjacentHTML('beforeend', '<div class="status-pill warning">Needs fact review before use</div>');
    }
    generateButton.addEventListener('click', async event => {
      if (job.generated && (job.generated.resume_pdf || job.generated.cover_letter_pdf || job.generated.application_id)) return;
      state.generating.add(jobId);
      event.target.disabled = true;
      event.target.textContent = 'Generating...';
      generated.replaceChildren();
      generated.innerHTML = '<div class="status-pill">Estimating…</div>';
      const initial = await fetch(`/api/jobs/${jobId}/generate`, { method: 'POST' });
      const queued = await initial.json();
      if (!initial.ok) {
        state.generating.delete(jobId);
        generated.textContent = queued.error || 'Generation failed';
        event.target.disabled = false;
        event.target.textContent = 'Regenerate CV + letter';
        return;
      }
      const poll = async () => {
        const statusResponse = await fetch(`/api/jobs/${jobId}/generate-status`);
        const status = await statusResponse.json();
        if (!statusResponse.ok) {
          generated.textContent = status.error || 'Unable to read generation status';
          event.target.disabled = false;
          event.target.textContent = 'Generate CV + letter';
          return;
        }
        generated.innerHTML = `<div class="status-pill">${status.phase || 'Preparing'} · ${status.progress || 0}% · est. ${status.estimate_seconds || 15}s</div>`;
        if (status.done) {
          if (status.failed) {
            state.generating.delete(jobId);
            generated.textContent = status.error || 'Generation failed';
            event.target.disabled = false;
            event.target.textContent = 'Generate CV + letter';
            return;
          }
          const finalResponse = await fetch(`/api/jobs/${jobId}/generate-final`, { method: 'POST' });
          const result = await finalResponse.json();
          if (finalResponse.ok) {
            job.generated = result;
            state.generating.delete(jobId);
            attachLinks(result);
            setDownloadButton(result);
          } else {
            state.generating.delete(jobId);
            generated.textContent = result.error || 'Generation failed';
            event.target.disabled = false;
            event.target.textContent = 'Regenerate CV + letter';
          }
          return;
        }
        if (status.progress < 100) setTimeout(poll, 1200);
      };
      poll();
    });
    container.append(node);
  }
  if (jobs.length && !document.querySelector('.preview-header')) renderPreview(jobs[0]);
}

byId('sidebar').addEventListener('click', event => {
  const highlight = event.target.closest('.highlight-job');
  if (highlight) {
    const job = state.jobs.find(item => item.id === highlight.dataset.jobId);
    if (job) renderPreview(job);
    return;
  }
  const filter = event.target.closest('button[data-stream], button[data-source], button[data-minimum]');
  if (!filter) return;
  byId('stream').value = filter.dataset.stream || '';
  byId('source').value = filter.dataset.source || '';
  byId('minimum').value = filter.dataset.minimum || 0;
  render();
});

function openModal(job) {
  const modal = byId('job-modal');
  modal.querySelector('.modal-kicker').textContent = `${job.source || 'Unknown'} / ${job.stream || 'Unclassified'}`;
  modal.querySelector('.modal-title').textContent = job.title || 'Untitled role';
  modal.querySelector('.modal-company').textContent = job.company || 'Company not listed';
  modal.querySelector('.modal-meta').textContent = [job.location, job.posted_age, job.status].filter(Boolean).join(' · ');
  modal.querySelector('.modal-description').textContent = job.description || 'No description captured.';
  modal.querySelector('.modal-score').textContent = `${job.score}% match`;
  modal.querySelector('.modal-fit').textContent = job.fit;
  modal.querySelector('.modal-skills').textContent = `Matched: ${job.matched_skills.length ? job.matched_skills.join(', ') : 'None'}\nGaps: ${job.missing_skills.length ? job.missing_skills.join(', ') : 'None'}\n\nDimensions\n${Object.entries(job.dimensions).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${value}%`).join('\n')}`;
  modal.querySelector('.modal-listing').href = job.url || '#';
  const generate = modal.querySelector('.modal-generate');
  generate.onclick = async () => {
    generate.disabled = true;
    generate.textContent = 'Generating…';
    const response = await fetch(`/api/jobs/${job.id}/generate`, {method: 'POST'});
    if (!response.ok) {
      generate.textContent = 'Generation failed';
      generate.disabled = false;
      return;
    }
    modal.close();
    renderPreview(job);
    generate.textContent = 'Generate CV + letter';
    generate.disabled = false;
  };
  modal.showModal();
}

function renderPreview(job) {
  const preview = byId('preview');
  preview.replaceChildren();
  const header = document.createElement('div');
  header.className = 'preview-header';
  const source = document.createElement('span');
  source.className = 'preview-source';
  source.textContent = job.source || 'Job listing';
  const title = document.createElement('h2');
  title.textContent = job.title || 'Untitled role';
  const company = document.createElement('p');
  company.className = 'preview-company';
  company.textContent = job.company || 'Company not listed';
  const meta = document.createElement('p');
  meta.className = 'preview-meta';
  meta.textContent = [job.location, job.salary || (job.remote ? 'Remote' : ''), job.posted_age].filter(Boolean).join(' · ');
  header.append(source, title, company, meta);
  const facts = document.createElement('div');
  facts.className = 'preview-facts';
  for (const [label, value] of [['Location', job.location || 'Not specified'], ['Salary', job.salary || (job.remote ? 'Remote' : 'Not specified')], ['Source', job.source || 'Unknown'], ['Stream', job.stream || 'Unclassified'], ['Stage', job.status || 'Sourced'], ['Freshness', job.posted_age || 'Recent']]) {
    const fact = document.createElement('div');
    fact.className = 'preview-fact';
    const factLabel = document.createElement('span');
    factLabel.textContent = label;
    const factValue = document.createElement('strong');
    factValue.textContent = value;
    fact.append(factLabel, factValue);
    facts.append(fact);
  }
  const actions = document.createElement('div');
  actions.className = 'preview-actions';
  if (job.url) {
    const listing = document.createElement('a');
    listing.href = job.url;
    listing.target = '_blank';
    listing.rel = 'noreferrer';
    listing.textContent = `Open on ${job.source || 'listing site'}`;
    actions.append(listing);
  }
  const body = document.createElement('div');
  body.className = 'preview-body';
  const details = document.createElement('h3');
  details.textContent = 'Job details';
  const description = document.createElement('p');
  description.textContent = (job.description || 'No description captured.').replace(/\*\*/g, '');
  const fit = document.createElement('p');
  fit.className = 'preview-fit';
  fit.textContent = `${job.score}% match · ${job.fit}`;
  const skills = document.createElement('div');
  skills.className = 'preview-skills';
  for (const [label, values] of [['Matched skills', job.matched_skills], ['Skill gaps', job.missing_skills]]) {
    const heading = document.createElement('strong');
    heading.textContent = label;
    const list = document.createElement('p');
    list.textContent = values.length ? values.join(', ') : 'None identified';
    skills.append(heading, list);
  }
  body.append(details, description, fit, skills);
  preview.append(header, facts, actions, body);
}

async function load() {
  if (state.generating.size) return;
  const response = await fetch('/api/jobs');
  state.jobs = (await response.json()).jobs;
  render();
}

async function loadCriteria() {
  ensureCriteriaPanel();
  const response = await fetch('/api/search-criteria');
  if (!response.ok) return;
  const result = await response.json();
  byId('criteria-editor').value = result.queries.map(query => [query.term, query.stream, query.location].join(' | ')).join('\n');
}

for (const id of ['search', 'stream', 'source', 'minimum']) byId(id).addEventListener('input', render);
byId('jobs').addEventListener('click', event => {
  if (event.target.closest('button, a, select, label')) return;
  const card = event.target.closest('.job-card');
  if (!card) return;
  const job = state.jobs.find(item => item.id === card.dataset.jobId);
  if (job) {
    document.querySelectorAll('.job-card.is-selected').forEach(item => item.classList.remove('is-selected'));
    card.classList.add('is-selected');
    renderPreview(job);
  }
});
byId('jobs').addEventListener('change', async event => {
  if (!event.target.matches('.status')) return;
  const card = event.target.closest('.job-card');
  const job = state.jobs.find(item => item.id === card.dataset.jobId);
  if (job) await fetch(`/api/jobs/${job.id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: event.target.value }) });
});
byId('jobs').addEventListener('pointermove', event => {
  const card = event.target.closest('.job-card');
  if (!card || window.matchMedia('(prefers-reduced-motion: reduce)').matches || event.pointerType === 'touch') return;
  const bounds = card.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width - 0.5;
  const y = (event.clientY - bounds.top) / bounds.height - 0.5;
  card.style.setProperty('--rx', `${(-y * 5).toFixed(2)}deg`);
  card.style.setProperty('--ry', `${(x * 6).toFixed(2)}deg`);
});
byId('jobs').addEventListener('pointerleave', event => {
  const card = event.target.closest('.job-card');
  if (card) {
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  }
}, true);
byId('job-modal').querySelector('.modal-close').addEventListener('click', () => byId('job-modal').close());
byId('job-modal').addEventListener('click', event => { if (event.target === byId('job-modal')) byId('job-modal').close(); });
load();
loadCriteria();
setInterval(load, 15000);
