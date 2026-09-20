import { describe, it, expect } from 'vitest';
import { parseResumeTextClientSide } from '../profileService';

describe('Multi-Industry Resume Parsing Engine', () => {
  const nurseResume = `
    Sarah Whitfield
    Registered Nurse / Clinical Care Coordinator
    sarah.whitfield@email.com | 0412 999 888 | Richmond, VIC 3121
    AHPRA Registered Nurse (Division 1) · WWCC · Advanced Life Support

    PROFESSIONAL SUMMARY
    Dedicated Registered Nurse with 7 years of acute emergency triage, clinical governance,
    and patient-centered care experience across major Victorian metropolitan hospitals.

    WORK EXPERIENCE
    Registered Nurse (Emergency & Acute Care) — Epworth Richmond (2020 – Present)
    - Administered intravenous medications and complex patient triage protocols.
    - Utilized EMR / Cerner electronic health documentation systems.
    - Supervised nursing rotations and ensured NSQHS infection control compliance.

    Clinical Nurse Specialist — St Vincent's Hospital Melbourne (2017 – 2020)
    - Delivered patient assessments and emergency triage interventions.
  `;

  const accountantResume = `
    Marcus Wong CPA
    Senior Financial Accountant
    marcus.wong@finance.com | 0422 111 222 | Melbourne VIC 3000

    PROFILE
    CPA Qualified Senior Accountant with 9 years managing statutory reporting, balance sheet reconciliations,
    and tax compliance (BAS / GST) in corporate enterprise environments.

    EXPERIENCE
    Senior Management Accountant — Treasury Group (2019 – Present)
    - Managed month-end close and variance analysis across SAP ERP.
    - Constructed complex financial modeling in Excel and Power BI.
  `;

  it('correctly parses a Nurse resume into Healthcare & Medical without defaulting to IT Engineer', () => {
    const result = parseResumeTextClientSide(nurseResume);

    expect(result.name).toBe('Sarah Whitfield');
    expect(result.industry).toBe('Healthcare & Medical');
    expect(result.title).toMatch(/Registered Nurse|Clinical Nurse/i);
    expect(result.title).not.toContain('Systems');
    expect(result.title).not.toContain('Engineer');

    // Target titles must be relevant healthcare queries
    expect(result.targetTitles.length).toBeGreaterThan(0);
    expect(result.targetTitles.some(t => /Registered Nurse/i.test(t))).toBe(true);
    expect(result.targetTitles.some(t => /Infrastructure|Cloud|Systems|DevOps/i.test(t))).toBe(false);

    // Skills must contain nursing competencies
    expect(result.coreSkills.some(s => /AHPRA|Registered Nurse|Triage|Medication/i.test(s))).toBe(true);
    expect(result.coreSkills.some(s => /Azure|Kubernetes|Active Directory/i.test(s))).toBe(false);
  });

  it('respects existing profile industry context when parsing', () => {
    const result = parseResumeTextClientSide(nurseResume, {
      name: 'Sarah Whitfield Test',
      industry: 'Healthcare & Medical'
    });

    expect(result.name).toBe('Sarah Whitfield Test');
    expect(result.industry).toBe('Healthcare & Medical');
    expect(result.targetTitles.some(t => /Nurse/i.test(t))).toBe(true);
    expect(result.targetTitles.some(t => /Systems Engineer/i.test(t))).toBe(false);
  });

  it('correctly parses an Accountant resume into Finance & Accounting', () => {
    const result = parseResumeTextClientSide(accountantResume);

    expect(result.industry).toBe('Finance & Accounting');
    expect(result.title).toMatch(/Accountant|Financial/i);
    expect(result.title).not.toContain('Systems');
    expect(result.targetTitles.some(t => /Accountant|Finance/i.test(t))).toBe(true);
    expect(result.coreSkills.some(s => /CPA|Financial|Tax|Reporting|SAP/i.test(s))).toBe(true);
  });
});
