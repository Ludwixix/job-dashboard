import React, { useState, useCallback } from 'react';
import {
  X, Sparkles, FileText, Check, Copy, ExternalLink, FileUser,
  Download, Zap, ShieldAlert, BarChart3, RefreshCw, AlertCircle, Clock
} from 'lucide-react';
import { generateApplicationDocs, extractJobKeywords, calculateAtsScore } from '../services/generationService';

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
  // Convert markdown-style headers to HTML for clean print
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
  const [activeTab, setActiveTab]           = useState('overview');
  const [resumeText, setResumeText]         = useState('');
  const [coverLetterText, setCoverLetterText] = useState('');
  const [isGenerating, setIsGenerating]     = useState(false);
  const [genProgress, setGenProgress]       = useState('');
  const [genError, setGenError]             = useState('');
  const [genMeta, setGenMeta]               = useState(null);   // { model, elapsedMs }
  const [copiedPrompt, setCopiedPrompt]     = useState(false);
  const [copiedText, setCopiedText]         = useState(false);

  // Pre-compute ATS analysis from job description
  const jobDescription = job.notes || job.description || '';
  const matchedKeywords = extractJobKeywords(jobDescription);
  const atsScore = calculateAtsScore(jobDescription);

  // ── AI Generation ──────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async (docType = 'both') => {
    setIsGenerating(true);
    setGenError('');
    setGenProgress('Connecting to AI engine…');

    try {
      const progressSteps = [
        'Analysing job requirements…',
        'Extracting ATS keywords…',
        'Tailoring professional summary…',
        'Crafting experience bullets…',
        'Writing cover letter…',
        'Finalising output…',
      ];
      let stepIdx = 0;
      const progressTimer = setInterval(() => {
        stepIdx = Math.min(stepIdx + 1, progressSteps.length - 1);
        setGenProgress(progressSteps[stepIdx]);
      }, 4500);

      const result = await generateApplicationDocs(job, setGenProgress);

      clearInterval(progressTimer);

      if (!result) {
        // Static host — no API available
        setGenError('AI generation requires the local dev server. Use the Gemini Gem button to generate on this device, or run the dashboard locally with "npm run dev".');
        setGenProgress('');
        setIsGenerating(false);
        return;
      }

      if (result.error === 'NO_API_KEY') {
        setGenError('OpenRouter API key not configured. Use the Gemini Gem button to generate via your custom Gem.');
        setGenProgress('');
        setIsGenerating(false);
        return;
      }

      if (result.error) throw new Error(result.error);

      setResumeText(result.resume || '');
      setCoverLetterText(result.coverLetter || '');
      setGenMeta({ model: result.model, elapsedMs: result.elapsedMs });
      setGenProgress('');
      setActiveTab(docType === 'cover' ? 'cover_letter' : 'resume');

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
    const text    = activeTab === 'resume' ? resumeText : coverLetterText;
    const docLabel = activeTab === 'resume' ? 'RESUME' : 'COVER_LETTER';
    if (!text) return;
    const name = `Sam_Ludwig_${job.company.replace(/[^a-zA-Z0-9]/g, '_')}_${docLabel}`;
    printDoc(text, name);
  };

  const hasOutput = resumeText || coverLetterText;

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
              <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Application Studio</div>
              <h2 className="text-base font-black text-white leading-tight">{job.company}</h2>
              <p className="text-xs text-slate-400 font-medium">{job.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* ATS Score badge */}
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">ATS Match</span>
              <span className={`text-lg font-black ${scoreColor(atsScore)}`}>{atsScore}%</span>
            </div>
            <button onClick={onClose} className="p-2 text-slate-500 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Gemini Gem Banner ── */}
        <div className="bg-gradient-to-r from-indigo-950/80 to-purple-950/80 px-5 py-3 border-b border-indigo-900/50 flex items-center justify-between gap-3 shrink-0">
          <div>
            <div className="text-[10px] font-black text-amber-400 uppercase tracking-wider">💎 Gemini Gem — Full Career Bio Tailoring</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Copies full job context + career record to clipboard, opens your custom Gem</p>
          </div>
          <button
            onClick={handleLaunchGem}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            {copiedPrompt ? <Check size={13} className="text-emerald-300" /> : <ExternalLink size={13} />}
            {copiedPrompt ? 'PROMPT COPIED — OPENING GEM…' : 'LAUNCH GEM'}
          </button>
        </div>

        {/* ── Tab bar ── */}
        <div className="bg-slate-900 border-b border-slate-800 px-5 py-2 flex items-center gap-1 shrink-0">
          {[
            { id: 'overview',      label: 'GENERATE',     icon: <Zap size={13} /> },
            resumeText     && { id: 'resume',       label: 'RESUME',       icon: <FileUser size={13} className="text-emerald-400" /> },
            coverLetterText && { id: 'cover_letter', label: 'COVER LETTER', icon: <FileText size={13} className="text-indigo-400" /> },
            matchedKeywords.length && { id: 'ats', label: 'ATS ANALYSIS',  icon: <BarChart3 size={13} className="text-amber-400" /> },
          ].filter(Boolean).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === tab.id ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* GENERATE tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Error / Status */}
              {genError && (
                <div className="flex items-start gap-3 p-4 bg-rose-950/40 border border-rose-800/50 rounded-xl text-rose-300 text-xs">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{genError}</span>
                </div>
              )}

              {/* Generation progress */}
              {isGenerating && (
                <div className="p-4 bg-indigo-950/40 border border-indigo-800/40 rounded-xl text-indigo-300 text-xs flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <div>
                    <div className="font-bold text-indigo-200">AI Generating…</div>
                    <div className="text-indigo-400 mt-0.5">{genProgress}</div>
                  </div>
                </div>
              )}

              {/* Gen meta */}
              {genMeta && !isGenerating && (
                <div className="flex items-center gap-2 text-[11px] text-slate-500 px-1">
                  <Clock size={12} />
                  <span>Generated in {(genMeta.elapsedMs / 1000).toFixed(1)}s via {genMeta.model}</span>
                </div>
              )}

              {/* Action cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Resume card */}
                <div className="p-5 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-emerald-600/50 transition-all flex flex-col gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-[11px] uppercase tracking-wider mb-2">
                      <FileUser size={14} /> Tailored Resume
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      AI-generated, ATS-optimised resume tailored to this exact listing. Mirrors the job title,
                      extracts and weaves in job ad keywords, uses result-first bullets with real metrics.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleGenerate('resume')}
                      disabled={isGenerating}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Zap size={13} /> {isGenerating ? 'GENERATING…' : 'GENERATE RESUME'}
                    </button>
                    {resumeText && (
                      <button onClick={() => handleGenerate('resume')} disabled={isGenerating} className="p-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors cursor-pointer" title="Regenerate">
                        <RefreshCw size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Cover letter card */}
                <div className="p-5 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-indigo-600/50 transition-all flex flex-col gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-indigo-400 font-bold text-[11px] uppercase tracking-wider mb-2">
                      <FileText size={14} /> Cover Letter
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      250–350 word cover letter with a specific hook (not "I am writing to…"), one achievement
                      with a real number, and a confident CTA. Mirrors the company's tone.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleGenerate('cover')}
                      disabled={isGenerating}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Zap size={13} /> {isGenerating ? 'GENERATING…' : 'GENERATE COVER LETTER'}
                    </button>
                    {coverLetterText && (
                      <button onClick={() => handleGenerate('cover')} disabled={isGenerating} className="p-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors cursor-pointer" title="Regenerate">
                        <RefreshCw size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Generate both */}
              {!hasOutput && !isGenerating && (
                <button
                  onClick={() => handleGenerate('both')}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-700 to-purple-700 hover:from-indigo-600 hover:to-purple-600 text-white font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Sparkles size={14} /> GENERATE BOTH (RESUME + COVER LETTER)
                </button>
              )}

              {/* Info notice */}
              <div className="flex items-start gap-3 p-3 bg-slate-800/40 border border-slate-700/30 rounded-xl text-[11px] text-slate-500">
                <ShieldAlert size={14} className="shrink-0 mt-0.5 text-amber-500" />
                <span>AI generation calls OpenRouter (local dev server only). Only verified career facts are used — no invented achievements. For GitHub Pages, use the Gemini Gem button above.</span>
              </div>
            </div>
          )}

          {/* RESUME / COVER LETTER tab */}
          {(activeTab === 'resume' || activeTab === 'cover_letter') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {activeTab === 'resume'
                    ? <><FileUser size={14} className="text-emerald-400" /> Resume for {job.company}</>
                    : <><FileText size={14} className="text-indigo-400" /> Cover Letter for {job.company}</>
                  }
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    {copiedText ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    {copiedText ? 'COPIED' : 'COPY'}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    <Download size={12} /> PRINT / PDF
                  </button>
                  <button
                    onClick={() => handleGenerate(activeTab === 'resume' ? 'resume' : 'cover')}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-40"
                    title="Regenerate"
                  >
                    <RefreshCw size={12} className={isGenerating ? 'animate-spin' : ''} /> REGEN
                  </button>
                </div>
              </div>

              <textarea
                rows={22}
                className="w-full p-4 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 font-mono text-[11px] leading-relaxed focus:outline-none focus:border-indigo-600 resize-none"
                value={activeTab === 'resume' ? resumeText : coverLetterText}
                onChange={(e) => activeTab === 'resume' ? setResumeText(e.target.value) : setCoverLetterText(e.target.value)}
                placeholder={`Generated ${activeTab === 'resume' ? 'resume' : 'cover letter'} will appear here…`}
              />

              {/* Word count */}
              <div className="text-[11px] text-slate-600 text-right">
                {(activeTab === 'resume' ? resumeText : coverLetterText).split(/\s+/).filter(Boolean).length} words
              </div>
            </div>
          )}

          {/* ATS ANALYSIS tab */}
          {activeTab === 'ats' && (
            <div className="space-y-5">
              {/* Score */}
              <div className="flex items-center gap-5 p-4 bg-slate-800/60 border border-slate-700/50 rounded-xl">
                <div className="text-center shrink-0">
                  <div className={`text-4xl font-black ${scoreColor(atsScore)}`}>{atsScore}%</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">ATS Match</div>
                </div>
                <div className="flex-1">
                  <div className="w-full bg-slate-700 rounded-full h-2 mb-3">
                    <div className={`${scoreBarColor(atsScore)} h-2 rounded-full transition-all`} style={{ width: `${atsScore}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Based on keyword overlap between this listing and Sam Ludwig's career record.
                    Higher scores indicate stronger keyword alignment — the generated resume will
                    weave these terms naturally throughout to maximise ATS pass rate.
                  </p>
                </div>
              </div>

              {/* Matched keywords */}
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Check size={13} className="text-emerald-400" /> Detected Keywords ({matchedKeywords.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {matchedKeywords.map(kw => (
                    <span key={kw} className="px-2.5 py-1 bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 text-[11px] font-medium rounded-lg">
                      {kw}
                    </span>
                  ))}
                  {matchedKeywords.length === 0 && (
                    <span className="text-xs text-slate-500">No specific technical keywords detected in this listing.</span>
                  )}
                </div>
              </div>

              {/* Tactics applied */}
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Evidence-Based Tactics Applied in Generation
                </div>
                <div className="space-y-2">
                  {[
                    ['Mirror exact job title', 'Resume line 2 matches the job ad title exactly — single highest-impact ATS tactic'],
                    ['Result-first bullets', 'Every experience bullet leads with metric/outcome, then action — scannable in 7 seconds'],
                    ['Keyword weaving', 'Detected terms appear in summary, skills, AND experience bullets (not just a bottom list)'],
                    ['Quantified achievements only', '87% reduction, 660k users, 99.9% uptime — every number is verified from career record'],
                    ['Specific cover letter opener', 'Hook references something real from this listing — not "I am writing to apply for..."'],
                    ['3-paragraph cover structure', 'Hook → Value fit → CTA | 250–350 words optimal per hiring manager research'],
                    ['Australian English', 'organisation, standardised, prioritise, analyse throughout'],
                    ['Zero clichés', 'No "passionate", "team player", "results-driven", "synergy" or similar filler'],
                  ].map(([tactic, detail]) => (
                    <div key={tactic} className="flex items-start gap-3 p-3 bg-slate-800/40 rounded-lg">
                      <Check size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[11px] font-bold text-slate-200">{tactic}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="bg-slate-950 px-5 py-3 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-600 font-mono uppercase">
            {job.company} — {job.title}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white font-bold text-xs transition-colors cursor-pointer">
              CLOSE
            </button>
            {hasOutput && (
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                <Download size={13} /> DOWNLOAD PDF
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
