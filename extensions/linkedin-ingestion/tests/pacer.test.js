import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PolitePacer } from '../src/content/pacer.js';

describe('PolitePacer & Anti-Bot Guard Suite', () => {
  beforeEach(async () => {
    const pacer = new PolitePacer();
    await pacer.clearCooldown();
  });

  it('produces randomized delays strictly within configured bounds', () => {
    const pacer = new PolitePacer({ minDelayMs: 1500, maxDelayMs: 3000 });

    for (let i = 0; i < 50; i++) {
      const delay = pacer.getRandomDelay();
      expect(delay).toBeGreaterThanOrEqual(1500);
      expect(delay).toBeLessThanOrEqual(3000);
    }
  });

  it('processes batch queue sequentially and reports progress', async () => {
    // Use smaller delay for test speed
    const pacer = new PolitePacer({ minDelayMs: 10, maxDelayMs: 20 });
    const items = ['item1', 'item2', 'item3'];
    const progressUpdates = [];

    const results = await pacer.processBatchQueue(
      items,
      async (item, idx) => `processed_${item}_${idx}`,
      (p) => progressUpdates.push(p.completed)
    );

    expect(results).toHaveLength(3);
    expect(results[0].result).toBe('processed_item1_0');
    expect(results[1].result).toBe('processed_item2_1');
    expect(results[2].result).toBe('processed_item3_2');
    expect(progressUpdates).toEqual([1, 2, 3]);
  });

  it('enforces single-flight concurrency = 1 (rejects concurrent batch runs)', async () => {
    const pacer = new PolitePacer({ minDelayMs: 100, maxDelayMs: 150 });
    const slowRun = pacer.processBatchQueue(['a', 'b'], async () => {
      await new Promise(r => setTimeout(r, 50));
      return 'ok';
    });

    // Attempt second run while first is active
    await expect(pacer.processBatchQueue(['c'], async () => 'fail')).rejects.toThrow(
      /batch operation is already in progress/i
    );

    await slowRun;
    expect(pacer.isProcessing).toBe(false);
  });

  it('trips circuit-breaker cooldown when rate-limit error is encountered', async () => {
    const pacer = new PolitePacer({ minDelayMs: 10, maxDelayMs: 20, cooldownDurationMs: 60000 });
    const items = ['valid1', 'trigger429', 'never_reached'];

    const results = await pacer.processBatchQueue(items, async (item) => {
      if (item === 'trigger429') {
        throw new Error('HTTP 429 Too Many Requests: Rate limit exceeded');
      }
      return 'success';
    });

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[1].error).toContain('429');

    // Check that cooldown is now active
    const isActive = await pacer.isCooldownActive();
    expect(isActive).toBe(true);

    // Attempting a new batch while cooldown is active must throw
    await expect(pacer.processBatchQueue(['test'], async () => 'no')).rejects.toThrow(
      /cooldown is currently active/i
    );
  });
});
