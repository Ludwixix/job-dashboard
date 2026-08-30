import React, { useState } from 'react';
import { ArrowUpDown, Building2, Calendar, MapPin } from 'lucide-react';
import { parseISO, format } from 'date-fns';

export const PipelineTableView = ({ jobs, onUpdateStatus, onSelectJob }) => {
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
      aVal = a.date ? new Date(a.date).getTime() : 0;
      bVal = b.date ? new Date(b.date).getTime() : 0;
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
    <div className="w-full bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex flex-col h-full shadow-lg">
      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="w-full text-left text-sm text-slate-300 whitespace-nowrap">
          <thead className="text-xs text-slate-400 uppercase bg-slate-950/50 font-mono sticky top-0 z-10 border-b border-slate-800">
            <tr>
              <th className="px-6 py-4 font-bold cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('date')}>
                <div className="flex items-center gap-2">Date <ArrowUpDown size={12} /></div>
              </th>
              <th className="px-6 py-4 font-bold cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('company')}>
                <div className="flex items-center gap-2">Company <ArrowUpDown size={12} /></div>
              </th>
              <th className="px-6 py-4 font-bold cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('title')}>
                <div className="flex items-center gap-2">Position <ArrowUpDown size={12} /></div>
              </th>
              <th className="px-6 py-4 font-bold cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('location')}>
                <div className="flex items-center gap-2">Location <ArrowUpDown size={12} /></div>
              </th>
              <th className="px-6 py-4 font-bold cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('status')}>
                <div className="flex items-center gap-2">Status <ArrowUpDown size={12} /></div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {sortedJobs.map((job) => (
              <tr 
                key={job.id} 
                className="hover:bg-slate-800/50 transition-colors group cursor-pointer"
                onClick={() => onSelectJob && onSelectJob(job)}
              >
                <td className="px-6 py-4 font-mono text-xs">
                  {job.date ? format(parseISO(job.date), 'MMM d, yyyy') : '-'}
                </td>
                <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                  <Building2 size={14} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
                  {job.company}
                </td>
                <td className="px-6 py-4 text-slate-200 font-semibold truncate max-w-xs">
                  {job.title}
                </td>
                <td className="px-6 py-4 text-slate-400 text-xs font-mono">
                  <div className="flex items-center gap-1.5 truncate max-w-[150px]">
                    <MapPin size={12} className="text-slate-500" />
                    <span className="truncate">{job.location || 'Remote'}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={job.status || 'Discovered'}
                    onChange={(e) => onUpdateStatus(job.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className={`text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer ${getStatusColor(job.status)}`}
                  >
                    <option value="Discovered">Wishlist</option>
                    <option value="Applied">Applied</option>
                    <option value="Interviewing">Interviewing</option>
                    <option value="Offer Received">Offer</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </td>
              </tr>
            ))}
            {sortedJobs.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-slate-500 font-mono text-sm border-dashed">
                  No applications found in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
