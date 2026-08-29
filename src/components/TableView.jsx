import React from 'react';
import { Badge } from './Badge';
import { ExternalLink, FileText, DollarSign, MapPin, Award, Clock } from 'lucide-react';
import { parseISO, isValid, differenceInDays } from 'date-fns';

export const TableView = ({ jobs, onSelectJob }) => {
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
      <div className="bg-white rounded-xl p-12 text-center border border-slate-200 shadow-2xs font-mono text-xs text-slate-500 font-semibold">
        NO RECORDS MATCH CURRENT SELECTION FILTER.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden font-sans">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/80 border-b border-slate-200 text-xs font-mono font-extrabold text-slate-700 uppercase tracking-widest">
              <th scope="col" className="py-3.5 px-6">MATCH</th>
              <th scope="col" className="py-3.5 px-6">POSTED</th>
              <th scope="col" className="py-3.5 px-6">COMPANY & JOB TITLE</th>
              <th scope="col" className="py-3.5 px-6">LOCATION</th>
              <th scope="col" className="py-3.5 px-6">STATUS</th>
              <th scope="col" className="py-3.5 px-6">COMPENSATION</th>
              <th scope="col" className="py-3.5 px-6">SOURCE</th>
              <th scope="col" className="py-3.5 px-6 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 text-xs">
            {jobs.map((job) => (
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
                    {job.coverLetterLink && (
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
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 font-bold transition-colors shadow-2xs"
                        title="Apply Direct"
                      >
                        LINK <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
