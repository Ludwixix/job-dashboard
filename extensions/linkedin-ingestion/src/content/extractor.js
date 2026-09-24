/**
 * LinkedIn Active Job Detail DOM Extractor
 * Provides resilient multi-tier cascading fallback selectors,
 * description expander handling, date normalization, and canonical URL extraction.
 */

export const SELECTORS = {
  TITLE: [
    'h1.job-details-jobs-unified-top-card__job-title',
    '.job-details-jobs-unified-top-card__job-title',
    '.jobs-unified-top-card__job-title',
    '.jobs-search__job-details h1',
    'h1.t-24.t-bold',
    'h1.t-24',
    '.job-view-layout h1',
    '.topcard__title'
  ],
  COMPANY: [
    '.job-details-jobs-unified-top-card__company-name a',
    '.job-details-jobs-unified-top-card__company-name',
    '.jobs-unified-top-card__company-name a',
    '.jobs-unified-top-card__company-name',
    '.job-details-jobs-unified-top-card__primary-description a[href*="/company/"]',
    '.jobs-unified-top-card__primary-description a[href*="/company/"]',
    'a.ember-view[href*="/company/"]',
    '.topcard__flavor--black-link',
    '.topcard__org-name-link'
  ],
  LOCATION: [
    '.job-details-jobs-unified-top-card__primary-description-container span.tvm__text:first-of-type',
    '.job-details-jobs-unified-top-card__primary-description span.tvm__text',
    '.jobs-unified-top-card__bullet ~ span',
    '.job-details-jobs-unified-top-card__workplace-type'
  ],
  DESCRIPTION_CONTAINER: [
    '#job-details',
    '.jobs-description__content',
    '.jobs-box__html-content',
    'article.jobs-description__container',
    '.show-more-less-html__markup',
    '.jobs-description-content__text'
  ],
  DESCRIPTION_EXPANDER: [
    'button.jobs-description__footer-button',
    'button.show-more-less-html__button--more',
    'button[aria-label*="Click to see more description"]',
    'button[aria-label*="Show more"]',
    'button[aria-label*="see more"]'
  ],
  JOB_INSIGHTS: [
    'li.job-details-jobs-unified-top-card__job-insight',
    'li.job-details-jobs-unified-top-card__job-insight-view-model',
    '.job-details-preferences-and-skills',
    '.ui-label'
  ]
};

/**
 * Extracts clean text from an element, removing hidden screen-reader spans.
 * @param {Element|null} element
 * @returns {string}
 */
export function getCleanText(element) {
  if (!element) return '';
  const clone = element.cloneNode(true);
  const hiddenElements = clone.querySelectorAll('.visually-hidden, [aria-hidden="true"]');
  hiddenElements.forEach(el => el.remove());
  return (clone.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * Parses numeric LinkedIn Job ID from URL or DOM attributes.
 * @param {Document} doc
 * @param {string} url
 * @returns {string}
 */
export function extractJobId(doc = document, url = (typeof window !== 'undefined' ? window.location.href : '')) {
  if (url) {
    // 1. Direct path match /jobs/view/1234567890 or /jobs/view/title-slug-1234567890
    const pathMatch = url.match(/\/jobs\/view\/(?:[a-zA-Z0-9-]+-)?(\d{8,12})/);
    if (pathMatch) return pathMatch[1];

    // 2. Query param ?currentJobId=1234567890
    try {
      const parsedUrl = new URL(url, 'https://www.linkedin.com');
      const paramId = parsedUrl.searchParams.get('currentJobId');
      if (paramId && /^\d{8,12}$/.test(paramId)) return paramId;
    } catch (_) {}
  }

  if (doc) {
    // 3. Active card data-job-id or data-occludable-job-id
    const activeCard = doc.querySelector(
      '.jobs-search-results__list-item--active, .job-card-container--clickable.active, .jobs-search-results__list-item.selected'
    );
    if (activeCard) {
      const cardId = activeCard.getAttribute('data-job-id') ||
                     activeCard.getAttribute('data-occludable-job-id') ||
                     activeCard.getAttribute('data-job-runner-job-id');
      if (cardId && /^\d{8,12}$/.test(cardId)) return cardId;
    }

    // 4. Unified top card attribute
    const topCard = doc.querySelector('.job-details-jobs-unified-top-card, .jobs-unified-top-card');
    if (topCard) {
      const topCardId = topCard.getAttribute('data-job-id') ||
                        topCard.getAttribute('data-job-runner-job-id') ||
                        topCard.getAttribute('data-occludable-job-id');
      if (topCardId && /^\d{8,12}$/.test(topCardId)) return topCardId;
    }

    // 5. Any container attribute
    const anyAttrEl = doc.querySelector('[data-job-id], [data-occludable-job-id], [data-job-runner-job-id]');
    if (anyAttrEl) {
      const attrId = anyAttrEl.getAttribute('data-job-id') ||
                     anyAttrEl.getAttribute('data-occludable-job-id') ||
                     anyAttrEl.getAttribute('data-job-runner-job-id');
      if (attrId && /^\d{8,12}$/.test(attrId)) return attrId;
    }
  }

  return '';
}

/**
 * Formats canonical LinkedIn job URL without tracking parameters.
 * @param {string} jobId
 * @returns {string}
 */
export function formatCanonicalUrl(jobId) {
  if (!jobId) return '';
  return `https://www.linkedin.com/jobs/view/${jobId}/`;
}

/**
 * Converts relative time strings (e.g. "3 days ago") to ISO date string (YYYY-MM-DD).
 * @param {string} text
 * @param {Date} now
 * @returns {string}
 */
export function parseRelativeDate(text, now = new Date()) {
  if (!text) return now.toISOString().split('T')[0];
  const cleaned = text.toLowerCase().trim();

  if (cleaned.includes('just now') || cleaned.includes('hour') || cleaned.includes('minute') || cleaned.includes('today')) {
    return now.toISOString().split('T')[0];
  }

  const daysMatch = cleaned.match(/(\d+)\s+day/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    const d = new Date(now.getTime() - days * 86400000);
    return d.toISOString().split('T')[0];
  }

  const weeksMatch = cleaned.match(/(\d+)\s+week/);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1], 10);
    const d = new Date(now.getTime() - weeks * 7 * 86400000);
    return d.toISOString().split('T')[0];
  }

  const monthsMatch = cleaned.match(/(\d+)\s+month/);
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1], 10);
    const d = new Date(now.getTime() - months * 30 * 86400000);
    return d.toISOString().split('T')[0];
  }

  return now.toISOString().split('T')[0];
}

/**
 * Expands truncated job description if footer button is present.
 * @param {Document} doc
 */
export async function expandDescription(doc = document) {
  if (!doc) return;
  for (const selector of SELECTORS.DESCRIPTION_EXPANDER) {
    const btn = doc.querySelector(selector);
    if (btn && btn.getAttribute('aria-expanded') !== 'true') {
      try {
        btn.click();
      } catch (_) {}
      await new Promise(r => setTimeout(r, 120));
      break;
    }
  }
}

/**
 * Normalizes description container HTML to clean plain text / markdown.
 * @param {Element|null} container
 * @returns {string}
 */
export function formatDescription(container) {
  if (!container) return '';
  const clone = container.cloneNode(true);

  // Remove buttons, scripts, SVGs, styles
  clone.querySelectorAll('button, script, svg, style, noscript').forEach(el => el.remove());

  // Replace <li> with bullet
  clone.querySelectorAll('li').forEach(li => {
    const liText = (li.textContent || '').trim();
    li.textContent = `• ${liText}`;
  });

  // Convert <p> to paragraphs
  clone.querySelectorAll('p').forEach(p => {
    const pText = (p.textContent || '').trim();
    p.textContent = `${pText}\n\n`;
  });

  // Convert <br> to newline
  clone.querySelectorAll('br').forEach(br => {
    br.replaceWith('\n');
  });

  return (clone.textContent || '')
    .split('\n')
    .map(line => line.trim())
    .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1].length > 0))
    .join('\n')
    .trim();
}

/**
 * Extracts complete active job details from the current document.
 * @param {Document} doc
 * @param {string} url
 * @returns {Promise<Object>}
 */
export async function extractActiveJob(doc = document, url = (typeof window !== 'undefined' ? window.location.href : '')) {
  // Expand description if footer button is present
  await expandDescription(doc);

  // 1. Resolve Job ID & Canonical URL
  const numericId = extractJobId(doc, url);
  const canonicalUrl = formatCanonicalUrl(numericId) || (url ? url.split('?')[0] : '');

  // 2. Resolve Title
  let title = '';
  for (const sel of SELECTORS.TITLE) {
    const el = doc.querySelector(sel);
    if (el) {
      title = getCleanText(el);
      if (title) break;
    }
  }
  if (!title) title = 'Untitled Role';

  // 3. Resolve Company
  let company = '';
  for (const sel of SELECTORS.COMPANY) {
    const el = doc.querySelector(sel);
    if (el) {
      company = getCleanText(el);
      if (company) break;
    }
  }
  if (!company) company = 'Confidential';

  // 4. Primary Subtitle / Location / Relative Date / Workplace Type
  let location = '';
  let datePosted = new Date().toISOString().split('T')[0];
  let workplaceType = 'On-site';

  // Check dedicated location selectors first
  for (const sel of SELECTORS.LOCATION) {
    const el = doc.querySelector(sel);
    if (el) {
      const text = getCleanText(el);
      if (text &&
          text !== company &&
          !text.toLowerCase().includes(company.toLowerCase()) &&
          !/^(remote|hybrid|on-site|onsite)$/i.test(text) &&
          !/\b(ago|just now|reposted)\b/i.test(text)) {
        location = text;
        break;
      }
    }
  }

  const subtitleContainer = doc.querySelector(
    '.job-details-jobs-unified-top-card__primary-description-container, .job-details-jobs-unified-top-card__primary-description, .jobs-unified-top-card__primary-description'
  );
  if (subtitleContainer) {
    const subText = getCleanText(subtitleContainer);
    const parts = subText.split('·').map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
      if (/\b(ago|just now|reposted)\b/i.test(part)) {
        datePosted = parseRelativeDate(part);
      } else if (/\b(Remote|Hybrid|On-site|Onsite)\b/i.test(part)) {
        const match = part.match(/\b(Remote|Hybrid|On-site|Onsite)\b/i);
        if (match) workplaceType = match[1];
      } else if (!location && part !== company && !part.toLowerCase().includes(company.toLowerCase())) {
        location = part;
      }
    }
  }

  if (!location) {
    location = 'Melbourne, VIC';
  }

  // Check <time> tag for authoritative ISO date
  const timeEl = doc.querySelector('time[datetime]');
  if (timeEl) {
    const dt = timeEl.getAttribute('datetime');
    if (dt && /^\d{4}-\d{2}-\d{2}/.test(dt)) {
      datePosted = dt.substring(0, 10);
    }
  }

  // 5. Job Insights (Employment Type, Workplace Type, Salary)
  let employmentType = 'Full-time';
  let salaryRaw = null;

  const insightElements = doc.querySelectorAll(SELECTORS.JOB_INSIGHTS.join(', '));
  insightElements.forEach(el => {
    const text = getCleanText(el);
    if (/\b(Full-time|Part-time|Contract|Temporary|Internship)\b/i.test(text)) {
      const match = text.match(/\b(Full-time|Part-time|Contract|Temporary|Internship)\b/i);
      if (match) employmentType = match[1];
    }
    if (/\b(Remote|Hybrid|On-site|Onsite)\b/i.test(text)) {
      const match = text.match(/\b(Remote|Hybrid|On-site|Onsite)\b/i);
      if (match) workplaceType = match[1];
    }
    if (/\$[\d,]+/.test(text)) {
      const salaryMatch = text.match(
        /\$[\d,]+(?:[kK]|\/(?:yr|hr|year|hour|month|annum)|\s*(?:yr|hr|year|hour|month|annum))?(?:\s*-\s*\$[\d,]+(?:[kK]|\/(?:yr|hr|year|hour|month|annum)|\s*(?:yr|hr|year|hour|month|annum))?)?(?:\s*(?:\/|\bper\b)\s*(?:yr|hr|year|hour|month|annum))?/i
      );
      if (salaryMatch) salaryRaw = salaryMatch[0].trim();
    }
  });

  const isRemote = /remote/i.test(workplaceType) ||
                   /hybrid/i.test(workplaceType) ||
                   /remote/i.test(title) ||
                   /remote/i.test(location);

  // 6. Job Description
  let description = '';
  for (const sel of SELECTORS.DESCRIPTION_CONTAINER) {
    const el = doc.querySelector(sel);
    if (el) {
      description = formatDescription(el);
      if (description.length > 20) break;
    }
  }

  const generatedId = numericId ? `linkedin_ext_${numericId}` : `linkedin_ext_${Date.now()}`;

  return {
    id: generatedId,
    numeric_id: numericId || '',
    title,
    company,
    location,
    workplace_type: workplaceType,
    employment_type: employmentType,
    salary_raw: salaryRaw,
    remote: isRemote,
    date_posted: datePosted,
    posted: datePosted, // CRITICAL: Include both posted and date_posted
    date: datePosted,
    description: description || `Opportunity for ${title} at ${company}. Direct application available via LinkedIn.`,
    source: 'LinkedIn (Extension)',
    url: canonicalUrl || (url ? url.split('?')[0] : ''),
    portalLink: canonicalUrl || (url ? url.split('?')[0] : ''),
    tags: ['linkedin', 'extension', 'core']
  };
}
