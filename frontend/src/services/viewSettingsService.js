/**
 * viewSettingsService.js
 * Centralized persistence and cross-session synchronization for JobSeeker
 * sort orders, filter matrix configurations, and platform settings.
 *
 * Guarantees that:
 * 1. Default sort order is newest jobs ('date', 'desc').
 * 2. Any sort or filter change persists immediately across page refreshes (localStorage).
 * 3. Any change syncs to the user's SQLite profile/preferences on the backend,
 *    persisting even across new browsers, tabs, or incognito sessions.
 */

import { getUserPreferences, savePreferencesToBackend } from './scoringEngine';
import { getActiveProfile } from './profileService';

export const DEFAULT_VIEW_SETTINGS = Object.freeze({
  sortBy: 'date',
  sortDirection: 'desc',
  pageSize: 48,
  sourceFilter: 'All',
  activeStreamTab: 'All',
  docsReadyFilter: false,
  minSalaryFilter: 'All',
  minScoreFilter: 'All',
  workModeFilter: 'All',
  maxDistanceFilter: 'All',
  maxAgeFilter: '13days',
  showSidebar: true,
});

export const VIEW_SETTINGS_STORAGE_KEY = 'job_seeker_view_settings';
export const PLATFORM_SETTINGS_STORAGE_KEY = 'job_dashboard_platform_settings';

/**
 * Retrieves the current JobSeeker view settings from localStorage,
 * falling back to DEFAULT_VIEW_SETTINGS (newest jobs first).
 * @returns {typeof DEFAULT_VIEW_SETTINGS}
 */
export const getViewSettings = () => {
  if (typeof localStorage === 'undefined') {
    return { ...DEFAULT_VIEW_SETTINGS };
  }
  try {
    const raw = localStorage.getItem(VIEW_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VIEW_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_VIEW_SETTINGS,
      ...parsed,
      // Ensure sortBy defaults to 'date' if empty or invalid
      sortBy: parsed.sortBy || DEFAULT_VIEW_SETTINGS.sortBy,
      sortDirection: parsed.sortDirection || DEFAULT_VIEW_SETTINGS.sortDirection,
    };
  } catch (err) {
    console.warn('Failed to parse view settings from localStorage:', err);
    return { ...DEFAULT_VIEW_SETTINGS };
  }
};

/**
 * Saves updated view settings to localStorage, dispatches an event for live reactive updates,
 * and asynchronously syncs them to the backend user preferences.
 * @param {Partial<typeof DEFAULT_VIEW_SETTINGS>} newSettings
 * @returns {typeof DEFAULT_VIEW_SETTINGS}
 */
export const saveViewSettings = (newSettings) => {
  const current = getViewSettings();
  const merged = { ...current, ...newSettings };

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(VIEW_SETTINGS_STORAGE_KEY, JSON.stringify(merged));
    } catch (err) {
      console.warn('Failed to write view settings to localStorage:', err);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('job-view-settings-changed', { detail: merged })
    );
  }

  // Non-blocking sync to backend preferences
  try {
    const activeUserId = getActiveProfile()?.id;
    if (activeUserId) {
      const existingPrefs = getUserPreferences();
      savePreferencesToBackend(
        {
          ...existingPrefs,
          view_settings: merged,
        },
        activeUserId
      ).catch(() => {});
    }
  } catch (e) {
    // Graceful degradation when offline
  }

  return merged;
};

/**
 * Hydrates view settings from remote preferences (e.g., when signing in on a new browser).
 * @param {Record<string, any>} remoteViewSettings
 */
export const applyRemoteViewSettings = (remoteViewSettings) => {
  if (!remoteViewSettings || typeof remoteViewSettings !== 'object') return;
  const merged = {
    ...DEFAULT_VIEW_SETTINGS,
    ...remoteViewSettings,
    sortBy: remoteViewSettings.sortBy || DEFAULT_VIEW_SETTINGS.sortBy,
    sortDirection: remoteViewSettings.sortDirection || DEFAULT_VIEW_SETTINGS.sortDirection,
  };

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(VIEW_SETTINGS_STORAGE_KEY, JSON.stringify(merged));
    } catch {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('job-view-settings-changed', { detail: merged })
    );
  }
};

/**
 * Hydrates platform settings (English dialect, match threshold, etc.) from remote preferences.
 * @param {Record<string, any>} platformSettings
 */
export const applyRemotePlatformSettings = (platformSettings) => {
  if (!platformSettings || typeof platformSettings !== 'object') return;
  if (typeof localStorage === 'undefined') return;

  try {
    if (typeof platformSettings.pref_au_english !== 'undefined') {
      localStorage.setItem('pref_au_english', String(platformSettings.pref_au_english));
    }
    if (platformSettings.job_dashboard_base_location) {
      localStorage.setItem('job_dashboard_base_location', platformSettings.job_dashboard_base_location);
    }
    if (platformSettings.pref_match_threshold) {
      localStorage.setItem('pref_match_threshold', String(platformSettings.pref_match_threshold));
    }
    if (platformSettings.workforce_settings) {
      localStorage.setItem('workforce_settings', JSON.stringify(platformSettings.workforce_settings));
    }
  } catch (e) {
    console.warn('Failed to hydrate platform settings:', e);
  }
};
