import { describe, it, expect, beforeEach } from 'vitest';
import { generateInterviewGuide } from '../generationService';
import { generateFollowUpEmail } from '../trackerService';
import { SECTOR_TEMPLATES } from '../profileService';

describe('Multi-Industry Interview Guide & Outreach Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('generateInterviewGuide', () => {
    it('generates clinical healthcare interview guide for nursing role', async () => {
      const nurseJob = {
        title: 'Registered Nurse - Acute Care',
        company: 'St Vincent Hospital',
        description: 'Seeking an AHPRA registered nurse for our acute medical ward. Needs clinical triage and medication administration experience.',
        notes: ''
      };

      const guide = await generateInterviewGuide(nurseJob);
      expect(guide.sector).toBe('healthcare');
      expect(guide.questions.length).toBe(4);
      expect(guide.questions[0].type).toContain('Clinical Acuity');
      expect(guide.questions[0].answerStrategy).toContain('ISBAR');
      expect(guide.questions[1].answerStrategy).toContain('NSQHS');
      expect(guide.talkingPoints.some(tp => tp.includes('AHPRA') || tp.includes('clinical'))).toBe(true);
      expect(guide.recommendedQuestionsToAsk.some(rq => rq.includes('nurse-to-patient'))).toBe(true);
    });

    it('generates statutory finance interview guide for accountant role', async () => {
      const financeJob = {
        title: 'Senior Financial Accountant',
        company: 'PwC Australia',
        description: 'Lead month-end financial close, balance sheet reconciliations, and AASB statutory reporting across business units.',
        notes: ''
      };

      const guide = await generateInterviewGuide(financeJob);
      expect(guide.sector).toBe('finance');
      expect(guide.questions.length).toBe(4);
      expect(guide.questions[0].question).toContain('AASB');
      expect(guide.questions[1].question).toContain('budget-to-actual');
      expect(guide.talkingPoints.some(tp => tp.includes('CPA') || tp.includes('AASB'))).toBe(true);
      expect(guide.recommendedQuestionsToAsk.some(rq => rq.includes('financial systems'))).toBe(true);
    });

    it('generates WHS construction interview guide for site supervisor role', async () => {
      const siteJob = {
        title: 'Commercial Site Supervisor',
        company: 'Multiplex',
        description: 'Oversee commercial site trades, SWMS compliance, SafeWork WHS audits, and subcontractor defect rectifications.',
        notes: ''
      };

      const guide = await generateInterviewGuide(siteJob);
      expect(guide.sector).toBe('trades');
      expect(guide.questions.length).toBe(4);
      expect(guide.questions[0].question).toContain('SWMS');
      expect(guide.questions[1].question).toContain('weather');
      expect(guide.talkingPoints.some(tp => tp.includes('White Card') || tp.includes('SafeWork'))).toBe(true);
      expect(guide.recommendedQuestionsToAsk.some(rq => rq.includes('Procore'))).toBe(true);
    });

    it('generates contract indemnity interview guide for legal counsel role', async () => {
      const legalJob = {
        title: 'Corporate Legal Counsel',
        company: 'Macquarie Group',
        description: 'Review commercial agreements, draft indemnities, and advise business leaders on Australian Consumer Law compliance.',
        notes: ''
      };

      const guide = await generateInterviewGuide(legalJob);
      expect(guide.sector).toBe('legal');
      expect(guide.questions.length).toBe(4);
      expect(guide.questions[0].question).toContain('indemnity');
      expect(guide.questions[1].question).toContain('Australian Consumer Law');
      expect(guide.talkingPoints.some(tp => tp.includes('Practising Certificate'))).toBe(true);
      expect(guide.recommendedQuestionsToAsk.some(rq => rq.includes('legal ops'))).toBe(true);
    });
  });

  describe('generateFollowUpEmail', () => {
    it('generates dynamic application follow-up for Sarah Jenkins RN', () => {
      const nurseJob = {
        title: 'Clinical Nurse Specialist',
        company: 'Epworth Healthcare',
        contactEmail: 'talent@epworth.org.au'
      };

      const email = generateFollowUpEmail(nurseJob, {
        profile: SECTOR_TEMPLATES.healthcare,
        type: 'followup'
      });

      expect(email.subject).toBe('Application Follow-up: Clinical Nurse Specialist — Sarah Jenkins');
      expect(email.body).toContain('Sarah Jenkins');
      expect(email.body).toContain('Registered Nurse / Clinical Care Coordinator');
      expect(email.body).toContain('AHPRA-registered nursing standards');
      expect(email.body).not.toContain('Sam Ludwig');
      expect(email.body).not.toContain('Azure/M365');
      expect(email.mailtoUrl).toContain('mailto:talent@epworth.org.au');
    });

    it('generates proactive recruiter cold pitch for Marcus Wong CPA', () => {
      const financeJob = {
        title: 'Finance Manager',
        company: 'BHP',
        contactEmail: 'careers@bhp.com'
      };

      const email = generateFollowUpEmail(financeJob, {
        profile: SECTOR_TEMPLATES.finance,
        type: 'recruiter_pitch'
      });

      expect(email.subject).toBe('Introduction: Marcus Wong for Finance Manager — BHP');
      expect(email.body).toContain('Marcus Wong');
      expect(email.body).toContain('Senior Financial Accountant');
      expect(email.body).toContain('statutory financial reporting (AASB/IFRS)');
      expect(email.body).toContain('Would you be open to a brief 10-minute introductory discussion');
      expect(email.body).not.toContain('Sam Ludwig');
    });

    it('generates post-interview thank you note for David Miller', () => {
      const tradeJob = {
        title: 'Senior Site Manager',
        company: 'Lendlease',
        contactEmail: 'recruitment@lendlease.com'
      };

      const email = generateFollowUpEmail(tradeJob, {
        profile: SECTOR_TEMPLATES.trades,
        type: 'thank_you'
      });

      expect(email.subject).toBe('Thank You: Interview Discussion for Senior Site Manager — David Miller');
      expect(email.body).toContain('David Miller');
      expect(email.body).toContain('zero-harm safety standards');
      expect(email.body).toContain('insightful discussion today');
      expect(email.body).not.toContain('Sam Ludwig');
    });
  });
});
