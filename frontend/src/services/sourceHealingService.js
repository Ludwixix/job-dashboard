/**
 * @file sourceHealingService.js
 * @description Client-side service for multi-tier scraper source health monitoring,
 * autonomous operational remediation, and user-active LLM code repair.
 */

import { getBackendApiBase } from './apiConfig';
import { getLlmConfig, PROVIDERS } from './llmConfig';

/**
 * Fetches health summary for all scraper sources (SEEK, Indeed, Adzuna, RemoteOK).
 *
 * @returns {Promise<{status: string, summary: Object, overall_status: string}>}
 */
export const fetchSourcesHealth = async () => {
  const base = getBackendApiBase();
  const res = await fetch(`${base}/api/sources/health`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch source health: HTTP ${res.status}`);
  }

  return await res.json();
};

/**
 * Dispatches a live diagnostic probe against a specific source.
 *
 * @param {string} sourceName - e.g. "SEEK", "Indeed", "Adzuna", "RemoteOK"
 * @param {string} [query='software engineer'] - Optional probe query
 * @returns {Promise<Object>} Diagnostic result
 */
export const diagnoseSource = async (sourceName, query = 'software engineer') => {
  const base = getBackendApiBase();
  const res = await fetch(`${base}/api/sources/diagnose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: sourceName, query }),
  });

  if (!res.ok) {
    throw new Error(`Failed to diagnose ${sourceName}: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.diagnosis;
};

/**
 * Triggers autonomous runtime operational remediation (tier escalation, session refresh, backoff reset).
 *
 * @param {string} sourceName - Source name
 * @param {Object} [diagnosis={}] - Previous diagnostic payload
 * @returns {Promise<Object>} Remediation result
 */
export const remediateSource = async (sourceName, diagnosis = {}) => {
  const base = getBackendApiBase();
  const res = await fetch(`${base}/api/sources/remediate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: sourceName, diagnosis }),
  });

  if (!res.ok) {
    throw new Error(`Failed to remediate ${sourceName}: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.remediation;
};

/**
 * Retrieves source code context, target file path, and structured LLM prompt from backend.
 *
 * @param {string} sourceName - Source name
 * @param {string} [errorDetails=''] - Error details or traceback
 * @returns {Promise<Object>} Repair context payload
 */
export const getLlmRepairContext = async (sourceName, errorDetails = '') => {
  const base = getBackendApiBase();
  const res = await fetch(`${base}/api/sources/llm-repair-context`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: sourceName, error_details: errorDetails }),
  });

  if (!res.ok) {
    throw new Error(`Failed to retrieve repair context for ${sourceName}: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.repair_context;
};

/**
 * Cleans and extracts raw Python code from an LLM response string.
 *
 * @param {string} raw - Raw LLM response
 * @returns {string} Clean Python source code
 */
export const extractPythonCode = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();

  // Match ```python ... ``` block if present
  const pythonFenceMatch = trimmed.match(/```(?:python|py)?\s*\n([\s\S]*?)```/i);
  if (pythonFenceMatch && pythonFenceMatch[1]) {
    return pythonFenceMatch[1].trim();
  }

  // Generic code fence ``` ... ```
  const genericFenceMatch = trimmed.match(/```\s*\n([\s\S]*?)```/);
  if (genericFenceMatch && genericFenceMatch[1]) {
    return genericFenceMatch[1].trim();
  }

  return trimmed;
};

/**
 * Synthesizes a code repair using the logged-in user's active LLM model.
 * Zero Secret Exposure: API key stays strictly on client and sent directly to LLM provider.
 *
 * @param {string} sourceName - Name of source to fix
 * @param {Object} repairContext - Output from getLlmRepairContext
 * @param {Function} [onProgress] - Optional progress callback
 * @returns {Promise<{patchCode: string, model: string, provider: string}>}
 */
export const generateLlmCodeRepair = async (sourceName, repairContext, onProgress) => {
  const llmConfig = getLlmConfig();
  const provider = llmConfig.provider || 'openrouter';
  const providerMeta = llmConfig.providerMeta || PROVIDERS[provider] || PROVIDERS.openrouter;
  const apiKey = llmConfig.apiKey;
  const model = llmConfig.model || providerMeta.defaultModel;
  const endpoint = llmConfig.endpoint || providerMeta.defaultEndpoint;

  if (!apiKey && providerMeta.requiresKey) {
    throw new Error(
      `API key is missing for active provider (${providerMeta.name}). Please configure your API key in Settings & LLM Models.`
    );
  }

  onProgress?.(`Dispatching code repair to active user LLM [${providerMeta.name} // ${model}]...`);

  const systemPrompt = `You are a Principal Software Engineer and Web Scraping / API Architecture Expert.
Your task is to fix a broken, degraded, or blocked scraper source in the Job Dashboard system (${sourceName}).
You must adhere strictly to these principles:
1. Return ONLY the fully updated, self-contained Python file content enclosed inside a single \`\`\`python code block.
2. DO NOT include meta-commentary, markdown explanations outside the code block, or truncated code snippets ("# ... rest of code unchanged").
3. Ensure the syntax is 100% valid Python (it will be verified via ast.parse and pytest).
4. Preserve all existing fallback mechanisms, tier switches, and error handling.`;

  const userPrompt = `${repairContext.llm_prompt || `Fix the issues in ${sourceName} scraper.`}

TARGET FILE: ${repairContext.target_file}
DIAGNOSTIC ERROR DETAILS:
${repairContext.error_details || 'Source is degraded or returning 0 jobs.'}

CURRENT IMPLEMENTATION:
\`\`\`python
${repairContext.full_code}
\`\`\``;

  let rawReply = '';

  if (provider === 'anthropic') {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 8192,
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      let errMsg = `Anthropic API error: HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson?.error?.message) errMsg = errJson.error.message;
      } catch {}
      throw new Error(errMsg);
    }

    const data = await res.json();
    rawReply = data?.content?.[0]?.text || '';
  } else {
    // OpenAI-compatible providers (OpenRouter, OpenAI, Gemini, DeepSeek, Groq, Ollama, Custom)
    const headers = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'https://job-dashboard.app';
      headers['X-Title'] = 'Job Dashboard Scraper Self-Healing Engine';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 8192,
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      let errMsg = `${providerMeta.name} API error: HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson?.error?.message) errMsg = errJson.error.message;
      } catch {}
      throw new Error(errMsg);
    }

    const data = await res.json();
    rawReply = data?.choices?.[0]?.message?.content || '';
  }

  const patchCode = extractPythonCode(rawReply);

  if (!patchCode || patchCode.length < 50) {
    throw new Error('LLM generated an empty or invalid Python code repair payload.');
  }

  onProgress?.(`LLM synthesis complete (${patchCode.length} characters of Python code generated).`);

  return {
    patchCode,
    model,
    provider: providerMeta.name,
  };
};

/**
 * Dispatches the Python patch code to the backend for ast.parse syntax verification,
 * atomic backup creation, pytest test execution, and rollback if tests fail.
 *
 * @param {string} sourceName - Source name
 * @param {string} patchCode - Synthesized Python patch code
 * @param {string} [targetFile] - Optional target file path
 * @returns {Promise<Object>} Patch result
 */
export const applySourcePatch = async (sourceName, patchCode, targetFile) => {
  const base = getBackendApiBase();
  const res = await fetch(`${base}/api/sources/apply-patch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: sourceName,
      patch_code: patchCode,
      target_file: targetFile,
    }),
  });

  if (!res.ok) {
    let errMsg = `Failed to apply patch: HTTP ${res.status}`;
    try {
      const errData = await res.json();
      if (errData?.message) errMsg = errData.message;
    } catch {}
    throw new Error(errMsg);
  }

  const data = await res.json();
  return data.patch_result;
};

/**
 * Autonomous 3-stage self-healing controller:
 * Stage 1: Diagnostic Probe
 * Stage 2: Operational Tier Remediation (if broken)
 * Stage 3: Active User LLM Code Repair (if operational tier didn't fully resolve)
 *
 * @param {string} sourceName - Name of source
 * @param {Object} [options]
 * @param {Function} [options.onStep] - Step progress notification callback
 * @param {boolean} [options.allowLlmRepair=true] - Whether to proceed to LLM repair if needed
 * @returns {Promise<Object>} Final healing execution report
 */
export const runAutomatedSelfHealing = async (sourceName, { onStep, allowLlmRepair = true } = {}) => {
  const report = {
    source: sourceName,
    stage: 'probe',
    success: false,
    diagnosis: null,
    remediation: null,
    llmRepair: null,
    patchResult: null,
  };

  // Stage 1: Diagnostic Probe
  onStep?.({ stage: 'probe', message: `Executing live diagnostic probe on ${sourceName}...` });
  const diagnosis = await diagnoseSource(sourceName);
  report.diagnosis = diagnosis;

  if (diagnosis.status === 'healthy') {
    report.success = true;
    report.stage = 'completed';
    onStep?.({ stage: 'completed', message: `${sourceName} is healthy! No remediation required.` });
    return report;
  }

  // Stage 2: Operational Runtime Remediation
  onStep?.({
    stage: 'remediate',
    message: `${sourceName} is ${diagnosis.status} (${diagnosis.error_category}). Initiating runtime operational tier escalation...`,
  });
  const remediation = await remediateSource(sourceName, diagnosis);
  report.remediation = remediation;

  if (remediation?.verification?.status === 'healthy') {
    report.success = true;
    report.stage = 'completed';
    onStep?.({
      stage: 'completed',
      message: `Operational remediation successful! ${sourceName} is healthy again.`,
    });
    return report;
  }

  // Stage 3: LLM Code Repair (if enabled)
  if (!allowLlmRepair) {
    onStep?.({
      stage: 'manual_intervention_needed',
      message: `Operational remediation did not restore health. LLM repair paused.`,
    });
    return report;
  }

  onStep?.({
    stage: 'llm_repair',
    message: `Operational escalation insufficient. Requesting source context for LLM code repair...`,
  });

  const repairContext = await getLlmRepairContext(sourceName, diagnosis.error_details || diagnosis.suggested_action);
  const llmResult = await generateLlmCodeRepair(sourceName, repairContext, (msg) => {
    onStep?.({ stage: 'llm_repair', message: msg });
  });
  report.llmRepair = llmResult;

  onStep?.({
    stage: 'verifying_patch',
    message: `Applying patch to ${repairContext.target_file} and running test gauntlet...`,
  });

  const patchResult = await applySourcePatch(sourceName, llmResult.patchCode, repairContext.target_file);
  report.patchResult = patchResult;
  report.success = patchResult.success;
  report.stage = 'completed';

  onStep?.({
    stage: 'completed',
    message: patchResult.success
      ? `Source ${sourceName} successfully patched and verified by test suite!`
      : `Patch application failed test verification: ${patchResult.message}`,
  });

  return report;
};

