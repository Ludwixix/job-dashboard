import React, { useState } from 'react';
import { Zap, CheckCircle2, X, Play, Loader2 } from 'lucide-react';
import { executeClientSideAutoApply } from '../services/generationService';

export const BatchApplyModal = ({ jobs, isOpen, onClose, onComplete }) => {
  const [selectedJobIds, setSelectedJobIds] = useState(() => {
    // Select top 3 highest scoring unsubmitted jobs by default
    const unsubmitted = jobs.filter(j => 
      !j.status.toLowerCase().includes('applied') && 
      !j.status.toLowerCase().includes('confirmation')
    ).sort((a, b) => (b.score || 0) - (a.score || 0));

    return unsubmitted.slice(0, 3).map(j => j.id || `${j.company}_${j.title}`);
  });

  const [isExecuting, setIsExecuting] = useState(false);
  const [currentProgressIndex, setCurrentProgressIndex] = useState(0);
  const [completedResults, setCompletedResults] = useState([]);

  if (!isOpen) return null;

  const targetJobs = jobs.filter(j => 
    selectedJobIds.includes(j.id) || selectedJobIds.includes(`${j.company}_${j.title}`)
  );

  const toggleJobSelection = (jobId) => {
    if (selectedJobIds.includes(jobId)) {
      setSelectedJobIds(selectedJobIds.filter(id => id !== jobId));
    } else {
      setSelectedJobIds([...selectedJobIds, jobId]);
    }
  };

  const handleRunBatchPipeline = async () => {
    if (targetJobs.length === 0) return;
    setIsExecuting(true);
    setCurrentProgressIndex(0);
    const results = [];

    for (let i = 0; i < targetJobs.length; i++) {
      const job = targetJobs[i];
      setCurrentProgressIndex(i + 1);
      try {
        const data = await executeClientSideAutoApply(job);
        if (data && data.success) {
          results.push({ job, result: data.pipeline_result, success: true });
        } else {
          results.push({ job, error: data?.error || 'Failed to apply', success: false });
        }
      } catch (e) {
        results.push({ job, error: e.message, success: false });
      }
    }

    setCompletedResults(results);
    setIsExecuting(false);
    if (onComplete) {
      onComplete(results);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md font-mono p-4">
      <div className="w-full max-w-2xl bg-[#181825] border-2 border-emerald-500/50 rounded-2xl shadow-2xl overflow-hidden text-slate-100 space-y-4 p-6">
        <div className="flex items-center justify-between border-b border-[#313244] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
              <Zap size={20} className="animate-bounce" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">
                1-CLICK BATCH APPLICATION DISPATCHER
              </h3>
              <p className="text-[11px] text-slate-400 font-bold">SELECT TARGET POSITIONS TO APPLY FOR AUTOMATICALLY</p>
            </div>
          </div>
          <button 
            onClick={() => onClose()} 
            disabled={isExecuting}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Selected Jobs Checklist */}
        {!isExecuting && completedResults.length === 0 && (
          <div className="space-y-3">
            <div className="text-xs text-purple-300 font-bold uppercase">SELECT POSITIONS TO DISPATCH:</div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {jobs.slice(0, 10).map(job => {
                const identifier = job.id || `${job.company}_${job.title}`;
                const isSelected = selectedJobIds.includes(identifier);
                return (
                  <div
                    key={identifier}
                    onClick={() => toggleJobSelection(identifier)}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-purple-950/40 border-purple-500/60 text-white' 
                        : 'bg-[#1e1e2e] border-[#313244] text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={isSelected} 
                        onChange={() => {}}
                        className="rounded border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-black text-white">{job.title}</div>
                        <div className="text-[11px] font-bold text-slate-400">{job.company} • {job.location}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                      {job.score || 85}% MATCH
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleRunBatchPipeline}
              disabled={selectedJobIds.length === 0}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Play size={16} /> DISPATCH {selectedJobIds.length} AUTOMATED APPLICATIONS NOW
            </button>
          </div>
        )}

        {/* Execution Progress Bar */}
        {isExecuting && (
          <div className="py-8 space-y-4 text-center font-mono">
            <Loader2 size={36} className="animate-spin text-emerald-400 mx-auto" />
            <div className="text-sm font-black text-white">
              DISPATCHING APPLICATION [{currentProgressIndex} / {targetJobs.length}]
            </div>
            <p className="text-xs text-slate-400">
              Generating tailored PDFs, mapping profile fields, and dispatching submission...
            </p>
          </div>
        )}

        {/* Completed Batch Results Audit */}
        {completedResults.length > 0 && !isExecuting && (
          <div className="space-y-3">
            <div className="text-xs text-emerald-400 font-bold uppercase flex items-center gap-1.5">
              <CheckCircle2 size={16} /> BATCH DISPATCH COMPLETED SUCCESSFULLY ({completedResults.length} POSITIONS)
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {completedResults.map((item, idx) => (
                <div key={idx} className={`p-3 rounded-xl bg-[#1e1e2e] border ${item.success ? 'border-emerald-500/40' : 'border-rose-500/40'} text-xs font-mono`}>
                  <div className="font-black text-white">{item.job.title} — {item.job.company}</div>
                  {item.success ? (
                    <div className="text-[11px] text-emerald-300 font-bold">Status: Applied / Confirmation Received ✅</div>
                  ) : (
                    <div className="text-[11px] text-rose-400 font-bold whitespace-pre-wrap">Action requires an API key or failed: {item.error}</div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => onClose()}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs cursor-pointer"
            >
              CLOSE BATCH AUDIT
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

