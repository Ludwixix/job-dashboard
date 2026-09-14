import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveProfile,
  fetchProfileFromBackend,
  getActiveProfile,
  DEFAULT_USER_PROFILE
} from '../profileService';

describe('Profile Persistence & LWW Conflict Reconciliation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('saveProfile attaches updatedAt ISO timestamp', () => {
    const saved = saveProfile({
      id: 'test_user',
      name: 'Sam Ludwig',
      title: 'Staff Platform Engineer'
    });

    expect(saved.updatedAt).toBeDefined();
    expect(new Date(saved.updatedAt).getTime()).toBeGreaterThan(0);

    const retrieved = getActiveProfile();
    expect(retrieved.title).toBe('Staff Platform Engineer');
    expect(retrieved.updatedAt).toBe(saved.updatedAt);
  });

  it('fetchProfileFromBackend preserves newer local profile and heals backend when remote is stale', async () => {
    // 1. Set local profile with a newer timestamp
    const now = Date.now();
    const localProfile = {
      id: 'sam_ludwig',
      name: 'Sam Ludwig',
      title: 'Principal Cloud Architect (Local Edit)',
      updatedAt: new Date(now).toISOString()
    };
    saveProfile(localProfile, { syncToBackend: false });

    // 2. Mock backend returning an older snapshot (e.g. from 2 hours ago before redeploy)
    const staleRemoteProfile = {
      id: 'sam_ludwig',
      name: 'Sam Ludwig',
      title: 'Senior Systems Engineer (Stale Server)',
      updatedAt: new Date(now - 7200000).toISOString()
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      if (options?.method === 'POST') {
        // Auto-heal call to POST /api/profile
        return {
          ok: true,
          json: async () => ({ success: true, profile: JSON.parse(options.body) })
        };
      }
      // GET /api/profile
      return {
        ok: true,
        json: async () => ({ success: true, profile: staleRemoteProfile })
      };
    });

    const result = await fetchProfileFromBackend('sam_ludwig');

    // Must keep local edits
    expect(result.title).toBe('Principal Cloud Architect (Local Edit)');
    const active = getActiveProfile();
    expect(active.title).toBe('Principal Cloud Architect (Local Edit)');

    // Must have dispatched auto-heal POST to backend
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/profile'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Principal Cloud Architect (Local Edit)')
      })
    );
  });

  it('fetchProfileFromBackend adopts remote profile when remote is newer', async () => {
    // 1. Set local profile with older timestamp
    const now = Date.now();
    const localProfile = {
      id: 'sam_ludwig',
      name: 'Sam Ludwig',
      title: 'Old Title',
      updatedAt: new Date(now - 3600000).toISOString()
    };
    saveProfile(localProfile, { syncToBackend: false });

    // 2. Mock backend returning a newer snapshot
    const newerRemoteProfile = {
      id: 'sam_ludwig',
      name: 'Sam Ludwig',
      title: 'Newest Title from Cloud',
      updatedAt: new Date(now).toISOString()
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, profile: newerRemoteProfile })
    });

    const result = await fetchProfileFromBackend('sam_ludwig');

    expect(result.title).toBe('Newest Title from Cloud');
    const active = getActiveProfile();
    expect(active.title).toBe('Newest Title from Cloud');
  });
});

