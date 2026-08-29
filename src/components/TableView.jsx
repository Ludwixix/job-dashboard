import React, { useState, useMemo } from 'react';
import { Badge } from './Badge';
import { ExternalLink, FileText, DollarSign, MapPin, Award, Clock, Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { parseISO, isValid, differenceInDays } from 'date-fns';
import { downloadResumePdf, downloadCoverLetterPdf } from '../utils/pdfGenerator';
import { hasGeneratedApplicationDocs } from '../services/generationService';

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

export const TableView = ({ jobs, onSelectJob, onResetDateFilter }) => {
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'

  const handleHeaderClick = (field) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'score' || field === 'date' ? 'desc' : 'asc');
    }
  };

  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
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
  }, [jobs, sortField, sortDir]);

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

  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center border border-slate-200 shadow-2xs font-mono text-xs text-slate-500 font-semibold space-y-3">
        <div className="text-slate-600 font-bold">NO APPLICATION RECORDS MATCH THE CURRENT FILTER (DEFAULT: APPLIED TODAY).</div>
        {onResetDateFilter && (
          <button
            onClick={onResetDateFilter}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-mono text-xs font-black shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            VIEW ALL-TIME APPLICATION RECORDS
          </button>
        )}
      </div>
    );
  }

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown size={11} className="text-slate-400 opacity-60 group-hover/th:opacity-100" />;
    }
    return sortDir === 'desc' 
      ? <ArrowDown size={12} className="text-indigo-600" />
      : <ArrowUp size={12} className="text-indigo-600" />;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden font-sans">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/80 border-b border-slate-200 text-xs font-mono font-extrabold text-slate-700 uppercase tracking-widest select-none">
              <th scope="col" onClick={() => handleHeaderClick('score')} className="py-3.5 px-6 cursor-pointer hover:bg-slate-200/70 transition-colors group/th">
                <div className="flex items-center gap-1.5">
                  <span>MATCH</span>
                  {renderSortIcon('score')}
                </div>
              </th>
              <th scope="col" onClick={() => handleHeaderClick('date')} className="py-3.5 px-6 cursor-pointer hover:bg-slate-200/70 transition-colors group/th">
                <div className="flex items-center gap-1.5">
                  <span>APPLICATION DATE</span>
                  {renderSortIcon('date')}
                </div>
              </th>
              <th scope="col" onClick={() => handleHeaderClick('company')} className="py-3.5 px-6 cursor-pointer hover:bg-slate-200/70 transition-colors group/th">
                <div className="flex items-center gap-1.5">
                  <span>COMPANY & JOB TITLE</span>
                  {renderSortIcon('company')}
                </div>
              </th>
              <th scope="col" onClick={() => handleHeaderClick('location')} className="py-3.5 px-6 cursor-pointer hover:bg-slate-200/70 transition-colors group/th">
                <div className="flex items-center gap-1.5">
                  <span>LOCATION</span>
                  {renderSortIcon('location')}
                </div>
              </th>
              <th scope="col" onClick={() => handleHeaderClick('status')} className="py-3.5 px-6 cursor-pointer hover:bg-slate-200/70 transition-colors group/th">
                <div className="flex items-center gap-1.5">
                  <span>STATUS</span>
                  {renderSortIcon('status')}
                </div>
              </th>
              <th scope="col" className="py-3.5 px-6">COMPENSATION</th>
              <th scope="col" onClick={() => handleHeaderClick('source')} className="py-3.5 px-6 cursor-pointer hover:bg-slate-200/70 transition-colors group/th">
                <div className="flex items-center gap-1.5">
                  <span>SOURCE</span>
                  {renderSortIcon('source')}
                </div>
              </th>
              <th scope="col" className="py-3.5 px-6 text-right">ACTIONS & ASSETS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 text-xs">
            {sortedJobs.map((job) => {

              const hasCustomDocs = hasGeneratedApplicationDocs(job);
              return (
                <tr 
                  key={job.id} 
                  onClick={() => onSelectJob(job)}
                  className="hover:bg-slate-100/70 transition-colors cursor-pointer group"
                >
                  <td className="py-4 px-6 font-mono whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-300">
                      <Award size={12} className="text-emerald-600" />
                      {job.score || 85}%
                    </span>
                  </td>
                  <td className="py-4 px-6 font-mono text-slate-900 font-extrabold whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-indigo-700">
                      <Clock size={14} className="text-indigo-600 shrink-0" />
                      {formatDaysAgo(job.date)}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-mono font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                      {job.company}
                    </div>
                    <div className="text-slate-600 font-semibold mt-0.5 truncate max-w-md">
                      {job.title}
                    </div>
                  </td>
                  <td className="py-4 px-6 font-mono text-slate-700 font-semibold whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <MapPin size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate max-w-[150px]">{job.location}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    <Badge status={job.status} />
                  </td>
                  <td className="py-4 px-6 font-mono font-bold whitespace-nowrap">
                    {job.salary ? (
                      <span className="inline-flex items-center gap-1 text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                        <DollarSign size={12} className="text-emerald-600" />
                        {job.salary}
                      </span>
                    ) : (
                      <span className="text-slate-600">Competitive</span>
                    )}
                  </td>
                  <td className="py-4 px-6 font-mono text-slate-700 font-bold whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                      {job.source || 'Direct'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right whitespace-nowrap font-mono" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {hasCustomDocs && (
                        <>
                          <button
                            onClick={() => downloadResumePdf(job.resumeText, job)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition-colors shadow-2xs"
                            title="Download Tailored Resume PDF"
                          >
                            <Download size={11} /> RESUME
                          </button>
                          <button
                            onClick={() => downloadCoverLetterPdf(job.coverLetterText, job)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] transition-colors shadow-2xs"
                            title="Download Tailored Cover Letter PDF"
                          >
                            <Download size={11} /> COVER
                          </button>
                        </>
                      )}
                      {job.coverLetterLink && !hasCustomDocs && (
                        <a
                          href={job.coverLetterLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 text-indigo-900 hover:bg-indigo-100 font-bold border border-indigo-200 transition-colors"
                          title="View Cover Letter"
                        >
                          <FileText size={13} /> DOC
                        </a>
                      )}
                      {job.portalLink && (
                        <a
                          href={job.portalLink.startsWith('http') ? job.portalLink : `http://${job.portalLink}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 text-white hover:bg-indigo-600 font-bold transition-colors shadow-2xs"
                          title="Apply Direct"
                        >
                          PORTAL <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
