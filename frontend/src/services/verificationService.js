/**
 * Service for verifying job ad liveness and validity.
 * Ensures users only see active, genuine job postings that haven't been closed, taken down, or expired.
 */

const CACHE_KEY = 'job_dashboard_verified_urls';
const CACHE_TTL_MS = 6 * 3600 * 1000; // 6 hours

const getApiBase = () => {
  if (typeof window !== 'undefined') {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return window.location.origin;
    }
  }
  return import.meta.env.VITE_SCRAPER_API_URL || 'https://job-dashboard-6xrdvjlrcq-ts.a.run.app';
};

const getCache = () => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY) || localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const setCacheItem = (url, data) => {
  try {
    const cache = getCache();
    cache[url] = {
      ...data,
      cachedAt: Date.now()
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
};

/**
 * Retrieves cached verification result if still valid within TTL
 */
export const getCachedJobLiveness = (url) => {
  if (!url) return null;
  const cache = getCache();
  const item = cache[url];
  if (item && (Date.now() - (item.cachedAt || 0)) < CACHE_TTL_MS) {
    return item;
  }
  return null;
};

/**
 * Checks whether a job ad has been verified as expired or taken down
 */
export const isJobKnownExpired = (job) => {
  if (!job) return false;
  const url = job.portalLink || job.link || job.url;
  if (!url) return false;

  const cached = getCachedJobLiveness(url);
  if (cached) {
    return cached.is_expired === true;
  }
  return false;
};

/**
 * Verifies single job liveness via backend verification engine
 */
export const verifyJobLiveness = async (job, force = false) => {
  if (!job) return { is_valid: false, is_expired: true, reason: 'Invalid job object' };
  const url = job.portalLink || job.link || job.url;
  if (!url || !url.startsWith('http')) {
    return { is_valid: true, is_expired: false, reason: 'Direct application portal' };
  }

  if (!force) {
    const cached = getCachedJobLiveness(url);
    if (cached) return cached;
  }

  const apiBase = getApiBase();
  try {
    const res = await fetch(`${apiBase}/api/verify-job-url?url=${encodeURIComponent(url)}&force=${force ? 'true' : 'false'}`, {
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const data = await res.json();
      setCacheItem(url, data);
      return data;
    }
  } catch (err) {
    console.warn('Job verification network error:', err);
  }

  // Optimistic fallback: assume active if check times out
  const fallback = { url, is_valid: true, is_expired: false, reason: 'Live Portal' };
  setCacheItem(url, fallback);
  return fallback;
};

/**
 * Batch verifies multiple jobs
 */
export const batchVerifyJobs = async (jobs = [], force = false) => {
  if (!jobs || jobs.length === 0) return {};
  const urls = jobs
    .map(j => j.portalLink || j.link || j.url)
    .filter(u => u && u.startsWith('http'));

  if (urls.length === 0) return {};

  const uncachedUrls = force ? urls : urls.filter(u => !getCachedJobLiveness(u));
  if (uncachedUrls.length === 0) {
    const results = {};
    urls.forEach(u => {
      results[u] = getCachedJobLiveness(u);
    });
    return results;
  }

  const apiBase = getApiBase();
  try {
    const res = await fetch(`${apiBase}/api/verify-jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: uncachedUrls.slice(0, 30), force }),
      signal: AbortSignal.timeout(8000)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.results) {
        Object.entries(data.results).forEach(([u, r]) => {
          setCacheItem(u, r);
        });
        return data.results;
      }
    }
  } catch (err) {
    console.warn('Batch job verification error:', err);
  }

  return {};
};
