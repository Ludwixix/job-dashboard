import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
 X, Settings, Cpu, KeyRound, Check, CheckCircle2, AlertCircle, 
 ExternalLink, RefreshCw, Eye, EyeOff, ShieldCheck, Sparkles, 
 Sliders, Server, Zap, Compass, MapPin, Info, Search, Plus, Trash2, RotateCcw
} from 'lucide-react';
import { 
 PROVIDERS, 
 getLlmConfig, 
 saveLlmConfig, 
 testLlmConnection,
 fetchOpenRouterModels,
 getOpenRouterModels 
} from '../services/llmConfig';
import { buildQueriesFromProfile, SCRAPER_BASE_URL } from '../services/jobQueryService';
import { getProfiles } from '../services/profileService';

import { 
 getWorkforceSettings, 
 saveWorkforceSettings 
} from '../services/workforceAustraliaService';

export const SettingsModal = ({ isOpen, onClose, initialTab = 'llm' }) => {
 const [activeTab, setActiveTab] = useState(initialTab);
 const [activeProvider, setActiveProvider] = useState('openrouter');
 const [selectedModel, setSelectedModel] = useState('');
 const [isCustomModel, setIsCustomModel] = useState(false);
 const [customModelInput, setCustomModelInput] = useState('');
 const [apiKeyInput, setApiKeyInput] = useState('');
 const [showApiKey, setShowApiKey] = useState(false);
 const [endpointInput, setEndpointInput] = useState('');
 
 // OpenRouter Dynamic Models State
 const [openRouterModels, setOpenRouterModels] = useState(() => getOpenRouterModels());
 const [isSyncingOpenRouter, setIsSyncingOpenRouter] = useState(false);
 const [modelSearchQuery, setModelSearchQuery] = useState('');
 const [modelFilterTab, setModelFilterTab] = useState('all'); // 'all' | 'free' | 'featured'

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

 // Workforce Australia settings state (Default: disabled)
 const [workforceEnabled, setWorkforceEnabled] = useState(false);
 const [workforceTarget, setWorkforceTarget] = useState(100);
 const [workforceCycleDay, setWorkforceCycleDay] = useState(1);
 const [workforceJsid, setWorkforceJsid] = useState('');
 const [workforceProvider, setWorkforceProvider] = useState('');

 // Test Connection state
 const [isTesting, setIsTesting] = useState(false);
 const [testResult, setTestResult] = useState(null);
 const [saveSuccess, setSaveSuccess] = useState(false);

 // Search Queries tab state
 const [queries, setQueries] = useState([]);
 const [isLoadingQueries, setIsLoadingQueries] = useState(false);
 const [queriesSaveStatus, setQueriesSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
 const [newQueryTerm, setNewQueryTerm] = useState('');
 const [newQueryLocation, setNewQueryLocation] = useState('');
 const [isRegenerating, setIsRegenerating] = useState(false);

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
 const isPreset = (config.provider === 'openrouter' ? openRouterModels : currentProviderMeta?.models)?.some(m => m.id === config.model);
 setIsCustomModel(!isPreset && Boolean(config.customModel));

 if ((config.provider || 'openrouter') === 'openrouter') {
 fetchOpenRouterModels().then((models) => {
 if (models && models.length > 0) {
 setOpenRouterModels(models);
 }
 });
 }

 setAuEnglish(localStorage.getItem('pref_au_english') !== 'false');
 setDefaultLocation(localStorage.getItem('job_dashboard_base_location') || 'Melbourne, VIC');
 setMatchThreshold(parseInt(localStorage.getItem('pref_match_threshold') || '75', 10));
 const wf = getWorkforceSettings();
 setWorkforceEnabled(wf.enabled);
 setWorkforceTarget(wf.pointsTarget);
 setWorkforceCycleDay(wf.cycleStartDay);
 setWorkforceJsid(wf.jobseekerId);
 setWorkforceProvider(wf.providerName);

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
 const storedModel = localStorage.getItem(`llm_model_${providerId}`) || (providerId === 'openrouter' ? localStorage.getItem('openrouter_model') : '') || meta.defaultModel;
 setSelectedModel(storedModel);
 }

 if (providerId === 'openrouter') {
 fetchOpenRouterModels().then((models) => {
 if (models && models.length > 0) {
 setOpenRouterModels(models);
 }
 });
 }

 setTestResult(null);
 };

 const handleSyncOpenRouterModels = async () => {
 setIsSyncingOpenRouter(true);
 try {
 const models = await fetchOpenRouterModels({ force: true });
 if (models && models.length > 0) {
 setOpenRouterModels(models);
 }
 } catch (e) {
 console.warn('Sync OpenRouter models error:', e);
 } finally {
 setIsSyncingOpenRouter(false);
 }
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
 saveWorkforceSettings({
 enabled: workforceEnabled,
 pointsTarget: workforceTarget,
 cycleStartDay: workforceCycleDay,
 jobseekerId: workforceJsid,
 providerName: workforceProvider
 });
 // Dispatch custom event to notify listeners (e.g. Nav, Dashboard)
 if (typeof window !== 'undefined') {
 window.dispatchEvent(new CustomEvent('workforce-settings-updated', {
 detail: { enabled: workforceEnabled }
 }));
 }


 setSaveSuccess(true);
 setTimeout(() => {
 setSaveSuccess(false);
 onClose();
 }, 1200);
 };

 // ── Search Queries tab handlers ─────────────────────────────────────────

 const fetchQueries = useCallback(async () => {
 setIsLoadingQueries(true);
 try {
 const res = await fetch(`${SCRAPER_BASE_URL}/api/search-criteria`, { signal: AbortSignal.timeout(5000) });
 if (res.ok) {
 const data = await res.json();
 setQueries(data.queries || []);
 }
 } catch { /* server may be unreachable on local dev */ }
 setIsLoadingQueries(false);
 }, []);

 // Fetch queries whenever the queries tab becomes active
 useEffect(() => {
 if (isOpen && activeTab === 'queries') fetchQueries();
 }, [isOpen, activeTab, fetchQueries]);

 const saveQueries = async (updated) => {
 setQueriesSaveStatus('saving');
 try {
 const res = await fetch(`${SCRAPER_BASE_URL}/api/search-criteria`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ queries: updated }),
 signal: AbortSignal.timeout(5000),
 });
 if (!res.ok) throw new Error(`HTTP ${res.status}`);
 const data = await res.json();
 setQueries(data.queries || updated);
 setQueriesSaveStatus('saved');
 setTimeout(() => setQueriesSaveStatus(null), 2000);
 } catch {
 setQueriesSaveStatus('error');
 setTimeout(() => setQueriesSaveStatus(null), 3000);
 }
 };

 const handleAddQuery = () => {
 const term = newQueryTerm.trim();
 if (!term) return;
 const isRemote = /remote|wfh|work from home|anywhere in australia/i.test(term);
 let location = newQueryLocation.trim();
 if (!location) {
 location = isRemote ? 'Australia' : (defaultLocation || 'Melbourne, VIC');
 } else if (isRemote && /melbourne|vic/i.test(location)) {
 location = 'Australia';
 }
 const updated = [...queries, { term, location, stream: isRemote ? 'remote' : 'core', weight: 1.0, enabled: true }];
 setQueries(updated);
 setNewQueryTerm('');
 saveQueries(updated);
 };

 const handleRemoveQuery = (idx) => {
 const updated = queries.filter((_, i) => i !== idx);
 setQueries(updated);
 saveQueries(updated);
 };

 const handleRegenerateFromProfile = async () => {
 setIsRegenerating(true);
 try {
 // getProfiles() returns [activeProfile]; we just need the first element.
 const profiles = getProfiles();
 const profile = profiles[0] || null;
 if (!profile) { setIsRegenerating(false); return; }
 const generated = buildQueriesFromProfile(profile);
 if (!generated.length) { setIsRegenerating(false); return; }
 await saveQueries(generated);
 } catch { /* graceful degradation */ }
 setIsRegenerating(false);
 };

  const freeModelsCount = useMemo(() => {
    return (openRouterModels || []).filter(m => m.isFree).length;
  }, [openRouterModels]);

  const featuredModelsCount = useMemo(() => {
    const ids = (PROVIDERS.openrouter.models || []).map(p => p.id);
    return (openRouterModels || []).filter(m => ids.includes(m.id)).length;
  }, [openRouterModels]);

  const filteredOpenRouterModels = useMemo(() => {
    const list = openRouterModels || [];
    const query = (modelSearchQuery || '').toLowerCase().trim();

    return list.filter((m) => {
      if (modelFilterTab === 'free' && !m.isFree) return false;
      if (modelFilterTab === 'featured') {
        const featuredIds = (PROVIDERS.openrouter.models || []).map(p => p.id);
        if (!featuredIds.includes(m.id)) return false;
      }
      if (!query) return true;
      const idMatch = m.id.toLowerCase().includes(query);
      const nameMatch = (m.name || '').toLowerCase().includes(query);
      const descMatch = (m.description || '').toLowerCase().includes(query);
      return idMatch || nameMatch || descMatch;
    });
  }, [openRouterModels, modelSearchQuery, modelFilterTab]);

  const selectedModelMeta = useMemo(() => {
    if (activeProvider === 'openrouter') {
      const found = (openRouterModels || []).find(m => m.id === selectedModel);
      if (found) return found;
    }
    const meta = PROVIDERS[activeProvider] || PROVIDERS.openrouter;
    return meta.models?.find(m => m.id === selectedModel) || null;
  }, [activeProvider, openRouterModels, selectedModel]);

  const formatModelPrice = (m) => {
    if (!m) return '';
    if (m.isFree || m.id?.endsWith(':free')) {
      return '✨ Free Tier ($0.00)';
    }
    const pIn = parseFloat(m.pricing?.prompt ?? 0) * 1_000_000;
    const pOut = parseFloat(m.pricing?.completion ?? 0) * 1_000_000;
    if (pIn === 0 && pOut === 0) return '✨ Free Tier ($0.00)';
    return `$${pIn < 0.01 ? pIn.toFixed(3) : pIn.toFixed(2)} in / $${pOut < 0.01 ? pOut.toFixed(3) : pOut.toFixed(2)} out per 1M`;
  };

 if (!isOpen) return null;

 const currentMeta = PROVIDERS[activeProvider] || PROVIDERS.openrouter;
 const isOllamaOrCustom = activeProvider === 'ollama' || activeProvider === 'custom';

 return (
 <AnimatePresence>
 <div 
 className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
 onClick={onClose}
 >
 <motion.div
 initial={{ opacity: 0, scale: 0.96, y: 15 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.96, y: 15 }}
 transition={{ duration: 0.2 }}
 onClick={(e) => e.stopPropagation()}
 className="w-full max-w-5xl 2xl:max-w-6xl bg-slate-900 border border-slate-700/80 rounded-sm overflow-hidden my-3 sm:my-4 flex flex-col max-h-[94vh]"
 >
 {/* Top Accent Strip */}
 <div className="h-1 bg-gradient-to-r from-teal-400 via-indigo-500 to-purple-500" />

 {/* Modal Header */}
 <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-sm bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
 <Settings size={20} />
 </div>
 <div>
 <h2 className="text-lg font-black text-white flex items-center gap-2">
 <span>Dashboard Settings</span>
 <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm bg-amber-500/20 text-amber-300 border border-amber-500/30">
 AI & SYSTEM
 </span>
 </h2>
 <p className="text-xs text-slate-400">Configure LLM providers, active models, API credentials, and generation rules.</p>
 </div>
 </div>

 <button
 onClick={onClose}
 className="w-8 h-8 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
 title="Close Settings"
 >
 <X size={16} />
 </button>
 </div>

  {/* Navigation Tabs */}
  <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 border-b border-slate-800 bg-slate-900/90 text-xs font-mono shrink-0 overflow-x-auto touch-scroll-x scrollbar-none">
  <button
  onClick={() => setActiveTab('llm')}
  className={`py-2.5 sm:py-3 px-2 sm:px-1 flex items-center gap-1.5 sm:gap-2 border-b-2 font-bold transition-colors cursor-pointer min-h-[44px] shrink-0 touch-target-44 ${
  activeTab === 'llm' 
  ? 'border-amber-400 text-amber-300' 
  : 'border-transparent text-slate-400 hover:text-slate-200'
  }`}
  >
  <Cpu size={14} className="text-amber-400" />
  <span className="hidden sm:inline">1. LLM </span>PROVIDER &amp; MODEL
  </button>
  <button
  onClick={() => setActiveTab('preferences')}
  className={`py-2.5 sm:py-3 px-2 sm:px-1 flex items-center gap-1.5 sm:gap-2 border-b-2 font-bold transition-colors cursor-pointer min-h-[44px] shrink-0 touch-target-44 ${
  activeTab === 'preferences' 
  ? 'border-teal-400 text-teal-300' 
  : 'border-transparent text-slate-400 hover:text-slate-200'
  }`}
  >
  <Sliders size={14} className="text-teal-400" />
  <span className="hidden sm:inline">2. ATS &amp; </span>PREFERENCES
  </button>
  <button
  onClick={() => setActiveTab('queries')}
  className={`py-2.5 sm:py-3 px-2 sm:px-1 flex items-center gap-1.5 sm:gap-2 border-b-2 font-bold transition-colors cursor-pointer min-h-[44px] shrink-0 touch-target-44 ${
  activeTab === 'queries' 
  ? 'border-amber-400 text-amber-300' 
  : 'border-transparent text-slate-400 hover:text-slate-200'
  }`}
  >
  <Search size={14} className="text-amber-400" />
  <span className="hidden sm:inline">3. </span>SEARCH QUERIES
  </button>
  </div>

  {/* Modal Body */}
  <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 bg-slate-900/50 font-sans">
  {activeTab === 'llm' && (
 <div className="space-y-6">
 
 {/* Provider Selector Grid */}
 <div className="space-y-2.5">
 <label className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
 <span className="flex items-center gap-1.5">
 <Server size={14} className="text-amber-400" /> Select LLM Provider
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
 className={`p-3 rounded-sm border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
 isSelected
 ? 'bg-amber-950/60 border-amber-500 ring-1 ring-amber-500/50'
 : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:bg-slate-900'
 }`}
 >
 <div className="flex items-center justify-between w-full mb-1">
 <span className={`text-xs font-black ${isSelected ? 'text-white' : 'text-slate-300'}`}>
 {p.name}
 </span>
 {isSelected && (
 <CheckCircle2 size={13} className="text-amber-400 shrink-0" />
 )}
 </div>
 <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border inline-block w-fit ${
 isSelected 
 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
 : 'bg-slate-800 text-slate-400 border-slate-700'
 }`}>
 {p.badge}
 </span>
 </button>
 );
 })}
 </div>

 {/* Provider Info Banner */}
 <div className="p-3.5 rounded-sm bg-amber-950/30 border border-amber-500/20 text-xs text-slate-300 flex items-start gap-2.5">
 <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
 <div className="space-y-1">
 <p className="leading-relaxed text-[11px]">{currentMeta.description}</p>
 {currentMeta.keyUrl && (
 <a
 href={currentMeta.keyUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="text-[11px] text-amber-300 hover:text-amber-200 font-mono font-bold flex items-center gap-1 w-fit"
 >
 Get an API key from {currentMeta.name} <ExternalLink size={11} />
 </a>
 )}
 </div>
 </div>
 </div>

 {/* API Key Input */}
 <div className="space-y-2 p-4 rounded-sm bg-slate-950/60 border border-slate-800">
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
 className="w-full bg-slate-900 border border-slate-700/80 rounded-sm px-3.5 py-2.5 pr-10 text-base sm:text-xs text-white font-mono focus:outline-none focus:border-amber-500 transition-colors"
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
 <Cpu size={14} className="text-amber-400" /> Active Model
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
 className="text-[11px] font-mono text-amber-400 hover:text-amber-300 underline cursor-pointer"
 >
 {isCustomModel ? '← Pick Preset Model' : 'Custom Model ID →'}
 </button>
 </div>

          {!isCustomModel ? (
            activeProvider === 'openrouter' ? (
              <div className="space-y-3">
                {/* Search, Filter Tabs & Sync Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1.5 p-1 bg-slate-950/60 border border-slate-800 rounded-sm">
                    <button
                      type="button"
                      onClick={() => setModelFilterTab('all')}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                        modelFilterTab === 'all'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      All Models ({openRouterModels.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setModelFilterTab('free')}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                        modelFilterTab === 'free'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'text-slate-400 hover:text-emerald-300'
                      }`}
                    >
                      ✨ Free Tier ({freeModelsCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setModelFilterTab('featured')}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                        modelFilterTab === 'featured'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : 'text-slate-400 hover:text-purple-300'
                      }`}
                    >
                      ⭐ Featured ({featuredModelsCount})
                    </button>
                  </div>

                  {/* Sync Live Models Button */}
                  <button
                    type="button"
                    onClick={handleSyncOpenRouterModels}
                    disabled={isSyncingOpenRouter}
                    className="text-[11px] font-mono text-slate-400 hover:text-amber-300 flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-slate-800 hover:border-amber-500/40 bg-slate-950/40 cursor-pointer disabled:opacity-50 transition-all"
                    title="Fetch live updated model catalog from OpenRouter"
                  >
                    <RefreshCw size={12} className={isSyncingOpenRouter ? 'animate-spin text-amber-400' : ''} />
                    <span>{isSyncingOpenRouter ? 'Syncing...' : 'Sync Live Models'}</span>
                  </button>
                </div>

                {/* Real-time Search Box */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={modelSearchQuery}
                    onChange={(e) => setModelSearchQuery(e.target.value)}
                    placeholder="Search 440+ OpenRouter models (e.g. claude-3.7, deepseek, gemini, llama-3.3, free)..."
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-sm pl-9 pr-8 py-2 text-base sm:text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500"
                  />
                  {modelSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setModelSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                      title="Clear search"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Dropdown Select Element */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <label htmlFor="openrouter-model-dropdown">
                      Select OpenRouter Model ({filteredOpenRouterModels.length} available):
                    </label>
                    {selectedModel && (
                      <span className="text-amber-300 font-bold truncate max-w-[280px]">Active: {selectedModel}</span>
                    )}
                  </div>

                  <select
                    id="openrouter-model-dropdown"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-sm px-3 py-2.5 text-base sm:text-xs text-white font-mono focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {filteredOpenRouterModels.map((m) => (
                      <option key={m.id} value={m.id} className="bg-slate-900 text-white py-1">
                        {m.isFree ? '✨ [FREE] ' : ''}{m.name || m.id} — ({m.id})
                      </option>
                    ))}
                  </select>

                  {/* Selected Model Details Card */}
                  {selectedModelMeta && (
                    <div className="p-3.5 rounded-sm bg-gradient-to-r from-amber-950/40 via-slate-950 to-slate-950 border border-amber-500/40 text-xs space-y-2 mt-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{selectedModelMeta.name || selectedModelMeta.id}</span>
                          {selectedModelMeta.isFree ? (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              ✨ ZERO COST / FREE
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-amber-500/30">
                              {formatModelPrice(selectedModelMeta)}
                            </span>
                          )}
                        </div>
                        {selectedModelMeta.context_length > 0 && (
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {(selectedModelMeta.context_length / 1000).toFixed(0)}k max context
                          </span>
                        )}
                      </div>
                      {selectedModelMeta.description && (
                        <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-2">
                          {selectedModelMeta.description}
                        </p>
                      )}
                      <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                        <span>API Model ID:</span>
                        <code className="text-amber-300/90 font-semibold">{selectedModelMeta.id}</code>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentMeta.models?.map((m) => {
                  const isChosen = selectedModel === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedModel(m.id)}
                      className={`p-3 rounded-sm border cursor-pointer transition-all ${
                        isChosen
                          ? 'bg-amber-950/60 border-amber-500 text-white '
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-200">{m.name}</span>
                        {isChosen && <Check size={14} className="text-amber-400 shrink-0" />}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-snug">{m.description}</p>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
 <div className="p-3.5 rounded-sm bg-slate-950/60 border border-slate-800 space-y-2">
 <span className="text-[11px] font-mono text-slate-400 block">Enter Custom Model Identifier:</span>
 <input
 type="text"
 value={customModelInput}
 onChange={(e) => {
 setCustomModelInput(e.target.value);
 setSelectedModel(e.target.value);
 }}
 placeholder="e.g. mistralai/mistral-large-2411, qwen2.5:32b, etc."
 className="w-full bg-slate-900 border border-slate-700 rounded-sm px-3 py-2 text-base sm:text-xs text-white font-mono focus:outline-none focus:border-amber-500"
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
 className="w-full bg-slate-950 border border-slate-800 rounded-sm px-3.5 py-2.5 text-base sm:text-xs text-slate-300 font-mono focus:outline-none focus:border-amber-500"
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
 className={`px-4 py-2 rounded-sm text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer min-h-[44px] touch-target-44 ${
 isTesting || (currentMeta.requiresKey && !apiKeyInput)
 ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
 : 'bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 hover:text-white -xs'
 }`}
 >
 {isTesting ? (
 <>
 <RefreshCw size={13} className="animate-spin text-amber-400" />
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
 className={`p-3 rounded-sm border text-xs font-mono ${
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
 <div className="p-4 rounded-sm bg-slate-950/60 border border-slate-800 space-y-2">
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
 <div className="p-4 rounded-sm bg-slate-950/60 border border-slate-800 space-y-2">
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
 className="w-full bg-slate-900 border border-slate-700 rounded-sm px-3 py-2 text-white font-mono text-base sm:text-xs focus:outline-none focus:border-teal-500"
 />
 </div>

 {/* Minimum Match Threshold */}
 <div className="p-4 rounded-sm bg-slate-950/60 border border-slate-800 space-y-2">
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

 {/* Workforce Australia Mutual Obligations & PBAS Reporting */}
 <div className="p-4 rounded-sm bg-slate-950/60 border border-slate-800 space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <div className="flex items-center gap-2">
 <span className="font-bold text-white text-xs block">Workforce Australia PBAS Reporting</span>
 <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
 Mutual Obligations
 </span>
 </div>
 <p className="text-[11px] text-slate-400 font-sans mt-0.5">
 Track monthly points requirements (5 pts per application, 20 pts per interview), quick-copy data for the myGov portal, and generate compliance PDF evidence reports.
 </p>
 </div>
 <input
 type="checkbox"
 data-testid="workforce-australia-toggle"
 checked={workforceEnabled}
 onChange={(e) => setWorkforceEnabled(e.target.checked)}
 className="w-5 h-5 accent-amber-500 rounded cursor-pointer shrink-0 ml-3"
 />
 </div>

 {workforceEnabled && (
 <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div>
 <label className="text-[11px] text-slate-300 font-bold block mb-1">
 Monthly Points Target
 </label>
 <input
 type="number"
 min="20"
 max="200"
 step="5"
 value={workforceTarget}
 onChange={(e) => setWorkforceTarget(Math.max(10, parseInt(e.target.value || '100', 10)))}
 className="w-full bg-slate-900 border border-slate-700 rounded-sm px-3 py-1.5 text-white font-mono text-base sm:text-xs focus:outline-none focus:border-amber-500"
 />
 <span className="text-[10px] text-slate-500 mt-0.5 block">Default: 100 points/month</span>
 </div>

 <div>
 <label className="text-[11px] text-slate-300 font-bold block mb-1">
 Cycle Cut-Off / Start Day
 </label>
 <input
 type="number"
 min="1"
 max="28"
 value={workforceCycleDay}
 onChange={(e) => setWorkforceCycleDay(Math.max(1, Math.min(28, parseInt(e.target.value || '1', 10))))}
 className="w-full bg-slate-900 border border-slate-700 rounded-sm px-3 py-1.5 text-white font-mono text-base sm:text-xs focus:outline-none focus:border-amber-500"
 />
 <span className="text-[10px] text-slate-500 mt-0.5 block">1 = Calendar month; or provider cut-off day</span>
 </div>

 <div>
 <label className="text-[11px] text-slate-300 font-bold block mb-1">
 Jobseeker ID (JSID) <span className="text-slate-500 font-normal">(Optional)</span>
 </label>
 <input
 type="text"
 value={workforceJsid}
 onChange={(e) => setWorkforceJsid(e.target.value)}
 placeholder="e.g. JS123456789"
 className="w-full bg-slate-900 border border-slate-700 rounded-sm px-3 py-1.5 text-white font-mono text-base sm:text-xs focus:outline-none focus:border-amber-500"
 />
 </div>

 <div>
 <label className="text-[11px] text-slate-300 font-bold block mb-1">
 Provider / Agency Name <span className="text-slate-500 font-normal">(Optional)</span>
 </label>
 <input
 type="text"
 value={workforceProvider}
 onChange={(e) => setWorkforceProvider(e.target.value)}
 placeholder="e.g. APM, matchworks, Max"
 className="w-full bg-slate-900 border border-slate-700 rounded-sm px-3 py-1.5 text-white font-mono text-base sm:text-xs focus:outline-none focus:border-amber-500"
 />
 </div>
 </div>
 )}
 </div>

 </div>
 )}

 {/* ── Search Queries Tab ─────────────────────────────────── */}
 {activeTab === 'queries' && (
 <div className="space-y-5">

 {/* Header + Regenerate */}
 <div className="flex items-start justify-between gap-3">
 <div>
 <h3 className="text-sm font-black text-white flex items-center gap-2">
 <Search size={15} className="text-amber-400" />
 Active Scrape Queries
 </h3>
 <p className="text-[11px] text-slate-400 mt-1 font-sans">
 These search terms are sent to job boards (Seek, Indeed, Adzuna) on every discovery run.
 They update automatically when you save a profile, or click Regenerate below.
 </p>
 </div>
 <button
 type="button"
 onClick={handleRegenerateFromProfile}
 disabled={isRegenerating}
 className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-sm bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
 title="Replace all queries with ones auto-derived from your profile"
 >
 {isRegenerating
 ? <><RefreshCw size={13} className="animate-spin" /> Generating…</>
 : <><RotateCcw size={13} /> Regenerate from Profile</>
 }
 </button>
 </div>

 {/* Save status indicator */}
 {queriesSaveStatus && (
 <div className={`flex items-center gap-2 text-xs font-mono font-bold px-3 py-2 rounded-sm border ${
 queriesSaveStatus === 'saved' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' :
 queriesSaveStatus === 'error' ? 'text-red-300 bg-red-500/10 border-red-500/30' :
 'text-slate-400 bg-slate-800 border-slate-700'
 }`}>
 {queriesSaveStatus === 'saving' && <RefreshCw size={12} className="animate-spin" />}
 {queriesSaveStatus === 'saved' && <CheckCircle2 size={12} />}
 {queriesSaveStatus === 'error' && <AlertCircle size={12} />}
 {queriesSaveStatus === 'saving' ? 'Saving to server…' :
 queriesSaveStatus === 'saved' ? 'Queries saved — next scrape will use these.' :
 'Failed to save — server may be offline.'}
 </div>
 )}

 {/* Current query list */}
 <div className="space-y-2">
 {isLoadingQueries ? (
 <div className="text-slate-400 text-xs font-mono flex items-center gap-2 py-4">
 <RefreshCw size={13} className="animate-spin" /> Loading queries…
 </div>
 ) : queries.length === 0 ? (
 <div className="text-slate-500 text-xs font-mono py-4 text-center border border-dashed border-slate-700 rounded-sm">
 No queries configured — add one below or click Regenerate from Profile.
 </div>
 ) : (
 queries.map((q, idx) => (
 <div
 key={idx}
 className="flex items-center gap-3 p-3 rounded-sm bg-slate-950/60 border border-slate-800 group"
 >
 <div className="flex-1 min-w-0">
 <span className="text-white font-mono text-xs font-bold truncate block">{q.term}</span>
 <span className="text-slate-500 text-[10px] font-mono">{q.location}</span>
 </div>
 <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm border shrink-0
 text-amber-300 bg-amber-500/10 border-amber-500/20">
 {q.stream || 'core'}
 </span>
 <button
 type="button"
 onClick={() => handleRemoveQuery(idx)}
 className="shrink-0 w-8 h-8 sm:w-7 sm:h-7 rounded-sm bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 text-red-400 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all cursor-pointer min-h-[36px] min-w-[36px] touch-target-44"
 title="Remove query"
 >
 <Trash2 size={13} />
 </button>
 </div>
 ))
 )}
 </div>

 {/* Add new query */}
 <div className="p-4 rounded-sm bg-slate-950/60 border border-slate-800 space-y-3">
 <label className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
 <Plus size={13} className="text-amber-400" /> Add a Search Term
 </label>
 <div className="flex flex-col sm:flex-row gap-2">
 <input
 type="text"
 value={newQueryTerm}
 onChange={(e) => setNewQueryTerm(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && handleAddQuery()}
 placeholder="e.g. registered nurse, accountant, legal counsel…"
 className="flex-1 bg-slate-900 border border-slate-700 rounded-sm px-3 py-2 text-white font-mono text-base sm:text-xs focus:outline-none focus:border-amber-500"
 />
 <input
 type="text"
 value={newQueryLocation}
 onChange={(e) => setNewQueryLocation(e.target.value)}
 placeholder={defaultLocation || 'Melbourne, VIC'}
 className="w-full sm:w-36 bg-slate-900 border border-slate-700 rounded-sm px-3 py-2 text-white font-mono text-base sm:text-xs focus:outline-none focus:border-amber-500"
 />
 <button
 type="button"
 onClick={handleAddQuery}
 disabled={!newQueryTerm.trim()}
 className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-sm bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/40 text-amber-300 font-bold text-xs transition-all cursor-pointer disabled:opacity-40 min-h-[44px] sm:min-h-0 touch-target-44 flex items-center justify-center"
 >
 <Plus size={14} />
 </button>
 </div>
 <p className="text-[10px] text-slate-500 font-sans">
 Each term is sent verbatim to Seek, Indeed, and Adzuna. Press Enter or click + to add.
 </p>
 </div>

 </div>
 )}
 </div>

 {/* Footer Actions */}
 <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950 flex items-center justify-between shrink-0 font-mono text-xs pb-safe">
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
 className="px-4 py-2.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer transition-colors min-h-[44px] touch-target-44 flex items-center justify-center"
 >
 Cancel
 </button>

 <button
 type="button"
 onClick={handleSave}
 className="px-6 py-2.5 rounded-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black cursor-pointer transition-all flex items-center gap-2 min-h-[44px] touch-target-44"
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
