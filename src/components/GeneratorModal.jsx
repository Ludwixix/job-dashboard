import React, { useState, useCallback, useMemo } from 'react';
import {
  X, Sparkles, FileText, Check, Copy, ExternalLink, FileUser,
  Zap, BarChart3, RefreshCw, AlertCircle, Clock,
  ShieldCheck, CheckCircle2, AlertTriangle, ArrowRight, Wand2
} from 'lucide-react';
import { 
  generateApplicationDocs, extractJobKeywords, calculateAtsScore, 
  runDocumentQualityAudit 
} from '../services/generationService';

const GEMINI_GEM_URL = "https://gemini.google.com/gem/1Bxx-IAsb1aBD0T6rxC6aJB1frzm4Yphz?usp=drive_link";

// ── ATS score colour ───────────────────────────────────────────────────────────
const scoreColor = (s) => {
  if (s >= 85) return 'text-emerald-400';
  if (s >= 70) return 'text-amber-400';
  return 'text-rose-400';
};
const scoreBarColor = (s) => {
  if (s >= 85) return 'bg-emerald-500';
  if (s >= 70) return 'bg-amber-500';
  return 'bg-rose-500';
};

// ── Gemini Gem prompt ──────────────────────────────────────────────────────────
const buildGemPrompt = (job) => `TARGET JOB — Read this first, apply to every word you write:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Melbourne, VIC'}
Salary: ${job.salary || 'Not stated'}
Description / Requirements:
${job.notes || job.description || '(No job description provided — infer from title and company.)'}

CANDIDATE: Sam Ludwig
Contact: 0405 993 245 | sam.ludwig@gmail.com | Melbourne VIC 3183
LinkedIn: linkedin.com/in/sam-ludwig
Australian Citizen — Unrestricted Work Rights | Clearance Eligible: Baseline / NV1

KEY INSTRUCTIONS (apply all of these):
1. MIRROR THE JOB TITLE EXACTLY as a professional title on line 2 of the resume — this is the single highest-impact ATS tactic
2. RESULT-FIRST BULLETS: start every bullet with the metric/outcome, then the action — e.g. "Reduced processing time 87% (2hr→15min) by engineering PowerShell automation" NOT "Engineered automation that reduced time by 87%"
3. ATS KEYWORDS: extract exact technical terms from the job description above and weave them naturally into the summary, skills, AND experience bullets — not just a list at the bottom
4. NO CLICHÉS: never use "passionate", "team player", "results-driven", "go-getter", "synergy", "proactive"
5. COVER LETTER OPENER: must NOT start with "I am writing to apply" — open with a specific, compelling hook referencing the company or role
6. COVER LETTER: 3 paragraphs, 250-350 words total, Australian English, no address block, no sign-off
7. USE ONLY VERIFIED FACTS from Sam's career — never invent achievements, dates, or metrics

Now generate: (1) a tailored resume, then the separator ===COVER_LETTER===, then (2) a tailored cover letter.`;

// ── PDF print utility ──────────────────────────────────────────────────────────
const printDoc = (content, filename) => {
  const win = window.open('', '_blank');
  if (!win) return;
  const html = content
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^\*\*(.+)\*\*$/gm, '<strong>$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>');

  win.document.write(`<!DOCTYPE html><html><head><title>${filename}</title><style>
    @page { margin: 18mm 16mm; }
    body { font-family: Arial, Calibri, sans-serif; font-size: 10.5pt; color: #1a1a1a; line-height: 1.45; max-width: 720px; margin: 0 auto; }
    h1 { font-size: 20pt; font-weight: 800; margin: 0 0 2px; letter-spacing: -0.3px; }
    h2 { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1.5px solid #1a1a1a; margin: 14px 0 5px; padding-bottom: 2px; }
    h3 { font-size: 10.5pt; font-weight: 700; margin: 8px 0 1px; }
    li { margin: 1px 0 1px 14px; }
    p { margin: 4px 0; }
    strong { font-weight: 700; }
  </style></head><body><p>${html}</p>
  <script>window.onload=function(){window.print()}</script></body></html>`);
  win.document.close();
};

// ── Main component ─────────────────────────────────────────────────────────────
export const GeneratorModal = ({ job, onClose }) => {
  const [activeTab, setActiveTab]             = useState('overview');
  const [resumeText, setResumeText]           = useState('');
  const [coverLetterText, setCoverLetterText] = useState('');
  const [isGenerating, setIsGenerating]       = useState(false);
  const [genProgress, setGenProgress]         = useState('');
  const [genError, setGenError]               = useState('');
  const [genMeta, setGenMeta]                 = useState(null);
  const [copiedPrompt, setCopiedPrompt]       = useState(false);
  const [copiedText, setCopiedText]           = useState(false);

  // Pre-compute ATS analysis from job description
  const jobDescription = job.notes || job.description || '';
  const matchedKeywords = extractJobKeywords(jobDescription);
  const atsScore = calculateAtsScore(jobDescription);

  // Live adversarial quality audit calculation
  const qualityAudit = useMemo(() => {
    return runDocumentQualityAudit(job, resumeText, coverLetterText);
  }, [job, resumeText, coverLetterText]);

  // ── AI Generation ──────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async (docType = 'both') => {
    setIsGenerating(true);
    setGenError('');
    setGenProgress('Connecting to AI engine…');

    try {
      const result = await generateApplicationDocs(job, setGenProgress);

      if (!result) {
        setGenError('Unable to connect to generation engine.');
        setGenProgress('');
        setIsGenerating(false);
        return;
      }

      if (result.error && result.error !== 'NO_API_KEY') {
        throw new Error(result.error);
      }

      setResumeText(result.resume || '');
      setCoverLetterText(result.coverLetter || '');
      setGenMeta({ model: result.model, elapsedMs: result.elapsedMs });
      setGenProgress('');
      setActiveTab('quality'); // Directly show the Quality Audit scorecard upon generation!

    } catch (err) {
      setGenError(err.message || 'Generation failed. Please try again.');
      setGenProgress('');
    } finally {
      setIsGenerating(false);
    }
  }, [job]);

  // ── Gemini Gem ─────────────────────────────────────────────────────────────
  const handleLaunchGem = () => {
    const prompt = buildGemPrompt(job);
    navigator.clipboard.writeText(prompt).catch(() => {});
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 4000);
    window.open(GEMINI_GEM_URL, '_blank');
  };

  // ── Copy / Download ────────────────────────────────────────────────────────
  const handleCopy = () => {
    const text = activeTab === 'resume' ? resumeText : coverLetterText;
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  const handleDownload = () => {
    const text     = activeTab === 'resume' ? resumeText : coverLetterText;
    const docLabel = activeTab === 'resume' ? 'RESUME' : 'COVER_LETTER';
    if (!text) return;
    const name = `Sam_Ludwig_${job.company.replace(/[^a-zA-Z0-9]/g, '_')}_${docLabel}`;
    printDoc(text, name);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-700/60 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="relative bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400" />
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/15 border border-indigo-400/30 rounded-xl">
              <Sparkles size={18} className="text-indigo-400" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Application Studio & Quality Gate</div>
              <h2 className="text-base font-black text-white leading-tight">{job.company}</h2>
              <p className="text-xs text-slate-400 font-medium">{job.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Live Quality Gate Score */}
            <div className="hidden sm:flex flex-col items-end">
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
              (resumeText || coverLetterText) && { 
                id: 'quality', 
                label: 'DOUBLE-CHECK GATE', 
                icon: <ShieldCheck size={13} className={qualityAudit.isReadyToSubmit ? 'text-emerald-400' : 'text-amber-400'} /> 
              },
              resumeText     && { id: 'resume',       label: 'RESUME',       icon: <FileUser size={13} className="text-emerald-400" /> },
              coverLetterText && { id: 'cover_letter', label: 'COVER LETTER', icon: <FileText size={13} className="text-indigo-400" /> },
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

          {(activeTab === 'resume' || activeTab === 'cover_letter') && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleCopy}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer border border-slate-700"
              >
                {copiedText ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                {copiedText ? 'COPIED' : 'COPY'}
              </button>
              <button
                onClick={handleDownload}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
              >
                PRINT / PDF
              </button>
            </div>
          )}
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
                <div className="p-4 bg-indigo-950/40 border border-indigo-800/40 rounded-xl text-indigo-300 text-xs flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <div>
                    <div className="font-bold text-indigo-200">Synthesizing Tailored Documents…</div>
                    <div className="text-indigo-400 mt-0.5">{genProgress}</div>
                  </div>
                </div>
              )}

              {genMeta && !isGenerating && (
                <div className="flex items-center gap-2 text-[11px] text-slate-500 px-1">
                  <Clock size={12} />
                  <span>Synthesized via {genMeta.model} in {(genMeta.elapsedMs / 1000).toFixed(1)}s</span>
                </div>
              )}

              {/* Action cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-emerald-600/50 transition-all flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-[11px] uppercase tracking-wider mb-2">
                      <FileUser size={14} /> Tailored ATS Resume
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Mirrors exact role title ("{job.title}"), extracts detected keywords, and leads with quantified outcomes (660,000+ users, 99.9% uptime, 87% automation).
                    </p>
                  </div>
                  <button
                    onClick={() => handleGenerate('resume')}
                    disabled={isGenerating}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
                  >
                    <Zap size={13} /> {isGenerating ? 'SYNTHESIZING…' : 'GENERATE TAILORED RESUME'}
                  </button>
                </div>

                <div className="p-5 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-indigo-600/50 transition-all flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-indigo-400 font-bold text-[11px] uppercase tracking-wider mb-2">
                      <FileText size={14} /> 3-Paragraph Cover Letter
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      250–350 word cover letter opening with a specific hook for {job.company}, 2 verified achievements, Australian English, and a confident CTA.
                    </p>
                  </div>
                  <button
                    onClick={() => handleGenerate('cover')}
                    disabled={isGenerating}
                    className="w-full py-2.5 px-3 rounded-xl bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
                  >
                    <Zap size={13} /> {isGenerating ? 'SYNTHESIZING…' : 'GENERATE COVER LETTER'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* QUALITY AUDIT DOUBLE-CHECK GATE TAB */}
          {activeTab === 'quality' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              {/* Quality Header Banner */}
              <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                qualityAudit.isReadyToSubmit 
                  ? 'bg-emerald-950/40 border-emerald-500/40' 
                  : 'bg-amber-950/40 border-amber-500/40'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${
                    qualityAudit.isReadyToSubmit ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">
                        {qualityAudit.isReadyToSubmit ? 'GUARANTEED QUALITY PASS' : 'QUALITY AUDIT IN PROGRESS'}
                      </h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        qualityAudit.isReadyToSubmit ? 'bg-emerald-900/80 text-emerald-300' : 'bg-amber-900/80 text-amber-300'
                      }`}>
                        {qualityAudit.overallScore}% Score
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {qualityAudit.isReadyToSubmit 
                        ? 'This application package satisfies all 7 ATS checks, verified metric standards, and employer tone criteria.' 
                        : 'Review the checks below to ensure maximum interview conversion before submitting.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setActiveTab('resume')}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                  >
                    View Resume <ArrowRight size={13} />
                  </button>
                  <button
                    onClick={() => setActiveTab('cover_letter')}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    View Cover Letter <ArrowRight size={13} />
                  </button>
                </div>
              </div>

              {/* Checklist Breakdown */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  7-Point Pre-Submission Double-Check List
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {qualityAudit.checks.map(chk => (
                    <div 
                      key={chk.id}
                      className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start justify-between gap-3"
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
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Tailored Master Resume</span>
                  <span className="text-[10px] text-slate-500 font-mono">({qualityAudit.wordCount.resumeWords} words)</span>
                </div>
                <button
                  onClick={() => setActiveTab('quality')}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ShieldCheck size={13} /> {qualityAudit.overallScore}% Quality Pass
                </button>
              </div>

              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                rows={22}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed resize-y"
              />
            </div>
          )}

          {/* COVER LETTER tab */}
          {activeTab === 'cover_letter' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Tailored 3-Paragraph Cover Letter</span>
                  <span className="text-[10px] text-slate-500 font-mono">({qualityAudit.wordCount.coverLetterWords} words)</span>
                </div>
                <button
                  onClick={() => setActiveTab('quality')}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ShieldCheck size={13} /> {qualityAudit.overallScore}% Quality Pass
                </button>
              </div>

              <textarea
                value={coverLetterText}
                onChange={(e) => setCoverLetterText(e.target.value)}
                rows={18}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed resize-y"
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
            <span>Adversarial Quality Verification Active</span>
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
