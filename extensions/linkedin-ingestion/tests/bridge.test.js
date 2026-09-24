import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  normalizeJobPayload,
  getResolvedBackend,
  handleJobIngest,
  probeBackend,
  BACKEND_TARGETS
} from '../src/background/api-bridge.js';
import { getSettings, saveSettings, getImportHistory } from '../src/background/storage.js';

describe('Dual-Target API Bridge & Normalization Suite', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    await chrome.storage.local.clear();
    await saveSettings({ overrideMode: 'auto', customBackendUrl: '' });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('normalizes raw job payload conforming strictly to Job Dashboard schema', () => {
    const rawJob = {
      id: 'linkedin_ext_4459466556',
      numeric_id: '4459466556',
      title: '  Senior Cloud DevOps Engineer  ',
      company: '  Canva  ',
      location: '  Sydney, NSW  ',
      workplace_type: 'Hybrid',
      employment_type: 'Full-time',
      salary_raw: '$180,000 - $210,000',
      date_posted: '2026-09-24',
      description: 'Design distributed Kubernetes clusters and CI/CD pipelines.',
      url: 'https://www.linkedin.com/jobs/view/4459466556/'
    };

    const normalized = normalizeJobPayload(rawJob);

    expect(normalized.id).toBe('linkedin_ext_4459466556');
    expect(normalized.title).toBe('Senior Cloud DevOps Engineer');
    expect(normalized.company).toBe('Canva');
    expect(normalized.location).toBe('Sydney, NSW');
    expect(normalized.remote).toBe(true); // Hybrid -> remote true
    expect(normalized.workplace_type).toBe('Hybrid');
    expect(normalized.employment_type).toBe('Full-time');
    expect(normalized.salary_raw).toBe('$180,000 - $210,000');
    expect(normalized.source).toBe('LinkedIn (Extension)');

    // CRITICAL INVARIANT: BOTH posted and date_posted must be populated
    expect(normalized.date_posted).toBe('2026-09-24');
    expect(normalized.posted).toBe('2026-09-24');
    expect(normalized.date).toBe('2026-09-24');

    expect(normalized.tags).toContain('linkedin');
    expect(normalized.tags).toContain('extension');
    expect(normalized.tags).toContain('core');
  });

  it('generates deterministic ID and today date when fields are omitted', () => {
    const rawJob = {
      numeric_id: '9988776655',
      title: 'Site Reliability Engineer',
      company: 'Atlassian'
    };

    const normalized = normalizeJobPayload(rawJob);

    expect(normalized.id).toBe('linkedin_ext_9988776655');
    expect(normalized.location).toBe('Melbourne, VIC');
    expect(normalized.url).toBe('https://www.linkedin.com/jobs/view/9988776655/');
    expect(normalized.date_posted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(normalized.posted).toBe(normalized.date_posted);
  });

  it('resolves Localhost (8000) when health check probe succeeds', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url === BACKEND_TARGETS.LOCAL_HEALTH) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: 'healthy', version: '1.0.0' })
        });
      }
      return Promise.reject(new Error('Connection refused'));
    });

    const backend = await getResolvedBackend();
    expect(backend.target).toBe('localhost');
    expect(backend.url).toBe(BACKEND_TARGETS.LOCAL_JOBS);
    expect(backend.healthy).toBe(true);
  });

  it('falls back seamlessly to Cloud Run Production when Localhost is offline', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url === BACKEND_TARGETS.LOCAL_HEALTH) {
        return Promise.reject(new Error('Failed to fetch (ECONNREFUSED)'));
      }
      if (url === BACKEND_TARGETS.PROD_HEALTH) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: 'healthy' })
        });
      }
      return Promise.reject(new Error('Not found'));
    });

    const backend = await getResolvedBackend();
    expect(backend.target).toBe('production');
    expect(backend.url).toBe(BACKEND_TARGETS.PROD_JOBS);
    expect(backend.healthy).toBe(true);
  });

  it('respects custom backend override if configured in settings', async () => {
    await saveSettings({
      overrideMode: 'custom',
      customBackendUrl: 'http://custom-proxy:9000'
    });

    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url === 'http://custom-proxy:9000/api/health') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: 'healthy' })
        });
      }
      return Promise.reject(new Error('Not found'));
    });

    const backend = await getResolvedBackend();
    expect(backend.target).toBe('custom');
    expect(backend.url).toBe('http://custom-proxy:9000/api/jobs');
  });

  it('successfully posts normalized payload, records import, and handles duplicates', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url === BACKEND_TARGETS.LOCAL_HEALTH) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: 'healthy' })
        });
      }
      if (url === BACKEND_TARGETS.LOCAL_JOBS && opts?.method === 'POST') {
        const body = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ success: true, job: body })
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    const job = {
      id: 'linkedin_ext_12345',
      title: 'Principal Engineer',
      company: 'REA Group',
      location: 'Melbourne, VIC'
    };

    // First import
    const res1 = await handleJobIngest(job);
    expect(res1.success).toBe(true);
    expect(res1.jobId).toBe('linkedin_ext_12345');
    expect(res1.isDuplicate).toBe(false);

    // Verify recorded in storage
    const history = await getImportHistory();
    expect(history).toHaveLength(1);
    expect(history[0].title).toBe('Principal Engineer');

    // Second import (idempotent duplicate)
    const res2 = await handleJobIngest(job);
    expect(res2.success).toBe(true);
    expect(res2.isDuplicate).toBe(true);
  });
});
