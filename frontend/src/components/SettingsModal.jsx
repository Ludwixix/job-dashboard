import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Settings, Cpu, KeyRound, Check, CheckCircle2, AlertCircle, 
  ExternalLink, RefreshCw, Eye, EyeOff, ShieldCheck, Sparkles, 
  Sliders, Server, Zap, Compass, MapPin, Info
} from 'lucide-react';
import { 
  PROVIDERS, 
  getLlmConfig, 
  saveLlmConfig, 
  testLlmConnection 
} from '../services/llmConfig';

export const SettingsModal = ({ isOpen, onClose, initialTab = 'llm' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [activeProvider, setActiveProvider] = useState('openrouter');
  const [selectedModel, setSelectedModel] = useState('');
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModelInput, setCustomModelInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [endpointInput, setEndpointInput] = useState('');
  
  // Platform preferences
  const [auEnglish, setAuEnglish] = useState(() => {
    return localStorage.getItem('pref_au_english') !== 'false';
  });
  const [defaultLocation, setDefaultLocation] = useState(() => {
    return localStorage.getItem('job_dashboard_base_location') || 'Melbourne, VIC';
  });
  const [matchThreshold, setMatchThreshold] = useState(() => {
    return parseInt(localStorage.getItem('pref_match_threshold') || '75', 10);
  });

  // Test Connection state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Synchronize state from storage whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const config = getLlmConfig();
      setActiveProvider(config.provider || 'openrouter');
      setSelectedModel(config.model || PROVIDERS[config.provider || 'openrouter']?.defaultModel || '');
      setApiKeyInput(config.apiKey || '');
      setEndpointInput(config.endpoint || PROVIDERS[config.provider || 'openrouter']?.defaultEndpoint || '');
      setCustomModelInput(config.customModel || '');

      const currentProviderMeta = PROVIDERS[config.provider || 'openrouter'];
      const isPreset = currentProviderMeta?.models?.some(m => m.id === config.model);
      setIsCustomModel(!isPreset && Boolean(config.model));

      setAuEnglish(localStorage.getItem('pref_au_english') !== 'false');
      setDefaultLocation(localStorage.getItem('job_dashboard_base_location') || 'Melbourne, VIC');
      setMatchThreshold(parseInt(localStorage.getItem('pref_match_threshold') || '75', 10));
      setTestResult(null);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  // When user switches provider tab
  const handleSelectProvider = (providerId) => {
    setActiveProvider(providerId);
    const meta = PROVIDERS[providerId] || PROVIDERS.openrouter;
    
    // Check if we have a stored key for this provider
    const storedKey = localStorage.getItem(`llm_key_${providerId}`) || (providerId === 'openrouter' ? localStorage.getItem('openrouter_api_key') : '') || '';
    setApiKeyInput(storedKey);

    // Custom endpoint
    const storedEndpoint = localStorage.getItem(`llm_custom_endpoint_${providerId}`) || meta.defaultEndpoint;
    setEndpointInput(storedEndpoint);

    // Model selection
    const storedCustomModel = localStorage.getItem(`llm_custom_model_${providerId}`) || '';
    setCustomModelInput(storedCustomModel);

    if (storedCustomModel) {
      setIsCustomModel(true);
      setSelectedModel(storedCustomModel);
    } else {
      setIsCustomModel(false);
      setSelectedModel(meta.defaultModel);
    }

    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    const modelToUse = isCustomModel ? customModelInput.trim() : selectedModel;
    const res = await testLlmConnection({
      provider: activeProvider,
      model: modelToUse,
      apiKey: apiKeyInput,
      endpoint: endpointInput
    });

    setIsTesting(false);
    setTestResult(res);
  };

  const handleSave = () => {
    const modelToSave = isCustomModel ? customModelInput.trim() : selectedModel;

    saveLlmConfig({
      provider: activeProvider,
      model: modelToSave,
      apiKey: apiKeyInput,
      endpoint: endpointInput,
      customModel: isCustomModel ? customModelInput.trim() : ''
    });

    localStorage.setItem('pref_au_english', auEnglish ? 'true' : 'false');
    localStorage.setItem('job_dashboard_base_location', defaultLocation.trim());
    localStorage.setItem('pref_match_threshold', String(matchThreshold));

    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  const currentMeta = PROVIDERS[activeProvider] || PROVIDERS.openrouter;
  const isOllamaOrCustom = activeProvider === 'ollama' || activeProvider === 'custom';

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]"
        >
          {/* Top Accent Strip */}
          <div className="h-1 bg-gradient-to-r from-teal-400 via-indigo-500 to-purple-500" />

          {/* Modal Header */}
          <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Settings size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <span>Dashboard Settings</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    AI & SYSTEM
                  </span>
                </h2>
                <p className="text-xs text-slate-400">Configure LLM providers, active models, API credentials, and generation rules.</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close Settings"
            >
              <X size={16} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 px-6 border-b border-slate-800 bg-slate-900/90 text-xs font-mono shrink-0">
            <button
              onClick={() => setActiveTab('llm')}
              className={`py-3 px-1 flex items-center gap-2 border-b-2 font-bold transition-colors cursor-pointer ${
                activeTab === 'llm' 
                  ? 'border-indigo-400 text-indigo-300' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu size={14} className="text-indigo-400" />
              1. LLM PROVIDER & MODEL
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`py-3 px-1 flex items-center gap-2 border-b-2 font-bold transition-colors cursor-pointer ${
                activeTab === 'preferences' 
                  ? 'border-teal-400 text-teal-300' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders size={14} className="text-teal-400" />
              2. ATS & PLATFORM PREFERENCES
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-900/50 font-sans">
            {activeTab === 'llm' && (
              <div className="space-y-6">
                
                {/* Provider Selector Grid */}
                <div className="space-y-2.5">
                  <label className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Server size={14} className="text-indigo-400" /> Select LLM Provider
                    </span>
                    <span className="text-[10px] text-slate-500 lowercase font-normal">
                      Keys stored locally in browser
                    </span>
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.values(PROVIDERS).map((p) => {
                      const isSelected = activeProvider === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectProvider(p.id)}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
                            isSelected
                              ? 'bg-indigo-950/60 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                              : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <span className={`text-xs font-black ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                              {p.name}
                            </span>
                            {isSelected && (
                              <CheckCircle2 size={13} className="text-indigo-400 shrink-0" />
                            )}
                          </div>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border inline-block w-fit ${
                            isSelected 
                              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' 
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {p.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Provider Info Banner */}
                  <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-slate-300 flex items-start gap-2.5">
                    <Info size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="leading-relaxed text-[11px]">{currentMeta.description}</p>
                      {currentMeta.keyUrl && (
                        <a
                          href={currentMeta.keyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-indigo-300 hover:text-indigo-200 font-mono font-bold flex items-center gap-1 w-fit"
                        >
                          Get an API key from {currentMeta.name} <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* API Key Input */}
                <div className="space-y-2 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <KeyRound size={13} className="text-amber-400" /> 
                      {currentMeta.name} API Key
                      {!currentMeta.requiresKey && (
                        <span className="text-[10px] text-slate-500 font-normal lowercase">(Optional for local)</span>
                      )}
                    </label>

                    {apiKeyInput && (
                      <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                        <Check size={11} /> Key Configured
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder={currentMeta.keyPlaceholder}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                      title={showApiKey ? 'Hide key' : 'Show key'}
                    >
                      {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-500 flex items-center gap-1">
                    <ShieldCheck size={12} className="text-teal-400" />
                    Zero Secret Exposure: Key remains in your browser's private localStorage and is never logged on server side.
                  </p>
                </div>

                {/* Model Selector */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu size={14} className="text-indigo-400" /> Active Model
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomModel(!isCustomModel);
                        if (!isCustomModel && customModelInput) {
                          setSelectedModel(customModelInput);
                        } else if (isCustomModel) {
                          setSelectedModel(currentMeta.defaultModel);
                        }
                      }}
                      className="text-[11px] font-mono text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                    >
                      {isCustomModel ? '← Pick Preset Model' : 'Custom Model ID →'}
                    </button>
                  </div>

                  {!isCustomModel ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {currentMeta.models?.map((m) => {
                        const isChosen = selectedModel === m.id;
                        return (
                          <div
                            key={m.id}
                            onClick={() => setSelectedModel(m.id)}
                            className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                              isChosen
                                ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-md'
                                : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-900'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-slate-200">{m.name}</span>
                              {isChosen && <Check size={14} className="text-indigo-400 shrink-0" />}
                            </div>
                            <p className="text-[10px] text-slate-500 leading-snug">{m.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                      <span className="text-[11px] font-mono text-slate-400 block">Enter Custom Model Identifier:</span>
                      <input
                        type="text"
                        value={customModelInput}
                        onChange={(e) => {
                          setCustomModelInput(e.target.value);
                          setSelectedModel(e.target.value);
                        }}
                        placeholder="e.g. mistralai/mistral-large-2411, qwen2.5:32b, etc."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>

                {/* Endpoint URL (Custom or Ollama) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Server size={13} className="text-purple-400" /> API Gateway Endpoint
                    </label>
                    <button
                      type="button"
                      onClick={() => setEndpointInput(currentMeta.defaultEndpoint)}
                      className="text-[10px] font-mono text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      Reset Default
                    </button>
                  </div>
                  <input
                    type="text"
                    value={endpointInput}
                    onChange={(e) => setEndpointInput(e.target.value)}
                    placeholder={currentMeta.defaultEndpoint}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-500">
                    Target HTTPS/HTTP URL handling completions. For Ollama default is <code className="text-slate-400">http://localhost:11434/v1/chat/completions</code>.
                  </p>
                </div>

                {/* Connection Test Action & Result */}
                <div className="pt-2 border-t border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">Verify Credentials</span>
                      <span className="text-[10px] text-slate-500">Sends a lightweight 1-token test prompt to confirm live connectivity.</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTesting || (currentMeta.requiresKey && !apiKeyInput)}
                      className={`px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
                        isTesting || (currentMeta.requiresKey && !apiKeyInput)
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-white shadow-xs'
                      }`}
                    >
                      {isTesting ? (
                        <>
                          <RefreshCw size={13} className="animate-spin text-indigo-400" />
                          <span>Testing…</span>
                        </>
                      ) : (
                        <>
                          <Zap size={13} className="text-amber-400" />
                          <span>Test Connection</span>
                        </>
                      )}
                    </button>
                  </div>

                  {testResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-2xl border text-xs font-mono ${
                        testResult.success
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {testResult.success ? (
                          <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-bold">
                            {testResult.success ? 'Connection Successful!' : 'Connection Failed'}
                          </div>
                          <p className="text-[11px] mt-0.5 text-slate-300">
                            {testResult.message || testResult.error}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

              </div>
            )}

            {activeTab === 'preferences' && (
              <div className="space-y-6 font-mono text-xs">
                
                {/* Australian English Toggle */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white text-xs block">Australian English Localization</span>
                      <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                        Enforces AU spelling standard (prioritise, customise, modelling, licence) in all AI tailored documents.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={auEnglish}
                      onChange={(e) => setAuEnglish(e.target.checked)}
                      className="w-5 h-5 accent-teal-500 rounded cursor-pointer"
                    />
                  </div>
                </div>

                {/* Default Location Baseline */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <label className="font-bold text-white text-xs flex items-center gap-1.5">
                    <MapPin size={13} className="text-teal-400" /> Default Location Baseline
                  </label>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Default city or suburb used for proximity matching and commute filtering across Seek, LinkedIn, and Indeed.
                  </p>
                  <input
                    type="text"
                    value={defaultLocation}
                    onChange={(e) => setDefaultLocation(e.target.value)}
                    placeholder="Melbourne, VIC"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>

                {/* Minimum Match Threshold */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">Auto-Apply Minimum Match Score</span>
                    <span className="text-teal-300 font-bold px-2 py-0.5 rounded bg-teal-500/20 border border-teal-500/30">
                      {matchThreshold}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Only jobs meeting or exceeding this strategic convergence score will qualify for autonomous 1-click batch application.
                  </p>
                  <input
                    type="range"
                    min="50"
                    max="95"
                    step="5"
                    value={matchThreshold}
                    onChange={(e) => setMatchThreshold(parseInt(e.target.value, 10))}
                    className="w-full accent-teal-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>50% (Broad)</span>
                    <span>75% (Balanced)</span>
                    <span>95% (Laser Focused)</span>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-5 sm:p-6 border-t border-slate-800 bg-slate-950 flex items-center justify-between shrink-0 font-mono text-xs">
            <div>
              {saveSuccess && (
                <span className="text-emerald-400 font-bold flex items-center gap-1.5 animate-pulse">
                  <CheckCircle2 size={15} /> Settings Saved & Activated!
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black shadow-md cursor-pointer transition-all flex items-center gap-2"
              >
                <CheckCircle2 size={15} />
                <span>SAVE SETTINGS</span>
              </button>
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
