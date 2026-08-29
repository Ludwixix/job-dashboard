import React, { useState } from 'react';
import { 
  CheckCircle2, Clock, MessageSquare, Award, ArrowRight, 
  Sparkles, ExternalLink, MoreVertical, FileText, Bot 
} from 'lucide-react';

const STAGES = [
  { id: 'Discovered', title: 'Target Queue', color: 'border-slate-700 bg-slate-900/50 text-slate-400', badge: 'bg-slate-800 text-slate-300' },
  { id: 'Applied', title: 'Applied', color: 'border-indigo-800/60 bg-indigo-950/20 text-indigo-400', badge: 'bg-indigo-900/60 text-indigo-300' },
  { id: 'Interviewing', title: 'Interviewing', color: 'border-amber-800/60 bg-amber-950/20 text-amber-400', badge: 'bg-amber-900/60 text-amber-300' },
  { id: 'Offer', title: 'Offer Stage', color: 'border-emerald-800/60 bg-emerald-950/20 text-emerald-400', badge: 'bg-emerald-900/60 text-emerald-300' },
];

export const KanbanBoard = ({ 
  jobs = [], 
  onUpdateStatus, 
  onOpenGenerator, 
  onOpenInterviewPrep 
}) => {
  const getJobStage = (job) => {
    const s = (job.status || '').toLowerCase();
    if (s.includes('interview') || s.includes('screen') || s.includes('assessment')) return 'Interviewing';
    if (s.includes('offer') || s.includes('accepted')) return 'Offer';
    if (s.includes('applied') || s.includes('submitted')) return 'Applied';
    return 'Discovered';
  };

  const columns = STAGES.map(stage => ({
    ...stage,
    jobs: jobs.filter(j => !j.isRejected && getJobStage(j) === stage.id)
  }));

  const handleAdvance = (job, currentStage) => {
    if (currentStage === 'Discovered') onUpdateStatus(job.id, 'Applied');
    else if (currentStage === 'Applied') onUpdateStatus(job.id, 'Interviewing');
    else if (currentStage === 'Interviewing') onUpdateStatus(job.id, 'Offer');
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header info */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-white">Application Pipeline Funnel</h2>
          <p className="text-xs text-slate-400">Track application lifecycles from initial discovery to executive interview and offer.</p>
        </div>
        <div className="text-xs text-slate-500 font-mono">
          Active In-Flight: {jobs.filter(j => !j.isRejected && getJobStage(j) !== 'Discovered').length} roles
        </div>
      </div>

      {/* Grid columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {columns.map(col => (
          <div key={col.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3 min-h-[500px]">
            {/* Column Title */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white uppercase tracking-wider">{col.title}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${col.badge}`}>
                  {col.jobs.length}
                </span>
              </div>
            </div>

            {/* Cards */}
            <div className="space-y-3">
              {col.jobs.slice(0, 15).map(job => (
                <div 
                  key={job.id} 
                  className="bg-slate-950/80 border border-slate-800/90 hover:border-indigo-500/50 rounded-xl p-3.5 space-y-2.5 transition-all shadow-sm group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-400 truncate">{job.company}</div>
                      <h4 className="text-xs font-bold text-white leading-tight group-hover:text-indigo-300 transition-colors line-clamp-1">
                        {job.title}
                      </h4>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-800 text-emerald-400 shrink-0">
                      {job.score || 85}%
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>{job.location || 'Melbourne'}</span>
                    <span>{job.salary ? job.salary.split(' ')[0] : 'Standard Band'}</span>
                  </div>

                  {/* Action buttons */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onOpenGenerator(job)}
                        className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                        title="Open AI Studio"
                      >
                        <Sparkles size={12} /> Studio
                      </button>
                      <button
                        onClick={() => onOpenInterviewPrep(job)}
                        className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                        title="Interview Prep"
                      >
                        <Bot size={12} /> Prep
                      </button>
                    </div>

                    {col.id !== 'Offer' && (
                      <button
                        onClick={() => handleAdvance(job, col.id)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-indigo-600 rounded-lg transition-colors cursor-pointer"
                        title="Advance to next stage"
                      >
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {col.jobs.length === 0 && (
                <div className="py-12 text-center text-xs text-slate-600">
                  No roles in {col.title.toLowerCase()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
