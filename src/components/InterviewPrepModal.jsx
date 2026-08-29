import React, { useState, useEffect } from 'react';
import { X, Sparkles, BookOpen, MessageSquare, Check, Copy, HelpCircle, Trophy, Layers } from 'lucide-react';
import { generateInterviewGuide } from '../services/generationService';

export const InterviewPrepModal = ({ job, onClose }) => {
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedSection, setCopiedSection] = useState('');

  useEffect(() => {
    let isMounted = true;
    generateInterviewGuide(job).then(res => {
      if (isMounted) {
        setGuide(res);
        setLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [job]);

  const handleCopy = (text, sectionName) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionName);
    setTimeout(() => setCopiedSection(''), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-700/60 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 relative">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-400" />
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/15 border border-amber-400/30 rounded-xl">
              <Sparkles size={18} className="text-amber-400" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Interview Super Intelligence</div>
              <h2 className="text-base font-black text-white leading-tight">{job.company}</h2>
              <p className="text-xs text-slate-400 font-medium">{job.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="text-xs text-slate-400 font-medium">Synthesizing STAR responses from candidate career metrics...</div>
            </div>
          ) : (
            <>
              {/* Talking Points */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                    <Trophy size={14} className="text-emerald-400" /> High-Impact Proof Points (Anchor Statements)
                  </div>
                  <button
                    onClick={() => handleCopy(guide.talkingPoints.join('\n• '), 'talkingPoints')}
                    className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSection === 'talkingPoints' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    {copiedSection === 'talkingPoints' ? 'COPIED' : 'COPY'}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {guide.talkingPoints.map((tp, idx) => (
                    <div key={idx} className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-emerald-400 font-black shrink-0">•</span>
                      <span>{tp}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* STAR Format Predicted Questions */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <MessageSquare size={14} className="text-indigo-400" /> Tailored Behavioral & Technical Questions
                </div>
                <div className="space-y-3">
                  {guide.questions.map((q, idx) => (
                    <div key={idx} className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700/40 text-indigo-300 uppercase">
                          {q.type}
                        </span>
                        <span className="text-[10px] font-bold text-amber-400 font-mono">
                          Key Metric: {q.keyMetric}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white leading-snug">"{q.question}"</h4>
                      <div className="text-[11px] text-slate-400 bg-slate-900/80 p-3 rounded-lg border border-slate-800 leading-relaxed">
                        <strong className="text-slate-300 font-semibold block mb-1">Recommended STAR Angle:</strong>
                        {q.answerStrategy}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reverse Questions to Ask Interviewer */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <HelpCircle size={14} className="text-amber-400" /> Strategic Questions to Ask the Hiring Manager
                </div>
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  {guide.recommendedQuestionsToAsk.map((rq, idx) => (
                    <div key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-amber-400 font-bold">{idx + 1}.</span>
                      <span>{rq}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-600 font-mono uppercase">
            Auto-synthesized against Sam Ludwig Master Profile
          </span>
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer">
            DONE
          </button>
        </div>
      </div>
    </div>
  );
};
