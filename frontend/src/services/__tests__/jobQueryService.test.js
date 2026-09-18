import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  buildQueriesFromProfile, 
  pushQueriesToBackend, 
  triggerProfileScrape 
} from '../jobQueryService';

describe('jobQueryService - Profile Query Generation & Auto-Scrape Trigger', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('builds search queries tailored to candidate industry, titles, and location', () => {
    const profile = {
      industry: 'Healthcare & Medical',
      location: 'Balaclava VIC 3183',
      targetTitles: ['Clinical Nurse Specialist'],
      coreSkills: ['AHPRA Registered Nurse', 'Acute Patient Assessment']
    };

    const queries = buildQueriesFromProfile(profile);

    expect(queries.length).toBeGreaterThan(0);
    expect(queries[0].term).toBe('Clinical Nurse Specialist');
    expect(queries[0].location).toBe('Balaclava, VIC');
    expect(queries[0].weight).toBe(1.5);

    // Also includes industry default titles
    const terms = queries.map(q => q.term.toLowerCase());
    expect(terms.some(t => t.includes('nurse'))).toBe(true);
  });

  it('pushes candidate-derived queries to backend search-criteria', async () => {
    const profile = {
      industry: 'Technology & IT',
      location: 'Melbourne CBD VIC 3000',
      targetTitles: ['Cloud Engineer']
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, queries: [{ term: 'Cloud Engineer' }] })
    });

    const result = await pushQueriesToBackend(profile);

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/search-criteria'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"term":"Cloud Engineer"')
      })
    );
  });

  it('preserves force: true and ttl_hours: 0.0 without falsy 12.0 coercion on initial scrape', async () => {
    const profile = {
      industry: 'Finance & Accounting',
      location: 'South Yarra VIC 3141',
      targetTitles: ['Senior Financial Analyst']
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        success: true, 
        jobs: [{ id: 'job_1', title: 'Financial Analyst' }],
        cache_stats: { cache_hit: false, total_jobs: 1 }
      })
    });

    const result = await triggerProfileScrape(profile, { force: true, ttl_hours: 0.0 });

    expect(result.success).toBe(true);
    expect(result.jobs.length).toBe(1);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, requestInit] = global.fetch.mock.calls[0];
    expect(url).toContain('/api/refresh');

    const parsedBody = JSON.parse(requestInit.body);
    expect(parsedBody.force).toBe(true);
    // Crucial: ttl_hours must be 0, NOT coerced to 12.0 by falsy checks
    expect(parsedBody.ttl_hours).toBe(0.0);
    expect(parsedBody.queries.length).toBeGreaterThan(0);
  });

  it('defaults ttl_hours to 12.0 when options.ttl_hours is undefined', async () => {
    const profile = {
      industry: 'Legal',
      location: 'Melbourne, VIC',
      targetTitles: ['Corporate Lawyer']
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, jobs: [] })
    });

    await triggerProfileScrape(profile);

    const [, requestInit] = global.fetch.mock.calls[0];
    const parsedBody = JSON.parse(requestInit.body);
    expect(parsedBody.force).toBe(false);
    expect(parsedBody.ttl_hours).toBe(12.0);
  });
});
