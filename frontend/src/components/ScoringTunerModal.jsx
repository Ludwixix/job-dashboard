import React, { useState, useMemo, useCallback } from 'react';
import { 
  Sliders, RotateCcw, Check, Sparkles, X, 
  TrendingUp, Award, Clock, Shield, Target 
} from 'lucide-react';
import { 
  DEFAULT_SCORING_WEIGHTS, 
  normalizeWeights, 
  recalculateJobScores 
} from '../services/scoringTuningService';

const DIMENSIONS = [
  {
    key: 'semantic_density',
    label: 'Semantic Vector Density',
    desc: 'TF-IDF & embedding keyword proximity to candidate core technical profile',
    icon: Target,
    defaultPercent: 40,
    color: 'accent-amber-500'
  },
  {
    key: 'title_alignment',
    label: 'Role Title Alignment',
    desc: 'Strict seniority hierarchy matching (Lead, Principal, Staff vs Mid/Junior)',
    icon: Award,
    defaultPercent: 25,
    color: 'accent-blue-500'
  },
  {
    key: 'recency',
    label: 'Recency Decay',
    desc: 'Boosts freshly posted listings (< 48 hours) to secure early applicant advantage',
    icon: Clock,
    defaultPercent: 15,
    color: 'accent-emerald-500'
  },
  {
    key: 'star_impact',
    label: 'STAR Impact Outcomes',
    desc: 'Prioritizes roles seeking quantifiable delivery metrics and business transformation',
    icon: TrendingUp,
    defaultPercent: 15,
    color: 'accent-purple-500'
  },
  {
    key: 'clearances',
    label: 'Clearances & Work Rights',
    desc: 'Awards full points for Australian citizenship and statutory security clearances',
    icon: Shield,
    defaultPercent: 5,
    color: 'accent-rose-500'
  }
];

export const ScoringTunerModal = ({ 
  isOpen, 
  onClose, 
  jobs = [], 
  currentWeights = null, 
  onApply = null 
}) => {
  const [weights, setWeights] = useState(() => {
    if (currentWeights) {
      return {
        semantic_density: Math.round((currentWeights.semantic_density ?? 0.40) * 100),
        title_alignment: Math.round((currentWeights.title_alignment ?? 0.25) * 100),
        recency: Math.round((currentWeights.recency ?? 0.15) * 100),
        star_impact: Math.round((currentWeights.star_impact ?? 0.15) * 100),
        clearances: Math.round((currentWeights.clearances ?? 0.05) * 100),
      };
    }
    return {
      semantic_density: 40,
      title_alignment: 25,
      recency: 15,
      star_impact: 15,
      clearances: 5,
    };
  });

  const normalized = useMemo(() => {
    return normalizeWeights(weights);
  }, [weights]);

  const totalSum = useMemo(() => {
    return Object.values(weights).reduce((acc, v) => acc + (Number(v) || 0), 0);
  }, [weights]);

  // Real-time re-ranking preview on sample or full jobs
  const reRankedPreview = useMemo(() => {
    if (!jobs || jobs.length === 0) return [];
    return recalculateJobScores(jobs.slice(0, 15), normalized).slice(0, 3);
  }, [jobs, normalized]);

  const handleSliderChange = (key, val) => {
    setWeights(prev => ({ ...prev, [key]: Number(val) }));
  };

  const handleReset = () => {
    setWeights({
      semantic_density: 40,
      title_alignment: 25,
      recency: 15,
      star_impact: 15,
      clearances: 5,
    });
  };

  const handleApply = () => {
    const finalScores = recalculateJobScores(jobs, normalized);
    if (onApply) {
      onApply(finalScores, normalized);
    }
    if (onClose) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden text-slate-100 font-sans"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Sliders size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Interactive Scoring Matrix Tuner</h2>
              <p className="text-xs text-slate-400 font-mono">Dynamic Multi-Factor Opportunity Ranking Engine</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">Total Weight Index Allocation:</span>
            <span className={`font-bold ${totalSum === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {totalSum}% (Auto-Normalized to 100%)
            </span>
          </div>

          {/* Sliders */}
          <div className="space-y-4">
            {DIMENSIONS.map((dim) => {
              const Icon = dim.icon;
              const currentVal = weights[dim.key] ?? 0;
              const normPercent = Math.round((normalized[dim.key] || 0) * 100);

              return (
                <div key={dim.key} className="p-3.5 rounded-lg bg-slate-950/40 border border-slate-800/80">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Icon size={15} className="text-amber-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                        {dim.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="text-slate-400 text-[11px]">Weight:</span>
                      <span className="font-bold text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                        {currentVal}% ({normPercent}% net)
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                    {dim.desc}
                  </p>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={currentVal}
                    onChange={(e) => handleSliderChange(dim.key, e.target.value)}
                    className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              );
            })}
          </div>

          {/* Live Preview of Top Ranking Opportunities */}
          {reRankedPreview.length > 0 && (
            <div className="p-4 rounded-lg bg-slate-950/80 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold font-mono text-amber-400 uppercase tracking-wider">
                <Sparkles size={14} /> Live Ranking Shift Simulation (Top 3)
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                {reRankedPreview.map((item, idx) => (
                  <div key={item.id || idx} className="flex items-center justify-between py-1 border-b border-slate-900 last:border-0">
                    <span className="text-slate-300 truncate max-w-[80%]">
                      {idx + 1}. <strong className="text-white">{item.title}</strong> — {item.company}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 font-bold">
                      {item.score}% Match
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 font-mono text-xs transition-colors cursor-pointer"
          >
            <RotateCcw size={14} /> Reset to Defaults
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-colors shadow-sm cursor-pointer"
            >
              <Check size={14} /> Apply Custom Matrix
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoringTunerModal;
