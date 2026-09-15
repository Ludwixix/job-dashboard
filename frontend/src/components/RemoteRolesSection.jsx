import React, { useState, useMemo } from 'react';
import { 
  Globe, 
  MapPin, 
  DollarSign, 
  Sparkles, 
  ExternalLink, 
  Building2, 
  Clock, 
  Search, 
  Filter, 
  CheckCircle2, 
  Wifi, 
  TrendingUp,
  SlidersHorizontal,
  Briefcase,
  Compass
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';

export const RemoteRolesSection = ({ 
  jobs = [], 
  onSelectJob, 
  onOpenGenerator, 
  onOpenMockInterview,
  onOpenCheatSheet
}) => {
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('all'); // 'all', 'au', 'global'
  const [streamFilter, setStreamFilter] = useState('all');
  const [minSalaryFilter, setMinSalaryFilter] = useState(false);

  // Filter for strictly genuine remote positions
  const remoteJobs = useMemo(() => {
    return jobs.filter(j => {
      const isRemote = Boolean(j.remote) || 
                       String(j.location || '').toLowerCase().includes('remote') ||
                       String(j.title || '').toLowerCase().includes('remote') ||
                       String(j.workArrangement || '').toLowerCase().includes('remote') ||
                       String(j.source || '').toLowerCase().includes('remoteok');
      return isRemote;
    });
  }, [jobs]);

  // Telemetry metrics
  const telemetry = useMemo(() => {
    const total = remoteJobs.length;
    let auCount = 0;
    let globalCount = 0;
    let totalScore = 0;
    let salaryCount = 0;
    let salarySum = 0;

    remoteJobs.forEach(j => {
      const loc = String(j.location || '').toLowerCase();
      if (loc.includes('australia') || loc.includes('melbourne') || loc.includes('sydney') || loc.includes('brisbane') || loc.includes('perth') || loc.includes('apac') || loc.includes('vic') || loc.includes('nsw')) {
        auCount++;
      } else {
        globalCount++;
      }
      totalScore += Number(j.score || 0);

      const sal = j.salary_min || j.salaryMin || (typeof j.salary === 'number' ? j.salary : null);
      if (sal && sal > 10000) {
        salarySum += sal;
        salaryCount++;
      }
    });

    return {
      total,
      auCount,
      globalCount,
      avgScore: total > 0 ? Math.round(totalScore / total) : 0,
      avgSalary: salaryCount > 0 ? Math.round(salarySum / salaryCount) : 135000,
    };
  }, [remoteJobs]);

  // Filtered remote job collection
  const filteredJobs = useMemo(() => {
    return remoteJobs.filter(j => {
      const loc = String(j.location || '').toLowerCase();
      const title = String(j.title || '').toLowerCase();
      const company = String(j.company || '').toLowerCase();
      const desc = String(j.description || j.notes || '').toLowerCase();

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matches = title.includes(q) || company.includes(q) || loc.includes(q) || desc.includes(q);
        if (!matches) return false;
      }

      // Region filter
      const isAu = loc.includes('australia') || loc.includes('melbourne') || loc.includes('sydney') || loc.includes('brisbane') || loc.includes('vic') || loc.includes('nsw');
      if (regionFilter === 'au' && !isAu) return false;
      if (regionFilter === 'global' && isAu) return false;

      // Stream filter
      if (streamFilter !== 'all') {
        const s = String(j.stream || j.industry || '').toLowerCase();
        if (!s.includes(streamFilter.toLowerCase())) return false;
      }

      // Salary filter ($130k+)
      if (minSalaryFilter) {
        const sal = j.salary_max || j.salary_min || 0;
        if (sal > 0 && sal < 130000) return false;
      }

      return true;
    });
  }, [remoteJobs, search, regionFilter, streamFilter, minSalaryFilter]);

  return (
    <div className="w-full space-y-6 font-sans">
      {/* Remote Spotlight Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/40 border border-slate-800 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-950/80 border border-teal-500/30 text-teal-300 text-xs font-mono font-bold tracking-wider uppercase">
              <Globe size={13} className="text-teal-400 animate-spin-slow" />
              Global & Distributed Talent Gateway
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-mono">
              REMOTE ROLES <span className="text-teal-400">INDEX</span>
            </h2>
            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
              Curated, high-signal remote opportunities with zero commute friction. Cross-indexed from RemoteOK, Seek Remote, and Indeed Australia.
            </p>
          </div>

          {/* Metric Telemetry Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex flex-col">
              <span className="text-[10px] uppercase text-slate-400 font-bold">Total Remote</span>
              <span className="text-xl font-black text-white">{telemetry.total}</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex flex-col">
              <span className="text-[10px] uppercase text-teal-400 font-bold">AU / APAC</span>
              <span className="text-xl font-black text-teal-300">{telemetry.auCount}</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex flex-col">
              <span className="text-[10px] uppercase text-indigo-400 font-bold">Worldwide</span>
              <span className="text-xl font-black text-indigo-300">{telemetry.globalCount}</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex flex-col">
              <span className="text-[10px] uppercase text-amber-400 font-bold">Avg Salary</span>
              <span className="text-xl font-black text-amber-300">${Math.round(telemetry.avgSalary / 1000)}k</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-col lg:flex-row items-center justify-between gap-4 font-mono text-xs">
          <div className="relative w-full lg:w-96">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="SEARCH REMOTE ROLES..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700 text-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 transition-all placeholder-slate-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Region Toggle */}
            <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setRegionFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${regionFilter === 'all' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
              >
                ALL ({telemetry.total})
              </button>
              <button
                type="button"
                onClick={() => setRegionFilter('au')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${regionFilter === 'au' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
              >
                AU/APAC ({telemetry.auCount})
              </button>
              <button
                type="button"
                onClick={() => setRegionFilter('global')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${regionFilter === 'global' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
              >
                GLOBAL ({telemetry.globalCount})
              </button>
            </div>

            {/* Salary Toggle */}
            <button
              type="button"
              onClick={() => setMinSalaryFilter(!minSalaryFilter)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${minSalaryFilter ? 'bg-amber-950/60 border-amber-500/50 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
            >
              <DollarSign size={13} />
              $130k+
            </button>
          </div>
        </div>
      </div>

      {/* Remote Job Cards Grid */}
      {filteredJobs.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No matching remote roles found"
          description="Try clearing your search query or region filter to display all indexed remote positions."
          className="bg-slate-900/40 rounded-3xl border border-slate-800 my-8 p-12"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredJobs.map((job) => {
            const isAu = String(job.location || '').toLowerCase().includes('australia') || 
                         String(job.location || '').toLowerCase().includes('melbourne') || 
                         String(job.location || '').toLowerCase().includes('sydney') || 
                         String(job.location || '').toLowerCase().includes('vic');

            return (
              <div
                key={job.id}
                onClick={() => onSelectJob && onSelectJob(job)}
                className="group relative flex flex-col justify-between p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-teal-500/60 hover:bg-slate-850 hover:shadow-xl hover:shadow-teal-950/20 transition-all duration-300 cursor-pointer select-none"
              >
                <div className="space-y-3">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-950/90 text-teal-300 border border-teal-500/30">
                        <Wifi size={10} className="animate-pulse" />
                        100% REMOTE
                      </span>
                      {isAu && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-500/30">
                          AU/APAC
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-500 uppercase">
                      {job.source || 'Remote'}
                    </span>
                  </div>

                  {/* Title & Company */}
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors line-clamp-2 leading-snug">
                      {job.title}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-400">
                      <Building2 size={13} className="text-teal-400 shrink-0" />
                      <span className="truncate font-medium">{job.company}</span>
                    </div>
                  </div>

                  {/* Salary & Location Info */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60 text-xs font-mono">
                    <div className="flex items-center gap-1 text-slate-400">
                      <MapPin size={12} className="text-slate-500" />
                      <span className="truncate max-w-[140px]">{job.location || 'Remote'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-300/90 font-bold ml-auto">
                      <DollarSign size={12} />
                      <span>{job.salary || 'Market Rate'}</span>
                    </div>
                  </div>

                  {/* Description preview */}
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {job.description || job.notes || 'Full remote job description available via card inspection.'}
                  </p>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2 font-mono text-xs">
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Clock size={11} />
                    {job.date || 'Recent'}
                  </span>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {onOpenGenerator && (
                      <button
                        type="button"
                        onClick={() => onOpenGenerator(job)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 transition-all font-bold cursor-pointer"
                        title="1-Click Tailor Package"
                      >
                        <Sparkles size={11} />
                        Tailor
                      </button>
                    )}
                    {onOpenCheatSheet && (
                      <button
                        type="button"
                        onClick={() => onOpenCheatSheet(job)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 transition-all font-bold cursor-pointer"
                        title="Interview Master Cheat Sheet"
                      >
                        <Compass size={11} />
                        Cheat Sheet
                      </button>
                    )}
                    {job.portalLink && (
                      <a
                        href={job.portalLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                        title="Direct Application Link"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RemoteRolesSection;
