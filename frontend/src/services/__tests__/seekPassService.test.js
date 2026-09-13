import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CREDENTIAL_DOMAINS,
  auditSeekPassLocally,
  fetchJobSeekPassReport,
  auditSeekPassRemote,
  getRiskBadge,
} from '../seekPassService';

describe('seekPassService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('defines the 8 core Australian credential domains', () => {
    expect(Object.keys(CREDENTIAL_DOMAINS)).toHaveLength(8);
    expect(CREDENTIAL_DOMAINS).toHaveProperty('right_to_work');
    expect(CREDENTIAL_DOMAINS).toHaveProperty('security_clearance');
    expect(CREDENTIAL_DOMAINS).toHaveProperty('criminal_history');
    expect(CREDENTIAL_DOMAINS).toHaveProperty('working_with_children');
    expect(CREDENTIAL_DOMAINS).toHaveProperty('ndis_worker');
    expect(CREDENTIAL_DOMAINS).toHaveProperty('occupational_licences');
    expect(CREDENTIAL_DOMAINS).toHaveProperty('healthcare_ahpra');
    expect(CREDENTIAL_DOMAINS).toHaveProperty('finance_professional');
  });

  it('audits verified candidate credentials with 100% PASS_READY score', () => {
    const job = {
      id: 'job_001',
      title: 'Senior Systems Administrator',
      company: 'KBR',
      description: 'Must be an Australian Citizen. Baseline security clearance required. Current Police Check necessary.',
    };
    const profile = {
      name: 'Sam Ludwig',
      work_rights: 'Australian Citizen',
      clearances: ['Baseline Security Clearance'],
      credentials: ['National Police Certificate (2025)'],
    };

    const result = auditSeekPassLocally(job, profile);
    expect(result.readiness_score).toBe(100);
    expect(result.risk_level).toBe('PASS_READY');
    expect(result.knockout_count).toBe(0);
    expect(result.verified_count).toBe(3);
    expect(result.screening_responses.length).toBeGreaterThanOrEqual(3);
  });

  it('flags missing mandatory security clearance as HIGH_RISK_KNOCKOUT', () => {
    const job = {
      id: 'job_002',
      title: 'DevOps Specialist',
      company: 'Defence Contractor',
      description: 'Mandatory NV1 Security Clearance required. Australian Citizen only.',
    };
    const profile = {
      name: 'Sam Ludwig',
      work_rights: 'Australian Citizen',
      clearances: [], // No NV1
    };

    const result = auditSeekPassLocally(job, profile);
    expect(result.risk_level).toBe('HIGH_RISK_KNOCKOUT');
    expect(result.knockout_count).toBeGreaterThanOrEqual(1);
    expect(result.readiness_score).toBeLessThan(100);
  });

  it('marks job with zero credential requirements as EXEMPT', () => {
    const job = {
      id: 'job_003',
      title: 'Frontend React Developer',
      company: 'Tech Startup',
      description: 'We are seeking a React developer proficient in Tailwind and Vite. Remote friendly.',
    };
    const profile = { name: 'Sam Ludwig' };

    const result = auditSeekPassLocally(job, profile);
    expect(result.readiness_score).toBe(100);
    expect(result.risk_level).toBe('EXEMPT');
    expect(result.total_requirements).toBe(0);
  });

  it('returns correct risk badge mappings', () => {
    expect(getRiskBadge('PASS_READY').label).toContain('SEEK Pass Ready');
    expect(getRiskBadge('HIGH_RISK_KNOCKOUT').label).toContain('Knockout Risk');
    expect(getRiskBadge('MEDIUM_RISK').label).toContain('Action Required');
    expect(getRiskBadge('EXEMPT').label).toContain('Clearance Exempt');
  });

  it('fetches remote report and falls back to local audit on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network failure')));

    const profile = { name: 'Sam Ludwig', work_rights: 'Australian Citizen' };
    const report = await fetchJobSeekPassReport({ id: 'job_fail_123' }, profile);

    expect(report).toBeDefined();
    expect(report.job_id).toBe('job_fail_123');
  });

  it('performs remote audit via auditSeekPassRemote with fallback', async () => {
    const mockReport = {
      job_id: 'job_remote_1',
      readiness_score: 95,
      risk_level: 'PASS_READY',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, report: mockReport }),
    }));

    const report = await auditSeekPassRemote({ id: 'job_remote_1' }, {});
    expect(report.readiness_score).toBe(95);
  });
});
