/**
 * psychologyService.js
 * Persistent caching and de-duplication engine for Employer Psychology Decoder
 */
import { getBackendApiBase } from './apiConfig';

const STORAGE_KEY_PSYCHOLOGY = 'job_dashboard_psychology_cache';

// In-memory registry for in-flight decoding requests to prevent duplicate LLM calls
const pendingRequests = new Map();

/**
 * Normalizes a job key for caching
 */
export const getJobPsychologyKey = (job) => {
  if (!job) return '';
  if (job.id && String(job.id).trim()) return String(job.id).trim();
  const c = String(job.company || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const t = String(job.title || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${c}_${t}`;
};

/**
 * Retrieves cached psychology insights for a job
 */
export const getCachedPsychology = (job) => {
  if (!job) return null;
  if (job.psychologyInsights && typeof job.psychologyInsights === 'object' && job.psychologyInsights.hiddenPriorities) {
    return job.psychologyInsights;
  }
  if (job.psychology_insights && typeof job.psychology_insights === 'object' && job.psychology_insights.hiddenPriorities) {
    return job.psychology_insights;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_PSYCHOLOGY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    const key = getJobPsychologyKey(job);
    const directKey = job.id ? String(job.id) : null;
    const altKey = `${job.company}_${job.title}`;

    return cache[key] || (directKey ? cache[directKey] : null) || cache[altKey] || null;
  } catch (e) {
    console.warn('Error reading psychology cache:', e);
    return null;
  }
};

/**
 * Persists psychology insights to the dedicated local cache
 */
export const setCachedPsychology = (job, insights) => {
  if (!job || !insights) return;
  const key = getJobPsychologyKey(job);
  const directKey = job.id ? String(job.id) : null;
  const altKey = `${job.company}_${job.title}`;

  try {
    const raw = localStorage.getItem(STORAGE_KEY_PSYCHOLOGY);
    const cache = raw ? JSON.parse(raw) : {};

    cache[key] = insights;
    if (directKey) cache[directKey] = insights;
    if (altKey) cache[altKey] = insights;

    localStorage.setItem(STORAGE_KEY_PSYCHOLOGY, JSON.stringify(cache));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('psychology-updated', {
        detail: {
          key,
          jobId: job.id,
          insights
        }
      }));
    }

    // Persist to backend database asynchronously
    savePsychologyToBackend(job, insights).catch(() => {});
  } catch (e) {
    console.warn('Error saving to psychology cache:', e);
  }
};

/**
 * Persists employer psychology to backend SQLite database.
 */
export const savePsychologyToBackend = async (job, insights) => {
  if (!job || !insights) return null;
  const apiBase = getBackendApiBase();
  const jobId = getJobPsychologyKey(job);

  try {
    const res = await fetch(`${apiBase}/api/psychology`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: jobId,
        company: job.company || '',
        title: job.title || '',
        insights: insights
      })
    });
    if (res.ok) {
      const data = await res.json();
      return data.psychology;
    }
  } catch (e) {
    console.warn('Backend psychology sync non-blocking error:', e);
  }
  return null;
};

/**
 * Fetches employer psychology from backend SQLite database.
 */
export const fetchPsychologyFromBackend = async (job) => {
  if (!job) return null;
  const apiBase = getBackendApiBase();
  const jobId = getJobPsychologyKey(job);

  try {
    const res = await fetch(`${apiBase}/api/psychology?job_id=${encodeURIComponent(jobId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.psychology && data.psychology.insights) {
        setCachedPsychology(job, data.psychology.insights);
        return data.psychology.insights;
      }
    }
  } catch (e) {
    console.warn('Backend psychology fetch non-blocking error:', e);
  }
  return getCachedPsychology(job);
};

/**
 * Checks if an analysis is currently running for this job
 */
export const isPsychologyDecoding = (job) => {
  const key = getJobPsychologyKey(job);
  return pendingRequests.has(key);
};

/**
 * Sets the active in-flight promise for a job
 */
export const setPendingPsychologyPromise = (job, promise) => {
  const key = getJobPsychologyKey(job);
  pendingRequests.set(key, promise);
  promise.finally(() => {
    pendingRequests.delete(key);
  });
};

/**
 * Gets the active in-flight promise for a job
 */
export const getPendingPsychologyPromise = (job) => {
  const key = getJobPsychologyKey(job);
  return pendingRequests.get(key) || null;
};
