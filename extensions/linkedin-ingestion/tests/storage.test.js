import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSettings,
  saveSettings,
  recordImport,
  getImportHistory,
  isJobImported,
  addToPendingQueue,
  flushPendingQueue
} from '../src/background/storage.js';

describe('Storage & Cache Management Suite', () => {
  beforeEach(async () => {
    await chrome.storage.local.clear();
  });

  it('manages user settings with defaults', async () => {
    const defaults = await getSettings();
    expect(defaults.overrideMode).toBe('auto');
    expect(defaults.customBackendUrl).toBe('');

    await saveSettings({
      overrideMode: 'custom',
      customBackendUrl: 'http://localhost:8080',
      authToken: 'test-jwt',
      userId: 'user_42'
    });

    const updated = await getSettings();
    expect(updated.overrideMode).toBe('custom');
    expect(updated.customBackendUrl).toBe('http://localhost:8080');
    expect(updated.authToken).toBe('test-jwt');
    expect(updated.userId).toBe('user_42');
  });

  it('records imports and maintains bounded history list', async () => {
    const job1 = { id: 'linkedin_ext_1', title: 'Role 1', company: 'Co 1', location: 'Melb', url: 'http://1' };
    const job2 = { id: 'linkedin_ext_2', title: 'Role 2', company: 'Co 2', location: 'Syd', url: 'http://2' };

    await recordImport(job1, 'localhost');
    await recordImport(job2, 'production');

    expect(await isJobImported('linkedin_ext_1')).toBe(true);
    expect(await isJobImported('linkedin_ext_2')).toBe(true);
    expect(await isJobImported('linkedin_ext_999')).toBe(false);

    const history = await getImportHistory();
    expect(history).toHaveLength(2);
    expect(history[0].id).toBe('linkedin_ext_2'); // Most recent first
    expect(history[1].id).toBe('linkedin_ext_1');
  });

  it('handles offline pending queue buffering and flushing', async () => {
    const job = { id: 'linkedin_ext_offline', title: 'Offline Role', company: 'Offline Inc' };

    await addToPendingQueue(job);
    // Duplicate queue attempt should be ignored
    await addToPendingQueue(job);

    const queued = await flushPendingQueue();
    expect(queued).toHaveLength(1);
    expect(queued[0].job.id).toBe('linkedin_ext_offline');

    // Flush should clear queue
    const emptyQueue = await flushPendingQueue();
    expect(emptyQueue).toHaveLength(0);
  });
});
