import React, { useMemo } from 'react';
import { ExternalLink, FileText, DollarSign, MapPin, Clock } from 'lucide-react';
import { parseISO, isValid, differenceInDays } from 'date-fns';

export const KanbanView = ({ jobs, statuses, onSelectJob }) => {
  const columns = statuses.filter(s => s !== 'All');

  const jobsByStatus = useMemo(() => {
    const acc = {};
    columns.forEach(c => acc[c] = []);
    jobs.forEach(job => {
      if (acc[job.status]) {
        acc[job.status].push(job);
      }
    });
    return acc;
  }, [jobs, columns]);

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

  return (
    <div className="flex gap-4 overflow-x-auto pb-6 h-[calc(100vh-220px)] items-start w-full font-sans">
      {columns.map(status => {
        const columnJobs = jobsByStatus[status] || [];
        return (
          <div 
            key={status} 
            className="bg-slate-200/60 border border-slate-300 rounded-xl flex-1 min-w-[280px] max-w-sm flex flex-col max-h-full"
          >
            {/* Column Header */}
            <div className="p-3.5 border-b border-slate-300 flex items-center justify-between bg-slate-100 rounded-t-xl font-mono">
              <h3 className="font-extrabold text-xs tracking-wider text-slate-800 uppercase truncate pr-2">{status}</h3>
              <span className="bg-slate-900 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                {columnJobs.length}
              </span>
            </div>

            {/* Column Cards */}
            <div className="p-3 overflow-y-auto space-y-3 flex-1">
              {columnJobs.map(job => (
                <div 
                  key={job.id} 
                  onClick={() => onSelectJob(job)}
                  className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                      {job.company}
                    </h4>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {job.coverLetterLink && (
                        <a 
                          href={job.coverLetterLink}
                          target="_blank" 
                          rel="noopener noreferrer"
                          title="Cover Letter"
                          className="p-1 text-slate-400 hover:text-indigo-600"
                        >
                          <FileText size={15} />
                        </a>
                      )}
                      {job.portalLink && (
                        <a 
                          href={job.portalLink.startsWith('http') ? job.portalLink : `http://${job.portalLink}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          title="Job Link"
                          className="p-1 text-slate-400 hover:text-indigo-600"
                        >
                          <ExternalLink size={15} />
                        </a>
                      )}
                    </div>
                  </div>

                  <p className="text-xs font-semibold text-slate-600 mb-2.5">{job.title}</p>

                  {job.salary && (
                    <div className="mb-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-50 text-emerald-900 border border-emerald-300">
                        <DollarSign size={11} className="text-emerald-600" />
                        {job.salary}
                      </span>
                    </div>
                  )}

                  {/* Location & Days Ago Posted */}
                  <div className="space-y-1 pt-2 border-t border-slate-100 text-[11px] font-mono font-bold text-slate-600">
                    <div className="flex items-center gap-1 truncate">
                      <MapPin size={12} className="text-slate-400 shrink-0" />
                      <span className="truncate">{job.location || 'Melbourne, VIC'}</span>
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <div className="flex items-center gap-1 text-indigo-700 font-extrabold">
                        <Clock size={12} className="text-indigo-600 shrink-0" />
                        POSTED {formatDaysAgo(job.date).toUpperCase()}
                      </div>
                      {job.source && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px]">
                          {job.source}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
