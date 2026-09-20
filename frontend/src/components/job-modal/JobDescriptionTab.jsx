import React from 'react';
import {
  Clock, MapPin, DollarSign, Briefcase, CheckCircle2, Award,
  Sparkles, FileText, Loader2, RefreshCw, ChevronUp, ChevronDown
} from 'lucide-react';
import { formatJobPostedAge } from '../../utils/dateUtils';

export function JobDescriptionTab({
  job,
  currentDescription,
  isLongText,
  isDescriptionExpanded,
  setIsDescriptionExpanded,
  isEnrichingDescription,
  handleManualEnrich,
  renderFormattedDescription
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Info Chips Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="flex items-center gap-2 p-3 rounded-sm bg-slate-900/80 border border-slate-800 text-slate-200">
          <Clock size={15} className="text-amber-400 shrink-0" />
          <div>
            <div className="text-[9px] text-slate-400 font-bold uppercase">POSTED</div>
            <div className="font-extrabold text-slate-100">{formatJobPostedAge(job?.date)}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-sm bg-slate-900/80 border border-slate-800 text-slate-200">
          <MapPin size={15} className="text-amber-400 shrink-0" />
          <div>
            <div className="text-[9px] text-slate-400 font-bold uppercase">LOCATION</div>
            <div className="font-extrabold text-slate-100 truncate">{job?.location || 'Melbourne, VIC'}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-sm bg-emerald-950/40 text-emerald-200 border border-emerald-500/40">
          <DollarSign size={15} className="text-emerald-400 shrink-0" />
          <div>
            <div className="text-[9px] text-emerald-400/80 font-bold uppercase">REMUNERATION</div>
            <div className="font-extrabold">{job?.salary || 'Market Rate'}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-sm bg-slate-900/80 border border-slate-800 text-slate-200">
          <Briefcase size={15} className="text-amber-400 shrink-0" />
          <div>
            <div className="text-[9px] text-slate-400 font-bold uppercase">WORK MODE</div>
            <div className="font-extrabold text-slate-100">
              {job?.workArrangement || (job?.remote ? 'Remote' : 'Hybrid')} • {job?.employmentType || 'Full-time'}
            </div>
          </div>
        </div>
      </div>

      {/* Structured Key Responsibilities */}
      {job?.keyResponsibilities && job.keyResponsibilities.length > 0 && (
        <div className="p-4 rounded-sm bg-amber-950/30 border border-amber-500/30 space-y-2 font-mono">
          <div className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 size={14} className="text-amber-400" />
            KEY RESPONSIBILITIES &amp; DELIVERABLES ({job.keyResponsibilities.length})
          </div>
          <ul className="space-y-1.5 pt-1">
            {job.keyResponsibilities.map((resp, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-300 font-sans">
                <span className="text-amber-400 font-black shrink-0">•</span>
                <span>{resp}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Structured Requirements & Qualifications */}
      {job?.requirements && job.requirements.length > 0 && (
        <div className="p-4 rounded-sm bg-slate-900/70 border border-slate-800 space-y-2 font-mono">
          <div className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Award size={14} className="text-amber-400" />
            REQUIRED QUALIFICATIONS &amp; EXPERIENCE ({job.requirements.length})
          </div>
          <ul className="space-y-1.5 pt-1">
            {job.requirements.map((req, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-300 font-sans">
                <span className="text-emerald-400 font-black shrink-0">✓</span>
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Structured Benefits & Perks */}
      {job?.benefits && job.benefits.length > 0 && (
        <div className="p-4 rounded-sm bg-emerald-950/30 border border-emerald-500/30 space-y-2 font-mono">
          <div className="text-xs font-black text-emerald-300 uppercase tracking-wider flex items-center gap-2">
            <Sparkles size={14} className="text-emerald-400" />
            BENEFITS &amp; CULTURE ({job.benefits.length})
          </div>
          <ul className="space-y-1.5 pt-1">
            {job.benefits.map((ben, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-emerald-200 font-sans">
                <span className="text-emerald-400 font-black shrink-0">★</span>
                <span>{ben}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Expandable Formatted Job Description */}
      {currentDescription ? (
        <div className="space-y-3 font-mono">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-slate-400" /> FULL JOB ADVERTISEMENT TEXT
              {isEnrichingDescription && (
                <span className="flex items-center gap-1 text-[9px] text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded-sm font-sans font-bold animate-pulse">
                  <Loader2 size={10} className="animate-spin text-amber-400" /> Enriching ad...
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleManualEnrich}
                disabled={isEnrichingDescription}
                className="text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 px-2.5 py-1 rounded-sm font-sans font-bold flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                title="Fetch full ad text from source"
              >
                <RefreshCw size={11} className={isEnrichingDescription ? 'animate-spin' : ''} />
                {isEnrichingDescription ? 'ENRICHING...' : 'ENRICH / RE-FETCH'}
              </button>
              {isLongText && (
                <button
                  type="button"
                  onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                  className="text-amber-400 hover:text-amber-300 font-extrabold flex items-center gap-1 cursor-pointer"
                >
                  {isDescriptionExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {isDescriptionExpanded ? 'COLLAPSE DESCRIPTION' : 'SHOW FULL DESCRIPTION'}
                </button>
              )}
            </div>
          </div>

          <div className="relative">
            <div className={`p-5 rounded-sm bg-slate-900/70 border border-slate-800 text-slate-200 transition-all duration-300 ${
              !isDescriptionExpanded && isLongText ? 'max-h-[280px] overflow-hidden' : 'max-h-[70vh] overflow-y-auto'
            }`}>
              {renderFormattedDescription(currentDescription)}
            </div>

            {!isDescriptionExpanded && isLongText && (
              <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#0b0f19] to-transparent rounded-b-2xl flex items-end justify-center pb-2 pointer-events-none">
                <span
                  className="text-[10px] font-extrabold text-amber-300 bg-slate-800 px-3 py-1 rounded-sm border border-amber-500/40 pointer-events-auto cursor-pointer"
                  onClick={() => setIsDescriptionExpanded(true)}
                >
                  + SHOW FULL DESCRIPTION
                </span>
              </div>
            )}
          </div>
        </div>
      ) : isEnrichingDescription ? (
        <div className="p-8 text-center bg-amber-950/40 rounded-sm border border-amber-500/40 font-mono text-xs text-amber-300 flex flex-col items-center justify-center gap-3">
          <Loader2 size={24} className="animate-spin text-amber-400" />
          <p className="font-bold">FETCHING DETAILED ADVERTISEMENT FROM SOURCE...</p>
        </div>
      ) : (
        <div className="p-8 text-center bg-slate-900/60 rounded-sm border border-slate-800 font-mono text-xs text-slate-400 space-y-3">
          <p>NO JOB DESCRIPTION AVAILABLE FOR THIS POSITION.</p>
          <button
            type="button"
            onClick={handleManualEnrich}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-sm text-xs inline-flex items-center gap-2 cursor-pointer transition-colors"
          >
            <RefreshCw size={13} /> FETCH FROM SOURCE
          </button>
        </div>
      )}
    </div>
  );
}