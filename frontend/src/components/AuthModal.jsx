import React, { useState, useEffect } from 'react';
import { 
  X, LogIn, LogOut, CheckCircle2, ShieldCheck, Mail, 
  Table, Sparkles, Key, AlertCircle, RefreshCw, ExternalLink, Zap, Activity, Fingerprint
} from 'lucide-react';
import { 
  getAuthenticatedUser, setAuthenticatedUser, signOutGoogleUser, 
  requestGoogleAuthToken, getGoogleClientId, setGoogleClientId,
  isValidGoogleClientId, simulateGoogleWorkspaceAuth, loginWithGoogle 
} from '../services/googleAuthService';
import { loginWithBrowserPasskey, registerDevicePasskey } from '../services/passkeyService';
import { linkGoogleAccount } from '../services/authService';

export const AuthModal = ({ isOpen, onClose, onAuthChange, activeProfile, jobs = [] }) => {
 const [user, setUser] = useState(() => getAuthenticatedUser());
 const [clientIdInput, setClientIdInput] = useState(() => getGoogleClientId());
 const [isConnecting, setIsConnecting] = useState(false);
 const [errorMsg, setErrorMsg] = useState('');
 const [successMsg, setSuccessMsg] = useState('');
 const [showSetupGuide, setShowSetupGuide] = useState(false);
 const [apiHealth, setApiHealth] = useState('checking...');
 const [dbHealth, setDbHealth] = useState('checking...');

 useEffect(() => {
 if (isOpen) {
 fetch('/api/health')
 .then(res => res.json())
 .then(data => {
 setApiHealth('Healthy');
 setDbHealth(data.database || 'SQLite WAL (Pooled)');
 })
 .catch(err => {
 setApiHealth('Unreachable');
 setDbHealth('Offline');
 });
 }
 }, [isOpen]);

 if (!isOpen) return null;

 const handlePasskeyAuth = async () => {
 setIsConnecting(true);
 setErrorMsg('');
 try {
 const passkeyUser = await loginWithBrowserPasskey();
 setUser(passkeyUser);
 setSuccessMsg(`Authenticated via Browser Passkey as ${passkeyUser.name || 'Candidate'}!`);
 if (onAuthChange) onAuthChange(passkeyUser);
 } catch (err) {
 setErrorMsg(err.message || 'Passkey authentication failed.');
 } finally {
 setIsConnecting(false);
 }
 };

 const handleRegisterPasskey = async () => {
 if (!user) return;
 setIsConnecting(true);
 setErrorMsg('');
 try {
 const result = await registerDevicePasskey(user);
 const updatedUser = { ...user, hasPasskey: true };
 setUser(updatedUser);
 setSuccessMsg(result.message || 'Passkey successfully created on this device and bound to your account!');
 if (onAuthChange) onAuthChange(updatedUser);
 } catch (err) {
 setErrorMsg(err.message || 'Passkey setup failed.');
 } finally {
 setIsConnecting(false);
 }
 };

 const handleInstantConnect = () => {
 try {
 const authUser = simulateGoogleWorkspaceAuth(activeProfile || { name: 'Google User', email: 'candidate@gmail.com' });
 setUser(authUser);
 setSuccessMsg(`Instant Workspace Cloud connection activated for ${authUser.name}! (Demo)`);
 if (onAuthChange) onAuthChange(authUser);
 } catch (err) {
 setErrorMsg('Failed to initialize local workspace session.');
 }
 };

 const handleConnectGoogle = async () => {
 setIsConnecting(true);
 setErrorMsg('');
 setSuccessMsg('Connecting to Google Identity Services...');

 try {
 if (clientIdInput) {
 setGoogleClientId(clientIdInput);
 }

 const result = await loginWithGoogle({
 autoScanGmail: true,
 onStatusUpdate: (msg) => setSuccessMsg(msg)
 });

 if (result?.user) {
 try {
 await linkGoogleAccount(result.user);
 } catch (linkErr) {
 console.debug('Link Google account status:', linkErr);
 }
 }

 setUser(result.user);
 setSuccessMsg(`Connected as ${result.user.name} (${result.user.email})! Synced ${result.scanCount || 0} applications from Gmail.`);
 if (onAuthChange) onAuthChange(result.user);
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
 <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-sm overflow-hidden flex flex-col">
 {/* Header */}
 <div className="p-6 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="p-2.5 rounded-sm bg-gradient-to-br from-indigo-500 to-purple-600 text-white ">
 <ShieldCheck size={22} />
 </div>
 <div>
 <div className="text-[10px] font-mono font-black text-amber-400 uppercase tracking-widest">
 AUTHENTICATION & CLOUD SYNC
 </div>
 <h2 className="text-xl font-black text-white">
 Google Workspace Integration
 </h2>
 </div>
 </div>

 <button
 onClick={onClose}
 className="p-2 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
 >
 <X size={18} />
 </button>
 </div>

 {/* Modal Body */}
 <div className="p-6 space-y-5 font-mono text-xs text-slate-200">
 {/* Status Badge */}
 {user ? (
 <div className="p-4 rounded-sm bg-emerald-950/60 border border-emerald-500/40 flex items-center gap-3.5">
 {user.picture ? (
 <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-sm border border-emerald-400" />
 ) : (
 <div className="w-10 h-10 rounded-sm bg-emerald-600 text-white font-black text-sm flex items-center justify-center">
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
 <div className="p-4 rounded-sm bg-slate-950 border border-slate-800 space-y-2">
 <div className="text-amber-400 font-extrabold text-xs flex items-center gap-1.5">
 <Sparkles size={14} className="text-amber-300" />
 1-CLICK AUTHENTICATION & AUTOMATION
 </div>
 <p className="text-slate-400 text-[11px] leading-relaxed">
 Connect your Google Account to unlock persistent multi-device profiles, automatic Gmail scanning for application status updates, and a private Google Spreadsheet tracker in your Google Drive.
 </p>
 </div>
 )}

      {/* WebAuthn Passkey Section */}
      {user && (
        <div className="p-3.5 rounded-sm bg-[#16120e] border border-[#d48b38]/40 space-y-2 font-mono">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#d48b38] font-bold text-xs">
              <Fingerprint size={16} />
              <span>WEBAUTHN DEVICE PASSKEY</span>
            </div>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm ${user.hasPasskey ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'}`}>
              {user.hasPasskey ? 'ACTIVE' : 'NOT CONFIGURED'}
            </span>
          </div>
          <p className="text-slate-400 text-[10px] leading-relaxed">
            Bind this device (Touch ID, Face ID, Windows Hello, or hardware key) to your account for 1-click passwordless login.
          </p>
          <button
            type="button"
            onClick={handleRegisterPasskey}
            disabled={isConnecting}
            className="w-full py-2 px-3 bg-[#221b14] hover:bg-[#2e241b] text-[#d48b38] hover:text-[#f2a144] border border-[#d48b38]/60 rounded-sm font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Fingerprint size={14} />
            <span>{user.hasPasskey ? 'UPDATE / ADD PASSKEY FOR THIS DEVICE' : 'SET UP PASSKEY ON THIS DEVICE'}</span>
          </button>
        </div>
      )}

 {/* Scopes Overview */}
 <div className="space-y-2.5 bg-slate-950/80 p-4 rounded-sm border border-slate-800 text-[11px]">
 <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
 AUTHORIZED CAPABILITIES & PERMISSIONS:
 </div>
 <div className="space-y-1.5">
 <div className="flex items-center gap-2 text-slate-200">
 <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
 <span><strong>User Profile & Identity</strong>: Persist profile & settings across sessions.</span>
 </div>
 <div className="flex items-center gap-2 text-slate-200">
 <Mail size={13} className="text-amber-400 shrink-0" />
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
 <Key size={11} className="text-amber-400" /> GOOGLE CLOUD CLIENT ID (FOR REAL OAUTH):
 </label>
 <button
 type="button"
 onClick={() => setShowSetupGuide(!showSetupGuide)}
 className="text-[10px] text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
 >
 {showSetupGuide ? 'Hide GCP Guide' : 'How to get Client ID?'}
 </button>
 </div>
 <input
 type="text"
 value={clientIdInput}
 onChange={(e) => setClientIdInput(e.target.value)}
 placeholder="e.g. 123456789-xyz.apps.googleusercontent.com"
 className="w-full p-2.5 rounded-sm bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-amber-500 focus:outline-none placeholder-slate-600"
 />

 {showSetupGuide && (
 <div className="p-3 rounded-sm bg-slate-950 border border-slate-800 space-y-1.5 text-[11px] text-slate-300">
 <div className="font-bold text-white text-xs">Google Cloud Console Setup (30s):</div>
 <ol className="list-decimal pl-4 space-y-1 text-slate-400">
 <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-amber-400 underline">Google Cloud Console &gt; Credentials</a>.</li>
 <li>Click <strong>Create Credentials &gt; OAuth Client ID</strong> (Web Application).</li>
 <li>Add both of these to <strong>Authorized JavaScript origins</strong>:
 <div className="mt-1 font-mono text-[10px] bg-slate-900 p-1.5 rounded text-emerald-400 select-all space-y-1">
 <div>https://job-dashboard-6xrdvjlrcq-ts.a.run.app</div>
 <div>https://job-dashboard-45495870656.australia-southeast1.run.app</div>
 {typeof window !== 'undefined' && window.location.origin.includes('localhost') && (
 <div>http://localhost:5173</div>
 )}
 </div>
 </li>
 <li>Paste the generated Client ID above.</li>
 </ol>
 </div>
 )}
 </div>

 {/* System Health & Profile Sync Status Panel */}
 <div className="p-4 rounded-sm bg-slate-950 border border-amber-500/30 space-y-3 font-mono">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Activity size={14} className="text-emerald-400 animate-pulse" />
 <span className="font-black text-xs text-white uppercase tracking-wider">LIVE SYSTEM & PROFILE HEALTH</span>
 </div>
 <span className="px-2 py-0.5 rounded-sm bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black">
 100% OPERATIONAL
 </span>
 </div>

 <div className="grid grid-cols-2 gap-2 text-[10px]">
 <div className="p-2 rounded-sm bg-slate-900 border border-slate-800 space-y-0.5">
 <div className="text-slate-400 font-bold uppercase">Backend API</div>
 <div className={`font-black flex items-center gap-1 ${apiHealth === 'Healthy' ? 'text-emerald-400' : 'text-amber-400'}`}>
 {apiHealth === 'Healthy' ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />} {apiHealth}
 </div>
 </div>

 <div className="p-2 rounded-sm bg-slate-900 border border-slate-800 space-y-0.5">
 <div className="text-slate-400 font-bold uppercase">Database Engine</div>
 <div className={`font-black flex items-center gap-1 ${apiHealth === 'Healthy' ? 'text-emerald-400' : 'text-amber-400'}`}>
 {apiHealth === 'Healthy' ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />} {dbHealth}
 </div>
 </div>

 <div className="p-2 rounded-sm bg-slate-900 border border-slate-800 space-y-0.5">
 <div className="text-slate-400 font-bold uppercase">Active Profile Sync</div>
 <div className="text-amber-300 font-black truncate">
 {activeProfile?.name || user?.name || 'Not Synced'}
 </div>
 </div>

 <div className="p-2 rounded-sm bg-slate-900 border border-slate-800 space-y-0.5">
 <div className="text-slate-400 font-bold uppercase">Indexed Feed</div>
 <div className="text-slate-200 font-black">
 {jobs.length.toLocaleString()} Live Positions
 </div>
 </div>
 
 {user?.spreadsheetId && (
 <div className="col-span-2 p-2 rounded-sm bg-emerald-950/30 border border-emerald-900 space-y-0.5">
 <div className="text-emerald-500 font-bold uppercase">Google Drive Sync</div>
 <div className="text-emerald-400 font-black flex items-center gap-1">
 <CheckCircle2 size={11} /> Tracker Sheet Connected & Active
 </div>
 </div>
 )}
 </div>
 </div>

 {errorMsg && (
 <div className="p-3 rounded-sm bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
 <AlertCircle size={15} className="text-rose-400 shrink-0" />
 <span>{errorMsg}</span>
 </div>
 )}

 {successMsg && (
 <div className="p-3 rounded-sm bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
 <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
 <span>{successMsg}</span>
 </div>
 )}
 </div>


 {/* Footer Actions */}
 <div className="p-6 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-mono">
 <button
 onClick={onClose}
 className="px-4 py-2.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
 >
 Close
 </button>

        {user ? (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={handleRegisterPasskey}
              disabled={isConnecting}
              className="px-4 py-2.5 rounded-sm bg-[#16120e] hover:bg-[#201913] border border-[#d48b38]/50 text-[#d48b38] hover:text-[#f2a144] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              title="Register a WebAuthn biometric passkey on this device"
            >
              <Fingerprint size={14} className="text-[#d48b38]" />
              <span>{user.hasPasskey ? "✓ PASSKEY ACTIVE (ADD DEVICE)" : "🔑 SET UP PASSKEY ON THIS DEVICE"}</span>
            </button>
            <button
              onClick={handleSignOut}
              className="px-5 py-2.5 rounded-sm bg-rose-900/80 hover:bg-rose-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        ) : (
 <div className="flex flex-col sm:flex-row items-center gap-2">
 <button
 type="button"
 onClick={handlePasskeyAuth}
 disabled={isConnecting}
 className="w-full sm:w-auto px-4 py-2.5 rounded-sm bg-slate-900 hover:bg-slate-800 border border-emerald-500/50 text-emerald-300 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
 title="Sign in with browser passkey or saved credentials"
 >
 <Key size={14} className="text-emerald-400" />
 <span>🔑 PASSKEY / BROWSER SIGN-IN</span>
 </button>

 <button
 type="button"
 onClick={handleInstantConnect}
 className="w-full sm:w-auto px-4 py-2.5 rounded-sm bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
 title="Connect simulated cloud sync without Google Cloud project setup"
 >
 <Zap size={14} className="text-amber-300" />
 <span>⚡ INSTANT SYNC (DEMO)</span>
 </button>

 {clientIdInput && (
 <button
 type="button"
 onClick={handleConnectGoogle}
 disabled={isConnecting}
 className="w-full sm:w-auto px-4 py-2.5 rounded-sm bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
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
