import React, { useState } from 'react';
import { Mail, Copy, Check, X, Send, Sparkles, UserCheck, MessageSquareQuote } from 'lucide-react';
import { generateFollowUpEmail } from '../services/trackerService';

export const FollowUpEmailModal = ({ job, onClose, initialMode = 'followup', prefillRecruiter = null }) => {
  const [activeMode, setActiveMode] = useState(initialMode); // 'followup' | 'recruiter_pitch' | 'thank_you'

  const emailData = generateFollowUpEmail(job, { type: activeMode });
  const [recipient, setRecipient] = useState(prefillRecruiter?.recipientEmail || emailData.contactEmail || '');
  const [subject, setSubject] = useState(emailData.subject);
  const [body, setBody] = useState(emailData.body);
  const [copied, setCopied] = useState(false);
  const [loggedToCrm, setLoggedToCrm] = useState(false);

  const handleModeSwitch = (newMode) => {
    setActiveMode(newMode);
    const updated = generateFollowUpEmail(job, { type: newMode });
    setSubject(updated.subject);
    setBody(updated.body);
  };

  const handleCopy = () => {
    const fullText = `To: ${recipient || '[Hiring Team / Recruiter]'}\nSubject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const mailtoUrl = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="bg-slate-900 border-2 border-indigo-500/50 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-400/30">
              <Mail size={20} />
            </div>
            <div>
              <div className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                <span>OUTREACH &amp; COMMUNICATION SUITE</span>
                {emailData.sector && (
                  <span className="px-1.5 py-0.2 rounded bg-indigo-950/80 border border-indigo-500/40 text-[9px] text-indigo-300">
                    {emailData.sector.toUpperCase()}
                  </span>
                )}
              </div>
              <h3 className="text-base font-black text-white">{job.title}</h3>
              <div className="text-xs text-slate-400 font-medium flex items-center gap-2">
                <span>{job.company}</span>
                {job.location && <span>• {job.location}</span>}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Outreach Mode Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-5 pt-2.5 gap-2 font-mono text-xs font-bold overflow-x-auto">
          <button
            onClick={() => handleModeSwitch('followup')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeMode === 'followup'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Mail size={13} />
            <span>APPLICATION FOLLOW-UP</span>
          </button>

          <button
            onClick={() => handleModeSwitch('recruiter_pitch')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeMode === 'recruiter_pitch'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Sparkles size={13} />
            <span>RECRUITER COLD PITCH</span>
          </button>

          <button
            onClick={() => handleModeSwitch('thank_you')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeMode === 'thank_you'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <UserCheck size={13} />
            <span>POST-INTERVIEW THANK YOU</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 font-mono text-xs">
          {/* Recipient Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>RECIPIENT EMAIL / CONTACT</span>
              <span className="text-slate-500 text-[9px]">Optional if sending via portal</span>
            </label>
            <input
              type="text"
              placeholder="e.g. talent@company.com or hiring.manager@domain.com"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Subject Line */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              EMAIL SUBJECT
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Email Body */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              MESSAGE BODY
            </label>
            <textarea
              rows={11}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 text-xs leading-relaxed focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none font-mono"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
          <button
            onClick={handleCopy}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-700"
          >
            {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
            <span>{copied ? 'COPIED TO CLIPBOARD' : 'COPY FULL OUTREACH'}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <a
              href={mailtoUrl}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
            >
              <Send size={15} />
              <span>LAUNCH DEFAULT EMAIL APP</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
