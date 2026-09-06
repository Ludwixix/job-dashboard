import React, { useState, useEffect } from 'react';
import {
  X,
  Compass,
  Award,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  Target,
  DollarSign,
  ArrowRight,
  Clock,
  BookOpen,
  Layers,
  Briefcase,
  ChevronRight,
} from 'lucide-react';
import {
  computeClientCareerRoadmap,
  fetchCareerRoadmap,
  SENIORITY_LEVELS,
  SECTOR_CAREER_TRACKS,
  formatAudSalary,
  formatGrowthPct,
} from '../services/careerMatrixService';

export default function CareerMatrixModal({
  isOpen,
  onClose,
  profile = {},
  currentSector = 'technology',
}) {
  const [activeTab, setActiveTab] = useState('trajectory');
  const [selectedSector, setSelectedSector] = useState(currentSector || profile?.industry || 'technology');
  const [selectedTargetLevel, setSelectedTargetLevel] = useState(null);
  const [roadmap, setRoadmap] = useState(null);
  const [loading, setLoading] = useState(false);

  // Sync props
  useEffect(() => {
    if (currentSector || profile?.industry) {
      setSelectedSector(currentSector || profile?.industry || 'technology');
    }
  }, [currentSector, profile]);

  // Load roadmap data
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    const localData = computeClientCareerRoadmap(profile, selectedTargetLevel, selectedSector);
    setRoadmap(localData);

    fetchCareerRoadmap(profile, selectedTargetLevel, selectedSector)
      .then((serverData) => {
        if (isMounted && serverData) {
          setRoadmap(serverData);
        }
      })
      .catch((err) => {
        console.warn('Backend roadmap fetch failed, using client data:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedSector, selectedTargetLevel, profile]);

  // Keyboard escape handler
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

  const data = roadmap || computeClientCareerRoadmap(profile, selectedTargetLevel, selectedSector);
  const salary = data.salary_projection;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="career-modal-title"
    >
      <div className="bg-slate-900 border border-slate-700/70 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/15 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="career-modal-title" className="text-lg font-bold text-white tracking-wide">
                  Career Vector Matrix
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  Trajectory Studio
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-Sector Seniority Forecasting, Skill Deltas & 12-Month Execution Roadmap
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Sector Selector */}
            <select
              aria-label="Filter Sector"
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="bg-slate-800/90 text-xs text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              {Object.entries(SECTOR_CAREER_TRACKS).map(([key, item]) => (
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
            <div className="text-xs text-slate-400 font-medium">Current Seniority</div>
            <div className="text-sm font-black text-white mt-1 truncate">
              {data.current_level_label}
            </div>
            <div className="text-[11px] text-slate-400 truncate">{data.current_title}</div>
          </div>

          <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl">
            <div className="text-xs text-slate-400 font-medium">Next Seniority Target</div>
            <div className="text-sm font-black text-indigo-300 mt-1 truncate">
              {data.target_title}
            </div>
            <div className="text-[11px] text-slate-400 truncate">{data.target_level_label}</div>
          </div>

          <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl">
            <div className="text-xs text-slate-400 font-medium">Projected Salary Lift</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-emerald-400">
                +{formatAudSalary(salary.projected_lift_aud)}
              </span>
              <span className="text-xs font-semibold text-emerald-300">
                ({formatGrowthPct(salary.projected_growth_pct)})
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl">
            <div className="text-xs text-slate-400 font-medium">Capability Gaps</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xl font-black text-amber-400">
                {data.skill_gaps.length}
              </span>
              <span className="text-xs text-slate-400">gaps to close</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-800 px-6 gap-2 bg-slate-900/60" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'trajectory'}
            onClick={() => setActiveTab('trajectory')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'trajectory'
                ? 'border-indigo-400 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Career Ladder & Milestones
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'skills'}
            onClick={() => setActiveTab('skills')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'skills'
                ? 'border-indigo-400 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Target className="w-4 h-4" />
            Skills Delta & Certs
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'blueprint'}
            onClick={() => setActiveTab('blueprint')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'blueprint'
                ? 'border-indigo-400 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            12-Month Blueprint
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'salary'}
            onClick={() => setActiveTab('salary')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'salary'
                ? 'border-indigo-400 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Salary & Pivots
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: TRAJECTORY & CAREER LADDER */}
          {activeTab === 'trajectory' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Seniority Progression Ladder</h3>
                  <p className="text-xs text-slate-400">
                    Industry career stages in the Australian {data.sector_label} market
                  </p>
                </div>
              </div>

              {/* Interactive Seniority Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {SENIORITY_LEVELS.map((lvl) => {
                  const trackConfig = SECTOR_CAREER_TRACKS[data.sector]?.[lvl.id];
                  const isCurrent = data.current_level === lvl.id;
                  const isTarget = data.target_level === lvl.id;

                  return (
                    <div
                      key={lvl.id}
                      onClick={() => setSelectedTargetLevel(lvl.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isTarget
                          ? 'bg-indigo-950/40 border-indigo-500 shadow-indigo-500/10 shadow-lg'
                          : isCurrent
                          ? 'bg-slate-800/60 border-slate-600'
                          : 'bg-slate-800/30 border-slate-700/60 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded border ${lvl.badge}`}>
                          {lvl.label}
                        </span>
                        {isCurrent && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Current Level
                          </span>
                        )}
                        {isTarget && !isCurrent && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Selected Target
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-black text-white">{trackConfig?.title}</div>
                      <div className="text-xs text-emerald-400 font-bold mt-1">
                        {formatAudSalary(trackConfig?.salary_range[0])} – {formatAudSalary(trackConfig?.salary_range[1])} AUD
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {trackConfig?.skills.slice(0, 3).map((s, idx) => (
                          <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-slate-900/60 text-slate-300 border border-slate-700/60">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: SKILLS DELTA & CERTIFICATIONS */}
          {activeTab === 'skills' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white">Critical Capability Gaps & Skill Deltas</h3>
                <p className="text-xs text-slate-400">
                  Prerequisite capabilities required to unlock {data.target_title}
                </p>
              </div>

              {/* Skills Gaps List */}
              <div className="space-y-3">
                {data.skill_gaps.map((gap, i) => (
                  <div
                    key={i}
                    className="p-4 bg-slate-800/40 border border-slate-700/70 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{gap.skill}</span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {gap.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">{gap.acquisition_path}</p>
                    </div>

                    <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 self-start sm:self-center">
                      High Priority Gap
                    </span>
                  </div>
                ))}
              </div>

              {/* Recommended Australian Certifications */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-indigo-400" />
                  Recommended Australian Certifications
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.certifications.map((cert, i) => (
                    <div key={i} className="p-4 bg-slate-800/30 border border-indigo-500/20 rounded-xl space-y-1.5">
                      <div className="text-xs font-bold text-white">{cert.name}</div>
                      <div className="text-[11px] text-indigo-300 font-medium">Issuer: {cert.issuing_body}</div>
                      <p className="text-xs text-slate-300 leading-snug">{cert.impact}</p>
                      <div className="text-[10px] text-slate-500 mt-2">Study effort: ~{cert.estimated_hours} hours</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 12-MONTH EXECUTION BLUEPRINT */}
          {activeTab === 'blueprint' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white">Strategic 12-Month Execution Blueprint</h3>
                <p className="text-xs text-slate-400">Quarterly action items to transition into your next career tier</p>
              </div>

              <div className="space-y-4">
                {data.milestones_12m.map((milestone, idx) => (
                  <div
                    key={idx}
                    className="p-5 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-3 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                          {milestone.timeframe}
                        </span>
                        <h4 className="text-sm font-bold text-white">{milestone.focus}</h4>
                      </div>
                    </div>

                    <ul className="space-y-2 text-xs text-slate-300">
                      {milestone.deliverables.map((item, dIdx) => (
                        <li key={dIdx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: SALARY UPSIDE & PIVOTS */}
          {activeTab === 'salary' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white">Salary Progression & Strategic Pivots</h3>
                <p className="text-xs text-slate-400">Market remuneration bands and high-overlap lateral opportunities</p>
              </div>

              {/* Salary Comparison Card */}
              <div className="p-5 bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-xl space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-indigo-400" />
                  Australian Market Compensation Delta (AUD)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-900/80 border border-slate-700/60 rounded-xl">
                    <div className="text-xs text-slate-400">Current Level Remuneration</div>
                    <div className="text-xl font-black text-slate-200 mt-1">
                      {formatAudSalary(salary.current_median)} Median
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Band: {formatAudSalary(salary.current_min)} – {formatAudSalary(salary.current_max)}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-900/80 border border-emerald-500/30 rounded-xl">
                    <div className="text-xs text-slate-400">Target Level Remuneration</div>
                    <div className="text-xl font-black text-emerald-400 mt-1">
                      {formatAudSalary(salary.target_median)} Median
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Band: {formatAudSalary(salary.target_min)} – {formatAudSalary(salary.target_max)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Adjacent Career Pivots */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  High-Overlap Career Pivots
                </h4>
                <div className="space-y-2.5">
                  {data.adjacent_pivots.map((pivot, pIdx) => (
                    <div
                      key={pIdx}
                      className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl flex items-center justify-between gap-4"
                    >
                      <div className="space-y-0.5">
                        <div className="text-sm font-bold text-white">{pivot.title}</div>
                        <p className="text-xs text-slate-400">{pivot.reason}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-black text-cyan-400">{pivot.overlap_pct}%</div>
                        <div className="text-[10px] text-slate-500">Skill Overlap</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-900/90">
          <div className="text-xs text-slate-500">
            Track: <span className="text-slate-300 font-medium">{data.sector_label}</span>
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
