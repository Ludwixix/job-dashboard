import React, { useMemo } from 'react';
import { 
  TrendingUp, Award, CheckCircle2, AlertTriangle, ShieldCheck, 
  DollarSign, MapPin, Layers, Target, Compass, Sparkles, BookOpen 
} from 'lucide-react';
import { analyzeMarketTrends, generateSkillGapReport } from '../services/generationService';

export const MarketIntelligence = ({ jobs = [] }) => {
  const trends = useMemo(() => analyzeMarketTrends(jobs), [jobs]);
  const gapReport = useMemo(() => generateSkillGapReport(jobs), [jobs]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ── Top Header Banner ── */}
      <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-purple-950/60 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles size={13} className="text-indigo-400" />
              Cognitive Market Intelligence • Melbourne IT Sector
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Market Demand & Career Positioning</h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Real-time telemetry aggregated from active market scrapers. Evaluates candidate market readiness, 
              salary leverage, and competitive moats against {jobs.length} verified listings.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-900/80 border border-slate-800 p-4 rounded-xl shrink-0">
            <div className="text-center">
              <div className="text-3xl font-black text-emerald-400">{gapReport.marketReadinessScore}%</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">Market Readiness</div>
            </div>
            <div className="h-10 w-[1px] bg-slate-800" />
            <div className="text-center">
              <div className="text-2xl font-black text-indigo-400">${Math.round(trends.avgSalary / 1000)}k</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">Avg Benchmark</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Career Drivers & Strategic Moats ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {gapReport.careerDrivers.map((item, idx) => (
          <div key={idx} className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{item.driver}</div>
            <div className="text-sm font-black text-slate-200 mt-2 flex items-center gap-2">
              <Target size={14} className="text-indigo-400 shrink-0" />
              <span>{item.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main 2-Column Grid: Skill Demand vs Gap Report ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Market Skill Demand Matrix (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-400" />
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Top Required Technologies & Keywords</h2>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Scanned across {jobs.length} roles</span>
          </div>

          <div className="space-y-3 pt-2">
            {trends.topSkills.slice(0, 10).map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-300">{item.skill}</span>
                    {item.isOwned ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
                        <CheckCircle2 size={10} /> Verified in Profile
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/40 border border-amber-500/30 text-amber-300">
                        <AlertTriangle size={10} /> Upskill Opportunity
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">{item.percentage}% ({item.count} jobs)</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-500 ${item.isOwned ? 'bg-indigo-500' : 'bg-amber-500/70'}`}
                    style={{ width: `${Math.max(8, item.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* High-ROI Recommendations & Certifications (1 col) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Award size={16} className="text-emerald-400" />
              <h2 className="text-sm font-black text-white uppercase tracking-wider">High-ROI Upskilling</h2>
            </div>
            
            <div className="space-y-3">
              {gapReport.recommendations.map((rec, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-300">{rec.skill}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-950 border border-indigo-700/40 text-indigo-300 rounded">
                      +15% Target
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{rec.reason}</p>
                  <div className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 pt-1">
                    <BookOpen size={11} /> {rec.action}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px] text-slate-500 space-y-1">
            <div className="font-bold text-slate-400 flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-emerald-400" /> Baseline / NV1 Moat
            </div>
            <p>Government & Defence IT roles in Melbourne have ~40% fewer applicants due to Australian Citizenship and clearance prerequisites.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
