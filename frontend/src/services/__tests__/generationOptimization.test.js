import { describe, it, expect } from 'vitest';
import { 
  generateClientSideTailoredDocs, 
  runDocumentQualityAudit 
} from '../generationService';

describe('Resume & Cover Letter Optimization Architecture (Resume_Optimization.md)', () => {
  const mockJob = {
    id: 'job-sec-101',
    title: 'Lead Cloud Infrastructure Architect',
    company: 'Sovereign Cyber Pty Ltd',
    location: 'Melbourne, VIC',
    salary: '$180,000 - $210,000',
    description: 'Enterprise Azure cloud architecture, Microsoft 365, Intune endpoint compliance, PowerShell automation, ACSC Essential 8 maturity.'
  };

  const mockProfile = {
    name: 'Sam Ludwig',
    title: 'Senior Systems & Infrastructure Engineer',
    location: 'Melbourne, VIC',
    phone: '0405 993 245',
    email: 'sam.ludwig@gmail.com',
    workRights: 'Australian Citizen (Unrestricted)',
    clearance: 'Baseline / NV1 Ready',
    coreSkills: ['Microsoft 365', 'Azure', 'Intune', 'PowerShell', 'ACSC Essential 8'],
    certifications: ['AZ-104', 'ITIL 4 Foundation']
  };

  it('generates single-column ATS resume with Australian Referees section and zero tables', () => {
    const result = generateClientSideTailoredDocs(mockJob, mockProfile);

    expect(result.success).toBe(true);
    expect(result.resume).toBeDefined();

    // 1. Single-column check: absolutely no markdown tables (|---|)
    expect(result.resume).not.toMatch(/\|[\s-:]+\|/);

    // 2. Exact Title Mirroring in body text
    expect(result.resume).toContain(mockJob.title);

    // 3. Mandatory Australian Referees Section
    expect(result.resume).toMatch(/##\s*REFEREES/i);

    // 4. Contact details in primary body text
    expect(result.resume).toContain(mockProfile.email);
    expect(result.resume).toContain(mockProfile.phone);

    // 5. Standard section headers
    expect(result.resume).toContain('## PROFESSIONAL SUMMARY');
    expect(result.resume).toContain('## SKILLS');
    expect(result.resume).toContain('## WORK EXPERIENCE');
    expect(result.resume).toContain('## EDUCATION');
  });

  it('enforces anti-template cover letter passing Swappability Test without clichés', () => {
    const result = generateClientSideTailoredDocs(mockJob, mockProfile);

    expect(result.coverLetter).toBeDefined();

    // 1. Must NOT open with generic template phrases
    expect(result.coverLetter).not.toMatch(/I am writing to apply/i);
    expect(result.coverLetter).not.toMatch(/I am applying for/i);
    expect(result.coverLetter).not.toMatch(/With a proven track record/i);
    expect(result.coverLetter).not.toMatch(/Dear Hiring Manager/i);

    // 2. Must specifically mention the company
    expect(result.coverLetter).toContain(mockJob.company);

    // 3. Must contain quantified metrics
    expect(result.coverLetter).toMatch(/99\.9%|87%|660,000\+/);

    // 4. Confident CTA
    expect(result.coverLetter).toMatch(/20-minute discussion|welcome the opportunity/i);
  });

  it('generates Phase 5 Inbound Sourcing Boolean LinkedIn Headlines & About Index', () => {
    const result = generateClientSideTailoredDocs(mockJob, mockProfile);

    expect(result.linkedInOptimization).toBeDefined();
    expect(result.linkedInOptimization).toContain('BOOLEAN-OPTIMIZED LINKEDIN HEADLINES');
    expect(result.linkedInOptimization).toContain('RECRUITER SEARCH INDEX');
    expect(result.linkedInOptimization).toContain(mockJob.title);
  });

  it('generates Phase 1 Semantic Gap Diagnostic', () => {
    const result = generateClientSideTailoredDocs(mockJob, mockProfile);

    expect(result.diagnostic).toBeDefined();
    expect(result.diagnostic.length).toBeGreaterThan(20);
  });

  it('audits quality gate: flags markdown tables and generic cover letter openers', () => {
    // Bad resume with markdown table and bad cover letter with generic opener
    const badResume = `
# CANDIDATE NAME
Title
| Col 1 | Col 2 |
|---|---|
| Skill 1 | Skill 2 |
## PROFESSIONAL SUMMARY
Results-driven team player passionate about synergy.
`;
    const badCoverLetter = `
I am writing to apply for the position at Sovereign Cyber Pty Ltd.
With a proven track record, I am thrilled to apply.
`;

    const audit = runDocumentQualityAudit(mockJob, badResume, badCoverLetter);

    // Mechanical parser check should fail due to table
    const mechCheck = audit.checks.find(c => c.id === 'single_column_mechanical');
    expect(mechCheck.passed).toBe(false);

    // Anti-cliché / Anti-template check should fail
    const antiClicheCheck = audit.checks.find(c => c.id === 'anti_cliche');
    expect(antiClicheCheck.passed).toBe(false);

    // Australian referees check should fail
    const refCheck = audit.checks.find(c => c.id === 'referees_section');
    expect(refCheck.passed).toBe(false);

    expect(audit.isReadyToSubmit).toBe(false);
  });

  it('audits quality gate: awards 90%+ pass score for fully compliant application package', () => {
    const result = generateClientSideTailoredDocs(mockJob, mockProfile);
    const audit = runDocumentQualityAudit(mockJob, result.resume, result.coverLetter);

    expect(audit.overallScore).toBeGreaterThanOrEqual(90);
    expect(audit.isReadyToSubmit).toBe(true);

    const mechCheck = audit.checks.find(c => c.id === 'single_column_mechanical');
    expect(mechCheck.passed).toBe(true);

    const refCheck = audit.checks.find(c => c.id === 'referees_section');
    expect(refCheck.passed).toBe(true);

    const antiClicheCheck = audit.checks.find(c => c.id === 'anti_cliche');
    expect(antiClicheCheck.passed).toBe(true);
  });
});
