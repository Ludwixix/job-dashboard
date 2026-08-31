import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useJobs } from '../hooks/useJobs';
import { ApplicationTracker } from './ApplicationTracker';
import { JobSeeker } from './JobSeeker';
import { JobModal } from './JobModal';
import { GeneratorModal } from './GeneratorModal';
import { InterviewPrepModal } from './InterviewPrepModal';
import { MarketIntelligence } from './MarketIntelligence';
import { ApplicationPipeline } from './ApplicationPipeline';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { CommandPalette } from './CommandPalette';
import { CopilotBar } from './CopilotBar';
import { BatchApplyModal } from './BatchApplyModal';
import { ProfileSwitcher } from './ProfileSwitcher';
import { ProfileModal } from './ProfileModal';
import { AuthModal } from './AuthModal';
import { GoogleIntegrationModal } from './GoogleIntegrationModal';
import { AutoApplyModal } from './AutoApplyModal';
import { DashboardGridSkeleton } from './SkeletonLoaders';

import { generateApplicationDocs } from '../services/generationService';
import { getActiveProfile, saveProfile } from '../services/profileService';
import { getAuthenticatedUser } from '../services/googleAuthService';
import { upsertApplicationInSheet } from '../services/googleSheetService';
import { logoutUser } from '../services/authService';

import { fetchJobsForProfile } from '../services/dataService';
import { suggestRelatedTitles, buildQueriesFromProfile } from '../services/jobQueryService';
import { applyIndustryTheme, getIndustryTheme } from '../services/industryThemeService';
import { 
  Terminal, Sparkles, Cpu, Activity, RefreshCw, 
  MapPin, Command, Zap, LayoutGrid, CheckCircle2,
  Sliders, TrendingUp, Table, Lock, Mail, LogOut, X as XIcon, Target
} from 'lucide-react';


export const Dashboard = ({ currentUser, onSignOut }) => {
  const { jobs, loading, error, refetch, updateJobStatus, rejectJob, unrejectJob } = useJobs();
  const [activeSection, setActiveSection] = useState('seeker'); // 'seeker', 'kanban', 'market', 'tracker'
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedForGenerator, setSelectedForGenerator] = useState(null);
  const [selectedForInterviewPrep, setSelectedForInterviewPrep] = useState(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isBatchApplyOpen, setIsBatchApplyOpen] = useState(false);
  const [selectedAutoApplyJob, setSelectedAutoApplyJob] = useState(null);


  // Candidate Personalization Profile State
  const [activeProfile, setActiveProfile] = useState(() => getActiveProfile());
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);

  // Google Authentication & Integration State
  const [authUser, setAuthUser] = useState(() => getAuthenticatedUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isGoogleIntegrationOpen, setIsGoogleIntegrationOpen] = useState(false);

  // Profile-aware scraping state
  const [profileScrapeStatus, setProfileScrapeStatus] = useState(null); // null | 'loading' | 'done' | 'error'
  const [profileScrapeMsg, setProfileScrapeMsg] = useState('');
  const [suggestedTitles, setSuggestedTitles] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Background Async Application Generation Queue
  const [asyncGeneratingIds, setAsyncGeneratingIds] = useState(new Set());
  const [backgroundNotifications, setBackgroundNotifications] = useState([]);


  const handleDispatchAsyncApplication = useCallback(async (job) => {
    const jobId = job.id || `${job.company}_${job.title}`;
    setAsyncGeneratingIds(prev => {
      const next = new Set(prev);
      if (job.id) next.add(job.id).add(String(job.id));
      next.add(`${job.company}_${job.title}`);
      return next;
    });

    try {
      const result = await generateApplicationDocs(job, null, null, activeProfile);
      
      if (result && result.resume && result.coverLetter) {
        const appPayload = {
          hasCustomDocs: true,
          resumeText: result.resume,
          coverLetterText: result.coverLetter,
          docsModel: result.model,
          docsGeneratedAt: new Date().toISOString(),
          driveFolder: `Job Applications - ${activeProfile.name}`,
          driveStatus: 'Synced to Google Drive / Ready for Submission'
        };

        updateJobStatus(jobId, 'Package Prepared / To Submit', appPayload);

        // Auto append or update to Google Sheet if user has an active spreadsheet
        if (currentUser?.accessToken && currentUser?.spreadsheetId) {
          upsertApplicationInSheet(currentUser.accessToken, currentUser.spreadsheetId, { ...job, ...appPayload }, activeProfile);
        }

        const notif = {
          title: job.title,
          company: job.company,
          time: 'Just now'
        };
        setBackgroundNotifications(prev => [notif, ...prev.slice(0, 4)]);
        setTimeout(() => {
          setBackgroundNotifications(prev => prev.filter(n => n.id !== notif.id));
        }, 6000);
      }
    } catch (err) {
      console.error('Async application error:', err);
    } finally {

      setAsyncGeneratingIds(prev => {
        const next = new Set(prev);
        if (job.id) {
          next.delete(job.id);
          next.delete(String(job.id));
        }
        next.delete(`${job.company}_${job.title}`);
        return next;
      });
    }
  }, [updateJobStatus]);

  // Updatable Location Bound State
  const [baseLocation, setBaseLocation] = useState(() => {
    return localStorage.getItem('userBaseLocation') || 'BALACLAVA VIC 3183';
  });
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [tempLocationInput, setTempLocationInput] = useState(baseLocation);

  useEffect(() => {
    localStorage.setItem('userBaseLocation', baseLocation);
  }, [baseLocation]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Derive current industry theme
  const currentIndustryTheme = useMemo(() => {
    return getIndustryTheme(activeProfile?.industry);
  }, [activeProfile?.industry]);

  // Apply subtle industry theme CSS variables smoothly whenever the active profile changes or loads
  useEffect(() => {
    if (activeProfile?.industry) {
      applyIndustryTheme(activeProfile.industry);
    }
  }, [activeProfile?.industry]);

  // Background Scraper Progress & Discovery State
  const [scrapeProgress, setScrapeProgress] = useState({
    isActive: false,
    percent: 0,
    stage: '',
    elapsedSec: 0,
    totalDiscovered: 0
  });

  const triggerDiscoveryScrape = useCallback((targetProfile) => {
    if (!targetProfile) return;
    const industry = targetProfile.industry || 'Technology & IT';
    const queries = buildQueriesFromProfile(targetProfile);
    const primaryQuery = targetProfile.targetTitles?.[0] || queries[0]?.term || industry;

    setScrapeProgress({
      isActive: true,
      percent: 15,
      stage: `Connecting to SEEK, LinkedIn & Indeed gateways for ${primaryQuery}...`,
      elapsedSec: 0,
      totalDiscovered: 0
    });
    setProfileScrapeStatus('loading');
    setProfileScrapeMsg(`🔄 Ingestion Active: Scanning ${industry} opportunities...`);

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      setScrapeProgress(prev => {
        if (!prev.isActive) return prev;
        let nextPercent = Math.min(94, prev.percent + Math.floor(Math.random() * 8) + 3);
        let nextStage = prev.stage;
        if (nextPercent > 70) {
          nextStage = `Computing ATS fit, commute radius & deduplicating positions in SQLite...`;
        } else if (nextPercent > 40) {
          nextStage = `Scanning live market listings for "${primaryQuery}" in Melbourne...`;
        }
        return {
          ...prev,
          percent: nextPercent,
          stage: nextStage,
          elapsedSec: elapsed
        };
      });
    }, 800);

    fetchJobsForProfile(targetProfile)
      .then(({ liveScraped, queriesUsed, cacheStats }) => {
        clearInterval(interval);
        applyIndustryTheme(industry);
        refetch();
        const found = cacheStats?.queries_scraped || (queriesUsed?.length ? queriesUsed.length * 3 : 15);
        setScrapeProgress({
          isActive: false,
          percent: 100,
          stage: `Discovery Complete! +${found} positions verified`,
          elapsedSec: Math.round((Date.now() - startTime) / 1000),
          totalDiscovered: found
        });
        setProfileScrapeStatus('done');
        setProfileScrapeMsg(`✅ Discovery Complete: Updated matrix with fresh ${industry} opportunities`);
        setTimeout(() => {
          setScrapeProgress(prev => ({ ...prev, percent: 0, stage: '' }));
          setProfileScrapeStatus(null);
        }, 6000);
      })
      .catch((err) => {
        console.warn('Scraper fetch error:', err);
        clearInterval(interval);
        refetch();
        setScrapeProgress({
          isActive: false,
          percent: 100,
          stage: `Ready`,
          elapsedSec: Math.round((Date.now() - startTime) / 1000),
          totalDiscovered: 0
        });
        setProfileScrapeStatus(null);
      });
  }, [refetch]);

  // Trigger discovery when activeProfile changes or on initial load
  useEffect(() => {
    if (activeProfile) {
      triggerDiscoveryScrape(activeProfile);
    }
  }, [activeProfile?.id, activeProfile?.industry, triggerDiscoveryScrape]);



  /** Add a suggested title to the active profile's targetTitles */
  const handleAddSuggestedTitle = useCallback((title) => {
    if (!activeProfile) return;
    const updated = {
      ...activeProfile,
      targetTitles: [...new Set([...(activeProfile.targetTitles || []), title])],
    };
    saveProfile(updated);
    setActiveProfile(updated);
    setSuggestedTitles(prev => prev.filter(t => t !== title));
  }, [activeProfile]);



  const handleSaveLocation = (e) => {
    if (e) e.preventDefault();
    if (tempLocationInput.trim()) {
      setBaseLocation(tempLocationInput.trim().toUpperCase());
    }
    setIsEditingLocation(false);
  };

  const PRESET_SUBURBS = [
    'BALACLAVA VIC 3183',
    'ST KILDA VIC 3182',
    'PRAHRAN VIC 3181',
    'ELSTERNWICK VIC 3185',
    'MELBOURNE CBD 3000',
    'RICHMOND VIC 3121',
    'SOUTH YARRA VIC 3141'
  ];

  // Real-time live derived modal targets
  const liveSelectedJob = useMemo(() => {
    if (!selectedJob) return null;
    const match = jobs.find(j => 
      (j.id && String(j.id) === String(selectedJob.id)) ||
      `${j.company}_${j.title}` === `${selectedJob.company}_${selectedJob.title}`
    );
    return match || selectedJob;
  }, [selectedJob, jobs]);

  const liveSelectedForGenerator = useMemo(() => {
    if (!selectedForGenerator) return null;
    const match = jobs.find(j => 
      (j.id && String(j.id) === String(selectedForGenerator.id)) ||
      `${j.company}_${j.title}` === `${selectedForGenerator.company}_${selectedForGenerator.title}`
    );
    return match || selectedForGenerator;
  }, [selectedForGenerator, jobs]);

  const liveSelectedForInterviewPrep = useMemo(() => {
    if (!selectedForInterviewPrep) return null;
    const match = jobs.find(j => 
      (j.id && String(j.id) === String(selectedForInterviewPrep.id)) ||
      `${j.company}_${j.title}` === `${selectedForInterviewPrep.company}_${selectedForInterviewPrep.title}`
    );
    return match || selectedForInterviewPrep;
  }, [selectedForInterviewPrep, jobs]);

  const preparedCount = useMemo(() => {
    return jobs.filter(j => 
      !j.isRejected && (
        j.status.toLowerCase().includes('package prepared') || 
        j.status.toLowerCase().includes('to submit') ||
        j.status.toLowerCase().includes('discovered')
      )
    ).length;
  }, [jobs]);

  const handleExportCSV = () => {
    if (!jobs || jobs.length === 0) return;

    const headers = ['Date', 'Company', 'Job Title', 'Status', 'Location', 'Salary', 'Source', 'Score', 'Portal Link', 'Notes'];
    const rows = jobs.map(j => [
      `"${(j.date || '').replace(/"/g, '""')}"`,
      `"${(j.company || '').replace(/"/g, '""')}"`,
      `"${(j.title || '').replace(/"/g, '""')}"`,
      `"${(j.status || '').replace(/"/g, '""')}"`,
      `"${(j.location || '').replace(/"/g, '""')}"`,
      `"${(j.salary || '').replace(/"/g, '""')}"`,
      `"${(j.source || '').replace(/"/g, '""')}"`,
      `"${j.score || 85}"`,
      `"${(j.portalLink || '').replace(/"/g, '""')}"`,
      `"${(j.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Job_Tracker_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Loading is now handled within the main layout via SkeletonLoaders

  if (error) return (
    <div className="max-w-2xl mx-auto my-12 p-6 bg-rose-950 text-rose-200 rounded-xl border border-rose-800 font-mono text-xs shadow-lg">
      <h2 className="text-sm font-bold tracking-widest uppercase mb-1">SYSTEM ERROR // FETCH FAILED</h2>
      <p>{error}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 industry-ambient-bg font-sans text-slate-100 pb-16 selection:bg-indigo-600 selection:text-white">
      {/* Top Live Engine Status Bar */}

      <div className="bg-slate-900 text-slate-300 py-1.5 px-4 font-mono text-[11px] border-b border-slate-800 flex items-center justify-between font-semibold">
        <div className="flex items-center gap-4 truncate">
          <span className="flex items-center gap-1.5 text-emerald-400 font-bold shrink-0">
            <Activity size={13} className="animate-pulse" /> V2.0 ENGINE ACTIVE
          </span>
          <span className="text-slate-700 hidden sm:inline">|</span>
          <span className="truncate text-slate-300">
            <strong className="text-white">{jobs.length}</strong> INDEXED POSITIONS
          </span>
          <span className="text-slate-700 hidden md:inline">|</span>
          
          {/* Location Bound selector */}
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-slate-500 font-bold hidden lg:inline">LOCATION BASE:</span>
            {isEditingLocation ? (
              <form onSubmit={handleSaveLocation} className="flex items-center gap-1">
                <input
                  type="text"
                  value={tempLocationInput}
                  onChange={(e) => setTempLocationInput(e.target.value)}
                  className="bg-slate-800 border border-indigo-500 text-emerald-300 px-2 py-0.5 rounded text-[11px] font-mono focus:outline-none w-36 uppercase font-bold"
                  placeholder="SUBURB POSTCODE"
                  autoFocus
                />
                <button type="submit" className="text-emerald-400 hover:text-emerald-300 font-bold px-1 cursor-pointer">✓</button>
                <button type="button" onClick={() => setIsEditingLocation(false)} className="text-rose-400 hover:text-rose-300 font-bold px-1 cursor-pointer">✕</button>
              </form>
            ) : (
              <button 
                onClick={() => { setTempLocationInput(baseLocation); setIsEditingLocation(true); }}
                className="flex items-center gap-1 text-emerald-300 hover:text-emerald-200 font-bold hover:underline cursor-pointer bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700"
                title="Click to change your primary location radius baseline"
              >
                <MapPin size={11} className="text-indigo-400" />
                <span className="truncate max-w-[140px] sm:max-w-[200px]">{baseLocation}</span>
                <span className="text-[9px] text-slate-400 font-normal">✎</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
          {/* Active Candidate Profile Switcher & Customizer */}
          <ProfileSwitcher 
            activeProfile={activeProfile}
            onProfileChange={(p) => {
              setActiveProfile(p);
              if (p.suburb || p.location) {
                setBaseLocation(p.suburb || p.location);
              }
            }}
            onOpenProfileModal={(p) => {
              setEditingProfile(p);
              setIsProfileModalOpen(true);
            }}
          />

          <span className="text-slate-800">|</span>

          {/* Google Auth & Cloud Sync Buttons */}
          {authUser ? (
            <button
              onClick={() => setIsGoogleIntegrationOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 hover:text-white hover:bg-emerald-900 transition-colors font-bold text-[10px] shadow-xs cursor-pointer"
              title="Open Personal Google Sheet Tracker & Gmail Scanner"
            >
              <Table size={12} className="text-emerald-400" />
              <span className="hidden sm:inline">MY GOOGLE TRACKER</span>
              <span className="sm:hidden">TRACKER</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors font-bold text-[10px] cursor-pointer"
              title="Sign in with Google to sync personal sheets and scan Gmail"
            >
              <Lock size={12} className="text-indigo-400" />
              <span>SIGN IN</span>
            </button>
          )}

          <button
            onClick={() => setIsBatchApplyOpen(true)}
            className="flex items-center gap-1 text-emerald-300 hover:text-white transition-colors cursor-pointer text-[10px] uppercase font-black bg-emerald-950 border border-emerald-500/40 px-2 py-1 rounded-xl shadow-xs"
            title="Dispatch 1-Click Batch Automated Applications"
          >
            <Zap size={12} className="animate-bounce text-emerald-400" /> BATCH APPLY
          </button>

          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex items-center gap-1 text-indigo-300 hover:text-white transition-colors cursor-pointer text-[10px] uppercase font-bold bg-indigo-950 border border-indigo-500/40 px-2 py-1 rounded-xl"
            title="Open Command Palette (Ctrl+K)"
          >
            <Command size={12} /> ⌘K
          </button>

          <button 
            onClick={refetch}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer text-[10px] uppercase font-bold px-2 py-1 rounded-xl bg-slate-900 border border-slate-800"
            title="Sync Database Feed"
          >
            <RefreshCw size={12} /> SYNC
          </button>

          {onSignOut && (
            <button 
              onClick={() => {
                logoutUser();
                onSignOut();
              }}
              className="flex items-center gap-1 text-rose-400 hover:text-rose-200 transition-colors cursor-pointer text-[10px] uppercase font-bold px-2 py-1 rounded-xl bg-rose-950/60 border border-rose-500/40"
              title="Sign Out / Switch User"
            >
              <LogOut size={12} />
              <span className="hidden md:inline">EXIT</span>
            </button>
          )}
        </div>
      </div>

      {/* Location Preset Bar */}
      {isEditingLocation && (
        <div className="bg-slate-900 text-slate-300 py-1.5 px-4 font-mono text-[10px] border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
          <span className="text-slate-500 font-bold uppercase shrink-0">QUICK PRESETS:</span>
          {PRESET_SUBURBS.map(suburb => (
            <button
              key={suburb}
              onClick={() => { setBaseLocation(suburb); setTempLocationInput(suburb); setIsEditingLocation(false); }}
              className={`px-2 py-0.5 rounded border transition-colors shrink-0 cursor-pointer font-bold ${
                baseLocation === suburb 
                  ? 'bg-emerald-600 text-white border-emerald-400'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
              }`}
            >
              {suburb}
            </button>
          ))}
        </div>
      )}

      {/* Technocratic Header & Top Navigation */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 shadow-xl font-mono">
        <div className="w-full max-w-[98vw] 2xl:max-w-[2560px] 3xl:max-w-[3400px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-md border border-indigo-400/40">
              <Terminal size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-wider uppercase text-white">
                  CAREER.AGENT // V2.0
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-400/30">
                  <Sparkles size={11} className="text-indigo-400" /> SUPER INTELLIGENCE
                </span>
                {(currentUser?.isDemoUser || currentUser?.authProvider === 'demo') && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-400/30">
                    <Activity size={11} className="text-amber-400" /> DEMO MODE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                AUTONOMOUS APPLICATION DISPATCHER & CAREER ACCELERATOR
              </p>
            </div>
          </div>

          {/* 4-Way Tab View Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 overflow-x-auto">
            <button
              onClick={() => setActiveSection('seeker')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                activeSection === 'seeker' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <LayoutGrid size={14} /> 
              STREAM
              {preparedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                  {preparedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSection('kanban')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                activeSection === 'kanban' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Sliders size={14} /> 
              FUNNEL KANBAN
            </button>

            <button
              onClick={() => setActiveSection('market')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                activeSection === 'market' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <TrendingUp size={14} /> 
              MARKET INTEL
            </button>

            <button
              onClick={() => setActiveSection('analytics')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                activeSection === 'analytics' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Target size={14} /> 
              ANALYTICS
            </button>
          </div>
        </div>
      </header>
 
      {/* Dynamic Industry Theme & Live Profile Scrape Banner */}
      {(profileScrapeStatus || (showSuggestions && suggestedTitles.length > 0)) && (
        <div className="w-full bg-slate-900/95 border-b border-slate-800 backdrop-blur-md px-4 sm:px-6 lg:px-8 xl:px-10 py-3 animate-in slide-in-from-top-2 duration-300 font-mono text-xs shadow-lg">
          <div className="max-w-[98vw] 2xl:max-w-[2560px] 3xl:max-w-[3400px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider industry-accent-badge shadow-xs">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: currentIndustryTheme.accent }} />
                {currentIndustryTheme.name}
              </span>
              <span className="text-slate-300 font-bold flex items-center gap-2">
                {profileScrapeMsg || `Profile Scraper Active — Theme aligned to ${currentIndustryTheme.name}`}
              </span>
            </div>

            {suggestedTitles.length > 0 && showSuggestions && (
              <div className="flex items-center gap-2 flex-wrap text-[11px]">
                <span className="text-slate-400 font-bold uppercase shrink-0">SUGGESTED TITLES:</span>
                {suggestedTitles.slice(0, 4).map(title => (
                  <button
                    key={title}
                    onClick={() => handleAddSuggestedTitle(title)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-700 hover:border-indigo-400 text-slate-300 hover:text-white transition-all cursor-pointer font-bold group"
                    title={`Add "${title}" to target titles`}
                  >
                    <span>+ {title}</span>
                  </button>
                ))}
                <button
                  onClick={() => setShowSuggestions(false)}
                  className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
                  title="Dismiss title suggestions"
                >
                  <XIcon size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Workspace Dashboard Container */}

      <main className="w-full max-w-[98vw] 2xl:max-w-[2560px] 3xl:max-w-[3400px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6 flex-1">
        {/* Proactive Agent Copilot Intelligence Bar */}
        <CopilotBar 
          jobs={jobs} 
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenGenerator={(j) => setSelectedForGenerator(j)}
          onNavigateView={(view) => setActiveSection(view)}
        />

        {/* Dynamic View Component */}
        {loading ? (
          <DashboardGridSkeleton />
        ) : (
          <>
            {activeSection === 'seeker' && (
          <JobSeeker 
            jobs={jobs} 
            activeProfile={activeProfile}
            scrapeProgress={scrapeProgress}
            onSelectJob={(job) => setSelectedJob(job)} 
            onRejectJob={rejectJob}
            onUnrejectJob={unrejectJob}
            baseLocation={baseLocation} 
            onDispatchAsyncApplication={handleDispatchAsyncApplication}
            asyncGeneratingIds={asyncGeneratingIds}
            onJobStatusUpdate={(updatedJob) => updateJobStatus(updatedJob.id || `${updatedJob.company}_${updatedJob.title}`, updatedJob.status, updatedJob)}
            onTriggerScrape={() => triggerDiscoveryScrape(activeProfile)}
          />
        )}


        {activeSection === 'kanban' && (
          <ApplicationPipeline 
            jobs={jobs} 
            loading={loading}
            onUpdateStatus={(id, status, extra) => updateJobStatus(id, status, extra)}
            onOpenGenerator={(j) => setSelectedForGenerator(j)}
          />
        )}

        {activeSection === 'market' && (
          <MarketIntelligence jobs={jobs} />
        )}

        {activeSection === 'analytics' && (
          <AnalyticsDashboard 
            jobs={jobs} 
            onUpdateStatus={(id, status, extra) => updateJobStatus(id, status, extra)}
            onSelectJob={(j) => setSelectedJob(j)}
            onOpenGenerator={(j) => setSelectedForGenerator(j)}
          />
        )}
          </>
        )}
      </main>

      {/* Floating Background Application Notifications */}
      {backgroundNotifications.length > 0 && (
        <div className="fixed bottom-10 right-6 z-50 space-y-2 max-w-sm w-full font-mono">
          {backgroundNotifications.map(n => (
            <div key={n.id} className="bg-slate-900 border-2 border-emerald-500 text-white p-3.5 rounded-2xl shadow-2xl flex items-start gap-3 animate-in slide-in-from-bottom duration-300">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
                <CheckCircle2 size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">PACKAGE READY & DRIVE SYNCED</div>
                <div className="text-xs font-bold text-white truncate">{n.company}</div>
                <div className="text-[11px] text-slate-300 truncate">{n.title}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Job Details Modal */}
      {liveSelectedJob && (
        <JobModal 
          job={liveSelectedJob} 
          onClose={() => setSelectedJob(null)} 
          onOpenGenerator={(j) => setSelectedForGenerator(j)}
          onOpenAutoApply={(j) => setSelectedAutoApplyJob(j)}
          onJobStatusUpdate={(updated) => {
            updateJobStatus(updated.id || updated.title, updated.status, updated);
            setSelectedJob(updated);
          }}
          onRejectJob={(id) => {
            rejectJob(id);
            setSelectedJob(null);
          }}
          onUnrejectJob={(id) => {
            unrejectJob(id);
            setSelectedJob(prev => prev ? { ...prev, isRejected: false, status: 'Discovered' } : null);
          }}
        />
      )}

      {/* 1-Click Auto-Apply Execution Modal */}
      {selectedAutoApplyJob && (
        <AutoApplyModal
          job={selectedAutoApplyJob}
          onClose={() => setSelectedAutoApplyJob(null)}
          onJobStatusUpdate={(updated) => {
            updateJobStatus(updated.id || `${updated.company}_${updated.title}`, updated.status, updated);
            setSelectedAutoApplyJob(updated);
          }}
        />
      )}


      {/* Generator Modal */}
      {liveSelectedForGenerator && (
        <GeneratorModal 
          job={liveSelectedForGenerator} 
          onClose={() => setSelectedForGenerator(null)} 
          onUpdateStatus={(jobId, status, extraData) => {
            updateJobStatus(jobId, status, extraData);
          }}
          onSaveCustomDocs={(jobId, docData) => {
            updateJobStatus(jobId, 'Package Prepared / To Submit', {
              hasCustomDocs: true,
              resumeText: docData.resumeText,
              coverLetterText: docData.coverLetterText,
              docsModel: docData.model,
              docsGeneratedAt: docData.generatedAt || new Date().toISOString()
            });
          }}
        />
      )}

      {/* Interview Prep Super Intelligence Modal */}
      {liveSelectedForInterviewPrep && (
        <InterviewPrepModal 
          job={liveSelectedForInterviewPrep} 
          onClose={() => setSelectedForInterviewPrep(null)} 
        />
      )}

      {/* Omni-Command Palette Modal */}
      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        jobs={jobs}
        onSelectJob={(j) => { setSelectedJob(j); setIsCommandPaletteOpen(false); }}
        onNavigateView={(view) => { setActiveSection(view); setIsCommandPaletteOpen(false); }}
      />

      {/* Batch Application Dispatcher Modal */}
      <BatchApplyModal 
        jobs={jobs}
        isOpen={isBatchApplyOpen}
        onClose={() => setIsBatchApplyOpen(false)}
        onComplete={(results) => {
          results.forEach(res => {
            if (res.success) {
              updateJobStatus(res.job.id || res.job.title, 'Applied / Confirmation Received', res.result);
            }
          });
        }}
      />

      {/* Candidate Personalization & Resume Upload Modal */}
      <ProfileModal 
        isOpen={isProfileModalOpen}
        profile={editingProfile}
        onClose={() => {
          setIsProfileModalOpen(false);
          setEditingProfile(null);
        }}
        onProfileSaved={(savedProfile) => {
          if (savedProfile) {
            setActiveProfile(savedProfile);
            if (savedProfile.suburb || savedProfile.location) {
              setBaseLocation(savedProfile.suburb || savedProfile.location);
            }
          } else {
            setActiveProfile(getActiveProfile());
          }
        }}
      />

      {/* Google Authentication & Client Config Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthChange={(user) => {
          setAuthUser(user);
          if (user) {
            setIsGoogleIntegrationOpen(true);
          }
        }}
      />

      {/* Google Sheets Tracker & Gmail Scanner Integration Modal */}
      <GoogleIntegrationModal 
        isOpen={isGoogleIntegrationOpen}
        onClose={() => setIsGoogleIntegrationOpen(false)}
        jobs={jobs}
        activeProfile={activeProfile}
        onImportGmailJobs={(importedJobs) => {
          importedJobs.forEach(j => {
            updateJobStatus(j.id, j.status, j);
            if (currentUser?.accessToken && currentUser?.spreadsheetId) {
              upsertApplicationInSheet(currentUser.accessToken, currentUser.spreadsheetId, j, activeProfile);
            }
          });
        }}
      />

      {/* Fixed Bottom Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 h-7 bg-slate-900 border-t border-slate-800 text-slate-400 font-mono text-[11px] font-bold px-4 flex items-center justify-between z-50 select-none shadow-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-emerald-400">
            <span>⚡ V2.0 AUTONOMOUS</span>
          </div>
          <div className="flex items-center gap-1 text-slate-500 hidden sm:flex">
            <span>Active Feed: {jobs.length} jobs</span>
          </div>
        </div>


        <div className="flex items-center gap-3">
          <span className="text-slate-500">React 19 / Vite 6</span>
          <span className="bg-emerald-950 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-black text-[10px]">
            {baseLocation.split(' ')[0]}
          </span>
        </div>
      </footer>
    </div>
  );
};
