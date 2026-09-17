/**
 * InterviewCheatSheetModal.jsx
 * Interactive In-App Command Center & Export Hub for the Master Interview Cheat Sheet.
 * Allows candidates to preview the 3-column cockpit, adjust meeting parameters in real-time,
 * generate dynamic bespoke AI cheat sheets on-demand, launch the live page in a dedicated
 * browser tab for dual-screen setups, or download as standalone HTML.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, ExternalLink, Download, Copy, Check, Sparkles, 
  Video, Clock, Users, RefreshCw, Eye, Edit3, Loader2,
  Calendar, CalendarPlus
} from 'lucide-react';
import { 
  extractInterviewMeetingInfo, 
  generateInterviewCheatSheetHtml, 
  generateBespokeCheatSheet,
  openCheatSheetInNewTab, 
  downloadCheatSheetHtml 
} from '../services/interviewCheatSheetService';
import {
  generateGoogleCalendarUrl,
  downloadIcsFile,
  formatCalendarBriefing
} from '../services/calendarService';
import { getJobIntelligence } from '../services/jobIntelligenceService';
import { getActiveProfile } from '../services/profileService';
import { getLlmConfig } from '../services/llmConfig';
import { estimateActionCost } from '../services/llmCostService';
import { useToast } from './ToastContext';

export default function InterviewCheatSheetModal({
  isOpen,
  onClose,
  job,
  userProfile,
  onUpdateJob,
}) {
  const toastContext = useToast();
  const addToast = toastContext?.addToast;

  const [meetingUrl, setMeetingUrl] = useState('');
  const [meetingId, setMeetingId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [panelString, setPanelString] = useState('');
  const [activeTab, setActiveTab] = useState('preview');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [bespokeData, setBespokeData] = useState(null);

  useEffect(() => {
    if (job) {
      const extracted = extractInterviewMeetingInfo(job);
      setMeetingUrl(extracted.meetingUrl || '');
      setMeetingId(extracted.meetingId || '');
      setPasscode(extracted.passcode || '');
      setScheduledTime(extracted.scheduledTime || '');
      setPanelString(
        (extracted.panelMembers || [])
          .map(p => (typeof p === 'string' ? p : p.name))
          .filter(Boolean)
          .join(', ')
      );
      const existing = 
        job.masterCheatSheet || 
        job.intelligence?.master_cheat_sheet || 
        getJobIntelligence(job, 'master_cheat_sheet') || 
        null;
      setBespokeData(existing);
      setGenerationError(null);
    }
  }, [job]);

  const llmConfig = useMemo(() => getLlmConfig(), []);
  const costEstimate = useMemo(() => {
    return estimateActionCost(llmConfig?.model, 'Prompt estimating tokens for bespoke cockpit...', 2500);
  }, [llmConfig]);

  const generatedHtml = useMemo(() => {
    if (!job) return '';
    const parsedPanel = panelString
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(name => ({ name }));

    return generateInterviewCheatSheetHtml(job, {
      meetingUrl,
      meetingId,
      passcode,
      scheduledTime,
      panelMembers: parsedPanel.length > 0 ? parsedPanel : undefined,
      bespokeData,
      candidateProfile: userProfile || getActiveProfile(),
    });
  }, [job, meetingUrl, meetingId, passcode, scheduledTime, panelString, bespokeData, userProfile]);

  const calendarBriefing = useMemo(() => {
    if (!job) return '';
    return formatCalendarBriefing(job, {
      interviewType: 'Master Interview Cockpit',
      candidateName: userProfile?.name || getActiveProfile()?.name,
      panelMembers: panelString ? panelString.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      scheduledTime,
      meetingUrl,
      meetingId,
      passcode,
      notes: bespokeData?.tactical_notes || job?.notes || '',
    });
  }, [job, userProfile, panelString, scheduledTime, meetingUrl, meetingId, passcode, bespokeData]);

  const googleCalendarUrl = useMemo(() => {
    if (!job) return '#';
    return generateGoogleCalendarUrl({
      title: `Interview: ${job.company || 'Target Company'} · ${job.title || 'Role'}`,
      description: calendarBriefing,
      location: meetingUrl || 'Video Conference',
    });
  }, [job, calendarBriefing, meetingUrl]);

  const handleDownloadIcs = () => {
    if (!job) return;
    downloadIcsFile({
      title: `Interview: ${job.company || 'Target Company'} · ${job.title || 'Role'}`,
      description: calendarBriefing,
      location: meetingUrl || 'Video Conference',
    }, `${(job.company || 'Interview').toLowerCase().replace(/[^a-z0-9]/g, '_')}_interview.ics`);
    if (addToast) {
      addToast('📅 .ics calendar invite downloaded!', 'success');
    }
  };

  const handleGenerateBespoke = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const artifact = await generateBespokeCheatSheet(job, userProfile, onUpdateJob);
      setBespokeData(artifact);
      if (addToast) {
        addToast('⚡ Bespoke AI Cockpit generated and saved to your job card!', 'success');
      }
    } catch (err) {
      console.error('Failed to generate bespoke cheat sheet:', err);
      setGenerationError(err.message || 'Generation failed');
      if (addToast) {
        addToast(`❌ Generation failed: ${err.message || 'Unknown error'}`, 'error');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLaunchNewTab = () => {
    const win = openCheatSheetInNewTab(
      generatedHtml, 
      `${job?.company || ''} ${job?.title || ''} - Interview Cockpit`
    );
    if (win && addToast) {
      addToast('🚀 Master Cockpit opened in a dedicated tab!', 'success');
    }
  };

  const handleDownload = () => {
    downloadCheatSheetHtml(job, generatedHtml);
    if (addToast) {
      addToast('💾 Downloaded standalone HTML cheat sheet!', 'success');
    }
  };

  const handleCopyHtml = async () => {
    try {
      await navigator.clipboard.writeText(generatedHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (addToast) {
        addToast('📋 HTML copied to clipboard!', 'success');
      }
    } catch (err) {
      console.error('Failed to copy HTML:', err);
    }
  };

  if (!isOpen || !job) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-6xl h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-sm overflow-hidden font-sans text-slate-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cheat-sheet-title"
      >
        {/* HEADER BAR */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-sm flex items-center justify-center ${
              bespokeData 
                ? 'bg-purple-500/20 border border-purple-500/40 text-purple-400' 
                : 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
            }`}>
              <Sparkles size={20} />
            </div>
            <div>
              <h2 id="cheat-sheet-title" className="text-base font-bold text-white flex items-center gap-2">
                Interview Master Command Center
                {bespokeData ? (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-sm bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Bespoke AI Cockpit
                  </span>
                ) : (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-sm bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Gold Benchmark
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                {job.title} <span className="text-slate-600">•</span> <strong className="text-slate-200">{job.company}</strong>
              </p>
            </div>
          </div>

          {/* QUICK ACTION BUTTONS */}
          <div className="flex items-center gap-2">
            <a
              href={googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-sm bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Add interview to Google Calendar with pre-briefing notes"
            >
              <CalendarPlus size={14} />
              <span className="hidden sm:inline">Add to Cal</span>
            </a>

            <button
              type="button"
              onClick={handleDownloadIcs}
              className="px-3 py-2 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Download universal .ics calendar event"
            >
              <Calendar size={14} />
              <span className="hidden sm:inline">.ics</span>
            </button>

            <button
              onClick={handleLaunchNewTab}
              className="px-3.5 py-2 rounded-sm bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-amber-950/50 cursor-pointer active:scale-95"
              title="Launch standalone HTML in a new browser window/tab"
            >
              <ExternalLink size={14} />
              <span>Launch Fullscreen Cockpit</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-3 py-2 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Download standalone .html file"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Download HTML</span>
            </button>

            <button
              onClick={handleCopyHtml}
              className="px-3 py-2 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Copy HTML to clipboard"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer ml-2"
              aria-label="Close modal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* BESPOKE AI GENERATION BANNER */}
        {!bespokeData ? (
          <div className="px-6 py-2.5 bg-gradient-to-r from-amber-950/50 via-slate-900 to-indigo-950/50 border-b border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400 shrink-0" />
              <div>
                <span className="font-semibold text-slate-200">Template Preview Active (Generic Benchmark):</span>
                <span className="text-slate-400 ml-1">Generate a bespoke cockpit tailored directly to this job's requirements and your profile.</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-[11px] font-mono text-slate-400">
                Model: <span className="text-amber-300 font-semibold">{llmConfig?.model || 'Active LLM'}</span>
                <span className="mx-1.5">•</span>
                Est: <span className="text-emerald-400 font-semibold">{costEstimate?.formattedCost || '$0.00'}</span>
              </div>
              <button
                onClick={handleGenerateBespoke}
                disabled={isGenerating}
                className="px-3.5 py-1.5 rounded-sm bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-900/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Generating Bespoke Cockpit...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>⚡ Generate Bespoke Cockpit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-2 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border-b border-purple-500/30 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-2">
              <Check size={16} className="text-purple-400 shrink-0" />
              <div>
                <span className="font-semibold text-purple-200">✓ Bespoke AI Cockpit Active:</span>
                <span className="text-slate-400 ml-1">Tailored for {job.company} with custom traps, target metrics, STAR stories, and bespoke Q&amp;A cards.</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-[11px] font-mono text-slate-400">
                Model: <span className="text-purple-300 font-semibold">{llmConfig?.model || 'Active LLM'}</span>
                <span className="mx-1.5">•</span>
                Est: <span className="text-emerald-400 font-semibold">{costEstimate?.formattedCost || '$0.00'}</span>
              </div>
              <button
                onClick={handleGenerateBespoke}
                disabled={isGenerating}
                className="px-3 py-1 rounded-sm bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/40 font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title="Regenerate bespoke data with active LLM"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Regenerating...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={13} />
                    <span>Regenerate Bespoke</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {generationError && (
          <div className="px-6 py-1.5 bg-red-950/60 border-b border-red-500/40 text-xs text-red-300 flex items-center justify-between shrink-0">
            <span>⚠️ {generationError}</span>
            <button 
              onClick={() => setGenerationError(null)} 
              className="text-red-400 hover:text-red-200 text-xs font-bold underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* SUB-NAVIGATION TABS */}
        <div className="flex items-center gap-2 px-6 py-2 border-b border-slate-800 bg-slate-900/50 shrink-0">
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 rounded-sm text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'preview'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye size={14} />
            <span>Live Interactive Preview</span>
          </button>

          <button
            onClick={() => setActiveTab('tune')}
            className={`px-3 py-1.5 rounded-sm text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'tune'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Edit3 size={14} />
            <span>Meeting &amp; Panel Details</span>
          </button>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'preview' && (
            <div className="w-full h-full bg-slate-950 flex flex-col">
              <div className="px-4 py-1.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm bg-emerald-400 animate-pulse"></span>
                  <span>Live Sandbox: Interactive 90s Timer, LocalStorage Scratchpads &amp; ADHD Focus View Active</span>
                </div>
                <button
                  onClick={handleLaunchNewTab}
                  className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 underline cursor-pointer"
                >
                  Pop Out to New Tab &rarr;
                </button>
              </div>
              <iframe
                title="Interview Master Command Center Live Preview"
                srcDoc={generatedHtml}
                className="w-full flex-1 border-none bg-white"
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
            </div>
          )}

          {activeTab === 'tune' && (
            <div className="w-full h-full overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto">
              <div className="p-4 rounded-sm bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 leading-relaxed">
                💡 <strong>Smart Communication Sync:</strong> The fields below were automatically extracted from your received emails and notes. You can tweak or add missing conference details here, and your Master Cheat Sheet will instantly update!
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Meeting URL */}
                <div className="space-y-1.5 md:col-span-2">
                  <label htmlFor="input-meeting-url" className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Video size={14} className="text-amber-400" />
                    Video Call / Meeting URL (Teams, Zoom, Google Meet)
                  </label>
                  <input
                    id="input-meeting-url"
                    type="url"
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    placeholder="https://teams.microsoft.com/meet/... or https://zoom.us/j/..."
                    className="w-full px-3.5 py-2.5 rounded-sm bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-500 font-mono"
                  />
                </div>

                {/* Meeting ID */}
                <div className="space-y-1.5">
                  <label htmlFor="input-meeting-id" className="text-xs font-bold text-slate-300">
                    Meeting ID / Number
                  </label>
                  <input
                    id="input-meeting-id"
                    type="text"
                    value={meetingId}
                    onChange={(e) => setMeetingId(e.target.value)}
                    placeholder="e.g. 269 079 741 559 951"
                    className="w-full px-3.5 py-2.5 rounded-sm bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-500 font-mono"
                  />
                </div>

                {/* Passcode */}
                <div className="space-y-1.5">
                  <label htmlFor="input-passcode" className="text-xs font-bold text-slate-300">
                    Passcode / PIN
                  </label>
                  <input
                    id="input-passcode"
                    type="text"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="e.g. ZB69tr3u"
                    className="w-full px-3.5 py-2.5 rounded-sm bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-500 font-mono"
                  />
                </div>

                {/* Scheduled Time */}
                <div className="space-y-1.5">
                  <label htmlFor="input-scheduled-time" className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Clock size={14} className="text-amber-400" />
                    Scheduled Time
                  </label>
                  <input
                    id="input-scheduled-time"
                    type="text"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    placeholder="e.g. 7:30 AM AEST"
                    className="w-full px-3.5 py-2.5 rounded-sm bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-500 font-mono"
                  />
                </div>

                {/* Panel Members */}
                <div className="space-y-1.5">
                  <label htmlFor="input-panel" className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Users size={14} className="text-purple-400" />
                    Interview Panel Attendees (comma-separated)
                  </label>
                  <input
                    id="input-panel"
                    type="text"
                    value={panelString}
                    onChange={(e) => setPanelString(e.target.value)}
                    placeholder="e.g. Mace Tennison, Lisle Weber, Andrew Sidebottom"
                    className="w-full px-3.5 py-2.5 rounded-sm bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <a
                    href={googleCalendarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-sm bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <CalendarPlus size={14} />
                    <span>Sync to Google Calendar</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleDownloadIcs}
                    className="px-3.5 py-2 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Calendar size={14} />
                    <span>Download .ics</span>
                  </button>
                </div>
                <button
                  onClick={() => setActiveTab('preview')}
                  className="px-4 py-2 rounded-sm bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Eye size={14} />
                  <span>Update &amp; View Live Preview</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
