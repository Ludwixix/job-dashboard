import React, { useState, useMemo, useEffect } from 'react';
import { TableView } from './TableView';
import { KanbanView } from './KanbanView';
import { MetricsPanel } from './MetricsPanel';
import { 
  LayoutList, Kanban, Search, BarChart2,
  CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronUp, RotateCcw,
  Send, Calendar, ArrowUpRight, Mail, RefreshCw, Sparkles, Check, Lock
} from 'lucide-react';
import { parseISO, isValid, differenceInDays } from 'date-fns';
import { 
  isValidTrackerJob, 
  scanGmailForApplicationUpdates, 
  fetchUserApplicationsFromBackend, 
  syncApplicationsToBackend 
} from '../services/trackerService';
import { formatJobPostedAge } from '../utils/dateUtils';

const getJobTimestamp = (job) => {
  if (job.appliedDate) {
    const t = new Date(job.appliedDate).getTime();
    if (!isNaN(t)) return t;
  }
  if (job.statusUpdatedAt) {
    const t = new Date(job.statusUpdatedAt).getTime();
    if (!isNaN(t)) return t;
  }
  if (job.date) {
    const t = new Date(job.date).getTime();
    if (!isNaN(t)) return t;
  }
  if (job.created_at) {
    const t = new Date(job.created_at).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
};

export const ApplicationTracker = ({ jobs = [], onSelectJob }) => {
  const [viewMode, setViewMode] = useState('table');
  const [showMetricsPanel, setShowMetricsPanel] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [appliedDateFilter, setAppliedDateFilter] = useState('all'); // 'all' (DEFAULT: most recent first), 'today', '7days', '30days'
  
  // Gmail targeted status tracking state
  const [isScanningGmail, setIsScanningGmail] = useState(false);
  const [showGmailModal, setShowGmailModal] = useState(false);
  const [gmailUsername, setGmailUsername] = useState(() => localStorage.getItem('gmail_scanner_username') || 'sam.ludwig@gmail.com');
  // Ephemeral: collected at scan-time only, never stored in localStorage
  const [gmailAppPassword, setGmailAppPassword] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [isSyncingBackend, setIsSyncingBackend] = useState(false);

  // Clean up legacy plaintext app password from localStorage if present
  useEffect(() => {
    localStorage.removeItem('gmail_scanner_app_password');
  }, []);

  // Hydrate from and sync to backend on mount
  useEffect(() => {
    const syncWithBackend = async () => {
      setIsSyncingBackend(true);
      try {
        const validLocal = (jobs || []).filter(isValidTrackerJob);
        if (validLocal.length > 0) {
          await syncApplicationsToBackend(validLocal);
        }
        await fetchUserApplicationsFromBackend();
      } catch (e) {
        console.warn('Initial backend sync non-blocking warning:', e);
      } finally {
        setIsSyncingBackend(false);
      }
    };
    syncWithBackend();
  }, []);

  const handleExecuteGmailScan = async () => {
    if (!gmailUsername || !gmailAppPassword) {
      alert('Please enter your Gmail address and 16-character Google App Password.');
      return;
    }
    setIsScanningGmail(true);
    setScanResult(null);

    try {
      localStorage.setItem('gmail_scanner_username', gmailUsername);
      // Security fix: never persist the Gmail app password in localStorage

      const res = await scanGmailForApplicationUpdates({
        username: gmailUsername,
        appPassword: gmailAppPassword,
        days: 14
      });

      setScanResult(res);
      if (res && res.updates_count > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('jobs-updated'));
      }
    } catch (err) {
      alert(`Gmail status scan failed: ${err.message}`);
    } finally {
      // Discard password from memory after scan completion
      setGmailAppPassword('');
      setIsScanningGmail(false);
    }
  };

  // Recently Applied Submissions list (Sorted newest first)
  const recentlyAppliedJobs = useMemo(() => {
    return (jobs || [])
      .filter(isValidTrackerJob)
      .sort((a, b) => getJobTimestamp(b) - getJobTimestamp(a))
      .slice(0, 15);
  }, [jobs]);

  // Applied Today Count
  const appliedTodayCount = useMemo(() => {
    return (jobs || []).filter(j => {
      const isTrackerJob = isValidTrackerJob(j);
      const isToday = formatJobPostedAge(j.date) === 'Today' || (j.date && j.date.startsWith(new Date().toISOString().split('T')[0]));
      return isTrackerJob && isToday;
    }).length;
  }, [jobs]);


  // Interactive status category & date filtering (Default newest applications first)
  const trackerJobs = useMemo(() => {
    return (jobs || [])
      .filter(job => {
        if (!isValidTrackerJob(job)) return false;

        const s = (job.status || '').toLowerCase();
        const matchesSearch = (job.company || '').toLowerCase().includes(search.toLowerCase()) || 
                              (job.title || '').toLowerCase().includes(search.toLowerCase());
        
        let matchesStatus = true;
        if (statusFilter !== 'All') {
          const f = statusFilter.toLowerCase();
          if (f.includes('interview')) {
            matchesStatus = s.includes('interview');
          } else if (f.includes('offer')) {
            matchesStatus = s.includes('offer');
          } else if (f.includes('action required') || f.includes('verification')) {
            matchesStatus = s.includes('action required') || s.includes('verification');
          } else if (f.includes('closed') || f.includes('expired') || f.includes('unsuccessful') || f.includes('non-responsive')) {
            matchesStatus = s.includes('closed') || s.includes('expired') || s.includes('unsuccessful') || s.includes('non-responsive');
          } else {
            matchesStatus = job.status === statusFilter;
          }
        }

        const matchesSource = sourceFilter === 'All' || job.source === sourceFilter;

        // Date Applied Filter (Default: All or Today)
        let matchesDate = true;
        if (appliedDateFilter === 'today') {
          matchesDate = formatJobPostedAge(job.date) === 'Today' || (job.date && job.date.startsWith(new Date().toISOString().split('T')[0]));
        } else if (appliedDateFilter === '7days') {
          try {
            const d = parseISO(job.date);
            matchesDate = isValid(d) && differenceInDays(new Date(), d) <= 7;
          } catch {
            matchesDate = true;
          }
        } else if (appliedDateFilter === '30days') {
          try {
            const d = parseISO(job.date);
            matchesDate = isValid(d) && differenceInDays(new Date(), d) <= 30;
          } catch {
            matchesDate = true;
          }
        }

        return matchesSearch && matchesStatus && matchesSource && matchesDate;
      })
      .sort((a, b) => getJobTimestamp(b) - getJobTimestamp(a));
  }, [jobs, search, statusFilter, sourceFilter, appliedDateFilter]);

  const trackerStats = useMemo(() => {
    const valid = (jobs || []).filter(isValidTrackerJob);
    const totalSubmitted = valid.length;
    const interviews = valid.filter(j => (j.status || '').toLowerCase().includes('interview')).length;
    const offers = valid.filter(j => (j.status || '').toLowerCase().includes('offer')).length;
    
    const actionRequired = valid.filter(j => 
      (j.status || '').toLowerCase().includes('action required') || 
      (j.status || '').toLowerCase().includes('verification')
    ).length;

    const underReview = valid.filter(j => {
      const s = (j.status || '').toLowerCase();
      return s.includes('applied') || s.includes('review') || s.includes('confirmation');
    }).length;

    const unsuccessful = valid.filter(j => {
      const s = (j.status || '').toLowerCase();
      return s.includes('unsuccessful') || s.includes('closed') || s.includes('expired') || s.includes('non-responsive');
    }).length;

    return {
      totalSubmitted,
      interviews,
      offers,
      actionRequired,
      underReview,
      unsuccessful
    };
  }, [jobs]);

  const trackerStatuses = useMemo(() => {
    const s = new Set(jobs
      .filter(j => !j.status.toLowerCase().includes('package prepared') && !j.status.toLowerCase().includes('to submit'))
      .map(j => j.status)
      .filter(Boolean)
    );
    return ['All', ...Array.from(s)];
  }, [jobs]);

  const trackerSources = useMemo(() => {
    const s = new Set(jobs.map(j => j.source).filter(Boolean));
    return ['All', ...Array.from(s)];
  }, [jobs]);

  const toggleCategoryFilter = (targetCategory) => {
    if (statusFilter.toLowerCase().includes(targetCategory.toLowerCase())) {
      setStatusFilter('All');
    } else {
      setStatusFilter(targetCategory);
    }
  };

  const isInterviewActive = statusFilter.toLowerCase().includes('interview');
  const isActionActive = statusFilter.toLowerCase().includes('action required') || statusFilter.toLowerCase().includes('verification');
  const isAllActive = statusFilter === 'All';

  return (
    <div className="space-y-6 font-sans text-slate-100">
      {/* Interactive Status Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        {/* Submitted Card */}
        <div 
          onClick={() => setStatusFilter('All')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            isAllActive 
              ? 'bg-[#1e1e2e] text-white border-purple-400 shadow-md ring-2 ring-purple-500/30' 
              : 'bg-[#181825] text-slate-300 border-[#313244] hover:border-purple-400/50 shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded ${isAllActive ? 'bg-purple-600 text-white' : 'bg-purple-950 text-purple-300'}`}>
              <Clock size={16} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">SUBMITTED</div>
              <div className="text-xl font-black text-white">{trackerStats.totalSubmitted}</div>
            </div>
          </div>
        </div>

        {/* Interviews Card */}
        <div 
          onClick={() => toggleCategoryFilter('Interview')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            isInterviewActive 
              ? 'bg-emerald-950 text-white border-emerald-400 shadow-md ring-2 ring-emerald-500/30' 
              : 'bg-[#181825] text-slate-300 border-[#313244] hover:border-emerald-400/50 shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded ${isInterviewActive ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-emerald-950 text-emerald-300'}`}>
              <CheckCircle2 size={16} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">INTERVIEWS</div>
              <div className="text-xl font-black text-emerald-300">{trackerStats.interviews}</div>
            </div>
          </div>
        </div>

        {/* Action Required Card */}
        <div 
          onClick={() => toggleCategoryFilter('Action Required')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            isActionActive 
              ? 'bg-amber-950 text-white border-amber-400 shadow-md ring-2 ring-amber-500/30' 
              : 'bg-[#181825] text-slate-300 border-[#313244] hover:border-amber-400/50 shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded ${isActionActive ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-amber-950 text-amber-300'}`}>
              <AlertCircle size={16} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">ACTION REQD</div>
              <div className="text-xl font-black text-amber-300">{trackerStats.actionRequired}</div>
            </div>
          </div>
        </div>

        {/* Closed Card */}
        <div 
          onClick={() => toggleCategoryFilter('Closed')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all bg-[#181825] text-slate-300 border-[#313244] hover:border-slate-500 shadow-2xs`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-slate-900 text-slate-400">
              <Clock size={16} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">CLOSED / OTHER</div>
              <div className="text-xl font-black text-slate-400">{trackerStats.unsuccessful}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Category Banner */}
      {!isAllActive && (
        <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-400/40 text-xs font-mono font-bold text-purple-200 flex items-center justify-between animate-in fade-in duration-200">
          <span>ACTIVE CATEGORY FILTER: <span className="text-purple-300 uppercase">{statusFilter}</span></span>
          <button
            onClick={() => setStatusFilter('All')}
            className="inline-flex items-center gap-1 text-[11px] text-purple-300 hover:text-white underline cursor-pointer"
          >
            <RotateCcw size={12} /> Reset Filter
          </button>
        </div>
      )}

      {/* 2-Column Application Tracker Layout (Left Recently Applied Sidebar + Right Content) */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        {/* LEFT COLUMN: RECENTLY APPLIED SIDEBAR */}
        <aside className="w-full lg:w-80 shrink-0 space-y-3 font-mono">
          <div className="bg-[#181825] rounded-2xl p-4 border border-[#313244] shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-[#313244] pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-purple-500/20 text-purple-300 border border-purple-400/30">
                  <Send size={15} className="text-purple-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xs text-white uppercase tracking-wider">
                    RECENTLY APPLIED
                  </h3>
                  <div className="text-[9px] text-slate-400 font-bold">DISPATCHED SUBMISSIONS</div>
                </div>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-purple-600 text-white">
                {recentlyAppliedJobs.length}
              </span>
            </div>

            {/* List of Recently Applied Cards */}
            <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
              {recentlyAppliedJobs.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 font-mono">
                  No submissions logged yet.
                </div>
              ) : (
                recentlyAppliedJobs.map(job => {
                  const daysAgoStr = formatJobPostedAge(job.date);
                  const isInterview = (job.status || '').toLowerCase().includes('interview');
                  const isConfirmation = (job.status || '').toLowerCase().includes('confirmation') || (job.status || '').toLowerCase().includes('applied');

                  return (
                    <div
                      key={job.id || `${job.company}_${job.title}`}
                      onClick={() => onSelectJob && onSelectJob(job)}
                      className="p-3 rounded-xl bg-[#1e1e2e] border border-[#313244] hover:border-purple-400/60 transition-all cursor-pointer group hover:shadow-md space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-black text-white truncate group-hover:text-purple-300 transition-colors">
                            {job.title}
                          </div>
                          <div className="text-[11px] font-bold text-slate-400 truncate">
                            {job.company}
                          </div>
                        </div>
                        <ArrowUpRight size={14} className="text-slate-500 group-hover:text-purple-400 shrink-0 transition-colors" />
                      </div>

                      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-[#313244]/80">
                        <span className={`px-2 py-0.5 rounded font-extrabold ${
                          isInterview 
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                            : isConfirmation
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-400/40'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {job.status}
                        </span>

                        <span className="text-slate-400 font-bold flex items-center gap-1">
                          <Calendar size={10} className="text-purple-400" />
                          {daysAgoStr}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN: MAIN TRACKER CONTENT */}
        <div className="flex-1 space-y-6 w-full">
          {/* Detailed Metrics Panel Toggle & Gmail Targeted Scanner Trigger */}
          <div className="flex flex-wrap items-center justify-between gap-3 font-mono">
            <button
              onClick={() => setShowGmailModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-md hover:shadow-purple-500/25 transition-all cursor-pointer"
            >
              {isScanningGmail ? <RefreshCw size={14} className="animate-spin text-white" /> : <Sparkles size={14} className="text-white" />}
              {isScanningGmail ? "SCANNING GMAIL INBOX..." : "⚡ SCAN GMAIL FOR APPLICATION UPDATES"}
            </button>

            <button
              onClick={() => setShowMetricsPanel(!showMetricsPanel)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#181825] border border-[#313244] text-xs font-bold text-slate-200 hover:text-purple-300 hover:border-purple-400/50 transition-colors cursor-pointer"
            >
              <BarChart2 size={14} className="text-purple-400" />
              {showMetricsPanel ? "HIDE ADVANCED ANALYTICS" : "SHOW ADVANCED ANALYTICS"}
              {showMetricsPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {/* Scan Results Notification Banner */}
          {scanResult && (
            <div className="p-4 rounded-xl bg-purple-950/70 border border-purple-400/50 font-mono text-xs text-purple-100 shadow-md space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-white flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  GMAIL TARGETED SCAN COMPLETE
                </span>
                <button onClick={() => setScanResult(null)} className="text-slate-400 hover:text-white text-[11px] underline cursor-pointer">
                  Dismiss
                </button>
              </div>
              <div className="text-slate-300">
                Scanned <span className="font-bold text-white">{scanResult.scanned_count}</span> active applications. Found <span className="font-bold text-emerald-300">{scanResult.updates_count}</span> status transitions in your inbox.
              </div>
              {scanResult.updates && scanResult.updates.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {scanResult.updates.map((u, i) => (
                    <div key={i} className="p-2 rounded bg-[#181825] border border-purple-500/30 flex items-center justify-between text-[11px]">
                      <span className="font-bold text-white truncate max-w-xs">{u.email_subject || 'Recruiter Communication'}</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-extrabold">{u.new_status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Gmail Credentials Configuration Modal */}
          {showGmailModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs font-mono animate-in fade-in">
              <div className="bg-[#181825] border border-[#313244] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-[#313244] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      <Mail size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-white">TARGETED GMAIL APPLICATION SCANNER</h3>
                      <p className="text-[10px] text-slate-400">Zero-spam intelligence scanner matching company & ATS threads</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowGmailModal(false)}
                    className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">GMAIL ADDRESS</label>
                    <input
                      type="email"
                      value={gmailUsername}
                      onChange={(e) => setGmailUsername(e.target.value)}
                      placeholder="your.email@gmail.com"
                      className="w-full px-3 py-2 rounded bg-[#1e1e2e] border border-[#313244] text-white focus:outline-none focus:border-purple-400 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      GOOGLE APP PASSWORD (16-CHARACTERS)
                    </label>
                    <input
                      type="password"
                      value={gmailAppPassword}
                      onChange={(e) => setGmailAppPassword(e.target.value)}
                      placeholder="abcd efgh ijkl mnop"
                      className="w-full px-3 py-2 rounded bg-[#1e1e2e] border border-[#313244] text-white focus:outline-none focus:border-purple-400 text-xs"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Generated at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-purple-400 underline">myaccount.google.com/apppasswords</a>. App password is kept in memory only for this scan and discarded immediately afterward.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#313244]">
                  <button
                    onClick={() => setShowGmailModal(false)}
                    className="px-4 py-2 rounded bg-[#1e1e2e] hover:bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={() => {
                      setShowGmailModal(false);
                      handleExecuteGmailScan();
                    }}
                    disabled={isScanningGmail}
                    className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-md cursor-pointer flex items-center gap-2"
                  >
                    {isScanningGmail ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    START TARGETED SCAN
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Metrics Panel */}
          {showMetricsPanel && (
            <MetricsPanel jobs={jobs} />
          )}

          {/* Control Bar: View Toggle & Search/Filter */}
          <div className="bg-[#181825] p-4 rounded-xl border border-[#313244] shadow-2xs flex flex-col sm:flex-row gap-4 justify-between items-center font-mono">
            <div className="flex items-center space-x-1 bg-[#1e1e2e] p-1 rounded-lg border border-[#313244] w-full sm:w-auto">
              <button 
                onClick={() => setViewMode('table')}
                className={`flex-1 sm:flex-none flex items-center justify-center px-3.5 py-1.5 rounded text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  viewMode === 'table' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutList size={14} className="mr-1.5" /> TABLE VIEW
              </button>
              <button 
                onClick={() => setViewMode('kanban')}
                className={`flex-1 sm:flex-none flex items-center justify-center px-3.5 py-1.5 rounded text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  viewMode === 'kanban' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Kanban size={14} className="mr-1.5" /> KANBAN BOARD
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1 max-w-2xl">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-2.5 text-purple-400" />
                <input
                  type="text"
                  placeholder="SEARCH SUBMITTED JOBS..."
                  className="w-full pl-9 pr-3 py-1.5 border border-[#313244] rounded bg-[#1e1e2e] text-xs font-mono font-semibold text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-400"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  className="px-3 py-1.5 text-xs font-mono font-extrabold border border-purple-500/50 rounded bg-[#1e1e2e] text-purple-300 focus:outline-none focus:border-purple-400 cursor-pointer shadow-xs"
                  value={appliedDateFilter}
                  onChange={(e) => setAppliedDateFilter(e.target.value)}
                >
                  <option value="today">📅 APPLIED TODAY ({appliedTodayCount})</option>
                  <option value="7days">📅 PAST 7 DAYS</option>
                  <option value="30days">📅 PAST 30 DAYS</option>
                  <option value="all">📅 ALL-TIME SUBMISSIONS ({trackerStats.totalSubmitted})</option>
                </select>

                <select
                  className="px-3 py-1.5 text-xs font-mono font-extrabold border border-[#313244] rounded bg-[#1e1e2e] text-slate-200 focus:outline-none focus:border-purple-400 cursor-pointer"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {trackerStatuses.map(s => <option key={s} value={s}>{s === 'All' ? 'ALL STATUSES' : s.toUpperCase()}</option>)}
                </select>

                <select
                  className="px-3 py-1.5 text-xs font-mono font-extrabold border border-[#313244] rounded bg-[#1e1e2e] text-slate-200 focus:outline-none focus:border-purple-400 cursor-pointer"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                >
                  {trackerSources.map(s => <option key={s} value={s}>{s === 'All' ? 'ALL SOURCES' : s.toUpperCase()}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Active Applied Date Filter Info Banner */}
          {appliedDateFilter !== 'all' && (
            <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs font-mono font-bold text-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Calendar size={14} className="text-indigo-400" />
                <span>FILTERING: <span className="text-white uppercase">{appliedDateFilter === 'today' ? 'APPLIED TODAY (DEFAULT)' : `PAST ${appliedDateFilter}`}</span> — {trackerJobs.length} application{trackerJobs.length === 1 ? '' : 's'}</span>
              </span>
              <button
                onClick={() => setAppliedDateFilter('all')}
                className="text-[11px] text-indigo-300 hover:text-white underline cursor-pointer self-start sm:self-auto"
              >
                Show All-Time Applications ({trackerStats.totalSubmitted})
              </button>
            </div>
          )}

          {/* Main View Display */}
          {viewMode === 'table' ? (
            <TableView 
              jobs={trackerJobs} 
              onSelectJob={onSelectJob} 
              onResetDateFilter={() => setAppliedDateFilter('all')}
            />
          ) : (
            <KanbanView jobs={trackerJobs} statuses={trackerStatuses} onSelectJob={onSelectJob} />
          )}
        </div>
      </div>
    </div>
  );
};
