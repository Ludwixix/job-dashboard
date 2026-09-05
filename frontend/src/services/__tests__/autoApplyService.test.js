import { describe, it, expect } from 'vitest';
import { resolveScreeningQuestions, isQuickApplyEligible, getQuickApplyPlatform } from '../autoApplyService';

describe('autoApplyService industry-adaptive screening', () => {
  it('resolves healthcare & nursing screening questions correctly', () => {
    const job = {
      title: 'Registered Nurse - Acute Care',
      company: 'Epworth Healthcare',
      industry: 'Healthcare & Medical',
      salary: '$88,000 - $95,000'
    };
    const profile = {
      name: 'Sarah Jenkins',
      industry: 'Healthcare & Medical',
      location: 'Melbourne, VIC',
      workRights: 'Australian Citizen (Unrestricted Full Working Rights)',
      ahpraRegistration: 'Current AHPRA Division 1 Registration #NMW0001234',
      targetSalary: '$92,000 + Super'
    };

    const questions = resolveScreeningQuestions(job, profile);
    expect(questions.length).toBeGreaterThanOrEqual(5);

    const ahpraQ = questions.find(q => q.category.includes('AHPRA') || q.question.includes('AHPRA'));
    expect(ahpraQ).toBeDefined();
    expect(ahpraQ.answer).toContain('NMW0001234');

    const clinicalQ = questions.find(q => q.category.includes('Clinical') || q.question.includes('WWCC'));
    expect(clinicalQ).toBeDefined();
    expect(clinicalQ.answer).toContain('WWCC');

    const remQ = questions.find(q => q.category.includes('Remuneration'));
    expect(remQ.answer).toContain('$88,000');
  });

  it('resolves finance & accounting screening questions correctly', () => {
    const job = {
      title: 'Senior Financial Accountant',
      company: 'Deloitte',
      industry: 'Finance & Accounting'
    };
    const profile = {
      name: 'Michael Chen',
      industry: 'Finance & Accounting',
      accountingQualification: 'CPA Australia Fellow (FCPA)'
    };

    const questions = resolveScreeningQuestions(job, profile);
    const cpaQ = questions.find(q => q.category.includes('Accounting') || q.question.includes('CPA'));
    expect(cpaQ).toBeDefined();
    expect(cpaQ.answer).toContain('FCPA');

    const erpQ = questions.find(q => q.category.includes('ERP') || q.question.includes('ERP'));
    expect(erpQ).toBeDefined();
    expect(erpQ.answer).toContain('ERP');
  });

  it('resolves construction & trades screening questions with White Card', () => {
    const job = {
      title: 'Commercial Site Supervisor',
      company: 'Lendlease',
      industry: 'Construction & Trades'
    };
    const profile = {
      name: 'Dave Miller',
      industry: 'Construction & Trades'
    };

    const questions = resolveScreeningQuestions(job, profile);
    const whiteCardQ = questions.find(q => q.question.includes('White Card'));
    expect(whiteCardQ).toBeDefined();
    expect(whiteCardQ.answer).toContain('White Card');
  });

  it('determines quick apply platform correctly', () => {
    expect(getQuickApplyPlatform({ source: 'SEEK' })).toBe('SEEK Quick Apply');
    expect(getQuickApplyPlatform({ source: 'LinkedIn' })).toBe('LinkedIn Easy Apply');
    expect(getQuickApplyPlatform({ source: 'Adzuna' })).toBe('Direct Employer 1-Click Gateway');
    expect(isQuickApplyEligible({ source: 'SEEK' })).toBe(true);
  });
});
