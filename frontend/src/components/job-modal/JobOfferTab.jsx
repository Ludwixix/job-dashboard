import React from 'react';
import {
  Sparkles, Scale, ShieldCheck, Zap, Copy, Check
} from 'lucide-react';

export function JobOfferTab({
  job,
  activeProfile,
  onClose,
  onOpenOfferHub,
  onJobStatusUpdate,
  offerDraftTab,
  setOfferDraftTab,
  copiedOfferDraft,
  setCopiedOfferDraft,
  dueDiligenceChecks,
  setDueDiligenceChecks
}) {
  return (

 <div className="space-y-6 animate-in fade-in duration-200">
 {/* Offer Highlight Card */}
 <div className="p-6 rounded-sm bg-gradient-to-br from-amber-950 via-slate-900 to-emerald-950 text-white border-2 border-amber-500/80 space-y-4 font-mono">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/30 pb-4">
 <div className="flex items-center gap-3">
 <div className="p-3 bg-amber-500 text-slate-950 rounded-sm font-black text-xl ">
 🎉
 </div>
 <div>
 <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
 FORMAL EMPLOYMENT OFFER EXTENDED
 </div>
 <h3 className="text-lg font-black text-white">{job.title}</h3>
 <p className="text-xs text-slate-300 font-bold">{job.company} • {job.location || 'Melbourne, VIC'}</p>
 </div>
 </div>

 <div className="flex items-center gap-2">
 <button
 onClick={() => onOpenOfferHub?.(job)}
 className="px-3.5 py-1.5 rounded-sm bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all"
 title="Universal Compensation Benchmarking & Fair Work Contract Risk Scanner"
 >
 <Scale size={13} className="text-slate-950" />
 <span>OFFER ACTION HUB</span>
 </button>
 <button
 onClick={() => setShowPsychology(true)}
 className="px-3 py-1.5 rounded-sm bg-teal-950/80 hover:bg-teal-900 text-teal-300 border border-teal-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer -xs"
 title="Decode employer psychology and leverage"
 >
 <Sparkles size={13} className="text-teal-400" />
 <span>LEVERAGE INTEL</span>
 </button>
 </div>
 </div>

 {/* Package Breakdown Grid */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
 <div className="bg-slate-950/80 p-3.5 rounded-sm border border-slate-800 space-y-1">
 <div className="text-[10px] text-slate-400 font-bold uppercase">BASE REMUNERATION</div>
 <div className="text-base font-black text-emerald-400">{job.salary || '$105,000 – $115,000'}</div>
 <div className="text-[9px] text-slate-500">Excl. superannuation</div>
 </div>

 <div className="bg-slate-950/80 p-3.5 rounded-sm border border-slate-800 space-y-1">
 <div className="text-[10px] text-slate-400 font-bold uppercase">SUPERANNUATION</div>
 <div className="text-base font-black text-teal-400">11.5% AU Stat</div>
 <div className="text-[9px] text-slate-500">~$12,075 – $13,225/yr</div>
 </div>

 <div className="bg-slate-950/80 p-3.5 rounded-sm border border-slate-800 space-y-1">
 <div className="text-[10px] text-slate-400 font-bold uppercase">WORK ARRANGEMENT</div>
 <div className="text-sm font-black text-amber-300">{job.remote ? '100% Remote' : 'Hybrid (Melbourne)'}</div>
 <div className="text-[9px] text-slate-500">Office / Field visits</div>
 </div>

 <div className="bg-slate-950/80 p-3.5 rounded-sm border border-slate-800 space-y-1">
 <div className="text-[10px] text-slate-400 font-bold uppercase">DECISION WINDOW</div>
 <div className="text-sm font-black text-amber-400">5 Business Days</div>
 <div className="text-[9px] text-slate-500">Action recommended</div>
 </div>
 </div>
 </div>

 {/* Negotiation & Response Suite */}
 <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 text-white space-y-4">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3 font-mono">
 <div>
 <div className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
 <Zap size={14} className="text-amber-400" />
 1-Click Strategic Response Generator
 </div>
 <div className="text-[11px] text-slate-400 mt-0.5">
 Select a posture below to generate a tailored, professional executive email response.
 </div>
 </div>

 <button
 onClick={() => {
 const textToCopy = getOfferDraftText(offerDraftTab, job);
 navigator.clipboard.writeText(textToCopy);
 setCopiedOfferDraft(true);
 setTimeout(() => setCopiedOfferDraft(false), 2500);
 }}
 className="px-3.5 py-1.5 rounded-sm bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all self-start sm:self-auto"
 >
 {copiedOfferDraft ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
 <span>{copiedOfferDraft ? 'COPIED TO CLIPBOARD' : 'COPY EMAIL DRAFT'}</span>
 </button>
 </div>

 {/* Response Posture Selector Pills */}
 <div className="flex flex-wrap gap-2 font-mono text-xs">
 <button
 onClick={() => setOfferDraftTab('accept')}
 className={`px-3 py-2 rounded-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
 offerDraftTab === 'accept'
 ? 'bg-emerald-500 text-slate-950 font-black'
 : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
 }`}
 >
 ✍️ 1. Formal Acceptance
 </button>
 <button
 onClick={() => setOfferDraftTab('counter')}
 className={`px-3 py-2 rounded-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
 offerDraftTab === 'counter'
 ? 'bg-amber-500 text-slate-950 font-black'
 : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
 }`}
 >
 💼 2. Counter-Offer (+8-12% & Hybrid)
 </button>
 <button
 onClick={() => setOfferDraftTab('clarify')}
 className={`px-3 py-2 rounded-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
 offerDraftTab === 'clarify'
 ? 'bg-amber-500 text-white font-black'
 : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
 }`}
 >
 🤝 3. Request Contract Details
 </button>
 <button
 onClick={() => setOfferDraftTab('decline')}
 className={`px-3 py-2 rounded-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
 offerDraftTab === 'decline'
 ? 'bg-rose-600 text-white font-black'
 : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
 }`}
 >
 🛑 4. Polite Decline
 </button>
 </div>

 {/* Rendered Email Template Preview */}
 <div className="p-4 rounded-sm bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap selection:bg-amber-500 selection:text-white">
 {getOfferDraftText(offerDraftTab, job)}
 </div>
 </div>

 {/* Contract Due Diligence Checklist */}
 <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 text-white space-y-4 font-mono text-xs">
 <div className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
 <ShieldCheck size={16} className="text-emerald-400" />
 Pre-Signing Contract Due Diligence Checklist
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <label className="flex items-start gap-3 p-3 rounded-sm bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
 <input
 type="checkbox"
 checked={dueDiligenceChecks.salary}
 onChange={(e) => setDueDiligenceChecks(prev => ({ ...prev, salary: e.target.checked }))}
 className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
 />
 <div>
 <div className="font-bold text-slate-200">Base Salary & Super in Writing</div>
 <div className="text-[10px] text-slate-400 font-medium">Ensure superannuation (11.5%) is explicitly stated as inclusive or exclusive.</div>
 </div>
 </label>

 <label className="flex items-start gap-3 p-3 rounded-sm bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
 <input
 type="checkbox"
 checked={dueDiligenceChecks.probation}
 onChange={(e) => setDueDiligenceChecks(prev => ({ ...prev, probation: e.target.checked }))}
 className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
 />
 <div>
 <div className="font-bold text-slate-200">Probation Terms Defined</div>
 <div className="text-[10px] text-slate-400 font-medium">Standard 3-month or 6-month review criteria with mutual notice terms.</div>
 </div>
 </label>

 <label className="flex items-start gap-3 p-3 rounded-sm bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
 <input
 type="checkbox"
 checked={dueDiligenceChecks.notice}
 onChange={(e) => setDueDiligenceChecks(prev => ({ ...prev, notice: e.target.checked }))}
 className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
 />
 <div>
 <div className="font-bold text-slate-200">Notice Period & Termination</div>
 <div className="text-[10px] text-slate-400 font-medium">Standard 4-week notice period following probation.</div>
 </div>
 </label>

 <label className="flex items-start gap-3 p-3 rounded-sm bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
 <input
 type="checkbox"
 checked={dueDiligenceChecks.hybrid}
 onChange={(e) => setDueDiligenceChecks(prev => ({ ...prev, hybrid: e.target.checked }))}
 className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
 />
 <div>
 <div className="font-bold text-slate-200">Work Location & Hybrid Policy</div>
 <div className="text-[10px] text-slate-400 font-medium">Fixed WFH / office days documented to avoid arbitrary mandate changes.</div>
 </div>
 </label>

 <label className="flex items-start gap-3 p-3 rounded-sm bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors sm:col-span-2">
 <input
 type="checkbox"
 checked={dueDiligenceChecks.allowances}
 onChange={(e) => setDueDiligenceChecks(prev => ({ ...prev, allowances: e.target.checked }))}
 className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
 />
 <div>
 <div className="font-bold text-slate-200">Field Travel, Vehicle & Tool Allowances</div>
 <div className="text-[10px] text-slate-400 font-medium">Cents-per-km ATO rate, company vehicle, or phone/laptop provisioning confirmed for field duties.</div>
 </div>
 </label>
 </div>
 </div>

 {/* Stage Update Toggles */}
 <div className="p-4 rounded-sm bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
 <span className="text-slate-400 font-bold">Update Application Tracking:</span>
 <div className="flex flex-wrap gap-2">
 <button
 onClick={() => {
 if (onJobStatusUpdate) onJobStatusUpdate(job.id, 'Accepted / Hired');
 onClose();
 }}
 className="px-3 py-1.5 rounded-sm bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center gap-1 cursor-pointer transition-colors "
 >
 🚀 Mark Accepted & Hired
 </button>
 <button
 onClick={() => {
 if (onJobStatusUpdate) onJobStatusUpdate(job.id, 'Offer / Negotiating');
 }}
 className="px-3 py-1.5 rounded-sm bg-amber-600 hover:bg-amber-500 text-slate-950 font-black flex items-center gap-1 cursor-pointer transition-colors"
 >
 ⏳ Mark Counter-Offer Sent
 </button>
 <button
 onClick={() => {
 if (onJobStatusUpdate) onJobStatusUpdate(job.id, 'Offer Declined');
 onClose();
 }}
 className="px-3 py-1.5 rounded-sm bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 border border-slate-700 text-xs font-bold cursor-pointer transition-colors"
 >
 🛑 Mark Offer Declined
 </button>
 </div>
 </div>
 </div>
  );
}
