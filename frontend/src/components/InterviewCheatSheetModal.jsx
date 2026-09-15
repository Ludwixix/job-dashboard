/**
 * InterviewCheatSheetModal.jsx
 * Interactive In-App Command Center & Export Hub for the Master Interview Cheat Sheet.
 * Allows candidates to preview the 3-column cockpit, adjust meeting parameters in real-time,
 * launch the live page in a dedicated browser tab for dual-screen setups, or download as standalone HTML.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
 X, ExternalLink, Download, Copy, Check, Sparkles, 
 Video, Clock, Users, ShieldAlert, Target, RefreshCw, Eye, Edit3
} from 'lucide-react';
import { 
 extractInterviewMeetingInfo, 
 generateInterviewCheatSheetHtml, 
 openCheatSheetInNewTab, 
 downloadCheatSheetHtml 
} from '../services/interviewCheatSheetService';
import { getActiveProfile } from '../services/profileService';
import { useToast } from './ToastContext';

export default function InterviewCheatSheetModal({
 isOpen,
 onClose,
 job,
 userProfile,
}) {
 const { addToast } = useToast();
 const profile = useMemo(() => userProfile || getActiveProfile() || {}, [userProfile]);

 // Active view tab: 'preview' | 'tune' | 'stories'
 const [activeTab, setActiveTab] = useState('preview');

 // Conference & panel configuration state
 const initialMeetingInfo = useMemo(() => extractInterviewMeetingInfo(job), [job]);

 const [meetingUrl, setMeetingUrl] = useState(initialMeetingInfo.meetingUrl || '');
 const [meetingId, setMeetingId] = useState(initialMeetingInfo.meetingId || '');
 const [passcode, setPasscode] = useState(initialMeetingInfo.passcode || '');
 const [scheduledTime, setScheduledTime] = useState(initialMeetingInfo.scheduledTime || '');
 const [panelString, setPanelString] = useState(
 () => (initialMeetingInfo.interviewers || []).map(p => p.name).join(', ')
 );

 const [copied, setCopied] = useState(false);

 // Sync state if job prop updates
 useEffect(() => {
 if (job) {
 const extracted = extractInterviewMeetingInfo(job);
 setMeetingUrl(extracted.meetingUrl || '');
 setMeetingId(extracted.meetingId || '');
 setPasscode(extracted.passcode || '');
 setScheduledTime(extracted.scheduledTime || '');
 setPanelString((extracted.interviewers || []).map(p => p.name).join(', '));
 }
 }, [job]);

 // Parse panel string into interviewer objects
 const parsedInterviewers = useMemo(() => {
 if (!panelString.trim()) {
 return initialMeetingInfo.interviewers || [];
 }
 const names = panelString.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
 if (names.length === 0) return initialMeetingInfo.interviewers || [];

 return names.map((name, idx) => {
 const roles = ['Hiring Lead / Manager', 'Technical Architect / Principal', 'Culture & Stakeholder Partner'];
 return {
 name,
 role: roles[idx % roles.length],
 focus: 'Direct team evaluation & competency alignment',
 dropTerms: 'Best practices, Production metrics, Scalability',
 };
 });
 }, [panelString, initialMeetingInfo]);

 // Real-time generated HTML
 const generatedHtml = useMemo(() => {
 if (!job) return '';
 return generateInterviewCheatSheetHtml(job, profile, {
 meetingUrl,
 meetingId,
 passcode,
 scheduledTime,
 interviewers: parsedInterviewers,
 });
 }, [job, profile, meetingUrl, meetingId, passcode, scheduledTime, parsedInterviewers]);

 if (!isOpen || !job) return null;

 const handleLaunchNewTab = () => {
 openCheatSheetInNewTab(generatedHtml, `${job.company} Master Interview Cheat Sheet`);
 if (addToast) {
 addToast('🚀 Master Interview Cockpit opened in new tab!', 'success');
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
 <div className="w-10 h-10 rounded-sm bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
 <Sparkles size={20} />
 </div>
 <div>
 <h2 id="cheat-sheet-title" className="text-base font-bold text-white flex items-center gap-2">
 Interview Master Command Center
 <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-sm bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
 Gold Benchmark
 </span>
 </h2>
 <p className="text-xs text-slate-400">
 {job.title} <span className="text-slate-600">•</span> <strong className="text-slate-200">{job.company}</strong>
 </p>
 </div>
 </div>

 {/* QUICK ACTION BUTTONS */}
 <div className="flex items-center gap-2">
 <button
 onClick={handleLaunchNewTab}
 className="px-3.5 py-2 rounded-sm bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all -indigo-950/50 cursor-pointer active:scale-95"
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

 <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
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
