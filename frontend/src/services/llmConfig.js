/**
 * llmConfig.js
 * Centralized LLM Provider, Model, and API Key management system.
 * Supports OpenRouter, OpenAI, Google Gemini, Anthropic, DeepSeek, Groq, Ollama, and Custom OpenAI-compatible endpoints.
 */

export const PROVIDERS = {
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    badge: 'Multi-Model Gateway',
    description: 'Unified gateway providing access to Claude 3.7, GPT-4o, Gemini 2.5, DeepSeek, and 200+ models with one key.',
    defaultEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
    keyPlaceholder: 'sk-or-v1-...',
    keyUrl: 'https://openrouter.ai/keys',
    defaultModel: 'z-ai/glm-5.3-flash',
    requiresKey: true,
    isOpenAiCompatible: true,
    models: [
      { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet (⭐ Elite Executive Writer)', description: 'Nuanced ATS keyword tailoring and high-impact accomplishment bullets' },
      { id: 'openai/gpt-4o', name: 'OpenAI GPT-4o (High-Precision ATS)', description: 'Top-tier structural precision, metric extraction, and formatting' },
      { id: 'google/gemini-2.5-pro', name: 'Google Gemini 2.5 Pro (Deep Technical)', description: 'Deep technical reasoning and thorough skill alignment' },
      { id: 'google/gemini-2.0-flash-001', name: 'Google Gemini 2.0 Flash (Fast & Sharp)', description: 'Ultra-fast token synthesis with robust structured markdown' },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 Chat (High Performance)', description: 'Exceptional ATS keyword mapping and dense achievement bullets' },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 (Advanced Reasoning)', description: 'Rigorous chain-of-thought analysis for complex job descriptions' },
      { id: 'z-ai/glm-5.3-flash', name: 'GLM 5.3 Flash (Ultra-Fast Flash Tier)', description: 'Rapid, lightweight document synthesis' }
    ]
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    badge: 'Official API',
    description: 'Direct official OpenAI API integration for GPT-4o, o3-mini, and o1.',
    defaultEndpoint: 'https://api.openai.com/v1/chat/completions',
    keyPlaceholder: 'sk-proj-...',
    keyUrl: 'https://platform.openai.com/api-keys',
    defaultModel: 'gpt-4o',
    requiresKey: true,
    isOpenAiCompatible: true,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o (Omnimodel Flagship)', description: 'High-speed intelligence and flawless document formatting' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Cost-Effective)', description: 'Ultra-fast and cost-effective for high volume applications' },
      { id: 'o3-mini', name: 'o3-mini (High Reasoning Efficiency)', description: 'Deep logical synthesis and analytical reasoning' },
      { id: 'o1', name: 'o1 (Complex Problem Solving)', description: 'Maximum depth reasoning for senior architectural roles' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'High capability legacy production model' }
    ]
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    badge: 'Google AI Studio',
    description: 'Google AI Studio models via high-throughput OpenAI-compatible endpoint.',
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    keyPlaceholder: 'AIzaSy...',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    defaultModel: 'gemini-2.0-flash',
    requiresKey: true,
    isOpenAiCompatible: true,
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Thinking & Multimodal)', description: 'Highest capability Google model with deep reasoning' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Next-Gen Speed)', description: 'Rapid structured generation and precise requirement mapping' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Deep Context)', description: 'Deep document comprehension and nuance' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Lightweight)', description: 'Fast, responsive synthesis' }
    ]
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    badge: 'Direct Claude API',
    description: 'Direct Claude API integration with industry-leading executive prose.',
    defaultEndpoint: 'https://api.anthropic.com/v1/messages',
    keyPlaceholder: 'sk-ant-api03-...',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-3-7-sonnet-20250219',
    requiresKey: true,
    isOpenAiCompatible: false,
    models: [
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet (⭐ Elite Executive Voice)', description: 'Exceptional executive voice and strategic ATS tailoring' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet v2 (Superlative Analysis)', description: 'Precise formatting and executive tone' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Ultra-Fast)', description: 'Rapid analysis and high speed' }
    ]
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    badge: 'Direct Official',
    description: 'Direct DeepSeek API for high-performance cost-effective reasoning.',
    defaultEndpoint: 'https://api.deepseek.com/v1/chat/completions',
    keyPlaceholder: 'sk-...',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    defaultModel: 'deepseek-chat',
    requiresKey: true,
    isOpenAiCompatible: true,
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek-V3 Chat (General Flagship)', description: 'Fast, highly capable ATS keyword optimization' },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1 Reasoner', description: 'Deep reasoning and strategic candidate positioning' }
    ]
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    badge: 'LPU Ultra-Speed',
    description: 'Sub-second inference powered by Groq LPU hardware.',
    defaultEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
    keyPlaceholder: 'gsk_...',
    keyUrl: 'https://console.groq.com/keys',
    defaultModel: 'llama-3.3-70b-versatile',
    requiresKey: true,
    isOpenAiCompatible: true,
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', description: 'Exceptional open-weights model on ultra-fast LPU' },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill Llama 70B', description: 'Fast reasoning distilled into Llama 70B' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (32k Context)', description: 'High throughput MoE architecture' }
    ]
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama / Local LLM',
    badge: 'Private & Sovereign',
    description: 'Run completely private, local models on your own workstation. No API key required.',
    defaultEndpoint: 'http://localhost:11434/v1/chat/completions',
    keyPlaceholder: 'Optional (e.g. ollama)',
    keyUrl: 'https://ollama.com/',
    defaultModel: 'llama3.1',
    requiresKey: false,
    isOpenAiCompatible: true,
    models: [
      { id: 'llama3.1', name: 'Llama 3.1 (Local Standard)', description: 'General intelligence & balanced speed' },
      { id: 'mistral', name: 'Mistral (Local Fast)', description: 'Fast instruction-following' },
      { id: 'qwen2.5', name: 'Qwen 2.5 (High Accuracy)', description: 'Strong technical reasoning and coding precision' },
      { id: 'deepseek-r1', name: 'DeepSeek R1 (Local Reasoner)', description: 'Local chain-of-thought reasoning' }
    ]
  },
  custom: {
    id: 'custom',
    name: 'Custom OpenAI-Compatible',
    badge: 'Self-Hosted / Proxy',
    description: 'Connect to any self-hosted proxy, vLLM, LiteLLM, or custom enterprise gateway.',
    defaultEndpoint: 'http://localhost:8000/v1/chat/completions',
    keyPlaceholder: 'Bearer token or API key',
    keyUrl: '',
    defaultModel: 'custom-model',
    requiresKey: false,
    isOpenAiCompatible: true,
    models: [
      { id: 'custom-model', name: 'Custom Specified Model', description: 'Configured by model ID input' }
    ]
  }
};

const STORAGE_KEYS = {
  PROVIDER: 'llm_active_provider',
  MODEL: 'llm_active_model',
  CUSTOM_MODEL: 'llm_custom_model',
  CUSTOM_ENDPOINT: 'llm_custom_endpoint',
  KEY_PREFIX: 'llm_key_',
  LEGACY_OR_KEY: 'openrouter_api_key',
  LEGACY_OR_MODEL: 'openrouter_model'
};

// In-memory key cache for safety
const inMemoryKeys = {};

/**
 * Retrieve the active LLM configuration
 */
export const getLlmConfig = () => {
  if (typeof window === 'undefined') {
    return {
      provider: 'openrouter',
      model: PROVIDERS.openrouter.defaultModel,
      apiKey: '',
      endpoint: PROVIDERS.openrouter.defaultEndpoint,
      customModel: '',
      providerMeta: PROVIDERS.openrouter
    };
  }

  const provider = localStorage.getItem(STORAGE_KEYS.PROVIDER) || 'openrouter';
  const providerMeta = PROVIDERS[provider] || PROVIDERS.openrouter;

  // Retrieve API Key: check inMemory -> provider-specific localStorage -> legacy openrouter key
  let apiKey = inMemoryKeys[provider] || localStorage.getItem(`${STORAGE_KEYS.KEY_PREFIX}${provider}`) || '';
  if (!apiKey && provider === 'openrouter') {
    apiKey = localStorage.getItem(STORAGE_KEYS.LEGACY_OR_KEY) || '';
  }

  // Retrieve Model: check localStorage -> legacy openrouter model -> provider default
  let model = localStorage.getItem(STORAGE_KEYS.MODEL);
  if (!model && provider === 'openrouter') {
    model = localStorage.getItem(STORAGE_KEYS.LEGACY_OR_MODEL);
  }
  if (!model) {
    model = providerMeta.defaultModel;
  }

  // Retrieve Endpoint: custom endpoint if defined, else default provider endpoint
  const customEndpoint = localStorage.getItem(`${STORAGE_KEYS.CUSTOM_ENDPOINT}_${provider}`);
  const endpoint = customEndpoint || providerMeta.defaultEndpoint;

  const customModel = localStorage.getItem(`${STORAGE_KEYS.CUSTOM_MODEL}_${provider}`) || '';

  return {
    provider,
    model,
    apiKey,
    endpoint,
    customModel,
    providerMeta
  };
};

/**
 * Save LLM configuration
 */
export const saveLlmConfig = ({ provider, model, apiKey, endpoint, customModel }) => {
  if (typeof window === 'undefined') return;

  const activeProvider = provider || 'openrouter';
  const providerMeta = PROVIDERS[activeProvider] || PROVIDERS.openrouter;

  localStorage.setItem(STORAGE_KEYS.PROVIDER, activeProvider);

  if (model) {
    localStorage.setItem(STORAGE_KEYS.MODEL, model.trim());
    if (activeProvider === 'openrouter') {
      localStorage.setItem(STORAGE_KEYS.LEGACY_OR_MODEL, model.trim());
    }
  }

  if (customModel !== undefined) {
    if (customModel.trim()) {
      localStorage.setItem(`${STORAGE_KEYS.CUSTOM_MODEL}_${activeProvider}`, customModel.trim());
    } else {
      localStorage.removeItem(`${STORAGE_KEYS.CUSTOM_MODEL}_${activeProvider}`);
    }
  }

  if (apiKey !== undefined) {
    const cleanKey = apiKey.trim();
    inMemoryKeys[activeProvider] = cleanKey;
    if (cleanKey) {
      localStorage.setItem(`${STORAGE_KEYS.KEY_PREFIX}${activeProvider}`, cleanKey);
      if (activeProvider === 'openrouter') {
        localStorage.setItem(STORAGE_KEYS.LEGACY_OR_KEY, cleanKey);
      }
    } else {
      localStorage.removeItem(`${STORAGE_KEYS.KEY_PREFIX}${activeProvider}`);
      if (activeProvider === 'openrouter') {
        localStorage.removeItem(STORAGE_KEYS.LEGACY_OR_KEY);
      }
    }
  }

  if (endpoint !== undefined) {
    const cleanEndpoint = endpoint.trim();
    if (cleanEndpoint && cleanEndpoint !== providerMeta.defaultEndpoint) {
      localStorage.setItem(`${STORAGE_KEYS.CUSTOM_ENDPOINT}_${activeProvider}`, cleanEndpoint);
    } else {
      localStorage.removeItem(`${STORAGE_KEYS.CUSTOM_ENDPOINT}_${activeProvider}`);
    }
  }

  // Dispatch custom window event for instant multi-component reactivity
  window.dispatchEvent(new CustomEvent('llm-config-updated', {
    detail: {
      provider: activeProvider,
      model,
      endpoint: endpoint || providerMeta.defaultEndpoint
    }
  }));
};

/**
 * Get active API Key for current provider
 */
export const getActiveApiKey = () => {
  const config = getLlmConfig();
  return config.apiKey;
};

/**
 * Backward compatibility setter for API key
 */
export const setActiveApiKey = (key, persist = true) => {
  const config = getLlmConfig();
  saveLlmConfig({
    ...config,
    apiKey: key,
    provider: config.provider || 'openrouter'
  });
};

/**
 * Get active model
 */
export const getActiveModel = () => {
  const config = getLlmConfig();
  return config.model;
};

/**
 * Backward compatibility setter for Model
 */
export const setActiveModel = (model) => {
  const config = getLlmConfig();
  saveLlmConfig({
    ...config,
    model: model
  });
};

/**
 * Test LLM Connection with a minimal 1-token prompt
 */
export const testLlmConnection = async ({ provider, model, apiKey, endpoint }) => {
  const activeProvider = provider || 'openrouter';
  const providerMeta = PROVIDERS[activeProvider] || PROVIDERS.openrouter;
  const targetEndpoint = endpoint || providerMeta.defaultEndpoint;
  const targetModel = model || providerMeta.defaultModel;
  const cleanKey = (apiKey || '').trim();

  if (providerMeta.requiresKey && !cleanKey) {
    throw new Error(`API key is required for ${providerMeta.name}.`);
  }

  const startTime = Date.now();

  try {
    if (activeProvider === 'anthropic') {
      // Direct Anthropic Messages API
      const res = await fetch(targetEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cleanKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: targetModel,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Reply with "OK"' }]
        })
      });

      if (!res.ok) {
        let errMessage = `HTTP ${res.status}`;
        try {
          const errData = await res.json();
          if (errData?.error?.message) errMessage = errData.error.message;
        } catch {}
        throw new Error(errMessage);
      }

      const data = await res.json();
      const latency = Date.now() - startTime;
      return {
        success: true,
        latencyMs: latency,
        model: targetModel,
        message: `Connection successful (${latency}ms)! Model replied: "${data?.content?.[0]?.text?.trim() || 'OK'}"`
      };
    }

    // Standard OpenAI-Compatible Endpoint (OpenRouter, OpenAI, Gemini, DeepSeek, Groq, Ollama, Custom)
    const headers = {
      'Content-Type': 'application/json'
    };

    if (cleanKey) {
      headers['Authorization'] = `Bearer ${cleanKey}`;
    }

    if (activeProvider === 'openrouter') {
      headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'https://job-dashboard.app';
      headers['X-Title'] = 'Job Dashboard Application Studio';
    }

    const res = await fetch(targetEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: targetModel,
        messages: [{ role: 'user', content: 'Reply with "OK"' }],
        max_tokens: 10,
        temperature: 0.1
      })
    });

    if (!res.ok) {
      let errMessage = `HTTP ${res.status}`;
      try {
        const errData = await res.json();
        if (errData?.error?.message) errMessage = errData.error.message;
      } catch {}
      throw new Error(errMessage);
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || 'OK';
    const latency = Date.now() - startTime;

    return {
      success: true,
      latencyMs: latency,
      model: targetModel,
      message: `Connection successful (${latency}ms)! Model replied: "${reply}"`
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Failed to connect to LLM provider.'
    };
  }
};
