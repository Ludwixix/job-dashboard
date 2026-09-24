import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import {
  extractActiveJob,
  extractJobId,
  formatCanonicalUrl,
  parseRelativeDate,
  formatDescription,
  expandDescription,
  getCleanText
} from '../src/content/extractor.js';
import { scanVisibleFeedCards, extractFeedCard } from '../src/content/recommender.js';

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

describe('LinkedIn DOM Extractor Suite', () => {
  it('extracts all fields from Modern Unified Top Card fixture', async () => {
    const html = fs.readFileSync(path.join(FIXTURES_DIR, 'job-detail-unified.html'), 'utf8');
    const dom = new JSDOM(html, { url: 'https://www.linkedin.com/jobs/view/4459466556/?trackingId=abc123xyz' });
    const doc = dom.window.document;

    const job = await extractActiveJob(doc, dom.window.location.href);

    expect(job.id).toBe('linkedin_ext_4459466556');
    expect(job.numeric_id).toBe('4459466556');
    expect(job.title).toBe('Lead Cloud Security Architect');
    expect(job.company).toBe('LAB3');
    expect(job.location).toBe('Melbourne, VIC');
    expect(job.workplace_type).toBe('Hybrid');
    expect(job.remote).toBe(true);
    expect(job.employment_type).toBe('Full-time');
    expect(job.salary_raw).toBe('$160,000/yr - $185,000/yr');
    expect(job.date_posted).toBe('2026-09-22');
    expect(job.posted).toBe('2026-09-22'); // CRITICAL: posted matches date_posted
    expect(job.url).toBe('https://www.linkedin.com/jobs/view/4459466556/');
    expect(job.source).toBe('LinkedIn (Extension)');
    expect(job.tags).toContain('linkedin');
    expect(job.tags).toContain('extension');

    expect(job.description).toContain('LAB3 is seeking a Lead Cloud Security Architect');
    expect(job.description).toContain('• Design and deploy Microsoft Sentinel');
  });

  it('extracts fields from Classic Two-Pane view fixture', async () => {
    const html = fs.readFileSync(path.join(FIXTURES_DIR, 'job-detail-classic.html'), 'utf8');
    const dom = new JSDOM(html, { url: 'https://www.linkedin.com/jobs/search/?currentJobId=4458475378' });
    const doc = dom.window.document;

    const job = await extractActiveJob(doc, dom.window.location.href);

    expect(job.id).toBe('linkedin_ext_4458475378');
    expect(job.title).toBe('Senior Systems & Intune Engineer');
    expect(job.company).toBe('APM Group');
    expect(job.location).toBe('Sydney, NSW');
    expect(job.workplace_type).toBe('Remote');
    expect(job.remote).toBe(true);
    expect(job.employment_type).toBe('Contract');
    expect(job.url).toBe('https://www.linkedin.com/jobs/view/4458475378/');
    expect(job.description).toContain('Contract mandate for enterprise Intune packaging');
    expect(job.description).toContain('• Migrate 4,000 endpoints from SCCM to Microsoft Intune.');
  });

  it('scans visible recommendation feed cards in-situ', () => {
    const html = fs.readFileSync(path.join(FIXTURES_DIR, 'job-feed-recommended.html'), 'utf8');
    const dom = new JSDOM(html, { url: 'https://www.linkedin.com/jobs/collections/recommended/' });
    const doc = dom.window.document;

    const cards = scanVisibleFeedCards(doc);
    expect(cards).toHaveLength(3);

    // Card 1
    expect(cards[0].id).toBe('linkedin_ext_4459466556');
    expect(cards[0].title).toBe('Senior DevOps Engineer');
    expect(cards[0].company).toBe('Atlassian');
    expect(cards[0].remote).toBe(true);
    expect(cards[0].url).toBe('https://www.linkedin.com/jobs/view/4459466556/');

    // Card 2
    expect(cards[1].id).toBe('linkedin_ext_4460322045');
    expect(cards[1].title).toBe('Platform Infrastructure Lead');
    expect(cards[1].company).toBe('Canva');
    expect(cards[1].remote).toBe(true);
    expect(cards[1].workplace_type).toBe('Hybrid');
    expect(cards[1].url).toBe('https://www.linkedin.com/jobs/view/4460322045/');

    // Card 3
    expect(cards[2].id).toBe('linkedin_ext_4461998877');
    expect(cards[2].title).toBe('Network Operations Specialist');
    expect(cards[2].company).toBe('Telstra');
    expect(cards[2].remote).toBe(false);
    expect(cards[2].workplace_type).toBe('On-site');
  });

  it('extracts Job ID from various URL patterns and DOM attributes', () => {
    const dom = new JSDOM('<div data-job-id="4411223344"></div>');
    const doc = dom.window.document;

    // Pattern 1: /jobs/view/<numeric_id>
    expect(extractJobId(doc, 'https://www.linkedin.com/jobs/view/4123456789/')).toBe('4123456789');

    // Pattern 2: /jobs/view/slug-<numeric_id>
    expect(extractJobId(doc, 'https://www.linkedin.com/jobs/view/cloud-architect-4987654321/?trackingId=xyz')).toBe('4987654321');

    // Pattern 3: currentJobId query param
    expect(extractJobId(doc, 'https://www.linkedin.com/jobs/search/?currentJobId=4555666777&keywords=devops')).toBe('4555666777');

    // Pattern 4: Fallback to DOM attribute
    expect(extractJobId(doc, 'https://www.linkedin.com/jobs/')).toBe('4411223344');
  });

  it('strips tracking parameters to produce clean canonical URLs', () => {
    expect(formatCanonicalUrl('4459466556')).toBe('https://www.linkedin.com/jobs/view/4459466556/');
    expect(formatCanonicalUrl('')).toBe('');
  });

  it('parses relative dates accurately into YYYY-MM-DD', () => {
    const fixedNow = new Date('2026-09-24T12:00:00Z');

    expect(parseRelativeDate('just now', fixedNow)).toBe('2026-09-24');
    expect(parseRelativeDate('3 hours ago', fixedNow)).toBe('2026-09-24');
    expect(parseRelativeDate('1 day ago', fixedNow)).toBe('2026-09-23');
    expect(parseRelativeDate('2 days ago', fixedNow)).toBe('2026-09-22');
    expect(parseRelativeDate('1 week ago', fixedNow)).toBe('2026-09-17');
    expect(parseRelativeDate('1 month ago', fixedNow)).toBe('2026-08-25');
  });

  it('falls back safely to defaults on malformed or empty documents', async () => {
    const dom = new JSDOM('<div></div>', { url: 'https://www.linkedin.com/jobs/' });
    const job = await extractActiveJob(dom.window.document, dom.window.location.href);

    expect(job.title).toBe('Untitled Role');
    expect(job.company).toBe('Confidential');
    expect(job.location).toBe('Melbourne, VIC');
    expect(job.remote).toBe(false);
    expect(job.workplace_type).toBe('On-site');
    expect(job.employment_type).toBe('Full-time');
    expect(job.id).toMatch(/^linkedin_ext_\d+/);
    expect(job.date_posted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(job.posted).toBe(job.date_posted);
  });

  it('handles description expander click safely', async () => {
    const dom = new JSDOM(`
      <div>
        <div id="job-details"><p>Short snippet</p></div>
        <button class="jobs-description__footer-button" aria-expanded="false">Show more</button>
      </div>
    `);
    const doc = dom.window.document;
    const btn = doc.querySelector('.jobs-description__footer-button');
    let clicked = false;
    btn.addEventListener('click', () => { clicked = true; btn.setAttribute('aria-expanded', 'true'); });

    await expandDescription(doc);
    expect(clicked).toBe(true);
  });
});
