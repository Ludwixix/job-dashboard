import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  getLlmConfig, 
  saveLlmConfig, 
  getActiveApiKey, 
  getActiveModel, 
  testLlmConnection,
  fetchOpenRouterModels,
  getOpenRouterModels,
  normalizeOpenRouterModel,
  PROVIDERS 
} from '../llmConfig';

describe('llmConfig service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('provides openrouter defaults when storage is empty', () => {
    const config = getLlmConfig();
    expect(config.provider).toBe('openrouter');
    expect(config.model).toBe('z-ai/glm-5.3-flash');
    expect(config.apiKey).toBe('');
    expect(config.endpoint).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('supports saving and retrieving provider-specific configurations', () => {
    saveLlmConfig({
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'test-openai-key'
    });

    const config = getLlmConfig();
    expect(config.provider).toBe('openai');
    expect(config.model).toBe('gpt-4o');
    expect(config.apiKey).toBe('test-openai-key');
    expect(config.endpoint).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('maintains backwards compatibility with openrouter_api_key in localStorage', () => {
    localStorage.setItem('openrouter_api_key', 'legacy-key-123');
    localStorage.setItem('openrouter_model', 'openai/gpt-4o');

    const config = getLlmConfig();
    expect(config.provider).toBe('openrouter');
    expect(config.apiKey).toBe('legacy-key-123');
    expect(config.model).toBe('openai/gpt-4o');
    expect(getActiveApiKey()).toBe('legacy-key-123');
    expect(getActiveModel()).toBe('openai/gpt-4o');
  });

  it('isolates keys when switching between providers', () => {
    saveLlmConfig({
      provider: 'openrouter',
      model: 'z-ai/glm-5.3-flash',
      apiKey: 'or-key-abc'
    });

    saveLlmConfig({
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      apiKey: 'gemini-key-xyz'
    });

    let config = getLlmConfig();
    expect(config.provider).toBe('gemini');
    expect(config.apiKey).toBe('gemini-key-xyz');

    // Switch back to openrouter
    saveLlmConfig({ provider: 'openrouter' });
    config = getLlmConfig();
    expect(config.provider).toBe('openrouter');
    expect(config.apiKey).toBe('or-key-abc');
  });

  it('tests connection successfully when provider returns 200 OK', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'OK' } }]
      })
    });

    const result = await testLlmConnection({
      provider: 'openrouter',
      model: 'z-ai/glm-5.3-flash',
      apiKey: 'test-key'
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Connection successful');
  });

  it('handles connection error when fetch fails or returns error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API Key' } })
    });

    const result = await testLlmConnection({
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'invalid-key'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid API Key');
  });

  describe('OpenRouter dynamic models catalog', () => {
    it('normalizes model items and detects free tier', () => {
      const freeModel = normalizeOpenRouterModel({
        id: 'meta-llama/llama-3.3-70b-instruct:free',
        name: 'Meta Llama 3.3 70B (free)',
        pricing: { prompt: '0', completion: '0' },
        context_length: 131072,
      });

      expect(freeModel.isFree).toBe(true);
      expect(freeModel.context_length).toBe(131072);

      const paidModel = normalizeOpenRouterModel({
        id: 'anthropic/claude-3.7-sonnet',
        name: 'Claude 3.7 Sonnet',
        pricing: { prompt: '0.000003', completion: '0.000015' },
        context_length: 200000,
      });

      expect(paidModel.isFree).toBe(false);
      expect(paidModel.pricing.prompt).toBe('0.000003');
    });

    it('returns default presets synchronously when cache is empty', () => {
      const models = getOpenRouterModels();
      expect(models.length).toBeGreaterThanOrEqual(10);
      expect(models.some(m => m.id === 'z-ai/glm-5.3-flash')).toBe(true);
    });

    it('fetches live models from OpenRouter endpoint and caches in localStorage', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'custom/model-abc',
              name: 'Custom ABC',
              context_length: 64000,
              pricing: { prompt: '0.000001', completion: '0.000002' },
            },
            {
              id: 'custom/free-model:free',
              name: 'Free Model',
              context_length: 32000,
              pricing: { prompt: '0', completion: '0' },
            },
          ],
        }),
      });

      const models = await fetchOpenRouterModels({ force: true });
      expect(models).toHaveLength(2);
      expect(models[0].id).toBe('custom/model-abc');
      expect(models[1].isFree).toBe(true);

      // Verify cached in localStorage
      const cached = JSON.parse(localStorage.getItem('openrouter_cached_models'));
      expect(cached).toHaveLength(2);
      expect(cached[0].id).toBe('custom/model-abc');
    });

    it('falls back gracefully to cache or presets if fetch fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      const models = await fetchOpenRouterModels({ force: true });
      expect(models).toBeDefined();
      expect(models.length).toBeGreaterThan(0);
    });
  });
});
