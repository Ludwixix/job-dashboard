import React, { useState } from 'react';
import { 
  X, LogIn, LogOut, CheckCircle2, ShieldCheck, Mail, 
  Table, Sparkles, Key, AlertCircle, RefreshCw, ExternalLink 
} from 'lucide-react';
import { 
  getAuthenticatedUser, setAuthenticatedUser, signOutGoogleUser, 
  requestGoogleAuthToken, getGoogleClientId, setGoogleClientId 
} from '../services/googleAuthService';

export const AuthModal = ({ isOpen, onClose, onAuthChange }) => {
  const [user, setUser] = useState(() => getAuthenticatedUser());
  const [clientIdInput, setClientIdInput] = useState(() => getGoogleClientId());
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (clientIdInput) {
        setGoogleClientId(clientIdInput);
      }

      const authUser = await requestGoogleAuthToken({
        clientId: clientIdInput || undefined
      });

      setUser(authUser);
      setSuccessMsg(`Successfully connected as ${authUser.name} (${authUser.email})`);
      if (onAuthChange) onAuthChange(authUser);
    } catch (err) {
      console.error('Google Auth failed:', err);
      setErrorMsg(err.message || 'Authentication was cancelled or failed.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSignOut = () => {
    signOutGoogleUser();
    setUser(null);
    setSuccessMsg('Signed out successfully.');
    if (onAuthChange) onAuthChange(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="text-[10px] font-mono font-black text-indigo-400 uppercase tracking-widest">
                AUTHENTICATION & CLOUD SYNC
              </div>
              <h2 className="text-xl font-black text-white">
                Google Workspace Integration
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 font-mono text-xs text-slate-200">
          {/* Status Badge */}
          {user ? (
            <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 flex items-center gap-3.5">
              {user.picture ? (
                <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full border border-emerald-400" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-black text-sm flex items-center justify-center">
                  {user.name?.[0] || 'U'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 size={12} /> AUTHENTICATED
                </div>
                <div className="text-sm font-black text-white truncate">{user.name}</div>
                <div className="text-[11px] text-slate-300 truncate">{user.email}</div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="text-indigo-400 font-extrabold text-xs flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-300" />
                1-CLICK AUTHENTICATION & AUTOMATION
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Connect your Google Account to unlock persistent multi-device profiles, automatic Gmail scanning for application status updates, and a private Google Spreadsheet tracker in your Google Drive.
              </p>
            </div>
          )}

          {/* Scopes Overview */}
          <div className="space-y-2.5 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-[11px]">
            <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              AUTHORIZED CAPABILITIES & PERMISSIONS:
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-slate-200">
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                <span><strong>User Profile & Identity</strong>: Persist profile & settings across sessions.</span>
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <Mail size={13} className="text-indigo-400 shrink-0" />
                <span><strong>Gmail Inbox Scanner</strong>: Detect job confirmations, assessments & interview invites.</span>
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <Table size={13} className="text-emerald-400 shrink-0" />
                <span><strong>Personal Google Sheets</strong>: Auto-create & live-sync your custom job applications sheet.</span>
              </div>
            </div>
          </div>

          {/* Optional Google Client ID Configuration */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <label className="text-[10px] font-bold text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Key size={11} className="text-indigo-400" /> GOOGLE OAUTH CLIENT ID (OPTIONAL / CUSTOM):
              </span>
            </label>
            <input
              type="text"
              value={clientIdInput}
              onChange={(e) => setClientIdInput(e.target.value)}
              placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
              className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-indigo-500 focus:outline-none placeholder-slate-600"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3 font-mono">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>

          {user ? (
            <button
              onClick={handleSignOut}
              className="px-5 py-2.5 rounded-xl bg-rose-900/80 hover:bg-rose-800 text-white font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut size={14} /> Sign Out
            </button>
          ) : (
            <button
              onClick={handleConnectGoogle}
              disabled={isConnecting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs shadow-lg transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {isConnecting ? (
                <>
                  <RefreshCw size={14} className="animate-spin text-amber-300" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <LogIn size={14} className="text-amber-300" />
                  <span>Sign In with Google</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
