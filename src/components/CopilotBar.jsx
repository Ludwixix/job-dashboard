import React, { useMemo } from 'react';
import { Bot, Search, Zap } from 'lucide-react';
import { generateAgentInsights } from '../services/generationService';

export const CopilotBar = ({ 
  jobs = [], 
  overrides = {}, 
  onOpenCommandPalette, 
  onOpenGenerator, 
  onNavigateView 
}) => {
  const insights = useMemo(() => generateAgentInsights(jobs, overrides), [jobs, overrides]);

  const topAction = insights.priorityActions[0];

  const handleActionClick = () => {
    if (!topAction) return;
    if (topAction.id === 'apply_top' && topAction.targetJobId) {
      const targetJob = jobs.find(j => j.id === topAction.targetJobId);
      if (targetJob) onOpenGenerator(targetJob);
    } else if (topAction.id === 'daily_market_pulse') {
      onNavigateView('market');
    } else if (topAction.id === 'followup_stale') {
      onNavigateView('kanban');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 shadow-lg">
      <div className="flex items-center gap-3 w-full md:w-auto">
        <div className="p-2 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl text-white shrink-0 shadow-md">
          <Bot size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400">
              Autonomous Agent Copilot
            </span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active Telemetry
            </span>
          </div>
          <div className="text-xs font-semibold text-slate-200 truncate mt-0.5">
            {topAction?.title || 'Monitoring market feeds for high-fit enterprise opportunities...'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0">
        {topAction && (
          <button
            onClick={handleActionClick}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Zap size={12} /> {topAction.actionLabel}
          </button>
        )}

        <button
          onClick={onOpenCommandPalette}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
        >
          <Search size={12} />
          <span>Omni Search</span>
          <kbd className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-slate-400 font-mono">⌘K</kbd>
        </button>
      </div>
    </div>
  );
};
