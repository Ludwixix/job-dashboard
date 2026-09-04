import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, Percent, Award, Globe, 
  BarChart3, PieChart, ChevronDown, ChevronUp 
} from 'lucide-react';
import { parseISO, isValid, differenceInDays } from 'date-fns';

export const MetricsPanel = ({ jobs }) => {
  const [showSourceMatrix, setShowSourceMatrix] = useState(false);

  const metrics = useMemo(() => {
    const submittedJobs = jobs.filter(j => 
      !j.status.toLowerCase().includes('package prepared') && 
      !j.status.toLowerCase().includes('to submit')
    );

    const totalSubmitted = submittedJobs.length || 1;

    const interviews = submittedJobs.filter(j => j.status.toLowerCase().includes('interview')).length;
    const actionRequired = submittedJobs.filter(j => 
      j.status.toLowerCase().includes('action required') || 
      j.status.toLowerCase().includes('verification')
    ).length;
    const confirmation = submittedJobs.filter(j => j.status.toLowerCase().includes('confirmation')).length;
    const underReview = submittedJobs.filter(j => j.status.toLowerCase().includes('under review')).length;
    const appliedViewed = submittedJobs.filter(j => j.status.toLowerCase().includes('applied') || j.status.toLowerCase().includes('viewed')).length;
    const closed = submittedJobs.filter(j => 
      j.status.toLowerCase().includes('closed') || 
      j.status.toLowerCase().includes('expired') || 
      j.status.toLowerCase().includes('unsuccessful')
    ).length;

    const interviewRate = ((interviews / totalSubmitted) * 100).toFixed(1);
    const responseRate = (((interviews + actionRequired + confirmation) / totalSubmitted) * 100).toFixed(1);

    const sourcesMap = {};
    submittedJobs.forEach(j => {
      const src = j.source || 'Direct';
      sourcesMap[src] = (sourcesMap[src] || 0) + 1;
    });

    const sourcesList = Object.entries(sourcesMap)
      .map(([name, count]) => ({
        name,
        count,
        percent: ((count / totalSubmitted) * 100).toFixed(0)
      }))
      .sort((a, b) => b.count - a.count);

    const now = new Date();
    const last7Days = submittedJobs.filter(j => {
      if (!j.date) return false;
      try {
        const d = parseISO(j.date);
        return isValid(d) && differenceInDays(now, d) <= 7;
      } catch { return false; }
    }).length;

    const last30Days = submittedJobs.filter(j => {
      if (!j.date) return false;
      try {
        const d = parseISO(j.date);
        return isValid(d) && differenceInDays(now, d) <= 30;
      } catch { return false; }
    }).length;

    return {
      totalSubmitted,
      interviews,
      actionRequired,
      confirmation,
      underReview,
      appliedViewed,
      closed,
      interviewRate,
      responseRate,
      sourcesList,
      last7Days,
      last30Days
    };
  }, [jobs]);

  return (
    <div className="bg-slate-900 rounded-2xl p-6 border-2 border-slate-800 shadow-md space-y-6 font-sans text-white">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs border border-indigo-400/40">
            <BarChart3 size={20} />
          </div>
          <div>
            <h3 className="font-extrabold text-xs font-mono tracking-widest uppercase text-indigo-300">ANALYTICS.HUD // PERFORMANCE MATRIX</h3>
            <p className="text-[11px] text-slate-400 font-mono font-bold">CONVERSION RATES, PIPELINE VELOCITY & SOURCE SHARE</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
        {/* Interview Rate */}
        <div className="p-4 rounded-lg bg-emerald-50/70 border border-emerald-300 flex items-center gap-4">
          <div className="p-3 bg-emerald-600 text-white rounded-lg shadow-2xs">
            <Award size={22} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">INTERVIEW RATE</div>
            <div className="text-2xl font-black text-emerald-950 mt-0.5">{metrics.interviewRate}%</div>
            <div className="text-[11px] text-emerald-800 font-bold">{metrics.interviews} / {metrics.totalSubmitted} SUBMITTED</div>
          </div>
        </div>

        {/* Response Rate */}
        <div className="p-4 rounded-lg bg-indigo-50/70 border border-indigo-300 flex items-center gap-4">
          <div className="p-3 bg-indigo-600 text-white rounded-lg shadow-2xs">
            <Percent size={22} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">RESPONSE RATE</div>
            <div className="text-2xl font-black text-indigo-950 mt-0.5">{metrics.responseRate}%</div>
            <div className="text-[11px] text-indigo-800 font-bold">INTERVIEW / ACTION / VERIF</div>
          </div>
        </div>

        {/* Submission Velocity */}
        <div className="p-4 rounded-lg bg-purple-50/70 border border-purple-300 flex items-center gap-4">
          <div className="p-3 bg-purple-600 text-white rounded-lg shadow-2xs">
            <TrendingUp size={22} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-purple-900 uppercase tracking-wider">VELOCITY (7D / 30D)</div>
            <div className="text-2xl font-black text-purple-950 mt-0.5">{metrics.last7Days} <span className="text-xs font-bold text-purple-700">THIS WEEK</span></div>
            <div className="text-[11px] text-purple-800 font-bold">{metrics.last30Days} IN LAST 30 DAYS</div>
          </div>
        </div>
      </div>

      {/* Breakdown Grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Source Share Breakdown (Minimizable) */}
        <div className="space-y-3 bg-slate-50/60 p-4 rounded-xl border border-slate-200/80">
          <div 
            onClick={() => setShowSourceMatrix(!showSourceMatrix)}
            className="flex items-center justify-between cursor-pointer select-none group"
          >
            <h4 className="text-xs font-mono font-extrabold text-slate-700 uppercase tracking-widest flex items-center gap-1.5 group-hover:text-indigo-600 transition-colors">
              <Globe size={15} className="text-indigo-600" /> SOURCE SHARE MATRIX
            </h4>

            <button className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors">
              {showSourceMatrix ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {showSourceMatrix && (
            <div className="space-y-2.5 pt-1 animate-in fade-in duration-200">
              {metrics.sourcesList.map(src => (
                <div key={src.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono font-bold">
                    <span className="text-slate-800">{src.name}</span>
                    <span className="text-indigo-700">{src.count} ({src.percent}%)</span>
                  </div>
                  <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden border border-slate-300">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${src.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status Pipeline Funnel */}
        <div className="space-y-3 bg-slate-50/60 p-4 rounded-xl border border-slate-200/80">
          <h4 className="text-xs font-mono font-extrabold text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
            <PieChart size={15} className="text-indigo-600" /> FUNNEL DISTRIBUTION
          </h4>

          <div className="grid grid-cols-2 gap-2.5 text-xs font-mono pt-1">
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300">
              <div className="text-[10px] text-emerald-900 font-bold tracking-wider uppercase">INTERVIEWS</div>
              <div className="text-xl font-black text-emerald-950 mt-0.5">{metrics.interviews}</div>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 border border-amber-300">
              <div className="text-[10px] text-amber-900 font-bold tracking-wider uppercase">ACTION / VERIF</div>
              <div className="text-xl font-black text-amber-950 mt-0.5">{metrics.actionRequired}</div>
            </div>

            <div className="p-3 rounded-lg bg-blue-50 border border-blue-300">
              <div className="text-[10px] text-blue-900 font-bold tracking-wider uppercase">APPLIED / CONFIRM</div>
              <div className="text-xl font-black text-blue-950 mt-0.5">{metrics.appliedViewed + metrics.confirmation}</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-100 border border-slate-300">
              <div className="text-[10px] text-slate-700 font-bold tracking-wider uppercase">CLOSED / EXPIRED</div>
              <div className="text-xl font-black text-slate-900 mt-0.5">{metrics.closed}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
