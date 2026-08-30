import React, { useState } from 'react';
import { 
  X, Mail, Table, Sparkles, CheckCircle2, AlertCircle, 
  RefreshCw, ExternalLink, ArrowRight, ShieldCheck, Download, Plus
} from 'lucide-react';
import { getAuthenticatedUser, setAuthenticatedUser, requestGoogleAuthToken } from '../services/googleAuthService';
import { createPersonalJobTrackerSheet, syncAllApplicationsToSheet } from '../services/googleSheetService';
import { scanGmailForApplications } from '../services/gmailSyncService';

export const GoogleIntegrationModal = ({ isOpen, onClose, jobs, activeProfile, onImportGmailJobs }) => {
  const [user, setUser] = useState(() => getAuthenticatedUser());
  const [activeTab, setActiveTab] = useState('sheet'); // 'sheet', 'gmail'

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

  if (!isOpen) return null;


  // 1. Create Personal Google Sheet Tracker
  const handleCreateSheet = async () => {
    let currentUser = user;

    // Guard: Simulated tokens cannot call real Google APIs
    if (currentUser?.isSimulated || currentUser?.accessToken?.startsWith('simulated_')) {
      setSheetError('A real Google account sign-in is required to create a Google Sheet. Please configure a Google OAuth Client ID in settings, or sign in with a real Google account.');
      return;
    }

    if (!currentUser?.accessToken || currentUser.isTokenExpired) {
      try {
        currentUser = await requestGoogleAuthToken();
        setUser(currentUser);
      } catch (err) {
        setSheetError('Google Sign-In is required to create a spreadsheet. Please sign in with Google first.');
        return;
      }
    }

    setIsCreatingSheet(true);
    setSheetError('');
    setSheetMessage('');

    try {
      const result = await createPersonalJobTrackerSheet(currentUser.accessToken, activeProfile || currentUser);
      
      const updatedUser = {
        ...currentUser,
        spreadsheetId: result.spreadsheetId,
        spreadsheetUrl: result.spreadsheetUrl
      };
      setAuthenticatedUser(updatedUser);
      setUser(updatedUser);
      setSheetMessage(`Custom Job Tracker Sheet created successfully!`);

      // Automatically sync existing applications to the sheet
      if (jobs && jobs.length > 0) {
        setIsSyncingSheet(true);
        const syncRes = await syncAllApplicationsToSheet(
          currentUser.accessToken, 
          result.spreadsheetId, 
          jobs.filter(j => !j.status.toLowerCase().includes('package prepared') && !j.status.toLowerCase().includes('to submit')), 
          activeProfile || currentUser
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

  // 2. Sync all existing dashboard applications to the sheet
  const handleSyncToSheet = async () => {
    let currentUser = user;

    // Guard: Simulated tokens cannot call real Google APIs
    if (currentUser?.isSimulated || currentUser?.accessToken?.startsWith('simulated_')) {
      setSheetError('A real Google account sign-in is required to sync to Google Sheets. Please sign in with a real Google account.');
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
      const submittedJobs = jobs.filter(j => 
        !j.status.toLowerCase().includes('package prepared') && 
        !j.status.toLowerCase().includes('to submit')
      );
      const res = await syncAllApplicationsToSheet(currentUser.accessToken, currentUser.spreadsheetId, submittedJobs, activeProfile || currentUser);
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

    // Guard: Simulated tokens cannot call real Google APIs
    if (currentUser?.isSimulated || currentUser?.accessToken?.startsWith('simulated_')) {
      setGmailError('A real Google account sign-in with Gmail permissions is required to scan your inbox. Please configure a Google OAuth Client ID in settings.');
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
      const results = await scanGmailForApplications(currentUser.accessToken, 25);
      setGmailScanResults(results);
      if (results.length === 0) {
        setGmailSuccess('No new job application emails found in the recent inbox scan.');
      } else {
        setGmailSuccess(`Found ${results.length} application emails & confirmations!`);
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
                PERSONAL CLOUD INTEGRATION
              </div>
              <h2 className="text-xl font-black text-white">
                Google Sheets Tracker & Gmail Scanner
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
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 pt-2 font-mono text-xs font-bold gap-2">
          <button
            onClick={() => setActiveTab('sheet')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'sheet'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Table size={14} /> 📊 GOOGLE SHEET TRACKER
          </button>
          <button
            onClick={() => setActiveTab('gmail')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'gmail'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Mail size={14} /> 📥 GMAIL INBOX SCANNER
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
