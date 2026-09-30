import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_VIEW_SETTINGS,
  VIEW_SETTINGS_STORAGE_KEY,
  getViewSettings,
  saveViewSettings,
  applyRemoteViewSettings,
  applyRemotePlatformSettings
} from '../viewSettingsService';

describe('viewSettingsService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('provides newest jobs first as the default sort order', () => {
    expect(DEFAULT_VIEW_SETTINGS.sortBy).toBe('date');
    expect(DEFAULT_VIEW_SETTINGS.sortDirection).toBe('desc');
    expect(DEFAULT_VIEW_SETTINGS.pageSize).toBe(48);
  });

  it('returns default view settings when localStorage is empty', () => {
    const settings = getViewSettings();
    expect(settings.sortBy).toBe('date');
    expect(settings.sortDirection).toBe('desc');
    expect(settings.sourceFilter).toBe('All');
    expect(settings.maxAgeFilter).toBe('13days');
  });

  it('persists changes to localStorage and dispatches change event', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const updated = saveViewSettings({
      sortBy: 'score',
      sortDirection: 'asc',
      pageSize: 96,
      minSalaryFilter: '100k+',
    });

    expect(updated.sortBy).toBe('score');
    expect(updated.sortDirection).toBe('asc');
    expect(updated.pageSize).toBe(96);
    expect(updated.minSalaryFilter).toBe('100k+');

    // Verify localStorage persistence
    const savedRaw = localStorage.getItem(VIEW_SETTINGS_STORAGE_KEY);
    expect(savedRaw).toBeTruthy();
    const saved = JSON.parse(savedRaw);
    expect(saved.sortBy).toBe('score');
    expect(saved.sortDirection).toBe('asc');
    expect(saved.pageSize).toBe(96);
    expect(saved.minSalaryFilter).toBe('100k+');

    // Verify custom event dispatched
    expect(dispatchSpy).toHaveBeenCalled();
    const dispatchedEvent = dispatchSpy.mock.calls.find(
      (call) => call[0]?.type === 'job-view-settings-changed'
    )?.[0];
    expect(dispatchedEvent).toBeTruthy();
    expect(dispatchedEvent.detail.sortBy).toBe('score');
  });

  it('hydrates view settings from remote backend preferences (new browser scenario)', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    applyRemoteViewSettings({
      sortBy: 'best_and_newest',
      sortDirection: 'desc',
      workModeFilter: 'remote',
      maxDistanceFilter: '10km'
    });

    const settings = getViewSettings();
    expect(settings.sortBy).toBe('best_and_newest');
    expect(settings.sortDirection).toBe('desc');
    expect(settings.workModeFilter).toBe('remote');
    expect(settings.maxDistanceFilter).toBe('10km');

    expect(dispatchSpy).toHaveBeenCalled();
  });

  it('hydrates platform settings from remote preferences into localStorage', () => {
    applyRemotePlatformSettings({
      pref_au_english: true,
      job_dashboard_base_location: 'Sydney, NSW',
      pref_match_threshold: 85,
      workforce_settings: { enabled: true, pointsTarget: 100 }
    });

    expect(localStorage.getItem('pref_au_english')).toBe('true');
    expect(localStorage.getItem('job_dashboard_base_location')).toBe('Sydney, NSW');
    expect(localStorage.getItem('pref_match_threshold')).toBe('85');
    expect(JSON.parse(localStorage.getItem('workforce_settings') || '{}')).toEqual({
      enabled: true,
      pointsTarget: 100
    });
  });
});
