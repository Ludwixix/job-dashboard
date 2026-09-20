import React from 'react';
import {
  Cpu, Sparkles, Key, Eye, EyeOff, CheckCircle2, AlertCircle,
  Loader2, ArrowRight, ArrowLeft, ChevronRight, ExternalLink, Zap
} from 'lucide-react';
import { PROVIDERS } from '../../services/llmConfig';

export function StepAiConfig({
  aiEngineMode,
  setAiEngineMode,
  llmProvider,
  setLlmProvider,
  llmModel,
  setLlmModel,
  llmApiKey,
  setLlmApiKey,
  llmEndpoint,
  setLlmEndpoint,
  showApiKey,
  setShowApiKey,
  llmTesting,
  llmTestResult,
  llmError,
  setLlmError,
  setLlmTestResult,
  handleTestLlm,
  handleSaveLlmAndContinue,
  handleSelectProvider,
  handleSkipLlm,
  setStep
}) {
  return (
<div className="space-y-6 animate-in fade-in duration-200 font-mono text-xs">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono font-black bg-amber-500/20 text-amber-300 border border-amber-400/30">
          <Cpu size={14} /> STEP 2 OF 6 // AI INTELLIGENCE ENGINE (OPTIONAL)
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white font-sans">
          Configure Your Career AI Engine (Optional)
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto font-sans">
          Connect your preferred AI provider to unlock automated resume parsing, tailored cover letters, and smart interview prep. You can skip this step anytime.
        </p>
      </div>

      {/* Mode Choice Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
        <button
          type="button"
          onClick={() => setAiEngineMode('builtin')}
          className={`p-4 rounded-sm border text-left transition-all cursor-pointer flex items-center justify-between ${
            aiEngineMode === 'builtin'
              ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-400/40'
              : 'bg-slate-950/80 hover:bg-slate-800/80 border-slate-800 text-slate-400'
          }`}
        >
          <div className="space-y-1">
            <div className="font-bold text-sm text-emerald-400 flex items-center gap-1.5 font-sans">
              <Sparkles size={16} /> Platform Built-In AI
            </div>
            <div className="text-[11px] text-slate-300 font-sans">
              Zero setup • 3 complimentary starter trials • Claude 3.7 & GPT-4o
            </div>
          </div>
          {aiEngineMode === 'builtin' && <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />}
        </button>

        <button
          type="button"
          onClick={() => setAiEngineMode('byo')}
          className={`p-4 rounded-sm border text-left transition-all cursor-pointer flex items-center justify-between ${
            aiEngineMode === 'byo'
              ? 'bg-amber-500/10 border-amber-500 text-white shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/40'
              : 'bg-slate-950/80 hover:bg-slate-800/80 border-slate-800 text-slate-400'
          }`}
        >
          <div className="space-y-1">
            <div className="font-bold text-sm text-amber-400 flex items-center gap-1.5 font-sans">
              <Key size={16} /> Bring Your Own API Key
            </div>
            <div className="text-[11px] text-slate-300 font-sans">
              For developers • Connect personal OpenRouter, Claude, or OpenAI key
            </div>
          </div>
          {aiEngineMode === 'byo' && <CheckCircle2 size={18} className="text-amber-400 shrink-0" />}
        </button>
      </div>

      {/* Built-in Mode Info Card */}
      {aiEngineMode === 'builtin' && (
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/40 rounded-sm p-5 space-y-4 max-w-2xl mx-auto shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider font-sans">
              <Zap size={15} /> Ready Out of the Box
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-emerald-950 text-emerald-300 border border-emerald-800/40">
              ZERO API KEY REQUIRED
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            Your workspace comes pre-configured to dispatch high-intelligence synthesis via server-managed frontier models (Claude 3.7 Sonnet, GPT-4o, and Gemini 2.0 Flash). No developer consoles or billing setup required.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-800 text-[11px] text-slate-300 font-sans">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <span>3 Free full application packages</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <span>5-Minute Master Interview Cockpit</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <span>Key Selection Criteria (KSC) responses</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <span>Optional Pro ($19 AUD/mo) upgrade</span>
            </div>
          </div>
        </div>
      )}

      {/* BYO Key Mode Form */}
      {aiEngineMode === 'byo' && (
        <>
          {/* Provider Selection Grid */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              1. Select AI Provider
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {['openrouter', 'openai', 'gemini', 'anthropic', 'deepseek', 'groq'].map((pKey) => {
                const meta = PROVIDERS[pKey];
                if (!meta) return null;
                const isSelected = llmProvider === pKey;
                return (
                  <button
                    key={pKey}
                    type="button"
                    onClick={() => handleSelectProvider(pKey)}
                    className={`p-3.5 rounded-sm border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                        : 'bg-slate-950/80 hover:bg-slate-800/80 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-sm text-white font-sans">{meta.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-slate-800 text-amber-400 border border-slate-700">
                        {meta.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 font-sans">
                      {meta.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model Selection & API Key Inputs */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-sm p-5 space-y-4">
            {/* Model Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                2. Primary Reasoning Model
              </label>
              <select
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                className="w-full p-2.5 rounded-sm bg-slate-900 border border-slate-700 text-slate-100 font-sans text-xs focus:border-amber-500 focus:outline-none cursor-pointer"
              >
                {(PROVIDERS[llmProvider]?.models || []).map((m) => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-slate-100">
                    {m.name} {m.description ? `— ${m.description}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* API Key Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  3. {PROVIDERS[llmProvider]?.name || 'Provider'} API Key <span className="text-rose-400">*</span>
                </label>
                {PROVIDERS[llmProvider]?.keyUrl && (
                  <a
                    href={PROVIDERS[llmProvider].keyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 underline font-sans"
                  >
                    Get {PROVIDERS[llmProvider].name} Key <ExternalLink size={11} />
                  </a>
                )}
              </div>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={llmApiKey}
                  onChange={(e) => {
                    setLlmApiKey(e.target.value);
                    setLlmError('');
                    setLlmTestResult(null);
                  }}
                  placeholder={PROVIDERS[llmProvider]?.keyPlaceholder || 'Paste your API key here...'}
                  className="w-full p-2.5 pr-20 rounded-sm bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-slate-400 hover:text-slate-200 text-[11px] flex items-center gap-1 font-sans cursor-pointer"
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>{showApiKey ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-sans">
                🔒 Stored securely in your browser session. Required for personal unmetered key usage.
              </p>
            </div>

            {/* Test Connection Button & Status */}
            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleTestLlm}
                disabled={llmTesting || !llmApiKey.trim()}
                className="px-3.5 py-2 rounded-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50 text-xs"
              >
                {llmTesting ? <Loader2 size={13} className="animate-spin text-amber-400" /> : <Zap size={13} className="text-amber-400" />}
                <span>{llmTesting ? 'Testing Model Handshake...' : 'Test Connection'}</span>
              </button>

              {llmTestResult && (
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-sans">
                  <CheckCircle2 size={14} />
                  <span>{llmTestResult.message || `Connected in ${llmTestResult.latencyMs}ms!`}</span>
                </div>
              )}

              {llmError && (
                <div className="flex items-center gap-1.5 text-rose-400 text-xs font-sans">
                  <AlertCircle size={14} />
                  <span>{llmError}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Navigation Footer with Skip Options */}
      <div className="space-y-2 pt-4 border-t border-slate-800 font-mono text-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="px-4 py-2.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={handleSkipLlm}
              className="px-4 py-2.5 rounded-sm bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              Skip for now <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={handleSaveLlmAndContinue}
              className="px-6 py-2.5 rounded-sm bg-amber-600 hover:bg-amber-500 text-white font-black transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-amber-600/20"
            >
              Save & Continue to Industry <ArrowRight size={14} />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
          <span>💡 You can skip AI setup now and configure it later in Settings.</span>
          <button
            type="button"
            onClick={() => setStep(6)}
            className="text-slate-400 hover:text-amber-400 font-bold transition-colors cursor-pointer underline"
          >
            Skip directly to Review & Launch (Step 6) →
          </button>
        </div>
      </div>
    </div>
  );
}
