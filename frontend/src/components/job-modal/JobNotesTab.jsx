import React from 'react';
import { Edit3, Check } from 'lucide-react';

export function JobNotesTab({
  job,
  candidateNotes,
  setCandidateNotes,
  isSavingNotes,
  notesSavedSuccess,
  handleSaveNotes
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200 font-mono">
      <div className="p-5 rounded-sm bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Edit3 size={16} className="text-amber-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              CANDIDATE NOTES &amp; FOLLOW-UP SCRATCHPAD
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {notesSavedSuccess && (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Check size={13} /> SAVED
              </span>
            )}
            <button
              type="button"
              onClick={() => handleSaveNotes(candidateNotes)}
              disabled={isSavingNotes}
              className="px-3.5 py-1.5 rounded-sm bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isSavingNotes ? 'SAVING...' : 'SAVE NOTES'}
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 font-sans">
          Keep private records of outreach, salary talks, interview dates, referral contacts, or key questions for this role. Notes persist across reloads and sync to your dashboard.
        </p>

        {/* Quick Snippet Chips */}
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase font-bold text-slate-500">QUICK TEMPLATES &amp; STATUS TAGS:</div>
          <div className="flex flex-wrap gap-1.5">
            {[
              '📞 Phone screen scheduled',
              '💼 Spoke with hiring manager',
              '🤝 Reached out to connection on LinkedIn',
              '⏳ Awaiting feedback on round 1',
              '💰 Discussed target salary: $150k + super',
              '⭐ Culture and tech stack align well'
            ].map((snippet, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  const updated = candidateNotes ? `${candidateNotes}\n• ${snippet}` : `• ${snippet}`;
                  handleSaveNotes(updated);
                }}
                className="px-2.5 py-1 rounded-sm bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[11px] font-sans border border-slate-700 cursor-pointer transition-colors"
              >
                + {snippet}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <div className="pt-2">
          <textarea
            rows={8}
            value={candidateNotes}
            onChange={(e) => setCandidateNotes(e.target.value)}
            placeholder="Type private notes, recruiter names, follow-up dates, or interview feedback here..."
            className="w-full rounded-sm bg-slate-950/80 border border-slate-700/80 p-3.5 text-xs text-slate-200 font-sans focus:outline-none focus:ring-2 focus:ring-amber-400/50 resize-y leading-relaxed"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>LAST UPDATED: {job?.updated_at || job?.date || 'RECENT'}</span>
          <div className="flex items-center gap-2">
            {candidateNotes && candidateNotes.trim() ? (
              <button
                type="button"
                onClick={() => handleSaveNotes('')}
                className="text-rose-400 hover:text-rose-300 text-[11px] cursor-pointer"
              >
                CLEAR NOTES
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
