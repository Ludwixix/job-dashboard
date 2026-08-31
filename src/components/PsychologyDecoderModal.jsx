import React, { useState, useEffect } from 'react';
import { 
  X, Sparkles, AlertCircle, Target, Briefcase, Eye, 
  Loader2, CheckCircle2, RefreshCw, Clock, Zap, ShieldCheck
} from 'lucide-react';
import { getActiveApiKey, getActiveModel } from '../services/generationService';
import { getActiveProfile } from '../services/profileService';

export const PsychologyDecoderModal = ({ job, onClose, onSaveInsights }) => {
  const [loading, setLoading] = useState(() => !job?.psychologyInsights);
  const [error, setError] = useState('');
  const [insights, setInsights] = useState(() => job?.psychologyInsights || null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const decodePsychology = async (forceFresh = false) => {
    if (!forceFresh && job?.psychologyInsights) {
      setInsights(job.psychologyInsights);
      setLoading(false);
      return;
    }

    const apiKey = getActiveApiKey();
    if (!apiKey) {
      setError('OpenRouter API key is required to decrypt employer psychology. Please configure it in Profile/Settings.');
      setLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (forceFresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const activeModel = getActiveModel() || 'z-ai/glm-5.3-flash';
      const candidateProfile = getActiveProfile() || {};

      // Compile comprehensive multi-source description and job dossier
      const descriptionSections = [
        job.description,
        job.notes && job.notes !== job.description ? `Detailed Notes / Brief:\n${job.notes}` : '',
        job.snippet && job.snippet !== job.description ? `Posting Snippet:\n${job.snippet}` : '',
        job.why ? `Strategic Context:\n${job.why}` : '',
        Array.isArray(job.requirements) && job.requirements.length > 0 ? `Requirements List:\n${job.requirements.join('\n')}` : '',
        Array.isArray(job.matchedSkills) && job.matchedSkills.length > 0 ? `Detected Key Skills: ${job.matchedSkills.join(', ')}` : '',
        Array.isArray(job.tags) && job.tags.length > 0 ? `Industry Taxonomy & Tags: ${job.tags.join(', ')}` : '',
        job.salary ? `Advertised Salary / Package: ${job.salary}` : '',
        job.location ? `Location / Workplace: ${job.location} (${job.remote ? '100% Remote' : 'On-Site / Hybrid'})` : '',
        job.source ? `Job Source: ${job.source}` : '',
        job.emailSubject ? `Original Alert / Email Subject: ${job.emailSubject}` : ''
      ].filter(Boolean);

      const fullJobText = descriptionSections.join('\n\n') || `${job.title} at ${job.company}`;

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://job-dashboard-6xrdvjlrcq-ts.a.run.app',
          'X-Title': 'Job Decoder Matrix - Psychology Engine'
        },
        body: JSON.stringify({
          model: activeModel,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are an elite executive talent psychologist, organizational diagnostician, and behavioral interview strategist.
Your mission is to perform a deep psychoanalytic breakdown of this full job advertisement to uncover the hiring manager's unstated operational pressures, organizational vulnerabilities, covert expectations, and what candidate posture will dominate the interview.

Candidate Context (for customizing the leverage edge):
- Candidate Archetype: ${candidateProfile.archetype || candidateProfile.headline || 'Senior Technical Leader'}
- Superpowers: ${(candidateProfile.superpowers || []).join('; ') || 'Autonomous problem solver, enterprise systems reliability'}
- Seniority: ${candidateProfile.seniority || 'Senior'}

Output a strictly valid JSON object matching this schema:
{
  "hiddenPriorities": "A 2-3 sentence deep diagnosis of what the hiring team ACTUALLY fears, desires, or needs behind the boilerplate requirements.",
  "managerProfile": "A 2-3 sentence psychological profile of the hiring manager (their operational stressors, management personality archetype, and what keeps them up at night).",
  "edgeStrategy": [
    "High-impact psychological positioning tactic 1 aligning candidate strengths to manager pain",
    "High-impact psychological positioning tactic 2",
    "High-impact psychological positioning tactic 3"
  ],
  "cultureClues": [
    "Covert cultural signal or unwritten team dynamic detected in the phrasing",
    "Underlying organizational reality (e.g. legacy refactoring debt, firefighting mode, high-growth chaos)"
  ]
}`
            },
            {
              role: 'user',
              content: `Analyze the complete job ad details, covert psychology, and hidden priorities for "${job.title}" at "${job.company}":

=== FULL JOB AD DOSSIER & SPECIFICATION ===
Role Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Australia'}
Work Arrangement: ${job.remote ? '100% Remote' : 'Hybrid / On-site'}
Salary / Package: ${job.salary || 'Market Rate'}
Source: ${job.source || 'Direct Portal / Job Board'}
${job.emailSubject ? `Email Subject: ${job.emailSubject}\n` : ''}

=== JOB DESCRIPTION & REQUIREMENTS ===
${fullJobText}`
            }
          ],
          temperature: 0.2
        })
      });

      const raw = await response.json();
      
      if (!response.ok) {
        throw new Error(raw.error?.message || `API error (${response.status})`);
      }

      const content = raw.choices?.[0]?.message?.content || '{}';
      const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      
      const payload = {
        ...parsed,
        decodedAt: new Date().toISOString(),
        model: activeModel
      };

      setInsights(payload);
      
      // Persist asynchronously against the job record
      if (onSaveInsights && job?.id) {
        onSaveInsights(job.id, payload);
      }
    } catch (err) {
      console.error('Psychology decoding error:', err);
      setError(err.message || 'Failed to decode employer psychology.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!job?.psychologyInsights) {
      decodePsychology(false);
    }
  }, [job?.id]);

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-slate-900 border border-teal-500/30 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col font-sans max-h-[90vh] text-slate-100" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between shrink-0 relative overflow-hidden font-mono">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-500" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-2.5 bg-teal-500/15 border border-teal-400/30 rounded-2xl">
              <Sparkles size={18} className="text-teal-400" />
            </div>
            <div>
              <h2 className="text-white font-black text-sm uppercase tracking-wider flex items-center gap-2">
                Employer Psychology Decoder
                {insights?.decodedAt && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800/80 font-normal">
                    RETAINED ON CARD
                  </span>
                )}
              </h2>
              <p className="text-slate-400 text-xs font-semibold truncate max-w-md">
                {job.title} • <span className="text-teal-300 font-bold">{job.company}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-slate-900/50">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-4 font-mono">
              <Loader2 size={36} className="animate-spin text-teal-400" />
              <div className="text-sm font-black text-white uppercase tracking-wider">Decoding Covert Subtext...</div>
              <p className="text-xs text-slate-400 text-center max-w-sm">
                Analyzing linguistic phrasing, identifying underlying stakeholder pressures, and architecting your unfair edge strategy...
              </p>
            </div>
          ) : error ? (
            <div className="p-5 rounded-2xl bg-rose-950/60 border border-rose-500/40 space-y-3 font-mono">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-200 font-bold leading-relaxed">{error}</div>
              </div>
              <button
                onClick={() => decodePsychology(true)}
                className="px-4 py-2 rounded-xl bg-rose-900 hover:bg-rose-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Retry Analysis
              </button>
            </div>
          ) : insights ? (
            <div className="space-y-4">
              {/* Retained Cache Banner */}
              {insights.decodedAt && (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-400">
                  <div className="flex items-center gap-1.5 text-teal-400">
                    <CheckCircle2 size={13} />
                    <span>Insights saved to job record</span>
                  </div>
                  <button
                    onClick={() => decodePsychology(true)}
                    disabled={isRefreshing}
                    className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer font-bold"
                  >
                    <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} />
                    <span>{isRefreshing ? 'Re-analyzing...' : 'Refresh Analysis'}</span>
                  </button>
                </div>
              )}

              {/* Hidden Priorities */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 shadow-sm">
                <h3 className="text-xs font-black text-teal-400 uppercase flex items-center gap-2 mb-2 font-mono">
                  <Target size={14} /> The Hidden Priorities
                </h3>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">{insights.hiddenPriorities}</p>
              </div>

              {/* Manager Profile */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 shadow-sm">
                <h3 className="text-xs font-black text-cyan-400 uppercase flex items-center gap-2 mb-2 font-mono">
                  <Briefcase size={14} /> Hiring Manager Psychological Profile
                </h3>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">{insights.managerProfile}</p>
              </div>

              {/* Edge Strategy */}
              <div className="p-4 rounded-2xl bg-teal-950/20 border border-teal-500/30 shadow-sm">
                <h3 className="text-xs font-black text-amber-300 uppercase flex items-center gap-2 mb-3 font-mono">
                  <Zap size={14} className="text-amber-400" /> Your "Unfair Edge" Candidate Strategy
                </h3>
                <ul className="space-y-2">
                  {insights.edgeStrategy?.map((strat, i) => (
                    <li key={i} className="text-xs text-slate-200 leading-relaxed flex items-start gap-2.5 font-sans">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black font-mono flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span>{strat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Culture Clues */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 shadow-sm">
                <h3 className="text-xs font-black text-indigo-300 uppercase flex items-center gap-2 mb-3 font-mono">
                  <Eye size={14} /> Phrasing Clues & Organizational Subtext
                </h3>
                <ul className="space-y-2">
                  {insights.cultureClues?.map((clue, i) => (
                    <li key={i} className="text-xs text-slate-200 leading-relaxed flex items-start gap-2 font-sans">
                      <div className="shrink-0 mt-0.5">
                        <CheckCircle2 size={13} className="text-teal-400" />
                      </div>
                      <div>{clue}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3 shrink-0 font-mono">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-teal-400" />
            <span>Persisted locally to job object</span>
          </div>
          <button 
            onClick={onClose} 
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
