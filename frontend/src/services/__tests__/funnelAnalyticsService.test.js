import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchFunnelAnalytics,
  computeClientFunnelAnalytics,
  AU_SECTOR_BENCHMARKS,
  formatConversionPct,
  formatDays,
  getHealthBadgeClass,
  getStageColor,
} from '../funnelAnalyticsService';

describe('funnelAnalyticsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('computeClientFunnelAnalytics', () => {
    it('handles empty jobs gracefully with default structure', () => {
      const result = computeClientFunnelAnalytics([], 'technology');
      expect(result.total_jobs).toBe(0);
      expect(result.active_pipeline_count).toBe(0);
      expect(result.stages.sourced.count).toBe(0);
      expect(result.stages.applied.count).toBe(0);
      expect(result.conversion_rates.apply_to_interview_pct).toBe(0);
      expect(result.stalled_applications).toEqual([]);
      expect(result.benchmark.sector).toBe('technology');
    });

    it('calculates stage counts and conversion percentages accurately', () => {
      const mockJobs = [
        { id: '1', title: 'Job 1', status: 'new' },
        { id: '2', title: 'Job 2', status: 'saved' },
        { id: '3', title: 'Job 3', status: 'applied', applied_date: '2026-09-01T00:00:00Z' },
        { id: '4', title: 'Job 4', status: 'applied', applied_date: '2026-09-02T00:00:00Z' },
        { id: '5', title: 'Job 5', status: 'interviewing', applied_date: '2026-08-20T00:00:00Z', interview_date: '2026-08-28T00:00:00Z' },
        { id: '6', title: 'Job 6', status: 'offer', applied_date: '2026-08-10T00:00:00Z', interview_date: '2026-08-18T00:00:00Z', offer_date: '2026-08-26T00:00:00Z' },
        { id: '7', title: 'Job 7', status: 'accepted', applied_date: '2026-08-01T00:00:00Z' },
      ];

      const result = computeClientFunnelAnalytics(mockJobs, 'technology');
      expect(result.total_jobs).toBe(7);
      // Sourced = 7
      expect(result.stages.sourced.count).toBe(7);
      // Shortlisted = 6 (saved + applied + interviewing + offer + accepted)
      expect(result.stages.shortlisted.count).toBe(6);
      // Applied = 5 (applied + interviewing + offer + accepted)
      expect(result.stages.applied.count).toBe(5);
      // Interviewing = 3 (interviewing + offer + accepted)
      expect(result.stages.interviewing.count).toBe(3);
      // Offer = 2 (offer + accepted)
      expect(result.stages.offer.count).toBe(2);
      // Accepted = 1
      expect(result.stages.accepted.count).toBe(1);

      // Conversion rates
      expect(result.conversion_rates.apply_to_interview_pct).toBe(60.0); // 3 / 5 = 60%
      expect(result.conversion_rates.interview_to_offer_pct).toBe(66.7); // 2 / 3 = 66.7%
      expect(result.conversion_rates.offer_to_accepted_pct).toBe(50.0); // 1 / 2 = 50%
    });

    it('identifies stalled applications when threshold days are exceeded', () => {
      const now = new Date('2026-09-20T00:00:00Z');
      const mockJobs = [
        {
          id: 'stalled-app',
          title: 'Stalled Lead',
          company: 'Acme',
          status: 'applied',
          applied_date: '2026-08-30T00:00:00Z', // 21 days ago (threshold 14)
        },
        {
          id: 'fresh-app',
          title: 'Fresh Apply',
          company: 'Fast Inc',
          status: 'applied',
          applied_date: '2026-09-18T00:00:00Z', // 2 days ago
        },
      ];

      const result = computeClientFunnelAnalytics(mockJobs, 'technology', now);
      expect(result.stalled_applications.length).toBe(1);
      expect(result.stalled_applications[0].id).toBe('stalled-app');
      expect(result.stalled_applications[0].days_in_stage).toBe(21);
      expect(result.stalled_applications[0].severity).toBe('warning');
    });

    it('computes 30-day forecast estimates', () => {
      const mockJobs = [
        { id: '1', status: 'applied' },
        { id: '2', status: 'applied' },
        { id: '3', status: 'applied' },
        { id: '4', status: 'applied' },
        { id: '5', status: 'interviewing' },
      ];

      const result = computeClientFunnelAnalytics(mockJobs, 'technology');
      expect(result.forecast_30d.active_applied_count).toBe(4);
      expect(result.forecast_30d.active_interview_count).toBe(1);
      expect(result.forecast_30d.estimated_interviews).toBeGreaterThan(0);
    });
  });

  describe('fetchFunnelAnalytics', () => {
    it('returns server analytics when backend call succeeds', async () => {
      const serverPayload = {
        success: true,
        analytics: {
          total_jobs: 10,
          health_score: 85,
          health_label: 'Thriving',
          health_badge: 'emerald',
          stages: { sourced: { count: 10 } },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => serverPayload,
      });

      const res = await fetchFunnelAnalytics([{ id: '1' }], 'technology');
      expect(res.total_jobs).toBe(10);
      expect(res.health_score).toBe(85);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('gracefully falls back to client-side computation on server error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      const jobs = [{ id: 'fallback-1', status: 'applied', applied_date: '2026-09-01T00:00:00Z' }];
      const res = await fetchFunnelAnalytics(jobs, 'technology');

      expect(res.total_jobs).toBe(1);
      expect(res.stages.applied.count).toBe(1);
      expect(res.sector).toBe('technology');
    });
  });

  describe('formatting and helper utilities', () => {
    it('formats conversion percentage correctly', () => {
      expect(formatConversionPct(14.56)).toBe('14.6%');
      expect(formatConversionPct(null)).toBe('0.0%');
      expect(formatConversionPct(0)).toBe('0.0%');
    });

    it('formats days duration with readable units', () => {
      expect(formatDays(7.2)).toBe('7d');
      expect(formatDays(null)).toBe('—');
      expect(formatDays(1)).toBe('1d');
    });

    it('returns appropriate badge classes for health states', () => {
      expect(getHealthBadgeClass('emerald')).toContain('emerald');
      expect(getHealthBadgeClass('rose')).toContain('rose');
      expect(getHealthBadgeClass('unknown')).toContain('slate');
    });

    it('maps stages to color accents', () => {
      expect(getStageColor('sourced')).toContain('blue');
      expect(getStageColor('interviewing')).toContain('purple');
      expect(getStageColor('offer')).toContain('emerald');
    });
  });
});

