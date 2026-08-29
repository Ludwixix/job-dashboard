import React from 'react';
import { 
  ArrowRight, Sparkles, Bot, AlertCircle, RotateCcw, CheckCircle2
} from 'lucide-react';

const STAGES = [
  { id: 'Discovered', title: 'Target Queue', color: 'border-slate-700 bg-slate-900/50 text-slate-400', badge: 'bg-slate-800 text-slate-300' },
  { id: 'Applied', title: 'Applied (Active)', color: 'border-indigo-800/60 bg-indigo-950/20 text-indigo-400', badge: 'bg-indigo-900/60 text-indigo-300' },
  { id: 'Interviewing', title: 'Interviewing', color: 'border-amber-800/60 bg-amber-950/20 text-amber-400', badge: 'bg-amber-900/60 text-amber-300' },
  { id: 'Offer', title: 'Offer Stage', color: 'border-emerald-800/60 bg-emerald-950/20 text-emerald-400', badge: 'bg-emerald-900/60 text-emerald-300' },
  { id: 'Closed', title: 'Closed / Non-Responsive', color: 'border-rose-950/40 bg-slate-950/40 text-slate-500', badge: 'bg-rose-950/80 text-rose-300 border border-rose-800/40' },
];

export const KanbanBoard = ({ 
  jobs = [], 
  onUpdateStatus, 
  onOpenGenerator, 
  onOpenInterviewPrep 
}) => {
  const getJobStage = (job) => {
    const s = (job.status || '').toLowerCase();
    if (s.includes('non-responsive') || s.includes('closed') || s.includes('unsuccessful')) return 'Closed';
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

  const handleReopen = (job) => {
    onUpdateStatus(job.id, 'Applied');
  };

  const handleClose = (job) => {
    onUpdateStatus(job.id, 'Non-Responsive Employer (Closed)');
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-black text-white">Application Pipeline Funnel</h2>
          <p className="text-xs text-slate-400">Track application lifecycles from initial discovery to active interviews and closed non-responsive employers.</p>
        </div>
        <div className="text-xs text-slate-500 font-mono">
          Active In-Flight: {jobs.filter(j => !j.isRejected && getJobStage(j) !== 'Discovered' && getJobStage(j) !== 'Closed').length} roles
        </div>
      </div>

      {/* Grid columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5 items-start">
        {columns.map(col => (
          <div key={col.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 space-y-3 min-h-[520px]">
            {/* Column Title */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] font-black text-white uppercase tracking-wider truncate">{col.title}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${col.badge} shrink-0`}>
                  {col.jobs.length}
                </span>
              </div>
            </div>

            {/* Cards */}
            <div className="space-y-2.5">
              {col.jobs.slice(0, 20).map(job => (
                <div 
                  key={job.id} 
                  className={`border rounded-xl p-3 space-y-2 transition-all shadow-sm group ${
                    col.id === 'Closed' 
                      ? 'bg-slate-950/40 border-slate-800/50 opacity-75' 
                      : 'bg-slate-950/80 border-slate-800/90 hover:border-indigo-500/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-semibold text-slate-400 truncate">{job.company}</div>
                      <h4 className="text-xs font-bold text-white leading-tight group-hover:text-indigo-300 transition-colors line-clamp-1">
                        {job.title}
                      </h4>
                    </div>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-900 border border-slate-800 text-emerald-400 shrink-0">
                      {job.score || 85}%
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-500 flex items-center justify-between">
                    <span className="truncate">{job.location || 'Melbourne'}</span>
                    <span className="shrink-0">{job.salary ? job.salary.split(' ')[0] : 'Standard'}</span>
                  </div>

                  {job.hasCustomDocs && (
                    <div className="text-[9px] text-emerald-300 font-bold bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-500/40 flex items-center gap-1">
                      <CheckCircle2 size={10} className="text-emerald-400" /> Tailored PDFs Ready
                    </div>
                  )}

                  {job.status === 'Non-Responsive Employer (Closed)' && (
                    <div className="text-[9px] text-rose-400 font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/30 flex items-center gap-1">
                      <AlertCircle size={10} /> Auto-Closed (&gt;14d No Response)
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onOpenGenerator(job)}
                        className="p-1 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer"
                        title="Open AI Studio"
                      >
                        <Sparkles size={11} /> Studio
                      </button>
                      <button
                        onClick={() => onOpenInterviewPrep(job)}
                        className="p-1 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer"
                        title="Interview Prep"
                      >
                        <Bot size={11} /> Prep
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {col.id === 'Applied' && (
                        <button
                          onClick={() => handleClose(job)}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer text-[10px]"
                          title="Mark as Non-Responsive & Close"
                        >
                          Close
                        </button>
                      )}

                      {col.id === 'Closed' && (
                        <button
                          onClick={() => handleReopen(job)}
                          className="p-1 text-indigo-400 hover:text-white hover:bg-indigo-600 rounded transition-colors cursor-pointer text-[10px] flex items-center gap-0.5"
                          title="Reopen Application"
                        >
                          <RotateCcw size={10} /> Reopen
                        </button>
                      )}

                      {col.id !== 'Offer' && col.id !== 'Closed' && (
                        <button
                          onClick={() => handleAdvance(job, col.id)}
                          className="p-1 text-slate-400 hover:text-white hover:bg-indigo-600 rounded transition-colors cursor-pointer"
                          title="Advance to next stage"
                        >
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {col.jobs.length === 0 && (
                <div className="py-12 text-center text-[11px] text-slate-600">
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
