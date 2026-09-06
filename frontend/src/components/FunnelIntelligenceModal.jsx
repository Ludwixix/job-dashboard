import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Send,
  Calendar,
  Award,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Compass,
  Bookmark,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import {
  computeClientFunnelAnalytics,
  fetchFunnelAnalytics,
  AU_SECTOR_BENCHMARKS,
  formatConversionPct,
  formatDays,
  getHealthBadgeClass,
  getStageColor,
  STAGE_CONFIGS,
} from '../services/funnelAnalyticsService';

export default function FunnelIntelligenceModal({
  isOpen,
  onClose,
  jobs = [],
  currentSector = 'technology',
  onSelectJob,
  onOpenRecruiterCrm,
}) {
  const [activeTab, setActiveTab] = useState('funnel');
  const [selectedSector, setSelectedSector] = useState(currentSector || 'technology');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);

  // Sync sector prop changes
  useEffect(() => {
    if (currentSector) {
      setSelectedSector(currentSector);
    }
  }, [currentSector]);

  // Load analytics when open or sector/jobs change
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    // Initial immediate calculation from local data
    const localAnalytics = computeClientFunnelAnalytics(jobs, selectedSector);
    setAnalytics(localAnalytics);

    // Asynchronously try backend aggregation if available
    fetchFunnelAnalytics(jobs, selectedSector)
      .then((serverData) => {
        if (isMounted && serverData) {
          setAnalytics(serverData);
        }
      })
      .catch((err) => {
        console.warn('Backend funnel calculation failed, retaining client data:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedSector, jobs]);

  // Keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const data = analytics || computeClientFunnelAnalytics(jobs, selectedSector);
  const stalledCount = data.stalled_applications?.length || 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="funnel-modal-title"
    >
      <div className="bg-slate-900 border border-slate-700/70 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/15 border border-cyan-500/30 rounded-xl text-cyan-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="funnel-modal-title" className="text-lg font-bold text-white tracking-wide">
                  Talent Funnel Intelligence
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  Pipeline Radar
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-Sector Lifecycle Conversion, Velocity & SLA Lag Alerts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Sector Selector */}
            <select
              aria-label="Filter Sector"
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="bg-slate-800/90 text-xs text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
            >
              {Object.entries(AU_SECTOR_BENCHMARKS).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.sector_label}
                </option>
              ))}
            </select>

            <button
              onClick={onClose}
              aria-label="Close modal"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Summary Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 bg-slate-950/40 border-b border-slate-800/80">
          <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl">
            <div className="text-xs text-slate-400 font-medium">Pipeline Health Score</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl font-black text-white">{data.health_score}/100</span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getHealthBadgeClass(data.health_badge)}`}>
                {data.health_label}
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl">
            <div className="text-xs text-slate-400 font-medium">Active Pipeline</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-cyan-400">{data.active_pipeline_count}</span>
              <span className="text-xs text-slate-500">of {data.total_jobs} total</span>
            </div>
          </div>

          <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl">
            <div className="text-xs text-slate-400 font-medium">Apply → Interview</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-purple-400">
                {formatConversionPct(data.conversion_rates.apply_to_interview_pct)}
              </span>
              <span className="text-[11px] text-slate-400">
                (Mkt: {formatConversionPct(data.benchmark?.market_apply_to_interview_pct)})
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl">
            <div className="text-xs text-slate-400 font-medium">Stalled Applications</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-xl font-black ${stalledCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {stalledCount}
              </span>
              {stalledCount > 0 && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  Needs Follow-up
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-800 px-6 gap-2 bg-slate-900/60" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'funnel'}
            onClick={() => setActiveTab('funnel')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'funnel'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Stage Progression & Funnel
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'velocity'}
            onClick={() => setActiveTab('velocity')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'velocity'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            Velocity & Cycle Times
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'stalled'}
            onClick={() => setActiveTab('stalled')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'stalled'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Stalled Applications
            {stalledCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {stalledCount}
              </span>
            )}
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'benchmarks'}
            onClick={() => setActiveTab('benchmarks')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'benchmarks'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Sector Benchmarks & Forecast
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: FUNNEL PROGRESSION */}
          {activeTab === 'funnel' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Application Lifecycle Conversion</h3>
                  <p className="text-xs text-slate-400">Cumulative progression across active candidate milestones</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Overall Funnel Yield</div>
                  <div className="text-lg font-black text-emerald-400">
                    {formatConversionPct(data.conversion_rates.overall_yield_pct)}
                  </div>
                </div>
              </div>

              {/* Stage Progression Cards */}
              <div className="space-y-3">
                {STAGE_CONFIGS.map((stage, idx) => {
                  const stageData = data.stages[stage.id] || { count: 0 };
                  const total = data.total_jobs || 1;
                  const pctOfTotal = Math.min(100, Math.round((stageData.count / total) * 100));

                  let conversionFromPrev = null;
                  if (idx === 1) conversionFromPrev = data.conversion_rates.sourced_to_shortlist_pct;
                  if (idx === 2) conversionFromPrev = data.conversion_rates.shortlist_to_apply_pct;
                  if (idx === 3) conversionFromPrev = data.conversion_rates.apply_to_interview_pct;
                  if (idx === 4) conversionFromPrev = data.conversion_rates.interview_to_offer_pct;
                  if (idx === 5) conversionFromPrev = data.conversion_rates.offer_to_accepted_pct;

                  return (
                    <div
                      key={stage.id}
                      className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl hover:border-slate-600 transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className={`p-1.5 rounded-lg border text-xs font-semibold ${getStageColor(stage.id)}`}>
                            {stage.label}
                          </span>
                          <span className="text-xs text-slate-400 hidden sm:inline">{stage.desc}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          {conversionFromPrev !== null && (
                            <span className="text-xs text-slate-300">
                              Conv: <span className="font-bold text-cyan-300">{formatConversionPct(conversionFromPrev)}</span>
                            </span>
                          )}
                          <span className="text-sm font-black text-white">{stageData.count}</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-500 rounded-full"
                          style={{ width: `${Math.max(4, pctOfTotal)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Recommendations */}
              {data.recommendations?.length > 0 && (
                <div className="p-4 bg-indigo-950/30 border border-indigo-500/30 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    Actionable Pipeline Recommendations
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.recommendations.map((rec, i) => (
                      <div key={i} className="p-3 bg-slate-900/60 border border-indigo-500/20 rounded-lg">
                        <div className="text-xs font-bold text-white">{rec.title}</div>
                        <div className="text-xs text-slate-300 mt-1">{rec.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: VELOCITY & CYCLE TIMES */}
          {activeTab === 'velocity' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white">Pipeline Velocity & Cycle Times</h3>
                <p className="text-xs text-slate-400">Duration analysis from application submission to final offer</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl">
                  <div className="text-xs text-slate-400 font-medium">Avg Days to 1st Interview</div>
                  <div className="text-2xl font-black text-cyan-400 mt-1">
                    {formatDays(data.velocity?.avg_days_to_interview)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Industry benchmark: {data.benchmark?.market_avg_cycle_days ? `${Math.round(data.benchmark.market_avg_cycle_days / 2)}d` : '14d'}
                  </div>
                </div>

                <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl">
                  <div className="text-xs text-slate-400 font-medium">Interview to Offer Velocity</div>
                  <div className="text-2xl font-black text-purple-400 mt-1">
                    {formatDays(data.velocity?.avg_days_interview_to_offer)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Average across {data.velocity?.offer_samples_count || 0} offers
                  </div>
                </div>

                <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl">
                  <div className="text-xs text-slate-400 font-medium">Full Hiring Loop Cycle</div>
                  <div className="text-2xl font-black text-emerald-400 mt-1">
                    {formatDays(data.benchmark?.market_avg_cycle_days)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Sector expectation ({data.benchmark?.sector_label})
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl space-y-2">
                <div className="text-xs font-bold text-white">Velocity Optimization Diagnosis</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  In the <span className="font-semibold text-cyan-300">{data.benchmark?.sector_label}</span> market,
                  employers typically complete technical evaluations and offer reviews within {data.benchmark?.market_avg_cycle_days} days.
                  If an application exceeds 14 days without movement, conversion probabilities decline by 40% due to candidate ghosting or closed requisitions.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: STALLED APPLICATIONS RADAR */}
          {activeTab === 'stalled' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Stalled Application Radar</h3>
                  <p className="text-xs text-slate-400">Applications lagging beyond standard SLA response thresholds</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {stalledCount} Flagged
                </span>
              </div>

              {stalledCount === 0 ? (
                <div className="text-center py-12 p-6 bg-slate-800/20 border border-slate-800 rounded-xl">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <div className="text-sm font-bold text-white">Pipeline Flow is Healthy</div>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                    No applications are currently stalled beyond SLA thresholds. All active applications have moved within expected timeframes.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.stalled_applications.map((stalledJob) => (
                    <div
                      key={stalledJob.id}
                      className="p-4 bg-slate-800/50 border border-slate-700/70 rounded-xl hover:border-amber-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{stalledJob.title}</span>
                          <span className="text-xs text-slate-400">at {stalledJob.company}</span>
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                              stalledJob.severity === 'critical'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {stalledJob.days_in_stage}d in {stalledJob.stage}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">{stalledJob.action_recommendation}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {onSelectJob && (
                          <button
                            onClick={() => {
                              const match = jobs.find((j) => j.id === stalledJob.id);
                              if (match) onSelectJob(match);
                            }}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                          >
                            View Job
                          </button>
                        )}
                        {onOpenRecruiterCrm && (
                          <button
                            onClick={() => {
                              onClose();
                              onOpenRecruiterCrm();
                            }}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                          >
                            Log Outreach
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SECTOR BENCHMARKS & 30-DAY FORECAST */}
          {activeTab === 'benchmarks' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white">Australian Industry Benchmarks & 30-Day Forecast</h3>
                <p className="text-xs text-slate-400">
                  Candidate performance compared with Australian hiring metrics for {data.benchmark?.sector_label}
                </p>
              </div>

              {/* Benchmark Table */}
              <div className="overflow-x-auto border border-slate-700/60 rounded-xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold border-b border-slate-700">
                    <tr>
                      <th className="p-3">Conversion Metric</th>
                      <th className="p-3">Your Pipeline</th>
                      <th className="p-3">AU Market Average</th>
                      <th className="p-3">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    <tr>
                      <td className="p-3 font-medium text-white">Apply → Interview Rate</td>
                      <td className="p-3 font-bold text-cyan-400">
                        {formatConversionPct(data.conversion_rates.apply_to_interview_pct)}
                      </td>
                      <td className="p-3 text-slate-400">
                        {formatConversionPct(data.benchmark?.market_apply_to_interview_pct)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-semibold ${
                            data.benchmark?.delta_apply_to_interview >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {data.benchmark?.delta_apply_to_interview >= 0 ? '+' : ''}
                          {data.benchmark?.delta_apply_to_interview}%
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-white">Interview → Offer Rate</td>
                      <td className="p-3 font-bold text-purple-400">
                        {formatConversionPct(data.conversion_rates.interview_to_offer_pct)}
                      </td>
                      <td className="p-3 text-slate-400">
                        {formatConversionPct(data.benchmark?.market_interview_to_offer_pct)}
                      </td>
                      <td className="p-3 text-slate-500">—</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-white">Overall Funnel Yield</td>
                      <td className="p-3 font-bold text-emerald-400">
                        {formatConversionPct(data.conversion_rates.overall_yield_pct)}
                      </td>
                      <td className="p-3 text-slate-400">
                        {formatConversionPct(data.benchmark?.market_overall_yield_pct)}
                      </td>
                      <td className="p-3 text-slate-500">—</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-white">Expected Cycle Time</td>
                      <td className="p-3 text-slate-300">
                        {formatDays(data.velocity?.avg_cycle_days) || 'In Progress'}
                      </td>
                      <td className="p-3 text-slate-400">
                        {formatDays(data.benchmark?.market_avg_cycle_days)}
                      </td>
                      <td className="p-3 text-slate-500">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 30-Day Pipeline Forecast */}
              <div className="p-5 bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Predictive 30-Day Pipeline Forecast
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Based on your current active volume of{' '}
                  <span className="font-bold text-white">{data.forecast_30d.active_applied_count} applied applications</span> and{' '}
                  <span className="font-bold text-white">{data.forecast_30d.active_interview_count} active interview loops</span>:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                  <div className="p-3 bg-slate-900/80 border border-indigo-500/20 rounded-lg">
                    <div className="text-xs text-slate-400">Projected Interviews (Next 30 Days)</div>
                    <div className="text-xl font-black text-cyan-400 mt-1">
                      ~{data.forecast_30d.estimated_interviews} Interviews
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900/80 border border-indigo-500/20 rounded-lg">
                    <div className="text-xs text-slate-400">Projected Offers (Next 30 Days)</div>
                    <div className="text-xl font-black text-emerald-400 mt-1">
                      ~{data.forecast_30d.estimated_offers} Offers
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-900/90">
          <div className="text-xs text-slate-500">
            Sector: <span className="text-slate-300 font-medium">{data.benchmark?.sector_label}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
