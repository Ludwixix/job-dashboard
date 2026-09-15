import React, { useState, useEffect, useMemo } from 'react';
import {
 X, Sparkles, AlertTriangle, CheckCircle2, Copy, Check,
 Layers, ShieldAlert, ArrowRight, BookOpen, Download,
 Flame, Terminal, Zap, RefreshCw, FileText
} from 'lucide-react';
import {
 clientAuditCoverLetter,
 fetchJobCoverLetterAudit,
 fetchPolarizedVariants,
} from '../services/coverLetterPolarizerService';
import { downloadCoverLetterPdf } from '../utils/pdfGenerator';
import { getActiveProfile } from '../services/profileService';

export const CoverLetterPolarizerModal = ({
 job = {},
 onClose,
 onSaveCoverLetter,
 userProfile,
}) => {
 const profile = useMemo(() => userProfile || getActiveProfile() || {}, [userProfile]);
 const initialText = job.coverLetterText || '';
 const [coverLetterText, setCoverLetterText] = useState(initialText);
 const [activeTab, setActiveTab] = useState('audit'); // audit | structure | variants | editor
 const [loading, setLoading] = useState(true);
 const [audit, setAudit] = useState(null);
 const [variants, setVariants] = useState([]);
 const [copiedId, setCopiedId] = useState(null);
 const [savedStatus, setSavedStatus] = useState(false);

 const company = job.company || 'Target Employer';
 const title = job.title || 'Engineering Role';
 const description = job.description || job.notes || '';

 // Initial load
 useEffect(() => {
 let isMounted = true;
 const loadData = async () => {
 setLoading(true);
 try {
 const res = await fetchJobCoverLetterAudit(job.id || 'current', job, profile);
 if (isMounted) {
 setAudit(res.audit);
 setVariants(res.variants || []);
 if (!initialText && res.variants && res.variants.length > 0) {
 setCoverLetterText(res.variants[0].full_text);
 // Re-audit with the variant text
 const reAudit = clientAuditCoverLetter(res.variants[0].full_text, company, title, description);
 setAudit(reAudit);
 }
 }
 } catch (err) {
 console.warn('Failed to fetch job cover letter audit:', err);
 } finally {
 if (isMounted) setLoading(false);
 }
 };
 loadData();
 return () => { isMounted = false; };
 }, [job.id, company, title, description, initialText, profile]);

 // Live real-time audit as text changes in editor
 const liveAudit = useMemo(() => {
 return clientAuditCoverLetter(coverLetterText, company, title, description);
 }, [coverLetterText, company, title, description]);

 const currentAudit = activeTab === 'editor' ? liveAudit : (audit || liveAudit);

 const copyToClipboard = (text, id) => {
 navigator.clipboard.writeText(text).catch(() => {});
 setCopiedId(id);
 setTimeout(() => setCopiedId(null), 2500);
 };

 const handleApplyVariant = (variant) => {
 setCoverLetterText(variant.full_text);
 setActiveTab('editor');
 };

 const handleSave = () => {
 if (onSaveCoverLetter && job.id) {
 onSaveCoverLetter(job.id, coverLetterText);
 }
 setSavedStatus(true);
 setTimeout(() => setSavedStatus(false), 2500);
 };

 const handleDownloadPdf = () => {
 if (coverLetterText) {
 downloadCoverLetterPdf(coverLetterText, job, profile);
 }
 };

 const getRiskBadgeColor = (level) => {
 if (level?.includes('Low')) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
 if (level?.includes('Moderate')) return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
 return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
 };

 return (
 <div
 className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
 onClick={onClose}
 >
 <div
 className="bg-slate-900 rounded-sm w-full max-w-5xl border border-slate-700/60 flex flex-col max-h-[92vh] overflow-hidden relative"
 onClick={(e) => e.stopPropagation()}
 >
 {/* Top Header */}
 <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 relative">
 <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-400" />
 <div className="flex items-center gap-3">
 <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 rounded-sm text-rose-400">
 <Flame size={20} />
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h2 className="text-base font-black text-white uppercase tracking-wider">
 Cover Letter Swappability & Polarizer Hub
 </h2>
 <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-slate-800 border border-slate-700 text-slate-300 font-bold">
 Phase 22
 </span>
 </div>
 <p className="text-xs text-slate-400 font-medium">
 {title} • <strong className="text-white">{company}</strong>
 </p>
 </div>
 </div>

 <div className="flex items-center gap-3">
 {currentAudit && (
 <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-sm border bg-slate-900 border-slate-800">
 <span className="text-[10px] font-mono uppercase text-slate-400">Swappability:</span>
 <span className={`text-xs font-black px-2 py-0.5 rounded-sm border ${getRiskBadgeColor(currentAudit.swappability_level)}`}>
 {currentAudit.swappability_score}% Risk
 </span>
 </div>
 )}
 <button
 onClick={onClose}
 className="p-2 text-slate-400 hover:text-white rounded-sm hover:bg-slate-800 transition-colors cursor-pointer"
 >
 <X size={18} />
 </button>
 </div>
 </div>

 {/* Navigation Tabs */}
 <div className="bg-slate-900/90 border-b border-slate-800 px-6 py-2.5 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
 <div className="flex items-center gap-2">
 {[
 { id: 'audit', label: 'SWAPPABILITY & CLICHÉS', icon: <ShieldAlert size={14} /> },
 { id: 'structure', label: '3-PARAGRAPH BLUEPRINT', icon: <Layers size={14} /> },
 { id: 'variants', label: 'POLARIZING REWRITES', icon: <Flame size={14} /> },
 { id: 'editor', label: 'LIVE ANTI-GENERIC EDITOR', icon: <Terminal size={14} /> },
 ].map((tab) => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id)}
 className={`px-3 py-1.5 rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
 activeTab === tab.id
 ? 'bg-amber-600 text-white -indigo-600/30'
 : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
 }`}
 >
 {tab.icon}
 <span>{tab.label}</span>
 </button>
 ))}
 </div>

 <div className="flex items-center gap-2 shrink-0">
 <button
 onClick={handleSave}
 className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-sm border border-slate-700 cursor-pointer flex items-center gap-1.5 transition-colors"
 >
 {savedStatus ? <Check size={14} className="text-emerald-400" /> : <BookOpen size={14} />}
 <span>{savedStatus ? 'Saved!' : 'Save Text'}</span>
 </button>
 <button
 onClick={handleDownloadPdf}
 className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-sm cursor-pointer flex items-center gap-1.5 transition-colors"
 >
 <Download size={14} />
 <span>Download PDF</span>
 </button>
 </div>
 </div>

 {/* Modal Body */}
 <div className="p-6 overflow-y-auto space-y-5 flex-1">
 {loading ? (
 <div className="flex flex-col items-center justify-center py-20 space-y-3">
 <RefreshCw size={28} className="animate-spin text-rose-400" />
 <p className="text-xs font-mono text-slate-400">Running Swappability & Anti-Template Audit…</p>
 </div>
 ) : (
 <>
 {/* TAB 1: SWAPPABILITY & CLICHÉS */}
 {activeTab === 'audit' && (
 <div className="space-y-5">
 {/* Verdict Card */}
 <div className="p-5 rounded-sm bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
 <div className="space-y-1">
 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
 Executive Swappability Verdict
 </div>
 <div className="text-base font-black text-white flex items-center gap-2">
 {currentAudit.overall_verdict.includes('Pass') ? (
 <CheckCircle2 size={18} className="text-emerald-400" />
 ) : (
 <AlertTriangle size={18} className="text-amber-400" />
 )}
 <span>{currentAudit.overall_verdict}</span>
 </div>
 <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
 The Swappability Test evaluates whether a competitor name could be swapped in seamlessly. Lower swappability index indicates profound, employer-locked differentiation.
 </p>
 </div>

 <div className="flex flex-col items-end shrink-0">
 <span className="text-2xl font-black font-mono text-white">
 {currentAudit.swappability_score}%
 </span>
 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm border ${getRiskBadgeColor(currentAudit.swappability_level)}`}>
 {currentAudit.swappability_level}
 </span>
 </div>
 </div>

 {/* Opener Alert */}
 {currentAudit.opener_check.has_cliche_opener ? (
 <div className="p-4 rounded-sm bg-rose-950/40 border border-rose-500/40 space-y-2">
 <div className="flex items-center gap-2 text-rose-300 font-black text-xs uppercase tracking-wider">
 <ShieldAlert size={16} />
 Canned AI Opener Detected: "{currentAudit.opener_check.detected_opener}"
 </div>
 <p className="text-xs text-slate-300 leading-relaxed">
 {currentAudit.opener_check.suggestion}
 </p>
 </div>
 ) : (
 <div className="p-4 rounded-sm bg-emerald-950/40 border border-emerald-500/40 flex items-center gap-3">
 <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
 <div className="text-xs text-emerald-300">
 <strong className="text-white">Anti-Template Rule Passed:</strong> No canned AI opening phrases detected. The opener leads with contextual authority.
 </div>
 </div>
 )}

 {/* Corporate Fluff Purge Grid */}
 <div className="space-y-2">
 <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
 <span>Detected Corporate Clichés ({currentAudit.cliches_found.length})</span>
 <span className="text-[10px] text-slate-500 font-mono">Purge fluff for polarizing efficiency</span>
 </div>

 {currentAudit.cliches_found.length === 0 ? (
 <div className="p-4 rounded-sm bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
 <CheckCircle2 size={16} className="text-emerald-400" />
 Zero corporate clichés found! The narrative uses factual, outcome-oriented language.
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
 {currentAudit.cliches_found.map((c, i) => (
 <div key={i} className="p-3 rounded-sm bg-slate-950 border border-slate-800 space-y-1">
 <div className="flex items-center justify-between">
 <span className="text-xs font-bold text-rose-400 font-mono">"{c.phrase}"</span>
 <span className="text-[10px] text-slate-500 font-mono">{c.category}</span>
 </div>
 <p className="text-[11px] text-slate-300">
 <strong className="text-amber-400">Fix:</strong> {c.fix}
 </p>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Recommendations */}
 <div className="space-y-2">
 <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
 Strategic Optimization Directives
 </div>
 <div className="space-y-1.5">
 {currentAudit.recommendations.map((rec, i) => (
 <div key={i} className="p-3 rounded-sm bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
 <ArrowRight size={14} className="text-amber-400 shrink-0 mt-0.5" />
 <span>{rec}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* TAB 2: 3-PARAGRAPH BLUEPRINT */}
 {activeTab === 'structure' && (
 <div className="space-y-4">
 <div className="p-4 rounded-sm bg-amber-950/30 border border-amber-500/30 text-xs text-amber-300 leading-relaxed">
 <strong className="text-white font-bold">The 3-Paragraph Rule:</strong> Recruiters spend less than 15 seconds skimming cover letters. Structure strictly into 3 focused sections: The Hook, The Proof Narrative, and The Low-Friction Close.
 </div>

 <div className="space-y-3">
 {currentAudit.paragraph_analysis.map((p) => (
 <div
 key={p.index}
 className={`p-4 rounded-sm border transition-all ${
 p.compliant
 ? 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
 : 'bg-amber-950/20 border-amber-500/40'
 }`}
 >
 <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800/80 gap-2">
 <div className="flex items-center gap-2">
 <span className="w-5 h-5 rounded-sm bg-amber-600/30 text-amber-400 border border-amber-500/40 text-[11px] font-mono font-bold flex items-center justify-center">
 {p.index}
 </span>
 <span className="text-xs font-bold text-white uppercase tracking-wider">
 {p.role}
 </span>
 </div>
 <div className="flex items-center gap-2 text-[11px] font-mono">
 <span className="text-slate-400">{p.word_count} words</span>
 <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
 p.compliant ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40' : 'bg-amber-950 text-amber-300 border border-amber-800/40'
 }`}>
 {p.compliant ? 'COMPLIANT' : 'ADJUST'}
 </span>
 </div>
 </div>

 <p className="text-xs text-slate-300 mt-2 font-mono leading-relaxed bg-slate-900/50 p-2.5 rounded-sm border border-slate-800">
 {p.preview}
 </p>

 <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
 <span className="text-amber-400 font-bold">Feedback:</span>
 <span>{p.feedback}</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* TAB 3: POLARIZING REWRITES */}
 {activeTab === 'variants' && (
 <div className="space-y-4">
 <div className="text-xs text-slate-400 leading-relaxed">
 Select a polarizing angle designed to cut through recruiter fatigue. Each variant strictly conforms to the 3-paragraph formula and embeds specific technical scale.
 </div>

 <div className="grid grid-cols-1 gap-4">
 {variants.map((v) => (
 <div
 key={v.id}
 className="p-5 rounded-sm bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
 >
 <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800 gap-2">
 <div>
 <div className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
 <Flame size={14} className="text-rose-400" />
 <span>{v.title}</span>
 </div>
 <p className="text-[11px] text-slate-400 font-medium">{v.subtitle}</p>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => copyToClipboard(v.full_text, v.id)}
 className="px-3 py-1 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer border border-slate-700"
 >
 {copiedId === v.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
 <span>{copiedId === v.id ? 'COPIED' : 'COPY'}</span>
 </button>
 <button
 onClick={() => handleApplyVariant(v)}
 className="px-3 py-1 rounded-sm bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
 >
 <Zap size={12} />
 <span>APPLY TO EDITOR</span>
 </button>
 </div>
 </div>

 <div className="text-[11px] text-amber-300 font-sans italic">
 Hook Thesis: {v.hook_explanation}
 </div>

 <div className="space-y-2">
 {v.paragraphs.map((para, pIdx) => (
 <div key={pIdx} className="p-3 rounded-sm bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300 leading-relaxed font-sans">
 <span className="text-[10px] font-mono text-slate-500 block mb-1 font-bold">
 ¶{pIdx + 1} {pIdx === 0 ? '• The Hook' : pIdx === 1 ? '• Proof Story' : '• Call to Action'}
 </span>
 {para}
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* TAB 4: LIVE ANTI-GENERIC EDITOR */}
 {activeTab === 'editor' && (
 <div className="space-y-4">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800 gap-2">
 <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
 <Terminal size={14} className="text-amber-400" />
 <span>Live Swappability Scorer</span>
 <span className="text-[10px] font-mono text-slate-500">
 ({liveAudit.voice_profile.total_words} words, {liveAudit.paragraph_analysis.length} paragraphs)
 </span>
 </div>

 <div className="flex items-center gap-2">
 <span className="text-[11px] font-mono text-slate-400">Risk:</span>
 <span className={`text-xs font-mono font-black px-2 py-0.5 rounded border ${getRiskBadgeColor(liveAudit.swappability_level)}`}>
 {liveAudit.swappability_score}%
 </span>
 <button
 onClick={() => copyToClipboard(coverLetterText, 'editor')}
 className="px-3 py-1 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 border border-slate-700 cursor-pointer"
 >
 {copiedId === 'editor' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
 <span>{copiedId === 'editor' ? 'COPIED' : 'COPY'}</span>
 </button>
 </div>
 </div>

 <textarea
 rows={16}
 value={coverLetterText}
 onChange={(e) => setCoverLetterText(e.target.value)}
 placeholder="Draft or paste your 3-paragraph cover letter here. The engine recalculates swappability in real-time..."
 className="w-full bg-slate-950 border border-slate-800 rounded-sm p-4 font-sans text-xs text-slate-200 focus:outline-none focus:border-amber-500 leading-relaxed resize-y"
 />

 {/* Real-Time Hints */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
 <div className="p-3 rounded-sm bg-slate-950 border border-slate-800 space-y-1">
 <div className="text-[10px] font-bold text-slate-500 uppercase">Opener Status</div>
 <div className={liveAudit.opener_check.has_cliche_opener ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
 {liveAudit.opener_check.has_cliche_opener ? 'Canned Opener' : 'Unique Hook'}
 </div>
 </div>
 <div className="p-3 rounded-sm bg-slate-950 border border-slate-800 space-y-1">
 <div className="text-[10px] font-bold text-slate-500 uppercase">Company Mentions</div>
 <div className="text-white font-bold font-mono">
 {liveAudit.company_mention_count}x mentions of {company}
 </div>
 </div>
 <div className="p-3 rounded-sm bg-slate-950 border border-slate-800 space-y-1">
 <div className="text-[10px] font-bold text-slate-500 uppercase">Corporate Clichés</div>
 <div className={liveAudit.cliches_found.length > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
 {liveAudit.cliches_found.length} detected
 </div>
 </div>
 </div>
 </div>
 )}
 </>
 )}
 </div>

 {/* Modal Footer */}
 <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex items-center justify-between shrink-0">
 <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
 <span className="w-2 h-2 rounded-sm bg-emerald-400" />
 <span>Anti-Template Engine Active</span>
 </div>
 <button
 onClick={onClose}
 className="px-4 py-2 rounded-sm bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
 >
 CLOSE
 </button>
 </div>
 </div>
 </div>
 );
};

