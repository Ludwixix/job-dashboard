import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SCORING_WEIGHTS,
  recalculateJobScores,
  normalizeWeights
} from '../scoringTuningService';

describe('scoringTuningService', () => {
  const mockJobs = [
    {
      id: 'job-1',
      title: 'Principal Distributed Systems Engineer',
      company: 'Canva',
      score: 90,
      score_breakdown: {
        semantic_density: 95,
        title_alignment: 90,
        recency: 70,
        star_impact: 85,
        clearances: 100
      }
    },
    {
      id: 'job-2',
      title: 'Senior Systems Engineer',
      company: 'Atlassian',
      score: 85,
      score_breakdown: {
        semantic_density: 70,
        title_alignment: 80,
        recency: 100,
        star_impact: 95,
        clearances: 80
      }
    }
  ];

  describe('normalizeWeights', () => {
    it('normalizes arbitrary weight sums to 1.0', () => {
      const custom = {
        semantic_density: 80,
        title_alignment: 20,
        recency: 0,
        star_impact: 0,
        clearances: 0
      };
      const normalized = normalizeWeights(custom);
      expect(normalized.semantic_density).toBeCloseTo(0.8);
      expect(normalized.title_alignment).toBeCloseTo(0.2);
      expect(normalized.recency).toBe(0);
    });

    it('falls back to default weights when all inputs are zero', () => {
      const allZero = {
        semantic_density: 0,
        title_alignment: 0,
        recency: 0,
        star_impact: 0,
        clearances: 0
      };
      const normalized = normalizeWeights(allZero);
      expect(normalized.semantic_density).toBe(DEFAULT_SCORING_WEIGHTS.semantic_density);
    });
  });

  describe('recalculateJobScores', () => {
    it('recalculates match scores based on heavy semantic weighting', () => {
      // 100% semantic weighting
      const weights = {
        semantic_density: 100,
        title_alignment: 0,
        recency: 0,
        star_impact: 0,
        clearances: 0
      };

      const results = recalculateJobScores(mockJobs, weights);
      expect(results[0].id).toBe('job-1');
      expect(results[0].score).toBe(95);
      expect(results[1].score).toBe(70);
    });

    it('re-ranks jobs when recency is prioritized over semantic match', () => {
      // 100% recency weighting
      const weights = {
        semantic_density: 0,
        title_alignment: 0,
        recency: 100,
        star_impact: 0,
        clearances: 0
      };

      const results = recalculateJobScores(mockJobs, weights);
      // job-2 has recency 100, job-1 has recency 70
      expect(results[0].id).toBe('job-2');
      expect(results[0].score).toBe(100);
      expect(results[1].id).toBe('job-1');
      expect(results[1].score).toBe(70);
    });

    it('recalculateJobScoresAsync produces identical ranked output asynchronously', async () => {
      const { recalculateJobScoresAsync } = await import('../scoringTuningService');
      const weights = {
        semantic_density: 100,
        title_alignment: 0,
        recency: 0,
        star_impact: 0,
        clearances: 0
      };

      const results = await recalculateJobScoresAsync(mockJobs, weights);
      expect(results[0].id).toBe('job-1');
      expect(results[0].score).toBe(95);
    });
  });
});

