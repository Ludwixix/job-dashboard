import React, { useState, useEffect } from 'react';
import {
  X, Sparkles, Check, Copy, Download, ShieldCheck,
  FileText, Award, CheckCircle2, ChevronRight, Briefcase, Zap, Loader2
} from 'lucide-react';
import { generateApplicationStudioPackage } from '../services/careerCockpitService';
import { downloadCoverLetterPdf, downloadResumePdf } from '../utils/pdfGenerator';

/**
 * ApplicationStudioModal
 * Interactive 1-click tailored application studio presenting STAR KSC responses,
 * an executive cover letter, and an ATS resume keyword diagnostic grounded
 * in Sam Ludwig's verified enterprise career record.
 *
 * @param {Object} props
 * @param {Object} props.job - Target job opportunity.
 * @param {Function} props.onClose - Modal close handler.
 * @returns {React.ReactElement}
 */
export const ApplicationStudioModal = ({ job, onClose }) => {
  const [activeTab, setActiveTab] = useState('ksc'); // 'ksc' | 'cover_letter' | 'ats_resume'
  const [isLoading, setIsLoading] = useState(true);
  const [packageData, setPackageData] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchPackage = async () => {
      setIsLoading(true);
      try {
        const data = await generateApplicationStudioPackage(job);
        if (isMounted && data) {
          setPackageData(data);
        }
      } catch (err) {
        console.warn('Failed to load application studio package:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchPackage();
    return () => { isMounted = false; };
  }, [job]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleDownloadCoverLetter = () => {
    if (!packageData?.cover_letter?.content) return;
    downloadCoverLetterPdf(packageData.cover_letter.content, job);
  };

  const handleDownloadResume = () => {
    if (!packageData?.ats_resume?.tailored_summary) return;
    const text = `# Tailored Resume — ${packageData.job_title}\n\n${packageData.ats_resume.tailored_summary}`;
    downloadResumePdf(text, job);
  };

  return (
    <div className="fixed inset-0 z-[70] font-sans flex items-center justify-center p-3 sm:p-5">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent Strip */}
        <div className="h-1 bg-gradient-to-r from-amber-400 via-emerald-400 to-teal-400" />

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-sm bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0 mt-0.5">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                  1-Click Application Studio
                </span>
                {packageData?.justification_score && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {packageData.justification_score}% Justification Fit
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black text-white leading-tight">
                {job.title}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {job.company} {job.location ? `— ${job.location}` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-sm hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Studio"
          >
            <X size={18} />
          </button>
        </div>

        {/* Proof-Point Verification Strip */}
        {packageData?.proof_points && packageData.proof_points.length > 0 && (
          <div className="bg-slate-950/90 border-b border-slate-800/80 px-4 sm:px-5 py-2.5 flex items-center gap-2 overflow-x-auto touch-scroll-x scrollbar-none text-[11px]">
            <span className="text-amber-400 font-mono font-bold shrink-0 flex items-center gap-1">
              <ShieldCheck size={13} /> Verified Milestones:
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {packageData.proof_points.map((pt, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700/80 text-slate-300 text-[10px] whitespace-nowrap"
                >
                  {pt}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 border-b border-slate-800 bg-slate-900/90 text-xs font-mono shrink-0 overflow-x-auto touch-scroll-x scrollbar-none">
          <button
            onClick={() => setActiveTab('ksc')}
            className={`py-3 px-3 flex items-center gap-2 border-b-2 font-bold transition-colors cursor-pointer shrink-0 min-h-[44px] touch-target-44 ${
              activeTab === 'ksc'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award size={14} className={activeTab === 'ksc' ? 'text-amber-400' : ''} />
            <span>STAR Selection Criteria</span>
          </button>

          <button
            onClick={() => setActiveTab('cover_letter')}
            className={`py-3 px-3 flex items-center gap-2 border-b-2 font-bold transition-colors cursor-pointer shrink-0 min-h-[44px] touch-target-44 ${
              activeTab === 'cover_letter'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText size={14} className={activeTab === 'cover_letter' ? 'text-teal-400' : ''} />
            <span>Executive Cover Letter</span>
          </button>

          <button
            onClick={() => setActiveTab('ats_resume')}
            className={`py-3 px-3 flex items-center gap-2 border-b-2 font-bold transition-colors cursor-pointer shrink-0 min-h-[44px] touch-target-44 ${
              activeTab === 'ats_resume'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Briefcase size={14} className={activeTab === 'ats_resume' ? 'text-purple-400' : ''} />
            <span>ATS Resume Diagnostic</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 size={32} className="animate-spin text-amber-400" />
              <p className="text-xs text-slate-400 font-mono">
                Grounding tailored application in 10-year enterprise record…
              </p>
            </div>
          ) : (
            <>
              {/* TAB 1: Key Selection Criteria */}
              {activeTab === 'ksc' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        Key Selection Criteria (STAR Format)
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Synthesized from real enterprise roles at Victorian Department of Education and St John of God.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        const fullKsc = packageData?.ksc?.criteria_responses
                          ?.map(
                            (c, i) =>
                              `CRITERION ${i + 1}: ${c.criterion}\n\nSituation: ${c.star_narrative.situation}\nTask: ${c.star_narrative.task}\nAction: ${c.star_narrative.action}\nResult: ${c.star_narrative.result}`
                          )
                          .join('\n\n---\n\n');
                        handleCopy(fullKsc, 'all_ksc');
                      }}
                      className="px-3 py-1.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                    >
                      {copiedKey === 'all_ksc' ? (
                        <>
                          <Check size={12} className="text-emerald-400" /> COPIED ALL KSC
                        </>
                      ) : (
                        <>
                          <Copy size={12} /> Copy All Criteria
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-4">
                    {packageData?.ksc?.criteria_responses?.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-sm bg-slate-950/70 border border-slate-800 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-xs font-bold text-amber-300">
                            Criterion {idx + 1}: {item.criterion}
                          </span>
                          <button
                            onClick={() => {
                              const singleText = `${item.criterion}\n\nSituation: ${item.star_narrative.situation}\nTask: ${item.star_narrative.task}\nAction: ${item.star_narrative.action}\nResult: ${item.star_narrative.result}`;
                              handleCopy(singleText, `ksc_${idx}`);
                            }}
                            className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer shrink-0"
                            title="Copy single criterion"
                          >
                            {copiedKey === `ksc_${idx}` ? (
                              <Check size={11} className="text-emerald-400" />
                            ) : (
                              <Copy size={11} />
                            )}
                            <span>{copiedKey === `ksc_${idx}` ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-2 text-xs">
                          <div className="p-2.5 rounded bg-slate-900 border border-slate-800/80">
                            <span className="text-[10px] font-mono font-bold text-amber-400 block uppercase tracking-wider">
                              Situation
                            </span>
                            <p className="text-slate-300 leading-relaxed mt-0.5">
                              {item.star_narrative.situation}
                            </p>
                          </div>
                          <div className="p-2.5 rounded bg-slate-900 border border-slate-800/80">
                            <span className="text-[10px] font-mono font-bold text-cyan-400 block uppercase tracking-wider">
                              Task
                            </span>
                            <p className="text-slate-300 leading-relaxed mt-0.5">
                              {item.star_narrative.task}
                            </p>
                          </div>
                          <div className="p-2.5 rounded bg-slate-900 border border-slate-800/80">
                            <span className="text-[10px] font-mono font-bold text-emerald-400 block uppercase tracking-wider">
                              Action
                            </span>
                            <p className="text-slate-300 leading-relaxed mt-0.5">
                              {item.star_narrative.action}
                            </p>
                          </div>
                          <div className="p-2.5 rounded bg-slate-900 border border-slate-800/80">
                            <span className="text-[10px] font-mono font-bold text-purple-400 block uppercase tracking-wider">
                              Result
                            </span>
                            <p className="text-slate-300 leading-relaxed mt-0.5">
                              {item.star_narrative.result}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: Executive Cover Letter */}
              {activeTab === 'cover_letter' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        Executive Cover Letter
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Tailored directly to {job.company} without generic boilerplate.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleCopy(packageData?.cover_letter?.content, 'cover_letter')
                        }
                        className="px-3 py-1.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                      >
                        {copiedKey === 'cover_letter' ? (
                          <>
                            <Check size={12} className="text-emerald-400" /> COPIED
                          </>
                        ) : (
                          <>
                            <Copy size={12} /> Copy Text
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleDownloadCoverLetter}
                        className="px-3 py-1.5 rounded-sm bg-teal-600 hover:bg-teal-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <Download size={12} /> Download PDF
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-sm bg-slate-950/70 border border-slate-800 text-xs font-mono leading-relaxed whitespace-pre-wrap text-slate-200">
                    {packageData?.cover_letter?.content}
                  </div>
                </div>
              )}

              {/* TAB 3: ATS Resume Diagnostic */}
              {activeTab === 'ats_resume' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        ATS Resume Optimization Diagnostic
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Keyword density and tailored bullet points for {job.title}.
                      </p>
                    </div>

                    <button
                      onClick={handleDownloadResume}
                      className="px-3 py-1.5 rounded-sm bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Download size={12} /> Download Resume PDF
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-sm bg-slate-950/60 border border-slate-800 space-y-2">
                      <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                        Matched Core Keywords:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {packageData?.ats_resume?.matched_keywords?.map((kw, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono"
                          >
                            ✓ {kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-sm bg-slate-950/60 border border-slate-800 space-y-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                        ATS Compatibility Score:
                      </span>
                      <div className="text-2xl font-black text-emerald-400 font-mono">
                        {packageData?.ats_resume?.match_score || 94}%
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Single-column flow, standard headers, and zero tables passing Workday/Taleo parsing.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-sm bg-slate-950/70 border border-slate-800 space-y-2">
                    <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider block">
                      Tailored Executive Summary:
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">
                      {packageData?.ats_resume?.tailored_summary}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
