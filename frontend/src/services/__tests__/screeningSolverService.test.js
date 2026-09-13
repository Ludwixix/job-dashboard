import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  clientSolveScreeningQuestion,
  clientExtractQuestionsFromJob,
  clientSolveScreeningReport,
  fetchJobScreeningSolutions,
  solveScreeningQuestions,
  formatRiskBadge,
} from '../screeningSolverService';

describe('screeningSolverService', () => {
  const mockProfile = {
    name: 'Jordan Lee',
    title: 'Senior DevOps Specialist',
    workRights: 'Australian Citizen (Unrestricted Full Working Rights)',
    clearance: 'Baseline / NV1 Eligible',
    yearsOfExperience: 9,
    location: 'Melbourne, VIC',
    availability: 'Immediate / <2 Weeks Notice',
    targetSalary: '$140,000 + Super',
    coreSkills: ['Kubernetes', 'Terraform', 'AWS', 'Python'],
  };

  const mockJob = {
    id: 'job_screening_01',
    title: 'Principal Cloud Platform Engineer',
    company: 'Atlassian',
    location: 'Melbourne, VIC',
    salary: '$160,000 - $185,000',
    description: `
      Must have valid Australian working rights.
      Do you hold a current Australian National Police Check?
      Demonstrated commercial experience with Kubernetes is required.
      Tell us about a time you handled a severe infrastructure outage.
    `,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('solves statutory and work rights dealbreakers', () => {
    const solRights = clientSolveScreeningQuestion(
      'Are you legally entitled to work full-time in Australia?',
      mockProfile,
      mockJob
    );
    expect(solRights.category).toBe('Mandatory Legal & Work Rights');
    expect(solRights.risk_level).toBe('Critical Dealbreaker');
    expect(solRights.answer).toContain('Australian Citizen');

    const solPolice = clientSolveScreeningQuestion(
      'Do you hold a current Australian National Police Check?',
      mockProfile,
      mockJob
    );
    expect(solPolice.risk_level).toBe('Critical Dealbreaker');
    expect(solPolice.answer).toContain('Police Check');
  });

  it('solves years of experience and technical skills', () => {
    const solExp = clientSolveScreeningQuestion(
      'How many years of experience do you have in cloud architecture?',
      mockProfile,
      mockJob
    );
    expect(solExp.category).toBe('Technical Stack Competency');
    expect(solExp.answer).toContain('9+ years');

    const solSkill = clientSolveScreeningQuestion(
      'Do you have production hands-on experience with Kubernetes?',
      mockProfile,
      mockJob
    );
    expect(solSkill.category).toBe('Technical Stack Competency');
    expect(solSkill.answer).toContain('Kubernetes');
  });

  it('solves STAR behavioral questions with structured formula', () => {
    const solStar = clientSolveScreeningQuestion(
      'Describe a time when you faced high pressure and conflicting stakeholder priorities.',
      mockProfile,
      mockJob
    );
    expect(solStar.category).toBe('STAR Behavioral & Situational');
    expect(solStar.answer).toContain('Situation:');
    expect(solStar.answer).toContain('Task:');
    expect(solStar.answer).toContain('Action:');
    expect(solStar.answer).toContain('Result:');
  });

  it('extracts implied questions from job description', () => {
    const questions = clientExtractQuestionsFromJob(mockJob);
    expect(questions.length).toBeGreaterThanOrEqual(3);
    expect(questions.some((q) => /police/i.test(q))).toBe(true);
  });

  it('compiles a complete client screening report', () => {
    const report = clientSolveScreeningReport(mockJob, mockProfile);
    expect(report.compliance_score).toBe(100);
    expect(report.dealbreaker_count).toBeGreaterThanOrEqual(1);
    expect(report.solutions.length).toBeGreaterThanOrEqual(3);
    expect(report.key_dealbreakers.length).toBeGreaterThanOrEqual(1);
  });

  it('falls back to client solver on network error in fetchJobScreeningSolutions', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));
    const report = await fetchJobScreeningSolutions('test_id', mockJob, mockProfile);
    expect(report).toBeDefined();
    expect(report.compliance_score).toBe(100);
    expect(report.solutions.length).toBeGreaterThanOrEqual(3);
  });

  it('falls back to client solver on network error in solveScreeningQuestions', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));
    const custom = ['Do you require visa sponsorship?'];
    const report = await solveScreeningQuestions(mockJob, mockProfile, custom);
    expect(report).toBeDefined();
    expect(report.solutions.length).toBe(1);
    expect(report.solutions[0].answer).toContain('No');
  });

  it('formats risk badges correctly', () => {
    const crit = formatRiskBadge('Critical Dealbreaker');
    expect(crit.text).toContain('rose');

    const med = formatRiskBadge('Medium Sensitivity');
    expect(med.text).toContain('amber');

    const low = formatRiskBadge('Low Friction');
    expect(low.text).toContain('emerald');
  });
});

