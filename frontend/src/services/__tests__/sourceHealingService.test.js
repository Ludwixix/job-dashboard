import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchSourcesHealth,
  diagnoseSource,
  remediateSource,
  getLlmRepairContext,
  extractPythonCode,
  generateLlmCodeRepair,
  applySourcePatch,
  runAutomatedSelfHealing,
} from '../sourceHealingService';
import * as llmConfigModule from '../llmConfig';

describe('sourceHealingService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchSourcesHealth fetches health summary from backend', async () => {
    const mockResponse = {
      status: 'ok',
      overall_status: 'healthy',
      summary: {
        SEEK: { status: 'healthy', queries: 12 },
        Indeed: { status: 'healthy', queries: 8 },
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await fetchSourcesHealth();
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sources/health'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('diagnoseSource sends probe query and returns diagnosis', async () => {
    const mockDiagnosis = {
      source: 'SEEK',
      status: 'healthy',
      latency_ms: 125,
      jobs_found: 10,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', diagnosis: mockDiagnosis }),
    });

    const result = await diagnoseSource('SEEK', 'cloud architect');
    expect(result).toEqual(mockDiagnosis);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sources/diagnose'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ source: 'SEEK', query: 'cloud architect' }),
      })
    );
  });

  it('remediateSource triggers runtime operational escalation', async () => {
    const mockRemediation = {
      source: 'SEEK',
      actions_taken: ['Escalated to stealth Playwright browser'],
      verification: { status: 'healthy', jobs_found: 5 },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', remediation: mockRemediation }),
    });

    const result = await remediateSource('SEEK', { status: 'degraded' });
    expect(result).toEqual(mockRemediation);
  });

  it('getLlmRepairContext retrieves codebase file context', async () => {
    const mockContext = {
      source: 'Indeed',
      target_file: 'backend/src/job_dashboard/sources/indeed.py',
      full_code: 'def fetch_jobs(): pass',
      error_details: 'HTTP 429 Too Many Requests',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', repair_context: mockContext }),
    });

    const result = await getLlmRepairContext('Indeed', 'HTTP 429 Too Many Requests');
    expect(result).toEqual(mockContext);
  });

  it('extractPythonCode strips markdown code fences correctly', () => {
    const fenced = '```python\ndef scrape():\n    return []\n```';
    expect(extractPythonCode(fenced)).toBe('def scrape():\n    return []');

    const genericFenced = '```\ndef scrape_generic():\n    pass\n```';
    expect(extractPythonCode(genericFenced)).toBe('def scrape_generic():\n    pass');

    const raw = 'def plain_code():\n    return True';
    expect(extractPythonCode(raw)).toBe(raw);
  });

  it('generateLlmCodeRepair dispatches repair prompt to user active model', async () => {
    vi.spyOn(llmConfigModule, 'getLlmConfig').mockReturnValue({
      provider: 'openrouter',
      model: 'anthropic/claude-3.7-sonnet',
      apiKey: 'test-user-key',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      providerMeta: { name: 'OpenRouter', requiresKey: true },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '```python\ndef fixed_scrape():\n    """Fixed parser."""\n    return [{"title": "Job"}]\n```',
            },
          },
        ],
      }),
    });

    const repairContext = {
      source: 'SEEK',
      target_file: 'backend/src/job_dashboard/sources/seek.py',
      full_code: 'def broken(): pass',
      error_details: 'Parser error',
      llm_prompt: 'Fix parser',
    };

    const result = await generateLlmCodeRepair('SEEK', repairContext);
    expect(result.patchCode).toContain('def fixed_scrape():');
    expect(result.model).toBe('anthropic/claude-3.7-sonnet');
    expect(result.provider).toBe('OpenRouter');
  });

  it('applySourcePatch posts patch to backend verification endpoint', async () => {
    const mockPatchResult = {
      source: 'RemoteOK',
      success: true,
      message: 'Patch verified by pytest and applied.',
      test_output: '1 passed in 0.2s',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', patch_result: mockPatchResult }),
    });

    const result = await applySourcePatch('RemoteOK', 'def patch(): pass', 'sources/remoteok.py');
    expect(result).toEqual(mockPatchResult);
  });

  it('runAutomatedSelfHealing finishes immediately if diagnosis is healthy', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        diagnosis: { source: 'SEEK', status: 'healthy', latency_ms: 80, jobs_found: 10 },
      }),
    });

    const report = await runAutomatedSelfHealing('SEEK');
    expect(report.success).toBe(true);
    expect(report.stage).toBe('completed');
    expect(report.diagnosis.status).toBe('healthy');
  });
});

