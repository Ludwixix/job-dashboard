import { describe, it, expect } from 'vitest';
import {
  detectEnterpriseScale,
  detectSector,
  generateExecutiveDossier,
  exportDossierToMarkdown
} from '../dossierService';

describe('dossierService', () => {
  describe('detectEnterpriseScale', () => {
    it('identifies ASX 200 and multinational corporations', () => {
      expect(detectEnterpriseScale('Commonwealth Bank', 'ASX enterprise financial banking')).toBe('asx_enterprise');
      expect(detectEnterpriseScale('Telstra', 'National telecommunications provider')).toBe('asx_enterprise');
      expect(detectEnterpriseScale('BHP Group', 'Global resources miner')).toBe('asx_enterprise');
    });

    it('identifies Public Sector and Government departments', () => {
      expect(detectEnterpriseScale('Alfred Health', 'Public health service hospital')).toBe('public_sector');
      expect(detectEnterpriseScale('Department of Transport', 'VPS Victorian public sector')).toBe('public_sector');
      expect(detectEnterpriseScale('City of Melbourne', 'Local municipal council')).toBe('public_sector');
    });

    it('identifies High-Growth scaleups and startups', () => {
      expect(detectEnterpriseScale('HyperScale Labs', 'Series B fast-paced venture-backed startup')).toBe('growth_startup');
      expect(detectEnterpriseScale('SeedApp', 'Early stage incubator pre-seed')).toBe('growth_startup');
    });

    it('defaults to mid_market for established private companies', () => {
      expect(detectEnterpriseScale('Apex Commercial Partners', 'Private commercial advisory firm')).toBe('mid_market');
    });
  });

  describe('detectSector', () => {
    it('correctly maps all 5 industry tracks', () => {
      expect(detectSector('Clinical Care Coordinator', 'AHPRA registered nurse inpatient')).toBe('healthcare');
      expect(detectSector('Senior Financial Accountant', 'CPA AASB statutory reporting')).toBe('finance');
      expect(detectSector('Commercial Construction Site Supervisor', 'White card SafeWork WHS subcontractor')).toBe('trades');
      expect(detectSector('Corporate Legal Counsel', 'Practising certificate commercial law')).toBe('legal');
      expect(detectSector('Cloud DevOps Engineer', 'AWS Kubernetes infrastructure')).toBe('technology');
    });
  });

  describe('generateExecutiveDossier', () => {
    it('generates a full strategic intelligence dossier for technology', () => {
      const job = {
        id: 'job_tech_01',
        title: 'Lead Cloud Infrastructure Engineer',
        company: 'Atlassian',
        description: 'Lead AWS and Kubernetes cloud platform, ASD Essential 8 compliance, and deployment velocity.',
        location: 'Sydney, NSW'
      };
      const profile = {
        name: 'Alex Mercer',
        title: 'Senior Cloud Architect',
        coreSkills: ['AWS', 'Kubernetes', 'Terraform', 'CI/CD']
      };

      const dossier = generateExecutiveDossier(job, profile);

      expect(dossier.company_name).toBe('Atlassian');
      expect(dossier.target_role).toBe('Lead Cloud Infrastructure Engineer');
      expect(dossier.sector).toBe('technology');
      expect(dossier.enterprise_scale).toBe('asx_enterprise');

      // Org profile
      expect(dossier.organization_profile.compliance_frameworks.length).toBeGreaterThanOrEqual(3);
      expect(dossier.organization_profile.competitors.length).toBeGreaterThanOrEqual(3);

      // Pain points
      expect(dossier.strategic_pain_points.why_role_was_funded).toBeTruthy();
      expect(dossier.strategic_pain_points.core_challenges.length).toBeGreaterThanOrEqual(3);

      // 90 day plan
      expect(dossier.first_90_days.days_1_30.key_actions.length).toBeGreaterThanOrEqual(3);
      expect(dossier.first_90_days.days_31_60.deliverables.length).toBeGreaterThanOrEqual(2);
      expect(dossier.first_90_days.days_61_90.success_metrics.length).toBeGreaterThanOrEqual(2);

      // Reverse questions & diligence
      expect(dossier.reverse_interview_questions.length).toBeGreaterThanOrEqual(4);
      expect(dossier.risk_and_cultural_audit.diligence_flags.length).toBeGreaterThanOrEqual(3);
    });

    it('generates healthcare-grounded compliance and leadership frameworks', () => {
      const job = {
        title: 'Registered Nurse / Ward Coordinator',
        company: 'Alfred Health',
        description: 'Inpatient surgical ward, NSQHS accreditation, AHPRA registration, and clinical handover management.'
      };

      const dossier = generateExecutiveDossier(job);
      expect(dossier.sector).toBe('healthcare');
      expect(dossier.enterprise_scale).toBe('public_sector');
      expect(dossier.organization_profile.compliance_frameworks).toEqual(
        expect.arrayContaining([expect.stringMatching(/AHPRA|NSQHS/i)])
      );
      expect(dossier.first_90_days.days_1_30.focus).toMatch(/patient|clinical|audit/i);
    });

    it('generates finance-grounded reporting milestones and ERP deliverables', () => {
      const job = {
        title: 'Senior Financial Controller',
        company: 'Macquarie Group',
        description: 'Manage month-end close, AASB / IFRS compliance, APRA reporting, and ledger reconciliation.'
      };

      const dossier = generateExecutiveDossier(job);
      expect(dossier.sector).toBe('finance');
      expect(dossier.organization_profile.compliance_frameworks).toEqual(
        expect.arrayContaining([expect.stringMatching(/AASB|IFRS|APRA|ATO/i)])
      );
      const p2Actions = dossier.first_90_days.days_31_60.key_actions.join(' ').toLowerCase();
      expect(p2Actions).toMatch(/month-end|reconciliation|ledger|close/i);
    });
  });

  describe('exportDossierToMarkdown', () => {
    it('produces formatted markdown briefing report', () => {
      const job = {
        title: 'Senior Project Manager',
        company: 'Multiplex',
        description: 'Tier 1 commercial construction, SafeWork WHS compliance, and subcontractor coordination.'
      };
      const dossier = generateExecutiveDossier(job);
      const md = exportDossierToMarkdown(dossier);

      expect(md).toContain('# Executive Briefing Dossier: Multiplex');
      expect(md).toContain('Senior Project Manager');
      expect(md).toContain('Days 1–30: Listen, Audit & Align');
      expect(md).toContain('Days 31–60: Optimize & Deliver Quick Wins');
      expect(md).toContain('Days 61–90: Scale, Institutionalize & Measure ROI');
      expect(md).toContain('Executive Reverse Interview Questions');
      expect(md).toContain('Due Diligence & Risk Signals');
    });
  });
});
