import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_APIFY_ACTORS,
  DEFAULT_SCRAPER_SETTINGS,
  SCRAPER_SETTINGS_STORAGE_KEY,
  getScraperSettings,
  saveScraperSettings,
  testApifyToken,
  fetchBackendScraperConfig,
} from '../scraperSettingsService';

describe('scraperSettingsService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('getScraperSettings', () => {
    it('returns default configuration when localStorage is empty', () => {
      const settings = getScraperSettings();
      expect(settings).toBeDefined();
      expect(settings.api_token).toBe('');
      expect(settings.platforms.seek.enabled).toBe(true);
      expect(settings.platforms.seek.mode).toBe('primary');
      expect(settings.platforms.seek.actor_id).toBe(DEFAULT_APIFY_ACTORS.seek);
      expect(settings.platforms.indeed.enabled).toBe(false);
      expect(settings.platforms.linkedin.enabled).toBe(false);
      expect(settings.platforms.adzuna.enabled).toBe(false);
    });

    it('merges stored preferences over default settings safely', () => {
      localStorage.setItem(
        SCRAPER_SETTINGS_STORAGE_KEY,
        JSON.stringify({
          api_token: 'apify_test_token_123',
          platforms: {
            seek: { enabled: true, mode: 'fallback', max_results: 35 },
            indeed: { enabled: true },
          },
        })
      );

      const settings = getScraperSettings();
      expect(settings.api_token).toBe('apify_test_token_123');
      expect(settings.platforms.seek.mode).toBe('fallback');
      expect(settings.platforms.seek.max_results).toBe(35);
      expect(settings.platforms.indeed.enabled).toBe(true);
      // Ensure missing platforms still receive defaults
      expect(settings.platforms.linkedin.enabled).toBe(false);
      expect(settings.platforms.linkedin.actor_id).toBe(DEFAULT_APIFY_ACTORS.linkedin);
    });
  });

  describe('saveScraperSettings', () => {
    it('persists clean configuration to localStorage and fires window event', async () => {
      const eventListener = vi.fn();
      window.addEventListener('scraper-settings-updated', eventListener);

      const toSave = {
        api_token: '   my_token_abc   ',
        platforms: {
          seek: { enabled: true, mode: 'primary', max_results: 25 },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: 'Saved successfully.' }),
      });

      const res = await saveScraperSettings(toSave);
      expect(res.success).toBe(true);

      const saved = JSON.parse(localStorage.getItem(SCRAPER_SETTINGS_STORAGE_KEY));
      expect(saved.api_token).toBe('my_token_abc');
      expect(saved.platforms.seek.max_results).toBe(25);
      expect(eventListener).toHaveBeenCalled();

      window.removeEventListener('scraper-settings-updated', eventListener);
    });
  });

  describe('testApifyToken', () => {
    it('returns error when token is empty', async () => {
      const res = await testApifyToken('');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Please enter an Apify API token');
    });

    it('handles successful backend verification response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          username: 'australian_lead',
          plan: 'Team Tier',
        }),
      });

      const res = await testApifyToken('valid_token_xyz');
      expect(res.success).toBe(true);
      expect(res.username).toBe('australian_lead');
      expect(res.plan).toBe('Team Tier');
    });

    it('handles rejected token response gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Invalid API token or unauthorized',
        }),
      });

      const res = await testApifyToken('bad_token');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Invalid API token');
    });
  });

  describe('fetchBackendScraperConfig', () => {
    it('merges backend platforms without wiping local raw token', async () => {
      localStorage.setItem(
        SCRAPER_SETTINGS_STORAGE_KEY,
        JSON.stringify({
          api_token: 'secret_local_raw_token',
        })
      );

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          masked_token: 'secr...oken',
          platforms: {
            seek: { enabled: true, mode: 'fallback' },
            linkedin: { enabled: true, mode: 'primary', max_results: 15 },
          },
        }),
      });

      const merged = await fetchBackendScraperConfig();
      expect(merged.api_token).toBe('secret_local_raw_token');
      expect(merged.platforms.seek.mode).toBe('fallback');
      expect(merged.platforms.linkedin.enabled).toBe(true);
      expect(merged.platforms.linkedin.max_results).toBe(15);
    });
  });
});
