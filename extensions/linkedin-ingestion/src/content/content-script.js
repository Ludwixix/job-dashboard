/**
 * Content Script Coordinator
 * Listens for popup requests (EXTRACT_CURRENT_JOB, SCAN_RECOMMENDED_FEED, INGEST_BATCH_CARDS)
 * and coordinates DOM extraction and polite batch transmission with the background service worker.
 */

// Module references dynamically loaded via chrome.runtime.getURL or inline fallback
let extractor = null;
let recommender = null;
let pacer = null;

async function loadDependencies() {
  if (!extractor && typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    try {
      const extractorUrl = chrome.runtime.getURL('src/content/extractor.js');
      extractor = await import(extractorUrl);
    } catch (err) {
      console.warn('[Job Dashboard Ingestion] Could not dynamically import extractor:', err);
    }
  }

  if (!recommender && typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    try {
      const recommenderUrl = chrome.runtime.getURL('src/content/recommender.js');
      recommender = await import(recommenderUrl);
    } catch (err) {
      console.warn('[Job Dashboard Ingestion] Could not dynamically import recommender:', err);
    }
  }

  if (!pacer && typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    try {
      const pacerUrl = chrome.runtime.getURL('src/content/pacer.js');
      pacer = await import(pacerUrl);
    } catch (err) {
      console.warn('[Job Dashboard Ingestion] Could not dynamically import pacer:', err);
    }
  }
}

// Top-level synchronous listener registration
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 1. Extract Current Active Job Details
    if (request.action === 'EXTRACT_CURRENT_JOB') {
      (async () => {
        try {
          await loadDependencies();
          let job;
          if (extractor?.extractActiveJob) {
            job = await extractor.extractActiveJob(document, window.location.href);
          } else {
            job = extractActiveJobFallback(document, window.location.href);
          }

          if (!job || (!job.title && !job.company)) {
            sendResponse({ success: false, error: 'Could not detect job title or company on this page.' });
            return;
          }

          sendResponse({ success: true, job });
        } catch (err) {
          sendResponse({ success: false, error: err?.message || String(err) });
        }
      })();
      return true; // Keep message channel open for async response
    }

    // 2. Scan Recommended Feed Cards on Current Page
    if (request.action === 'SCAN_RECOMMENDED_FEED') {
      (async () => {
        try {
          await loadDependencies();
          let cards = [];
          if (recommender?.scanVisibleFeedCards) {
            cards = recommender.scanVisibleFeedCards(document);
          } else {
            cards = scanVisibleFeedCardsFallback(document);
          }

          sendResponse({ success: true, cards, count: cards.length });
        } catch (err) {
          sendResponse({ success: false, error: err?.message || String(err) });
        }
      })();
      return true; // Keep message channel open for async response
    }

    // 3. Batch Ingest Cards with Polite Pacing
    if (request.action === 'INGEST_BATCH_CARDS') {
      (async () => {
        try {
          await loadDependencies();
          const cardsToIngest = Array.isArray(request.cards) ? request.cards : [];
          if (cardsToIngest.length === 0) {
            sendResponse({ success: false, error: 'No cards provided for batch ingestion.' });
            return;
          }

          let activePacer = pacer?.PolitePacer ? new pacer.PolitePacer() : new FallbackPacer();

          const results = await activePacer.processBatchQueue(
            cardsToIngest,
            async (card) => {
              return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                  { action: 'INGEST_JOB', payload: card },
                  (res) => {
                    if (chrome.runtime.lastError) {
                      return reject(new Error(chrome.runtime.lastError.message));
                    }
                    if (res && res.success) {
                      return resolve(res);
                    }
                    return reject(new Error(res?.error || 'Ingest failed'));
                  }
                );
              });
            },
            (progress) => {
              // Notify popup if available
              try {
                chrome.runtime.sendMessage({
                  action: 'BATCH_PROGRESS',
                  progress
                });
              } catch (_) {}
            }
          );

          const successCount = results.filter(r => r.success).length;
          sendResponse({
            success: true,
            total: cardsToIngest.length,
            imported: successCount,
            results
          });
        } catch (err) {
          sendResponse({ success: false, error: err?.message || String(err) });
        }
      })();
      return true; // Keep message channel open for async response
    }

    return false;
  });
}

/**
 * Fallback active job extractor in case dynamic module import is delayed
 */
function extractActiveJobFallback(doc = document, url = window.location.href) {
  let jobId = '';
  const pathMatch = url.match(/\/jobs\/view\/(?:[a-zA-Z0-9-]+-)?(\d{8,12})/);
  if (pathMatch) jobId = pathMatch[1];
  else {
    try {
      const u = new URL(url);
      const qId = u.searchParams.get('currentJobId');
      if (qId && /^\d{8,12}$/.test(qId)) jobId = qId;
    } catch (_) {}
  }

  const titleEl = doc.querySelector(
    'h1.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, .jobs-search__job-details h1, h1'
  );
  const companyEl = doc.querySelector(
    '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, a[href*="/company/"]'
  );
  const locationEl = doc.querySelector(
    '.job-details-jobs-unified-top-card__primary-description-container span.tvm__text, .jobs-unified-top-card__bullet ~ span'
  );

  const title = titleEl ? titleEl.textContent.trim() : 'Untitled Role';
  const company = companyEl ? companyEl.textContent.trim() : 'Confidential';
  const location = locationEl ? locationEl.textContent.trim() : 'Melbourne, VIC';

  const descEl = doc.querySelector('#job-details, .jobs-description__content, .jobs-box__html-content');
  const description = descEl ? descEl.textContent.trim() : '';

  const today = new Date().toISOString().split('T')[0];
  const canonicalUrl = jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : url.split('?')[0];

  return {
    id: jobId ? `linkedin_ext_${jobId}` : `linkedin_ext_${Date.now()}`,
    title,
    company,
    location,
    workplace_type: 'On-site',
    employment_type: 'Full-time',
    remote: false,
    date_posted: today,
    posted: today,
    date: today,
    description: description || `Opportunity for ${title} at ${company}. Direct application available via LinkedIn.`,
    source: 'LinkedIn (Extension)',
    url: canonicalUrl,
    tags: ['linkedin', 'extension', 'core']
  };
}

/**
 * Fallback feed scanner in case dynamic module import is delayed
 */
function scanVisibleFeedCardsFallback(doc = document) {
  const cards = [];
  const seenIds = new Set();
  const elements = doc.querySelectorAll('li.jobs-search-results__list-item, div.job-card-container');
  elements.forEach(el => {
    const titleEl = el.querySelector('.job-card-list__title--link, .job-card-list__title, a.job-card-container__link');
    const companyEl = el.querySelector('.job-card-container__primary-description, .job-card-container__company-name');
    const locEl = el.querySelector('.job-card-container__metadata-item');
    const jobId = el.getAttribute('data-job-id') || el.getAttribute('data-occludable-job-id');

    if (titleEl) {
      const today = new Date().toISOString().split('T')[0];
      const title = titleEl.textContent.trim();
      const company = companyEl ? companyEl.textContent.trim() : 'Confidential';
      const dedupeKey = jobId || `${title}_${company}`;
      if (!seenIds.has(dedupeKey)) {
        seenIds.add(dedupeKey);
        cards.push({
          id: jobId ? `linkedin_ext_${jobId}` : `linkedin_ext_${Date.now()}_${Math.random()}`,
          job_id_raw: jobId || '',
          title,
          company,
          location: locEl ? locEl.textContent.trim() : 'Melbourne, VIC',
          remote: false,
          url: jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : titleEl.href || '',
          source: 'LinkedIn (Extension)',
          date_posted: today,
          posted: today,
          date: today,
          tags: ['linkedin', 'extension', 'feed-batch']
        });
      }
    }
  });
  return cards;
}

class FallbackPacer {
  async processBatchQueue(items, handler, progress) {
    const results = [];
    for (let i = 0; i < items.length; i++) {
      if (i > 0) {
        await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500));
      }
      try {
        const res = await handler(items[i], i);
        results.push({ item: items[i], success: true, result: res });
      } catch (err) {
        results.push({ item: items[i], success: false, error: err.message });
      }
      if (progress) progress({ completed: i + 1, total: items.length });
    }
    return results;
  }
}
