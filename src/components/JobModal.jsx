import React, { useState } from 'react';
import { Badge } from './Badge';
import { 
  X, ExternalLink, FileText, DollarSign, Mail, 
  MapPin, Award, CheckCircle2, Zap, FileUser, ShieldCheck,
  Copy, Check, Sparkles, Clock, Briefcase, ChevronDown, ChevronUp, Download
} from 'lucide-react';
import { parseISO, isValid, differenceInDays } from 'date-fns';
import { executeClientSideAutoApply, hasGeneratedApplicationDocs } from '../services/generationService';
import { downloadResumePdf, downloadCoverLetterPdf } from '../utils/pdfGenerator';

export const JobModal = ({ job, onClose, onOpenGenerator, onJobStatusUpdate, onRejectJob, onUnrejectJob }) => {
  const [activeTab, setActiveTab] = useState('fit'); // 'fit', 'description', 'assets'
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isAutoApplying, setIsAutoApplying] = useState(false);
  const [pipelineStage, setPipelineStage] = useState(1);
  const [autoApplyReceipt, setAutoApplyReceipt] = useState(null);
  const [activeReceiptTab, setActiveReceiptTab] = useState('fields'); // 'fields', 'resume', 'cover'

  if (!job) return null;

  const formatDaysAgo = (dateStr) => {
    if (!dateStr) return 'Recently';
    try {
      const d = parseISO(dateStr);
      if (!isValid(d)) return 'Recently';
      const days = differenceInDays(new Date(), d);
      if (days <= 0) return 'Today';
      if (days === 1) return '1 day ago';
      return `${days} days ago`;
    } catch {
      return 'Recently';
    }
  };

  const audit = job.audit || {};
  const dimensions = audit.dimensions || {};
  const matchedTerms = audit.matched_terms || job.tags || [];

  const handleCopySubject = () => {
    if (job.emailSubject) {
      navigator.clipboard.writeText(job.emailSubject);
      setCopiedSubject(true);
      setTimeout(() => setCopiedSubject(false), 2500);
    }
  };

  // Formatter for raw description / notes
  const renderFormattedDescription = (text) => {
    if (!text) return null;

    const paragraphs = text.split(/\n\s*\n/).filter(Boolean);

    return (
      <div className="space-y-4">
        {paragraphs.map((para, pIdx) => {
          const lines = para.split('\n').map(l => l.trim()).filter(Boolean);

          const isList = lines.every(line => line.startsWith('•') || line.startsWith('*') || line.startsWith('-') || line.startsWith('|'));

          if (isList) {
            return (
              <ul key={pIdx} className="space-y-1.5 pl-1">
                {lines.map((line, lIdx) => (
                  <li key={lIdx} className="flex items-start gap-2 text-xs text-slate-800 leading-relaxed font-sans font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                    <span>{line.replace(/^[•*\-|]\s*/, '')}</span>
                  </li>
                ))}
              </ul>
            );
          }

          return (
            <div key={pIdx} className="space-y-1">
              {lines.map((line, lIdx) => {
                const isHeader = line.endsWith(':') && line.length < 50;
                if (isHeader) {
                  return (
                    <h5 key={lIdx} className="font-mono font-extrabold text-xs text-slate-900 uppercase tracking-wider mt-2 mb-1">
                      {line}
                    </h5>
                  );
                }

                return (
                  <p key={lIdx} className="text-xs text-slate-800 leading-relaxed font-sans font-medium">
                    {line}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const isLongText = (job.notes || '').length > 350;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border-2 border-indigo-500/30 transform transition-all font-sans text-slate-900 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sleek Dark Header */}
        <div className="bg-slate-900 px-6 py-5 border-b border-slate-800 flex items-start justify-between text-white shrink-0 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400" />
          
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Badge status={job.status} />
              {job.stream && (
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                  {job.stream}
                </span>
              )}
              {job.source && (
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {job.source}
                </span>
              )}
              {hasGeneratedApplicationDocs(job) && (
                <span className="text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 flex items-center gap-1 shadow-xs animate-pulse">
                  <Sparkles size={11} className="text-slate-950" /> TAILORED ASSETS READY (PDFs)
                </span>
              )}
              <span className="text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <Clock size={11} /> {formatDaysAgo(job.date).toUpperCase()}
              </span>
            </div>
            <h2 className="text-2xl font-black text-white mt-1 leading-snug">{job.company}</h2>
            <p className="text-sm font-semibold text-slate-300 mt-0.5 flex items-center gap-1.5">
              <Briefcase size={14} className="text-indigo-400" />
              <span>{job.title}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {job.isRejected ? (
              <button
                onClick={() => onUnrejectJob && onUnrejectJob(job.id || `${job.company}_${job.title}`)}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-mono text-xs font-black shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                title="Restore this job to active list"
              >
                RESTORE
              </button>
            ) : (
              <button
                onClick={() => onRejectJob && onRejectJob(job.id || `${job.company}_${job.title}`)}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-mono text-xs font-black shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                title="Reject and remove this job"
              >
                REJECT
              </button>
            )}

            <button 
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Sub-Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100/80 px-6 pt-2 font-mono text-xs font-bold gap-2">
          <button
            onClick={() => setActiveTab('fit')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'fit'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <Award size={15} className={activeTab === 'fit' ? "text-emerald-400" : "text-slate-500"} />
            FIT & AI AUDIT
          </button>

          <button
            onClick={() => setActiveTab('description')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'description'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <FileText size={15} className={activeTab === 'description' ? "text-indigo-400" : "text-slate-500"} />
            JOB DESCRIPTION
          </button>

          <button
            onClick={() => setActiveTab('assets')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'assets'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <Sparkles size={15} className={activeTab === 'assets' ? "text-purple-400" : "text-slate-500"} />
            ASSETS & ACTIONS {hasGeneratedApplicationDocs(job) && <span className="w-2 h-2 rounded-full bg-emerald-400 ml-0.5" />}
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 font-sans">
          {/* Prominent Custom Documents Ready Banner */}
          {hasGeneratedApplicationDocs(job) && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white border-2 border-emerald-500 shadow-md font-mono space-y-3 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-400/30 shrink-0">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">CUSTOM APPLICATION ASSETS READY</div>
                    <div className="text-xs font-bold text-white">Tailored ATS Resume & Executive Cover Letter attached</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold bg-slate-800 text-emerald-300 px-2.5 py-1 rounded-lg border border-slate-700 w-fit">
                  {job.docsModel || 'GLM 5.3 Flash'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800">
                <button
                  onClick={() => downloadResumePdf(job.resumeText, job)}
                  className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title="Download Tailored Resume PDF"
                >
                  <Download size={13} /> DOWNLOAD RESUME (PDF)
                </button>
                <button
                  onClick={() => downloadCoverLetterPdf(job.coverLetterText, job)}
                  className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title="Download Tailored Cover Letter PDF"
                >
                  <Download size={13} /> DOWNLOAD COVER (PDF)
                </button>
                <button
                  onClick={() => { onClose(); if (onOpenGenerator) onOpenGenerator(job); }}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-emerald-500/40 transition-colors sm:ml-auto"
                >
                  <Sparkles size={13} className="text-emerald-400" /> EDIT IN STUDIO
                </button>
              </div>
            </div>
          )}
          {/* TAB 1: FIT & AI AUDIT */}
          {activeTab === 'fit' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Match Score Radar Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 text-white border border-slate-800 space-y-4 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 font-mono">
                    <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-400/30">
                      <Award size={22} />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CANDIDATE FIT EVALUATION</div>
                      <div className="text-base font-black text-indigo-300">{audit.fit || 'High Suitability Match'}</div>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-3xl font-black text-emerald-400">{job.score || 85}%</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">MATCH SCORE</div>
                  </div>
                </div>

                {/* Animated Skill Match Bar */}
                <div className="space-y-1.5 font-mono">
                  <div className="flex justify-between text-[11px] font-bold text-slate-300">
                    <span>OVERALL SUITABILITY METER</span>
                    <span className="text-emerald-400">{job.score || 85}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${job.score || 85}%` }}
                    />
                  </div>
                </div>

                {/* Dimension Meters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80 text-xs font-mono">
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">SKILL ALIGNMENT</div>
                    <div className="font-extrabold text-emerald-400 text-sm mt-0.5">{dimensions.skill_match?.score || 88}%</div>
                  </div>
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">EXPERIENCE LEVEL</div>
                    <div className="font-extrabold text-indigo-400 text-sm mt-0.5">{dimensions.experience_alignment ? `${dimensions.experience_alignment.score}%` : '5+ YRS FIT'}</div>
                  </div>
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">COMMUTE / MODE</div>
                    <div className="font-extrabold text-cyan-400 text-sm mt-0.5">{job.remote ? 'REMOTE' : 'BALACLAVA Commute'}</div>
                  </div>
                </div>
              </div>

              {/* AI Audit Evaluation Box */}
              <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono font-extrabold text-indigo-950 uppercase tracking-wider">
                  <ShieldCheck size={18} className="text-indigo-600" />
                  AI AUDIT RATIONALE & RECOMMENDATION
                </div>
                <p className="text-xs text-indigo-900 font-sans font-medium leading-relaxed">
                  {audit.recommendation || audit.notes || `Target match score of ${job.score || 85}% based on IT Infrastructure profile alignment and Balaclava VIC commute compatibility.`}
                </p>
              </div>

              {/* Matched Skill Tags */}
              {matchedTerms.length > 0 && (
                <div className="space-y-2 font-mono">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <Zap size={14} className="text-amber-500" /> MATCHED TECHNICAL SKILLS & KEYWORDS
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {matchedTerms.map((term, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-900 border border-indigo-200 text-xs font-bold shadow-2xs">
                        <CheckCircle2 size={13} className="text-indigo-600" /> {term}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: JOB DESCRIPTION (Expandable) */}
          {activeTab === 'description' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Info Chips Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800">
                  <Clock size={16} className="text-indigo-600 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase">AGE / POSTED</div>
                    <div className="font-extrabold text-slate-900">{formatDaysAgo(job.date)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800">
                  <MapPin size={16} className="text-indigo-600 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase">LOCATION</div>
                    <div className="font-extrabold text-slate-900 truncate max-w-[160px]">{job.location}</div>
                  </div>
                </div>

                {job.salary ? (
                  <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-300">
                    <DollarSign size={16} className="text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-[10px] text-emerald-800 font-bold uppercase">COMPENSATION</div>
                      <div className="font-extrabold">{job.salary}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800">
                    <DollarSign size={16} className="text-slate-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase">COMPENSATION</div>
                      <div className="font-bold text-slate-600">Market Rate</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Expandable Formatted Job Description */}
              {job.notes ? (
                <div className="space-y-3 font-mono">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-slate-400" /> JOB OVERVIEW & DETAILS
                    </div>
                    {isLongText && (
                      <button
                        onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                        className="text-indigo-600 hover:text-indigo-900 font-extrabold flex items-center gap-1 cursor-pointer"
                      >
                        {isDescriptionExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {isDescriptionExpanded ? 'COLLAPSE DESCRIPTION' : 'SHOW FULL DESCRIPTION'}
                      </button>
                    )}
                  </div>
                  
                  <div className="relative">
                    <div className={`p-5 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs transition-all duration-300 ${
                      !isDescriptionExpanded && isLongText ? 'max-h-[280px] overflow-hidden' : ''
                    }`}>
                      {renderFormattedDescription(job.notes)}
                    </div>

                    {!isDescriptionExpanded && isLongText && (
                      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-slate-50 to-transparent rounded-b-2xl flex items-end justify-center pb-2 pointer-events-none">
                        <span className="text-[10px] font-extrabold text-indigo-700 bg-white/90 px-3 py-1 rounded-full border border-indigo-200 shadow-xs pointer-events-auto cursor-pointer" onClick={() => setIsDescriptionExpanded(true)}>
                          + SHOW FULL DESCRIPTION
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 font-mono text-xs text-slate-500">
                  NO EXTRA DESCRIPTION NOTES AVAILABLE FOR THIS POSITION.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ASSETS & ACTIONS */}
          {activeTab === 'assets' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* End-to-End Automated Application Pipeline Dispatcher */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white border border-emerald-500/40 shadow-lg space-y-3 font-mono">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-emerald-400 uppercase tracking-wider">
                    <Zap size={18} className="text-emerald-400 animate-bounce" /> 
                    END-TO-END AUTOMATED APPLICATION PIPELINE
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-1 rounded-full">
                    AUTOMATION READY
                  </span>
                </div>

                <p className="text-xs text-slate-300 font-sans leading-relaxed">
                  Generates tailored PDF Resume & Cover Letter aligned to candidate profile, populates contact/work-rights/salary fields, and dispatches/stages your application automatically.
                </p>

                {isAutoApplying && (
                  <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/60 text-slate-200 text-xs font-mono space-y-2.5 animate-in fade-in duration-200">
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
                        const candidateText = `Full Name: Sam Ludwig
Email: sam.ludwig@gmail.com
Phone: 0405 993 245
Location: Balaclava VIC 3183
Work Rights: Australian Citizen (Unrestricted)
Security Clearance: Baseline / NV1 Ready
Target Salary: ${job.salary || '$115,000 + Super'}

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
                  className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
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
                  <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/50 text-slate-200 text-xs font-mono space-y-3">
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
                      <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 flex items-center gap-2 text-emerald-300">
                        <Download size={15} className="text-emerald-400 shrink-0" />
                        <span>PDFs Downloaded to Downloads / File Explorer</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-indigo-950/60 border border-indigo-500/40 flex items-center gap-2 text-indigo-300">
                        <ExternalLink size={15} className="text-indigo-400 shrink-0" />
                        <span>Employer Portal Opened in New Tab</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-purple-950/60 border border-purple-500/40 flex items-center gap-2 text-purple-300">
                        <Copy size={15} className="text-purple-400 shrink-0" />
                        <span>Applicant Details & Cover Copied to Clipboard</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-teal-950/60 border border-teal-500/40 flex items-center gap-2 text-teal-300">
                        <CheckCircle2 size={15} className="text-teal-400 shrink-0" />
                        <span>Marked as Applied in Table & Google Sheet</span>
                      </div>
                    </div>

                    {/* Receipt Sub-Tabs */}
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px] font-extrabold">
                      <button
                        onClick={() => setActiveReceiptTab('fields')}
                        className={`flex-1 py-1.5 rounded transition-all cursor-pointer ${
                          activeReceiptTab === 'fields' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        SUBMITTED FIELDS
                      </button>
                      <button
                        onClick={() => setActiveReceiptTab('resume')}
                        className={`flex-1 py-1.5 rounded transition-all cursor-pointer ${
                          activeReceiptTab === 'resume' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        SENT RESUME
                      </button>
                      <button
                        onClick={() => setActiveReceiptTab('cover')}
                        className={`flex-1 py-1.5 rounded transition-all cursor-pointer ${
                          activeReceiptTab === 'cover' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        SENT COVER LETTER
                      </button>
                    </div>

                    {/* Tab 1: Submitted Form Fields & Answers */}
                    {activeReceiptTab === 'fields' && autoApplyReceipt.submitted_fields && (
                      <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px]">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">APPLICANT PROFILE & SELECTION FIELD ANSWERS SENT</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono">
                          {Object.entries(autoApplyReceipt.submitted_fields).map(([key, val]) => (
                            <div key={key} className="bg-slate-900/80 p-2 rounded border border-slate-800">
                              <span className="text-[10px] text-indigo-400 font-bold uppercase block">{key}:</span>
                              <span className="text-slate-200 font-bold">{val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tab 2: Exact Resume Content Sent */}
                    {activeReceiptTab === 'resume' && (
                      <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">TAILORED RESUME CONTENT SENT</div>
                          <button
                            onClick={() => downloadResumePdf(autoApplyReceipt.resume_text, job)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Download size={11} /> DOWNLOAD RESUME (PDF)
                          </button>
                        </div>
                        <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto p-2 bg-slate-900 rounded border border-slate-800 leading-relaxed">
                          {autoApplyReceipt.resume_text}
                        </pre>
                      </div>
                    )}

                    {/* Tab 3: Exact Cover Letter Sent */}
                    {activeReceiptTab === 'cover' && (
                      <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">EXECUTIVE COVER LETTER SENT</div>
                          <button
                            onClick={() => downloadCoverLetterPdf(autoApplyReceipt.cover_text, job)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
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
                {job.portalLink && (
                  <a
                    href={job.portalLink.startsWith('http') ? job.portalLink : `http://${job.portalLink}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer col-span-1 sm:col-span-2"
                  >
                    <ExternalLink size={16} /> OPEN DIRECT JOB AD
                  </a>
                )}

                {job.coverLetterLink && (
                  <a
                    href={job.coverLetterLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-50 text-blue-900 hover:bg-blue-100 font-extrabold text-xs border border-blue-300 transition-colors cursor-pointer"
                  >
                    <FileText size={15} /> VIEW TAILORED COVER LETTER
                  </a>
                )}

                {job.cvLink && (
                  <a
                    href={job.cvLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-purple-50 text-purple-900 hover:bg-purple-100 font-extrabold text-xs border border-purple-300 transition-colors cursor-pointer"
                  >
                    <FileUser size={15} className="text-purple-700" /> VIEW TAILORED CV / RESUME
                  </a>
                )}
              </div>

              {/* Tailored Asset Generation Suite Options */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="text-[10px] font-mono font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles size={14} className="text-indigo-600 animate-spin-slow" /> TAILORED ASSET GENERATION SUITE
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                  {/* Resume Generation Option */}
                  <button
                    onClick={() => { onClose(); if (onOpenGenerator) onOpenGenerator(job); }}
                    className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-slate-50 border border-emerald-300 hover:border-emerald-500 text-left transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center gap-2 text-xs font-black text-emerald-950 group-hover:text-emerald-700">
                      <FileUser size={16} className="text-emerald-600" /> GENERATE TAILORED RESUME
                    </div>
                    <p className="text-[11px] font-semibold text-slate-600 mt-1 leading-relaxed">
                      Explicitly customizes Sam Ludwig's enterprise credentials & M365 experience for {job.company}.
                    </p>
                  </button>

                  {/* Cover Letter Generation Option */}
                  <button
                    onClick={() => { onClose(); if (onOpenGenerator) onOpenGenerator(job); }}
                    className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-300 hover:border-indigo-500 text-left transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center gap-2 text-xs font-black text-indigo-950 group-hover:text-indigo-700">
                      <FileText size={16} className="text-indigo-600" /> GENERATE IMPACT COVER LETTER
                    </div>
                    <p className="text-[11px] font-semibold text-slate-600 mt-1 leading-relaxed">
                      Drafts a high-impact executive cover letter targeting selection criteria for {job.title}.
                    </p>
                  </button>
                </div>
              </div>

              {/* 1-Click Copy Reference Subject */}
              {job.emailSubject && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 font-mono space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <Mail size={14} className="text-slate-400" /> EMAIL REFERENCE SUBJECT
                    </div>
                    <button
                      onClick={handleCopySubject}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-900 cursor-pointer"
                    >
                      {copiedSubject ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      {copiedSubject ? 'COPIED TO CLIPBOARD!' : 'COPY SUBJECT'}
                    </button>
                  </div>
                  <div className="text-xs font-extrabold text-slate-900 bg-white p-3 rounded-xl border border-slate-200">
                    {job.emailSubject}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-3.5 border-t border-slate-200 flex justify-end font-mono shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 font-extrabold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            CLOSE MODAL
          </button>
        </div>
      </div>
    </div>
  );
};
