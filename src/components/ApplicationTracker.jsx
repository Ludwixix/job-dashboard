import React, { useState, useMemo } from 'react';
import { TableView } from './TableView';
import { KanbanView } from './KanbanView';
import { MetricsPanel } from './MetricsPanel';
import { 
  LayoutList, Kanban, Search, BarChart2,
  CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronUp, RotateCcw,
  Send, Calendar, ArrowUpRight
} from 'lucide-react';
import { parseISO, isValid, differenceInDays } from 'date-fns';

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

export const ApplicationTracker = ({ jobs, onSelectJob }) => {
  const [viewMode, setViewMode] = useState('table');
  const [showMetricsPanel, setShowMetricsPanel] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');

  // Recently Applied Submissions list (Sorted newest first)
  const recentlyAppliedJobs = useMemo(() => {
    return jobs
      .filter(job => {
        const s = (job.status || '').toLowerCase();
        return !s.includes('package prepared') && 
               !s.includes('to submit') && 
               !s.includes('discovered') &&
               !s.includes('draft');
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 8);
  }, [jobs]);

  // Interactive status category filtering (Default newest applications first)
  const trackerJobs = useMemo(() => {
    return jobs
      .filter(job => {
        const isTrackerJob = !job.status.toLowerCase().includes('package prepared') && 
                             !job.status.toLowerCase().includes('to submit');

        const matchesSearch = job.company.toLowerCase().includes(search.toLowerCase()) || 
                              job.title.toLowerCase().includes(search.toLowerCase());
        
        let matchesStatus = true;
        if (statusFilter !== 'All') {
          const s = job.status.toLowerCase();
          const f = statusFilter.toLowerCase();
          if (f.includes('interview')) {
            matchesStatus = s.includes('interview');
          } else if (f.includes('action required') || f.includes('verification')) {
            matchesStatus = s.includes('action required') || s.includes('verification');
          } else if (f.includes('closed') || f.includes('expired') || f.includes('unsuccessful')) {
            matchesStatus = s.includes('closed') || s.includes('expired') || s.includes('unsuccessful');
          } else {
            matchesStatus = job.status === statusFilter;
          }
        }

        const matchesSource = sourceFilter === 'All' || job.source === sourceFilter;

        return isTrackerJob && matchesSearch && matchesStatus && matchesSource;
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [jobs, search, statusFilter, sourceFilter]);

  const trackerStats = useMemo(() => {
    const totalSubmitted = jobs.filter(j => 
      !j.status.toLowerCase().includes('package prepared') && 
      !j.status.toLowerCase().includes('to submit')
    ).length;

    const interviews = jobs.filter(j => j.status.toLowerCase().includes('interview')).length;
    
    const actionRequired = jobs.filter(j => 
      j.status.toLowerCase().includes('action required') || 
      j.status.toLowerCase().includes('verification')
    ).length;

    const unsuccessful = jobs.filter(j => 
      j.status.toLowerCase().includes('unsuccessful') || 
      j.status.toLowerCase().includes('closed') ||
      j.status.toLowerCase().includes('expired')
    ).length;

    return { totalSubmitted, interviews, actionRequired, unsuccessful };
  }, [jobs]);

  const trackerStatuses = useMemo(() => {
    const s = new Set(jobs
      .filter(j => !j.status.toLowerCase().includes('package prepared') && !j.status.toLowerCase().includes('to submit'))
      .map(j => j.status)
      .filter(Boolean)
    );
    return ['All', ...Array.from(s)];
  }, [jobs]);

  const trackerSources = useMemo(() => {
    const s = new Set(jobs.map(j => j.source).filter(Boolean));
    return ['All', ...Array.from(s)];
  }, [jobs]);

  const toggleCategoryFilter = (targetCategory) => {
    if (statusFilter.toLowerCase().includes(targetCategory.toLowerCase())) {
      setStatusFilter('All');
    } else {
      setStatusFilter(targetCategory);
    }
  };

  const isInterviewActive = statusFilter.toLowerCase().includes('interview');
  const isActionActive = statusFilter.toLowerCase().includes('action required') || statusFilter.toLowerCase().includes('verification');
  const isAllActive = statusFilter === 'All';

  return (
    <div className="space-y-6 font-sans text-slate-100">
      {/* Interactive Status Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        {/* Submitted Card */}
        <div 
          onClick={() => setStatusFilter('All')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            isAllActive 
              ? 'bg-[#1e1e2e] text-white border-purple-400 shadow-md ring-2 ring-purple-500/30' 
              : 'bg-[#181825] text-slate-300 border-[#313244] hover:border-purple-400/50 shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded ${isAllActive ? 'bg-purple-600 text-white' : 'bg-purple-950 text-purple-300'}`}>
              <Clock size={16} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">SUBMITTED</div>
              <div className="text-xl font-black text-white">{trackerStats.totalSubmitted}</div>
            </div>
          </div>
        </div>

        {/* Interviews Card */}
        <div 
          onClick={() => toggleCategoryFilter('Interview')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            isInterviewActive 
              ? 'bg-emerald-950 text-white border-emerald-400 shadow-md ring-2 ring-emerald-500/30' 
              : 'bg-[#181825] text-slate-300 border-[#313244] hover:border-emerald-400/50 shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded ${isInterviewActive ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-emerald-950 text-emerald-300'}`}>
              <CheckCircle2 size={16} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">INTERVIEWS</div>
              <div className="text-xl font-black text-emerald-300">{trackerStats.interviews}</div>
            </div>
          </div>
        </div>

        {/* Action Required Card */}
        <div 
          onClick={() => toggleCategoryFilter('Action Required')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            isActionActive 
              ? 'bg-amber-950 text-white border-amber-400 shadow-md ring-2 ring-amber-500/30' 
              : 'bg-[#181825] text-slate-300 border-[#313244] hover:border-amber-400/50 shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded ${isActionActive ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-amber-950 text-amber-300'}`}>
              <AlertCircle size={16} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">ACTION REQD</div>
              <div className="text-xl font-black text-amber-300">{trackerStats.actionRequired}</div>
            </div>
          </div>
        </div>

        {/* Closed Card */}
        <div 
          onClick={() => toggleCategoryFilter('Closed')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all bg-[#181825] text-slate-300 border-[#313244] hover:border-slate-500 shadow-2xs`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-slate-900 text-slate-400">
              <Clock size={16} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">CLOSED / OTHER</div>
              <div className="text-xl font-black text-slate-400">{trackerStats.unsuccessful}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Category Banner */}
      {!isAllActive && (
        <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-400/40 text-xs font-mono font-bold text-purple-200 flex items-center justify-between animate-in fade-in duration-200">
          <span>ACTIVE CATEGORY FILTER: <span className="text-purple-300 uppercase">{statusFilter}</span></span>
          <button
            onClick={() => setStatusFilter('All')}
            className="inline-flex items-center gap-1 text-[11px] text-purple-300 hover:text-white underline cursor-pointer"
          >
            <RotateCcw size={12} /> Reset Filter
          </button>
        </div>
      )}

      {/* 2-Column Application Tracker Layout (Left Recently Applied Sidebar + Right Content) */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        {/* LEFT COLUMN: RECENTLY APPLIED SIDEBAR */}
        <aside className="w-full lg:w-80 shrink-0 space-y-3 font-mono">
          <div className="bg-[#181825] rounded-2xl p-4 border border-[#313244] shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-[#313244] pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-purple-500/20 text-purple-300 border border-purple-400/30">
                  <Send size={15} className="text-purple-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xs text-white uppercase tracking-wider">
                    RECENTLY APPLIED
                  </h3>
                  <div className="text-[9px] text-slate-400 font-bold">DISPATCHED SUBMISSIONS</div>
                </div>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-purple-600 text-white">
                {recentlyAppliedJobs.length}
              </span>
            </div>

            {/* List of Recently Applied Cards */}
            <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
              {recentlyAppliedJobs.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 font-mono">
                  No submissions logged yet.
                </div>
              ) : (
                recentlyAppliedJobs.map(job => {
                  const daysAgoStr = formatDaysAgo(job.date);
                  const isInterview = (job.status || '').toLowerCase().includes('interview');
                  const isConfirmation = (job.status || '').toLowerCase().includes('confirmation') || (job.status || '').toLowerCase().includes('applied');

                  return (
                    <div
                      key={job.id || `${job.company}_${job.title}`}
                      onClick={() => onSelectJob && onSelectJob(job)}
                      className="p-3 rounded-xl bg-[#1e1e2e] border border-[#313244] hover:border-purple-400/60 transition-all cursor-pointer group hover:shadow-md space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-black text-white truncate group-hover:text-purple-300 transition-colors">
                            {job.title}
                          </div>
                          <div className="text-[11px] font-bold text-slate-400 truncate">
                            {job.company}
                          </div>
                        </div>
                        <ArrowUpRight size={14} className="text-slate-500 group-hover:text-purple-400 shrink-0 transition-colors" />
                      </div>

                      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-[#313244]/80">
                        <span className={`px-2 py-0.5 rounded font-extrabold ${
                          isInterview 
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                            : isConfirmation
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-400/40'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {job.status}
                        </span>

                        <span className="text-slate-400 font-bold flex items-center gap-1">
                          <Calendar size={10} className="text-purple-400" />
                          {daysAgoStr}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN: MAIN TRACKER CONTENT */}
        <div className="flex-1 space-y-6 w-full">
          {/* Detailed Metrics Panel Toggle */}
          <div className="flex justify-end font-mono">
            <button
              onClick={() => setShowMetricsPanel(!showMetricsPanel)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#181825] border border-[#313244] text-xs font-bold text-slate-200 hover:text-purple-300 hover:border-purple-400/50 transition-colors cursor-pointer"
            >
              <BarChart2 size={14} className="text-purple-400" />
              {showMetricsPanel ? "HIDE ADVANCED ANALYTICS" : "SHOW ADVANCED ANALYTICS"}
              {showMetricsPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {/* Advanced Metrics Panel */}
          {showMetricsPanel && (
            <MetricsPanel jobs={jobs} />
          )}

          {/* Control Bar: View Toggle & Search/Filter */}
          <div className="bg-[#181825] p-4 rounded-xl border border-[#313244] shadow-2xs flex flex-col sm:flex-row gap-4 justify-between items-center font-mono">
            <div className="flex items-center space-x-1 bg-[#1e1e2e] p-1 rounded-lg border border-[#313244] w-full sm:w-auto">
              <button 
                onClick={() => setViewMode('table')}
                className={`flex-1 sm:flex-none flex items-center justify-center px-3.5 py-1.5 rounded text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  viewMode === 'table' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutList size={14} className="mr-1.5" /> TABLE VIEW
              </button>
              <button 
                onClick={() => setViewMode('kanban')}
                className={`flex-1 sm:flex-none flex items-center justify-center px-3.5 py-1.5 rounded text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  viewMode === 'kanban' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Kanban size={14} className="mr-1.5" /> KANBAN BOARD
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1 max-w-2xl">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-2.5 text-purple-400" />
                <input
                  type="text"
                  placeholder="SEARCH SUBMITTED JOBS..."
                  className="w-full pl-9 pr-3 py-1.5 border border-[#313244] rounded bg-[#1e1e2e] text-xs font-mono font-semibold text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-400"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <select
                  className="px-3 py-1.5 text-xs font-mono font-extrabold border border-[#313244] rounded bg-[#1e1e2e] text-slate-200 focus:outline-none focus:border-purple-400 cursor-pointer"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {trackerStatuses.map(s => <option key={s} value={s}>{s === 'All' ? 'ALL STATUSES' : s.toUpperCase()}</option>)}
                </select>

                <select
                  className="px-3 py-1.5 text-xs font-mono font-extrabold border border-[#313244] rounded bg-[#1e1e2e] text-slate-200 focus:outline-none focus:border-purple-400 cursor-pointer"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                >
                  {trackerSources.map(s => <option key={s} value={s}>{s === 'All' ? 'ALL SOURCES' : s.toUpperCase()}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Main View Display */}
          {viewMode === 'table' ? (
            <TableView jobs={trackerJobs} onSelectJob={onSelectJob} />
          ) : (
            <KanbanView jobs={trackerJobs} statuses={trackerStatuses} onSelectJob={onSelectJob} />
          )}
        </div>
      </div>
    </div>
  );
};
