import { describe, it, expect, beforeEach } from 'vitest';
import {
  getModelPricing,
  registerDynamicModelPricing,
  estimateActionCost,
  estimateTokenCount,
  recordLlmUsage,
  getSpendMetrics,
  resetSpendMetrics,
  DYNAMIC_PRICING,
} from '../llmCostService';

describe('llmCostService', () => {
  beforeEach(() => {
    localStorage.clear();
    resetSpendMetrics();
    // Clear dynamic pricing keys for clean tests
    Object.keys(DYNAMIC_PRICING).forEach((k) => delete DYNAMIC_PRICING[k]);
  });

  describe('estimateTokenCount', () => {
    it('estimates ~4 characters per token', () => {
      expect(estimateTokenCount('')).toBe(0);
      expect(estimateTokenCount('test')).toBe(1);
      expect(estimateTokenCount('a'.repeat(400))).toBe(100);
    });
  });

  describe('getModelPricing & registerDynamicModelPricing', () => {
    it('recognizes predefined static models and free models', () => {
      const freeModel = getModelPricing('meta-llama/llama-3.3-70b-instruct:free');
      expect(freeModel.isFree).toBe(true);
      expect(freeModel.input).toBe(0.0);

      const claude = getModelPricing('anthropic/claude-3.7-sonnet');
      expect(claude.input).toBe(3.0);
      expect(claude.output).toBe(15.0);
    });

    it('dynamically registers models fetched from OpenRouter catalog', () => {
      registerDynamicModelPricing([
        {
          id: 'mistralai/mistral-large-2411',
          pricing: { prompt: '0.000002', completion: '0.000006' },
        },
        {
          id: 'community/free-model:free',
          pricing: { prompt: '0', completion: '0' },
        },
      ]);

      const mistral = getModelPricing('mistralai/mistral-large-2411');
      expect(mistral.input).toBe(2.0);
      expect(mistral.output).toBe(6.0);
      expect(mistral.isFree).toBe(false);

      const free = getModelPricing('community/free-model:free');
      expect(free.isFree).toBe(true);
      expect(free.input).toBe(0.0);
    });
  });

  describe('estimateActionCost', () => {
    it('estimates zero cost for free tier models', () => {
      const estimate = estimateActionCost('meta-llama/llama-3.3-70b-instruct:free', 'Sample prompt', 1000);
      expect(estimate.isFree).toBe(true);
      expect(estimate.estimatedCostUsd).toBe(0.0);
      expect(estimate.formattedCost).toContain('Free Tier');
    });

    it('estimates cost accurately for paid models', () => {
      // 400 chars = 100 prompt tokens. 1000 output tokens.
      const prompt = 'a'.repeat(400);
      const estimate = estimateActionCost('anthropic/claude-3.7-sonnet', prompt, 1000);
      expect(estimate.isFree).toBe(false);
      expect(estimate.promptTokens).toBe(100);
      expect(estimate.expectedOutputTokens).toBe(1000);
      expect(estimate.estimatedCostUsd).toBeGreaterThan(0);
    });
  });

  describe('recordLlmUsage & getSpendMetrics', () => {
    it('records token usage and updates cumulative spend ledger', () => {
      recordLlmUsage('anthropic/claude-3.7-sonnet', 500, 1000, 'Test Tool');

      const metrics = getSpendMetrics();
      expect(metrics.totalTokens).toBe(1500);
      expect(metrics.promptTokens).toBe(500);
      expect(metrics.completionTokens).toBe(1000);
      expect(metrics.totalSpendUsd).toBeGreaterThan(0);
      expect(metrics.callCount).toBe(1);
      expect(metrics.recentCalls).toHaveLength(1);
    });

    it('records 0.00 spend for free tier usage', () => {
      recordLlmUsage('meta-llama/llama-3.3-70b-instruct:free', 500, 1000, 'Free Tool');

      const metrics = getSpendMetrics();
      expect(metrics.totalTokens).toBe(1500);
      expect(metrics.totalSpendUsd).toBe(0.0);
      expect(metrics.callCount).toBe(1);
      expect(metrics.recentCalls[0].isFree).toBe(true);
    });
  });
});
