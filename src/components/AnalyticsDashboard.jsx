import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Target, TrendingUp, Users, Award, Calendar, Activity, ChevronRight } from 'lucide-react';
import { format, subDays, parseISO, isAfter, startOfDay } from 'date-fns';

export const AnalyticsDashboard = ({ jobs = [] }) => {
  const getJobStage = (job) => {
    const s = (job.status || '').toLowerCase();
    if (s.includes('reject') || s.includes('unsuccessful') || s.includes('closed') || job.isRejected) return 'Rejected';
    if (s.includes('offer') || s.includes('accepted')) return 'Offer';
    if (s.includes('interview') || s.includes('screen') || s.includes('assessment')) return 'Interviewing';
    if (s.includes('applied') || s.includes('submitted') || s.includes('confirmation')) return 'Applied';
    return 'Wishlist';
  };

  const metrics = useMemo(() => {
    const tracked = jobs.filter(j => getJobStage(j) !== 'Wishlist');
    const total = tracked.length;
    
    if (total === 0) return { total: 0, active: 0, interviewRate: 0, offerRate: 0, funnel: [], timeline: [] };

    const stages = {
      Applied: 0,
      Interviewing: 0,
      Offer: 0,
      Rejected: 0
    };

    tracked.forEach(j => {
      stages[getJobStage(j)]++;
    });

    // Funnel counts (each stage includes the ones that progressed past it)
    const offerCount = stages.Offer;
    const interviewCount = stages.Interviewing + offerCount + (stages.Rejected * 0.2); // Rough estimation if exact history isn't tracked
    const appliedCount = total;

    const interviewRate = total > 0 ? (interviewCount / total) * 100 : 0;
    const offerRate = total > 0 ? (offerCount / total) * 100 : 0;

    // Last 30 days timeline
    const timelineMap = {};
    for (let i = 29; i >= 0; i--) {
      timelineMap[format(subDays(new Date(), i), 'MMM dd')] = 0;
    }
    
    tracked.forEach(j => {
      if (j.date) {
        const d = format(parseISO(j.date), 'MMM dd');
        if (timelineMap[d] !== undefined) {
          timelineMap[d]++;
        }
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
        { name: 'Applied', value: appliedCount, color: '#6366f1' }, // Indigo
        { name: 'Interviewing', value: Math.round(interviewCount), color: '#f59e0b' }, // Amber
        { name: 'Offers', value: offerCount, color: '#10b981' } // Emerald
      ],
      timeline
    };
  }, [jobs]);

  const MetricCard = ({ title, value, subtitle, icon: Icon, color }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl bg-slate-950 border border-slate-800 text-${color}-400`}>
          <Icon size={24} />
        </div>
      </div>
      <div>
        <h3 className="text-3xl font-black text-white tracking-tight">{value}</h3>
        <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-wider">{title}</p>
        <p className="text-xs text-slate-500 mt-2 font-mono">{subtitle}</p>
      </div>
    </div>
  );

  if (metrics.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-slate-900/50 rounded-2xl border border-dashed border-slate-700">
        <Activity size={48} className="text-slate-600 mb-2" />
        <h2 className="text-xl font-bold text-slate-300">No Analytics Data Yet</h2>
        <p className="text-slate-500 max-w-md">Start applying to jobs and moving them through your Kanban pipeline to unlock insights, conversion rates, and cadences.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Total Applications" 
          value={metrics.total} 
          subtitle="All-time submitted"
          icon={Target}
          color="indigo"
        />
        <MetricCard 
          title="Active Pipeline" 
          value={metrics.active} 
          subtitle="Currently in progress"
          icon={Activity}
          color="emerald"
        />
        <MetricCard 
          title="Interview Rate" 
          value={`${metrics.interviewRate}%`} 
          subtitle="Conversion from App to Screen"
          icon={TrendingUp}
          color="amber"
        />
        <MetricCard 
          title="Offer Rate" 
          value={`${metrics.offerRate}%`} 
          subtitle="Total apps to final offer"
          icon={Award}
          color="rose"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cadence Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <Calendar size={18} className="text-indigo-400" />
            <h3 className="font-bold text-slate-200 uppercase tracking-wide">Application Velocity (Last 30 Days)</h3>
          </div>
          <div className="h-64 w-full">
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
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                />
                <Bar dataKey="applications" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Funnel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Users size={18} className="text-indigo-400" />
            <h3 className="font-bold text-slate-200 uppercase tracking-wide">Conversion Funnel</h3>
          </div>
          
          <div className="flex-1 flex flex-col justify-center gap-4">
            {metrics.funnel.map((stage, i) => (
              <div key={stage.name} className="relative group">
                <div className="flex justify-between items-end mb-1 text-sm">
                  <span className="font-bold text-slate-300">{stage.name}</span>
                  <span className="font-mono font-bold text-slate-400">{stage.value}</span>
                </div>
                <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ 
                      width: `${(stage.value / metrics.funnel[0].value) * 100}%`,
                      backgroundColor: stage.color
                    }}
                  />
                </div>
                {i < metrics.funnel.length - 1 && (
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-slate-600 flex flex-col items-center group-hover:text-slate-400 transition-colors">
                    <span className="text-[9px] font-mono font-bold leading-none mb-0.5">
                      {Math.round((metrics.funnel[i+1].value / stage.value) * 100) || 0}%
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
