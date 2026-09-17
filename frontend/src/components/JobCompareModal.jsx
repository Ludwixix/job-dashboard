import React from 'react';
import { X, Scale, Building2, MapPin, DollarSign, Award, Check, AlertCircle, ExternalLink } from 'lucide-react';

export const JobCompareModal = ({ jobs = [], onClose, onSelectForApply }) => {
  if (!jobs || jobs.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-[#12141a] rounded-lg w-full max-w-5xl border border-slate-700 flex flex-col max-h-[92vh] overflow-hidden shadow-2xl relative">
        {/* Header */}
        <div className="bg-[#0b0c10] px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-md text-amber-400">
              <Scale size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">Comparative Opportunity Matrix</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">
                  {jobs.length} Positions Compared
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Side-by-side evaluation of strategic alignment, financial offer, and technology stack requirements.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Comparison Grid */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className={`grid grid-cols-1 md:grid-cols-${Math.min(jobs.length, 3)} gap-4`}>
            {jobs.map((job) => {
              const score = Number(job.score) || 85;
              const matched = job.audit?.matched_terms || job.tags || [];
              const missing = job.audit?.missing_skills || [];
              const salary = job.salary || job.salary_min ? `$${(job.salary_min / 1000).toFixed(0)}k–$${(job.salary_max / 1000).toFixed(0)}k` : 'Market Competitive';

              return (
                <div
                  key={job.id}
                  className="bg-[#181a20] border border-slate-800 rounded-lg p-5 flex flex-col justify-between space-y-4 relative"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {job.source || 'Aggregator'}
                      </span>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono font-bold text-xs">
                        <Award size={13} />
                        <span>{score}% Match</span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-white line-clamp-2">{job.title}</h3>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1 font-medium">
                        <Building2 size={13} className="text-slate-500" />
                        <span>{job.company}</span>
                      </p>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <MapPin size={13} className="text-slate-500" />
                        <span>{job.location || 'Melbourne, VIC'}</span>
                      </p>
                    </div>

                    {/* Financial Band */}
                    <div className="p-2.5 rounded bg-[#0e1015] border border-slate-800/80 flex items-center gap-2 text-xs">
                      <DollarSign size={14} className="text-emerald-400" />
                      <div>
                        <div className="text-[10px] uppercase font-mono text-slate-500">Compensation</div>
                        <div className="font-bold text-slate-200">{salary}</div>
                      </div>
                    </div>

                    {/* Skill Overlap */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-mono text-slate-400 uppercase font-bold flex items-center gap-1">
                        <Check size={12} className="text-emerald-400" />
                        <span>Matched Capabilities ({matched.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {matched.slice(0, 5).map((m, i) => (
                          <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Missing Skills */}
                    {missing.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-mono text-slate-400 uppercase font-bold flex items-center gap-1">
                          <AlertCircle size={12} className="text-amber-400" />
                          <span>Gaps ({missing.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {missing.slice(0, 4).map((m, i) => (
                            <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-800/40">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center gap-2">
                    {onSelectForApply && (
                      <button
                        onClick={() => {
                          onSelectForApply(job);
                          onClose();
                        }}
                        className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold transition-colors text-center"
                      >
                        Select for Application
                      </button>
                    )}
                    {job.portalLink || job.url || job.link ? (
                      <a
                        href={job.portalLink || job.url || job.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                        title="Open external ad"
                      >
                        <ExternalLink size={14} />
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#0b0c10] px-6 py-3 border-t border-slate-800 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};

export default JobCompareModal;
