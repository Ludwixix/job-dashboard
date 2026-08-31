import React from 'react';
import { AlertCircle, ArrowRight, BookOpen, MessageSquare, Briefcase, ChevronRight, Calendar, CheckCircle2, Sparkles } from 'lucide-react';
import { PsychologyDecoderModal } from './PsychologyDecoderModal';

export const ActionHighlights = ({ jobs, onOpenMockInterview, onOpenInterviewPrep, onSelectJob }) => {
  const [psychJob, setPsychJob] = React.useState(null);
  // Filter jobs that need action: Interviewing, Offer, or Package Prepared
  const actionJobs = jobs.filter(j => {
    const s = (j.status || '').toLowerCase();
    return s.includes('interview') || s.includes('offer') || s.includes('package prepared') || s.includes('to submit');
  });

  if (actionJobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 size={32} className="lucide lucide-check-circle-2" />
        </div>
        <h3 className="text-lg font-black text-white uppercase">You're All Caught Up</h3>
        <p className="text-slate-400 text-sm mt-2 text-center max-w-sm">
          No immediate action items. Check back when your applications progress to interviews or when you have prepared packages to submit.
        </p>
      </div>
    );
  }

  // Define SVG for empty state inside the loop
  const EmptyCheck = ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-circle-2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
  );

  return (
    <>
    <div className="w-full flex flex-col h-full space-y-4 font-sans pb-10">
      <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/60 via-orange-950/40 to-slate-900 border border-amber-500/40 space-y-2">
        <div className="text-amber-300 font-black flex items-center gap-2 text-sm uppercase">
          <AlertCircle size={16} />
          Immediate Action Required ({actionJobs.length})
        </div>
        <p className="text-slate-300 text-xs leading-relaxed font-sans max-w-3xl">
          These applications have advanced to critical stages. Review the customized interview guidelines, launch a mock interview simulation, or submit your prepared application packages immediately.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actionJobs.map(job => {
          const isInterview = (job.status || '').toLowerCase().includes('interview');
          const isToSubmit = (job.status || '').toLowerCase().includes('package') || (job.status || '').toLowerCase().includes('submit');
          const isOffer = (job.status || '').toLowerCase().includes('offer');

          return (
            <div key={job.id} className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5 hover:border-slate-500 transition-colors shadow-lg flex flex-col justify-between space-y-4 relative overflow-hidden group">
              {/* Highlight Gradient strip */}
              <div className={`absolute top-0 left-0 w-1 h-full ${isInterview ? 'bg-indigo-500' : isToSubmit ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              
              <div>
                <div className="flex items-start justify-between mb-2">
                  <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider border ${
                    isInterview ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' :
                    isToSubmit ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                    'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}>
                    {job.status}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Updated {job.date || 'Recently'}
                  </span>
                </div>
                <h3 className="text-base font-black text-white leading-tight mt-1">{job.title}</h3>
                <p className="text-sm text-slate-400 font-medium">{job.company}</p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 border-b border-slate-800 pb-1">Recommended Preparation</div>
                
                {isInterview && (
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-xs text-slate-300">
                      <ChevronRight size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                      Review tailored STAR-method talking points for this specific role.
                    </li>
                    <li className="flex items-start gap-2 text-xs text-slate-300">
                      <ChevronRight size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                      Practice delivering your introduction and high-impact metrics in the LLM Simulator.
                    </li>
                  </ul>
                )}

                {isToSubmit && (
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-xs text-slate-300">
                      <ChevronRight size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      Review the generated Resume and Cover Letter PDF.
                    </li>
                    <li className="flex items-start gap-2 text-xs text-slate-300">
                      <ChevronRight size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      Submit via the portal link or quick apply gateway.
                    </li>
                  </ul>
                )}
                
                {isOffer && (
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-xs text-slate-300">
                      <ChevronRight size={14} className="text-amber-400 shrink-0 mt-0.5" />
                      Review contract terms and salary compared to your target base.
                    </li>
                    <li className="flex items-start gap-2 text-xs text-slate-300">
                      <ChevronRight size={14} className="text-amber-400 shrink-0 mt-0.5" />
                      Prepare negotiation strategy if compensation is below market average.
                    </li>
                  </ul>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60 mt-auto">
                {isInterview ? (
                  <>
                    <button
                      onClick={() => setPsychJob(job)}
                      className="py-2 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 font-bold text-xs flex items-center justify-center transition-colors cursor-pointer border border-purple-500/30"
                      title="Decrypt Psychology"
                    >
                      <Sparkles size={14} />
                    </button>
                    <button
                      onClick={() => onOpenInterviewPrep(job)}
                      className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <BookOpen size={14} /> Prep Guide
                    </button>
                    <button
                      onClick={() => onOpenMockInterview(job)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-indigo-500/30"
                    >
                      <MessageSquare size={14} /> Simulator
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onSelectJob(job)}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    Open Details <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
    {psychJob && <PsychologyDecoderModal job={psychJob} onClose={() => setPsychJob(null)} />}
    </>
  );
};
