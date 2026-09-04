import React, { useState } from 'react';
import { Mail, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, X, Key, Sparkles, Lock } from 'lucide-react';
import { 
  getGoogleClientId, 
  setGoogleClientId, 
  isValidGoogleClientId, 
  requestGoogleAuthToken, 
  simulateGoogleWorkspaceAuth,
  loginWithGoogle
} from '../services/googleAuthService';
import { getActiveProfile } from '../services/profileService';

export const GooglePromptModal = ({ isOpen, onClose, onAuthenticated }) => {
  const currentProfile = getActiveProfile();
  const [emailInput, setEmailInput] = useState(currentProfile?.email || 'candidate@gmail.com');
  const [nameInput, setNameInput] = useState(currentProfile?.name || 'Google User');
  const [clientIdInput, setClientIdInput] = useState(getGoogleClientId() || '');
  const [useCustomClientId, setUseCustomClientId] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleDirectOAuth = async () => {
    setErrorMsg('');
    setIsLoading(true);
    setStatusMsg('Opening Google OAuth 2.0 Consent Prompt...');

    try {
      if (clientIdInput) {
        setGoogleClientId(clientIdInput);
      }
      
      const result = await loginWithGoogle({
        autoScanGmail: true,
        onStatusUpdate: (status) => setStatusMsg(status)
      });

      if (onAuthenticated) {
        onAuthenticated(result.session, result.profile);
      }
      onClose();
    } catch (err) {
      console.error('Google Sign-In failed:', err);
      setErrorMsg(err.message || 'Google authentication was not completed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailDirectConnect = async (e) => {
    e.preventDefault();
    if (!emailInput || !emailInput.includes('@')) {
      setErrorMsg('Please enter a valid Google email address.');
      return;
    }

    setErrorMsg('');
    setIsLoading(true);
    setStatusMsg('Configuring Google account & scanning Gmail applications...');

    try {
      const authUser = simulateGoogleWorkspaceAuth({
        email: emailInput.trim(),
        name: nameInput.trim()
      });

      const result = await loginWithGoogle({
        autoScanGmail: true,
        onStatusUpdate: (status) => setStatusMsg(status)
      });

      if (onAuthenticated) {
        onAuthenticated(result.session, result.profile);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Account configuration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 font-mono">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="space-y-2 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <ShieldCheck size={14} className="text-indigo-400" /> GOOGLE IDENTITY &amp; GMAIL SYNC
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Sign In with Google</h2>
          <p className="text-xs text-slate-400 font-sans">
            Automatically provision your candidate account, persist profile data, and scan your Gmail inbox with permission to sync job application confirmations and interview invites.
          </p>
        </div>

        {/* Scopes Notice */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2 text-slate-300 font-sans">
          <div className="font-mono font-bold text-[11px] text-indigo-300 flex items-center gap-1.5">
            <Lock size={12} className="text-indigo-400" /> REQUESTED GOOGLE PERMISSIONS
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 size={13} />
              <span>Basic Profile &amp; Email</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 size={13} />
              <span>Gmail Job History (Read-Only)</span>
            </div>
          </div>
        </div>

        {/* Status / Loading Message */}
        {statusMsg && (
          <div className="p-3 rounded-xl bg-indigo-950/80 border border-indigo-500/50 text-indigo-200 text-xs flex items-center gap-2 animate-pulse">
            <RefreshCw size={14} className="animate-spin text-indigo-400 shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Error Message */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle size={14} className="text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleEmailDirectConnect} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-slate-300 font-bold flex items-center gap-1.5">
              <Mail size={13} className="text-indigo-400" /> YOUR GOOGLE EMAIL
            </label>
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="e.g. yourname@gmail.com"
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 focus:outline-none placeholder-slate-600 font-sans text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300 font-bold flex items-center gap-1.5">
              <Sparkles size={13} className="text-indigo-400" /> CANDIDATE NAME
            </label>
            <input
              type="text"
              required
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Sam Ludwig"
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 focus:outline-none placeholder-slate-600 font-sans text-sm"
            />
          </div>

          {/* Optional GCP Client ID Toggle */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setUseCustomClientId(!useCustomClientId)}
              className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer font-bold"
            >
              <Key size={12} />
              <span>{useCustomClientId ? 'Hide Google Cloud Client ID' : 'Configure Custom Google Cloud Client ID (Optional)'}</span>
            </button>

            {useCustomClientId && (
              <div className="mt-2 space-y-1.5 animate-in fade-in duration-150">
                <input
                  type="text"
                  value={clientIdInput}
                  onChange={(e) => setClientIdInput(e.target.value)}
                  placeholder="xxxxx.apps.googleusercontent.com"
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 focus:outline-none placeholder-slate-600 font-sans text-xs"
                />
                <div className="text-[10px] text-slate-500">
                  Enter your Google Cloud Web Application Client ID for live browser OAuth popup consent.
                </div>
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-black text-xs shadow-xl border border-slate-200 transition-all cursor-pointer flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isLoading ? (
                <RefreshCw size={15} className="animate-spin text-slate-900" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.29 21.36 7.37 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.98 0 12s.46 3.84 1.26 5.42l4.02-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.29 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
              )}
              <span>CONTINUE WITH GOOGLE ACCOUNT &amp; SYNC GMAIL</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
