import { describe, it, expect } from 'vitest';
import { 
  calculateAtoTax, 
  evaluateOfferCompensation, 
  generateCounterOfferProposal, 
  auditContractClauses,
  detectSeniorityTier,
  detectSector,
  STATUTORY_SUPER_RATE
} from '../offerService';

describe('Offer Service & Compensation Benchmarking', () => {
  describe('calculateAtoTax (ATO Stage 3 + 2% Medicare Levy)', () => {
    it('returns zero tax for nil income', () => {
      const tax = calculateAtoTax(0);
      expect(tax.incomeTax).toBe(0);
      expect(tax.medicareLevy).toBe(0);
      expect(tax.totalTax).toBe(0);
      expect(tax.netAnnual).toBe(0);
      expect(tax.effectiveTaxRate).toBe(0);
    });

    it('calculates Stage 3 tax for $40,000 income (16% bracket)', () => {
      const tax = calculateAtoTax(40000);
      // (40,000 - 18,200) * 0.16 = 3,488
      expect(tax.incomeTax).toBe(3488);
      // 40,000 * 0.02 = 800
      expect(tax.medicareLevy).toBe(800);
      expect(tax.totalTax).toBe(4288);
      expect(tax.netAnnual).toBe(35712);
      expect(tax.netMonthly).toBe(2976);
    });

    it('calculates Stage 3 tax for $100,000 income (30% bracket)', () => {
      const tax = calculateAtoTax(100000);
      // 4,288 + (100,000 - 45,000) * 0.30 = 4,288 + 16,500 = 20,788
      expect(tax.incomeTax).toBe(20788);
      // 100,000 * 0.02 = 2,000
      expect(tax.medicareLevy).toBe(2000);
      expect(tax.totalTax).toBe(22788);
      expect(tax.netAnnual).toBe(77212);
    });

    it('calculates Stage 3 tax for $150,000 income (37% bracket)', () => {
      const tax = calculateAtoTax(150000);
      // 31,288 + (150,000 - 135,000) * 0.37 = 31,288 + 5,550 = 36,838
      expect(tax.incomeTax).toBe(36838);
      // 150,000 * 0.02 = 3,000
      expect(tax.medicareLevy).toBe(3000);
      expect(tax.totalTax).toBe(39838);
      expect(tax.netAnnual).toBe(110162);
    });

    it('calculates Stage 3 tax for $200,000 income (45% bracket)', () => {
      const tax = calculateAtoTax(200000);
      // 51,638 + (200,000 - 190,000) * 0.45 = 51,638 + 4,500 = 56,138
      expect(tax.incomeTax).toBe(56138);
      // 200,000 * 0.02 = 4,000
      expect(tax.medicareLevy).toBe(4000);
      expect(tax.totalTax).toBe(60138);
      expect(tax.netAnnual).toBe(139862);
    });
  });

  describe('evaluateOfferCompensation', () => {
    it('accurately computes TRP and base when exclusive of super', () => {
      const res = evaluateOfferCompensation({
        salary: 150000,
        superInclusive: false,
        sector: 'tech',
        seniority: 'senior'
      });

      expect(res.baseSalary).toBe(150000);
      expect(res.superannuation).toBe(150000 * STATUTORY_SUPER_RATE);
      expect(res.totalRemuneration).toBe(167250);
      expect(res.marketMedian).toBe(180000);
      expect(res.percentile).toBeGreaterThan(0);
      expect(res.percentile).toBeLessThan(100);
      expect(res.assessmentBand).toBeDefined();
    });

    it('accurately unpacks base when inclusive of super', () => {
      const res = evaluateOfferCompensation({
        salary: 167250,
        superInclusive: true,
        sector: 'tech',
        seniority: 'senior'
      });

      expect(Math.round(res.baseSalary)).toBe(150000);
      expect(Math.round(res.totalRemuneration)).toBe(167250);
    });

    it('handles trades and healthcare tracks with industry medians', () => {
      const nurseEval = evaluateOfferCompensation({
        salary: 110000,
        superInclusive: false,
        sector: 'healthcare',
        seniority: 'senior'
      });
      expect(nurseEval.sector).toBe('healthcare');
      expect(nurseEval.marketMedian).toBe(140000);
      expect(nurseEval.assessmentBand).toBe('Bottom Quartile (Under Market)');

      const tradesEval = evaluateOfferCompensation({
        salary: 140000,
        superInclusive: false,
        sector: 'trades',
        seniority: 'lead'
      });
      expect(tradesEval.sector).toBe('trades');
      expect(tradesEval.marketMedian).toBe(195000);
    });
  });

  describe('generateCounterOfferProposal', () => {
    const job = {
      title: 'Senior Cloud Engineer',
      company: 'Canva',
      location: 'Sydney NSW'
    };

    it('generates assertive posture counter-offer with high-conviction metrics', () => {
      const proposal = generateCounterOfferProposal({
        job,
        offeredSalary: 160000,
        targetSalary: 180000,
        posture: 'assertive',
        candidateName: 'Alex Mercer'
      });

      expect(proposal.posture).toBe('assertive');
      expect(proposal.subject).toContain('Canva');
      expect(proposal.body).toContain('$180,000');
      expect(proposal.body).toContain('Alex Mercer');
      expect(proposal.body).toContain('market compensation analysis');
      expect(proposal.keyLevers.length).toBeGreaterThanOrEqual(3);
    });

    it('generates collaborative posture counter-offer with partnership framing', () => {
      const proposal = generateCounterOfferProposal({
        job,
        offeredSalary: 150000,
        targetSalary: 165000,
        posture: 'collaborative',
        candidateName: 'Jordan Smith'
      });

      expect(proposal.posture).toBe('collaborative');
      expect(proposal.body).toContain('collaborative solution');
      expect(proposal.body).toContain('$165,000');
    });

    it('generates benefits-focused posture counter-offer emphasizing flexibility and L&D', () => {
      const proposal = generateCounterOfferProposal({
        job,
        offeredSalary: 140000,
        targetSalary: 150000,
        posture: 'benefits_focused',
        candidateName: 'Taylor Reed'
      });

      expect(proposal.posture).toBe('benefits_focused');
      expect(proposal.body).toContain('holistic package');
      expect(proposal.body).toContain('professional development');
    });
  });

  describe('auditContractClauses', () => {
    it('flags restraint of trade, overtime, IP assignment, and notice disparity', async () => {
      const contractText = `
        1. Non-compete: Employee shall not work for any competitor within 50 km for a period of 12 months.
        2. Hours: Base salary is all-inclusive and in full satisfaction of all hours worked including reasonable additional overtime.
        3. Intellectual Property: Any invention created at any time during or outside work belongs to the employer.
        4. Termination: Employee must give 8 weeks notice, company may give 1 week notice.
      `;

      const audit = await auditContractClauses(contractText);
      expect(audit.totalRisksFound).toBeGreaterThanOrEqual(4);
      expect(audit.criticalRisksCount).toBeGreaterThanOrEqual(1);

      const restraintRisk = audit.findings.find(f => f.category === 'Restraint of Trade / Non-Compete');
      expect(restraintRisk).toBeDefined();
      expect(restraintRisk.fairWorkGuidance).toContain('Fair Work');

      const overtimeRisk = audit.findings.find(f => f.category === 'All-Inclusive Salary & Unpaid Overtime');
      expect(overtimeRisk).toBeDefined();

      const ipRisk = audit.findings.find(f => f.category === 'Blanket IP Assignment');
      expect(ipRisk).toBeDefined();

      const noticeRisk = audit.findings.find(f => f.category === 'Notice Period Asymmetry');
      expect(noticeRisk).toBeDefined();
    });

    it('returns low risk score for compliant contracts', async () => {
      const cleanContract = `
        1. The employee is engaged on standard full-time hours (38 hours/week) under the Fair Work Act 2009.
        2. Intellectual property directly produced in the course of employment shall belong to the company.
        3. Both parties provide 4 weeks reciprocal written notice upon termination.
      `;

      const audit = await auditContractClauses(cleanContract);
      expect(audit.criticalRisksCount).toBe(0);
      expect(audit.overallRiskScore).toBeLessThan(40);
    });
  });

  describe('detectSeniorityTier and detectSector', () => {
    it('detects seniority correctly', () => {
      expect(detectSeniorityTier('Junior React Developer')).toBe('junior');
      expect(detectSeniorityTier('Mid-Level Analyst')).toBe('mid');
      expect(detectSeniorityTier('Senior Systems Engineer')).toBe('senior');
      expect(detectSeniorityTier('Engineering Lead / Director')).toBe('lead');
      expect(detectSeniorityTier('Software Engineer')).toBe('mid');
    });

    it('detects sector tracks accurately', () => {
      expect(detectSector('Registered Nurse ICU')).toBe('healthcare');
      expect(detectSector('Commercial Electrician Tier 1')).toBe('trades');
      expect(detectSector('Senior Financial Accountant CPA')).toBe('finance');
      expect(detectSector('Legal Counsel / Commercial Solicitor')).toBe('legal');
      expect(detectSector('Staff Platform Architect')).toBe('tech');
    });
  });
});
