import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { 
  Target, TrendingUp, Users, Award, Calendar, Activity, ChevronRight, 
  Search, Filter, ExternalLink, Building2, MapPin, Clock, AlignLeft, Sparkles, 
  CheckCircle2, FileText, Eye, Zap
} from 'lucide-react';
import { format, subDays, parseISO, isValid, differenceInDays } from 'date-fns';

const formatDateSafe = (dateStr, formatStr = 'MMM d, yyyy') => {
  if (!dateStr) return 'Recently';
  try {
    const parsed = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    if (isValid(parsed)) {
      return format(parsed, formatStr);
    }
  } catch {}
  return 'Recently';
};

export const AnalyticsDashboard = ({ jobs = [], onUpdateStatus, onSelectJob, onOpenGenerator }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('All');
  const [sortBy, setSortBy] = useState('newest');

  const getJobStage = (job) => {
    const s = (job.status || '').toLowerCase();
    if (s.includes('reject') || s.includes('unsuccessful') || s.includes('closed') || job.isRejected) return 'Rejected';
    if (s.includes('offer') || s.includes('accepted')) return 'Offer';
    if (s.includes('interview') || s.includes('screen') || s.includes('assessment')) return 'Interviewing';
    if (s.includes('applied') || s.includes('submitted') || s.includes('confirmation')) return 'Applied';
    return 'Wishlist';
  };

  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('reject') || s.includes('unsuccessful')) return 'bg-rose-950/60 text-rose-400 border-rose-800/50';
    if (s.includes('offer')) return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50';
    if (s.includes('interview')) return 'bg-amber-950/60 text-amber-400 border-amber-800/50';
    if (s.includes('applied')) return 'bg-indigo-950/60 text-indigo-400 border-indigo-800/50';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  const trackedJobs = useMemo(() => {
    return jobs.filter(j => getJobStage(j) !== 'Wishlist');
  }, [jobs]);

  const metrics = useMemo(() => {
    const total = trackedJobs.length;
    
    if (total === 0) return { total: 0, active: 0, interviewRate: 0, offerRate: 0, funnel: [], timeline: [] };

    const stages = {
      Applied: 0,
      Interviewing: 0,
      Offer: 0,
      Rejected: 0
    };

    trackedJobs.forEach(j => {
      stages[getJobStage(j)]++;
    });

    const offerCount = stages.Offer;
    const interviewCount = stages.Interviewing + offerCount;
    const appliedCount = total;

    const interviewRate = total > 0 ? (interviewCount / total) * 100 : 0;
    const offerRate = total > 0 ? (offerCount / total) * 100 : 0;

    // Last 30 days timeline
    const timelineMap = {};
    for (let i = 29; i >= 0; i--) {
      timelineMap[format(subDays(new Date(), i), 'MMM dd')] = 0;
    }
    
    trackedJobs.forEach(j => {
      const rawDate = j.applied_at || j.date || j.posted;
      if (rawDate) {
        try {
          const parsed = typeof rawDate === 'string' ? parseISO(rawDate) : new Date(rawDate);
          if (isValid(parsed)) {
            const d = format(parsed, 'MMM dd');
            if (timelineMap[d] !== undefined) {
              timelineMap[d]++;
            }
          }
        } catch {}
      }
    });

    const timeline = Object.keys(timelineMap).map(k => ({
      date: k,
      applications: timelineMap[k]
    }));

    return {
      total,
      active: stages.Applied + stages.Interviewing,
      interviewRate: Math.round(interviewRate),
      offerRate: Math.round(offerRate),
      funnel: [
        { name: 'Applied', value: appliedCount, color: '#6366f1' },
        { name: 'Interviewing', value: Math.round(interviewCount), color: '#f59e0b' },
        { name: 'Offers', value: offerCount, color: '#10b981' }
      ],
      timeline
    };
  }, [trackedJobs]);

  // Filtered & Sorted Applied Jobs List
  const filteredAppliedJobs = useMemo(() => {
    return trackedJobs.filter(job => {
      const stage = getJobStage(job);
      if (stageFilter !== 'All' && stage !== stageFilter) return false;

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchTitle = (job.title || '').toLowerCase().includes(q);
        const matchCompany = (job.company || '').toLowerCase().includes(q);
        const matchNotes = (job.notes || '').toLowerCase().includes(q);
        const matchLocation = (job.location || '').toLowerCase().includes(q);
        return matchTitle || matchCompany || matchNotes || matchLocation;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'newest') {
        const dateA = a.applied_at || a.date || a.posted || '';
        const dateB = b.applied_at || b.date || b.posted || '';
        return dateB.localeCompare(dateA);
      } else if (sortBy === 'score') {
        return (b.score || 0) - (a.score || 0);
      } else if (sortBy === 'company') {
        return (a.company || '').localeCompare(b.company || '');
      }
      return 0;
    });
  }, [trackedJobs, searchTerm, stageFilter, sortBy]);

  const MetricCard = ({ title, value, subtitle, icon: Icon, color }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between font-mono">
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-${color}-400`}>
          <Icon size={20} />
        </div>
      </div>
      <div>
        <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{value}</h3>
        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">{title}</p>
        <p className="text-[10px] text-slate-500 mt-1 font-mono">{subtitle}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Top Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Total Applications" 
          value={metrics.total} 
          subtitle="All-time tracked applications"
          icon={Target}
          color="indigo"
        />
        <MetricCard 
          title="Active Pipeline" 
          value={metrics.active} 
          subtitle="Applied & interviewing in-flight"
          icon={Activity}
          color="emerald"
        />
        <MetricCard 
          title="Interview Conversion" 
          value={`${metrics.interviewRate}%`} 
          subtitle="Application to screen rate"
          icon={TrendingUp}
          color="amber"
        />
        <MetricCard 
          title="Offer Rate" 
          value={`${metrics.offerRate}%`} 
          subtitle="Final offer acceptance rate"
          icon={Award}
          color="rose"
        />
      </div>

      {/* Cadence Chart & Funnel Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cadence Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-6 font-mono">
            <Calendar size={16} className="text-indigo-400" />
            <h3 className="font-bold text-xs text-slate-200 uppercase tracking-wider">Application Velocity (Last 30 Days)</h3>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.timeline} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis 
                  dataKey="date" 
                  stroke="#475569" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={20}
                />
                <YAxis 
                  stroke="#475569" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  allowDecimals={false}
                />
                <Tooltip 
                  cursor={{ fill: '#1e293b' }}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                />
                <Bar dataKey="applications" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Funnel Matrix */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between font-mono">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-emerald-400" />
            <h3 className="font-bold text-xs text-slate-200 uppercase tracking-wider">Conversion Pipeline</h3>
          </div>
          
          <div className="space-y-4 flex-1 flex flex-col justify-center">
            {metrics.funnel.map((stage) => {
              const pct = metrics.total > 0 ? Math.round((stage.value / metrics.total) * 100) : 0;
              return (
                <div key={stage.name} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-300">{stage.name}</span>
                    <span className="text-slate-400 font-mono">{stage.value} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                    <div 
                      className="h-full rounded-full transition-all duration-500" 
                      style={{ width: `${pct}%`, backgroundColor: stage.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Applied Jobs Intelligence & Tracking Explorer */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 font-mono">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="text-sm font-black text-white flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-400" />
              APPLIED POSITIONS INTELLIGENCE &amp; TRACKER
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                {filteredAppliedJobs.length} APPLICATIONS
              </span>
            </div>
            <div className="text-xs text-slate-400 font-sans mt-0.5">
              Click any application to view the generated resume &amp; tailored cover letter used for your submission.
            </div>
          </div>

          {/* Quick Search & Sort */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="SEARCH APPLIED ROLES..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="All">ALL STAGES ({trackedJobs.length})</option>
              <option value="Applied">APPLIED (IN REVIEW)</option>
              <option value="Interviewing">INTERVIEWING</option>
              <option value="Offer">OFFERS</option>
              <option value="Rejected">REJECTED / CLOSED</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="newest">MOST RECENT</option>
              <option value="score">HIGHEST MATCH</option>
              <option value="company">COMPANY (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Applications Table */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 font-bold">Applied Date</th>
                <th className="px-4 py-3 font-bold">Company &amp; Location</th>
                <th className="px-4 py-3 font-bold">Position Title</th>
                <th className="px-4 py-3 font-bold">Status Stage</th>
                <th className="px-4 py-3 font-bold">Generated Assets</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredAppliedJobs.map((job) => {
                const stage = getJobStage(job);
                const hasDocs = Boolean(job.coverLetterText || job.cover_letter_text || job.resumeText || job.resume_text);

                return (
                  <tr 
                    key={job.id} 
                    onClick={() => onSelectJob && onSelectJob(job)}
                    className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                      {formatDateSafe(job.applied_at || job.date || job.posted)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-white flex items-center gap-1.5 text-xs group-hover:text-indigo-300 transition-colors">
                        <Building2 size={13} className="text-indigo-400 shrink-0" />
                        <span>{job.company}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                        <MapPin size={10} />
                        <span>{job.location || 'Melbourne, VIC'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-200 text-xs truncate max-w-xs">{job.title}</div>
                      {job.salary && (
                        <div className="text-[10px] text-emerald-400 font-mono font-bold mt-0.5">{job.salary}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={job.status || 'Applied'}
                        onChange={(e) => onUpdateStatus && onUpdateStatus(job.id, e.target.value)}
                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer ${getStatusColor(job.status)}`}
                      >
                        <option value="Applied">Applied (In Review)</option>
                        <option value="Interviewing">Interviewing</option>
                        <option value="Offer Received">Offer Received</option>
                        <option value="Rejected">Rejected / Closed</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {hasDocs ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold">
                          <CheckCircle2 size={11} className="text-emerald-400" />
                          <span>CV &amp; RESUME READY</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenGenerator) onOpenGenerator(job);
                            else if (onSelectJob) onSelectJob(job);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-950/60 text-indigo-300 hover:bg-indigo-900 border border-indigo-500/40 text-[10px] font-mono font-bold cursor-pointer transition-colors"
                        >
                          <Zap size={11} className="text-indigo-400" />
                          <span>GENERATE DOCS</span>
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectJob && onSelectJob(job)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title="Open Job Card & View Resume / Cover Letter"
                        >
                          <Eye size={12} />
                          <span>OPEN CARD</span>
                        </button>
                        {(job.link || job.url) && (
                          <a
                            href={job.link || job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white inline-flex items-center gap-1 text-[10px] font-mono font-bold"
                            title="Open Original Job Ad"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredAppliedJobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-500 font-mono text-xs">
                    No applied jobs found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
