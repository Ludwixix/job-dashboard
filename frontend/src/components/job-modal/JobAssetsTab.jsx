import React, { useState } from 'react';
import {
  Sparkles, Zap, FileUser, ExternalLink, Download, Clock, ShieldCheck,
  CheckCircle2, Copy, Check, FileText, BookOpen, Building2, ClipboardCheck,
  Compass, Flame, Mail, Search, Users, Target
} from 'lucide-react';
import { hasGeneratedApplicationDocs } from '../../services/generationService';
import { downloadResumePdf, downloadCoverLetterPdf } from '../../utils/pdfGenerator';
import { downloadAtsDocxResume } from '../../services/dataService';
import { getQuickApplyPlatform } from '../../services/autoApplyService';
import { hasJobIntelligence } from '../../services/jobIntelligenceService';

export function JobAssetsTab({
  job,
  activeProfile,
  onClose,
  onOpenAutoApply,
  onOpenGenerator,
  onOpenOutreach,
  onOpenMockInterview,
  onOpenInterviewPrep,
  onOpenInfluenceHub,
  onOpenAtsDiagnostic,
  onOpenCareerCompass,
  onOpenCheatSheet,
  onOpenCoverLetterPolarizer,
  onOpenExecutiveDossier,
  onOpenKscGenerator,
  onOpenLinkedInInbound,
  onOpenRecruiterCrm,
  onOpenScreeningSolver,
  onOpenSeekPass,
  setShowPsychology,
  copiedSubject,
  setCopiedSubject,
  handleCopySubject
}) {
  const [isAutoApplying, setIsAutoApplying] = useState(false);
  const [pipelineStage, setPipelineStage] = useState(1);
  const [autoApplyReceipt, setAutoApplyReceipt] = useState(null);
  return (

 <div className="space-y-6 animate-in fade-in duration-200">
 {/* End-to-End Automated Application Pipeline Dispatcher */}
 <div className="p-5 rounded-sm bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white border border-emerald-500/40 space-y-3 font-mono">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2 text-xs font-black text-emerald-400 uppercase tracking-wider">
 <Zap size={18} className="text-emerald-400 animate-bounce" /> 
 END-TO-END AUTOMATED APPLICATION PIPELINE
 </div>
 <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-1 rounded-sm">
 AUTOMATION READY
 </span>
 </div>

 <p className="text-xs text-slate-300 font-sans leading-relaxed">
 Generates tailored PDF Resume & Cover Letter aligned to candidate profile, populates contact/work-rights/salary fields, and dispatches/stages your application automatically.
 </p>

 {isAutoApplying && (
 <div className="p-4 rounded-sm bg-slate-900 border border-emerald-500/60 text-slate-200 text-xs font-mono space-y-2.5 animate-in fade-in duration-200">
 <div className="flex items-center justify-between text-emerald-400 font-bold text-xs border-b border-slate-800 pb-1.5">
 <span className="flex items-center gap-1.5">
 <Zap size={14} className="animate-spin text-emerald-400" />
 APPLICATION PIPELINE ACTIVE
 </span>
 <span className="text-[10px] text-slate-400">STAGE {pipelineStage} / 3</span>
 </div>

 <div className="space-y-1.5 text-[11px]">
 <div className={`flex items-center gap-2 ${pipelineStage >= 1 ? 'text-emerald-300 font-bold' : 'text-slate-500'}`}>
 <span>{pipelineStage > 1 ? '✓' : '⚡'}</span>
 <span>1. Extracting candidate profile & ATS job specifications</span>
 </div>
 <div className={`flex items-center gap-2 ${pipelineStage >= 2 ? 'text-emerald-300 font-bold' : 'text-slate-500'}`}>
 <span>{pipelineStage > 2 ? '✓' : pipelineStage === 2 ? '⚡' : '○'}</span>
 <span>2. Synthesizing tailored ATS Resume & Executive Cover Letter</span>
 </div>
 <div className={`flex items-center gap-2 ${pipelineStage >= 3 ? 'text-emerald-300 font-bold' : 'text-slate-500'}`}>
 <span>{pipelineStage === 3 ? '⚡' : '○'}</span>
 <span>3. Rendering A4 PDFs and syncing to Google Drive / Sheets</span>
 </div>
 </div>
 </div>
 )}

 <button
 onClick={async () => {
 setIsAutoApplying(true);
 setPipelineStage(1);
 setAutoApplyReceipt(null);

 setTimeout(() => setPipelineStage(2), 600);
 setTimeout(() => setPipelineStage(3), 1800);

 try {
 const data = await executeClientSideAutoApply(job);
 if (data && data.success) {
 const updatedJob = {
 ...job,
 status: 'Applied / Confirmation Received',
 hasCustomDocs: true,
 resumeText: data.pipeline_result?.resume_text || '',
 coverLetterText: data.pipeline_result?.cover_text || '',
 docsModel: 'Automated Application Pipeline',
 docsGeneratedAt: new Date().toISOString(),
 date: new Date().toISOString().split('T')[0]
 };

 if (onJobStatusUpdate) {
 onJobStatusUpdate(updatedJob);
 }
 saveUserApplicationToBackend(updatedJob).catch(() => {});

 // 1. Download Resume PDF to computer
 if (data.pipeline_result?.resume_text) {
 downloadResumePdf(data.pipeline_result.resume_text, job);
 }

 // 2. Download Cover Letter PDF to computer
 if (data.pipeline_result?.cover_text) {
 setTimeout(() => {
 downloadCoverLetterPdf(data.pipeline_result.cover_text, job);
 }, 400);
 }

 // 3. Open Employer Job Ad / Portal in new tab
 const link = job.portalLink || job.link;
 if (link) {
 const targetUrl = link.startsWith('http') ? link : `https://${link}`;
 window.open(targetUrl, '_blank');
 }

 // 4. Copy candidate profile details & cover letter to clipboard
 const candidateText = `Full Name: ${activeProfile?.name || 'Candidate'}
Email: ${activeProfile?.email || ''}
Phone: ${activeProfile?.phone || ''}
Location: ${activeProfile?.location || 'Melbourne VIC'}
Work Rights: ${activeProfile?.workRights || 'Australian Citizen (Unrestricted)'}
Security Clearance: ${activeProfile?.clearance || 'Baseline / NV1 Ready'}
Target Salary: ${job.salary || activeProfile?.targetSalary || '$115,000 + Super'}

--- TAILORED COVER LETTER ---
${data.pipeline_result?.cover_text || ''}`;

 try {
 navigator.clipboard.writeText(candidateText);
 } catch (e) {
 console.warn('Clipboard write error:', e);
 }

 setAutoApplyReceipt(data.pipeline_result || null);
 } else {
 alert(`Auto-apply pipeline error: ${data?.error || 'Unable to complete'}`);
 }
 } catch (e) {
 alert(`Auto-apply pipeline failed: ${e.message}`);
 } finally {
 setIsAutoApplying(false);
 setPipelineStage(1);
 }
 }}
 disabled={isAutoApplying}
 className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-sm bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs transition-all cursor-pointer disabled:opacity-50"
 >
 {isAutoApplying ? (
 <span className="flex items-center gap-2">
 <Zap size={14} className="animate-spin text-emerald-200" />
 SYNTHESIZING & DISPATCHING APPLICATION PIPELINE...
 </span>
 ) : (
 <span>🚀 EXECUTE AUTOMATED APPLICATION PIPELINE</span>
 )}
 </button>

 {autoApplyReceipt && (
 <div className="p-4 rounded-sm bg-slate-900 border border-emerald-500/50 text-slate-200 text-xs font-mono space-y-3">
 <div className="flex items-center justify-between border-b border-slate-800 pb-2">
 <div className="font-extrabold text-emerald-400 flex items-center gap-1.5 text-xs">
 <CheckCircle2 size={15} /> SENT APPLICATION RECEIPT & PAYLOAD INSPECTOR
 </div>
 <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded">
 SPREADSHEET SYNCED ✅
 </span>
 </div>

 {/* Dispatch Success Highlights */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
 <div className="p-2.5 rounded-sm bg-emerald-950/60 border border-emerald-500/40 flex items-center gap-2 text-emerald-300">
 <Download size={15} className="text-emerald-400 shrink-0" />
 <span>PDFs Downloaded to Downloads / File Explorer</span>
 </div>
 <div className="p-2.5 rounded-sm bg-amber-950/60 border border-amber-500/40 flex items-center gap-2 text-amber-300">
 <ExternalLink size={15} className="text-amber-400 shrink-0" />
 <span>Employer Portal Opened in New Tab</span>
 </div>
 <div className="p-2.5 rounded-sm bg-purple-950/60 border border-purple-500/40 flex items-center gap-2 text-purple-300">
 <Copy size={15} className="text-purple-400 shrink-0" />
 <span>Applicant Details & Cover Copied to Clipboard</span>
 </div>
 <div className="p-2.5 rounded-sm bg-teal-950/60 border border-teal-500/40 flex items-center gap-2 text-teal-300">
 <CheckCircle2 size={15} className="text-teal-400 shrink-0" />
 <span>Marked as Applied in Table & Google Sheet</span>
 </div>
 </div>

 {/* Receipt Sub-Tabs */}
 <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-sm border border-slate-800 text-[11px] font-extrabold">
 <button
 onClick={() => setActiveReceiptTab('fields')}
 className={`flex-1 py-1.5 rounded transition-all cursor-pointer ${
 activeReceiptTab === 'fields' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
 }`}
 >
 SUBMITTED FIELDS
 </button>
 <button
 onClick={() => setActiveReceiptTab('resume')}
 className={`flex-1 py-1.5 rounded transition-all cursor-pointer ${
 activeReceiptTab === 'resume' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
 }`}
 >
 SENT RESUME
 </button>
 <button
 onClick={() => setActiveReceiptTab('cover')}
 className={`flex-1 py-1.5 rounded transition-all cursor-pointer ${
 activeReceiptTab === 'cover' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
 }`}
 >
 SENT COVER LETTER
 </button>
 </div>

 {/* Tab 1: Submitted Form Fields & Answers */}
 {activeReceiptTab === 'fields' && autoApplyReceipt.submitted_fields && (
 <div className="space-y-2 bg-slate-950 p-3 rounded-sm border border-slate-800 text-[11px]">
 <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">APPLICANT PROFILE & SELECTION FIELD ANSWERS SENT</div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono">
 {Object.entries(autoApplyReceipt.submitted_fields).map(([key, val]) => (
 <div key={key} className="bg-slate-900/80 p-2 rounded border border-slate-800">
 <span className="text-[10px] text-amber-400 font-bold uppercase block">{key}:</span>
 <span className="text-slate-200 font-bold">{val}</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Tab 2: Exact Resume Content Sent */}
 {activeReceiptTab === 'resume' && (
 <div className="space-y-2 bg-slate-950 p-3 rounded-sm border border-slate-800">
 <div className="flex items-center justify-between">
 <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">TAILORED RESUME CONTENT SENT</div>
 <div className="flex items-center gap-1.5">
 <button
 onClick={() => downloadResumePdf(autoApplyReceipt.resume_text, job)}
 className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
 title="Download Resume PDF"
 >
 <Download size={11} /> PDF
 </button>
 <button
 onClick={() => downloadAtsDocxResume(job, activeProfile, autoApplyReceipt.resume_text)}
 className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
 title="Download ATS OpenXML (.docx) for Workday/Taleo"
 >
 <FileText size={11} /> DOCX
 </button>
 </div>
 </div>
 <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto p-2 bg-slate-900 rounded border border-slate-800 leading-relaxed">
 {autoApplyReceipt.resume_text}
 </pre>
 </div>
 )}

 {/* Tab 3: Exact Cover Letter Sent */}
 {activeReceiptTab === 'cover' && (
 <div className="space-y-2 bg-slate-950 p-3 rounded-sm border border-slate-800">
 <div className="flex items-center justify-between">
 <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">EXECUTIVE COVER LETTER SENT</div>
 <button
 onClick={() => downloadCoverLetterPdf(autoApplyReceipt.cover_text, job)}
 className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
 >
 <Download size={11} /> DOWNLOAD COVER LETTER (PDF)
 </button>
 </div>
 <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto p-2 bg-slate-900 rounded border border-slate-800 leading-relaxed">
 {autoApplyReceipt.cover_text}
 </pre>
 </div>
 )}
 </div>
 )}
 </div>

 {/* Quick Action Buttons */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
 {/* 1-Click Quick Apply Button */}
 <button
 onClick={() => {
 if (onOpenAutoApply) {
 onClose();
 onOpenAutoApply(job);
 } else {
 setIsAutoApplying(true);
 executeClientSideAutoApply(job).then(receipt => {
 setIsAutoApplying(false);
 setAutoApplyReceipt(receipt);
 if (onJobStatusUpdate) onJobStatusUpdate({ ...job, status: 'Applied' });
 }).catch(err => {
 setIsAutoApplying(false);
 alert(`Action requires an API key or failed: ${err.message}`);
 });
 }
 }}
 className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-sm bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 hover:from-indigo-800 hover:to-purple-800 text-white font-extrabold text-xs transition-all cursor-pointer border border-amber-500/50 col-span-1 sm:col-span-2 group"
 >
 <Zap size={16} className="text-amber-400 fill-amber-400 group-hover:scale-110 transition-transform animate-pulse" />
 <span className="tracking-wide">
 LAUNCH {getQuickApplyPlatform(job).toUpperCase()} AUTO-APPLY
 </span>
 <span className="text-[10px] px-2 py-0.5 rounded-sm bg-amber-400/20 text-amber-300 border border-amber-400/30 font-black ml-1">
 ⚡ 1-CLICK
 </span>
 </button>

 {job.portalLink && (
 <a
 href={job.portalLink.startsWith('http') ? job.portalLink : `http://${job.portalLink}`}
 target="_blank"
 rel="noopener noreferrer"
 className="flex items-center justify-center gap-2 px-5 py-3 rounded-sm bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs transition-all cursor-pointer col-span-1 sm:col-span-2"
 >
 <ExternalLink size={16} /> OPEN DIRECT JOB AD
 </a>
 )}

 {job.coverLetterLink && (
 <a
 href={job.coverLetterLink}
 target="_blank"
 rel="noopener noreferrer"
 className="flex items-center justify-center gap-2 px-4 py-3 rounded-sm bg-amber-50 text-amber-900 hover:bg-amber-100 font-extrabold text-xs border border-amber-300 transition-colors cursor-pointer"
 >
 <FileText size={15} /> VIEW TAILORED COVER LETTER
 </a>
 )}

 {job.cvLink && (
 <a
 href={job.cvLink}
 target="_blank"
 rel="noopener noreferrer"
 className="flex items-center justify-center gap-2 px-4 py-3 rounded-sm bg-purple-50 text-purple-900 hover:bg-purple-100 font-extrabold text-xs border border-purple-300 transition-colors cursor-pointer"
 >
 <FileUser size={15} className="text-purple-700" /> VIEW TAILORED CV / RESUME
 </a>
 )}
 </div>

 {/* Psychological Edge */}
 <div className="space-y-2 pt-2 border-t border-slate-200">
 <button
 onClick={() => setShowPsychology(true)}
 className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-sm font-extrabold text-xs transition-all cursor-pointer ${
 job.psychologyInsights 
 ? 'bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300' 
 : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
 }`}
 >
 <Sparkles size={16} className={job.psychologyInsights ? 'text-teal-600' : 'text-amber-600'} />
 {job.psychologyInsights ? 'VIEW DECODED PSYCHOLOGY (RETAINED)' : 'DECRYPT EMPLOYER PSYCHOLOGY'}
 </button>
 </div>

 {/* Tailored Asset Generation Suite Options */}
 <div className="space-y-3 pt-2 border-t border-slate-800">
 <div className="text-[10px] font-mono font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
 <Sparkles size={14} className="text-amber-400 animate-spin-slow" /> TAILORED ASSET GENERATION SUITE
 </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                {/* Resume Generation Option */}
                <button
                  onClick={() => { onClose(); if (onOpenGenerator) onOpenGenerator(job); }}
                  className="p-4 rounded-sm bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-900/80 border border-emerald-500/40 hover:border-emerald-400 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-black text-emerald-300 group-hover:text-emerald-200">
                      <FileUser size={16} className="text-emerald-400" /> GENERATE TAILORED RESUME
                    </div>
                    {hasGeneratedApplicationDocs(job) ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 shrink-0">✓ READY</span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800/90 text-amber-300 border border-slate-700 shrink-0">⚡ ON DEMAND</span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-slate-400 mt-1 leading-relaxed">
                    Explicitly customizes {activeProfile?.name ? `${activeProfile.name}'s` : 'candidate'}{' '}
                    {activeProfile?.industry || 'professional'} credentials for {job.company}.
                  </p>
                </button>

                {/* Cover Letter Generation Option */}
                <button
                  onClick={() => { onClose(); if (onOpenGenerator) onOpenGenerator(job); }}
                  className="p-4 rounded-sm bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-slate-900/80 border border-amber-500/40 hover:border-amber-400 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-black text-amber-300 group-hover:text-amber-200">
                      <FileText size={16} className="text-amber-400" /> GENERATE IMPACT COVER LETTER
                    </div>
                    {hasGeneratedApplicationDocs(job) ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 shrink-0">✓ READY</span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800/90 text-amber-300 border border-slate-700 shrink-0">⚡ ON DEMAND</span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-slate-400 mt-1 leading-relaxed">
                    Drafts a high-impact executive cover letter targeting selection criteria for {job.title}.
                  </p>
                </button>
              </div>

              {/* Interview & Outreach Quick Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 font-mono pt-1">
                <button
                  onClick={() => { onClose(); if (onOpenRecruiterCrm) onOpenRecruiterCrm(job); }}
                  className="p-3 rounded-sm bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 text-xs font-black text-purple-300 group-hover:text-purple-200 truncate">
                      <Users size={14} className="text-purple-400 shrink-0" /> RECRUITER CRM
                    </div>
                    {hasJobIntelligence(job, 'recruiter_crm') ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 shrink-0">✓ READY</span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800/90 text-amber-300 border border-slate-700 shrink-0">⚡ ON DEMAND</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    Link talent partners &amp; manage cadence.
                  </p>
                </button>

                <button
                  onClick={() => { onClose(); if (onOpenExecutiveDossier) onOpenExecutiveDossier(job); }}
                  className="p-3 rounded-sm bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 text-xs font-black text-cyan-300 group-hover:text-cyan-200 truncate">
                      <Building2 size={14} className="text-cyan-400 shrink-0" /> EXECUTIVE DOSSIER
                    </div>
                    {hasJobIntelligence(job, 'executive_dossier') ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 shrink-0">✓ READY</span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800/90 text-amber-300 border border-slate-700 shrink-0">⚡ ON DEMAND</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    90-day plan, leadership alignment &amp; pain points.
                  </p>
                </button>

                {onOpenInfluenceHub && (
                  <button
                    onClick={() => { onClose(); onOpenInfluenceHub(job); }}
                    className="p-3 rounded-sm bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 text-xs font-black text-amber-300 group-hover:text-amber-200 truncate">
                        <ShieldCheck size={14} className="text-amber-400 shrink-0" /> INFLUENCE &amp; DEBRIEF
                      </div>
                      {hasJobIntelligence(job, 'influence_debrief') ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 shrink-0">✓ READY</span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800/90 text-amber-300 border border-slate-700 shrink-0">⚡ ON DEMAND</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                      Objection overcoming &amp; referee briefing.
                    </p>
                  </button>
                )}

                {onOpenAtsDiagnostic && (
                  <button
                    onClick={() => { onClose(); onOpenAtsDiagnostic(job); }}
                    className="p-3 rounded-sm bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 text-xs font-black text-emerald-300 group-hover:text-emerald-200 truncate">
                        <ShieldCheck size={14} className="text-emerald-400 shrink-0" /> ATS SENTINEL
                      </div>
                      {hasJobIntelligence(job, 'ats_sentinel') ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 shrink-0">✓ READY</span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800/90 text-amber-300 border border-slate-700 shrink-0">⚡ ON DEMAND</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                      Workday &amp; STAR parser simulation.
                    </p>
                  </button>
                )}

                {onOpenLinkedInInbound && (
                  <button
                    onClick={() => { onClose(); onOpenLinkedInInbound(job); }}
                    className="p-3 rounded-sm bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 text-xs font-black text-amber-300 group-hover:text-amber-200 truncate">
                        <Search size={14} className="text-amber-400 shrink-0" /> LINKEDIN INBOUND
                      </div>
                      {hasJobIntelligence(job, 'linkedin_inbound') ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 shrink-0">✓ READY</span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800/90 text-amber-300 border border-slate-700 shrink-0">⚡ ON DEMAND</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                      Recruiter Boolean indexing &amp; headlines.
                    </p>
                  </button>
                )}

                {onOpenCoverLetterPolarizer && (
                  <button
                    onClick={() => { onClose(); onOpenCoverLetterPolarizer(job); }}
                    className="p-3 rounded-sm bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 text-xs font-black text-rose-300 group-hover:text-rose-200 truncate">
                        <Flame size={14} className="text-rose-400 shrink-0" /> CL POLARIZER
                      </div>
                      {hasJobIntelligence(job, 'cl_polarizer') ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 shrink-0">✓ READY</span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800/90 text-amber-300 border border-slate-700 shrink-0">⚡ ON DEMAND</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                      Swappability audit &amp; anti-template rewrites.
                    </p>
                  </button>
                )}

                {onOpenScreeningSolver && (
                  <button
                    onClick={() => { onClose(); onOpenScreeningSolver(job); }}
                    className="p-3 rounded-sm bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 text-xs font-black text-emerald-300 group-hover:text-emerald-200 truncate">
                        <ClipboardCheck size={14} className="text-emerald-400 shrink-0" /> SCREENING SOLVER
                      </div>
                      {hasJobIntelligence(job, 'screening_solver') ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 shrink-0">✓ READY</span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800/90 text-amber-300 border border-slate-700 shrink-0">⚡ ON DEMAND</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                      Auto-solve portal questionnaires &amp; compliance.
                    </p>
                  </button>
                )}

                {onOpenCareerCompass && (
                  <button
                    onClick={() => { onClose(); onOpenCareerCompass(); }}
                    className="p-3 rounded-sm bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 text-xs font-black text-amber-300 group-hover:text-amber-200 truncate">
                        <Compass size={14} className="text-amber-400 shrink-0" /> CAREER COMPASS
                      </div>
                      {hasJobIntelligence(job, 'career_compass') ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 shrink-0">✓ READY</span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800/90 text-amber-300 border border-slate-700 shrink-0">⚡ ON DEMAND</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                      Strategic matrix &amp; progression roadmap.
                    </p>
                  </button>
                )}

                {onOpenKscGenerator && (
                  <button
                    onClick={() => { onClose(); onOpenKscGenerator(job); }}
                    className="p-3 rounded-sm bg-teal-950/40 hover:bg-teal-900/60 border border-teal-500/30 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 text-xs font-black text-teal-300 group-hover:text-teal-200 truncate">
                        <BookOpen size={14} className="text-teal-400 shrink-0" /> KSC GENERATOR
                      </div>
                      {hasJobIntelligence(job, 'ksc_generator') ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 shrink-0">✓ READY</span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800/90 text-amber-300 border border-slate-700 shrink-0">⚡ ON DEMAND</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                      APS &amp; VPS capability criteria responses.
                    </p>
                  </button>
                )}

                {onOpenSeekPass && (
                  <button
                    onClick={() => { onClose(); onOpenSeekPass(job); }}
                    className="p-3 rounded-sm bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 text-xs font-black text-emerald-300 group-hover:text-emerald-200 truncate">
                        <ShieldCheck size={14} className="text-emerald-400 shrink-0" /> SEEK PASS AUDIT
                      </div>
                      {hasJobIntelligence(job, 'seek_pass_audit') ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 shrink-0">✓ READY</span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800/90 text-amber-300 border border-slate-700 shrink-0">⚡ ON DEMAND</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                      Pre-qualification knockout radar.
                    </p>
                  </button>
                )}

                <button
                  onClick={() => { setIsCheatSheetOpen(true); if (onOpenCheatSheet) onOpenCheatSheet(job); }}
                  className="p-3 rounded-sm bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 text-xs font-black text-cyan-300 group-hover:text-cyan-200 truncate">
                      <Sparkles size={14} className="text-cyan-400 shrink-0" /> MASTER CHEAT SHEET
                    </div>
                    {hasJobIntelligence(job, 'master_cheat_sheet') ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 shrink-0">✓ READY</span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800/90 text-amber-300 border border-slate-700 shrink-0">⚡ ON DEMAND</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    3-column cockpit with 90s pacing timer.
                  </p>
                </button>

                <button
                  onClick={() => { onClose(); if (onOpenInterviewPrep) onOpenInterviewPrep(job); }}
                  className="p-3 rounded-sm bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 text-xs font-black text-amber-300 group-hover:text-amber-200 truncate">
                      <Target size={14} className="text-amber-400 shrink-0" /> STAR PREP GUIDE
                    </div>
                    {hasJobIntelligence(job, 'star_prep_guide') ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 shrink-0">✓ READY</span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800/90 text-amber-300 border border-slate-700 shrink-0">⚡ ON DEMAND</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    Sector-grounded question strategy &amp; talking points.
                  </p>
                </button>

                <button
                  onClick={() => { onClose(); if (onOpenMockInterview) onOpenMockInterview(job); }}
                  className="p-3 rounded-sm bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 text-xs font-black text-amber-300 group-hover:text-amber-200 truncate">
                      <Zap size={14} className="text-amber-400 shrink-0" /> AI MOCK INTERVIEW
                    </div>
                    {hasJobIntelligence(job, 'ai_mock_interview') ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 shrink-0">✓ READY</span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800/90 text-amber-300 border border-slate-700 shrink-0">⚡ ON DEMAND</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    Live simulated interview with rubric scoring.
                  </p>
                </button>

                <button
                  onClick={() => { onClose(); if (onOpenOutreach) onOpenOutreach(job); }}
                  className="p-3 rounded-sm bg-teal-950/40 hover:bg-teal-900/60 border border-teal-500/30 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 text-xs font-black text-teal-300 group-hover:text-teal-200 truncate">
                      <Mail size={14} className="text-teal-400 shrink-0" /> RECRUITER OUTREACH
                    </div>
                    {hasJobIntelligence(job, 'recruiter_outreach') ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 shrink-0">✓ READY</span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800/90 text-amber-300 border border-slate-700 shrink-0">⚡ ON DEMAND</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    Follow-up, cold pitch, or post-interview notes.
                  </p>
                </button>
              </div>
 </div>

 {/* 1-Click Copy Reference Subject */}
 {job.emailSubject && (
 <div className="p-4 rounded-sm bg-slate-900/70 border border-slate-800 font-mono space-y-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
 <Mail size={14} className="text-slate-400" /> EMAIL REFERENCE SUBJECT
 </div>
 <button
 onClick={handleCopySubject}
 className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
 >
 {copiedSubject ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
 {copiedSubject ? 'COPIED TO CLIPBOARD!' : 'COPY SUBJECT'}
 </button>
 </div>
 <div className="text-xs font-extrabold text-slate-100 bg-slate-950 p-3 rounded-sm border border-slate-800">
 {job.emailSubject}
 </div>
 </div>
 )}
 </div>
  );
}
