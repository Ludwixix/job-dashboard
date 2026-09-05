import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  getLlmConfig, 
  saveLlmConfig, 
  getActiveApiKey, 
  getActiveModel, 
  testLlmConnection,
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
});
