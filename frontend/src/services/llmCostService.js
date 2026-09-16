/**
 * llmCostService.js
 * Real-time Token Tracking, Cost Estimation, and Cumulative Spend Ledger
 * Supports OpenRouter, OpenAI, Anthropic, Gemini, DeepSeek, and Free Models.
 */

// Model Pricing Registry: [Input USD / 1M tokens, Output USD / 1M tokens]
export const MODEL_PRICING = {
  // Free Community & Open-Weights Models ($0.00)
  'meta-llama/llama-3.3-70b-instruct:free': { input: 0.0, output: 0.0, isFree: true },
  'google/gemini-2.0-flash-exp:free': { input: 0.0, output: 0.0, isFree: true },
  'google/gemini-2.0-flash-thinking-exp:free': { input: 0.0, output: 0.0, isFree: true },
  'deepseek/deepseek-r1:free': { input: 0.0, output: 0.0, isFree: true },
  'qwen/qwen-2.5-coder-32b-instruct:free': { input: 0.0, output: 0.0, isFree: true },
  'z-ai/glm-5.3-flash': { input: 0.0, output: 0.0, isFree: true },

  // OpenRouter / Anthropic
  'anthropic/claude-3.7-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-7-sonnet-20250219': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },

  // OpenAI
  'openai/gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'o3-mini': { input: 1.10, output: 4.40 },
  'o1': { input: 15.00, output: 60.00 },

  // Google Gemini
  'google/gemini-2.5-pro': { input: 1.25, output: 5.00 },
  'gemini-2.5-pro': { input: 1.25, output: 5.00 },
  'google/gemini-2.0-flash-001': { input: 0.10, output: 0.40 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },

  // DeepSeek
  'deepseek/deepseek-chat': { input: 0.27, output: 1.10 },
  'deepseek-chat': { input: 0.27, output: 1.10 },
  'deepseek/deepseek-r1': { input: 0.55, output: 2.19 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },

  // Groq / Open weights
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'deepseek-r1-distill-llama-70b': { input: 0.75, output: 0.99 },
  'mixtral-8x7b-32768': { input: 0.24, output: 0.24 },

  // Local / Sovereign
  'ollama': { input: 0.0, output: 0.0, isFree: true },
  'custom-model': { input: 0.0, output: 0.0, isFree: true }
};

const STORAGE_KEY_SPEND = 'job_dashboard_llm_spend_ledger';
const LISTENERS = new Set();

/**
 * Estimate token count using the industry heuristic of ~4 characters per token
 */
export const estimateTokenCount = (text = '') => {
  if (!text || typeof text !== 'string') return 0;
  return Math.max(1, Math.ceil(text.trim().length / 4));
};

/**
 * Look up pricing rates for a given model ID
 */
export const getModelPricing = (model = '') => {
  if (!model) return { input: 0.0, output: 0.0, isFree: true };
  const clean = model.trim().toLowerCase();
  
  if (clean.includes(':free') || clean.includes('ollama') || clean.includes('local')) {
    return { input: 0.0, output: 0.0, isFree: true };
  }

  if (MODEL_PRICING[model]) {
    return MODEL_PRICING[model];
  }

  // Substring match fallback
  for (const [key, rate] of Object.entries(MODEL_PRICING)) {
    if (clean.includes(key.toLowerCase()) || key.toLowerCase().includes(clean)) {
      return rate;
    }
  }

  // Default conservative estimate (similar to GPT-4o-mini / Gemini Flash)
  return { input: 0.20, output: 0.80, isEstimated: true };
};

/**
 * Calculate expected cost for an estimated prompt and expected max tokens
 */
export const estimateActionCost = (model, promptText = '', expectedOutputTokens = 800) => {
  const pricing = getModelPricing(model);
  if (pricing.isFree) {
    return {
      promptTokens: estimateTokenCount(promptText),
      expectedOutputTokens,
      estimatedCostUsd: 0.0,
      formattedCost: '$0.00 (Free Tier)',
      isFree: true
    };
  }

  const promptTokens = estimateTokenCount(promptText);
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (expectedOutputTokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;

  return {
    promptTokens,
    expectedOutputTokens,
    estimatedCostUsd: totalCost,
    formattedCost: totalCost < 0.0001 ? '<$0.0001' : `$${totalCost.toFixed(4)}`,
    isFree: false
  };
};

/**
 * Load cumulative spend metrics from localStorage
 */
export const getSpendMetrics = () => {
  if (typeof window === 'undefined') {
    return {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalSpendUsd: 0.0,
      callCount: 0,
      recentCalls: []
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_SPEND);
    if (!raw) {
      return {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalSpendUsd: 0.0,
        callCount: 0,
        recentCalls: []
      };
    }
    const data = JSON.parse(raw);
    return {
      totalTokens: Number(data.totalTokens) || 0,
      promptTokens: Number(data.promptTokens) || 0,
      completionTokens: Number(data.completionTokens) || 0,
      totalSpendUsd: Number(data.totalSpendUsd) || 0.0,
      callCount: Number(data.callCount) || 0,
      recentCalls: Array.isArray(data.recentCalls) ? data.recentCalls.slice(-20) : []
    };
  } catch {
    return {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalSpendUsd: 0.0,
      callCount: 0,
      recentCalls: []
    };
  }
};

/**
 * Alias for getSpendMetrics
 */
export const getSpendSummary = getSpendMetrics;

/**
 * Record actual token usage and dollar spend from an API response
 */
export const recordLlmUsage = (model = '', promptTokens = 0, completionTokens = 0, toolName = 'General Inference') => {
  if (typeof window === 'undefined') return;

  const pricing = getModelPricing(model);
  const pTok = Number(promptTokens) || 0;
  const cTok = Number(completionTokens) || 0;
  const totTok = pTok + cTok;

  const costUsd = pricing.isFree 
    ? 0.0 
    : ((pTok / 1_000_000) * pricing.input) + ((cTok / 1_000_000) * pricing.output);

  const current = getSpendMetrics();
  const updated = {
    totalTokens: current.totalTokens + totTok,
    promptTokens: current.promptTokens + pTok,
    completionTokens: current.completionTokens + cTok,
    totalSpendUsd: Number((current.totalSpendUsd + costUsd).toFixed(6)),
    callCount: current.callCount + 1,
    recentCalls: [
      ...current.recentCalls,
      {
        id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        toolName,
        model,
        promptTokens: pTok,
        completionTokens: cTok,
        costUsd: Number(costUsd.toFixed(6)),
        isFree: Boolean(pricing.isFree)
      }
    ].slice(-30)
  };

  try {
    localStorage.setItem(STORAGE_KEY_SPEND, JSON.stringify(updated));
  } catch (e) {
    console.warn('Could not update LLM spend ledger:', e);
  }

  // Notify listeners
  LISTENERS.forEach(fn => {
    try { fn(updated); } catch {}
  });

  // Dispatch browser window event
  window.dispatchEvent(new CustomEvent('llm-spend-updated', { detail: updated }));
  return updated;
};

/**
 * Reset spend metrics
 */
export const resetSpendMetrics = () => {
  if (typeof window === 'undefined') return;
  const resetData = {
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalSpendUsd: 0.0,
    callCount: 0,
    recentCalls: []
  };
  localStorage.setItem(STORAGE_KEY_SPEND, JSON.stringify(resetData));
  LISTENERS.forEach(fn => {
    try { fn(resetData); } catch {}
  });
  window.dispatchEvent(new CustomEvent('llm-spend-updated', { detail: resetData }));
};

/**
 * Subscribe to spend changes
 */
export const subscribeToSpendUpdates = (callback) => {
  if (typeof callback !== 'function') return () => {};
  LISTENERS.add(callback);
  return () => {
    LISTENERS.delete(callback);
  };
};
