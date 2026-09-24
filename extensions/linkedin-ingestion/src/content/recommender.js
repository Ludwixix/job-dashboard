/**
 * LinkedIn Recommended Feed & Collections Batch Scanner
 * Scans visible job cards on linkedin.com/jobs/ and collection feeds
 * in-situ without triggering page reloads or losing scroll navigation.
 */

import { getCleanText, formatCanonicalUrl } from './extractor.js';

/**
 * Extracts metadata from a single job card element.
 * @param {Element} cardEl
 * @returns {Object|null}
 */
export function extractFeedCard(cardEl) {
  if (!cardEl) return null;

  // 1. Resolve Numeric Job ID
  let jobId = cardEl.getAttribute('data-job-id') ||
              cardEl.getAttribute('data-occludable-job-id') ||
              cardEl.getAttribute('data-job-runner-job-id') ||
              '';

  if (!jobId) {
    const link = cardEl.querySelector('a[href*="/jobs/view/"], a[href*="currentJobId="]');
    if (link && link.href) {
      const idMatch = link.href.match(/\/jobs\/view\/(?:.*?-)?(\d{8,12})/) ||
                      link.href.match(/[?&]currentJobId=(\d{8,12})/);
      if (idMatch) jobId = idMatch[1];
    }
  }

  // 2. Resolve Title
  const titleEl = cardEl.querySelector(
    '.job-card-list__title--link, .job-card-list__title, a.job-card-container__link strong, a.job-card-container__link, .job-card-list__title a'
  );
  const title = getCleanText(titleEl);
  if (!title) return null;

  // 3. Resolve Company
  const companyEl = cardEl.querySelector(
    '.job-card-container__primary-description, .job-card-container__company-name, span.job-card-container__primary-description, .artdeco-entity-lockup__subtitle, a[href*="/company/"]'
  );
  const company = getCleanText(companyEl) || 'Confidential';

  // 4. Resolve Location & Workplace Type
  const locEl = cardEl.querySelector(
    '.job-card-container__metadata-item, .job-card-container__metadata-wrapper li, .job-card-container__metadata-wrapper'
  );
  const location = getCleanText(locEl) || 'Melbourne, VIC';

  const cardText = getCleanText(cardEl);
  let workplaceType = 'On-site';
  if (/\bRemote\b/i.test(cardText) || /\bRemote\b/i.test(location) || /\bRemote\b/i.test(title)) {
    workplaceType = 'Remote';
  } else if (/\bHybrid\b/i.test(cardText) || /\bHybrid\b/i.test(location) || /\bHybrid\b/i.test(title)) {
    workplaceType = 'Hybrid';
  }

  const isRemote = workplaceType === 'Remote' || workplaceType === 'Hybrid';
  const canonicalUrl = jobId ? formatCanonicalUrl(jobId) : '';
  const today = new Date().toISOString().split('T')[0];

  return {
    id: jobId ? `linkedin_ext_${jobId}` : `linkedin_ext_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    job_id_raw: jobId,
    title,
    company,
    location,
    remote: isRemote,
    workplace_type: workplaceType,
    url: canonicalUrl || (titleEl && titleEl.href ? titleEl.href.split('?')[0] : ''),
    portalLink: canonicalUrl || (titleEl && titleEl.href ? titleEl.href.split('?')[0] : ''),
    source: 'LinkedIn (Extension)',
    date_posted: today,
    posted: today, // CRITICAL: Include both posted and date_posted
    date: today,
    tags: ['linkedin', 'extension', 'feed-batch'],
    description: `Recommendation opportunity for ${title} at ${company}. Direct application available via LinkedIn.`
  };
}

/**
 * Scans all visible job cards currently present in the document.
 * @param {Document} doc
 * @returns {Array<Object>}
 */
export function scanVisibleFeedCards(doc = document) {
  const cards = [];
  const seenIds = new Set();

  const elements = doc.querySelectorAll(
    'li.jobs-search-results__list-item, div.job-card-container, li[data-occludable-job-id], div.job-card-list__entity-lockup'
  );

  elements.forEach(el => {
    // If the element is a container holding an inner job-card-container, prefer the innermost or card element
    const parsed = extractFeedCard(el);
    if (parsed) {
      const dedupeKey = parsed.job_id_raw || `${parsed.title}_${parsed.company}`;
      if (!seenIds.has(dedupeKey)) {
        seenIds.add(dedupeKey);
        cards.push(parsed);
      }
    }
  });

  return cards;
}
