import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Wrench,
  Cpu,
  FileCode,
  Terminal,
  ShieldCheck,
  Layers,
  Zap,
  ChevronRight,
  Play,
  RotateCcw,
  X,
  Bot,
  ExternalLink,
} from 'lucide-react';
import {
  fetchSourcesHealth,
  diagnoseSource,
  remediateSource,
  getLlmRepairContext,
  generateLlmCodeRepair,
  applySourcePatch,
  runAutomatedSelfHealing,
} from '../services/sourceHealingService';
import { getLlmConfig } from '../services/llmConfig';

const SOURCE_DETAILS = {
  SEEK: {
    label: 'SEEK Australia',
    description: 'Direct Chalice GraphQL/REST, Playwright stealth browser, and validated atomic cache fallback.',
    tiers: ['Chalice Direct API', 'Stealth Playwright Browser', 'Validated Atomic Cache'],
    badgeColor: 'border-cyan-500/30 text-cyan-400 bg-cyan-950/20',
  },
  Indeed: {
    label: 'Indeed AU & Global',
    description: 'JobSpy TLS engine, direct JSON ad extractor, and stealth browser session fallback.',
    tiers: ['JobSpy TLS Extractor', 'Stealth Browser Fallback', 'Cached Snapshot'],
    badgeColor: 'border-blue-500/30 text-blue-400 bg-blue-950/20',
  },
  Adzuna: {
    label: 'Adzuna Australia API',
    description: 'Direct REST API query layer with exponential backoff and rate-limit guardrails.',
    tiers: ['Adzuna REST API v1', 'Backoff & Jitter Queue'],
    badgeColor: 'border-amber-500/30 text-amber-400 bg-amber-950/20',
  },
  RemoteOK: {
    label: 'RemoteOK Global Feed',
    description: 'Direct asynchronous JSON feed with atomic schema normalization and local cache.',
    tiers: ['Direct JSON Endpoint', 'Local Pipeline Cache'],
    badgeColor: 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20',
  },
};

/**
 * Status indicator badge component
 */
const StatusBadge = ({ status }) => {
  const normalized = (status || 'unknown').toLowerCase();
  if (normalized === 'healthy' || normalized === 'active') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
        <CheckCircle2 size={11} className="text-emerald-400" />
        HEALTHY
      </span>
    );
  }
  if (normalized === 'degraded' || normalized === 'standby') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-950/80 text-amber-400 border border-amber-500/30">
        <AlertTriangle size={11} className="text-amber-400" />
        DEGRADED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-950/80 text-rose-400 border border-rose-500/30">
      <XCircle size={11} className="text-rose-400" />
      UNHEALTHY
    </span>
  );
};

export const SourceSelfHealModal = ({ isOpen, onClose, initialSource = null }) => {
  const [sourcesHealth, setSourcesHealth] = useState({});
  const [overallStatus, setOverallStatus] = useState('healthy');
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const [activeOperation, setActiveOperation] = useState(null); // { source, type: 'probe'|'heal'|'llm', stage: string, logs: [] }
  const [repairContextData, setRepairContextData] = useState(null); // { source, full_code, target_file, ... }
  const [synthesizedPatch, setSynthesizedPatch] = useState(null); // { patchCode, model, provider }
  const [patchVerificationResult, setPatchVerificationResult] = useState(null);
  const [selectedSourceForView, setSelectedSourceForView] = useState(initialSource || 'SEEK');

  // Load active LLM config
  const llmConfig = useMemo(() => getLlmConfig(), []);
  const activeModelDisplay = `${llmConfig.providerMeta?.name || 'LLM'}: ${llmConfig.model || 'Standard'}`;

  // Fetch live health status on modal open
  const loadHealthSummary = useCallback(async () => {
    setIsLoadingHealth(true);
    try {
      const data = await fetchSourcesHealth();
      if (data && data.summary) {
        setSourcesHealth(data.summary);
        setOverallStatus(data.overall_status || 'healthy');
      }
    } catch (err) {
      console.error('Failed to load scraper health summary:', err);
    } finally {
      setIsLoadingHealth(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadHealthSummary();
      if (initialSource) {
        setSelectedSourceForView(initialSource);
      }
    }
  }, [isOpen, initialSource, loadHealthSummary]);

  // Execute quick diagnostic probe
  const handleProbe = async (sourceName) => {
    setActiveOperation({
      source: sourceName,
      type: 'probe',
      stage: 'probing',
      logs: [`Initiating live diagnostic probe for ${sourceName}...`],
    });

    try {
      const diagnosis = await diagnoseSource(sourceName);
      const safeStatus = (diagnosis?.status || 'healthy').toUpperCase();
      setActiveOperation((prev) => ({
        ...prev,
        stage: 'finished',
        logs: [
          ...(prev?.logs || []),
          `Status: ${safeStatus} (${diagnosis?.latency_ms || 0}ms, ${diagnosis?.jobs_found || 0} jobs found)`,
          diagnosis?.error_details ? `Issue: ${diagnosis.error_details}` : 'No runtime faults detected.',
          diagnosis?.suggested_action ? `Action: ${diagnosis.suggested_action}` : 'Ready for scraping.',
        ],
      }));
      // Refresh summary
      await loadHealthSummary();
    } catch (err) {
      setActiveOperation((prev) => ({
        ...prev,
        stage: 'error',
        logs: [...(prev?.logs || []), `Probe failed: ${err.message}`],
      }));
    }
  };

  // Trigger full 3-stage autonomous self-healing
  const handleFullSelfHeal = async (sourceName) => {
    setActiveOperation({
      source: sourceName,
      type: 'heal',
      stage: 'probe',
      logs: [`Starting autonomous 3-stage self-healing for ${sourceName}...`],
    });

    try {
      const report = await runAutomatedSelfHealing(sourceName, {
        onStep: ({ stage, message }) => {
          setActiveOperation((prev) => ({
            ...prev,
            stage,
            logs: [...(prev?.logs || []), `[${stage.toUpperCase()}] ${message}`],
          }));
        },
        allowLlmRepair: true,
      });

      if (report.patchResult) {
        setPatchVerificationResult(report.patchResult);
      }
      if (report.llmRepair) {
        setSynthesizedPatch(report.llmRepair);
      }

      await loadHealthSummary();
    } catch (err) {
      setActiveOperation((prev) => ({
        ...prev,
        stage: 'error',
        logs: [...(prev?.logs || []), `Self-healing error: ${err.message}`],
      }));
    }
  };

  // Request LLM repair context for manual inspection / synthesis
  const handlePrepareLlmRepair = async (sourceName) => {
    setActiveOperation({
      source: sourceName,
      type: 'llm',
      stage: 'retrieving_context',
      logs: [`Retrieving codebase context and diagnostics for ${sourceName}...`],
    });

    try {
      const errorMsg = sourcesHealth[sourceName]?.last_error || 'Parser breakage / 0 jobs returned';
      const ctx = await getLlmRepairContext(sourceName, errorMsg);
      setRepairContextData(ctx);
      setSelectedSourceForView(sourceName);

      setActiveOperation((prev) => ({
        ...prev,
        stage: 'generating_code',
        logs: [
          ...(prev?.logs || []),
          `Context retrieved (${ctx.full_code?.length || 0} bytes from ${ctx.target_file}).`,
          `Synthesizing code repair with ${activeModelDisplay}...`,
        ],
      }));

      const llmResult = await generateLlmCodeRepair(sourceName, ctx, (msg) => {
        setActiveOperation((prev) => ({
          ...prev,
          logs: [...(prev?.logs || []), msg],
        }));
      });

      setSynthesizedPatch(llmResult);
      setActiveOperation((prev) => ({
        ...prev,
        stage: 'ready_to_apply',
        logs: [
          ...(prev?.logs || []),
          `Code repair synthesized successfully! Review code below or apply with verification.`,
        ],
      }));
    } catch (err) {
      setActiveOperation((prev) => ({
        ...prev,
        stage: 'error',
        logs: [...(prev?.logs || []), `Code repair error: ${err.message}`],
      }));
    }
  };

  // Apply synthesized patch and run backend test gauntlet
  const handleApplyPatch = async () => {
    if (!synthesizedPatch || !repairContextData) return;

    setActiveOperation({
      source: repairContextData.source,
      type: 'apply',
      stage: 'verifying',
      logs: [
        `Verifying AST syntax and creating atomic backup (.bak)...`,
        `Executing pytest validation suite on ${repairContextData.target_file}...`,
      ],
    });

    try {
      const result = await applySourcePatch(
        repairContextData.source,
        synthesizedPatch.patchCode,
        repairContextData.target_file
      );
      setPatchVerificationResult(result);

      setActiveOperation((prev) => ({
        ...prev,
        stage: result.success ? 'success' : 'failed',
        logs: [
          ...(prev?.logs || []),
          result.message,
          result.test_output ? `Pytest Output:\n${result.test_output}` : '',
        ],
      }));

      await loadHealthSummary();
    } catch (err) {
      setActiveOperation((prev) => ({
        ...prev,
        stage: 'error',
        logs: [...(prev?.logs || []), `Patch application failed: ${err.message}`],
      }));
    }
  };

  if (!isOpen) return null;

  const sourcesList = ['SEEK', 'Indeed', 'Adzuna', 'RemoteOK'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="bg-[#0f1219] border border-slate-700/80 rounded-lg shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-200"
        role="dialog"
        aria-labelledby="scraper-self-heal-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-[#141822] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="scraper-self-heal-title" className="text-base font-bold text-white tracking-wide">
                  SCRAPER HEALTH & AUTONOMOUS SELF-HEALING
                </h2>
                <StatusBadge status={overallStatus} />
              </div>
              <p className="text-xs text-slate-400">
                Autonomous runtime tier escalation & user-active LLM code repair engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Active Model Pill */}
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300"
              title="Active user LLM configured in Settings"
            >
              <Bot size={13} className="text-amber-400" />
              <span className="truncate max-w-[200px]">{activeModelDisplay}</span>
            </div>

            <button
              type="button"
              onClick={loadHealthSummary}
              disabled={isLoadingHealth}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Refresh health status"
            >
              <RefreshCw size={15} className={isLoadingHealth ? 'animate-spin text-amber-400' : ''} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* Top Banner with 3-Stage Explanation */}
          <div className="p-3.5 rounded bg-slate-900/60 border border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-400 flex items-center justify-center font-bold shrink-0 text-[10px]">
                1
              </div>
              <div>
                <div className="font-bold text-slate-200">Diagnostic Probe</div>
                <div className="text-slate-400 text-[11px] leading-relaxed">
                  Real-time network latency, auth headers, and response structure verification.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-amber-950 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold shrink-0 text-[10px]">
                2
              </div>
              <div>
                <div className="font-bold text-slate-200">Runtime Tier Escalation</div>
                <div className="text-slate-400 text-[11px] leading-relaxed">
                  Escalates blocked API to stealth Playwright browser, refreshes tokens, or activates cache.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold shrink-0 text-[10px]">
                3
              </div>
              <div>
                <div className="font-bold text-slate-200">User LLM Code Repair</div>
                <div className="text-slate-400 text-[11px] leading-relaxed">
                  Synthesizes Python parser updates with AST verification, atomic backup, and test gauntlet.
                </div>
              </div>
            </div>
          </div>

          {/* Sources Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sourcesList.map((srcKey) => {
              const srcMeta = SOURCE_DETAILS[srcKey] || {};
              const health = sourcesHealth?.[srcKey] || { status: 'healthy', queries: 0 };
              const healthStatus = (health?.status || 'healthy').toLowerCase();
              const isDegradedOrUnhealthy =
                healthStatus === 'degraded' ||
                healthStatus === 'unhealthy';

              return (
                <div
                  key={srcKey}
                  className={`p-4 rounded-lg bg-[#121620] border transition-all ${
                    selectedSourceForView === srcKey
                      ? 'border-amber-500/50 shadow-md shadow-amber-950/20'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white tracking-wide">{srcMeta.label || srcKey}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono border ${srcMeta.badgeColor}`}>
                        {srcKey}
                      </span>
                    </div>
                    <StatusBadge status={health.status} />
                  </div>

                  <p className="text-xs text-slate-400 mb-3 leading-relaxed">{srcMeta.description}</p>

                  {/* Fallback Tiers Pill Bar */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Tiers:</span>
                    {(srcMeta.tiers || []).map((tier, idx) => (
                      <span
                        key={tier}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 font-mono"
                      >
                        {idx + 1}. {tier}
                      </span>
                    ))}
                  </div>

                  {/* Operational Metrics */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono p-2 rounded bg-slate-950/60 border border-slate-800/60 mb-3">
                    <div>
                      <span className="text-slate-500">Queries: </span>
                      <span className="text-slate-200 font-bold">{health.queries || 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Last Latency: </span>
                      <span className="text-slate-200 font-bold">{health.latency_ms ? `${health.latency_ms}ms` : 'Nominal'}</span>
                    </div>
                    {health.last_error && (
                      <div className="col-span-2 text-rose-400 truncate" title={health.last_error}>
                        Error: {health.last_error}
                      </div>
                    )}
                  </div>

                  {/* Action Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleProbe(srcKey)}
                      disabled={activeOperation && activeOperation.stage !== 'finished' && activeOperation.stage !== 'error'}
                      className="flex-1 min-h-[40px] px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Activity size={13} className="text-cyan-400" />
                      <span>Probe</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleFullSelfHeal(srcKey)}
                      disabled={activeOperation && activeOperation.stage !== 'finished' && activeOperation.stage !== 'error'}
                      className={`flex-1 min-h-[40px] px-3 py-1.5 rounded border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isDegradedOrUnhealthy
                          ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400 shadow-md shadow-amber-900/30 animate-pulse'
                          : 'bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      <Wrench size={13} />
                      <span>1-Click Self-Heal</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePrepareLlmRepair(srcKey)}
                      disabled={activeOperation && activeOperation.stage !== 'finished' && activeOperation.stage !== 'error'}
                      className="min-h-[40px] px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/40 text-slate-300 hover:text-amber-300 transition-colors cursor-pointer"
                      title="Generate LLM Code Repair & View Diff"
                    >
                      <FileCode size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Operation & Execution Terminal */}
          {activeOperation && (
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <Terminal size={14} />
                  <span>
                    AUTONOMOUS EXECUTION LOG: {activeOperation.source} [{activeOperation.stage.toUpperCase()}]
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">Live Agent Stream</div>
              </div>

              <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar p-1">
                {(activeOperation.logs || []).map((logLine, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-slate-300">
                    <ChevronRight size={12} className="text-amber-500 shrink-0 mt-0.5" />
                    <span className="break-words whitespace-pre-wrap">{logLine}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Code Review & Diff Pane (When LLM repair synthesized) */}
          {synthesizedPatch && (
            <div className="p-4 rounded-lg bg-[#11141e] border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu size={16} className="text-amber-400" />
                  <span className="font-bold text-sm text-white">
                    SYNTHESIZED CODE REPAIR ({repairContextData?.target_file || selectedSourceForView})
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 border border-amber-500/30 text-amber-300">
                    Model: {synthesizedPatch.model}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleApplyPatch}
                  className="min-h-[44px] px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
                >
                  <ShieldCheck size={14} />
                  <span>Apply & Verify With Pytest</span>
                </button>
              </div>

              {/* Code Snippet Box */}
              <div className="rounded bg-slate-950 border border-slate-800 p-3 max-h-60 overflow-y-auto font-mono text-xs text-slate-300 custom-scrollbar">
                <pre>{synthesizedPatch.patchCode}</pre>
              </div>

              {patchVerificationResult && (
                <div
                  className={`p-3 rounded border text-xs font-mono ${
                    patchVerificationResult.success
                      ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <div className="font-bold mb-1">
                    {patchVerificationResult.success
                      ? '✓ PATCH VERIFIED & RETAINED (All unit tests passed)'
                      : '✗ TEST VERIFICATION FAILED (Atomic rollback executed)'}
                  </div>
                  <div className="text-[11px]">{patchVerificationResult.message}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-[#141822] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px]">Autonomous Scraper Resilience Active</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

