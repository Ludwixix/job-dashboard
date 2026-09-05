import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Sparkles, Target, Briefcase, Eye, Loader2, CheckCircle2, 
  RefreshCw, Zap, ShieldCheck, Trophy, MessageSquare, Copy, 
  HelpCircle, Bot, User, Send, Check
} from 'lucide-react';
import { getActiveApiKey, getActiveModel, generateInterviewGuide } from '../services/generationService';
import { getLlmConfig, PROVIDERS } from '../services/llmConfig';
import { getActiveProfile } from '../services/profileService';
import { saveUserApplication } from '../services/dataService';
import { 
  getCachedPsychology, setCachedPsychology, 
  getPendingPsychologyPromise, setPendingPsychologyPromise 
} from '../services/psychologyService';

export const InterviewSuiteModal = ({ 
  job, 
  onClose, 
  initialTab = 'psychology', 
  onSaveInsights 
}) => {
  const [activeTab, setActiveTab] = useState(initialTab); // 'psychology' | 'prep' | 'simulator'

  // ==========================================
  // TAB 1: PSYCHOLOGY DECODER STATE
  // ==========================================
  const cachedPsych = getCachedPsychology(job);
  const [psychLoading, setPsychLoading] = useState(() => !cachedPsych);
  const [psychError, setPsychError] = useState('');
  const [psychInsights, setPsychInsights] = useState(() => cachedPsych || null);
  const [isRefreshingPsych, setIsRefreshingPsych] = useState(false);

  const decodePsychology = async (forceFresh = false) => {
    const existing = getCachedPsychology(job);
    if (!forceFresh && existing) {
      setPsychInsights(existing);
      setPsychLoading(false);
      return;
    }

    const inFlight = getPendingPsychologyPromise(job);
    if (inFlight && !forceFresh) {
      setPsychLoading(true);
      try {
        const result = await inFlight;
        setPsychInsights(result);
      } catch (err) {
        setPsychError(err.message || 'Failed to decode employer psychology.');
      } finally {
        setPsychLoading(false);
      }
      return;
    }

    const llmConfig = getLlmConfig();
    const apiKey = llmConfig.apiKey;
    const providerMeta = llmConfig.providerMeta || PROVIDERS[llmConfig.provider] || PROVIDERS.openrouter;
    if (!apiKey && providerMeta.requiresKey) {
      setPsychError(`${providerMeta.name} API key is required to decrypt employer psychology. Please configure it in Settings.`);
      setPsychLoading(false);
      setIsRefreshingPsych(false);
      return;
    }

    if (forceFresh) {
      setIsRefreshingPsych(true);
    } else {
      setPsychLoading(true);
    }
    setPsychError('');

    const fetchPromise = (async () => {
      const activeModel = llmConfig.model || providerMeta.defaultModel;
      const candidateProfile = getActiveProfile() || {};

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

      const systemPrompt = `You are an elite executive talent psychologist, organizational diagnostician, and behavioral interview strategist.
Your mission is to perform a deep psychoanalytic breakdown of this full job advertisement to uncover the hiring manager's unstated operational pressures, organizational vulnerabilities, covert expectations, and what candidate posture will dominate the interview.

- Candidate Archetype: ${candidateProfile.marketArchetype || candidateProfile.headline || candidateProfile.title || 'Senior Professional Specialist'}
- Superpowers: ${(candidateProfile.keyStrengths || []).join('; ') || (candidateProfile.coreSkills || []).slice(0, 5).join('; ') || 'Domain leadership, structured methodology, high reliability'}
- Seniority: ${candidateProfile.seniorityLevel || 'Senior'}
- Industry Domain: ${candidateProfile.industry || 'Professional Services'}

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
}`;

      const userContent = `Analyze the complete job ad details, covert psychology, and hidden priorities for "${job.title}" at "${job.company}":

=== FULL JOB AD DOSSIER & SPECIFICATION ===
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Melbourne, VIC'}
Work Arrangement: ${job.remote ? '100% Remote' : 'Hybrid / On-site'}
Salary / Package: ${job.salary || 'Market Rate'}
Source: ${job.source || 'Direct Portal / Job Board'}
${job.emailSubject ? `Email Subject: ${job.emailSubject}\n` : ''}

=== JOB DESCRIPTION & REQUIREMENTS ===
${fullJobText}`;

      let response;
      if (llmConfig.provider === 'anthropic') {
        response = await fetch(llmConfig.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey.trim(),
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: activeModel,
            system: systemPrompt,
            messages: [{ role: 'user', content: userContent }],
            max_tokens: 3000,
            temperature: 0.2
          })
        });
      } else {
        const headers = {
          'Content-Type': 'application/json'
        };
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey.trim()}`;
        }
        if (llmConfig.provider === 'openrouter') {
          headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'https://job-dashboard.app';
          headers['X-Title'] = 'Job Decoder Matrix - Psychology Engine';
        }

        response = await fetch(llmConfig.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: activeModel,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userContent }
            ],
            temperature: 0.2
          })
        });
      }

      const raw = await response.json();
      if (!response.ok) {
        throw new Error(raw.error?.message || `API error (${response.status})`);
      }

      const content = raw.choices?.[0]?.message?.content || raw.content?.[0]?.text || '{}';
      const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      
      const payload = {
        ...parsed,
        decodedAt: new Date().toISOString(),
        model: activeModel
      };

      setPsychInsights(payload);
      const targetId = job?.id || `${job?.company}_${job?.title}`;

      setCachedPsychology(job, payload);
      saveUserApplication({
        ...job,
        id: targetId,
        psychologyInsights: payload,
        psychology_insights: payload
      });

      if (onSaveInsights) {
        onSaveInsights(targetId, payload);
      }

      return payload;
    })();

    setPendingPsychologyPromise(job, fetchPromise);

    try {
      await fetchPromise;
    } catch (err) {
      console.error('Psychology decoding error:', err);
      setPsychError(err.message || 'Failed to decode employer psychology.');
    } finally {
      setPsychLoading(false);
      setIsRefreshingPsych(false);
    }
  };

  useEffect(() => {
    const existing = getCachedPsychology(job);
    if (!existing) {
      decodePsychology(false);
    } else {
      setPsychInsights(existing);
      setPsychLoading(false);
    }
  }, [job?.id]);

  // ==========================================
  // TAB 2: INTERVIEW PREP GUIDE STATE
  // ==========================================
  const [guide, setGuide] = useState(null);
  const [guideLoading, setGuideLoading] = useState(false);
  const [copiedSection, setCopiedSection] = useState('');

  useEffect(() => {
    if (activeTab === 'prep' && !guide && !guideLoading) {
      setGuideLoading(true);
      generateInterviewGuide(job)
        .then(res => {
          setGuide(res);
          setGuideLoading(false);
        })
        .catch(err => {
          setGuideLoading(false);
          console.error("Failed to generate guide:", err);
        });
    }
  }, [activeTab, job, guide, guideLoading]);

  const handleCopy = (text, sectionName) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionName);
    setTimeout(() => setCopiedSection(''), 2500);
  };

  // ==========================================
  // TAB 3: MOCK INTERVIEW SIMULATOR STATE
  // ==========================================
  const [mockSession, setMockSession] = useState(null);
  const [mockLoading, setMockLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [mockFeedback, setMockFeedback] = useState(null);
  const endOfMessagesRef = useRef(null);

  const initMockSession = async () => {
    setMockLoading(true);
    try {
      const res = await fetch('/api/ai/interview/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_description: job.description || job.notes || '',
          role: job.title,
          question_count: 5
        })
      });
      const data = await res.json();
      setMockSession(data);
      if (data.questions && data.questions.length > 0) {
        setMessages([{ role: 'interviewer', text: data.questions[0].text, id: data.questions[0].id }]);
      }
    } catch (err) {
      console.error("Failed to start mock interview", err);
      setMessages([{ role: 'interviewer', text: 'Connection to AI Interview service failed. Please ensure backend is running.' }]);
    } finally {
      setMockLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'simulator' && !mockSession && !mockLoading) {
      initMockSession();
    }
  }, [activeTab, mockSession, mockLoading]);

  useEffect(() => {
    if (activeTab === 'simulator') {
      endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const handleSendMockAnswer = async () => {
    if (!inputValue.trim() || submittingAnswer || !mockSession) return;
    
    const userAns = inputValue.trim();
    const currentQIndex = messages.filter(m => m.role === 'interviewer').length - 1;
    const currentQ = mockSession.questions[currentQIndex];
    
    setMessages(prev => [...prev, { role: 'candidate', text: userAns }]);
    setInputValue('');
    setSubmittingAnswer(true);
    
    try {
      const res = await fetch(`/api/ai/interview/${mockSession.session_id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: currentQ.id,
          answer: userAns
        })
      });
      const data = await res.json();
      
      if (data.all_answered) {
        const fbRes = await fetch(`/api/ai/interview/${mockSession.session_id}/feedback`);
        const fbData = await fbRes.json();
        setMockFeedback(fbData);
      } else {
        const nextQ = mockSession.questions[currentQIndex + 1];
        setTimeout(() => {
          setMessages(prev => [...prev, { role: 'interviewer', text: nextQ.text, id: nextQ.id }]);
          setSubmittingAnswer(false);
        }, 600);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'interviewer', text: 'Error: Could not reach the AI agent. Please check your connection.' }]);
      setSubmittingAnswer(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-700/70 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col font-sans max-h-[92vh] text-slate-100" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between shrink-0 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-indigo-500 to-amber-500" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/15 border border-indigo-400/30 rounded-2xl">
              <Sparkles size={18} className="text-indigo-400" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono">
                INTERVIEW INTELLIGENCE SUITE
              </div>
              <h2 className="text-white font-black text-sm sm:text-base leading-tight">
                {job.title} • <span className="text-indigo-300 font-bold">{job.company}</span>
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-950/90 border-b border-slate-800 px-5 flex items-center gap-2 shrink-0 font-mono text-xs">
          <button
            onClick={() => setActiveTab('psychology')}
            className={`py-3 px-4 font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'psychology'
                ? 'border-teal-400 text-teal-400 bg-teal-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Target size={14} /> Employer Psychology Decoder
          </button>
          <button
            onClick={() => setActiveTab('prep')}
            className={`py-3 px-4 font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'prep'
                ? 'border-indigo-400 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Trophy size={14} /> STAR Guide &amp; Prep
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`py-3 px-4 font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'simulator'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare size={14} /> Live AI Simulator
          </button>
        </div>

        {/* Dynamic Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-900/50">
          
          {/* TAB 1: PSYCHOLOGY */}
          {activeTab === 'psychology' && (
            <div className="space-y-4">
              {psychLoading ? (
                <div className="py-16 flex flex-col items-center justify-center space-y-4 font-mono">
                  <Loader2 size={36} className="animate-spin text-teal-400" />
                  <div className="text-sm font-black text-white uppercase tracking-wider">DECODING COVERT SUBTEXT...</div>
                  <p className="text-xs text-slate-400 text-center max-w-sm">
                    Analyzing linguistic phrasing, identifying underlying stakeholder pressures, and architecting your unfair edge strategy...
                  </p>
                </div>
              ) : psychError ? (
                <div className="p-5 rounded-2xl bg-rose-950/60 border border-rose-500/40 space-y-3 font-mono">
                  <div className="text-xs text-rose-200 font-bold leading-relaxed">{psychError}</div>
                  <button
                    onClick={() => decodePsychology(true)}
                    className="px-4 py-2 rounded-xl bg-rose-900 hover:bg-rose-800 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Retry Analysis
                  </button>
                </div>
              ) : psychInsights ? (
                <div className="space-y-4">
                  {psychInsights.decodedAt && (
                    <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-400">
                      <div className="flex items-center gap-1.5 text-teal-400">
                        <CheckCircle2 size={13} />
                        <span>RETAINED ON CARD — Insights saved to job record</span>
                      </div>
                      <button
                        onClick={() => decodePsychology(true)}
                        disabled={isRefreshingPsych}
                        className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer font-bold"
                      >
                        <RefreshCw size={11} className={isRefreshingPsych ? 'animate-spin' : ''} />
                        <span>{isRefreshingPsych ? 'Re-analyzing...' : 'Refresh Analysis'}</span>
                      </button>
                    </div>
                  )}

                  {/* Hidden Priorities */}
                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 shadow-sm">
                    <h3 className="text-xs font-black text-teal-400 uppercase flex items-center gap-2 mb-2 font-mono">
                      <Target size={14} /> The Hidden Priorities
                    </h3>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans">{psychInsights.hiddenPriorities}</p>
                  </div>

                  {/* Manager Profile */}
                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 shadow-sm">
                    <h3 className="text-xs font-black text-cyan-400 uppercase flex items-center gap-2 mb-2 font-mono">
                      <Briefcase size={14} /> Hiring Manager Psychological Profile
                    </h3>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans">{psychInsights.managerProfile}</p>
                  </div>

                  {/* Edge Strategy */}
                  <div className="p-4 rounded-2xl bg-teal-950/20 border border-teal-500/30 shadow-sm">
                    <h3 className="text-xs font-black text-amber-300 uppercase flex items-center gap-2 mb-3 font-mono">
                      <Zap size={14} className="text-amber-400" /> Your "Unfair Edge" Candidate Strategy
                    </h3>
                    <ul className="space-y-2">
                      {psychInsights.edgeStrategy?.map((strat, i) => (
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
                      <Eye size={14} /> Phrasing Clues &amp; Organizational Subtext
                    </h3>
                    <ul className="space-y-2">
                      {psychInsights.cultureClues?.map((clue, i) => (
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
          )}

          {/* TAB 2: STAR PREP & GUIDE */}
          {activeTab === 'prep' && (
            <div className="space-y-6">
              {guideLoading ? (
                <div className="p-12 text-center space-y-3 font-mono">
                  <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <div className="text-xs text-slate-400 font-medium">Synthesizing STAR responses from candidate career metrics...</div>
                </div>
              ) : guide ? (
                <>
                  {/* Talking Points */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                        <Trophy size={14} className="text-emerald-400" /> High-Impact Proof Points (Anchor Statements)
                      </div>
                      <button
                        onClick={() => handleCopy(guide.talkingPoints.join('\n• '), 'talkingPoints')}
                        className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer font-mono"
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
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                      <MessageSquare size={14} className="text-indigo-400" /> Tailored Behavioral &amp; Technical Questions
                    </div>
                    <div className="space-y-3">
                      {guide.questions.map((q, idx) => (
                        <div key={idx} className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700/40 text-indigo-300 uppercase font-mono">
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

                  {/* Reverse Questions */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                      <HelpCircle size={14} className="text-amber-400" /> Strategic Questions to Ask the Hiring Manager
                    </div>
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                      {guide.recommendedQuestionsToAsk.map((rq, idx) => (
                        <div key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                          <span className="text-amber-400 font-bold font-mono">{idx + 1}.</span>
                          <span>{rq}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* TAB 3: LIVE SIMULATOR */}
          {activeTab === 'simulator' && (
            <div className="space-y-4">
              {mockLoading ? (
                <div className="flex justify-center items-center py-16">
                  <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <>
                  {mockSession?.stream && (
                    <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-400">
                      <span className="flex items-center gap-1.5 text-amber-400 font-bold uppercase">
                        <Zap size={13} /> {mockSession.stream} SIMULATION TRACK
                      </span>
                      <span className="text-slate-400 font-medium">Question {messages.filter(m => m.role === 'interviewer').length} of {mockSession.total_questions || 5}</span>
                    </div>
                  )}

                  <div className="space-y-3 min-h-[220px]">
                    {messages.map((m, idx) => (
                      <div key={idx} className={`flex gap-3 ${m.role === 'candidate' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'candidate' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                          {m.role === 'candidate' ? <User size={16} /> : <Bot size={16} />}
                        </div>
                        <div className={`p-3 rounded-2xl text-xs sm:text-sm max-w-[80%] ${m.role === 'candidate' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-50' : 'bg-slate-800 border border-slate-700 text-slate-200'}`}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                    
                    {mockFeedback && (
                      <div className="mt-6 p-5 bg-slate-800/50 border border-indigo-500/30 rounded-2xl space-y-3">
                        <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                          <Trophy className="text-amber-400" size={18} /> Evaluation Score: {mockFeedback.score}/100
                        </h3>
                        <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {mockFeedback.feedback}
                        </div>
                      </div>
                    )}
                    <div ref={endOfMessagesRef} />
                  </div>

                  {!mockFeedback && (
                    <div className="pt-3 border-t border-slate-800">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={inputValue}
                          onChange={e => setInputValue(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSendMockAnswer()}
                          disabled={submittingAnswer || mockLoading}
                          placeholder="Type your answer to the interviewer..."
                          className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                        />
                        <button 
                          onClick={handleSendMockAnswer}
                          disabled={!inputValue.trim() || submittingAnswer || mockLoading}
                          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center cursor-pointer"
                        >
                          {submittingAnswer ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={16} />}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3 shrink-0 font-mono">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-teal-400" />
            <span>Persisted against active job application</span>
          </div>
          <button 
            onClick={onClose} 
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
