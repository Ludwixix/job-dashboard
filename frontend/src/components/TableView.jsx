import React, { useState, useMemo } from 'react';
import { Badge } from './Badge';
import { 
  ExternalLink, FileText, DollarSign, MapPin, Award, Clock, Download, 
  ArrowUpDown, ArrowUp, ArrowDown, Mail, Sparkles, Check, Copy, ArrowRight,
  ShieldCheck, AlertCircle, Calendar
} from 'lucide-react';
import { parseISO, isValid, differenceInDays } from 'date-fns';
import { downloadResumePdf, downloadCoverLetterPdf } from '../utils/pdfGenerator';
import { hasGeneratedApplicationDocs } from '../services/generationService';
import { isValidTrackerJob, getCleanJobDescriptionBrief, getApplicationWorkflow } from '../services/trackerService';
import { FollowUpEmailModal } from './FollowUpEmailModal';

const getJobTimestamp = (job) => {
  if (job.appliedDate) {
    const t = new Date(job.appliedDate).getTime();
    if (!isNaN(t)) return t;
  }
  if (job.statusUpdatedAt) {
    const t = new Date(job.statusUpdatedAt).getTime();
    if (!isNaN(t)) return t;
  }
  if (job.date) {
    const t = new Date(job.date).getTime();
    if (!isNaN(t)) return t;
  }
  if (job.created_at) {
    const t = new Date(job.created_at).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
};

export const TableView = ({ jobs = [], onSelectJob, onResetDateFilter }) => {
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'
  const [activeFollowUpJob, setActiveFollowUpJob] = useState(null);
  const [copiedSubjectId, setCopiedSubjectId] = useState(null);

  const handleHeaderClick = (field) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'score' || field === 'date' ? 'desc' : 'asc');
    }
  };

  const validJobs = useMemo(() => {
    return (jobs || []).filter(isValidTrackerJob);
  }, [jobs]);

  const sortedJobs = useMemo(() => {
    return [...validJobs].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = getJobTimestamp(b) - getJobTimestamp(a);
      } else if (sortField === 'score') {
        comparison = (b.score || 0) - (a.score || 0);
      } else if (sortField === 'company') {
        comparison = (a.company || '').localeCompare(b.company || '');
      } else if (sortField === 'title') {
        comparison = (a.title || '').localeCompare(b.title || '');
      } else if (sortField === 'location') {
        comparison = (a.location || '').localeCompare(b.location || '');
      } else if (sortField === 'status') {
        comparison = (a.status || '').localeCompare(b.status || '');
      } else if (sortField === 'source') {
        comparison = (a.source || '').localeCompare(b.source || '');
      }
      return sortDir === 'asc' ? -comparison : comparison;
    });
  }, [validJobs, sortField, sortDir]);

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} className="text-slate-400 opacity-0 group-hover/th:opacity-100 transition-opacity" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp size={12} className="text-indigo-600" />
    ) : (
      <ArrowDown size={12} className="text-indigo-600" />
    );
  };

  const handleCopySubject = (e, job) => {
    e.stopPropagation();
    if (job.emailSubject) {
      navigator.clipboard.writeText(job.emailSubject);
      setCopiedSubjectId(job.id);
      setTimeout(() => setCopiedSubjectId(null), 2500);
    }
  };

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden font-sans">
        {/* Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/90 text-slate-700 text-[11px] font-mono font-extrabold uppercase tracking-wider select-none">
                <th scope="col" onClick={() => handleHeaderClick('score')} className="py-3.5 px-4 cursor-pointer hover:bg-slate-200/70 transition-colors group/th">
                  <div className="flex items-center gap-1">
                    <span>FIT</span>
                    {renderSortIcon('score')}
                  </div>
                </th>
                <th scope="col" onClick={() => handleHeaderClick('date')} className="py-3.5 px-4 cursor-pointer hover:bg-slate-200/70 transition-colors group/th">
                  <div className="flex items-center gap-1">
                    <span>APPLIED</span>
                    {renderSortIcon('date')}
                  </div>
                </th>
                <th scope="col" onClick={() => handleHeaderClick('company')} className="py-3.5 px-6 cursor-pointer hover:bg-slate-200/70 transition-colors group/th min-w-[280px]">
                  <div className="flex items-center gap-1">
                    <span>ROLE & EMPLOYER</span>
                    {renderSortIcon('company')}
                  </div>
                </th>
                <th scope="col" onClick={() => handleHeaderClick('status')} className="py-3.5 px-4 cursor-pointer hover:bg-slate-200/70 transition-colors group/th">
                  <div className="flex items-center gap-1">
                    <span>STAGE & STATUS</span>
                    {renderSortIcon('status')}
                  </div>
                </th>
                <th scope="col" className="py-3.5 px-6 min-w-[260px]">
                  <span>CURRENT & NEXT MOVE PLAYBOOK</span>
                </th>
                <th scope="col" className="py-3.5 px-4">
                  <span>COMPENSATION</span>
                </th>
                <th scope="col" className="py-3.5 px-6 text-right min-w-[200px]">
                  <span>ACTIONS & DIRECT LINKS</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-xs">
              {sortedJobs.map((job) => {
                const workflow = getApplicationWorkflow(job);
                const hasCustomDocs = hasGeneratedApplicationDocs(job);
                const isOffer = workflow.stageKey === 'offer';
                const isInterview = workflow.stageKey === 'interview';
                const portalUrl = job.portalLink || job.link || job.url;

                return (
                  <tr 
                    key={job.id} 
                    onClick={() => onSelectJob && onSelectJob(job)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    {/* 1. Fit Score */}
                    <td className="py-4 px-4 font-mono whitespace-nowrap align-top">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-300 shadow-2xs">
                        <Award size={12} className="text-emerald-600" />
                        {job.score || 85}%
                      </span>
                    </td>

                    {/* 2. Application Date / Age */}
                    <td className="py-4 px-4 font-mono text-slate-800 font-bold whitespace-nowrap align-top">
                      <div className="flex items-center gap-1.5 text-indigo-700 font-black">
                        <Clock size={13} className="text-indigo-600 shrink-0" />
                        {workflow.daysAgo === 0 ? 'Today' : `${workflow.daysAgo}d ago`}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                        {job.source || 'Direct Gateway'}
                      </div>
                    </td>

                    {/* 3. Role & Employer (with clean brief) */}
                    <td className="py-4 px-6 align-top">
                      <div className="space-y-1">
                        <div className="font-mono font-black text-slate-950 group-hover:text-indigo-600 transition-colors leading-snug text-sm">
                          {job.company}
                        </div>
                        <div className="text-slate-700 font-bold leading-tight">
                          {job.title}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 pt-0.5">
                          <span className="flex items-center gap-1">
                            <MapPin size={11} className="text-slate-400" />
                            {job.location || 'Melbourne, VIC'}
                          </span>
                          {job.remote && (
                            <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                              Remote
                            </span>
                          )}
                        </div>

                        {/* Clean Description Brief */}
                        <p className="text-[11px] text-slate-600 leading-relaxed pt-1 line-clamp-2">
                          {getCleanJobDescriptionBrief(job, 150)}
                        </p>

                        {/* Extracted Email Subject Reference (Click to copy) */}
                        {job.emailSubject && (
                          <div 
                            onClick={(e) => handleCopySubject(e, job)}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-mono font-bold cursor-pointer transition-colors mt-1"
                            title="Click to copy original email subject for Gmail search"
                          >
                            <Mail size={11} className="text-indigo-600" />
                            <span className="truncate max-w-[200px]">{job.emailSubject}</span>
                            {copiedSubjectId === job.id ? <Check size={11} className="text-emerald-600 shrink-0" /> : <Copy size={11} className="text-slate-400 shrink-0" />}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 4. Stage & Status */}
                    <td className="py-4 px-4 whitespace-nowrap align-top">
                      <div className="space-y-1.5">
                        <Badge status={job.status || workflow.stageLabel} />
                        {workflow.isFollowUpDue && (
                          <span className="flex items-center gap-1 text-[10px] font-mono font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-300 w-fit">
                            ✉️ FOLLOW-UP DUE
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 5. Current & Next Move Playbook */}
                    <td className="py-4 px-6 align-top">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 font-mono text-[11px]">
                        <div>
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">CURRENT STATE:</span>
                          <div className="text-slate-800 font-semibold leading-snug">{workflow.currentStep}</div>
                        </div>
                        <div className="pt-1.5 border-t border-slate-200/80">
                          <span className="text-[9px] font-black uppercase text-indigo-600 tracking-wider">NEXT MOVE:</span>
                          <div className="text-indigo-950 font-bold leading-snug flex items-start gap-1">
                            <span>{workflow.nextStep}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 6. Compensation */}
                    <td className="py-4 px-4 font-mono font-bold whitespace-nowrap align-top">
                      {job.salary ? (
                        <span className="inline-flex items-center gap-1 text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-300 shadow-2xs text-[11px]">
                          <DollarSign size={12} className="text-emerald-600" />
                          {job.salary}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Competitive</span>
                      )}
                    </td>

                    {/* 7. Actions & Direct Links */}
                    <td className="py-4 px-6 text-right whitespace-nowrap font-mono align-top" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex items-center gap-1.5">
                          {/* 1. Open Full Ad Card */}
                          <button
                            onClick={() => onSelectJob && onSelectJob(job)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition-colors shadow-2xs cursor-pointer"
                            title="Open Full Application Dossier & Actions"
                          >
                            <FileText size={12} /> CARD <ArrowRight size={11} />
                          </button>

                          {/* 2. Direct Job Portal Link */}
                          {portalUrl && (
                            <a
                              href={portalUrl.startsWith('http') ? portalUrl : `https://${portalUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 font-bold text-[11px] transition-colors shadow-2xs cursor-pointer"
                              title="Open original job posting"
                            >
                              AD <ExternalLink size={12} />
                            </a>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* 3. Follow-Up Outreach Drafter */}
                          <button
                            onClick={() => setActiveFollowUpJob(job)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-900 hover:bg-blue-100 font-bold text-[10px] border border-blue-300 transition-colors cursor-pointer"
                            title="Draft or send follow-up check-in email"
                          >
                            <Mail size={11} className="text-blue-700" /> EMAIL
                          </button>

                          {/* 4. Tailored Application PDFs */}
                          {hasCustomDocs && (
                            <>
                              <button
                                onClick={() => downloadResumePdf(job.resumeText, job)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-900 hover:bg-emerald-100 font-bold text-[10px] border border-emerald-300 transition-colors cursor-pointer"
                                title="Download Tailored Resume PDF"
                              >
                                <Download size={10} className="text-emerald-700" /> CV
                              </button>
                              <button
                                onClick={() => downloadCoverLetterPdf(job.coverLetterText, job)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 text-indigo-900 hover:bg-indigo-100 font-bold text-[10px] border border-indigo-300 transition-colors cursor-pointer"
                                title="Download Tailored Cover Letter PDF"
                              >
                                <Download size={10} className="text-indigo-700" /> COVER
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sortedJobs.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500 font-mono text-xs">
                    <div className="space-y-2">
                      <p className="font-bold">No applications found matching your active filter criteria.</p>
                      {onResetDateFilter && (
                        <button
                          onClick={onResetDateFilter}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer"
                        >
                          View All Historical Submissions
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Follow-up Email Modal */}
      {activeFollowUpJob && (
        <FollowUpEmailModal
          job={activeFollowUpJob}
          onClose={() => setActiveFollowUpJob(null)}
        />
      )}
    </>
  );
};
