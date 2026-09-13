import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchAtsDiagnosticReport,
  calculateClientAtsDiagnostic,
  formatAtsScoreBadge,
} from '../atsDiagnosticService';

const MOCK_RESUME = `
Jane Doe
jane.doe@example.com | 0400 123 456

PROFESSIONAL SUMMARY
Senior Cloud Engineer with 8+ years managing AWS and Kubernetes environments with 99.99% uptime.

SKILLS
AWS, Kubernetes, Terraform, Python, Docker

WORK EXPERIENCE
Senior Cloud Systems Engineer | TechCorp Australia | 2021 - Present
- Architected multi-region AWS transit gateway reducing latency by 38%.
- Automated Kubernetes cluster provisioning, reducing deployment times from 4 hours to 18 minutes.
- Led migration of 14 core microservices to Amazon EKS maintaining 99.99% availability.

EDUCATION
Bachelor of Computer Science | University of Melbourne

REFEREES
David Smith | Principal Architect | david.smith@example.com
`;

describe('atsDiagnosticService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calculateClientAtsDiagnostic generates full report structure', () => {
    const report = calculateClientAtsDiagnostic(MOCK_RESUME, { title: 'Cloud Engineer', company: 'Canva' });
    expect(report.ats_score).toBeGreaterThanOrEqual(70);
    expect(report.ats_compliance).toBeDefined();
    expect(report.star_density).toBeDefined();
    expect(report.regional_au).toBeDefined();
    expect(report.topological_flattening).toBeDefined();
    expect(report.star_density.quantified_bullets).toBeGreaterThanOrEqual(3);
    expect(report.regional_au.has_referees).toBe(true);
  });

  it('formatAtsScoreBadge returns correct visual token classes', () => {
    expect(formatAtsScoreBadge(90).color).toContain('emerald');
    expect(formatAtsScoreBadge(70).color).toContain('cyan');
    expect(formatAtsScoreBadge(55).color).toContain('amber');
    expect(formatAtsScoreBadge(30).color).toContain('rose');
  });

  it('fetchAtsDiagnosticReport falls back to client diagnostic on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));
    const report = await fetchAtsDiagnosticReport({ resumeText: MOCK_RESUME, job: { title: 'DevOps' } });
    expect(report).toBeDefined();
    expect(report.ats_score).toBeGreaterThan(0);
    expect(report.topological_flattening.candidate_name).toBe('Jane Doe');
  });

  it('fetchAtsDiagnosticReport uses API response when available', async () => {
    const mockApiResponse = {
      success: true,
      diagnostic: {
        ats_score: 95,
        ats_compliance: { overall_score: 95 },
        star_density: { density_percentage: 85 },
        regional_au: { compliant: true },
        topological_flattening: { candidate_name: 'Jane Doe' },
        actionable_recommendations: [],
        target_job: { title: 'Cloud Engineer' },
      },
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });

    const report = await fetchAtsDiagnosticReport({ resumeText: MOCK_RESUME, job: { title: 'Cloud Engineer' } });
    expect(report.ats_score).toBe(95);
    expect(global.fetch).toHaveBeenCalled();
  });
});
