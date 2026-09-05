import React, { useState } from 'react';
import { 
  X, Mail, Table, Sparkles, CheckCircle2, AlertCircle, 
  RefreshCw, ExternalLink, ShieldCheck, Plus, Key, Lock, Settings
} from 'lucide-react';
import { 
  getAuthenticatedUser, 
  setAuthenticatedUser, 
  requestGoogleAuthToken, 
  getGoogleClientId, 
  setGoogleClientId, 
  loginWithGoogle 
} from '../services/googleAuthService';
import { createPersonalJobTrackerSheet, syncAllApplicationsToSheet } from '../services/googleSheetService';
import { scanGmailForApplications } from '../services/gmailSyncService';
import { getActiveProfile } from '../services/profileService';

export const GoogleWorkspaceModal = ({ 
  isOpen, 
  onClose, 
  jobs = [], 
  activeProfile, 
  onImportGmailJobs, 
  onAuthenticated,
  initialTab = 'sheet' 
}) => {
  const profile = activeProfile || getActiveProfile();
  const [user, setUser] = useState(() => getAuthenticatedUser());
  const [activeTab, setActiveTab] = useState(initialTab); // 'sheet' | 'gmail' | 'setup'

  // Sheets State
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [sheetMessage, setSheetMessage] = useState('');
  const [sheetError, setSheetError] = useState('');

  // Gmail State
  const [isScanningGmail, setIsScanningGmail] = useState(false);
  const [gmailScanResults, setGmailScanResults] = useState([]);
  const [gmailError, setGmailError] = useState('');
  const [gmailSuccess, setGmailSuccess] = useState('');

  // Setup / Auth State
  const [emailInput, setEmailInput] = useState(profile?.email || 'candidate@gmail.com');
  const [nameInput, setNameInput] = useState(profile?.name || 'Google User');
  const [clientIdInput, setClientIdInput] = useState(getGoogleClientId() || '');
  const [useCustomClientId, setUseCustomClientId] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [authStatusMsg, setAuthStatusMsg] = useState('');
  const [authErrorMsg, setAuthErrorMsg] = useState('');

  if (!isOpen) return null;

  // 1. Create Personal Google Sheet Tracker
  const handleCreateSheet = async () => {
    let currentUser = user;

    if (currentUser?.isSimulated || currentUser?.accessToken?.startsWith('simulated_')) {
      setSheetError('A real Google account sign-in is required to create a Google Sheet. Please sign in via the Account & Auth tab.');
      return;
    }

    if (!currentUser?.accessToken || currentUser.isTokenExpired) {
      try {
        currentUser = await requestGoogleAuthToken();
        setUser(currentUser);
      } catch {
        setSheetError('Google Sign-In is required to create a spreadsheet. Please sign in via the Account & Auth tab.');
        return;
      }
    }

    setIsCreatingSheet(true);
    setSheetError('');
    setSheetMessage('');

    try {
      const result = await createPersonalJobTrackerSheet(currentUser.accessToken, profile || currentUser);
      
      const updatedUser = {
        ...currentUser,
        spreadsheetId: result.spreadsheetId,
        spreadsheetUrl: result.spreadsheetUrl
      };
      setAuthenticatedUser(updatedUser);
      setUser(updatedUser);
      setSheetMessage('Custom Job Tracker Sheet created successfully!');

      if (jobs && jobs.length > 0) {
        setIsSyncingSheet(true);
        const syncRes = await syncAllApplicationsToSheet(
          currentUser.accessToken, 
          result.spreadsheetId, 
          jobs.filter(j => {
            const s = (j.status || '').toLowerCase();
            const src = (j.source || '').toLowerCase();
            return s.includes('applied') || s.includes('interview') || s.includes('reject') || s.includes('offer') || src.includes('user application') || src.includes('gmail');
          }), 
          profile || currentUser
        );
        setSheetMessage(`Custom Sheet created and synced with ${syncRes.count} application records!`);
        setIsSyncingSheet(false);
      }
    } catch (err) {
      console.error('Error creating sheet:', err);
      setSheetError(err.message || 'Failed to create Google Sheet.');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  // 2. Sync existing dashboard applications to sheet
  const handleSyncToSheet = async () => {
    let currentUser = user;

    if (currentUser?.isSimulated || currentUser?.accessToken?.startsWith('simulated_')) {
      setSheetError('A real Google account sign-in is required to sync to Google Sheets.');
      return;
    }

    if (!currentUser?.accessToken || currentUser.isTokenExpired) {
      try {
        currentUser = await requestGoogleAuthToken();
        setUser(currentUser);
      } catch {
        setSheetError('Please authenticate with Google to sync.');
        return;
      }
    }

    if (!currentUser?.spreadsheetId) {
      setSheetError('Please create your Google Sheet tracker first.');
      return;
    }

    setIsSyncingSheet(true);
    setSheetError('');
    setSheetMessage('');

    try {
      const submittedJobs = jobs.filter(j => {
        const s = (j.status || '').toLowerCase();
        const src = (j.source || '').toLowerCase();
        const isApplied = s.includes('applied') || s.includes('interview') || s.includes('reject') || s.includes('offer');
        const isUserApp = src.includes('user application') || src.includes('gmail');
        return isApplied || isUserApp;
      });
      const res = await syncAllApplicationsToSheet(currentUser.accessToken, currentUser.spreadsheetId, submittedJobs, profile || currentUser);
      setSheetMessage(`Successfully synced ${res.count} application records to your personal Google Sheet!`);
    } catch (err) {
      console.error('Error syncing to sheet:', err);
      setSheetError(err.message || 'Failed to sync applications to Google Sheet.');
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // 3. Scan Gmail Inbox
  const handleScanGmail = async () => {
    let currentUser = user;

    if (currentUser?.isSimulated || currentUser?.accessToken?.startsWith('simulated_')) {
      setGmailError('A real Google account sign-in with Gmail permissions is required to scan your inbox. Please connect your account in the Account & Auth tab.');
      return;
    }

    if (!currentUser?.accessToken || currentUser.isTokenExpired) {
      try {
        currentUser = await requestGoogleAuthToken();
        setUser(currentUser);
      } catch {
        setGmailError('Google Sign-In with Gmail permissions is required.');
        return;
      }
    }

    setIsScanningGmail(true);
    setGmailError('');
    setGmailSuccess('');
    setGmailScanResults([]);

    try {
      const results = await scanGmailForApplications(currentUser.accessToken, 35, jobs || []);
      setGmailScanResults(results);
      if (results.length === 0) {
        setGmailSuccess('No new job application emails found in the recent inbox scan.');
      } else {
        const linkedCount = results.filter(r => r.isLinkedToScrapedAd).length;
        if (linkedCount > 0) {
          setGmailSuccess(`Found ${results.length} application emails (Matched & Linked ${linkedCount} directly to scraped job ads)!`);
        } else {
          setGmailSuccess(`Found and structured ${results.length} job application confirmations!`);
        }
      }
    } catch (err) {
      console.error('Gmail scan error:', err);
      setGmailError(err.message || 'Failed to scan Gmail inbox.');
    } finally {
      setIsScanningGmail(false);
    }
  };

  const handleImportScanned = () => {
    if (gmailScanResults.length > 0 && onImportGmailJobs) {
      onImportGmailJobs(gmailScanResults);
      onClose();
    }
  };

  // 4. Setup / OAuth Connect Handler
  const handleDirectConnect = async (e) => {
    if (e) e.preventDefault();
    if (!emailInput || !emailInput.includes('@')) {
      setAuthErrorMsg('Please enter a valid Google email address.');
      return;
    }

    setAuthErrorMsg('');
    setIsLoadingAuth(true);
    setAuthStatusMsg('Configuring Google account & scanning Gmail applications...');

    try {
      if (clientIdInput) {
        setGoogleClientId(clientIdInput);
      }

      const result = await loginWithGoogle({
        autoScanGmail: true,
        preferredUser: {
          email: emailInput.trim(),
          name: nameInput.trim()
        },
        onStatusUpdate: (status) => setAuthStatusMsg(status)
      });

      if (result.isNewUser) {
        sessionStorage.setItem('trigger_initial_scrape', 'true');
      }

      const updatedUser = getAuthenticatedUser();
      setUser(updatedUser);

      if (onAuthenticated) {
        onAuthenticated(result.session, result.profile);
      }
      setActiveTab('sheet');
    } catch (err) {
      setAuthErrorMsg(err.message || 'Account configuration failed.');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="text-[10px] font-mono font-black text-emerald-400 uppercase tracking-widest">
                PERSONAL CLOUD INTEGRATION & IDENTITY
              </div>
              <h2 className="text-xl font-black text-white">
                Google Workspace Suite
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

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 pt-2 font-mono text-xs font-bold gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('sheet')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'sheet'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Table size={14} /> 📊 GOOGLE SHEET TRACKER
          </button>
          <button
            onClick={() => setActiveTab('gmail')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'gmail'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Mail size={14} /> 📥 GMAIL INBOX SCANNER
          </button>
          <button
            onClick={() => setActiveTab('setup')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'setup'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Settings size={14} /> ⚙️ ACCOUNT & AUTH
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-200 font-mono text-xs">
          {/* TAB 1: GOOGLE SHEET TRACKER */}
          {activeTab === 'sheet' && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-teal-950/40 to-slate-900 border border-emerald-500/40 space-y-2">
                <div className="text-emerald-300 font-black flex items-center gap-2 text-sm">
                  <Table size={16} />
                  PERSONAL GOOGLE DRIVE SPREADSHEET
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed font-sans">
                  Create a dedicated, formatted Google Spreadsheet in your personal Google Drive. Every job application you submit or scan will automatically sync to this spreadsheet in real-time.
                </p>
              </div>

              {user?.spreadsheetUrl ? (
                <div className="p-5 rounded-2xl bg-slate-950 border border-emerald-500/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-emerald-400 font-black text-xs flex items-center gap-1.5">
                      <CheckCircle2 size={15} /> SPREADSHEET CONNECTED & ACTIVE
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold">ID: {user.spreadsheetId?.slice(0, 12)}...</span>
                  </div>

                  <a
                    href={user.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>OPEN MY GOOGLE SHEET TRACKER</span>
                    <ExternalLink size={14} />
                  </a>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Sync all current dashboard records:</span>
                    <button
                      onClick={handleSyncToSheet}
                      disabled={isSyncingSheet}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      {isSyncingSheet ? <RefreshCw size={12} className="animate-spin text-emerald-400" /> : <RefreshCw size={12} />}
                      <span>Sync Now</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={handleCreateSheet}
                    disabled={isCreatingSheet}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isCreatingSheet ? (
                      <>
                        <RefreshCw size={15} className="animate-spin text-amber-300" />
                        <span>CREATING SPREADSHEET IN GOOGLE DRIVE...</span>
                      </>
                    ) : (
                      <>
                        <Plus size={15} className="text-amber-300" />
                        <span>⚡ CREATE MY CUSTOM JOB TRACKER GOOGLE SHEET</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {sheetError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-400 shrink-0" />
                  <span>{sheetError}</span>
                </div>
              )}

              {sheetMessage && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                  <span>{sheetMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GMAIL INBOX SCANNER */}
          {activeTab === 'gmail' && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900 border border-indigo-500/40 space-y-2">
                <div className="text-indigo-300 font-black flex items-center gap-2 text-sm">
                  <Mail size={16} />
                  GMAIL APPLICATION SCANNER
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed font-sans">
                  Scan your Gmail inbox for employer application receipts, candidate screening assessments, and interview invitations. Extracted jobs can be imported straight into your tracker.
                </p>
              </div>

              <button
                onClick={handleScanGmail}
                disabled={isScanningGmail}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isScanningGmail ? (
                  <>
                    <RefreshCw size={15} className="animate-spin text-amber-300" />
                    <span>SCANNING GMAIL INBOX (0–5s)...</span>
                  </>
                ) : (
                  <>
                    <Mail size={15} className="text-amber-300" />
                    <span>📥 SCAN MY GMAIL INBOX NOW</span>
                  </>
                )}
              </button>

              {gmailError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-400 shrink-0" />
                  <span>{gmailError}</span>
                </div>
              )}

              {gmailSuccess && (
                <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-indigo-200 text-xs flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-indigo-400 shrink-0" />
                  <span>{gmailSuccess}</span>
                </div>
              )}

              {/* Scanned Results List */}
              {gmailScanResults.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-white text-xs uppercase tracking-wider">
                      DETECTED APPLICATIONS ({gmailScanResults.length})
                    </span>
                    <button
                      onClick={handleImportScanned}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[11px] flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                    >
                      <Plus size={13} /> Import All Scanned
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {gmailScanResults.map((app, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-400/50 transition-colors space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-white text-xs truncate max-w-[280px]">
                            {app.company} — <span className="text-slate-300">{app.title}</span>
                          </div>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                            {app.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {app.notes}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ACCOUNT & AUTH SETUP */}
          {activeTab === 'setup' && (
            <div className="space-y-5">
              {/* Status banner */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    <ShieldCheck size={14} className="text-indigo-400" /> GOOGLE IDENTITY & PERMISSIONS
                  </div>
                  {user?.email && (
                    <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 size={13} /> {user.email}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 font-sans">
                  Configure your Google credentials, sign in with OAuth 2.0 to access Sheets and Gmail, or set a custom Google Cloud Client ID.
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
                    <span>Basic Profile & Email</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 size={13} />
                    <span>Gmail Job History (Read-Only)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 size={13} />
                    <span>Google Sheets Tracker (Create/Edit)</span>
                  </div>
                </div>
              </div>

              {/* Status / Loading */}
              {authStatusMsg && (
                <div className="p-3 rounded-xl bg-indigo-950/80 border border-indigo-500/50 text-indigo-200 text-xs flex items-center gap-2 animate-pulse">
                  <RefreshCw size={14} className="animate-spin text-indigo-400 shrink-0" />
                  <span>{authStatusMsg}</span>
                </div>
              )}

              {/* Error */}
              {authErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="text-rose-400 shrink-0" />
                  <span>{authErrorMsg}</span>
                </div>
              )}

              {/* Connect Form */}
              <form onSubmit={handleDirectConnect} className="space-y-4 text-xs">
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

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoadingAuth}
                    className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-black text-xs shadow-xl border border-slate-200 transition-all cursor-pointer flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isLoadingAuth ? (
                      <RefreshCw size={15} className="animate-spin text-slate-900" />
                    ) : (
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.29 21.36 7.37 24 12 24z"/>
                        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.98 0 12s.46 3.84 1.26 5.42l4.02-3.15z"/>
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.29 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                      </svg>
                    )}
                    <span>CONTINUE WITH GOOGLE ACCOUNT & SYNC GMAIL</span>
                  </button>
                </div>
              </form>
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
        </div>
      </div>
    </div>
  );
};

export default GoogleWorkspaceModal;
