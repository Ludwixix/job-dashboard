import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  X, Sparkles, FileText, Check, Copy, ExternalLink, FileUser,
  Zap, BarChart3, AlertCircle, Clock, Send,
  ShieldCheck, CheckCircle2, AlertTriangle, Settings,
  Cpu, KeyRound, Download
} from 'lucide-react';
import { 
  generateApplicationDocs, extractJobKeywords, calculateAtsScore, 
  runDocumentQualityAudit, getActiveApiKey, setActiveApiKey,
  getActiveModel, setActiveModel, AVAILABLE_MODELS
} from '../services/generationService';
import { PROVIDERS, getLlmConfig, saveLlmConfig } from '../services/llmConfig';
import { downloadResumePdf, downloadCoverLetterPdf } from '../utils/pdfGenerator';
import { getActiveProfile } from '../services/profileService';
import { downloadAtsDocxResume } from '../services/dataService';

const GEMINI_GEM_URL = "https://gemini.google.com/gem/1Bxx-IAsb1aBD0T6rxC6aJB1frzm4Yphz?usp=drive_link";

// ── ATS score colour ───────────────────────────────────────────────────────────
const scoreColor = (s) => {
  if (s >= 85) return 'text-emerald-400';
  if (s >= 70) return 'text-amber-400';
  return 'text-rose-400';
};

// ── Gemini Gem prompt ──────────────────────────────────────────────────────────
const buildGemPrompt = (job) => {
  const profile = getActiveProfile();
  const name = profile?.name || 'Sam Ludwig';
  const phone = profile?.phone || '0405 993 245';
  const email = profile?.email || 'sam.ludwig@gmail.com';
  const loc = profile?.location || 'Melbourne VIC 3183';
  const workRights = profile?.workRights || 'Australian Citizen — Unrestricted Work Rights';
  const clearance = profile?.clearance || 'Clearance Eligible: Baseline / NV1';
  const coreSkills = (profile?.coreSkills || []).join(', ');
  const candidateHistory = [profile?.fullWorkExperienceText, profile?.workHistorySummary]
    .filter(v => typeof v === 'string' && v.trim())
    .join('\n\n');

  return `TARGET JOB — Read this first, apply to every word you write:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Melbourne, VIC'}
Salary: ${job.salary || 'Not stated'}
Description / Requirements:
${job.notes || job.description || '(No job description provided — infer from title and company.)'}

CANDIDATE MASTER PROFILE & VERIFIED CAREER RECORD:
Name: ${name}
Contact: ${phone} | ${email} | ${loc}
Work Rights & Clearance: ${workRights} | ${clearance}
Core Skills: ${coreSkills}
Career History & Verified Achievements:
${candidateHistory || 'Senior Systems and Infrastructure specialist with extensive Australian enterprise record.'}

ARCHITECTURAL RECRUITMENT DIRECTIVES (5-PHASE FRAMEWORK):
1. SEMANTIC GAP DIAGNOSTIC: Begin with a brief (max 3 sentences) brutal diagnostic of the candidate's weakest areas against the role requirements.
2. MECHANICAL PARSING LAYER: Strict single-column flow. Zero markdown tables, grids, sidebars, or floating elements. Place contact details in body text at the very top. Use standard section headers: PROFESSIONAL SUMMARY, SKILLS, WORK EXPERIENCE, EDUCATION, REFEREES. Strict reverse chronology with explicit dates (MM/YYYY to MM/YYYY).
3. AUSTRALIAN LOCALIZATION: Format for 2-3 pages depth. Append mandatory "REFEREES" section. Strictly exclude personal demographics (no photo, age, marital status). Use Australian English spelling (organisation, prioritise, analyse).
4. ACHIEVEMENT ANCHORING: Every bullet point in WORK EXPERIENCE must follow: [Active Verb] + [Core Task/Project] + [Quantified Result/Metric]. Eradicate corporate fluff ("results-driven", "team player", "passionate", "detail-oriented") and replace with factual claims of scale (users, uptime, SLA, %, $).
5. COVER LETTER ANTI-TEMPLATE RULE: Must NOT start with "I am writing to apply for..." or "With a proven track record". Write 3 high-impact paragraphs: Paragraph 1 (Hook on company trajectory/challenge), Paragraph 2 (Proof points proving candidate solved an identical problem with metrics), Paragraph 3 (Confident, low-friction CTA). Must pass the Swappability Test.
6. LINKEDIN BOOLEAN OPTIMIZATION: 3 Boolean-friendly headlines with exact literal titles, plus a keyword-rich "About" section index grouping synonyms for recruiter Boolean searches.

Generate with delimiters:
===DIAGNOSTIC===
[Max 3 sentences diagnostic]
===RESUME===
[Single-column ATS tailored resume with Referees]
===COVER_LETTER===
[3-paragraph high-impact cover letter passing Swappability Test]
===LINKEDIN_OPTIMIZATION===
[3 Boolean headlines + About section search index]`;
};

export const GeneratorModal = ({ job, onClose, onUpdateStatus, onSaveCustomDocs }) => {
  const [activeTab, setActiveTab]             = useState(job.hasCustomDocs ? 'quality' : 'overview');
  const [resumeText, setResumeText]           = useState(job.resumeText || '');
  const [coverLetterText, setCoverLetterText] = useState(job.coverLetterText || '');
  const [linkedInText, setLinkedInText]       = useState(job.linkedInText || '');
  const [diagnosticText, setDiagnosticText]   = useState('');
  const [isGenerating, setIsGenerating]       = useState(false);
  const [genProgress, setGenProgress]         = useState('');
  const [genError, setGenError]               = useState('');
  const [genMeta, setGenMeta]                 = useState(job.hasCustomDocs ? { model: job.docsModel || 'GLM 5.3 Flash', elapsedMs: 0 } : null);
  const [copiedPrompt, setCopiedPrompt]       = useState(false);
  const [copiedText, setCopiedText]           = useState(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);
  const [saveStatus, setSaveStatus]           = useState('saved'); // 'saved' | 'saving'

  // Settings modal state
  const [showSettings, setShowSettings]       = useState(false);
  const [activeProvider, setActiveProvider]   = useState(() => getLlmConfig().provider || 'openrouter');
  const [inputKey, setInputKey]               = useState(() => getLlmConfig().apiKey || '');
  const [selectedModel, setSelectedModel]     = useState(() => getLlmConfig().model || 'z-ai/glm-5.3-flash');
  const [savedSettingsSuccess, setSavedSettingsSuccess] = useState(false);

  useEffect(() => {
    const config = getLlmConfig();
    setActiveProvider(config.provider || 'openrouter');
    setInputKey(config.apiKey || '');
    setSelectedModel(config.model || 'z-ai/glm-5.3-flash');
  }, [showSettings]);

  // Debounced auto-save when user edits in the studio
  useEffect(() => {
    if (!resumeText && !coverLetterText && !linkedInText) return;
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      if (onSaveCustomDocs) {
        onSaveCustomDocs(job.id, {
          resumeText,
          coverLetterText,
          linkedInText,
          model: genMeta?.model || 'Application Studio',
          generatedAt: new Date().toISOString()
        });
      }
      setSaveStatus('saved');
    }, 600);

    return () => clearTimeout(timer);
  }, [resumeText, coverLetterText, linkedInText, job.id, genMeta, onSaveCustomDocs]);

  const handleManualSave = () => {
    if (onSaveCustomDocs) {
      onSaveCustomDocs(job.id, {
        resumeText,
        coverLetterText,
        linkedInText,
        model: genMeta?.model || 'Application Studio',
        generatedAt: new Date().toISOString()
      });
    }
    setSaveStatus('saved');
  };

  const handleSaveSettings = () => {
    saveLlmConfig({
      provider: activeProvider,
      model: selectedModel,
      apiKey: inputKey
    });
    setSavedSettingsSuccess(true);
    setTimeout(() => {
      setSavedSettingsSuccess(false);
      setShowSettings(false);
    }, 1200);
  };

  const [telemetryLogs, setTelemetryLogs]     = useState([]);
  const [quickApiKey, setQuickApiKey]         = useState('');

  // Pre-compute ATS analysis from job description
  const jobDescription = job.notes || job.description || '';
  const matchedKeywords = extractJobKeywords(jobDescription);
  const atsScore = calculateAtsScore(jobDescription);

  // Live adversarial quality audit calculation
  const qualityAudit = useMemo(() => {
    return runDocumentQualityAudit(job, resumeText, coverLetterText);
  }, [job, resumeText, coverLetterText]);

  // ── Unified 1-Click AI Generation with Live Streaming Telemetry ─────────────
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setGenError('');
    setGenProgress('Connecting to OpenRouter online (GLM 5.3 Flash)…');
    setTelemetryLogs([
      { time: '0.0s', msg: `Initialized dispatch for ${job.title} at ${job.company}`, type: 'init' }
    ]);

    const handleLog = (logEntry) => {
      setTelemetryLogs(prev => [...prev, logEntry]);
    };

    try {
      const result = await generateApplicationDocs(job, setGenProgress, handleLog, getActiveProfile());

      if (!result) {
        setGenError('Unable to connect to generation engine.');
        setGenProgress('');
        setIsGenerating(false);
        return;
      }

      if (result.error) {
        throw new Error(result.error);
      }

      setResumeText(result.resume || '');
      setCoverLetterText(result.coverLetter || '');
      setLinkedInText(result.linkedInOptimization || '');
      setDiagnosticText(result.diagnostic || '');
      setGenMeta({ model: result.model, elapsedMs: result.elapsedMs });
      setGenProgress('');
      
      // Persist generated assets to job record and local storage
      if (onSaveCustomDocs) {
        onSaveCustomDocs(job.id, {
          resumeText: result.resume || '',
          coverLetterText: result.coverLetter || '',
          linkedInText: result.linkedInOptimization || '',
          model: result.model,
          generatedAt: new Date().toISOString()
        });
      }

      // Automatically transition to the Double-Check Quality Gate tab
      setTimeout(() => {
        setActiveTab('quality');
      }, 900);

    } catch (err) {
      setGenError(err.message || 'Generation failed. Please check your API key.');
      setGenProgress('');
    } finally {
      setIsGenerating(false);
    }
  }, [job, onSaveCustomDocs]);

  // ── Gemini Gem ─────────────────────────────────────────────────────────────
  const handleLaunchGem = () => {
    const prompt = buildGemPrompt(job);
    navigator.clipboard.writeText(prompt).catch(() => {});
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 4000);
    window.open(GEMINI_GEM_URL, '_blank');
  };

  // ── Copy ───────────────────────────────────────────────────────────────────
  const handleCopy = () => {
    let text = '';
    if (activeTab === 'resume') text = resumeText;
    else if (activeTab === 'cover_letter') text = coverLetterText;
    else if (activeTab === 'linkedin') text = linkedInText;
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  // ── Direct PDF & ATS DOCX Downloads ────────────────────────────────────────
  const handleDownloadResume = () => {
    if (!resumeText) return;
    if (onSaveCustomDocs) {
      onSaveCustomDocs(job.id, {
        resumeText,
        coverLetterText,
        model: genMeta?.model || 'Application Studio',
        generatedAt: new Date().toISOString()
      });
    }
    downloadResumePdf(resumeText, job);
  };

  const handleDownloadAtsDocx = () => {
    if (!resumeText) return;
    if (onSaveCustomDocs) {
      onSaveCustomDocs(job.id, {
        resumeText,
        coverLetterText,
        model: genMeta?.model || 'Application Studio',
        generatedAt: new Date().toISOString()
      });
    }
    const candidateProfile = getActiveProfile();
    downloadAtsDocxResume(job, candidateProfile, resumeText);
  };

  const handleDownloadCoverLetter = () => {
    if (!coverLetterText) return;
    if (onSaveCustomDocs) {
      onSaveCustomDocs(job.id, {
        resumeText,
        coverLetterText,
        model: genMeta?.model || 'Application Studio',
        generatedAt: new Date().toISOString()
      });
    }
    downloadCoverLetterPdf(coverLetterText, job);
  };

  const handleDownloadBoth = () => {
    if (onSaveCustomDocs) {
      onSaveCustomDocs(job.id, {
        resumeText,
        coverLetterText,
        model: genMeta?.model || 'Application Studio',
        generatedAt: new Date().toISOString()
      });
    }
    if (resumeText) downloadResumePdf(resumeText, job);
    if (coverLetterText) {
      setTimeout(() => downloadCoverLetterPdf(coverLetterText, job), 400);
    }
  };

  const handleAutoSubmit = () => {
    if (onSaveCustomDocs) {
      onSaveCustomDocs(job.id, {
        resumeText,
        coverLetterText,
        model: genMeta?.model || 'Application Studio',
        generatedAt: new Date().toISOString()
      });
    }
    if (onUpdateStatus) {
      onUpdateStatus(job.id, 'Applied / Confirmation Received', {
        appliedVia: 'Application Studio V2.0 (Double-Checked)',
        appliedDate: new Date().toISOString().split('T')[0]
      });
    }
    // Also trigger direct separate PDF downloads
    handleDownloadBoth();
    setIsSubmittedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 2200);
  };


  const hasDocuments = Boolean(resumeText && coverLetterText);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-700/60 flex flex-col max-h-[92vh] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Settings Overlay ── */}
        {showSettings && (
          <div className="absolute inset-0 z-30 bg-slate-950/95 backdrop-blur-md p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                    <Settings size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">AI Engine & Model Settings</h3>
                    <p className="text-xs text-slate-400">Configure LLM provider, preferred model, and private credentials.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 text-slate-500 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Provider Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu size={13} className="text-indigo-400" /> LLM Provider
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.values(PROVIDERS).map((p) => {
                    const isSelected = activeProvider === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setActiveProvider(p.id);
                          setSelectedModel(p.defaultModel);
                          const storedKey = localStorage.getItem(`llm_key_${p.id}`) || (p.id === 'openrouter' ? localStorage.getItem('openrouter_api_key') : '') || '';
                          setInputKey(storedKey);
                        }}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-xs'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold truncate">{p.name}</div>
                        <div className="text-[9px] text-slate-500 truncate">{p.badge}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* API Key Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <KeyRound size={13} className="text-amber-400" /> {PROVIDERS[activeProvider]?.name || 'Provider'} API Key
                  </label>
                  {PROVIDERS[activeProvider]?.keyUrl && (
                    <a
                      href={PROVIDERS[activeProvider].keyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 underline"
                    >
                      Get Key ↗
                    </a>
                  )}
                </div>
                <input
                  type="password"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder={PROVIDERS[activeProvider]?.keyPlaceholder || 'Enter API key...'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-500">
                  Direct HTTPS browser calls. Key is saved locally in private localStorage.
                </p>
              </div>

              {/* Model Selector */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu size={13} className="text-indigo-400" /> Active LLM Model
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(PROVIDERS[activeProvider]?.models || AVAILABLE_MODELS).map(m => (
                    <div
                      key={m.id}
                      onClick={() => setSelectedModel(m.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedModel === m.id
                          ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-md'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200">{m.name}</span>
                        {selectedModel === m.id && <Check size={14} className="text-indigo-400" />}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{m.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {savedSettingsSuccess && (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 size={13} /> Settings Saved!
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-md"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <div className="relative bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400" />
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/15 border border-indigo-400/30 rounded-xl">
              <Sparkles size={18} className="text-indigo-400" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                <span>Application Studio & Quality Gate</span>
                <span className="bg-indigo-950 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-800 text-[9px] font-mono">
                  {selectedModel.split('/')[1] || selectedModel}
                </span>
              </div>
              <h2 className="text-base font-black text-white leading-tight">{job.company}</h2>
              <p className="text-xs text-slate-400 font-medium">{job.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Settings trigger */}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Configure API Key & Model"
            >
              <Settings size={17} />
            </button>

            {/* Live Quality Gate Score */}
            <div className="hidden sm:flex flex-col items-end pl-2 border-l border-slate-800">
              <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Quality Gate</span>
              <span className={`text-base font-black ${scoreColor(qualityAudit.overallScore)}`}>
                {qualityAudit.overallScore}% Pass
              </span>
            </div>

            <button onClick={onClose} className="p-2 text-slate-500 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Gemini Gem Banner ── */}
        <div className="bg-gradient-to-r from-indigo-950/80 to-purple-950/80 px-5 py-2.5 border-b border-indigo-900/50 flex items-center justify-between gap-3 shrink-0">
          <div>
            <div className="text-[10px] font-black text-amber-400 uppercase tracking-wider">💎 Gemini Gem — Full Career Bio Tailoring</div>
            <p className="text-[11px] text-slate-400">Copies full job context + verified career record to clipboard, opens custom Gem</p>
          </div>
          <button
            onClick={handleLaunchGem}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            {copiedPrompt ? <Check size={12} className="text-emerald-300" /> : <ExternalLink size={12} />}
            {copiedPrompt ? 'PROMPT COPIED' : 'LAUNCH GEM'}
          </button>
        </div>

        {/* ── Tab bar ── */}
        <div className="bg-slate-900 border-b border-slate-800 px-5 py-2 flex items-center justify-between gap-1 shrink-0 overflow-x-auto">
          <div className="flex items-center gap-1">
            {[
              { id: 'overview',      label: 'STUDIO GENERATOR', icon: <Zap size={13} /> },
              hasDocuments && { 
                id: 'quality', 
                label: 'DOUBLE-CHECK GATE', 
                icon: <ShieldCheck size={13} className={qualityAudit.isReadyToSubmit ? 'text-emerald-400' : 'text-amber-400'} /> 
              },
              resumeText     && { id: 'resume',       label: 'RESUME',       icon: <FileUser size={13} className="text-emerald-400" /> },
              coverLetterText && { id: 'cover_letter', label: 'COVER LETTER', icon: <FileText size={13} className="text-indigo-400" /> },
              linkedInText   && { id: 'linkedin',     label: 'LINKEDIN INBOUND', icon: <Cpu size={13} className="text-sky-400" /> },
              matchedKeywords.length && { id: 'ats', label: 'ATS SPECS',  icon: <BarChart3 size={13} className="text-amber-400" /> },
            ].filter(Boolean).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                  activeTab === tab.id ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {activeTab === 'resume' && (
              <>
                <button
                  onClick={handleCopy}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer border border-slate-700"
                >
                  {copiedText ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  {copiedText ? 'COPIED' : 'COPY'}
                </button>
                <button
                  onClick={handleDownloadResume}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                >
                  <Download size={12} /> DOWNLOAD RESUME (PDF)
                </button>
                <button
                  onClick={handleDownloadAtsDocx}
                  className="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                  title="Download ATS OpenXML (.docx) for Workday/Taleo"
                >
                  <FileText size={12} /> ATS RESUME (.DOCX)
                </button>
              </>
            )}

            {activeTab === 'cover_letter' && (
              <>
                <button
                  onClick={handleCopy}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer border border-slate-700"
                >
                  {copiedText ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  {copiedText ? 'COPIED' : 'COPY'}
                </button>
                <button
                  onClick={handleDownloadCoverLetter}
                  className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                >
                  <Download size={12} /> DOWNLOAD COVER LETTER (PDF)
                </button>
              </>
            )}

            {activeTab === 'linkedin' && (
              <button
                onClick={handleCopy}
                className="px-2.5 py-1 rounded-lg bg-sky-950 border border-sky-600 hover:bg-sky-900 text-sky-200 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
              >
                {copiedText ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                {copiedText ? 'COPIED' : 'COPY LINKEDIN ASSETS'}
              </button>
            )}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* GENERATE tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {genError && (
                <div className="flex items-start gap-3 p-4 bg-rose-950/40 border border-rose-800/50 rounded-xl text-rose-300 text-xs">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{genError}</span>
                </div>
              )}

              {isGenerating && (
                <div className="p-5 bg-indigo-950/50 border border-indigo-800/50 rounded-2xl text-indigo-300 text-xs flex items-center gap-4 shadow-xl">
                  <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <div className="space-y-1">
                    <div className="font-black text-white text-sm">Online AI Generating Application Package ({selectedModel})…</div>
                    <div className="text-indigo-300 text-xs">{genProgress}</div>
                  </div>
                </div>
              )}

              {genMeta && !isGenerating && (
                <div className="flex items-center gap-2 text-[11px] text-slate-500 px-1">
                  <Clock size={12} />
                  <span>Synthesized via {genMeta.model} in {(genMeta.elapsedMs / 1000).toFixed(1)}s</span>
                </div>
              )}

              {/* OpenRouter API Key Input Banner if Missing */}
              {!getActiveApiKey() && (
                <div className="bg-amber-950/40 border border-amber-500/40 p-4 rounded-xl space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
                    <KeyRound size={14} className="text-amber-400" />
                    OpenRouter API Key Required
                  </div>
                  <p className="text-xs text-slate-300">
                    Enter your OpenRouter key to activate live role tailoring with <strong className="text-white">z-ai/glm-5.3-flash</strong> (stored unencrypted in your local browser storage):
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="password"
                      placeholder="sk-or-v1-..."
                      value={quickApiKey}
                      onChange={(e) => setQuickApiKey(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-400"
                    />
                    <button
                      onClick={() => {
                        if (quickApiKey.trim()) {
                          setActiveApiKey(quickApiKey.trim());
                          setInputKey(quickApiKey.trim());
                          setSavedSettingsSuccess(true);
                          setTimeout(() => setSavedSettingsSuccess(false), 2000);
                        }
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl cursor-pointer shrink-0 transition-colors shadow-sm"
                    >
                      Activate Key
                    </button>
                  </div>
                </div>
              )}

              {/* Main 1-Click Action Card */}
              <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-900 border border-slate-700/60 flex flex-col justify-between gap-5 shadow-lg">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs uppercase tracking-wider">
                      <Sparkles size={16} /> Automated Application Package
                    </div>
                    <span className="text-[11px] font-bold text-slate-400 font-mono">
                      Target Role: {job.title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                    Synthesizes a tailored ATS Resume and 3-paragraph Cover Letter in one operation. 
                    Automatically triggers the <strong className="text-emerald-400 font-bold">Pre-Submission Adversarial Quality Gate</strong> to guarantee title mirroring, outcome metrics, and ATS keyword coverage.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-3">
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full sm:w-auto flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-emerald-500/20 tracking-wider uppercase"
                  >
                    <Zap size={14} className="animate-pulse" />
                    {isGenerating ? 'SYNTHESIZING APPLICATION PACKAGE…' : 'GENERATE FULL APPLICATION PACKAGE'}
                  </button>

                  {hasDocuments && (
                    <button
                      onClick={() => setActiveTab('quality')}
                      className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors cursor-pointer"
                    >
                      <ShieldCheck size={14} className="text-emerald-400" /> View Quality Gate
                    </button>
                  )}
                </div>
              </div>

              {/* Phase 1 Semantic Gap Diagnostic Banner */}
              {diagnosticText && (
                <div className="p-4 bg-purple-950/40 border border-purple-800/50 rounded-2xl text-purple-200 text-xs space-y-1 shadow-lg">
                  <div className="flex items-center gap-2 text-purple-400 font-extrabold uppercase tracking-wider text-[11px]">
                    <Cpu size={14} /> Phase 1 Semantic Gap Diagnostic (ATS AI Screening)
                  </div>
                  <p className="text-slate-300 leading-relaxed font-sans">{diagnosticText}</p>
                </div>
              )}

              {/* Live Streaming Telemetry Terminal Feed */}
              {telemetryLogs.length > 0 && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs space-y-2.5 shadow-inner">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-emerald-400 animate-ping' : 'bg-indigo-400'}`} />
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                        {isGenerating ? 'LIVE AI TELEMETRY STREAM' : 'AI EXECUTION TELEMETRY LOG'}
                      </span>
                    </div>
                    <span className="text-[10px] text-indigo-400 font-bold">{selectedModel}</span>
                  </div>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {telemetryLogs.map((entry, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[11px] leading-relaxed font-mono animate-in fade-in duration-150">
                        <span className="text-slate-500 shrink-0 select-none">[{entry.time}]</span>
                        <span className={
                          entry.type === 'error' ? 'text-rose-400 font-bold' :
                          entry.type === 'success' ? 'text-emerald-400 font-bold' :
                          entry.type === 'network' ? 'text-cyan-300' :
                          'text-slate-300'
                        }>
                          {entry.msg}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* QUALITY AUDIT DOUBLE-CHECK GATE TAB */}
          {activeTab === 'quality' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Submission Success Toast */}
              {isSubmittedSuccess && (
                <div className="p-4 bg-emerald-950 border border-emerald-500 rounded-xl text-emerald-200 text-xs font-bold flex items-center gap-2 animate-bounce">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  Application Package Submitted & Status Updated in JobTracker!
                </div>
              )}

              {/* Phase 1 Semantic Gap Diagnostic Banner */}
              {diagnosticText && (
                <div className="p-4 bg-purple-950/40 border border-purple-800/50 rounded-2xl text-purple-200 text-xs space-y-1 shadow-lg">
                  <div className="flex items-center gap-2 text-purple-400 font-extrabold uppercase tracking-wider text-[11px]">
                    <Cpu size={14} /> Phase 1 Semantic Gap Diagnostic (ATS AI Screening)
                  </div>
                  <p className="text-slate-300 leading-relaxed font-sans">{diagnosticText}</p>
                </div>
              )}

              {/* Glowing Quality Banner */}
              <div className={`p-5 rounded-2xl border transition-all ${
                qualityAudit.isReadyToSubmit 
                  ? 'bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 border-emerald-500/50 shadow-lg shadow-emerald-950/30' 
                  : 'bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border-amber-500/50'
              }`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="flex items-start gap-3.5">
                    <div className={`p-3 rounded-xl shrink-0 ${
                      qualityAudit.isReadyToSubmit ? 'bg-emerald-500/20 text-emerald-400 shadow-inner' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      <ShieldCheck size={28} className={qualityAudit.isReadyToSubmit ? 'animate-pulse' : ''} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">
                          {qualityAudit.isReadyToSubmit ? 'VERIFIED PASS — READY TO SUBMIT' : 'QUALITY AUDIT IN PROGRESS'}
                        </h3>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                          qualityAudit.isReadyToSubmit 
                            ? 'bg-emerald-500 text-slate-950 font-mono shadow-sm' 
                            : 'bg-amber-900/80 text-amber-300'
                        }`}>
                          {qualityAudit.overallScore}% Score
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-xl">
                        {qualityAudit.isReadyToSubmit 
                          ? `This application package satisfies all ${qualityAudit.checks.length} ATS checks. Download your separate Resume and Cover Letter PDF files below or dispatch auto-apply.` 
                          : 'Review the checks below to ensure maximum interview conversion before submitting.'}
                      </p>
                    </div>
                  </div>

                  {/* ── SEPARATE ILLUMINATED ACTION BUTTONS ── */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0">
                    <button
                      onClick={handleDownloadResume}
                      className={`px-3.5 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md ${
                        qualityAudit.isReadyToSubmit
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/25 ring-2 ring-emerald-400/50'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      <Download size={13} /> RESUME (PDF)
                    </button>

                    <button
                      onClick={handleDownloadAtsDocx}
                      className={`px-3.5 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md ${
                        qualityAudit.isReadyToSubmit
                          ? 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-500/25 ring-2 ring-teal-400/50'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                      title="Download Workday / Taleo ATS compliant OpenXML (.docx)"
                    >
                      <FileText size={13} /> ATS (.DOCX)
                    </button>

                    <button
                      onClick={handleDownloadCoverLetter}
                      className={`px-3.5 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md ${
                        qualityAudit.isReadyToSubmit
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25 ring-2 ring-indigo-400/50'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      <Download size={13} /> COVER LETTER (PDF)
                    </button>

                    <button
                      onClick={handleAutoSubmit}
                      disabled={isSubmittedSuccess}
                      className={`px-4 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg ${
                        qualityAudit.isReadyToSubmit
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-purple-500/30'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      <Send size={13} /> {isSubmittedSuccess ? 'SUBMITTED' : 'SUBMIT & LOG'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Checklist Breakdown */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>{qualityAudit.checks.length}-Point Pre-Submission Double-Check List</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {qualityAudit.checks.filter(c => c.passed).length} of {qualityAudit.checks.length} Passed
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {qualityAudit.checks.map(chk => (
                    <div 
                      key={chk.id}
                      className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start justify-between gap-3 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          {chk.passed ? (
                            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                          ) : (
                            <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{chk.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800">
                              {chk.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{chk.detail}</p>
                          {chk.missing && chk.missing.length > 0 && (
                            <div className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                              <span>Suggested keywords to incorporate:</span>
                              <span className="font-semibold">{chk.missing.slice(0, 4).join(', ')}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                        chk.passed ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40' : 'bg-amber-950 text-amber-300 border border-amber-800/40'
                      }`}>
                        {chk.passed ? 'PASS' : 'REVIEW'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* RESUME tab */}
          {activeTab === 'resume' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800 gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Tailored Master Resume</span>
                  <span className="text-[10px] text-slate-500 font-mono">({qualityAudit.wordCount.resumeWords} words)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 flex items-center gap-1.5">
                    {saveStatus === 'saving' ? (
                      <span className="text-amber-300 flex items-center gap-1">Saving to PDF…</span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 size={11} /> Saved to PDF</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleManualSave}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer border border-slate-700 transition-colors"
                  >
                    💾 Save Changes
                  </button>
                  <button
                    onClick={handleDownloadResume}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-md transition-all"
                  >
                    <Download size={12} /> Download Updated PDF
                  </button>
                  <button
                    onClick={handleDownloadAtsDocx}
                    className="px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-md transition-all"
                    title="Download ATS OpenXML (.docx) for Workday/Taleo"
                  >
                    <FileText size={12} /> Download .docx
                  </button>
                  <button
                    onClick={() => setActiveTab('quality')}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <ShieldCheck size={13} /> {qualityAudit.overallScore}% Quality Pass
                  </button>
                </div>
              </div>

              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                rows={22}
                placeholder="Paste or write your tailored resume markdown here..."
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed resize-y"
              />
            </div>
          )}

          {/* COVER LETTER tab */}
          {activeTab === 'cover_letter' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800 gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Tailored 3-Paragraph Cover Letter</span>
                  <span className="text-[10px] text-slate-500 font-mono">({qualityAudit.wordCount.coverLetterWords} words)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 flex items-center gap-1.5">
                    {saveStatus === 'saving' ? (
                      <span className="text-amber-300 flex items-center gap-1">Saving to PDF…</span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 size={11} /> Saved to PDF</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleManualSave}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer border border-slate-700 transition-colors"
                  >
                    💾 Save Changes
                  </button>
                  <button
                    onClick={handleDownloadCoverLetter}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-md transition-all"
                  >
                    <Download size={12} /> Download Updated PDF
                  </button>
                  <button
                    onClick={() => setActiveTab('quality')}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <ShieldCheck size={13} /> {qualityAudit.overallScore}% Quality Pass
                  </button>
                </div>
              </div>

              <textarea
                value={coverLetterText}
                onChange={(e) => setCoverLetterText(e.target.value)}
                rows={18}
                placeholder="Paste or write your tailored cover letter here..."
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed resize-y"
              />
            </div>
          )}

          {/* LINKEDIN INBOUND OPTIMIZATION TAB */}
          {activeTab === 'linkedin' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800 gap-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    Boolean Inbound Sourcing Optimization (Phase 5)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Engineered to trigger recruiter Boolean searches (AND, OR, exact title matching) in LinkedIn Recruiter & Sales Navigator.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleManualSave}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer border border-slate-700 transition-colors"
                  >
                    💾 Save Changes
                  </button>
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md self-start sm:self-auto"
                  >
                    {copiedText ? <Check size={12} className="text-emerald-300" /> : <Copy size={12} />}
                    {copiedText ? 'COPIED TO CLIPBOARD' : 'COPY ALL LINKEDIN ASSETS'}
                  </button>
                </div>
              </div>
              <textarea
                value={linkedInText}
                onChange={(e) => setLinkedInText(e.target.value)}
                rows={18}
                placeholder="LinkedIn Boolean Headlines & About Section Recruiter Index..."
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-200 focus:outline-none focus:border-sky-500 leading-relaxed resize-y"
              />
            </div>
          )}

          {/* ATS ANALYSIS tab */}
          {activeTab === 'ats' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Detected Job Keywords</h3>
                <span className={`text-xs font-black ${scoreColor(atsScore)}`}>{atsScore}% Base Fit</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {matchedKeywords.map((kw, idx) => (
                  <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-indigo-300 border border-slate-700">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Direct Online Engine: {selectedModel}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
