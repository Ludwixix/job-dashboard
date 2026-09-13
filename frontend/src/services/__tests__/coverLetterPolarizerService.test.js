import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  clientAuditCoverLetter,
  clientGeneratePolarizedVariants,
  auditCoverLetter,
  fetchJobCoverLetterAudit,
  CLICHE_OPENERS,
  CORPORATE_FLUFF_MAP,
} from '../coverLetterPolarizerService';

describe('coverLetterPolarizerService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('flags canned AI openers in clientAuditCoverLetter', () => {
    const text = 'I am writing to apply for the Senior Cloud role at Canva.\n\nI have scaled systems.\n\nThanks.';
    const audit = clientAuditCoverLetter(text, 'Canva', 'Senior Cloud');
    expect(audit.opener_check.has_cliche_opener).toBe(true);
    expect(audit.opener_check.detected_opener).toBe('I am writing to apply');
    expect(audit.opener_check.suggestion).toContain('Canva');
  });

  it('rewards company mentions and specific domain tokens', () => {
    const text = 'Scaling Canva distributed Kubernetes clusters across AWS is a massive operational feat.\n\nAt NextGen, I reduced p99 latency by 50% using Terraform and Kafka.\n\nLet us connect this week.';
    const audit = clientAuditCoverLetter(text, 'Canva', 'Platform Engineer', 'Kubernetes AWS Terraform Kafka');
    expect(audit.company_mention_count).toBeGreaterThan(0);
    expect(audit.swappability_score).toBeLessThanOrEqual(40);
    expect(audit.swappability_level).toBe('Low Risk (Highly Specific)');
    expect(audit.opener_check.has_cliche_opener).toBe(false);
  });

  it('identifies corporate fluff and provides actionable fixes', () => {
    const text = 'I am a passionate results-driven professional who brings synergy and thinks outside the box.\n\nI hit the ground running.\n\nLet us talk.';
    const audit = clientAuditCoverLetter(text, 'Atlassian', 'Engineer');
    expect(audit.cliches_found.length).toBeGreaterThanOrEqual(3);
    const phrases = audit.cliches_found.map(c => c.phrase);
    expect(phrases).toContain('results-driven');
    expect(phrases).toContain('synergy');
    expect(audit.cliches_found[0].fix.length).toBeGreaterThan(0);
  });

  it('validates 3-paragraph structural blueprint', () => {
    const twoParas = 'Hook paragraph about Canva.\n\nProof narrative with metrics.';
    const auditTwo = clientAuditCoverLetter(twoParas, 'Canva');
    expect(auditTwo.paragraph_analysis.length).toBe(2);
    expect(auditTwo.recommendations.some(r => r.includes('Expected 3 paragraphs'))).toBe(true);

    const threeParas = 'Acme Corp is reinventing edge compute.\n\nI led our distributed team at ScaleCorp, cutting memory footprint by 40%.\n\nLet us schedule 15 minutes to talk.';
    const auditThree = clientAuditCoverLetter(threeParas, 'Acme Corp');
    expect(auditThree.paragraph_analysis.length).toBe(3);
    expect(auditThree.paragraph_analysis[0].role).toBe('The Hook (Company Trajectory & Context)');
    expect(auditThree.paragraph_analysis[1].role).toBe('The Proof Narrative (Quantified Impact)');
    expect(auditThree.paragraph_analysis[2].role).toBe('The Low-Friction Close (Confident Call to Action)');
  });

  it('generates 3 polarized variants with full paragraph structure', () => {
    const variants = clientGeneratePolarizedVariants(
      { company: 'Atlassian', title: 'Principal SRE' },
      { skills: ['Kubernetes', 'Go', 'Prometheus'] }
    );
    expect(variants.length).toBe(3);
    const ids = variants.map(v => v.id);
    expect(ids).toContain('high_conviction');
    expect(ids).toContain('systems_architect');
    expect(ids).toContain('cultural_outlier');

    variants.forEach(v => {
      expect(v.paragraphs.length).toBe(3);
      expect(v.full_text).toContain('Atlassian');
      expect(v.hook_explanation.length).toBeGreaterThan(0);
    });
  });

  it('falls back to client audit on network failure in auditCoverLetter', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));
    const audit = await auditCoverLetter('I am writing to apply for Atlassian.', 'Atlassian', 'Developer');
    expect(audit).toBeDefined();
    expect(audit.opener_check.has_cliche_opener).toBe(true);
  });

  it('falls back to client audit on network failure in fetchJobCoverLetterAudit', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const result = await fetchJobCoverLetterAudit('job-123', {
      company: 'Canva',
      title: 'Cloud Lead',
      coverLetterText: 'Canva is awesome.\n\nI built clouds.\n\nCall me.',
    });
    expect(result.success).toBe(true);
    expect(result.company).toBe('Canva');
    expect(result.variants.length).toBe(3);
  });
});

