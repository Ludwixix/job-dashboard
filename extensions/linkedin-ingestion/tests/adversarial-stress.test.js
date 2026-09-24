import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { PolitePacer } from '../src/content/pacer.js';
import {
  extractActiveJob,
  extractJobId,
  formatCanonicalUrl,
  parseRelativeDate,
  formatDescription,
  expandDescription
} from '../src/content/extractor.js';
import {
  normalizeJobPayload,
  getResolvedBackend,
  handleJobIngest,
  probeBackend,
  BACKEND_TARGETS
} from '../src/background/api-bridge.js';
import { saveSettings, flushPendingQueue, getImportHistory } from '../src/background/storage.js';

describe('Challenger Adversarial Stress & Verification Gauntlet', () => {

  // =========================================================================
  // SECTION 1: PolitePacer Adversarial Verification
  // =========================================================================
  describe('1. PolitePacer Jitter & Burst Concurrency Gauntlet', () => {
    let pacer;

    beforeEach(async () => {
      pacer = new PolitePacer({ minDelayMs: 1500, maxDelayMs: 3000 });
      await pacer.clearCooldown();
    });

    it('empirically verifies 50 consecutive jitter delays are strictly within [1500, 3000] ms', () => {
      const delays = [];
      for (let i = 0; i < 50; i++) {
        const delay = pacer.getRandomDelay();
        delays.push(delay);
        expect(delay).toBeGreaterThanOrEqual(1500);
        expect(delay).toBeLessThanOrEqual(3000);
        expect(Number.isInteger(delay)).toBe(true);
      }

      // Verify variance across 50 samples (must be distributed, non-static)
      const minSampled = Math.min(...delays);
      const maxSampled = Math.max(...delays);
      const uniqueDelays = new Set(delays);

      expect(uniqueDelays.size).toBeGreaterThan(30); // High entropy
      expect(maxSampled - minSampled).toBeGreaterThan(500); // Substantial jitter spread
    });

    it('empirically verifies single-flight concurrency is strictly preserved under burst enqueueing (20 concurrent calls)', async () => {
      let activeWorkers = 0;
      let maxSimultaneousActive = 0;
      let executedCount = 0;

      // Launch 20 simultaneous batch queue requests in an immediate burst
      const burstPromises = Array.from({ length: 20 }, (_, index) => {
        return pacer.processBatchQueue([`burst_item_${index}`], async (item) => {
          activeWorkers++;
          maxSimultaneousActive = Math.max(maxSimultaneousActive, activeWorkers);
          // Simulate brief async I/O
          await new Promise(resolve => setTimeout(resolve, 30));
          executedCount++;
          activeWorkers--;
          return `done_${item}`;
        });
      });

      const settledResults = await Promise.allSettled(burstPromises);

      // Exactly ONE request should be fulfilled
      const fulfilled = settledResults.filter(r => r.status === 'fulfilled');
      const rejected = settledResults.filter(r => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(19);

      // All rejected requests must cite single-flight concurrency enforcement
      rejected.forEach(rej => {
        expect(rej.reason.message).toMatch(/single-flight boundary enforced/i);
      });

      // Crucial concurrency check: at no time were >= 2 workers active simultaneously
      expect(maxSimultaneousActive).toBe(1);
      expect(executedCount).toBe(1);
      expect(pacer.isProcessing).toBe(false);
    });

    it('verifies sequential batches execute cleanly once the single-flight lock is released', async () => {
      const batch1 = await pacer.processBatchQueue(['item1'], async (item) => `res_${item}`);
      expect(batch1).toHaveLength(1);
      expect(batch1[0].success).toBe(true);
      expect(pacer.isProcessing).toBe(false);

      const batch2 = await pacer.processBatchQueue(['item2'], async (item) => `res_${item}`);
      expect(batch2).toHaveLength(1);
      expect(batch2[0].success).toBe(true);
      expect(pacer.isProcessing).toBe(false);
    });

    it('verifies single-flight lock is released even if batch handler encounters an unhandled rejection', async () => {
      await expect(
        pacer.processBatchQueue(['bad_item'], async () => {
          throw new Error('Simulated crash in handler');
        })
      ).resolves.toBeDefined(); // Handler error is caught per-item, not bubbling unhandled

      expect(pacer.isProcessing).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 2: extractor.js Corrupted / Adversarial DOM Stress Testing
  // =========================================================================
  describe('2. extractor.js Adversarial & Corrupted DOM Stress Gauntlet', () => {

    it('survives completely missing title and missing company with safe defaults', async () => {
      const corruptedHtml = `
        <div class="jobs-search__job-details">
          <div class="job-details-jobs-unified-top-card">
            <!-- No title element at all -->
            <!-- No company element at all -->
            <div class="job-details-jobs-unified-top-card__primary-description">
              Melbourne, VIC · 2 days ago
            </div>
          </div>
        </div>
      `;
      const dom = new JSDOM(corruptedHtml);
      const job = await extractActiveJob(dom.window.document, 'https://www.linkedin.com/jobs/view/4455667788/');

      expect(job.title).toBe('Untitled Role');
      expect(job.company).toBe('Confidential');
      expect(job.location).toBe('Melbourne, VIC');
      expect(job.id).toBe('linkedin_ext_4455667788');
      expect(job.source).toBe('LinkedIn (Extension)');
    });

    it('cleans deeply nested description with SVG garbage, XSS scripts, styles, and noscript tags', async () => {
      const adversarialHtml = `
        <div id="job-details">
          <div class="nested-wrapper-1">
            <div class="nested-wrapper-2">
              <svg viewBox="0 0 100 100" class="malicious-svg">
                <text x="10" y="20">GARBAGE_SVG_INJECTED_TEXT</text>
                <g><path d="M0 0"/></g>
              </svg>
              <script>window.__EVIL_XSS__ = true;</script>
              <style>.hide { display: none; }</style>
              <noscript>Javascript required to view advertisement</noscript>
              <button class="jobs-description__footer-button">See more</button>
              <p>Senior Distributed Systems Engineer needed for critical cloud infrastructure.</p>
              <ul>
                <li>Architect scalable Kubernetes microservices.</li>
                <li>Implement zero-trust security postures.</li>
              </ul>
              <div><br>Contact recruitment directly.<br></div>
            </div>
          </div>
        </div>
      `;
      const dom = new JSDOM(adversarialHtml);
      const description = formatDescription(dom.window.document.querySelector('#job-details'));

      // Check complete purge of unwanted elements
      expect(description).not.toContain('GARBAGE_SVG_INJECTED_TEXT');
      expect(description).not.toContain('__EVIL_XSS__');
      expect(description).not.toContain('Javascript required');
      expect(description).not.toContain('See more');
      expect(description).not.toContain('style');

      // Check preservation of genuine content and formatting
      expect(description).toContain('Senior Distributed Systems Engineer needed');
      expect(description).toContain('• Architect scalable Kubernetes microservices.');
      expect(description).toContain('• Implement zero-trust security postures.');
      expect(description).toContain('Contact recruitment directly.');
    });

    it('safely handles absent expander buttons and throwing expander clicks without crashing', async () => {
      // Case A: Absent expander
      const domWithoutBtn = new JSDOM('<div id="job-details"><p>Full text without expander button</p></div>');
      await expect(expandDescription(domWithoutBtn.window.document)).resolves.not.toThrow();

      // Case B: Throwing expander click
      const domWithThrowingBtn = new JSDOM(`
        <div>
          <button class="jobs-description__footer-button" aria-expanded="false">Show more</button>
        </div>
      `);
      const btn = domWithThrowingBtn.window.document.querySelector('.jobs-description__footer-button');
      btn.click = () => {
        throw new Error('Simulated DOMException during click');
      };

      await expect(expandDescription(domWithThrowingBtn.window.document)).resolves.not.toThrow();
    });

    it('parses truncated, malformed, or unusual salary ranges safely', async () => {
      const testCases = [
        { text: '$120,000 -', expected: '$120,000' },
        { text: '$ - $150,000', expected: '$150,000' },
        { text: '$140k - ', expected: '$140k' },
        { text: 'Salary up to $', expected: null },
        { text: '$180,000/yr - $220,000/yr', expected: '$180,000/yr - $220,000/yr' },
        { text: '$75/hr', expected: '$75/hr' }
      ];

      for (const tc of testCases) {
        const html = `
          <div class="job-details-jobs-unified-top-card">
            <h1>DevOps Engineer</h1>
            <li class="job-details-jobs-unified-top-card__job-insight">${tc.text}</li>
          </div>
        `;
        const dom = new JSDOM(html);
        const job = await extractActiveJob(dom.window.document, 'https://www.linkedin.com/jobs/view/1122334455/');
        expect(job.salary_raw).toBe(tc.expected);
      }
    });

    it('safely parses standard and malformed relative date strings', () => {
      const fixedNow = new Date('2026-09-24T12:00:00Z');

      // Valid relative dates
      expect(parseRelativeDate('just now', fixedNow)).toBe('2026-09-24');
      expect(parseRelativeDate('1 day ago', fixedNow)).toBe('2026-09-23');
      expect(parseRelativeDate('2 weeks ago', fixedNow)).toBe('2026-09-10');
      expect(parseRelativeDate('1 month ago', fixedNow)).toBe('2026-08-25');

      // Non-numeric / malformed strings default safely to today
      expect(parseRelativeDate('', fixedNow)).toBe('2026-09-24');
      expect(parseRelativeDate(null, fixedNow)).toBe('2026-09-24');
      expect(parseRelativeDate('unparseable string with symbols !@#$', fixedNow)).toBe('2026-09-24');
      expect(parseRelativeDate('posted NaN days ago', fixedNow)).toBe('2026-09-24');
    });

    it('empirically reproduces unhandled RangeError bug on extreme/overflowing relative dates', async () => {
      const fixedNow = new Date('2026-09-24T12:00:00Z');

      // BUG REPRODUCTION 1: parseRelativeDate directly throws RangeError on huge day values
      let caughtError = null;
      try {
        parseRelativeDate('999999999 days ago', fixedNow);
      } catch (err) {
        caughtError = err;
      }
      expect(caughtError).toBeInstanceOf(RangeError);
      expect(caughtError.message).toBe('Invalid time value');

      // BUG REPRODUCTION 2: extractActiveJob crashes on DOM containing extreme date numbers
      const corruptedDateHtml = `
        <div class="job-details-jobs-unified-top-card">
          <h1 class="job-details-jobs-unified-top-card__job-title">Staff DevOps Engineer</h1>
          <div class="job-details-jobs-unified-top-card__primary-description">
            Canva · Melbourne, VIC · 999999999 days ago
          </div>
        </div>
      `;
      const dom = new JSDOM(corruptedDateHtml);
      await expect(
        extractActiveJob(dom.window.document, 'https://www.linkedin.com/jobs/view/12345678')
      ).rejects.toThrowError(/Invalid time value/);
    });
  });

  // =========================================================================
  // SECTION 3: api-bridge.js Fallback & Backend Contract Gauntlet
  // =========================================================================
  describe('3. api-bridge.js Unresponsive Localhost & Backend Contract Gauntlet', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(async () => {
      await chrome.storage.local.clear();
      await saveSettings({ overrideMode: 'auto', customBackendUrl: '' });
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('verifies probeBackend triggers AbortController on unresponsive host after timeout', async () => {
      let receivedSignal = null;

      globalThis.fetch = vi.fn().mockImplementation((url, opts) => {
        receivedSignal = opts?.signal;
        return new Promise((_, reject) => {
          if (opts?.signal) {
            opts.signal.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted', 'AbortError'));
            });
          }
        });
      });

      // Call probeBackend with a short 50ms timeout for deterministic test execution
      const probeResult = await probeBackend('http://localhost:8000/api/health', 50);

      expect(probeResult).toBe(false);
      expect(receivedSignal).toBeDefined();
      expect(receivedSignal.aborted).toBe(true);
    });

    it('verifies getResolvedBackend falls back to Cloud Run URL when Localhost hangs/is unresponsive', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url, opts) => {
        if (url === BACKEND_TARGETS.LOCAL_HEALTH) {
          // Simulate timeout via signal abortion
          return new Promise((_, reject) => {
            if (opts?.signal) {
              opts.signal.addEventListener('abort', () => {
                reject(new DOMException('The operation was aborted', 'AbortError'));
              });
            }
          });
        }
        if (url === BACKEND_TARGETS.PROD_HEALTH) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'healthy', version: '2.4.0' })
          });
        }
        return Promise.reject(new Error('Connection refused'));
      });

      const backend = await getResolvedBackend();

      expect(backend.target).toBe('production');
      expect(backend.url).toBe(BACKEND_TARGETS.PROD_JOBS);
      expect(backend.url).toBe('https://job-dashboard-6xrdvjlrcq-ts.a.run.app/api/jobs');
      expect(backend.healthy).toBe(true);
    });

    it('verifies normalizeJobPayload satisfies the backend contract (both posted and date_posted, valid id)', () => {
      const rawJob = {
        id: 'linkedin_ext_4459466556',
        numeric_id: '4459466556',
        title: 'Principal Cloud Architect',
        company: 'Telstra',
        location: 'Melbourne, VIC',
        date_posted: '2026-09-24',
        salary_raw: '$200,000 - $230,000'
      };

      const normalized = normalizeJobPayload(rawJob);

      // Contract Requirement 1: ID correctly formatted
      expect(normalized.id).toMatch(/^linkedin_ext_\w+$/);
      expect(normalized.id).toBe('linkedin_ext_4459466556');

      // Contract Requirement 2: BOTH posted and date_posted present and identical
      expect(normalized.posted).toBeDefined();
      expect(normalized.date_posted).toBeDefined();
      expect(normalized.posted).toBe('2026-09-24');
      expect(normalized.date_posted).toBe('2026-09-24');
      expect(normalized.date).toBe('2026-09-24');

      // Contract Requirement 3: Source tag and canonical tags
      expect(normalized.source).toBe('LinkedIn (Extension)');
      expect(normalized.tags).toEqual(expect.arrayContaining(['linkedin', 'extension', 'core']));
    });

    it('verifies handleJobIngest transmits complete contract payload to Cloud Run when localhost is offline', async () => {
      let transmittedUrl = null;
      let transmittedPayload = null;
      let transmittedHeaders = null;

      globalThis.fetch = vi.fn().mockImplementation((url, opts) => {
        if (url === BACKEND_TARGETS.LOCAL_HEALTH) {
          return Promise.reject(new Error('ECONNREFUSED'));
        }
        if (url === BACKEND_TARGETS.PROD_HEALTH) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'healthy' })
          });
        }
        if (url === BACKEND_TARGETS.PROD_JOBS && opts?.method === 'POST') {
          transmittedUrl = url;
          transmittedHeaders = opts.headers;
          transmittedPayload = JSON.parse(opts.body);
          return Promise.resolve({
            ok: true,
            status: 201,
            json: () => Promise.resolve({ success: true, job: transmittedPayload })
          });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const jobToIngest = {
        numeric_id: '4459998888',
        title: 'Platform Infrastructure Lead',
        company: 'NAB',
        location: 'Melbourne, VIC',
        description: 'Managing hybrid AWS and Azure platforms.',
        workplace_type: 'Hybrid',
        salary_raw: '$190,000 - $210,000'
      };

      const result = await handleJobIngest(jobToIngest);

      expect(result.success).toBe(true);
      expect(result.target).toBe('production');
      expect(transmittedUrl).toBe('https://job-dashboard-6xrdvjlrcq-ts.a.run.app/api/jobs');
      expect(transmittedHeaders['Content-Type']).toBe('application/json');
      expect(transmittedHeaders['User-Agent']).toBe('JobDashboard-LinkedIn-Extension/1.0');

      // Contract assertions on transmitted body
      expect(transmittedPayload.id).toBe('linkedin_ext_4459998888');
      expect(transmittedPayload.title).toBe('Platform Infrastructure Lead');
      expect(transmittedPayload.company).toBe('NAB');
      expect(transmittedPayload.location).toBe('Melbourne, VIC');
      expect(transmittedPayload.remote).toBe(true); // Hybrid -> remote: true
      expect(transmittedPayload.posted).toBeDefined();
      expect(transmittedPayload.date_posted).toBeDefined();
      expect(transmittedPayload.posted).toBe(transmittedPayload.date_posted);
      expect(transmittedPayload.source).toBe('LinkedIn (Extension)');
      expect(transmittedPayload.tags).toContain('linkedin');
      expect(transmittedPayload.tags).toContain('extension');
    });

    it('verifies handleJobIngest enqueues to offline pending queue when both backends fail', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() => {
        return Promise.reject(new Error('Network offline'));
      });

      const offlineJob = {
        numeric_id: '12344321',
        title: 'Network Operations Engineer',
        company: 'Optus'
      };

      const result = await handleJobIngest(offlineJob);

      expect(result.success).toBe(false);
      expect(result.queuedOffline).toBe(true);
      expect(result.target).toBe('offline');

      // Verify stored in pending queue
      const queuedItems = await flushPendingQueue();
      expect(queuedItems).toHaveLength(1);
      expect(queuedItems[0].job.id).toBe('linkedin_ext_12344321');
    });
  });
});
