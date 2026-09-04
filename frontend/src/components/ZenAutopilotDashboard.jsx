import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Bot, 
  CheckCircle2, 
  Clock, 
  Mail, 
  Briefcase, 
  FileText, 
  BrainCircuit, 
  ExternalLink, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Sliders, 
  Send, 
  Eye, 
  Copy, 
  Check, 
  TrendingUp,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { subscribeAutopilot, triggerAutonomousGmailScan } from '../services/autopilotAgent';
import { fetchDocumentFromBackend } from '../services/generationService';
import { fetchPsychologyFromBackend } from '../services/psychologyService';
import { saveUserApplicationToBackend } from '../services/trackerService';

export default function ZenAutopilotDashboard({
  jobs = [],
  profile = null,
  applications = [],
  onSwitchToStudio,
  onSwitchToMonolith,
  onOpenJobModal,
  onOpenBatchApply,
  onOpenProfileModal,
  onOpenMockInterview
}) {
  const [agentState, setAgentState] = useState({
    isRunning: true,
    activeTask: 'monitoring',
    activeJobTitle: '',
    stats: {
      screenedJobs: 0,
      resumesSynthesized: 0,
      coverLettersSynthesized: 0,
      psychProfilesBaked: 0,
      applicationsTallied: applications.length,
      recruiterUpdatesDetected: 0
    },
    activityLog: [],
    readyActionDeck: []
  });

  const [activeModal, setActiveModal] = useState(null); // { type: 'doc'|'psych', job: {...}, data: ... }
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [isScanningGmail, setIsScanningGmail] = useState(false);
  const [gmailNotification, setGmailNotification] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeAutopilot((newState) => {
      setAgentState(newState);
    });
    return () => unsubscribe();
  }, []);

  const handleCopyText = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleQuickPreviewDocs = async (job) => {
    const jobId = job.id || `${job.company}_${job.title}`;
    const doc = await fetchDocumentFromBackend(jobId, 'resume');
    const cover = await fetchDocumentFromBackend(jobId, 'cover_letter');
    setActiveModal({
      type: 'doc',
      job,
      resume: doc ? doc.content_text : 'Tailored resume is being generated in background...',
      coverLetter: cover ? cover.content_text : 'Bespoke cover letter is being generated in background...'
    });
  };

  const handleQuickPreviewPsych = async (job) => {
    const jobId = job.id || `${job.company}_${job.title}`;
    const psych = await fetchPsychologyFromBackend(jobId);
    setActiveModal({
      type: 'psych',
      job,
      insights: psych ? psych.insights : { companyCulture: 'Analyzing company psychology...' }
    });
  };

  const handleMarkApplied = async (job) => {
    const appData = {
      id: job.id || `${job.company}_${job.title}`,
      company: job.company,
      title: job.title,
      status: 'Applied',
      appliedDate: new Date().toISOString(),
      location: job.location,
      salary: job.salary
    };
    await saveUserApplicationToBackend(appData);
    setGmailNotification(`Marked ${job.company} as Applied! Saved to backend.`);
    setTimeout(() => setGmailNotification(null), 4000);
  };

  const handleTriggerGmailScan = async () => {
    const username = localStorage.getItem('gmail_scanner_user') || '';
    const appPassword = localStorage.getItem('gmail_scanner_pass') || '';
    if (!username || !appPassword) {
      setGmailNotification('To scan Gmail, please enter credentials in Studio Mode.');
      setTimeout(() => setGmailNotification(null), 4000);
      return;
    }

    setIsScanningGmail(true);
    try {
      const res = await triggerAutonomousGmailScan({ username, appPassword, days: 14 });
      if (res && res.updates_count > 0) {
        setGmailNotification(`⚡ Gmail Radar found ${res.updates_count} new recruiter update(s)!`);
      } else {
        setGmailNotification('Gmail Radar scan complete — no new recruiter emails.');
      }
    } catch (e) {
      setGmailNotification('Gmail Radar scan failed.');
    } finally {
      setIsScanningGmail(false);
      setTimeout(() => setGmailNotification(null), 5000);
    }
  };

  // Derive top priority actionable jobs
  const topActionJobs = (agentState.readyActionDeck && agentState.readyActionDeck.length > 0)
    ? agentState.readyActionDeck
    : jobs.slice(0, 6);

  // Derive active pipeline applications
  const activeApps = applications.filter(a => a.status !== 'Unsuccessful' && a.status !== 'Archived').slice(0, 6);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-teal-500/30 selection:text-teal-200">
      {/* Sleek Zen Top Navigation */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between transition-all">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-teal-500/20">
            <Sparkles className="w-4 h-4 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-wide text-slate-100">AUTOPILOT</h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Autonomous Active
              </span>
            </div>
            <p className="text-xs text-slate-400">Distraction-Free Executive Command Deck</p>
          </div>
        </div>

        {/* Global Controls & Studio Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleTriggerGmailScan}
            disabled={isScanningGmail}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/60 transition-colors shadow-sm disabled:opacity-50"
            title="Scan inbox for recruiter responses"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${isScanningGmail ? 'animate-spin' : ''}`} />
            <span>{isScanningGmail ? 'Scanning Radar...' : 'Gmail Radar'}</span>
          </button>

          {onOpenBatchApply && (
            <button
              onClick={onOpenBatchApply}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 transition-all shadow-sm hover:border-emerald-400/60 cursor-pointer"
              title="Open 1-Click Batch Auto-Apply Dispatcher"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Batch Apply</span>
            </button>
          )}

          {onSwitchToMonolith && (
            <button
              onClick={onSwitchToMonolith}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1612] hover:bg-[#251f18] text-[#d48b38] border border-[#b87326]/40 transition-all shadow-sm hover:border-[#b87326]/60 cursor-pointer tracking-wider"
              title="Switch to Dune Monolith Minimalist Mode"
            >
              <span>▲ Monolith</span>
            </button>
          )}

          <button
            onClick={onSwitchToStudio}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 transition-all shadow-sm hover:border-teal-400/50"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Open Studio</span>
          </button>
        </div>
      </header>

      {/* Main Distraction-Free Command Center */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Notification Toast */}
        <AnimatePresence>
          {gmailNotification && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 rounded-xl bg-teal-950/80 border border-teal-500/40 text-teal-200 text-xs font-medium flex items-center justify-between shadow-lg"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                <span>{gmailNotification}</span>
              </div>
              <button onClick={() => setGmailNotification(null)} className="text-teal-400 hover:text-teal-200 text-xs">✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Executive Prime Focus Banner */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-6 sm:p-8 shadow-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-400 uppercase tracking-wider">
              <Bot className="w-4 h-4" />
              <span>Today's Executive Focus</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Pre-Tailored Applications</span>
                  <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                </div>
                <div className="text-2xl font-bold text-slate-100">
                  {agentState.stats.resumesSynthesized || topActionJobs.length} <span className="text-xs font-normal text-emerald-400">Ready</span>
                </div>
                <p className="text-[11px] text-slate-400">Bespoke resumes and pitch letters prepared in background.</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Hiring Psychology Baked</span>
                  <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="text-2xl font-bold text-slate-100">
                  {agentState.stats.psychProfilesBaked || Math.min(topActionJobs.length, 5)} <span className="text-xs font-normal text-cyan-400">Decoded</span>
                </div>
                <p className="text-[11px] text-slate-400">Recruiter hot-buttons & interview angles extracted.</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Pipeline & Radar</span>
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-slate-100">
                  {applications.length} <span className="text-xs font-normal text-slate-400">Tracked</span>
                </div>
                <p className="text-[11px] text-slate-400">Auto-synced with SQLite backend & Gmail radar.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Priority Action Deck: High-Conviction Matches */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <span>⚡ High-Conviction Opportunities</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-950 text-teal-300 border border-teal-800/80">
                  Auto-Tailored
                </span>
              </h2>
              <p className="text-xs text-slate-400">Bespoke materials pre-generated. Review and dispatch with 1-click.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topActionJobs.map((job) => {
              const jobId = job.id || `${job.company}_${job.title}`;
              const score = Number(job.score ?? job.match_score ?? 85);
              const jobUrl = job.url || job.link || job.portalLink;

              return (
                <div
                  key={jobId}
                  onClick={() => onOpenJobModal && onOpenJobModal(job)}
                  className="group relative rounded-xl bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 p-5 transition-all shadow-md flex flex-col justify-between cursor-pointer"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {jobUrl ? (
                          <a
                            href={jobUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm font-bold text-slate-100 hover:text-teal-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                            title="Open original job ad in a new tab"
                          >
                            <span>{job.title}</span>
                            <ExternalLink className="w-3 h-3 text-slate-500 hover:text-teal-300" />
                          </a>
                        ) : (
                          <h3 className="text-sm font-semibold text-slate-100 group-hover:text-teal-300 transition-colors">
                            {job.title}
                          </h3>
                        )}

                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                          {jobUrl ? (
                            <a
                              href={jobUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-slate-300 hover:text-teal-300 hover:underline cursor-pointer"
                              title="Open original job ad in a new tab"
                            >
                              {job.company}
                            </a>
                          ) : (
                            <span>{job.company}</span>
                          )}
                          {' • '}
                          <span className="text-slate-500">{job.location || 'Melbourne, VIC'}</span>
                        </p>
                      </div>
                      <div className="px-2.5 py-1 rounded-lg bg-teal-950/80 text-teal-400 border border-teal-800/80 text-xs font-bold shrink-0">
                        {score}% Match
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-950 text-emerald-400 border border-slate-800">
                        <Sparkles className="w-3 h-3" /> Bespoke Resume Ready
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-950 text-cyan-400 border border-slate-800">
                        <BrainCircuit className="w-3 h-3" /> Psychology Baked
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {job.description ? job.description.replace(/<[^>]*>/g, '').slice(0, 140) + '...' : 'Tailored application synthesized for this position based on master engineering profile.'}
                    </p>
                  </div>

                  {/* 1-Click Action Toolbar */}
                  <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickPreviewDocs(job);
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5"
                        title="View pre-synthesized resume & cover letter"
                      >
                        <FileText className="w-3.5 h-3.5 text-teal-400" />
                        <span>Pitch Docs</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickPreviewPsych(job);
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5"
                        title="View hiring manager psychology & angles"
                      >
                        <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Psychology</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkApplied(job);
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/60 transition-colors flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Applied</span>
                      </button>

                      {jobUrl && (
                        <a
                          href={jobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors"
                          title="Open application posting"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Minimalist Active Application Radar */}
        {activeApps.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-400" />
              <span>Application Pipeline Radar</span>
            </h2>

            <div className="rounded-xl bg-slate-900/60 border border-slate-800 divide-y divide-slate-800/60">
              {activeApps.map((app) => (
                <div key={app.id || app.job_id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">{app.title}</h4>
                    <p className="text-[11px] text-slate-400">{app.company} • Applied {app.appliedDate || app.applied_at || 'Recently'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
                      {app.status || 'Applied'}
                    </span>
                    {onOpenMockInterview && (
                      <button
                        onClick={() => onOpenMockInterview(app)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-cyan-950 text-cyan-300 border border-cyan-800/60 hover:bg-cyan-900/80 transition-colors"
                      >
                        Simulate Interview
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Collapsible Background Agent Activity Log */}
        <section className="rounded-xl bg-slate-900/40 border border-slate-800/60 overflow-hidden">
          <button
            onClick={() => setIsActivityOpen(!isActivityOpen)}
            className="w-full px-5 py-3.5 flex items-center justify-between text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Bot className="w-3.5 h-3.5 text-teal-400" />
              <span>Autonomous AI Agent Activity Log ({agentState.activityLog.length} background events)</span>
            </div>
            {isActivityOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {isActivityOpen && (
            <div className="px-5 pb-4 pt-1 space-y-2 border-t border-slate-800/60 max-h-60 overflow-y-auto">
              {agentState.activityLog.map((log) => (
                <div key={log.id} className="text-[11px] flex items-start gap-2 text-slate-400">
                  <span className="text-slate-600 font-mono shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className="text-slate-300">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Quick View Modal (Docs / Psychology) */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    {activeModal.type === 'doc' ? '✨ Pre-Synthesized Tailored Application' : '🧠 Decoded Hiring Psychology'}
                  </h3>
                  <p className="text-xs text-slate-400">{activeModal.job?.title} at {activeModal.job?.company}</p>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>

              {activeModal.type === 'doc' ? (
                <div className="space-y-4 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-teal-400">Tailored Resume Bullets & Metric Proofs</span>
                      <button
                        onClick={() => handleCopyText(activeModal.resume, 'resume')}
                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                      >
                        {copiedKey === 'resume' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'resume' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {activeModal.resume}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-cyan-400">Bespoke Executive Cover Letter</span>
                      <button
                        onClick={() => handleCopyText(activeModal.coverLetter, 'cover')}
                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                      >
                        {copiedKey === 'cover' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'cover' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {activeModal.coverLetter}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="font-semibold text-cyan-400">Company & Engineering Culture</span>
                    <p className="text-slate-300">{activeModal.insights?.companyCulture || activeModal.insights?.culture || 'High-trust engineering environment valuing automation and reliability.'}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="font-semibold text-teal-400">Key Priorities & Pain Points</span>
                    <p className="text-slate-300">{activeModal.insights?.painPoints || 'Looking for senior infrastructure expertise to reduce repeat incidents and scale automation.'}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="font-semibold text-emerald-400">Suggested Winning Interview Angles</span>
                    <p className="text-slate-300">{activeModal.insights?.interviewQuestions ? JSON.stringify(activeModal.insights.interviewQuestions, null, 2) : 'Highlight proven 660k+ user scale, 99.9% uptime SLA management, and PowerShell automation metric achievements.'}</p>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
