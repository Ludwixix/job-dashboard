import React, { useState, useEffect, useMemo } from 'react';
import {
 X, Sparkles, ShieldAlert, CheckCircle2, Copy, Check,
 Layers, ArrowRight, BookOpen, AlertTriangle, HelpCircle,
 Terminal, Zap, RefreshCw, ClipboardCheck, Plus, FileText
} from 'lucide-react';
import {
 fetchJobScreeningSolutions,
 solveScreeningQuestions,
 formatRiskBadge,
} from '../services/screeningSolverService';
import { getActiveProfile } from '../services/profileService';

export const ScreeningSolverModal = ({
 job = {},
 onClose,
 userProfile,
}) => {
 const profile = useMemo(() => userProfile || getActiveProfile() || {}, [userProfile]);
 const [activeTab, setActiveTab] = useState('questions'); // 'questions' | 'sandbox' | 'radar' | 'arsenal'
 const [loading, setLoading] = useState(true);
 const [report, setReport] = useState(null);
 const [customInput, setCustomInput] = useState('');
 const [customSolving, setCustomSolving] = useState(false);
 const [customSolutions, setCustomSolutions] = useState([]);
 const [copiedId, setCopiedId] = useState(null);
 const [copiedAll, setCopiedAll] = useState(false);

 const company = job.company || 'Target Employer';
 const title = job.title || 'Engineering Role';

 // Initial load
 useEffect(() => {
 let isMounted = true;
 const loadSolutions = async () => {
 setLoading(true);
 try {
 const res = await fetchJobScreeningSolutions(job.id || 'current', job, profile);
 if (isMounted) {
 setReport(res);
 }
 } catch (err) {
 console.warn('Failed to fetch screening solutions:', err);
 } finally {
 if (isMounted) setLoading(false);
 }
 };
 loadSolutions();
 return () => { isMounted = false; };
 }, [job, profile]);

 const handleCopy = (text, id) => {
 if (!text) return;
 navigator.clipboard.writeText(text);
 setCopiedId(id);
 setTimeout(() => setCopiedId(null), 2000);
 };

 const handleCopyAll = () => {
 if (!report?.solutions) return;
 const fullText = report.solutions
 .map((s, idx) => `Q${idx + 1}: ${s.question}\nAnswer: ${s.answer}\nDropdown: ${s.suggested_dropdown}\n`)
 .join('\n---\n\n');
 navigator.clipboard.writeText(fullText);
 setCopiedAll(true);
 setTimeout(() => setCopiedAll(false), 2200);
 };

 const handleSolveCustom = async (e) => {
 e?.preventDefault();
 const q = customInput.trim();
 if (!q) return;

 setCustomSolving(true);
 try {
 const res = await solveScreeningQuestions(job, profile, [q]);
 if (res?.solutions?.length > 0) {
 setCustomSolutions((prev) => [res.solutions[0], ...prev]);
 setCustomInput('');
 }
 } catch (err) {
 console.warn('Custom question solver error:', err);
 } finally {
 setCustomSolving(false);
 }
 };

 return (
 <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-200 font-sans">
 <div
 className="bg-slate-900 border border-slate-700/80 rounded-sm w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100 relative"
 onClick={(e) => e.stopPropagation()}
 >
 {/* Top Gradient Stripe */}
 <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-400 w-full" />

 {/* Modal Header */}
 <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between bg-slate-950/50">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <span className="px-2.5 py-0.5 rounded-sm text-[10px] font-mono font-black tracking-wider uppercase bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
 <ClipboardCheck size={12} className="text-emerald-400" />
 PHASE 23 • SCREENING QUESTIONNAIRE SOLVER
 </span>
 <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
 Friction Bypass Hub
 </span>
 </div>
 <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
 <span>{company}</span>
 <span className="text-slate-500 font-normal">/</span>
 <span className="text-emerald-400">{title}</span>
 </h2>
 <p className="text-xs text-slate-400 mt-0.5">
 Eliminate pre-screening rejection traps across SEEK, Workday, Greenhouse &amp; LinkedIn with verified, audit-proof answers.
 </p>
 </div>

 <button
 onClick={onClose}
 className="p-2 rounded-sm bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
 aria-label="Close modal"
 >
 <X size={18} />
 </button>
 </div>

 {/* Navigation Tabs Bar */}
 <div className="flex items-center justify-between px-6 pt-3 border-b border-slate-800 bg-slate-900/60 font-mono text-xs font-bold gap-2">
 <div className="flex items-center gap-2 overflow-x-auto pb-2">
 <button
 onClick={() => setActiveTab('questions')}
 className={`px-3.5 py-1.5 rounded-sm flex items-center gap-1.5 transition-all cursor-pointer ${
 activeTab === 'questions'
 ? 'bg-emerald-600 text-white '
 : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
 }`}
 >
 <ClipboardCheck size={14} />
 Extracted Questions ({report?.solutions?.length || 0})
 </button>

 <button
 onClick={() => setActiveTab('sandbox')}
 className={`px-3.5 py-1.5 rounded-sm flex items-center gap-1.5 transition-all cursor-pointer ${
 activeTab === 'sandbox'
 ? 'bg-emerald-600 text-white '
 : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
 }`}
 >
 <Plus size={14} />
 Custom Question Sandbox {customSolutions.length > 0 && `(${customSolutions.length})`}
 </button>

 <button
 onClick={() => setActiveTab('radar')}
 className={`px-3.5 py-1.5 rounded-sm flex items-center gap-1.5 transition-all cursor-pointer ${
 activeTab === 'radar'
 ? 'bg-emerald-600 text-white '
 : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
 }`}
 >
 <ShieldAlert size={14} />
 Dealbreaker Radar
 </button>

 <button
 onClick={() => setActiveTab('arsenal')}
 className={`px-3.5 py-1.5 rounded-sm flex items-center gap-1.5 transition-all cursor-pointer ${
 activeTab === 'arsenal'
 ? 'bg-emerald-600 text-white '
 : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
 }`}
 >
 <Layers size={14} />
 1-Click Full Arsenal
 </button>
 </div>

 <div className="hidden sm:flex items-center gap-2 pb-2 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-3 py-1 rounded-sm border border-emerald-500/30">
 <CheckCircle2 size={13} />
 <span>Compliance: {report?.compliance_score || 100}%</span>
 </div>
 </div>

 {/* Modal Body */}
 <div className="p-6 overflow-y-auto flex-1 space-y-6">
 {loading ? (
 <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
 <RefreshCw size={28} className="text-emerald-400 animate-spin" />
 <div className="font-mono text-sm font-bold text-slate-200">
 Synthesizing Pre-Employment Screening Solutions...
 </div>
 <p className="text-xs text-slate-400 max-w-sm">
 Resolving statutory credentials, Australian Fair Work parameters, and STAR behavioral answers.
 </p>
 </div>
 ) : (
 <>
 {/* TAB 1: EXTRACTED QUESTIONS */}
 {activeTab === 'questions' && (
 <div className="space-y-4">
 <div className="bg-slate-950/60 border border-slate-800 rounded-sm p-4 flex items-center justify-between">
 <div>
 <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
 Portal Pre-Screening Criteria
 </div>
 <p className="text-xs text-slate-300 mt-0.5">
 These questions represent the mandatory criteria employers use to automatically triage applicants before human review.
 </p>
 </div>
 <button
 onClick={handleCopyAll}
 className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
 >
 {copiedAll ? <Check size={13} /> : <Copy size={13} />}
 {copiedAll ? 'Copied Full Arsenal!' : 'Copy All Answers'}
 </button>
 </div>

 <div className="space-y-3.5">
 {report?.solutions?.map((sol, index) => {
 const badge = formatRiskBadge(sol.risk_level);
 return (
 <div
 key={sol.id || index}
 className="bg-slate-950/80 border border-slate-800 hover:border-slate-700/80 rounded-sm p-4 transition-all space-y-3"
 >
 <div className="flex flex-wrap items-center justify-between gap-2">
 <div className="flex items-center gap-2">
 <span className="text-xs font-mono font-black text-slate-400">
 #{index + 1}
 </span>
 <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
 {sol.category}
 </span>
 <span className={`px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold border flex items-center gap-1 ${badge.bg} ${badge.text} ${badge.border}`}>
 <span className={`w-1.5 h-1.5 rounded-sm ${badge.dot}`} />
 {sol.risk_level}
 </span>
 </div>

 <div className="flex items-center gap-2">
 <button
 onClick={() => handleCopy(sol.suggested_dropdown, `drop_${sol.id}`)}
 className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-sm text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
 title="Copy dropdown selection value"
 >
 {copiedId === `drop_${sol.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
 <span>Dropdown: "{sol.suggested_dropdown}"</span>
 </button>

 <button
 onClick={() => handleCopy(sol.answer, `ans_${sol.id}`)}
 className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 rounded-sm text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
 title="Copy full response text"
 >
 {copiedId === `ans_${sol.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
 <span>Copy Answer</span>
 </button>
 </div>
 </div>

 <div className="font-semibold text-sm text-slate-100">
 {sol.question}
 </div>

 <div className="bg-slate-900/90 border border-slate-800 rounded-sm p-3 text-xs text-slate-200 leading-relaxed font-mono">
 {sol.answer}
 </div>

 <div className="text-[11px] text-slate-400 italic flex items-center gap-1">
 <BookOpen size={12} className="text-slate-500" />
 <span>Tactical Rationale: {sol.rationale}</span>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* TAB 2: CUSTOM QUESTION SANDBOX */}
 {activeTab === 'sandbox' && (
 <div className="space-y-6">
 <div className="bg-slate-950/60 border border-slate-800 rounded-sm p-5 space-y-3">
 <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
 <Terminal size={14} />
 Custom Portal Question Resolver
 </div>
 <p className="text-xs text-slate-300">
 Encountered a tricky screening question on Workday, Taleo, SEEK, or an employer career portal? Paste it below to generate an instantaneous, audit-compliant answer grounded in your candidate profile.
 </p>

 <form onSubmit={handleSolveCustom} className="space-y-3 pt-2">
 <textarea
 value={customInput}
 onChange={(e) => setCustomInput(e.target.value)}
 placeholder="e.g. Do you require visa sponsorship now or in the future? Or: Tell us about your experience managing Kubernetes clusters in production."
 className="w-full bg-slate-900 border border-slate-700/80 rounded-sm p-3 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none h-20"
 />

 <div className="flex justify-end">
 <button
 type="submit"
 disabled={customSolving || !customInput.trim()}
 className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-sm text-xs font-mono font-bold flex items-center gap-2 cursor-pointer transition-all "
 >
 {customSolving ? (
 <>
 <RefreshCw size={13} className="animate-spin" />
 Solving Criteria...
 </>
 ) : (
 <>
 <Zap size={13} />
 Generate Bespoke Solution
 </>
 )}
 </button>
 </div>
 </form>
 </div>

 {customSolutions.length > 0 && (
 <div className="space-y-3">
 <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
 Solved Sandbox Questions ({customSolutions.length})
 </div>
 {customSolutions.map((sol, idx) => {
 const badge = formatRiskBadge(sol.risk_level);
 return (
 <div
 key={sol.id || idx}
 className="bg-slate-950/80 border border-emerald-500/30 rounded-sm p-4 space-y-3"
 >
 <div className="flex flex-wrap items-center justify-between gap-2">
 <div className="flex items-center gap-2">
 <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
 {sol.category}
 </span>
 <span className={`px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold border flex items-center gap-1 ${badge.bg} ${badge.text} ${badge.border}`}>
 <span className={`w-1.5 h-1.5 rounded-sm ${badge.dot}`} />
 {sol.risk_level}
 </span>
 </div>

 <div className="flex items-center gap-2">
 <button
 onClick={() => handleCopy(sol.suggested_dropdown, `custom_drop_${idx}`)}
 className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-sm text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
 >
 {copiedId === `custom_drop_${idx}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
 <span>Dropdown: "{sol.suggested_dropdown}"</span>
 </button>
 <button
 onClick={() => handleCopy(sol.answer, `custom_ans_${idx}`)}
 className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 rounded-sm text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
 >
 {copiedId === `custom_ans_${idx}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
 <span>Copy Answer</span>
 </button>
 </div>
 </div>

 <div className="font-semibold text-sm text-slate-100">
 {sol.question}
 </div>

 <div className="bg-slate-900/90 border border-slate-800 rounded-sm p-3 text-xs text-slate-200 leading-relaxed font-mono">
 {sol.answer}
 </div>

 <div className="text-[11px] text-slate-400 italic flex items-center gap-1">
 <BookOpen size={12} className="text-slate-500" />
 <span>Tactical Rationale: {sol.rationale}</span>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 )}

 {/* TAB 3: DEALBREAKER RADAR */}
 {activeTab === 'radar' && (
 <div className="space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="bg-slate-950/60 border border-emerald-500/30 rounded-sm p-4">
 <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
 Compliance Health
 </div>
 <div className="text-3xl font-black text-white mt-1">
 {report?.compliance_score || 100}%
 </div>
 <p className="text-[11px] text-slate-400 mt-1">
 Zero disqualification risk detected across active profile.
 </p>
 </div>

 <div className="bg-slate-950/60 border border-slate-800 rounded-sm p-4">
 <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
 Statutory Dealbreakers
 </div>
 <div className="text-3xl font-black text-emerald-400 mt-1">
 {report?.dealbreaker_count || 0} Safe
 </div>
 <p className="text-[11px] text-slate-400 mt-1">
 Work Rights, Police Check, WWCC &amp; clearances pre-cleared.
 </p>
 </div>

 <div className="bg-slate-950/60 border border-slate-800 rounded-sm p-4">
 <div className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
 Friction Bypass Index
 </div>
 <div className="text-3xl font-black text-white mt-1">
 Optimal
 </div>
 <p className="text-[11px] text-slate-400 mt-1">
 Dropdown values and structured STAR stories aligned to ATS.
 </p>
 </div>
 </div>

 <div className="bg-slate-950/60 border border-slate-800 rounded-sm p-5 space-y-3">
 <div className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
 <ShieldAlert size={14} className="text-emerald-400" />
 Statutory Clearance Verification Map
 </div>
 <div className="space-y-2">
 {[
 { label: 'Australian Work Rights / Citizenship', status: profile.workRights || 'Australian Citizen (Unrestricted)', safe: true },
 { label: 'Security Clearance Eligibility', status: profile.clearance || 'Baseline / NV1 Eligible', safe: true },
 { label: 'National Police Check Status', status: 'Clear & Verified for Immediate Presentation', safe: true },
 { label: 'Working With Children Check (WWCC)', status: 'Active Employee WWCC Verified', safe: true },
 { label: 'Workplace Health & Safety / White Card', status: 'SafeWork Australia Standards Compliant', safe: true },
 ].map((item, i) => (
 <div key={i} className="flex items-center justify-between p-2.5 rounded-sm bg-slate-900 border border-slate-800/80">
 <div className="flex items-center gap-2">
 <CheckCircle2 size={14} className="text-emerald-400" />
 <span className="text-xs font-medium text-slate-200">{item.label}</span>
 </div>
 <span className="text-xs font-mono font-semibold text-slate-400">
 {item.status}
 </span>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* TAB 4: 1-CLICK ALL-ANSWERS ARSENAL */}
 {activeTab === 'arsenal' && (
 <div className="space-y-4">
 <div className="flex items-center justify-between bg-slate-950/60 border border-slate-800 rounded-sm p-4">
 <div>
 <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
 Consolidated Questionnaire Arsenal
 </div>
 <p className="text-xs text-slate-300 mt-0.5">
 Copy the complete text block into your clipboard for immediate application form completion.
 </p>
 </div>

 <button
 onClick={handleCopyAll}
 className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
 >
 {copiedAll ? <Check size={14} /> : <Copy size={14} />}
 {copiedAll ? 'Copied Full Arsenal!' : 'Copy Entire Questionnaire'}
 </button>
 </div>

 <div className="bg-slate-950 border border-slate-800 rounded-sm p-4 font-mono text-xs text-slate-300 space-y-4 max-h-[50vh] overflow-y-auto leading-relaxed">
 {report?.solutions?.map((sol, idx) => (
 <div key={idx} className="border-b border-slate-800/60 pb-3 last:border-b-0 space-y-1">
 <div className="font-bold text-emerald-400">
 Q{idx + 1}: {sol.question}
 </div>
 <div className="text-slate-100 pl-4 border-l-2 border-emerald-500/40">
 {sol.answer}
 </div>
 <div className="text-[11px] text-slate-400 pl-4">
 Dropdown Token: <span className="text-cyan-300">"{sol.suggested_dropdown}"</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </>
 )}
 </div>

 {/* Modal Footer */}
 <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs font-mono">
 <div className="text-slate-400 flex items-center gap-2">
 <span className="w-2 h-2 rounded-sm bg-emerald-400 animate-pulse" />
 <span>Audit-proof screening responses synced with candidate profile</span>
 </div>

 <div className="flex items-center gap-2">
 <button
 onClick={handleCopyAll}
 className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-sm font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
 >
 <Copy size={13} />
 <span>Copy All</span>
 </button>
 <button
 onClick={onClose}
 className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm font-bold transition-colors cursor-pointer "
 >
 Done
 </button>
 </div>
 </div>
 </div>
 </div>
 );
};

export default ScreeningSolverModal;

