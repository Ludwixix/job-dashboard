import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchCareerRoadmap,
  computeClientCareerRoadmap,
  SECTOR_CAREER_TRACKS,
  SENIORITY_LEVELS,
  formatAudSalary,
  formatGrowthPct,
} from '../careerMatrixService';

describe('careerMatrixService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('computeClientCareerRoadmap', () => {
    it('generates a safe default roadmap for empty profile', () => {
      const roadmap = computeClientCareerRoadmap({}, 'senior_lead', 'technology');
      expect(roadmap).toBeDefined();
      expect(roadmap.sector).toBe('technology');
      expect(roadmap.target_level).toBe('senior_lead');
      expect(roadmap.target_title).toContain('Senior');
      expect(roadmap.milestones_12m.length).toBe(3);
      expect(roadmap.salary_projection.projected_lift_aud).toBeGreaterThan(0);
    });

    it('identifies skill gaps when profile misses target skills', () => {
      const profile = {
        title: 'Junior Developer',
        skills: ['HTML', 'CSS', 'JavaScript'],
        yearsOfExperience: 1,
      };

      const roadmap = computeClientCareerRoadmap(profile, 'senior_lead', 'technology');
      expect(roadmap.skill_gaps.length).toBeGreaterThan(0);
      const gapNames = roadmap.skill_gaps.map(g => g.skill);
      expect(gapNames.some(s => s.includes('Kubernetes') || s.includes('Cloud'))).toBe(true);
    });

    it('recommends Australian industry certifications', () => {
      const profile = {
        title: 'Senior Systems Engineer',
        industry: 'technology',
        skills: ['Linux', 'Python'],
      };

      const roadmap = computeClientCareerRoadmap(profile, 'staff_principal', 'technology');
      expect(roadmap.certifications.length).toBeGreaterThan(0);
      const certNames = roadmap.certifications.map(c => c.name);
      expect(certNames.some(c => c.includes('AWS') || c.includes('CISM') || c.includes('Kubernetes'))).toBe(true);
    });

    it('models cross-sector adjacent career pivots', () => {
      const profile = { title: 'Electrician', industry: 'trades' };
      const roadmap = computeClientCareerRoadmap(profile, 'senior_lead', 'trades');
      expect(roadmap.adjacent_pivots.length).toBeGreaterThan(0);
      expect(roadmap.adjacent_pivots[0].overlap_pct).toBeGreaterThanOrEqual(70);
    });
  });

  describe('fetchCareerRoadmap', () => {
    it('returns server response on successful API call', async () => {
      const mockServerRoadmap = {
        success: true,
        roadmap: {
          sector: 'technology',
          target_title: 'Staff Architect',
          milestones_12m: [],
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockServerRoadmap,
      });

      const res = await fetchCareerRoadmap({ title: 'DevOps' }, 'staff_principal', 'technology');
      expect(res.target_title).toBe('Staff Architect');
      expect(global.fetch).toHaveBeenCalled();
    });

    it('falls back to client calculation if API call fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const profile = { title: 'Registered Nurse', industry: 'healthcare' };
      const res = await fetchCareerRoadmap(profile, 'senior_lead', 'healthcare');
      expect(res.sector).toBe('healthcare');
      expect(res.target_title).toContain('Nurse');
    });
  });

  describe('formatting utilities', () => {
    it('formats AUD salary values clearly', () => {
      expect(formatAudSalary(165000)).toBe('$165k');
      expect(formatAudSalary(null)).toBe('—');
    });

    it('formats salary growth percentages', () => {
      expect(formatGrowthPct(25.4)).toBe('+25.4%');
      expect(formatGrowthPct(null)).toBe('—');
    });
  });
});
