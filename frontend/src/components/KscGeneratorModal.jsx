import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  X, Check, Copy, Award, ShieldCheck, FileText, Download, 
  Sparkles, RefreshCw, Send, BookOpen, Layers, CheckCircle2, 
  ChevronDown, ChevronUp, Clock, AlertCircle, Compass
} from 'lucide-react';
import { 
  CAPABILITY_PILLARS,
  getPillarBadgeTheme,
  getWordCount,
  fetchJobKscReport,
  generateCustomKscReport 
} from '../services/kscService';
import { downloadCoverLetterPdf } from '../utils/pdfGenerator';

export const KscGeneratorModal = ({
  job = {},
  onClose,
  userProfile = null,
  onSaveKscToJob = null,
}) => {
  const [activeTab, setActiveTab] = useState('extracted'); // 'extracted' | 'sandbox' | 'framework' | 'master'
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState(null);
  const [expandedCriteria, setExpandedCriteria] = useState({});

  // Sandbox state
  const [customCriteriaText, setCustomCriteriaText] = useState('');
  const [wordLimit, setWordLimit] = useState(300);
  const [isSolvingCustom, setIsSolvingCustom] = useState(false);

  // Load initial report
  const loadKscData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJobKscReport(job, userProfile);
      setReport(data);
      if (data?.solutions && data.solutions.length > 0) {
        // Expand first criterion by default
        setExpandedCriteria({ 1: true });
      }
    } catch (err) {
      console.error('Failed to load KSC report:', err);
    } finally {
      setLoading(false);
    }
  }, [job, userProfile]);

  useEffect(() => {
    loadKscData();
  }, [loadKscData]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleExpand = (idx) => {
    setExpandedCriteria(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const handleSolveCustom = async (e) => {
    e.preventDefault();
    const lines = customCriteriaText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length >= 10);

    if (lines.length === 0) return;

    setIsSolvingCustom(true);
    try {
      const customReport = await generateCustomKscReport(job, userProfile, lines, wordLimit);
      setReport(customReport);
      setActiveTab('extracted');
      setExpandedCriteria({ 1: true });
    } catch (err) {
      console.error('Failed to solve custom criteria:', err);
    } finally {
      setIsSolvingCustom(false);
    }
  };

  const handleExportPdf = () => {
    if (!report?.master_document) return;
    downloadCoverLetterPdf(report.master_document, {
      company: job.company || 'Public_Sector',
      title: `${job.title || 'Role'}_KSC_Statement`,
    });
  };

  const companyName = job?.company || 'Target Employer';
  const roleTitle = job?.title || 'Key Selection Criteria';
  const candidateName = userProfile?.name || report?.candidate_name || 'Candidate';

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ksc-modal-title"
    >
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Gradient */}
        <div className="h-1.5 w-full bg-gradient-to-r from-teal-500 via-indigo-500 to-purple-500 shrink-0" />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
              <Compass size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="ksc-modal-title" className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                  Key Selection Criteria (KSC) Generator
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  APS &amp; VPS STANDARDS
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {roleTitle} • <span className="text-slate-300 font-medium">{companyName}</span> • Applicant: <span className="text-teal-300 font-medium">{candidateName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-slate-800 bg-slate-950/40 flex items-center gap-2 overflow-x-auto text-xs font-mono">
          <button
            onClick={() => setActiveTab('extracted')}
            className={`px-4 py-2.5 rounded-t-xl font-bold transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
              activeTab === 'extracted'
                ? 'bg-slate-900 text-teal-300 border-teal-500 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <CheckCircle2 size={14} className="text-teal-400" />
            <span>EXTRACTED CRITERIA ({report?.solutions?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('sandbox')}
            className={`px-4 py-2.5 rounded-t-xl font-bold transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
              activeTab === 'sandbox'
                ? 'bg-slate-900 text-teal-300 border-teal-500 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Sparkles size={14} className="text-indigo-400" />
            <span>CUSTOM CRITERIA SANDBOX</span>
          </button>

          <button
            onClick={() => setActiveTab('framework')}
            className={`px-4 py-2.5 rounded-t-xl font-bold transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
              activeTab === 'framework'
                ? 'bg-slate-900 text-teal-300 border-teal-500 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Layers size={14} className="text-purple-400" />
            <span>CAPABILITY MATRIX</span>
          </button>

          <button
            onClick={() => setActiveTab('master')}
            className={`px-4 py-2.5 rounded-t-xl font-bold transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
              activeTab === 'master'
                ? 'bg-slate-900 text-teal-300 border-teal-500 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <FileText size={14} className="text-amber-400" />
            <span>MASTER DOCUMENT &amp; EXPORT</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <RefreshCw size={32} className="animate-spin text-teal-400" />
              <p className="text-sm font-mono text-slate-400">Extracting Key Selection Criteria &amp; Mapping Capability Matrix...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: Extracted Criteria & SAO Responses */}
              {activeTab === 'extracted' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-teal-950/20 border border-teal-500/30 flex items-start gap-3">
                    <Award size={20} className="text-teal-400 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <div className="font-bold text-teal-200">Merit-Based Public Sector Assessment Alignment</div>
                      <div className="text-slate-400 leading-relaxed">
                        Each criterion is synthesized using the <span className="text-white font-medium">SAO framework (Situation, Action, Outcome)</span>.
                        Statements front-load measurable results, reference Australian government context, and adhere to strict length limits.
                      </div>
                    </div>
                  </div>

                  {(!report?.solutions || report.solutions.length === 0) ? (
                    <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 space-y-2">
                      <AlertCircle size={28} className="text-slate-500 mx-auto" />
                      <p className="text-sm text-slate-400">No explicit criteria detected in job description.</p>
                      <button
                        onClick={() => setActiveTab('sandbox')}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl cursor-pointer"
                      >
                        Paste Criteria in Sandbox
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {report.solutions.map((sol) => {
                        const isExpanded = !!expandedCriteria[sol.criterion_number];
                        const wordCount = sol.word_count;
                        const targetLimit = sol.target_word_limit;
                        const isWithinLimit = wordCount <= targetLimit + 25;

                        return (
                          <div 
                            key={sol.criterion_number}
                            className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden transition-all shadow-xs"
                          >
                            {/* Card Header */}
                            <div 
                              onClick={() => toggleExpand(sol.criterion_number)}
                              className="p-4 flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-800/40 transition-colors"
                            >
                              <div className="space-y-2 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-mono font-black text-teal-400">
                                    CRITERION {sol.criterion_number}
                                  </span>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                    {sol.capability_name}
                                  </span>
                                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                                    isWithinLimit ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  }`}>
                                    {wordCount} / {targetLimit} words
                                  </span>
                                </div>
                                <h3 className="text-sm font-semibold text-white leading-snug">
                                  {sol.criterion_text}
                                </h3>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopy(sol.full_statement, `crit_${sol.criterion_number}`);
                                  }}
                                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1.5"
                                  title="Copy response to clipboard"
                                >
                                  {copiedKey === `crit_${sol.criterion_number}` ? (
                                    <>
                                      <Check size={14} className="text-emerald-400" />
                                      <span className="text-emerald-400 font-mono text-[10px]">COPIED</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={14} />
                                      <span className="font-mono text-[10px]">COPY</span>
                                    </>
                                  )}
                                </button>
                                <div className="p-1 text-slate-400">
                                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </div>
                              </div>
                            </div>

                            {/* Card Expanded Content */}
                            {isExpanded && (
                              <div className="px-4 pb-4 pt-1 border-t border-slate-800/80 space-y-3 font-sans text-xs">
                                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2">
                                  <div>
                                    <span className="text-indigo-400 font-bold font-mono uppercase tracking-wider block mb-0.5">
                                      Situation / Mandate
                                    </span>
                                    <p className="text-slate-300 leading-relaxed">{sol.situation}</p>
                                  </div>

                                  <div>
                                    <span className="text-teal-400 font-bold font-mono uppercase tracking-wider block mb-0.5">
                                      Action / Methodology
                                    </span>
                                    <p className="text-slate-300 leading-relaxed">{sol.action}</p>
                                  </div>

                                  <div>
                                    <span className="text-emerald-400 font-bold font-mono uppercase tracking-wider block mb-0.5">
                                      Outcome / Measurable Impact
                                    </span>
                                    <p className="text-slate-300 leading-relaxed">{sol.outcome}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Custom Criteria Sandbox */}
              {activeTab === 'sandbox' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 flex items-start gap-3">
                    <Sparkles size={20} className="text-indigo-400 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <div className="font-bold text-indigo-200">Custom Position Description Criteria Solver</div>
                      <div className="text-slate-400 leading-relaxed">
                        Paste the exact selection criteria directly from the government position description (PD) or job ad (one criterion per line).
                        The engine will map each one against public sector standards and synthesize tailored SAO narratives.
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleSolveCustom} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-slate-300 flex items-center justify-between">
                        <span>PASTE CRITERIA (ONE PER LINE)</span>
                        <span className="text-slate-500 font-normal">e.g. "Demonstrated ability to manage complex projects..."</span>
                      </label>
                      <textarea
                        value={customCriteriaText}
                        onChange={(e) => setCustomCriteriaText(e.target.value)}
                        placeholder={`1. Demonstrated experience in leading high-profile capital projects within budget and strict timelines.\n2. Proven capacity to consult and build collaborative relationships with diverse stakeholders.\n3. High-level written communication and executive briefing capabilities.`}
                        rows={6}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-hidden focus:border-teal-500 font-mono leading-relaxed"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-slate-400">Target Word Count Limit:</span>
                        <div className="flex items-center gap-1">
                          {[250, 300, 350, 500].map(limit => (
                            <button
                              key={limit}
                              type="button"
                              onClick={() => setWordLimit(limit)}
                              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                wordLimit === limit
                                  ? 'bg-teal-600 text-white'
                                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {limit}w
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSolvingCustom || !customCriteriaText.trim()}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-600 hover:to-indigo-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all shadow-md"
                      >
                        {isSolvingCustom ? (
                          <>
                            <RefreshCw size={14} className="animate-spin text-white" />
                            <span>SYNTHESIZING SAO STATEMENTS...</span>
                          </>
                        ) : (
                          <>
                            <Send size={14} />
                            <span>GENERATE TAILORED KSC RESPONSES</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 3: Capability Framework Matrix */}
              {activeTab === 'framework' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-start gap-3">
                    <Layers size={20} className="text-purple-400 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <div className="font-bold text-purple-200">APS &amp; VPS Capability Framework Taxonomy</div>
                      <div className="text-slate-400 leading-relaxed">
                        Public sector selection panels score candidate responses against standard capability dimensions.
                        The table below details the behavioral competencies expected for each pillar.
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-sans">
                    {Object.values(CAPABILITY_PILLARS).map(pillar => (
                      <div 
                        key={pillar.key}
                        className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full border ${pillar.badgeClass}`}>
                            {pillar.shortName.toUpperCase()}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-white leading-snug">{pillar.name}</h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">{pillar.description}</p>
                        <div className="pt-1 flex flex-wrap gap-1">
                          {pillar.keywords.slice(0, 6).map(kw => (
                            <span key={kw} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400">
                              #{kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: Master Document & 1-Click Export */}
              {activeTab === 'master' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-mono text-slate-400">
                      COMPLETE COMPILED KSC DOCUMENT ({report?.master_document?.length || 0} characters)
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(report?.master_document, 'master_doc')}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedKey === 'master_doc' ? (
                          <>
                            <Check size={14} className="text-emerald-400" />
                            <span className="text-emerald-400">COPIED</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>COPY ALL MARKDOWN</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleExportPdf}
                        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Download size={14} />
                        <span>EXPORT PDF DOCUMENT</span>
                      </button>
                    </div>
                  </div>

                  <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
                    {report?.master_document || 'No document generated yet.'}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <ShieldCheck size={15} className="text-teal-400" />
            <span>Australian Public Sector Capability Framework Guaranteed</span>
          </div>

          <div className="flex items-center gap-2">
            {onSaveKscToJob && report?.master_document && (
              <button
                onClick={() => {
                  onSaveKscToJob(job.id || `${job.company}_${job.title}`, report.master_document);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-sm"
              >
                SAVE TO JOB DOSSIER
              </button>
            )}

            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
            >
              DONE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
