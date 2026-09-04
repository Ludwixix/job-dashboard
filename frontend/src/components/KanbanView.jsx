import React, { useState, useMemo } from 'react';
import { 
  ExternalLink, FileText, DollarSign, MapPin, Clock, Award, 
  Mail, Download, ArrowRight, Sparkles, AlertCircle 
} from 'lucide-react';
import { isValidTrackerJob, getCleanJobDescriptionBrief, getApplicationWorkflow } from '../services/trackerService';
import { downloadResumePdf, downloadCoverLetterPdf } from '../utils/pdfGenerator';
import { hasGeneratedApplicationDocs } from '../services/generationService';
import { FollowUpEmailModal } from './FollowUpEmailModal';

const DEFAULT_COLUMNS = [
  { key: 'applied', title: 'Applied / In Review', color: 'border-blue-500/40 bg-blue-950/20 text-blue-400' },
  { key: 'interview', title: 'Interview Scheduled', color: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-400' },
  { key: 'offer', title: 'Offer Received 🎉', color: 'border-amber-500/40 bg-amber-950/20 text-amber-400' },
  { key: 'hired', title: 'Accepted / Hired 🚀', color: 'border-teal-500/40 bg-teal-950/20 text-teal-400' },
  { key: 'non_responsive', title: 'Non-Responsive (Closed)', color: 'border-slate-700 bg-slate-900/40 text-slate-400' },
  { key: 'unsuccessful', title: 'Unsuccessful / Closed', color: 'border-rose-500/30 bg-rose-950/20 text-rose-400' }
];

export const KanbanView = ({ jobs = [], onSelectJob }) => {
  const [activeFollowUpJob, setActiveFollowUpJob] = useState(null);

  const validJobs = useMemo(() => {
    return (jobs || []).filter(isValidTrackerJob);
  }, [jobs]);

  const jobsByStage = useMemo(() => {
    const map = {
      applied: [],
      interview: [],
      offer: [],
      hired: [],
      non_responsive: [],
      unsuccessful: []
    };

    validJobs.forEach(job => {
      const workflow = getApplicationWorkflow(job);
      if (map[workflow.stageKey]) {
        map[workflow.stageKey].push({ job, workflow });
      } else {
        map.applied.push({ job, workflow });
      }
    });

    return map;
  }, [validJobs]);

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-6 h-[calc(100vh-230px)] items-start w-full font-sans custom-scrollbar">
        {DEFAULT_COLUMNS.map(col => {
          const items = jobsByStage[col.key] || [];

          return (
            <div 
              key={col.key} 
              className="bg-[#181825] border border-[#313244] rounded-2xl flex-1 min-w-[310px] max-w-sm flex flex-col max-h-full shadow-lg"
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-[#313244] flex items-center justify-between bg-[#1e1e2e] rounded-t-2xl font-mono">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    col.key === 'offer' ? 'bg-amber-400 animate-pulse' :
                    col.key === 'interview' ? 'bg-emerald-400' :
                    col.key === 'hired' ? 'bg-teal-400' :
                    col.key === 'applied' ? 'bg-blue-400' : 'bg-slate-500'
                  }`} />
                  <h3 className="font-extrabold text-xs tracking-wider text-slate-200 uppercase truncate">
                    {col.title}
                  </h3>
                </div>
                <span className="bg-slate-900 text-purple-300 font-mono text-[10px] font-black px-2.5 py-0.5 rounded-lg border border-[#313244]">
                  {items.length}
                </span>
              </div>

              {/* Column Cards Container */}
              <div className="p-3 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
                {items.map(({ job, workflow }) => {
                  const hasCustomDocs = hasGeneratedApplicationDocs(job);
                  const portalUrl = job.portalLink || job.link || job.url;

                  return (
                    <div 
                      key={job.id} 
                      onClick={() => onSelectJob && onSelectJob(job)}
                      className="bg-[#1e1e2e] hover:bg-[#252538] p-4 rounded-xl border border-[#313244] hover:border-purple-500/50 shadow-md transition-all cursor-pointer group space-y-3"
                    >
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-sm text-white group-hover:text-purple-300 transition-colors leading-snug truncate">
                            {job.company}
                          </h4>
                          <p className="text-xs font-semibold text-slate-300 truncate mt-0.5">
                            {job.title}
                          </p>
                        </div>

                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-mono font-bold shrink-0">
                          <Award size={11} className="text-emerald-400" />
                          {job.score || 85}%
                        </span>
                      </div>

                      {/* Location & Salary Chips */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                        <span className="flex items-center gap-1 text-slate-400">
                          <MapPin size={11} className="text-slate-500" />
                          <span className="truncate max-w-[130px]">{job.location || 'Melbourne, VIC'}</span>
                        </span>
                        {job.salary && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            <DollarSign size={10} />
                            {job.salary}
                          </span>
                        )}
                      </div>

                      {/* Clean Description Snippet */}
                      <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                        {getCleanJobDescriptionBrief(job, 120)}
                      </p>

                      {/* Current & Next Move Playbook */}
                      <div className="p-2.5 rounded-lg bg-[#181825] border border-[#313244] space-y-1 font-mono text-[10px]">
                        <div className="text-slate-400 truncate">
                          <span className="text-slate-500 font-bold uppercase mr-1">STATE:</span>
                          {workflow.currentStep}
                        </div>
                        <div className="text-purple-300 font-bold leading-tight">
                          <span className="text-indigo-400 font-black uppercase mr-1">NEXT:</span>
                          {workflow.nextStep}
                        </div>
                      </div>

                      {/* Action Bar & Direct Links */}
                      <div className="pt-2 border-t border-[#313244] flex items-center justify-between gap-1 font-mono text-[10px]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 text-slate-400">
                          <Clock size={11} className="text-purple-400" />
                          <span>{workflow.daysAgo === 0 ? 'Today' : `${workflow.daysAgo}d ago`}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Follow-up Email */}
                          <button
                            onClick={() => setActiveFollowUpJob(job)}
                            className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-400/30 font-bold transition-colors cursor-pointer flex items-center gap-1"
                            title="Draft follow-up email"
                          >
                            <Mail size={11} /> EMAIL
                          </button>

                          {/* Direct Job Ad */}
                          {portalUrl && (
                            <a
                              href={portalUrl.startsWith('http') ? portalUrl : `https://${portalUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                              title="Open original job ad"
                            >
                              <ExternalLink size={12} />
                            </a>
                          )}

                          {/* Open Card Dossier */}
                          <button
                            onClick={() => onSelectJob && onSelectJob(job)}
                            className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-black transition-colors cursor-pointer flex items-center gap-1"
                            title="Open Application Card Dossier"
                          >
                            CARD <ArrowRight size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {items.length === 0 && (
                  <div className="text-center py-8 text-slate-500 font-mono text-xs">
                    No active applications in this stage.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Follow-up Email Modal */}
      {activeFollowUpJob && (
        <FollowUpEmailModal
          job={activeFollowUpJob}
          onClose={() => setActiveFollowUpJob(null)}
        />
      )}
    </>
  );
};
