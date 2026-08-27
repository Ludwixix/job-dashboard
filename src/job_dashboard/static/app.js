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
  const criteria = (byId('criteria-filter')?.value || '').toLowerCase();
  const stream = byId('stream').value;
  const fitCategory = byId('fit-category')?.value || '';
  const source = byId('source').value;
  const minimum = Number(byId('minimum').value || 0);
  const jobs = state.jobs.filter(job => {
    const searchable = `${job.title} ${job.company} ${job.description} ${job.matched_skills.join(' ')}`.toLowerCase();
    return (!query || searchable.includes(query)) && (!criteria || (job.tags || []).some(tag => tag.toLowerCase() === criteria)) && (!stream || job.stream === stream) &&
      (!source || job.source === source) && (!fitCategory || job.fit_category === fitCategory) && job.score >= minimum;
  });
  const sort = byId('sort')?.value || 'score';
  return jobs.sort((left, right) => {
    if (sort === 'title' || sort === 'company') return String(left[sort] || '').localeCompare(String(right[sort] || ''));
    if (sort === 'newest') return String(right.posted || '').localeCompare(String(left.posted || ''));
    return (right.score || 0) - (left.score || 0);
  });
}

function updateCriteriaFilter() {
  const selector = byId('criteria-filter');
  if (!selector) return;
  const current = selector.value;
  selector.replaceChildren(new Option('All returned results', ''));
  const excluded = ['indeed', 'seek', 'linkedin', 'adzuna', 'remoteok', 'core-it', 'bridge', 'traineeship'];
  const terms = [...new Set(state.jobs.flatMap(job => job.tags || []).filter(tag => tag && !excluded.includes(tag.toLowerCase())))].sort();
  for (const term of terms) selector.append(new Option(term, term));
  selector.value = terms.includes(current) ? current : '';
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

function compareCard(model, job, comparisonId) {
  const article = document.createElement('article');
  article.className = 'compare-model';
  article.dataset.modelId = model.model_id;
  const title = document.createElement('h3');
  title.textContent = model.display_name || model.model_id;
  const status = document.createElement('p');
  status.className = 'compare-status';
  article.append(title, status);
  if (model.status === 'loading' || model.status === 'queued') {
    status.textContent = 'Generating...';
    article.insertAdjacentHTML('beforeend', '<div class="compare-skeleton"></div><div class="compare-skeleton"></div>');
    return article;
  }
  if (model.status !== 'completed') {
    status.textContent = model.error || 'Generation failed';
    const retry = document.createElement('button');
    retry.textContent = 'Retry this model';
    retry.onclick = async () => {
      retry.disabled = true;
      await fetch(`/api/compare/${comparisonId}/retry`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({model_id: model.model_id})});
      openCompareModal(job, comparisonId);
    };
    article.append(retry);
    return article;
  }
  status.textContent = `${((model.latency_ms || 0) / 1000).toFixed(1)}s${model.cached ? ' · cached' : ''}`;
  if (model.audit && !model.audit.verified) {
    const warning = document.createElement('p');
    warning.className = 'compare-warning';
    warning.textContent = `Fact review needed: ${(model.audit.issues || []).slice(0, 2).join('; ') || 'unverified claims detected'}`;
    article.append(warning);
  }
  for (const [label, value] of [['CV', model.resume_text], ['Cover letter', model.cover_letter_text]]) {
    const heading = document.createElement('h4');
    heading.textContent = label;
    const copy = document.createElement('button');
    copy.textContent = 'Copy';
    copy.className = 'compare-copy';
    copy.onclick = () => navigator.clipboard.writeText(value || '');
    const block = document.createElement('pre');
    block.textContent = value || 'No output returned.';
    article.append(heading, copy, block);
  }
  const use = document.createElement('button');
  use.textContent = 'Use this one';
  use.onclick = async () => {
    use.disabled = true;
    const response = await fetch(`/api/compare/${comparisonId}/select`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({model_id: model.model_id})});
    if (response.ok) {
      job.generated = await response.json();
      document.getElementById('compare-modal')?.close();
      render();
    } else use.disabled = false;
  };
  article.append(use);
  return article;
}

async function openCompareModal(job, comparisonId = '') {
  let modal = byId('compare-modal');
  if (!modal) {
    modal = document.createElement('dialog');
    modal.id = 'compare-modal';
    modal.className = 'job-modal compare-modal';
    document.body.append(modal);
  }
  modal.replaceChildren();
  const heading = document.createElement('h2');
  heading.textContent = `Compare CV + letter: ${job.title}`;
  const close = document.createElement('button');
  close.textContent = 'Close';
  close.className = 'modal-close';
  close.onclick = () => modal.close();
  const columns = document.createElement('section');
  columns.className = 'compare-columns';
  modal.append(close, heading, columns);
  if (!comparisonId) {
    const response = await fetch(`/api/jobs/${job.id}/compare`, {method: 'POST'});
    const queued = await response.json();
    if (!response.ok) {
      columns.textContent = queued.error || 'Comparison could not be started.';
      modal.showModal();
      return;
    }
    comparisonId = queued.comparison_id;
  }
  modal.showModal();
  const poll = async () => {
    const response = await fetch(`/api/compare/${comparisonId}`);
    const comparison = await response.json();
    if (!response.ok) {
      columns.textContent = comparison.error || 'Comparison unavailable.';
      return;
    }
    columns.replaceChildren(...Object.values(comparison.models || {}).map(model => compareCard(model, job, comparisonId)));
    if (!comparison.done) setTimeout(poll, 700);
  };
  poll();
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
  panel.innerHTML = '<h2>Search criteria</h2><textarea id="criteria-editor" rows="6" placeholder="SharePoint Administrator | core-it | Melbourne, VIC | m365 | 1.5 | warehouse,trainee"></textarea><div class="criteria-actions"><button id="save-criteria">Save criteria</button><button id="suggested-criteria" type="button">Suggest from experience</button><button id="default-criteria" type="button">Use defaults</button><button id="reset-criteria" type="button">Reset</button></div><span id="criteria-status" class="side-empty"></span>';
  byId('sidebar').insertBefore(panel, byId('highlights').closest('.side-group'));
  byId('save-criteria').addEventListener('click', async event => {
    const queries = byId('criteria-editor').value.split('\n').map(line => {
      const parts = line.split('|').map(value => value.trim()).filter(Boolean);
      const term = parts[0] || '';
      const streams = ['core-it', 'bridge', 'traineeship'];
      const stream = streams.includes((parts[1] || '').toLowerCase()) ? parts[1].toLowerCase() : 'core-it';
      const location = streams.includes((parts[1] || '').toLowerCase()) ? (parts[2] || 'Melbourne, VIC') : (parts.length > 1 ? parts[1] : 'Melbourne, VIC');
      const group = parts[3] || '';
      const weight = Number(parts[4] || 1);
      const exclude_terms = (parts[5] || '').split(',').map(value => value.trim()).filter(Boolean);
      return {term, stream, location, group, weight: Number.isFinite(weight) ? weight : 1, exclude_terms, enabled: true};
    }).filter(query => query.term);
    try {
      const response = await fetch('/api/search-criteria', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({queries})});
      const result = await response.json();
      if (!response.ok) {
        byId('criteria-status').textContent = result.error || 'Save failed';
        return;
      }
      byId('criteria-status').textContent = `${result.queries.length} saved — refreshing jobs…`;
      const jobsResponse = await fetch('/api/jobs');
      if (!jobsResponse.ok) throw new Error('Unable to refresh jobs');
      state.jobs = (await jobsResponse.json()).jobs;
      render();
      byId('criteria-status').textContent = `${result.queries.length} saved — jobs updated`;
    } catch (error) {
      byId('criteria-status').textContent = 'Save failed — dashboard unavailable';
    }
  });
  byId('default-criteria').addEventListener('click', async () => {
    const response = await fetch('/api/search-criteria/defaults');
    const result = await response.json();
    byId('criteria-editor').value = result.queries.map(query => query.term).join('\n');
    byId('criteria-status').textContent = 'Defaults loaded — click Save criteria to apply';
  });
  byId('suggested-criteria').addEventListener('click', async () => {
    const response = await fetch('/api/search-criteria/suggestions');
    const result = await response.json();
    byId('criteria-editor').value = result.queries.map(query => query.term).join('\n');
    byId('criteria-status').textContent = 'Experience-based suggestions loaded — click Save criteria to apply';
  });
  byId('reset-criteria').addEventListener('click', () => {
    byId('criteria-editor').value = '';
    byId('criteria-status').textContent = 'Cleared — click Save criteria to persist';
  });
}

function ensureRejectionArchive() {
  if (byId('rejection-archive')) return;
  const panel = document.createElement('div');
  panel.id = 'rejection-archive';
  panel.className = 'side-group rejection-archive';
  panel.innerHTML = '<h2>Application archive</h2><button id="show-rejections">Rejected applications</button><button id="show-applications" type="button">All tracked applications</button><button id="show-suggestions" type="button">Job suggestions</button><button id="sync-tracker" type="button">Sync tracker</button><p id="tracker-status" class="side-empty"></p><div id="rejections" class="side-empty" hidden></div>';
  byId('sidebar').insertBefore(panel, byId('highlights').closest('.side-group'));
  byId('show-rejections').addEventListener('click', async () => {
    const target = byId('rejections');
    target.hidden = false;
    target.textContent = 'Loading…';
    const response = await fetch('/api/rejections');
    const result = await response.json();
    target.replaceChildren();
    if (!result.rejections.length) {
      target.textContent = 'No rejected applications';
      return;
    }
    for (const rejection of result.rejections) {
      const item = document.createElement('p');
      item.textContent = `${rejection.title} · ${rejection.company}`;
      if (rejection.email_url) {
        const link = document.createElement('a');
        link.href = rejection.email_url;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.textContent = 'View email';
        item.append(' ', link);
      }
      target.append(item);
    }
  });
  byId('show-applications').addEventListener('click', async () => {
    const target = byId('rejections');
    target.hidden = false;
    target.textContent = 'Loading…';
    const response = await fetch('/api/applications/archive');
    const result = await response.json();
    target.replaceChildren();
    for (const application of result.applications) {
      const item = document.createElement('p');
      item.textContent = `${application.title} · ${application.company} · ${application.category}`;
      target.append(item);
    }
    if (!result.applications.length) target.textContent = 'No tracked applications';
  });
  byId('show-suggestions').addEventListener('click', async () => {
    const target = byId('rejections');
    target.hidden = false;
    target.textContent = 'Loading…';
    try {
      const response = await fetch('/api/tracker/suggestions');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load job suggestions');
      target.replaceChildren();
      for (const suggestion of result.suggestions) {
        const item = document.createElement('p');
        item.textContent = `${suggestion.title} · ${suggestion.company}`;
        item.title = `${suggestion.status}${suggestion.date ? ` · ${suggestion.date}` : ''}${suggestion.notes ? ` · ${suggestion.notes}` : ''}`;
        if (suggestion.email_link) {
          const link = document.createElement('a');
          link.href = suggestion.email_link;
          link.target = '_blank';
          link.rel = 'noreferrer';
          link.textContent = 'Email';
          item.append(' ', link);
        }
        target.append(item);
      }
      if (!result.suggestions.length) target.textContent = 'No new tracker suggestions';
      renderTrackerStatus(result.tracker_state);
    } catch (error) {
      target.textContent = error.message;
    }
  });
  byId('sync-tracker').addEventListener('click', async event => {
    event.target.disabled = true;
    byId('tracker-status').textContent = 'Syncing…';
    try {
      const response = await fetch('/api/tracker/sync', { method: 'POST' });
      const result = await response.json();
      renderTrackerStatus(result);
    } catch (error) {
      byId('tracker-status').textContent = 'Tracker sync failed — dashboard unavailable';
    }
    event.target.disabled = false;
  });
}

function renderTrackerStatus(state) {
  const target = byId('tracker-status');
  if (!target || !state) return;
  if (state.status === 'completed') target.textContent = `${state.matched} matched · ${state.rows} tracker rows`;
  else if (state.status === 'failed') target.textContent = state.error || 'Tracker sync failed';
  else if (state.status === 'syncing') target.textContent = 'Syncing…';
  else target.textContent = '';
}

function render() {
  const jobs = filteredJobs();
  updateCriteriaFilter();
  ensureCriteriaPanel();
  ensureRejectionArchive();
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
    node.querySelector('.score').title = Object.entries(job.dimensions || {}).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${value}%`).join(' | ');
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
      generated.innerHTML = '<div class="status-pill">Now generating…</div>';
      let initial;
      let queued;
      try {
        initial = await fetch(`/api/jobs/${jobId}/generate`, { method: 'POST' });
        queued = await initial.json();
      } catch (error) {
        state.generating.delete(jobId);
        generated.textContent = 'Generation failed — dashboard unavailable';
        event.target.disabled = false;
        event.target.textContent = 'Generate CV + letter';
        return;
      }
      if (!initial.ok) {
        state.generating.delete(jobId);
        generated.textContent = queued.error || 'Generation failed';
        event.target.disabled = false;
        event.target.textContent = 'Regenerate CV + letter';
        return;
      }
      const poll = async () => {
        let statusResponse;
        let status;
        try {
          statusResponse = await fetch(`/api/jobs/${jobId}/generate-status`);
          status = await statusResponse.json();
        } catch (error) {
          state.generating.delete(jobId);
          generated.textContent = 'Generation status unavailable. Please try again.';
          event.target.disabled = false;
          event.target.textContent = 'Generate CV + letter';
          return;
        }
        if (!statusResponse.ok) {
          generated.textContent = status.error || 'Unable to read generation status';
          event.target.disabled = false;
          event.target.textContent = 'Generate CV + letter';
          return;
        }
        generated.innerHTML = `<div class="status-pill">${status.done ? 'Generation complete' : 'Now generating…'}</div>`;
        if (status.done) {
          if (status.failed) {
            state.generating.delete(jobId);
            generated.textContent = status.error || 'Generation failed';
            event.target.disabled = false;
            event.target.textContent = 'Generate CV + letter';
            return;
          }
          let finalResponse;
          let result;
          try {
            finalResponse = await fetch(`/api/jobs/${jobId}/generate-final`, { method: 'POST' });
            result = await finalResponse.json();
          } catch (error) {
            state.generating.delete(jobId);
            generated.textContent = 'Generation finished but the result could not be loaded. Please refresh.';
            event.target.disabled = false;
            event.target.textContent = 'Generate CV + letter';
            return;
          }
          if (finalResponse.ok) {
            job.generated = result;
            state.generating.delete(jobId);
            attachLinks(result);
            setDownloadButton(result);
            generated.insertAdjacentHTML('beforeend', '<div class="status-pill">Documents ready to download</div>');
          } else {
            state.generating.delete(jobId);
            generated.textContent = result.error || 'Generation failed';
            event.target.disabled = false;
            event.target.textContent = 'Regenerate CV + letter';
          }
          return;
        }
        if (status.progress >= 95 && Date.now() - (status.started_at * 1000) > 60000) {
          generated.textContent = 'Generation timed out. Please try again.';
          state.generating.delete(jobId);
          event.target.disabled = false;
          event.target.textContent = 'Generate CV + letter';
          return;
        }
        if (status.progress < 100) setTimeout(poll, 1200);
        else {
          state.generating.delete(jobId);
          event.target.disabled = false;
          event.target.textContent = 'Generate CV + letter';
        }
      };
      poll();
    });
    const compareButton = node.querySelector('.compare');
    compareButton.addEventListener('click', () => openCompareModal(job));
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
  // Keep the editor focused on the search terms. Stream and location use the
  // backend defaults unless the optional pipe syntax is explicitly entered.
  byId('criteria-editor').value = result.queries.map(query => query.term).join('\n');
}

for (const id of ['search', 'stream', 'source', 'minimum', 'sort', 'criteria-filter']) byId(id)?.addEventListener('input', render);
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
