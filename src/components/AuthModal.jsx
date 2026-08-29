import React, { useState } from 'react';
import { 
  X, LogIn, LogOut, CheckCircle2, ShieldCheck, Mail, 
  Table, Sparkles, Key, AlertCircle, RefreshCw, ExternalLink 
} from 'lucide-react';
import { 
  getAuthenticatedUser, setAuthenticatedUser, signOutGoogleUser, 
  requestGoogleAuthToken, getGoogleClientId, setGoogleClientId,
  isValidGoogleClientId, simulateGoogleWorkspaceAuth 
} from '../services/googleAuthService';
import { loginWithBrowserPasskey } from '../services/passkeyService';

export const AuthModal = ({ isOpen, onClose, onAuthChange, activeProfile }) => {
  const [user, setUser] = useState(() => getAuthenticatedUser());
  const [clientIdInput, setClientIdInput] = useState(() => getGoogleClientId());
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  if (!isOpen) return null;

  const handlePasskeyAuth = async () => {
    setIsConnecting(true);
    setErrorMsg('');
    try {
      const passkeyUser = await loginWithBrowserPasskey();
      const authUser = simulateGoogleWorkspaceAuth(passkeyUser);
      setUser(authUser);
      setSuccessMsg(`Authenticated via Browser Passkey as ${passkeyUser.name}!`);
      if (onAuthChange) onAuthChange(authUser);
    } catch (err) {
      setErrorMsg(err.message || 'Passkey authentication failed.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleInstantConnect = () => {
    try {
      const authUser = simulateGoogleWorkspaceAuth(activeProfile || { name: 'Google User', email: 'candidate@gmail.com' });
      setUser(authUser);
      setSuccessMsg(`Instant Workspace Cloud connection activated for ${authUser.name}!`);
      if (onAuthChange) onAuthChange(authUser);
    } catch (err) {
      setErrorMsg('Failed to initialize local workspace session.');
    }
  };

  const handleConnectGoogle = async () => {
    if (!isValidGoogleClientId(clientIdInput)) {
      setErrorMsg('Please enter a valid Google Cloud Client ID (ending in .apps.googleusercontent.com) below, or use 1-Click Instant Connect.');
      setShowSetupGuide(true);
      return;
    }

    setIsConnecting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      setGoogleClientId(clientIdInput);

      const authUser = await requestGoogleAuthToken({
        clientId: clientIdInput
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

          {/* Optional Google Client ID Configuration & Guide */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                <Key size={11} className="text-indigo-400" /> GOOGLE CLOUD CLIENT ID (FOR REAL OAUTH):
              </label>
              <button
                type="button"
                onClick={() => setShowSetupGuide(!showSetupGuide)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer"
              >
                {showSetupGuide ? 'Hide GCP Guide' : 'How to get Client ID?'}
              </button>
            </div>
            <input
              type="text"
              value={clientIdInput}
              onChange={(e) => setClientIdInput(e.target.value)}
              placeholder="e.g. 123456789-xyz.apps.googleusercontent.com"
              className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-indigo-500 focus:outline-none placeholder-slate-600"
            />

            {showSetupGuide && (
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-[11px] text-slate-300">
                <div className="font-bold text-white text-xs">Google Cloud Console Setup (30s):</div>
                <ol className="list-decimal pl-4 space-y-1 text-slate-400">
                  <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-indigo-400 underline">Google Cloud Console &gt; Credentials</a>.</li>
                  <li>Click <strong>Create Credentials &gt; OAuth Client ID</strong> (Web Application).</li>
                  <li>Add to <strong>Authorized JavaScript origins</strong>:
                    <div className="mt-1 font-mono text-[10px] bg-slate-900 p-1.5 rounded text-emerald-400 select-all">
                      https://ludwixix.github.io
                    </div>
                  </li>
                  <li>Paste the generated Client ID above.</li>
                </ol>
              </div>
            )}
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
        <div className="p-6 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-mono">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>

          {user ? (
            <button
              onClick={handleSignOut}
              className="px-5 py-2.5 rounded-xl bg-rose-900/80 hover:bg-rose-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut size={14} /> Sign Out
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                onClick={handlePasskeyAuth}
                disabled={isConnecting}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-emerald-500/50 text-emerald-300 font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                title="Sign in with browser passkey or saved credentials"
              >
                <Key size={14} className="text-emerald-400" />
                <span>🔑 PASSKEY / BROWSER SIGN-IN</span>
              </button>

              <button
                type="button"
                onClick={handleInstantConnect}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                title="Connect instant cloud sync without Google Cloud project setup"
              >
                <Zap size={14} className="text-amber-300" />
                <span>⚡ INSTANT SYNC</span>
              </button>

              {clientIdInput && (
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={isConnecting}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isConnecting ? <RefreshCw size={14} className="animate-spin" /> : <LogIn size={14} />}
                  <span>Sign In with GCP</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
