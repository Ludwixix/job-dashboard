/**
 * Polite Pacing & Anti-Bot Guard
 * Enforces human-speed jitter (1.5s–3.0s), single-flight FIFO queuing (concurrency = 1),
 * and rate-limit / checkpoint circuit breaker.
 */

export class PolitePacer {
  /**
   * @param {Object} options
   * @param {number} [options.minDelayMs=1500] Minimum delay in ms
   * @param {number} [options.maxDelayMs=3000] Maximum delay in ms
   * @param {number} [options.cooldownDurationMs=900000] Cooldown window in ms (default 15m)
   */
  constructor(options = {}) {
    this.minDelayMs = options.minDelayMs ?? 1500;
    this.maxDelayMs = options.maxDelayMs ?? 3000;
    this.cooldownDurationMs = options.cooldownDurationMs ?? (15 * 60 * 1000);
    this.isProcessing = false;
  }

  /**
   * Calculates randomized delay with uniform jitter within bounds.
   * @returns {number}
   */
  getRandomDelay() {
    return Math.floor(this.minDelayMs + Math.random() * (this.maxDelayMs - this.minDelayMs));
  }

  /**
   * Sleeps for a randomized jitter duration.
   * @returns {Promise<number>} Returns the elapsed sleep duration in ms.
   */
  async politeSleep() {
    const ms = this.getRandomDelay();
    await new Promise(resolve => setTimeout(resolve, ms));
    return ms;
  }

  /**
   * Checks if an anti-bot circuit breaker cooldown is active in storage.
   * @returns {Promise<boolean>}
   */
  async isCooldownActive() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const data = await chrome.storage.local.get(['linkedin_cooldown_until']);
        if (data.linkedin_cooldown_until && Date.now() < data.linkedin_cooldown_until) {
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  /**
   * Triggers an anti-bot cooldown window.
   * @param {string} [reason='Rate limit or challenge encountered']
   * @returns {Promise<number>} Cooldown expiration timestamp
   */
  async triggerCooldown(reason = 'Rate limit or challenge encountered') {
    const until = Date.now() + this.cooldownDurationMs;
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          linkedin_cooldown_until: until,
          linkedin_cooldown_reason: reason
        });
      }
    } catch (_) {}
    console.warn(`[PolitePacer] Cooldown engaged until ${new Date(until).toISOString()}. Reason: ${reason}`);
    return until;
  }

  /**
   * Clears any active cooldown (e.g. for testing or manual user reset).
   */
  async clearCooldown() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove(['linkedin_cooldown_until', 'linkedin_cooldown_reason']);
      }
    } catch (_) {}
  }

  /**
   * Processes items sequentially through a polite single-flight queue.
   * @param {Array<any>} items
   * @param {Function} itemHandler - async (item, index) => result
   * @param {Function} [progressCallback] - ({ completed, total, currentItem }) => void
   * @returns {Promise<Array<{ item: any, success: boolean, result?: any, error?: string }>>}
   */
  async processBatchQueue(items, itemHandler, progressCallback) {
    if (this.isProcessing) {
      throw new Error('A batch operation is already in progress. Single-flight boundary enforced.');
    }

    this.isProcessing = true;
    const results = [];

    try {
      if (await this.isCooldownActive()) {
        throw new Error('Polite pacing cooldown is currently active. Batch operation blocked for safety.');
      }

      for (let i = 0; i < items.length; i++) {
        // Enforce polite jitter delay between items (skip before the 1st item)
        if (i > 0) {
          await this.politeSleep();
        }

        const item = items[i];
        try {
          const res = await itemHandler(item, i);
          results.push({ item, success: true, result: res });
        } catch (err) {
          const errMsg = err?.message || String(err);
          results.push({ item, success: false, error: errMsg });

          // Trip circuit breaker if HTTP 429, checkpoint, or anti-bot challenge is detected
          if (/429|rate limit|challenge|checkpoint|blocked|unauthorized/i.test(errMsg)) {
            await this.triggerCooldown(errMsg);
            break;
          }
        }

        if (typeof progressCallback === 'function') {
          progressCallback({ completed: i + 1, total: items.length, currentItem: item });
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return results;
  }
}
