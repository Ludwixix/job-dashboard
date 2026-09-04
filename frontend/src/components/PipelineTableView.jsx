import React, { useState } from 'react';
import { ArrowUpDown, Building2, Calendar, MapPin, ExternalLink, Sparkles } from 'lucide-react';
import { parseISO, format, isValid } from 'date-fns';

const formatDateSafe = (dateStr, formatStr = 'MMM d, yyyy') => {
  if (!dateStr) return '-';
  try {
    const parsed = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    if (isValid(parsed)) {
      return format(parsed, formatStr);
    }
  } catch {}
  return '-';
};

export const PipelineTableView = ({ jobs = [], onUpdateStatus, onSelectJob }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  const handleSort = (key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const sortedJobs = [...jobs].sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];

    if (sortConfig.key === 'date') {
      const dateA = a.applied_at || a.date || a.posted;
      const dateB = b.applied_at || b.date || b.posted;
      aVal = dateA ? new Date(dateA).getTime() : 0;
      bVal = dateB ? new Date(dateB).getTime() : 0;
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('reject') || s.includes('unsuccessful')) return 'bg-rose-950/60 text-rose-400 border-rose-800/50';
    if (s.includes('offer')) return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50';
    if (s.includes('interview')) return 'bg-amber-950/60 text-amber-400 border-amber-800/50';
    if (s.includes('applied')) return 'bg-indigo-950/60 text-indigo-400 border-indigo-800/50';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  return (
    <div className="w-full bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex flex-col h-full shadow-lg font-sans">
      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="w-full text-left text-sm text-slate-300 whitespace-nowrap">
          <thead className="text-xs text-slate-400 uppercase bg-slate-950/80 font-mono sticky top-0 z-10 border-b border-slate-800">
            <tr>
              <th className="px-6 py-4 font-bold cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('date')}>
                <div className="flex items-center gap-2">Applied Date <ArrowUpDown size={12} /></div>
              </th>
              <th className="px-6 py-4 font-bold cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('company')}>
                <div className="flex items-center gap-2">Company <ArrowUpDown size={12} /></div>
              </th>
              <th className="px-6 py-4 font-bold cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('title')}>
                <div className="flex items-center gap-2">Position / Role <ArrowUpDown size={12} /></div>
              </th>
              <th className="px-6 py-4 font-bold cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('location')}>
                <div className="flex items-center gap-2">Location <ArrowUpDown size={12} /></div>
              </th>
              <th className="px-6 py-4 font-bold cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('status')}>
                <div className="flex items-center gap-2">Status Stage <ArrowUpDown size={12} /></div>
              </th>
              <th className="px-6 py-4 font-bold text-right">
                <span>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {sortedJobs.map((job) => (
              <tr 
                key={job.id} 
                className="hover:bg-slate-800/60 transition-colors group cursor-pointer"
                onClick={() => onSelectJob && onSelectJob(job)}
              >
                <td className="px-6 py-4 font-mono text-xs text-slate-400">
                  {formatDateSafe(job.applied_at || job.date || job.posted)}
                </td>
                <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                  <Building2 size={14} className="text-indigo-400 shrink-0" />
                  <span>{job.company}</span>
                </td>
                <td className="px-6 py-4 text-slate-200 font-semibold truncate max-w-xs">
                  <div className="truncate">{job.title}</div>
                  {job.notes && (
                    <div className="text-[10px] text-slate-500 truncate max-w-xs">{job.notes}</div>
                  )}
                </td>
                <td className="px-6 py-4 text-slate-400 text-xs font-mono">
                  <div className="flex items-center gap-1.5 truncate max-w-[160px]">
                    <MapPin size={12} className="text-slate-500 shrink-0" />
                    <span className="truncate">{job.location || 'Melbourne, VIC'}</span>
                  </div>
                </td>
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={job.status || 'Discovered'}
                    onChange={(e) => onUpdateStatus && onUpdateStatus(job.id, e.target.value)}
                    className={`text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer ${getStatusColor(job.status)}`}
                  >
                    <option value="Discovered">Wishlist / Discovered</option>
                    <option value="Applied">Applied (In Review)</option>
                    <option value="Interviewing">Interviewing</option>
                    <option value="Offer Received">Offer Received</option>
                    <option value="Rejected">Rejected / Closed</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                  {(job.link || job.url) && (
                    <a
                      href={job.link || job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white inline-flex items-center gap-1 text-xs"
                      title="Open Job Portal"
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {sortedJobs.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-500 font-mono text-xs">
                  No applications match your active search or filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
