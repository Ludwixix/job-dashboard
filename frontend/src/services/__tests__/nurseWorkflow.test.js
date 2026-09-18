/**
 * nurseWorkflow.test.js
 * Comprehensive mock new-user workflow testing for an Australian Registered Nurse (AHPRA Division 1).
 *
 * Simulates:
 * 1. Profile Creation & Onboarding Configuration (Healthcare & Medical)
 * 2. Search Query Derivation (jobQueryService.buildQueriesFromProfile)
 * 3. Discovery & Dynamic ATS Matching / Scoring (scoringEngine.calculateCandidateJobMatch)
 * 4. SEEK Pass Pre-Qualification Audit (seekPassService.auditSeekPassLocally)
 * 5. Pre-Employment Screening Questionnaire Resolution (screeningSolverService.clientSolveScreeningQuestion)
 */

import { describe, it, expect } from 'vitest';
import { buildQueriesFromProfile, extractLocationForQuery } from '../jobQueryService';
import { calculateCandidateJobMatch } from '../scoringEngine';
import { auditSeekPassLocally } from '../seekPassService';
import { clientSolveScreeningQuestion } from '../screeningSolverService';
import { MULTI_INDUSTRY_JOBS } from '../multiIndustryJobData';

describe('Registered Nurse New User Workflow & Opportunity Discovery Lifecycle', () => {
  // Candidate Profile: Claire Davies, RN (AHPRA Division 1)
  const nurseCandidateProfile = {
    id: 'user_nurse_claire_001',
    name: 'Claire Davies, RN',
    email: 'claire.davies.rn@melbournehospital.org.au',
    title: 'Registered Nurse / Clinical Nurse Specialist',
    industry: 'Healthcare & Medical',
    seniorityLevel: 'Senior / Specialist',
    yearsOfExperience: 8,
    location: 'Parkville, VIC',
    suburb: 'Parkville',
    workRights: 'Australian Citizen (Unrestricted Full Working Rights)',
    citizenship: 'Australian Citizen',
    clearance: 'AHPRA Registered (Division 1) · WWCC · National Police Check',
    targetSalary: '$100,000 - $125,000 + Super + Salary Packaging',
    targetTitles: [
      'Registered Nurse',
      'Clinical Nurse Specialist',
      'Associate Nurse Unit Manager',
      'Emergency Triage Nurse',
      'Clinical Care Coordinator',
    ],
    coreSkills: [
      'AHPRA',
      'Registered Nurse',
      'Acute Care',
      'Surgical Nursing',
      'Emergency Triage',
      'Medication Administration',
      'Infection Control',
      'Clinical Governance',
    ],
    certifications: [
      'AHPRA Registered Nurse (Division 1) — Registration #NMW0009876543',
      'Working with Children Check (Victoria — Employee)',
      'National Police Check (Clear)',
      'Advanced Life Support (ALS Level 2) Certification',
    ],
    credentials: [
      'AHPRA Registered Nurse',
      'WWCC Employee Check',
      'Australian Citizen',
    ],
    summary:
      'AHPRA Registered Nurse (Division 1) with 8+ years across acute care, emergency triage, and ward leadership in major Melbourne hospitals.',
  };

  it('Step 1 & 2: parses location and builds targeted healthcare search queries', () => {
    const loc = extractLocationForQuery(nurseCandidateProfile);
    expect(loc).toBe('Parkville, VIC');

    const queries = buildQueriesFromProfile(nurseCandidateProfile);
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.length).toBeLessThanOrEqual(12);

    const terms = queries.map((q) => q.term.toLowerCase());
    expect(terms).toContain('registered nurse');
    expect(terms).toContain('clinical nurse specialist');
    expect(terms).toContain('associate nurse unit manager');

    // All primary queries should target candidate's location
    const rnQuery = queries.find((q) => q.term.toLowerCase() === 'registered nurse');
    expect(rnQuery).toBeDefined();
    expect(rnQuery.location).toBe('Parkville, VIC');
    expect(rnQuery.weight).toBe(1.5);
  });

  it('Step 3: scores clinical nursing jobs high while demoting non-clinical jobs', () => {
    const rmhJob = MULTI_INDUSTRY_JOBS.find((j) => j.id === 'health_01');
    expect(rmhJob).toBeDefined();
    expect(rmhJob.company).toBe('The Royal Melbourne Hospital');

    const epworthJob = MULTI_INDUSTRY_JOBS.find((j) => j.id === 'health_02');
    expect(epworthJob).toBeDefined();

    const financeJob = MULTI_INDUSTRY_JOBS.find((j) => j.id === 'fin_01');
    expect(financeJob).toBeDefined();

    // Score clinical nursing positions
    const matchRMH = calculateCandidateJobMatch(rmhJob, nurseCandidateProfile);
    const matchEpworth = calculateCandidateJobMatch(epworthJob, nurseCandidateProfile);
    const matchFinance = calculateCandidateJobMatch(financeJob, nurseCandidateProfile);

    // RMH Emergency/Acute role is located in Parkville (same suburb as nurse) -> Proximity + Title + Skills match
    expect(matchRMH.score).toBeGreaterThanOrEqual(80);
    expect(matchRMH.matchTier).toMatch(/Top Fit|High Fit/);
    expect(matchRMH.distanceKm).toBeLessThanOrEqual(5);

    // Epworth ANUM role is in Richmond -> High clinical match
    expect(matchEpworth.score).toBeGreaterThanOrEqual(70);

    // Finance Analyst job should score drastically lower
    expect(matchFinance.score).toBeLessThan(55);
    expect(matchRMH.score).toBeGreaterThan(matchFinance.score + 25);
  });

  it('Step 4: validates SEEK Pass pre-qualification with 100% verified status and zero knockout risk', () => {
    const clinicalJob = {
      id: 'seek_rn_449012',
      title: 'Registered Nurse (Grade 2 / CNS) — Emergency Department',
      company: 'Royal Melbourne Hospital',
      description:
        'Must hold current AHPRA registration as a Registered Nurse (Division 1). Current Working with Children Check (WWCC) and National Police Check required prior to commencement. Australian Citizen or Permanent Resident with unrestricted work rights only.',
    };

    const auditResult = auditSeekPassLocally(clinicalJob, nurseCandidateProfile);

    expect(auditResult.readiness_score).toBe(100);
    expect(auditResult.risk_level).toBe('PASS_READY');
    expect(auditResult.audited_requirements.length).toBeGreaterThanOrEqual(3);

    // Verify individual credential validations
    const ahpraReq = auditResult.audited_requirements.find((r) => r.domain === 'healthcare_ahpra');
    expect(ahpraReq).toBeDefined();
    expect(ahpraReq.status).toBe('VERIFIED');
    expect(ahpraReq.mandatory).toBe(true);

    const rtwReq = auditResult.audited_requirements.find((r) => r.domain === 'right_to_work');
    expect(rtwReq).toBeDefined();
    expect(rtwReq.status).toBe('VERIFIED');

    const wwccReq = auditResult.audited_requirements.find((r) => r.domain === 'working_with_children');
    expect(wwccReq).toBeDefined();
    expect(wwccReq.status).toBe('VERIFIED');
  });

  it('Step 5: accurately solves common statutory nursing pre-employment screening questionnaires', () => {
    const q1 = clientSolveScreeningQuestion(
      'Do you hold current, unrestricted AHPRA registration as a Registered Nurse?',
      nurseCandidateProfile
    );
    expect(q1.risk_level).toBe('Critical Dealbreaker');
    expect(q1.suggested_dropdown).toBe('Yes — Unrestricted');
    expect(q1.answer).toContain('AHPRA');

    const q2 = clientSolveScreeningQuestion(
      'Do you have a current Working With Children Check (WWCC)?',
      nurseCandidateProfile
    );
    expect(q2.risk_level).toBe('Critical Dealbreaker');
    expect(q2.suggested_dropdown).toBe('Yes — Current & Valid');
    expect(q2.answer).toContain('Working With Children Check');

    const q3 = clientSolveScreeningQuestion(
      'Do you have unrestricted rights to work in Australia without employer sponsorship?',
      nurseCandidateProfile
    );
    expect(q3.risk_level).toBe('Critical Dealbreaker');
    expect(q3.answer).toMatch(/Australian Citizen|Full Working Rights/i);

    const q4 = clientSolveScreeningQuestion(
      'Do you consent to providing a National Police Certificate?',
      nurseCandidateProfile
    );
    expect(q4.risk_level).toBe('Critical Dealbreaker');
    expect(q4.answer).toContain('National Police Check');

    const q5 = clientSolveScreeningQuestion(
      'Are you able to commute to Parkville, VIC for shift rotations?',
      nurseCandidateProfile
    );
    expect(q5.risk_level).toBe('Medium Sensitivity');
    expect(q5.answer).toContain('Parkville, VIC');
  });
});
