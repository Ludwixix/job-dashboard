/**
 * Dual-Target API Ingestion Bridge
 * Probes http://localhost:8000/api/health with a 1500ms timeout;
 * falls back seamlessly to Cloud Run production (https://job-dashboard-6xrdvjlrcq-ts.a.run.app).
 * Normalizes payloads to the Job Dashboard backend schema.
 */

import { getSettings, recordImport, isJobImported, addToPendingQueue } from './storage.js';

export const BACKEND_TARGETS = {
  LOCAL_HEALTH: 'http://localhost:8000/api/health',
  LOCAL_JOBS: 'http://localhost:8000/api/jobs',
  PROD_BASE: 'https://job-dashboard-6xrdvjlrcq-ts.a.run.app',
  PROD_HEALTH: 'https://job-dashboard-6xrdvjlrcq-ts.a.run.app/api/health',
  PROD_JOBS: 'https://job-dashboard-6xrdvjlrcq-ts.a.run.app/api/jobs',
  HEALTH_TIMEOUT_MS: 1500
};

/**
 * Normalizes raw extracted LinkedIn job into the Job Dashboard schema contract.
 * @param {Object} rawJob
 * @returns {Object}
 */
export function normalizeJobPayload(rawJob) {
  if (!rawJob) return null;

  // Resolve ID
  let jobId = rawJob.id;
  if (!jobId || !jobId.startsWith('linkedin_ext_')) {
    if (rawJob.numeric_id) {
      jobId = `linkedin_ext_${rawJob.numeric_id}`;
    } else if (rawJob.job_id_raw) {
      jobId = `linkedin_ext_${rawJob.job_id_raw}`;
    } else {
      jobId = `linkedin_ext_${Date.now()}`;
    }
  }

  const title = (rawJob.title || 'Untitled Role').trim();
  const company = (rawJob.company || 'Confidential').trim();
  const location = (rawJob.location || 'Melbourne, VIC').trim();
  const description = (rawJob.description || `Opportunity for ${title} at ${company}. Direct application available via LinkedIn.`).trim();

  // Canonical URL
  let url = rawJob.url || '';
  if (!url && rawJob.numeric_id) {
    url = `https://www.linkedin.com/jobs/view/${rawJob.numeric_id}/`;
  }

  // Dates
  const today = new Date().toISOString().split('T')[0];
  const dateStr = rawJob.date_posted || rawJob.posted || rawJob.date || today;

  // Remote boolean
  const isRemote = Boolean(
    rawJob.remote ||
    /remote/i.test(rawJob.workplace_type || '') ||
    /hybrid/i.test(rawJob.workplace_type || '') ||
    /remote/i.test(location) ||
    /remote/i.test(title)
  );

  const tags = Array.isArray(rawJob.tags) && rawJob.tags.length > 0
    ? Array.from(new Set([...rawJob.tags, 'linkedin', 'extension', 'core']))
    : ['linkedin', 'extension', 'core'];

  return {
    id: jobId,
    title,
    company,
    location,
    description,
    source: 'LinkedIn (Extension)',
    url,
    portalLink: url,
    remote: isRemote,
    workplace_type: rawJob.workplace_type || (isRemote ? 'Remote' : 'On-site'),
    employment_type: rawJob.employment_type || 'Full-time',
    tags,
    date_posted: dateStr,
    posted: dateStr, // CRITICAL: Backend repository checks 'posted' or 'date'
    date: dateStr,
    salary_raw: rawJob.salary_raw || null
  };
}

/**
 * Probes a specific endpoint with a timeout to verify health.
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
export async function probeBackend(url, timeoutMs = BACKEND_TARGETS.HEALTH_TIMEOUT_MS) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });

    clearTimeout(timer);

    if (response.ok) {
      const data = await response.json();
      return data && (data.status === 'healthy' || data.services !== undefined || response.status === 200);
    }
  } catch (_) {
    // Network error or timeout
  }
  return false;
}

/**
 * Resolves the active backend target (Localhost 8000 vs Cloud Run Production vs Custom).
 * @returns {Promise<{ target: 'localhost'|'production'|'custom'|'offline', url: string, healthUrl: string, healthy: boolean }>}
 */
export async function getResolvedBackend() {
  const settings = await getSettings();

  // 1. Check if user configured an explicit custom URL override
  if (settings.overrideMode === 'custom' && settings.customBackendUrl) {
    const cleanUrl = settings.customBackendUrl.replace(/\/+$/, '');
    const healthUrl = `${cleanUrl}/api/health`;
    const jobsUrl = `${cleanUrl}/api/jobs`;
    const isHealthy = await probeBackend(healthUrl, BACKEND_TARGETS.HEALTH_TIMEOUT_MS);
    return {
      target: 'custom',
      url: jobsUrl,
      healthUrl,
      healthy: isHealthy
    };
  }

  // 2. Probe Localhost (8000) with 1500ms timeout
  const localHealthy = await probeBackend(BACKEND_TARGETS.LOCAL_HEALTH, BACKEND_TARGETS.HEALTH_TIMEOUT_MS);
  if (localHealthy) {
    return {
      target: 'localhost',
      url: BACKEND_TARGETS.LOCAL_JOBS,
      healthUrl: BACKEND_TARGETS.LOCAL_HEALTH,
      healthy: true
    };
  }

  // 3. Fallback to Cloud Run Production
  const prodHealthy = await probeBackend(BACKEND_TARGETS.PROD_HEALTH, BACKEND_TARGETS.HEALTH_TIMEOUT_MS);
  if (prodHealthy) {
    return {
      target: 'production',
      url: BACKEND_TARGETS.PROD_JOBS,
      healthUrl: BACKEND_TARGETS.PROD_HEALTH,
      healthy: true
    };
  }

  // 4. If neither responded, return production as default target but flag healthy = false
  return {
    target: 'offline',
    url: BACKEND_TARGETS.PROD_JOBS,
    healthUrl: BACKEND_TARGETS.PROD_HEALTH,
    healthy: false
  };
}

/**
 * Submits a normalized job payload to the active backend target.
 * @param {Object} rawJob
 * @returns {Promise<Object>}
 */
export async function handleJobIngest(rawJob) {
  const normalized = normalizeJobPayload(rawJob);
  if (!normalized || (!normalized.title && !normalized.company)) {
    return {
      success: false,
      error: 'Invalid job data: Title and Company are required for ingestion.'
    };
  }

  const backend = await getResolvedBackend();
  const previouslyImported = await isJobImported(normalized.id);

  const settings = await getSettings();
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'JobDashboard-LinkedIn-Extension/1.0'
  };
  if (settings.authToken) {
    headers['Authorization'] = `Bearer ${settings.authToken}`;
  }
  if (settings.userId) {
    headers['X-User-Id'] = settings.userId;
  }

  try {
    const response = await fetch(backend.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(normalized)
    });

    if (response.status === 201 || response.status === 200) {
      const result = await response.json();
      await recordImport(normalized, backend.target);

      return {
        success: true,
        jobId: normalized.id,
        target: backend.target,
        backendUrl: backend.url,
        isDuplicate: Boolean(previouslyImported),
        data: result
      };
    }

    const errText = await response.text();
    return {
      success: false,
      error: `Backend returned HTTP ${response.status}: ${errText}`,
      target: backend.target
    };
  } catch (err) {
    // Both backends unreachable or network failure; queue for later retry
    await addToPendingQueue(normalized);
    return {
      success: false,
      error: `Network failure connecting to ${backend.url}: ${err.message}`,
      target: 'offline',
      queuedOffline: true
    };
  }
}
