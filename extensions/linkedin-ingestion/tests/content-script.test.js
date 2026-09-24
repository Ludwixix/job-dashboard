import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('Content Script Coordinator Suite', () => {
  let messageListener = null;

  beforeEach(() => {
    // Intercept message listener registration
    chrome.runtime.onMessage.addListener = vi.fn().mockImplementation((listener) => {
      messageListener = listener;
    });
  });

  it('registers top-level onMessage listener upon loading', async () => {
    await import('../src/content/content-script.js');
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    expect(typeof messageListener).toBe('function');
  });

  it('dispatches EXTRACT_CURRENT_JOB message properly', async () => {
    const html = fs.readFileSync(path.resolve(__dirname, 'fixtures/job-detail-unified.html'), 'utf8');
    const dom = new JSDOM(html, { url: 'https://www.linkedin.com/jobs/view/4459466556/' });
    globalThis.document = dom.window.document;
    globalThis.window = dom.window;

    let responseData = null;
    const sendResponse = (res) => { responseData = res; };

    const handled = messageListener({ action: 'EXTRACT_CURRENT_JOB' }, {}, sendResponse);
    expect(handled).toBe(true);

    // Wait for async handler
    await new Promise(r => setTimeout(r, 100));

    expect(responseData).not.toBeNull();
    expect(responseData.success).toBe(true);
    expect(responseData.job.title).toBe('Lead Cloud Security Architect');
    expect(responseData.job.company).toBe('LAB3');
  });

  it('dispatches SCAN_RECOMMENDED_FEED message properly', async () => {
    const html = fs.readFileSync(path.resolve(__dirname, 'fixtures/job-feed-recommended.html'), 'utf8');
    const dom = new JSDOM(html, { url: 'https://www.linkedin.com/jobs/collections/recommended/' });
    globalThis.document = dom.window.document;
    globalThis.window = dom.window;

    let responseData = null;
    const sendResponse = (res) => { responseData = res; };

    const handled = messageListener({ action: 'SCAN_RECOMMENDED_FEED' }, {}, sendResponse);
    expect(handled).toBe(true);

    // Wait for async handler
    await new Promise(r => setTimeout(r, 100));

    expect(responseData).not.toBeNull();
    expect(responseData.success).toBe(true);
    expect(responseData.count).toBe(3);
    expect(responseData.cards).toHaveLength(3);
  });
});
