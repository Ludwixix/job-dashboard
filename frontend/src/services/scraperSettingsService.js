/**
 * scraperSettingsService.js
 * 
 * Manages configuration and dynamic switching for multi-platform job scrapers,
 * allowing users to route Seek, Indeed, LinkedIn, and Adzuna queries through
 * Apify actors or native adapters.
 */

import { getBackendApiBase } from './apiConfig';
import { getAuthToken } from './authService';

export const SCRAPER_SETTINGS_STORAGE_KEY = 'job_dashboard_apify_settings';

export const DEFAULT_APIFY_ACTORS = {
  seek: 'automation-lab/seek-scraper',
  indeed: 'misceres/indeed-scraper',
  linkedin: 'curious_coder/linkedin-job-search-scraper',
  adzuna: 'apify/web-scraper',
  jora: 'memo23/jora-search-cheerio-ppr',
};

/**
 * Strips URLs and 'actors/' path prefixes from user input to ensure a valid Apify slug or ID.
 * 
 * @param {string} raw Raw input from user (URL, actors/id, or slug)
 * @returns {string} Sanitized actor ID or slug
 */
export const sanitizeActorId = (raw) => {
  if (!raw) return '';
  let clean = String(raw).trim();
  if (clean.includes('apify.com/actors/')) {
    clean = clean.split('apify.com/actors/')[1].split('/')[0].split('?')[0];
  } else if (clean.startsWith('actors/')) {
    clean = clean.substring('actors/'.length);
  }
  return clean.trim();
};

export const DEFAULT_SCRAPER_SETTINGS = {
  api_token: '',
  platforms: {
    seek: {
      enabled: true,
      mode: 'primary', // 'primary' | 'fallback'
      actor_id: 'automation-lab/seek-scraper',
      max_results: 20,
    },
    indeed: {
      enabled: false,
      mode: 'fallback',
      actor_id: 'misceres/indeed-scraper',
      max_results: 20,
    },
    linkedin: {
      enabled: false,
      mode: 'fallback',
      actor_id: 'curious_coder/linkedin-job-search-scraper',
      max_results: 20,
    },
    adzuna: {
      enabled: false,
      mode: 'fallback',
      actor_id: 'apify/web-scraper',
      max_results: 20,
    },
    jora: {
      enabled: false,
      mode: 'primary',
      actor_id: 'memo23/jora-search-cheerio-ppr',
      max_results: 20,
    },
  },
};

/**
 * Builds request headers with authenticated Bearer identity when available.
 * Necessary because scraper configurations are user-scoped in multi-user deployments.
 * 
 * @returns {Record<string, string>} Headers object
 */
const getHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // Graceful fallback when authService is unavailable
  }
  return headers;
};

/**
 * Retrieves the active scraper and Apify settings from local cache.
 * Deeply merges user customisations over default settings so newly added platforms
 * always possess safe, well-formed defaults without null pointer exceptions.
 * 
 * @returns {typeof DEFAULT_SCRAPER_SETTINGS} Complete settings object
 */
export const getScraperSettings = () => {
  if (typeof window === 'undefined') return { ...DEFAULT_SCRAPER_SETTINGS };

  try {
    const raw = localStorage.getItem(SCRAPER_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SCRAPER_SETTINGS };

    const parsed = JSON.parse(raw);
    return {
      api_token: parsed.api_token || '',
      platforms: {
        seek: { ...DEFAULT_SCRAPER_SETTINGS.platforms.seek, ...(parsed.platforms?.seek || {}) },
        indeed: { ...DEFAULT_SCRAPER_SETTINGS.platforms.indeed, ...(parsed.platforms?.indeed || {}) },
        linkedin: { ...DEFAULT_SCRAPER_SETTINGS.platforms.linkedin, ...(parsed.platforms?.linkedin || {}) },
        adzuna: { ...DEFAULT_SCRAPER_SETTINGS.platforms.adzuna, ...(parsed.platforms?.adzuna || {}) },
      },
    };
  } catch (err) {
    console.error('Failed to parse scraper settings from localStorage:', err);
    return { ...DEFAULT_SCRAPER_SETTINGS };
  }
};

/**
 * Persists scraper settings to localStorage and synchronizes with the backend database.
 * Dispatches a 'scraper-settings-updated' window event to notify UI listeners.
 * 
 * @param {typeof DEFAULT_SCRAPER_SETTINGS} settings Settings payload to save
 * @returns {Promise<{ success: boolean, message?: string }>} Operation result
 */
export const saveScraperSettings = async (settings) => {
  if (typeof window === 'undefined') return { success: false };

  try {
    const cleanSettings = {
      api_token: String(settings.api_token || '').trim(),
      platforms: {
        seek: { 
          ...DEFAULT_SCRAPER_SETTINGS.platforms.seek, 
          ...(settings.platforms?.seek || {}),
          actor_id: sanitizeActorId(settings.platforms?.seek?.actor_id || DEFAULT_SCRAPER_SETTINGS.platforms.seek.actor_id),
        },
        indeed: { 
          ...DEFAULT_SCRAPER_SETTINGS.platforms.indeed, 
          ...(settings.platforms?.indeed || {}),
          actor_id: sanitizeActorId(settings.platforms?.indeed?.actor_id || DEFAULT_SCRAPER_SETTINGS.platforms.indeed.actor_id),
        },
        linkedin: { 
          ...DEFAULT_SCRAPER_SETTINGS.platforms.linkedin, 
          ...(settings.platforms?.linkedin || {}),
          actor_id: sanitizeActorId(settings.platforms?.linkedin?.actor_id || DEFAULT_SCRAPER_SETTINGS.platforms.linkedin.actor_id),
        },
        adzuna: { 
          ...DEFAULT_SCRAPER_SETTINGS.platforms.adzuna, 
          ...(settings.platforms?.adzuna || {}),
          actor_id: sanitizeActorId(settings.platforms?.adzuna?.actor_id || DEFAULT_SCRAPER_SETTINGS.platforms.adzuna.actor_id),
        },
      },
    };

    // Save locally immediately for responsive UI feedback
    localStorage.setItem(SCRAPER_SETTINGS_STORAGE_KEY, JSON.stringify(cleanSettings));

    // Dispatch global event for live components
    window.dispatchEvent(
      new CustomEvent('scraper-settings-updated', {
        detail: cleanSettings,
      })
    );

    // Sync with backend API asynchronously
    const apiBase = getBackendApiBase();
    const res = await fetch(`${apiBase}/api/scrapers/config`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(cleanSettings),
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, message: data.message || 'Settings saved successfully.' };
    } else {
      return { success: true, message: 'Saved locally (backend sync pending).' };
    }
  } catch (err) {
    console.warn('Scraper settings saved locally, background backend sync deferred:', err);
    return { success: true, message: 'Saved locally.' };
  }
};

/**
 * Fetches the user's scraper configuration from the backend, merging into localStorage.
 * Ensures multi-device continuity when a user opens the dashboard in a new session.
 * 
 * @returns {Promise<typeof DEFAULT_SCRAPER_SETTINGS>} Fresh settings
 */
export const fetchBackendScraperConfig = async () => {
  try {
    const apiBase = getBackendApiBase();
    const res = await fetch(`${apiBase}/api/scrapers/config`, {
      method: 'GET',
      headers: getHeaders(),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return getScraperSettings();

    const data = await res.json();
    if (data.success && data.platforms) {
      const current = getScraperSettings();
      const merged = {
        api_token: current.api_token || '', // Never overwrite user's raw token with masked backend response
        platforms: {
          seek: { ...current.platforms.seek, ...(data.platforms.seek || {}) },
          indeed: { ...current.platforms.indeed, ...(data.platforms.indeed || {}) },
          linkedin: { ...current.platforms.linkedin, ...(data.platforms.linkedin || {}) },
          adzuna: { ...current.platforms.adzuna, ...(data.platforms.adzuna || {}) },
        },
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem(SCRAPER_SETTINGS_STORAGE_KEY, JSON.stringify(merged));
      }
      return merged;
    }
  } catch (err) {
    console.warn('Could not fetch backend scraper config, using local cache:', err);
  }
  return getScraperSettings();
};

/**
 * Tests an Apify API token against the backend verification endpoint.
 * Validates token legitimacy before the user commits it to live scraping.
 * 
 * @param {string} token Apify API Token to test
 * @returns {Promise<{ success: boolean, username?: string, plan?: string, error?: string }>}
 */
export const testApifyToken = async (token) => {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) {
    return { success: false, error: 'Please enter an Apify API token to test.' };
  }

  try {
    const apiBase = getBackendApiBase();
    const res = await fetch(`${apiBase}/api/scrapers/apify/test`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ api_token: cleanToken }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        username: data.username || 'Apify User',
        plan: data.plan || 'Active',
      };
    }
    return {
      success: false,
      error: data.error || 'Failed to authenticate with Apify.',
    };
  } catch (err) {
    return {
      success: false,
      error: err.name === 'TimeoutError' ? 'Connection timed out.' : (err.message || 'Network error'),
    };
  }
};
