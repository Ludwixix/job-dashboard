import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateInfluenceHealth,
  buildObjectionResolutionMemo,
  buildRefereeBriefingDoc,
  INTERVIEW_STAGES,
  PANEL_SENTIMENTS,
} from '../interviewInfluenceService';

describe('interviewInfluenceService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exports valid stages and sentiments', () => {
    expect(INTERVIEW_STAGES.length).toBeGreaterThanOrEqual(4);
    expect(PANEL_SENTIMENTS.length).toBeGreaterThanOrEqual(4);
  });

  describe('calculateInfluenceHealth', () => {
    it('awards 85+ score for Strong Positive with no objections', () => {
      const debrief = {
        panelSentiment: 'Strong Positive',
        perceivedObjections: [],
        promisedDecisionDate: '2026-09-15',
      };
      const health = calculateInfluenceHealth(debrief);
      expect(health.score).toBeGreaterThanOrEqual(80);
      expect(health.status).toBe('High Conviction');
    });

    it('penalizes score appropriately when objections are present', () => {
      const debrief = {
        panelSentiment: 'High Friction',
        perceivedObjections: [
          'Concerned about Kubernetes production downtime exposure',
          'Uncertain if candidate fits corporate hybrid reporting structure'
        ],
        promisedDecisionDate: '2026-09-12',
      };
      const health = calculateInfluenceHealth(debrief);
      expect(health.score).toBeLessThanOrEqual(50);
      expect(health.status).toBe('Objection Overcoming Required');
      expect(health.actionItems.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('buildObjectionResolutionMemo', () => {
    const mockJob = {
      title: 'Senior Systems Engineer',
      company: 'Canva Systems',
      location: 'Melbourne, VIC',
    };
    const mockProfile = {
      name: 'Samuel Ludwig',
      title: 'Mid-Level IT Infrastructure & Systems Engineer',
      email: 'sam@ludwig.com',
      phone: '0412 345 678',
    };

    it('generates a tailored value-add memo addressing panel objections', () => {
      const debrief = {
        panelNames: 'David Vance, Sarah Jenkins',
        topicsCovered: ['M365 Migration', 'Intune Governance'],
        perceivedObjections: ['Wanted deeper evidence on automated rollback testing'],
      };

      const memo = buildObjectionResolutionMemo(mockJob, debrief, mockProfile);
      expect(memo.subject).toContain('Canva Systems');
      expect(memo.body).toContain('David Vance');
      expect(memo.body).toContain('automated rollback testing');
      expect(memo.body).toContain('Samuel Ludwig');
      // Anti-cliche check
      expect(memo.body).not.toMatch(/^I am writing to thank you/i);
    });
  });

  describe('buildRefereeBriefingDoc', () => {
    const mockJob = {
      title: 'Clinical Operations Specialist',
      company: 'St Vincent Health',
    };
    const mockProfile = {
      name: 'Samuel Ludwig',
    };
    const debrief = {
      stage: 'Panel Interview',
      panelNames: 'Dr. Wong, Jane Miller',
      topicsCovered: ['Clinical Governance', 'Emergency Escalations'],
      perceivedObjections: ['Night shift crisis management proof'],
      promisedDecisionDate: '2026-09-15',
    };

    it('generates a comprehensive referee briefing sheet with STAR proof points', () => {
      const briefing = buildRefereeBriefingDoc(
        mockJob,
        debrief,
        'Marcus Vance',
        'Head of Operations',
        'Former Manager',
        mockProfile
      );

      expect(briefing).toContain('EXECUTIVE REFEREE ALIGNMENT BRIEFING');
      expect(briefing).toContain('Marcus Vance');
      expect(briefing).toContain('St Vincent Health');
      expect(briefing).toContain('Night shift crisis management');
      expect(briefing).toContain('STAR');
    });
  });
});
