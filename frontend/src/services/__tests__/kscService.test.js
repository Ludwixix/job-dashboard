import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CAPABILITY_PILLARS,
  getPillarBadgeTheme,
  getWordCount,
  clientMapKscToCapability,
  clientExtractKscFromJd,
  clientGenerateKscReport,
  fetchJobKscReport,
  generateCustomKscReport,
} from '../kscService';

describe('kscService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calculates word counts accurately', () => {
    expect(getWordCount('')).toBe(0);
    expect(getWordCount('One two three four five')).toBe(5);
    expect(getWordCount('   Multiple    spaces   between words   ')).toBe(4);
  });

  it('maps criteria text to capability framework pillars', () => {
    const rel = clientMapKscToCapability('High-level stakeholder management and collaborative partnership skills.');
    expect(rel.key).toBe('RELATIONSHIPS');

    const comm = clientMapKscToCapability('Demonstrated capability in written executive briefings and presentations.');
    expect(comm.key).toBe('COMMUNICATION');

    const res = clientMapKscToCapability('Proven ability to deliver complex project milestones within budget and KPIs.');
    expect(res.key).toBe('ACHIEVES_RESULTS');

    const strat = clientMapKscToCapability('Demonstrated strategic thinking, policy design, and continuous improvement.');
    expect(strat.key).toBe('STRATEGIC_DIRECTION');

    const integ = clientMapKscToCapability('Commitment to public sector ethics, integrity, and probity.');
    expect(integ.key).toBe('INTEGRITY_DRIVE');
  });

  it('extracts criteria from position description or falls back cleanly', () => {
    const jd = `
      Position: Senior Advisor
      Key selection criteria:
      1. Proven ability to lead and mentor multidisciplinary teams.
      2. High-level written communication and ministerial correspondence skills.
      3. Demonstrated analytical and strategic policy development capabilities.
    `;
    const criteria = clientExtractKscFromJd(jd, 'Senior Advisor');
    expect(criteria.length).toBe(3);
    expect(criteria[0]).toContain('multidisciplinary teams');

    const fallback = clientExtractKscFromJd('', 'Director');
    expect(fallback.length).toBeGreaterThanOrEqual(3);
    expect(fallback[0]).toContain('Director');
  });

  it('generates full client KSC report with SAO breakdown', () => {
    const job = {
      id: 'job_456',
      title: 'Senior Project Manager',
      company: 'Department of Health',
      description: 'Key Selection Criteria:\n1. Demonstrated experience managing project budgets and milestones.\n2. Proven stakeholder engagement skills.',
    };
    const profile = {
      name: 'Sam Ludwig',
      skills: ['Agile Project Management', 'Budgeting'],
    };

    const report = clientGenerateKscReport(job, profile, null, 300);
    expect(report.company).toBe('Department of Health');
    expect(report.candidate_name).toBe('Sam Ludwig');
    expect(report.total_criteria).toBe(2);
    expect(report.solutions[0].full_statement).toContain('**Situation:**');
    expect(report.solutions[0].full_statement).toContain('**Action:**');
    expect(report.solutions[0].full_statement).toContain('**Outcome:**');
    expect(report.master_document).toContain('# Key Selection Criteria Response Document');
  });

  it('falls back to client report on network failure in fetchJobKscReport', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const job = { id: '789', title: 'Analyst', company: 'Treasury' };
    const profile = { name: 'Alex' };

    const report = await fetchJobKscReport(job, profile);
    expect(report.company).toBe('Treasury');
    expect(report.solutions.length).toBeGreaterThan(0);
  });

  it('falls back to client custom solver on network failure in generateCustomKscReport', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

    const custom = ['Demonstrated experience in data analysis and SQL reporting.'];
    const report = await generateCustomKscReport({ company: 'DFFH' }, { name: 'Jordan' }, custom, 250);

    expect(report.company).toBe('DFFH');
    expect(report.total_criteria).toBe(1);
    expect(report.solutions[0].target_word_limit).toBe(250);
  });

  it('returns appropriate badge classes for capability pillars', () => {
    const badgeRel = getPillarBadgeTheme('RELATIONSHIPS');
    expect(badgeRel).toContain('purple');

    const badgeRes = getPillarBadgeTheme('ACHIEVES_RESULTS');
    expect(badgeRes).toContain('emerald');

    const badgeDef = getPillarBadgeTheme('UNKNOWN_PILLAR');
    expect(badgeDef).toContain('slate');
  });
});
