import React, { useState, useEffect, useCallback } from 'react';
import {
 X, Check, Copy, ShieldCheck, AlertTriangle, ExternalLink,
 Clock, Award, HelpCircle, FileText, CheckCircle2, ShieldAlert
} from 'lucide-react';
import {
 fetchJobSeekPassReport,
 auditSeekPassRemote,
 getRiskBadge,
} from '../services/seekPassService';

export const SeekPassModal = ({
 job = {},
 onClose,
 userProfile = null,
}) => {
 const [activeTab, setActiveTab] = useState('radar'); // 'radar' | 'actions' | 'scripts' | 'dossier'
 const [report, setReport] = useState(null);
 const [loading, setLoading] = useState(true);
 const [copiedKey, setCopiedKey] = useState(null);

 const loadAuditData = useCallback(async () => {
 setLoading(true);
 try {
 const data = await fetchJobSeekPassReport(job, userProfile);
 setReport(data);
 } catch (err) {
 console.error('Failed to load SEEK Pass audit:', err);
 } finally {
 setLoading(false);
 }
 }, [job, userProfile]);

 useEffect(() => {
 loadAuditData();
 }, [loadAuditData]);

 // Handle escape key
 useEffect(() => {
 const handleKeyDown = (e) => {
 if (e.key === 'Escape') onClose();
 };
 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, [onClose]);

 const handleCopy = (key, text) => {
 navigator.clipboard.writeText(text);
 setCopiedKey(key);
 setTimeout(() => setCopiedKey(null), 2000);
 };

 const handleRerunAudit = async () => {
 setLoading(true);
 try {
 const updated = await auditSeekPassRemote(job, userProfile);
 setReport(updated);
 } catch (err) {
 console.error('Failed to rerun audit:', err);
 } finally {
 setLoading(false);
 }
 };

 const riskInfo = getRiskBadge(report?.risk_level);
 const readiness = report?.readiness_score ?? 100;
 const auditedReqs = report?.audited_requirements || [];
 const screeningResponses = report?.screening_responses || [];

 return (
 <div
 role="dialog"
 aria-modal="true"
 aria-labelledby="seek-pass-title"
 className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
 onClick={(e) => e.target === e.currentTarget && onClose()}
 >
 <div className="bg-slate-900 border border-slate-700/80 rounded-sm w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
 {/* Header */}
 <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
 <div className="flex items-center space-x-3">
 <div className="p-2 rounded-sm bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-amber-500/30 text-amber-400">
 <ShieldCheck className="w-6 h-6" />
 </div>
 <div>
 <div className="flex items-center space-x-2">
 <h2 id="seek-pass-title" className="text-lg font-bold text-white tracking-wide">
 SEEK Pass & Verified Credentials Pre-Qualification
 </h2>
 <span className={`px-2 py-0.5 text-xs font-semibold rounded-sm border ${riskInfo.badgeClass}`}>
 {riskInfo.label}
 </span>
 </div>
 <p className="text-xs text-slate-400">
 {job.title || 'Target Role'} · {job.company || 'Employer'} · Australian Statutory Radar
 </p>
 </div>
 </div>
 <button
 onClick={onClose}
 className="p-1.5 rounded-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
 aria-label="Close modal"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Readiness Metric Banner */}
 <div className="px-6 py-3 bg-slate-800/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
 <div className="flex items-center space-x-4">
 <div className="flex items-center space-x-2">
 <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
 {readiness}%
 </div>
 <div className="text-xs text-slate-400 leading-tight">
 Readiness<br />Index
 </div>
 </div>
 <div className="h-6 w-px bg-slate-700" />
 <div className="flex items-center space-x-3 text-xs">
 <span className="flex items-center text-emerald-400">
 <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
 {report?.verified_count || 0} Verified
 </span>
 <span className="flex items-center text-amber-400">
 <Clock className="w-3.5 h-3.5 mr-1" />
 {report?.action_count || 0} Action Req.
 </span>
 <span className="flex items-center text-rose-400">
 <ShieldAlert className="w-3.5 h-3.5 mr-1" />
 {report?.knockout_count || 0} Knockout Risk
 </span>
 </div>
 </div>

 <button
 onClick={handleRerunAudit}
 disabled={loading}
 className="px-3 py-1.5 text-xs font-medium rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
 >
 {loading ? 'Auditing...' : 'Re-Audit Profile'}
 </button>
 </div>

 {/* Navigation Tabs */}
 <div className="flex px-6 border-b border-slate-800 bg-slate-950/40 gap-6">
 <button
 onClick={() => setActiveTab('radar')}
 className={`py-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
 activeTab === 'radar'
 ? 'border-amber-500 text-amber-400'
 : 'border-transparent text-slate-400 hover:text-slate-200'
 }`}
 >
 <Award className="w-4 h-4" />
 Credential Audit & Knockout Radar
 </button>
 <button
 onClick={() => setActiveTab('actions')}
 className={`py-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
 activeTab === 'actions'
 ? 'border-amber-500 text-amber-400'
 : 'border-transparent text-slate-400 hover:text-slate-200'
 }`}
 >
 <Clock className="w-4 h-4" />
 Verification Action Plan ({report?.action_count || 0})
 </button>
 <button
 onClick={() => setActiveTab('scripts')}
 className={`py-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
 activeTab === 'scripts'
 ? 'border-amber-500 text-amber-400'
 : 'border-transparent text-slate-400 hover:text-slate-200'
 }`}
 >
 <HelpCircle className="w-4 h-4" />
 SEEK Pass Responses ({screeningResponses.length})
 </button>
 <button
 onClick={() => setActiveTab('dossier')}
 className={`py-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
 activeTab === 'dossier'
 ? 'border-amber-500 text-amber-400'
 : 'border-transparent text-slate-400 hover:text-slate-200'
 }`}
 >
 <FileText className="w-4 h-4" />
 Master Dossier & Export
 </button>
 </div>

 {/* Content Body */}
 <div className="flex-1 overflow-y-auto p-6 space-y-4">
 {loading ? (
 <div className="flex flex-col items-center justify-center py-16 space-y-3">
 <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-sm animate-spin" />
 <p className="text-sm text-slate-400">Auditing profile against Australian credential registries...</p>
 </div>
 ) : (
 <>
 {/* TAB 1: RADAR */}
 {activeTab === 'radar' && (
 <div className="space-y-4">
 <div className="p-4 rounded-sm bg-slate-800/40 border border-slate-700/60">
 <h3 className="text-sm font-semibold text-slate-200 mb-1">Diagnostic Assessment</h3>
 <p className="text-xs text-slate-300 leading-relaxed">{report?.summary}</p>
 </div>

 {auditedReqs.length === 0 ? (
 <div className="p-8 text-center rounded-sm bg-slate-800/20 border border-dashed border-slate-700">
 <ShieldCheck className="w-12 h-12 mx-auto text-emerald-400/60 mb-2" />
 <p className="text-sm font-semibold text-slate-300">No Restrictive Credentials Mandated</p>
 <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
 This role does not mandate specific statutory licenses (AHPRA, NV1, WWCC) or restrictive SEEK Pass pre-checks. Your application will proceed directly to recruiter review.
 </p>
 </div>
 ) : (
 <div className="grid gap-3">
 {auditedReqs.map((req) => (
 <div
 key={req.id}
 className={`p-4 rounded-sm border transition ${
 req.status === 'VERIFIED'
 ? 'bg-emerald-950/20 border-emerald-500/30'
 : req.status === 'KNOCKOUT_RISK'
 ? 'bg-rose-950/20 border-rose-500/40'
 : 'bg-amber-950/20 border-amber-500/30'
 }`}
 >
 <div className="flex items-start justify-between gap-3">
 <div className="space-y-1">
 <div className="flex items-center gap-2">
 <span className="text-sm font-bold text-slate-100">{req.name}</span>
 {req.mandatory && (
 <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
 MANDATORY
 </span>
 )}
 <span
 className={`px-2 py-0.5 text-xs font-semibold rounded-sm border ${
 req.status === 'VERIFIED'
 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
 : req.status === 'KNOCKOUT_RISK'
 ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
 : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
 }`}
 >
 {req.status === 'VERIFIED' ? 'Verified in Profile' : (req.status === 'KNOCKOUT_RISK' ? 'Knockout Risk' : 'Action Required')}
 </span>
 </div>
 <p className="text-xs text-slate-400">
 Issuing Authority: <span className="text-slate-300">{req.authority}</span> · Turnaround: <span className="text-slate-300">{req.turnaround}</span>
 </p>
 {req.evidence && (
 <p className="text-xs text-emerald-400/90 font-mono">
 Evidence: {req.evidence}
 </p>
 )}
 <p className="text-xs text-slate-300 pt-1">
 <strong className="text-slate-200">Recommended Action:</strong> {req.actionSteps}
 </p>
 </div>

 {req.authorityUrl && (
 <a
 href={req.authorityUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-sm border border-amber-500/20 transition whitespace-nowrap"
 >
 <span>Verify</span>
 <ExternalLink className="w-3 h-3" />
 </a>
 )}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {/* TAB 2: ACTION PLAN */}
 {activeTab === 'actions' && (
 <div className="space-y-4">
 <p className="text-xs text-slate-400">
 Step-by-step pre-qualification checklist to bypass automated algorithmic knockout filters before you submit your application:
 </p>
 <div className="grid gap-3">
 {auditedReqs.filter((r) => r.status !== 'VERIFIED').length === 0 ? (
 <div className="p-8 text-center rounded-sm bg-slate-800/20 border border-dashed border-slate-700">
 <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
 <p className="text-sm font-semibold text-slate-200">Zero Pending Action Items</p>
 <p className="text-xs text-slate-400 mt-1">All credentials for this role are active in your candidate profile.</p>
 </div>
 ) : (
 auditedReqs
 .filter((r) => r.status !== 'VERIFIED')
 .map((item, idx) => (
 <div key={idx} className="p-4 rounded-sm bg-slate-800/40 border border-slate-700/60 space-y-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center space-x-2">
 <span className="flex items-center justify-center w-5 h-5 rounded-sm bg-amber-500/20 text-amber-400 font-bold text-xs">
 {idx + 1}
 </span>
 <h4 className="text-sm font-bold text-slate-100">{item.name}</h4>
 </div>
 <span className="text-xs text-slate-400 flex items-center gap-1">
 <Clock className="w-3.5 h-3.5" />
 {item.turnaround}
 </span>
 </div>
 <p className="text-xs text-slate-300 pl-7">{item.actionSteps}</p>
 <div className="pl-7 pt-1">
 <a
 href={item.authorityUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-sm bg-amber-600 hover:bg-amber-500 text-white transition"
 >
 <span>Official Registry: {item.authority}</span>
 <ExternalLink className="w-3.5 h-3.5" />
 </a>
 </div>
 </div>
 ))
 )}
 </div>
 </div>
 )}

 {/* TAB 3: SEEK PRE-SCREENING RESPONSES */}
 {activeTab === 'scripts' && (
 <div className="space-y-4">
 <p className="text-xs text-slate-400">
 Pre-formulated, legally compliant responses ready for 1-click copy into SEEK Pass or employer application questionnaires:
 </p>
 <div className="grid gap-3">
 {screeningResponses.length === 0 ? (
 <p className="text-xs text-slate-400 text-center py-8">No custom screening questions detected.</p>
 ) : (
 screeningResponses.map((item, idx) => (
 <div key={idx} className="p-4 rounded-sm bg-slate-800/40 border border-slate-700/60 space-y-2">
 <div className="flex items-center justify-between">
 <span className="text-xs font-semibold text-slate-400">{item.requirementName}</span>
 <button
 onClick={() => handleCopy(`script_${idx}`, item.response)}
 className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
 >
 {copiedKey === `script_${idx}` ? (
 <>
 <Check className="w-3.5 h-3.5 text-emerald-400" />
 <span className="text-emerald-400">Copied!</span>
 </>
 ) : (
 <>
 <Copy className="w-3.5 h-3.5" />
 <span>Copy Answer</span>
 </>
 )}
 </button>
 </div>
 <p className="text-xs font-medium text-slate-200">{item.promptQuestion}</p>
 <div className="p-2.5 rounded-sm bg-slate-950/60 border border-slate-800 text-xs text-slate-300 font-mono leading-relaxed">
 "{item.response}"
 </div>
 </div>
 ))
 )}
 </div>
 </div>
 )}

 {/* TAB 4: DOSSIER & EXPORT */}
 {activeTab === 'dossier' && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="text-sm font-semibold text-slate-200">Compliance & Readiness Dossier</h3>
 <button
 onClick={() => handleCopy('dossier_all', report?.dossier_markdown || '')}
 className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm bg-amber-600 hover:bg-amber-500 text-white transition"
 >
 {copiedKey === 'dossier_all' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
 <span>{copiedKey === 'dossier_all' ? 'Copied Dossier!' : 'Copy Dossier Markdown'}</span>
 </button>
 </div>
 <pre className="p-4 rounded-sm bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96">
 {report?.dossier_markdown || 'No dossier generated.'}
 </pre>
 </div>
 )}
 </>
 )}
 </div>

 {/* Footer */}
 <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
 <div className="text-xs text-slate-400">
 Compliant with Australian Fair Work & AGSVA Verification Standards
 </div>
 <button
 onClick={onClose}
 className="px-4 py-2 text-xs font-semibold rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
 >
 Done
 </button>
 </div>
 </div>
 </div>
 );
};

