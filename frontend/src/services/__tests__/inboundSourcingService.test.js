import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateClientBooleanEvaluation,
  calculateClientLinkedInAudit,
  generateClientHeadlines,
  generateClientRecruiterQueries,
  fetchRecruiterQueries,
  auditLinkedInProfile,
  testBooleanQuery,
  formatInboundScoreBadge,
} from '../inboundSourcingService';

describe('inboundSourcingService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateClientBooleanEvaluation', () => {
    it('evaluates simple AND and OR queries accurately', () => {
      const text = 'Senior Cloud Engineer specializing in Azure and Terraform infrastructure.';
      const res = calculateClientBooleanEvaluation('Azure AND Terraform', text);
      expect(res.is_match).toBe(true);
      expect(res.matched_terms).toContain('Azure');
      expect(res.matched_terms).toContain('Terraform');

      const resFail = calculateClientBooleanEvaluation('Azure AND Kubernetes', text);
      expect(resFail.is_match).toBe(false);
      expect(resFail.missing_terms).toContain('Kubernetes');
    });

    it('evaluates NOT operator and quoted strings', () => {
      const text = 'Junior Cloud Engineer with basic AWS knowledge.';
      const res = calculateClientBooleanEvaluation('"Cloud Engineer" NOT Junior', text);
      expect(res.is_match).toBe(false);

      const seniorText = 'Senior Cloud Engineer with advanced AWS knowledge.';
      const resSenior = calculateClientBooleanEvaluation('"Cloud Engineer" NOT Junior', seniorText);
      expect(resSenior.is_match).toBe(true);
    });

    it('flags curly quotes in queries', () => {
      const res = calculateClientBooleanEvaluation('“Cloud Engineer” AND Azure', 'Cloud Engineer with Azure');
      expect(res.has_curly_quotes_warning).toBe(true);
      expect(res.is_match).toBe(true);
    });
  });

  describe('calculateClientLinkedInAudit', () => {
    it('awards high visibility to structured headline and about section', () => {
      const res = calculateClientLinkedInAudit({
        headline: 'Senior Cloud Engineer | Azure, Terraform, PowerShell | DevSecOps',
        about: 'Experienced Cloud Engineer with Azure, Terraform, and CI/CD skills. Core Competencies: Infrastructure-as-Code. 5,000+ endpoints.',
        targetRole: 'Senior Cloud Engineer',
        coreSkills: ['Azure', 'Terraform', 'PowerShell'],
      });
      expect(res.inbound_visibility_score).toBeGreaterThanOrEqual(75);
      expect(res.strengths.length).toBeGreaterThanOrEqual(2);
    });

    it('flags abstract buzzwords and missing target title', () => {
      const res = calculateClientLinkedInAudit({
        headline: 'Passionate Guru & Rockstar Ninja transforming the digital universe',
        about: 'I am a team player with great synergy.',
        targetRole: 'Cloud Engineer',
        coreSkills: ['Azure', 'Terraform'],
      });
      expect(res.inbound_visibility_score).toBeLessThan(50);
      expect(res.recommendations.some(r => r.includes('buzzwords') || r.includes('literal'))).toBe(true);
    });
  });

  describe('generateClientHeadlines and RecruiterQueries', () => {
    it('generates 3 distinct headlines and 5 recruiter search queries', () => {
      const headlines = generateClientHeadlines('Cloud Architect', ['AWS', 'Kubernetes', 'Terraform', 'Go']);
      expect(headlines).toHaveLength(3);
      expect(headlines[0]).toContain('Cloud Architect');

      const queries = generateClientRecruiterQueries('Cloud Architect', ['AWS', 'Kubernetes', 'Terraform', 'Go']);
      expect(queries).toHaveLength(5);
      expect(queries[0].query).toContain('Cloud Architect');
      expect(queries[3].strategy).toContain('Negative-Filtered');
    });
  });

  describe('network fallback resilience', () => {
    it('falls back to client generation if backend fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      const queries = await fetchRecruiterQueries({ title: 'DevOps Lead', skills: ['Docker', 'K8s'] });
      expect(queries.length).toBeGreaterThanOrEqual(4);

      const auditRes = await auditLinkedInProfile({
        headline: 'DevOps Lead | Kubernetes, Docker',
        about: 'Core Competencies: Kubernetes, Docker. 100+ microservices.',
        targetRole: 'DevOps Lead',
        coreSkills: ['Kubernetes', 'Docker'],
      });
      expect(auditRes.audit.inbound_visibility_score).toBeGreaterThanOrEqual(70);
      expect(auditRes.headlines).toHaveLength(3);

      const testRes = await testBooleanQuery({
        query: 'Kubernetes AND Docker',
        text: 'Kubernetes and Docker engineer',
      });
      expect(testRes.is_match).toBe(true);
    });
  });

  describe('formatInboundScoreBadge', () => {
    it('returns appropriate token classes', () => {
      expect(formatInboundScoreBadge(90).label).toBe('High Visibility');
      expect(formatInboundScoreBadge(70).label).toBe('Moderate Visibility');
      expect(formatInboundScoreBadge(45).label).toBe('Low Search Indexability');
    });
  });
});
