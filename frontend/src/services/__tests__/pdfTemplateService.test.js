import { describe, it, expect, vi } from 'vitest';
import {
  formatAtsResume,
  computeAtsReadinessScore,
  ATS_TEMPLATES
} from '../pdfTemplateService';

describe('pdfTemplateService', () => {
  const mockProfile = {
    name: 'Alex Mercer',
    email: 'alex.mercer@example.com.au',
    phone: '+61 412 345 678',
    location: 'Sydney, Australia',
    title: 'Lead Distributed Systems Architect',
    summary: 'Senior systems engineer with 12+ years optimizing high-throughput distributed databases and cloud platforms.',
    skills: ['Go', 'Python', 'Kubernetes', 'AWS', 'PostgreSQL', 'Terraform'],
    experience: [
      {
        role: 'Staff Infrastructure Engineer',
        company: 'CloudScale Technologies',
        dates: '2023 - Present',
        bullets: [
          'Architected multi-region Kubernetes platform reducing failover latency by 85%.',
          'Spearheaded database partitioning initiative saving $340,000 annually in AWS compute costs.'
        ]
      }
    ],
    education: 'Bachelor of Computer Science, University of New South Wales',
    clearances: 'Baseline Security Clearance (Current)'
  };

  describe('formatAtsResume', () => {
    it('compiles standard Modern Executive layout', () => {
      const doc = formatAtsResume({
        profile: mockProfile,
        templateId: ATS_TEMPLATES.MODERN_EXECUTIVE
      });

      expect(doc.name).toBe('Alex Mercer');
      expect(doc.contactLine).toContain('alex.mercer@example.com.au');
      expect(doc.contactLine).toContain('Sydney, Australia');
      expect(doc.sections).toHaveLength(5); // Summary, Skills, Experience, Education, Clearances
      expect(doc.plainText).toContain('Architected multi-region Kubernetes platform');
    });

    it('compiles Technical Specialist layout highlighting skill domains', () => {
      const doc = formatAtsResume({
        profile: mockProfile,
        templateId: ATS_TEMPLATES.TECHNICAL_SPECIALIST
      });

      expect(doc.plainText).toContain('TECHNICAL CAPABILITY MATRIX');
      expect(doc.plainText).toContain('Kubernetes');
      expect(doc.plainText).toContain('Staff Infrastructure Engineer');
    });

    it('compiles Australian Public Service (APS) Criterion-focused layout', () => {
      const doc = formatAtsResume({
        profile: mockProfile,
        templateId: ATS_TEMPLATES.APS_PUBLIC_SECTOR
      });

      expect(doc.plainText).toContain('AUSTRALIAN PUBLIC SERVICE');
      expect(doc.plainText).toContain('Baseline Security Clearance');
    });
  });

  describe('computeAtsReadinessScore', () => {
    it('scores high for complete profile with quantified metrics and action verbs', () => {
      const doc = formatAtsResume({ profile: mockProfile });
      const analysis = computeAtsReadinessScore(doc.plainText);

      expect(analysis.score).toBeGreaterThanOrEqual(85);
      expect(analysis.breakdown.actionVerbs).toBeGreaterThan(0);
      expect(analysis.breakdown.metrics).toBeGreaterThan(0);
      expect(analysis.breakdown.standardHeaders).toBe(true);
      expect(analysis.breakdown.contactComplete).toBe(true);
    });

    it('identifies missing metrics and provides actionable suggestions', () => {
      const poorText = 'I am a worker who worked on computers and helped the team.';
      const analysis = computeAtsReadinessScore(poorText);

      expect(analysis.score).toBeLessThan(50);
      expect(analysis.suggestions.length).toBeGreaterThan(0);
      expect(analysis.suggestions.some(s => s.toLowerCase().includes('metric') || s.toLowerCase().includes('verb'))).toBe(true);
    });
  });
});

