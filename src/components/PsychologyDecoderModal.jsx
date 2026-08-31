import React, { useState, useEffect } from 'react';
import { X, Sparkles, AlertCircle, Target, Briefcase, Eye, Loader2, CheckCircle2 } from 'lucide-react';
import { getActiveApiKey, getActiveModel } from '../services/generationService';

export const PsychologyDecoderModal = ({ job, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [insights, setInsights] = useState(null);

  useEffect(() => {
    let isMounted = true;
    
    const decodePsychology = async () => {
      const apiKey = getActiveApiKey();
      if (!apiKey) {
        if (isMounted) {
          setError('OpenRouter API key is required to decrypt employer psychology. Please add it in Settings.');
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: getActiveModel() || "z-ai/glm-5.3-flash",
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `You are an expert corporate psychologist, executive recruiter, and behavioral analyst.
Your job is to read between the lines of a job description and decode the hidden psychology of the hiring manager.
Analyze the provided job ad and output a strictly valid JSON object with the following keys:
- "hiddenPriorities": A 2-sentence summary of what they ACTUALLY care about versus the boilerplate HR requirements.
- "managerProfile": A 2-sentence psychological profile of the likely hiring manager (their pressures, pain points, and management style).
- "edgeStrategy": An array of 3 specific, tactical things the candidate should emphasize to stand out and exploit these psychological insights.
- "cultureClues": An array of 2 subtle clues (red flags or green flags) hidden in their phrasing, and what they mean.`
              },
              {
                role: "user",
                content: `Decode this job ad for the position "${job.title}" at "${job.company}".\n\nJob Ad Text:\n${job.description || job.snippet}`
              }
            ]
          })
        });

        const raw = await response.json();
        
        if (!response.ok) {
          throw new Error(raw.error?.message || 'Failed to fetch insights from LLM');
        }

        const parsed = JSON.parse(raw.choices[0].message.content);
        if (isMounted) {
          setInsights(parsed);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error(err);
          setError(err.message || 'Failed to decode psychology.');
          setLoading(false);
        }
      }
    };

    decodePsychology();
    return () => { isMounted = false; };
  }, [job]);

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-purple-500/30 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col font-mono max-h-[90vh]" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-slate-950 p-4 border-b border-purple-900/50 flex items-center justify-between shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-indigo-900/20" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-2 bg-purple-500/20 border border-purple-500/40 rounded-xl">
              <Sparkles size={18} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-white font-black text-sm uppercase tracking-wider">Psychological Decoder</h2>
              <p className="text-purple-300/70 text-[10px] font-bold">DECRYPTING: {job.title} @ {job.company}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors relative z-10 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <Loader2 size={32} className="animate-spin text-purple-500" />
              <div className="text-sm font-bold text-white uppercase">Decoding Subtext...</div>
              <p className="text-xs text-slate-400">Analyzing phrasing, identifying pain points, and constructing psychological profile...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/50 flex items-start gap-3">
              <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="text-sm text-rose-200 font-bold">{error}</div>
            </div>
          ) : insights ? (
            <div className="space-y-4">
              {/* Hidden Priorities */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <h3 className="text-xs font-black text-emerald-400 uppercase flex items-center gap-2 mb-2">
                  <Target size={14} /> The Hidden Priorities
                </h3>
                <p className="text-xs text-slate-200 leading-relaxed">{insights.hiddenPriorities}</p>
              </div>

              {/* Manager Profile */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <h3 className="text-xs font-black text-indigo-400 uppercase flex items-center gap-2 mb-2">
                  <Briefcase size={14} /> Hiring Manager Profile
                </h3>
                <p className="text-xs text-slate-200 leading-relaxed">{insights.managerProfile}</p>
              </div>

              {/* Edge Strategy */}
              <div className="p-4 rounded-xl bg-purple-900/20 border border-purple-500/30">
                <h3 className="text-xs font-black text-purple-400 uppercase flex items-center gap-2 mb-3">
                  <Sparkles size={14} /> Your "Unfair Edge" Strategy
                </h3>
                <ul className="space-y-2">
                  {insights.edgeStrategy?.map((strat, i) => (
                    <li key={i} className="text-xs text-slate-200 leading-relaxed flex items-start gap-2">
                      <span className="text-purple-500 font-black mt-0.5">{i + 1}.</span> {strat}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Culture Clues */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <h3 className="text-xs font-black text-amber-400 uppercase flex items-center gap-2 mb-3">
                  <Eye size={14} /> Culture Clues & Subtext
                </h3>
                <ul className="space-y-2">
                  {insights.cultureClues?.map((clue, i) => (
                    <li key={i} className="text-xs text-slate-200 leading-relaxed flex items-start gap-2">
                      <div className="shrink-0 mt-0.5"><CheckCircle2 size={12} className="text-amber-500" /></div>
                      <div>{clue}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 shrink-0">
          <button onClick={onClose} className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase cursor-pointer transition-colors">
            Close Insights
          </button>
        </div>
      </div>
    </div>
  );
};
