import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { useToast } from './ToastContext';
import { useJobs } from '../hooks/useJobs';
import { useDashboardState, RouteSync } from '../hooks/useDashboardState';
import { useScrapeOrchestrator } from '../hooks/useScrapeOrchestrator';
import { JobSeeker } from './JobSeeker';
import { MarketIntelligence } from './MarketIntelligence';
import { ActionHighlights } from './ActionHighlights';
import { CopilotBar } from './CopilotBar';
import { ProfileSwitcher } from './ProfileSwitcher';
import { SafeErrorBoundary } from './SafeErrorBoundary';
import { DashboardGridSkeleton } from './SkeletonLoaders';
import PrimeTargetSpotlight from './PrimeTargetSpotlight';
import { CareerOperations } from './CareerOperations';
import { TelemetryDesk } from './TelemetryDesk';
import { DashboardModals } from './dashboard/DashboardModals';

import { ApplicationPipeline } from './ApplicationPipeline';
const AnalyticsDashboard = lazy(() => import('./AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));
const CyberpunkAmbientMode = lazy(() => import('./CyberpunkAmbientMode'));

import { startAutopilot } from '../services/autopilotAgent';
import { generateApplicationDocs } from '../services/generationService';
import { getAuthenticatedUser } from '../services/googleAuthService';
import { upsertApplicationInSheet } from '../services/googleSheetService';
import { logoutUser } from '../services/authService';
import { recordJobInteraction, evolveProfileFromLearnedContext } from '../services/profileLearningEngine';

import {
  Terminal, Sparkles, Activity, RefreshCw,
  MapPin, Command, Zap, LayoutGrid, CheckCircle2,
  Sliders, TrendingUp, Table, Lock, LogOut, X as XIcon, Target, CalendarClock, Settings, Users, Compass, Globe,
  ChevronDown, Layers, Award, FileText, Mic, Menu, ShieldAlert, ArrowRight, Crown
} from 'lucide-react';

// Lazy-load remote roles tab section to eliminate initial bundle bloat
const RemoteRolesSection = lazy(() => import('./RemoteRolesSection').then(m => ({ default: m.RemoteRolesSection })));

/**
 * Primary Application Dashboard view and operations console.
 * Coordinates user opportunities, active personalization profile, background scraping telemetry,
 * and AI application synthesis pipelines.
 *
 * @param {Object} props
 * @param {Object|null} props.currentUser - Authenticated Google or local developer session.
 * @param {Function|null} props.onSignOut - Sign out handler.
 * @returns {React.ReactElement}
 */
export const Dashboard = ({ currentUser, onSignOut }) => {
  const { jobs, loading, error, refetch, updateJobStatus, rejectJob, unrejectJob } = useJobs();
  const { addToast } = useToast();
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  // Helper: announce dynamic changes to screen readers
  const announce = useCallback((msg) => {
    setLiveAnnouncement('');
    setTimeout(() => setLiveAnnouncement(msg), 50);
  }, []);

  // Top-level Dashboard State Hook (Navigation, Profile, Billing, Modal State)
  const dashboardState = useDashboardState({
    jobs,
    currentUser,
    addToast,
  });

  const {
    activeSection,
    setActiveSection,
    activeProfile,
    setActiveProfile,
    editingProfile,
    setEditingProfile,
    profileCompleteness,
    isCompletenessDismissed,
    setIsCompletenessDismissed,
    handleAddSuggestedTitle,
    billingStatus,
    setIsPricingModalOpen,
    viewMode,
    setViewMode,
    spendSummary,
    overdueTouchpointCount,
    fallbackBanner,
    setFallbackBanner,
    isWorkforceEnabled,
    setIsWorkforceModalOpen,
    currentIndustryTheme,
    isToolsMenuOpen,
    setIsToolsMenuOpen,
    isMobileDrawerOpen,
    setIsMobileDrawerOpen,
    toolsMenuRef,
    setSelectedJob,
    setSelectedForGenerator,
    setSelectedForInterviewPrep,
    setSelectedForMockInterview,
    setSelectedForOutreach,
    setSelectedForOfferHub,
    setSelectedForDossier,
    setSelectedForCheatSheet,
    setSelectedForRecruiterCrm,
    setIsRecruiterCrmOpen,
    setIsFunnelModalOpen,
    setIsCareerModalOpen,
    setIsPdfStudioOpen,
    setIsScoringTunerOpen,
    setIsVoiceInterviewOpen,
    setIsCommandPaletteOpen,
    setIsBatchApplyOpen,
    setIsCustomJobModalOpen,
    setIsProfileModalOpen,
    setIsSettingsOpen,
    setIsSkillGapModalOpen,
    setIsCompareModalOpen,
    setCompareJobs,
    setIsSourceSelfHealOpen,
    setSelfHealSource,
    setIsAuthModalOpen,
    setIsGoogleIntegrationOpen,
    modalState,
  } = dashboardState;

  // Scrape Telemetry & Ingestion Orchestrator Hook
  const {
    scrapeProgress,
    profileScrapeStatus,
    profileScrapeMsg,
    triggerDiscoveryScrape,
  } = useScrapeOrchestrator({
    activeProfile,
    currentUser,
    billingStatus,
    refetch,
  });

  // Interactive Scoring Tuner Weights & Handler (BUG 2 FIX: Uses refetch() gracefully)
  const [activeScoringWeights, setActiveScoringWeights] = useState(null);

  const handleApplyCustomWeights = useCallback((_recalculatedJobs, weights) => {
    setActiveScoringWeights(weights);
    if (typeof refetch === 'function') {
      refetch();
    }
    if (addToast) addToast('Custom scoring matrix applied across all opportunities', 'success');
  }, [addToast, refetch]);

  // Google Authentication state
  const [authUser, setAuthUser] = useState(() => getAuthenticatedUser());

  // Suggestions state
  const [suggestedTitles] = useState([]);
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
          driveFolder: `Job Applications - ${activeProfile?.name || 'Candidate'}`,
          driveStatus: 'Synced to Google Drive / Ready for Submission',
        };

        if (updateJobStatus) updateJobStatus(jobId, 'Package Prepared / To Submit', appPayload);

        // Train Profile Learning Engine with synthesized application
        try {
          recordJobInteraction(job, 'generated_docs', activeProfile);
          const evolved = evolveProfileFromLearnedContext(activeProfile, { threshold: 3 });
          if (evolved && evolved.coreSkills?.length > (activeProfile?.coreSkills?.length || 0)) {
            if (setActiveProfile) setActiveProfile(evolved);
            if (addToast) addToast(`Profile evolved! Learned: ${evolved.coreSkills.slice(-1)[0]}`, 'info');
          }
        } catch (e) {
          console.warn('Profile learning note:', e);
        }

        // Auto append or update to Google Sheet if user has an active spreadsheet
        if (currentUser?.accessToken && currentUser?.spreadsheetId) {
          upsertApplicationInSheet(currentUser.accessToken, currentUser.spreadsheetId, { ...job, ...appPayload }, activeProfile);
        }

        const notif = {
          id: `${jobId}_${Date.now()}`,
          title: job.title,
          company: job.company,
          time: 'Just now',
        };
        setBackgroundNotifications(prev => [notif, ...prev.slice(0, 4)]);
        setTimeout(() => {
          setBackgroundNotifications(prev => prev.filter(n => n.id !== notif.id));
        }, 6000);
        if (addToast) addToast(`Package ready: ${job.title} @ ${job.company}`, 'success');
        if (announce) announce(`Application package generated for ${job.title} at ${job.company}`);
      }
    } catch (err) {
      console.error('Async application error:', err);
      if (addToast) addToast(`Synthesis failed: ${err.message}`, 'error');
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
  }, [updateJobStatus, activeProfile, setActiveProfile, addToast, announce, currentUser]);

  // Updatable Location Bound State
  const [baseLocation, setBaseLocation] = useState(() => {
    if (typeof window === 'undefined') return 'BALACLAVA VIC 3183';
    return localStorage.getItem('userBaseLocation') || 'BALACLAVA VIC 3183';
  });
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [tempLocationInput, setTempLocationInput] = useState(baseLocation);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('userBaseLocation', baseLocation);
    }
  }, [baseLocation]);

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
    'SOUTH YARRA VIC 3141',
  ];

  // Start background Autopilot agent if jobs exist
  useEffect(() => {
    if (jobs && jobs.length > 0) {
      const appsList = JSON.parse(localStorage.getItem('tracked_applications') || '[]');
      startAutopilot({ jobs, profile: activeProfile, applications: appsList });
    }
  }, [jobs, activeProfile]);

  // Derived counts
  const preparedCount = useMemo(() => {
    return (jobs || []).filter(j =>
      !j.isRejected && (
        j.status?.toLowerCase().includes('package prepared') ||
        j.status?.toLowerCase().includes('to submit') ||
        j.status?.toLowerCase().includes('discovered')
      )
    ).length;
  }, [jobs]);

  const remoteJobsCount = useMemo(() => {
    return (jobs || []).filter(j => {
      if (j.remote === true || j.remote === 1 || j.remote === 'true') return true;
      const wm = String(j.work_mode || '').toLowerCase();
      if (wm === 'remote' || wm === 'hybrid') return true;
      const combined = `${j.title || ''} ${j.location || ''} ${(j.tags || []).join(' ')}`.toLowerCase();
      return combined.includes('remote') || combined.includes('wfh') || combined.includes('work from home');
    }).length;
  }, [jobs]);

  if (error) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-6 bg-rose-950 text-rose-200 rounded-sm border border-rose-800 font-mono text-xs ">
        <h2 className="text-sm font-bold tracking-widest uppercase mb-1">SYSTEM ERROR // FETCH FAILED</h2>
        <p>{error}</p>
      </div>
    );
  }

  const applicationsList = JSON.parse(localStorage.getItem('tracked_applications') || '[]');

  // Ambient Flow Mode
  if (viewMode === 'ambient') {
    return (
      <SafeErrorBoundary>
        <Suspense fallback={<div className="min-h-screen bg-[#070605] flex items-center justify-center font-mono text-[#d48b38]">LOADING AMBIENT HUD...</div>}>
          <CyberpunkAmbientMode
            jobs={jobs}
            profile={activeProfile}
            applications={applicationsList}
            onReturnToDashboard={() => setViewMode('dashboard')}
            onOpenJobModal={(job) => setSelectedJob(job)}
            onOpenGenerator={(job) => setSelectedForGenerator(job)}
          />
        </Suspense>
        <DashboardModals
          modalState={modalState}
          jobs={jobs}
          activeProfile={activeProfile}
          setActiveProfile={setActiveProfile}
          editingProfile={editingProfile}
          setEditingProfile={setEditingProfile}
          updateJobStatus={updateJobStatus}
          rejectJob={rejectJob}
          unrejectJob={unrejectJob}
          refetch={refetch}
          addToast={addToast}
          announce={announce}
          activeScoringWeights={activeScoringWeights}
          handleApplyCustomWeights={handleApplyCustomWeights}
          setActiveSection={setActiveSection}
          triggerDiscoveryScrape={triggerDiscoveryScrape}
          setBaseLocation={setBaseLocation}
          currentUser={currentUser}
          setAuthUser={setAuthUser}
        />
      </SafeErrorBoundary>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 industry-ambient-bg font-sans text-slate-100 pb-16 selection:bg-amber-600 selection:text-white">
      {/* React Router Bidirectional Synchronization */}
      <RouteSync
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        jobs={jobs}
        setSelectedJob={setSelectedJob}
      />

      {/* Screen-reader live announcement region */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      {/* Top Live Engine Status Bar */}
      {fallbackBanner && (
        <div
          role="alert"
          className="bg-amber-500/15 border-b border-amber-500/30 text-amber-300 px-4 py-2 text-xs font-mono flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-sm bg-amber-400 animate-pulse" aria-hidden="true" />
            {fallbackBanner}
          </span>
          <button
            onClick={() => setFallbackBanner(null)}
            aria-label="Dismiss status banner"
            className="text-amber-400 hover:text-white ml-4 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Mobile Compact App Header */}
      <header className="md:hidden sticky top-0 z-40 bg-[#0c0e14]/95 backdrop-blur-xl border-b border-amber-500/20 px-3 py-2 font-mono">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-sm bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 border border-amber-300/50">
              <Terminal size={16} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-humanist font-black tracking-wider uppercase text-[#fbf9f4]">
                  CAREER.AGENT
                </span>
                <span className="text-[9px] font-mono font-bold text-amber-400 px-1 py-0.2 rounded-sm bg-amber-950/80 border border-amber-500/30">
                  {activeSection.toUpperCase()}
                </span>
              </div>
              <div className="text-[9px] text-slate-400 font-mono">
                {jobs.length} POSITIONS INDEXED
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Quick Location Badge */}
            <button
              type="button"
              onClick={() => { setTempLocationInput(baseLocation); setIsEditingLocation(true); }}
              className="flex items-center gap-1 text-[10px] text-emerald-300 bg-slate-900/90 border border-slate-700/80 px-2 py-1.5 rounded-sm touch-target-44 cursor-pointer"
              title="Change location"
            >
              <MapPin size={11} className="text-amber-400" />
              <span className="truncate max-w-[65px]">{baseLocation}</span>
            </button>

            {/* Command Palette Trigger */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="p-2 text-amber-300 bg-amber-950/80 border border-amber-500/40 rounded-sm touch-target-44 flex items-center justify-center cursor-pointer"
              aria-label="Open Command Palette"
            >
              <Command size={14} />
            </button>

            {/* Mobile Drawer Trigger (Hamburger) */}
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
              className="p-2 text-slate-300 hover:text-white bg-slate-900 border border-slate-700 rounded-sm touch-target-44 flex items-center justify-center cursor-pointer"
              aria-label="Open Mobile Menu"
            >
              {isMobileDrawerOpen ? <XIcon size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Top Nav / Status Bar */}
      <div className="hidden md:flex sticky top-0 z-40 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/90 text-slate-300 py-2 px-3 sm:px-5 lg:px-6 font-mono text-[11px] flex-wrap items-center justify-between gap-3 font-semibold ">
        <div className="flex items-center gap-3 truncate">
          <span className="flex items-center gap-1.5 text-emerald-400 font-bold shrink-0 bg-emerald-950/60 px-2 py-0.5 rounded-sm border border-emerald-500/30">
            <Activity size={12} className="animate-pulse text-emerald-400" /> V2.0 ENGINE ACTIVE
          </span>
          {currentIndustryTheme && (
            <span
              className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-black uppercase tracking-wider transition-all"
              style={{
                backgroundColor: currentIndustryTheme.badgeBg,
                borderColor: currentIndustryTheme.border,
                color: currentIndustryTheme.badgeText,
                borderWidth: '1px'
              }}
              title={`Active Domain: ${currentIndustryTheme.name} // ${currentIndustryTheme.tag}`}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-ping shrink-0" style={{ backgroundColor: currentIndustryTheme.accent }} />
              <span>{currentIndustryTheme.tag}</span>
            </span>
          )}
          <span className="text-slate-700 hidden sm:inline">|</span>
          <span className="truncate text-slate-300 text-xs">
            <strong className="text-white font-black">{jobs.length}</strong> POSITIONS
          </span>
          <span className="text-slate-700 hidden md:inline">|</span>

          {/* Location Bound selector */}
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-slate-500 font-bold hidden lg:inline text-[10px]">BASE:</span>
            {isEditingLocation ? (
              <form onSubmit={handleSaveLocation} className="flex items-center gap-1">
                <input
                  type="text"
                  value={tempLocationInput}
                  onChange={(e) => setTempLocationInput(e.target.value)}
                  className="bg-slate-900 border border-amber-500 text-emerald-300 px-2 py-0.5 rounded-sm text-[11px] font-mono focus:outline-none w-36 uppercase font-bold"
                  placeholder="SUBURB POSTCODE"
                  autoFocus
                />
                <button type="submit" className="text-emerald-400 hover:text-emerald-300 font-bold px-1.5 py-0.5 bg-emerald-950/60 rounded border border-emerald-500/40 cursor-pointer">✓</button>
                <button type="button" onClick={() => setIsEditingLocation(false)} className="text-rose-400 hover:text-rose-300 font-bold px-1.5 py-0.5 bg-rose-950/60 rounded border border-rose-500/40 cursor-pointer">✕</button>
              </form>
            ) : (
              <button
                onClick={() => { setTempLocationInput(baseLocation); setIsEditingLocation(true); }}
                className="flex items-center gap-1 text-emerald-300 hover:text-emerald-200 font-bold hover:underline cursor-pointer bg-slate-900/90 px-2.5 py-0.5 rounded-sm border border-slate-700/80 transition-colors"
                title="Click to change your primary location radius baseline"
              >
                <MapPin size={11} className="text-amber-400" />
                <span className="truncate max-w-[130px] sm:max-w-[180px]">{baseLocation}</span>
                <span className="text-[9px] text-slate-400 font-normal">✎</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] flex-wrap justify-end">
          {/* Active Candidate Profile Switcher */}
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
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />

          {/* Quick Action: + Custom Job */}
          <button
            onClick={() => setIsCustomJobModalOpen(true)}
            className="flex items-center gap-1 text-purple-300 hover:text-white transition-all cursor-pointer text-[10px] uppercase font-bold bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 px-2.5 py-1 rounded-sm -xs"
            title="Generate Tailored Resume & Cover Letter from any Job Description or Link"
          >
            <Sparkles size={11} className="text-purple-400" /> + CUSTOM
          </button>

          {/* Quick Action: Batch Apply */}
          <button
            onClick={() => setIsBatchApplyOpen(true)}
            className="flex items-center gap-1 text-emerald-300 hover:text-white transition-all cursor-pointer text-[10px] uppercase font-bold bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 px-2.5 py-1 rounded-sm -xs"
            title="Dispatch 1-Click Batch Automated Applications"
          >
            <Zap size={11} className="text-emerald-400" /> BATCH
          </button>

          {/* Ambient Flow Toggle */}
          <button
            onClick={() => setViewMode("ambient")}
            className="flex items-center gap-1 px-2.5 py-1 bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 hover:text-white hover:bg-cyan-900 transition-all font-bold text-[10px] rounded-sm cursor-pointer"
            title="Switch to Cyberpunk Ambient Flow Mode"
          >
            <span className="w-1.5 h-1.5 rounded-sm bg-cyan-400 animate-pulse" />
            <span>AMBIENT FLOW</span>
          </button>

          {/* Consolidated Intelligence & Tools Dropdown */}
          <div className="relative" ref={toolsMenuRef}>
            <button
              type="button"
              onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm border text-[10px] font-bold uppercase transition-all cursor-pointer ${
                isToolsMenuOpen
                  ? 'bg-amber-600 text-white border-amber-400 -indigo-600/30'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700'
              }`}
              title="Intelligence, Analytics & Network Tools"
            >
              <Layers size={11} className={isToolsMenuOpen ? 'text-white' : 'text-amber-400'} />
              <span>TOOLS</span>
              {overdueTouchpointCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-sm bg-rose-500 text-white text-[9px] font-black animate-pulse">
                  {overdueTouchpointCount}
                </span>
              )}
              <ChevronDown size={11} className={`transition-transform duration-200 ${isToolsMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isToolsMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-sm p-2 z-50 space-y-1 font-mono text-xs animate-in fade-in zoom-in-95 duration-150 text-slate-200">
                <div className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  CAREER SUITE // TOOLS & INTEL
                </div>

                <button
                  type="button"
                  onClick={() => { setIsToolsMenuOpen(false); setIsRecruiterCrmOpen(true); }}
                  className="w-full px-2.5 py-2 rounded-sm hover:bg-purple-950/70 text-slate-200 hover:text-purple-300 flex items-center justify-between transition-colors text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2 font-bold text-[11px]">
                    <Users size={13} className="text-purple-400" />
                    <span>Recruiter CRM</span>
                  </span>
                  {overdueTouchpointCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-sm bg-rose-500 text-white text-[9px] font-black animate-pulse">
                      {overdueTouchpointCount} due
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setIsToolsMenuOpen(false); setIsFunnelModalOpen(true); }}
                  className="w-full px-2.5 py-2 rounded-sm hover:bg-cyan-950/70 text-slate-200 hover:text-cyan-300 flex items-center gap-2 transition-colors text-left font-bold text-[11px] cursor-pointer"
                >
                  <TrendingUp size={13} className="text-cyan-400" />
                  <span>Funnel Intelligence</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setIsToolsMenuOpen(false); setIsCareerModalOpen(true); }}
                  className="w-full px-2.5 py-2 rounded-sm hover:bg-amber-950/70 text-slate-200 hover:text-amber-300 flex items-center gap-2 transition-colors text-left font-bold text-[11px] cursor-pointer"
                >
                  <Compass size={13} className="text-amber-400" />
                  <span>Career Vector Compass</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setIsToolsMenuOpen(false); setIsPdfStudioOpen(true); }}
                  className="w-full px-2.5 py-2 rounded-sm hover:bg-amber-950/70 text-slate-200 hover:text-amber-300 flex items-center gap-2 transition-colors text-left font-bold text-[11px] cursor-pointer"
                >
                  <FileText size={13} className="text-amber-400" />
                  <span>Visual ATS PDF Studio</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setIsToolsMenuOpen(false); setIsScoringTunerOpen(true); }}
                  className="w-full px-2.5 py-2 rounded-sm hover:bg-blue-950/70 text-slate-200 hover:text-blue-300 flex items-center gap-2 transition-colors text-left font-bold text-[11px] cursor-pointer"
                >
                  <Sliders size={13} className="text-blue-400" />
                  <span>Scoring Matrix Tuner</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setIsToolsMenuOpen(false); setIsVoiceInterviewOpen(true); }}
                  className="w-full px-2.5 py-2 rounded-sm hover:bg-purple-950/70 text-slate-200 hover:text-purple-300 flex items-center gap-2 transition-colors text-left font-bold text-[11px] cursor-pointer"
                >
                  <Mic size={13} className="text-purple-400" />
                  <span>Voice Mock Interview Studio</span>
                </button>

                {authUser ? (
                  <button
                    type="button"
                    onClick={() => { setIsToolsMenuOpen(false); setIsGoogleIntegrationOpen(true); }}
                    className="w-full px-2.5 py-2 rounded-sm hover:bg-emerald-950/70 text-slate-200 hover:text-emerald-300 flex items-center gap-2 transition-colors text-left font-bold text-[11px] cursor-pointer"
                  >
                    <Table size={13} className="text-emerald-400" />
                    <span>Google Sheets Tracker</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setIsToolsMenuOpen(false); setIsAuthModalOpen(true); }}
                    className="w-full px-2.5 py-2 rounded-sm hover:bg-slate-800 text-slate-200 hover:text-white flex items-center gap-2 transition-colors text-left font-bold text-[11px] cursor-pointer"
                  >
                    <Lock size={13} className="text-amber-400" />
                    <span>Sign in with Google</span>
                  </button>
                )}

                {isWorkforceEnabled && (
                  <button
                    type="button"
                    onClick={() => { setIsToolsMenuOpen(false); setIsWorkforceModalOpen(true); }}
                    className="w-full px-2.5 py-2 rounded-sm hover:bg-amber-950/70 text-slate-200 hover:text-amber-300 flex items-center gap-2 transition-colors text-left font-bold text-[11px] cursor-pointer"
                  >
                    <Award size={13} className="text-amber-400" />
                    <span>Workforce Australia</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => { setIsToolsMenuOpen(false); setIsSkillGapModalOpen(true); }}
                  className="w-full px-2.5 py-2 rounded-sm hover:bg-slate-800 text-slate-200 hover:text-white flex items-center gap-2 transition-colors text-left font-bold text-[11px] cursor-pointer"
                >
                  <TrendingUp size={13} className="text-emerald-400" />
                  <span>Market Skill Gap Intelligence</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsToolsMenuOpen(false);
                    setCompareJobs(jobs.slice(0, 2));
                    setIsCompareModalOpen(true);
                  }}
                  className="w-full px-2.5 py-2 rounded-sm hover:bg-slate-800 text-slate-200 hover:text-white flex items-center gap-2 transition-colors text-left font-bold text-[11px] cursor-pointer"
                >
                  <Sparkles size={13} className="text-amber-400" />
                  <span>Compare Top Opportunities</span>
                </button>

                <div className="pt-1 border-t border-slate-800 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => { setIsToolsMenuOpen(false); setSelfHealSource(null); setIsSourceSelfHealOpen(true); }}
                    className="w-full px-2.5 py-2 rounded-sm hover:bg-slate-800 text-amber-300 hover:text-white flex items-center gap-2 transition-colors text-left font-bold text-[11px] cursor-pointer"
                  >
                    <ShieldAlert size={13} className="text-amber-400" />
                    <span>Scraper Health & Self-Healing</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsToolsMenuOpen(false); setIsPricingModalOpen(true); }}
                    className="w-full px-2.5 py-2 rounded-sm hover:bg-slate-800 text-amber-300 hover:text-white flex items-center gap-2 transition-colors text-left font-bold text-[11px] cursor-pointer"
                  >
                    <Crown size={13} className="text-amber-400" />
                    <span>Subscription & Plans</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsToolsMenuOpen(false); setIsSettingsOpen(true); }}
                    className="w-full px-2.5 py-2 rounded-sm hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2 transition-colors text-left font-bold text-[11px] cursor-pointer"
                  >
                    <Settings size={13} className="text-amber-400" />
                    <span>Settings & LLM Models</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Command Palette (Ctrl+K) */}
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex items-center gap-1 text-amber-300 hover:text-white transition-colors cursor-pointer text-[10px] uppercase font-bold bg-amber-950/80 border border-amber-500/40 px-2 py-1 rounded-sm"
            title="Open Command Palette (Ctrl+K)"
          >
            <Command size={11} /> ⌘K
          </button>

          {/* LLM Spend HUD */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 text-amber-300 hover:text-white transition-all cursor-pointer text-[10px] uppercase font-mono font-bold bg-amber-950/70 hover:bg-amber-900/80 border border-amber-500/40 px-2.5 py-1 rounded-sm shadow-xs"
            title={`Total LLM Spend: $${(spendSummary.totalSpendUsd || 0).toFixed(4)} USD (${(spendSummary.totalTokens || 0).toLocaleString()} tokens across ${spendSummary.callCount || 0} calls). Click to open Settings & Model selection.`}
          >
            <Zap size={11} className="text-amber-400 animate-pulse" />
            <span>
              SPEND: <strong className="text-emerald-400 font-black">${(spendSummary.totalSpendUsd || 0) > 0 ? (spendSummary.totalSpendUsd).toFixed(4) : '0.00'}</strong>
            </span>
          </button>

          {/* Subscription Tier HUD: Google Antigravity VIP Member Capsule */}
          <button
            type="button"
            onClick={() => setIsPricingModalOpen(true)}
            className={`flex items-center gap-1.5 transition-all cursor-pointer text-[10px] uppercase font-mono font-bold px-2.5 py-1 border shadow-xs ${
              billingStatus?.is_active
                ? 'vip-subscriber-capsule rounded-full text-emerald-200 ring-1 ring-emerald-400/40'
                : 'text-amber-300 bg-amber-950/70 hover:bg-amber-900/80 border-amber-500/40 rounded-sm'
            }`}
            title={
              billingStatus?.is_active
                ? `⭐ ${billingStatus?.plan_tier === 'pass_3mo' ? 'Career Pass VIP' : 'Pro Job Hunter'} Active · Click to manage subscription`
                : `Free Tier (${billingStatus?.trial_generations_remaining ?? 3} trials remaining) · Click to view Pro plans`
            }
          >
            <Crown size={12} className={billingStatus?.is_active ? "text-emerald-300 animate-pulse" : "text-amber-400"} />
            <span>
              {billingStatus?.is_active ? (
                <span className="flex items-center gap-1.5">
                  <span className="text-white font-black">{billingStatus?.plan_tier === 'pass_3mo' ? 'CAREER PASS' : 'PRO'}</span>
                  <span className="text-emerald-300 font-extrabold text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 border border-emerald-400/30">VIP</span>
                </span>
              ) : (
                <>PRO TIER <span className="text-amber-400 font-black">· UPGRADE</span></>
              )}
            </span>
          </button>

          {/* Provider Mesh Telemetry Desk */}
          <TelemetryDesk onOpenSelfHeal={(src) => { setSelfHealSource(src); setIsSourceSelfHealOpen(true); }} />

          {/* Sync Database Feed */}
          <button
            onClick={refetch}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer text-[10px] uppercase font-bold px-2 py-1 rounded-sm bg-slate-900 border border-slate-800"
            title="Sync Database Feed"
          >
            <RefreshCw size={11} />
          </button>

          {/* Sign Out */}
          {onSignOut && (
            <button
              onClick={() => {
                logoutUser();
                onSignOut();
              }}
              className="flex items-center gap-1 text-rose-400 hover:text-rose-200 transition-colors cursor-pointer text-[10px] uppercase font-bold px-2 py-1 rounded-sm bg-rose-950/60 border border-rose-500/40"
              title="Sign Out / Switch User"
            >
              <LogOut size={11} />
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

      {/* Humanist Atelier Header & Top Navigation */}
      <header className="hidden md:block bg-[#12141c]/95 backdrop-blur-xl border-b border-amber-500/15 sticky top-[33px] z-30 font-mono">
        <div className="w-full px-3 sm:px-5 lg:px-6 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-sm bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 border border-amber-300/50">
              <Terminal size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-humanist font-black tracking-widest uppercase text-[#fbf9f4]">
                  CANDIDATE LOGISTICS PORTAL <span className="text-[10px] font-mono font-bold tracking-widest text-amber-400/90 px-1.5 py-0.5 rounded-sm bg-amber-950/80 border border-amber-500/30 ml-1">MENTAT CORE</span>
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-amber-950/60 text-amber-300 border border-amber-400/30">
                  <Terminal size={11} className="text-amber-400" /> ACTIVE
                </span>
                {(currentUser?.isDemoUser || currentUser?.authProvider === 'demo') && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-stone-900 text-amber-300 border border-amber-400/30">
                    <Activity size={11} className="text-amber-400" /> DEMO MODE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-humanist font-medium tracking-widest uppercase mt-1">
                HUMAN-CENTRIC DISCOVERY & AUTONOMOUS APPLICATION DISPATCHER
              </p>
            </div>
          </div>

          {/* 5-Way Tab View Switcher */}
          <nav aria-label="Dashboard views" className="flex items-center gap-1.5 bg-[#0a0c10]/90 backdrop-blur-md p-1 rounded-sm border border-amber-500/15 max-w-full overflow-x-auto scrollbar-none shrink-0 ">
            <div role="tablist" aria-label="Dashboard views" className="flex items-center gap-1">
              <button
                role="tab"
                aria-selected={activeSection === 'seeker'}
                aria-controls="panel-seeker"
                onClick={() => setActiveSection('seeker')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 active:scale-95 ${
                  activeSection === 'seeker'
                    ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 font-black -amber-950/40 border border-amber-300/50'
                    : 'text-stone-400 hover:text-[#fbf9f4] hover:bg-stone-900/80 border border-transparent'
                }`}
              >
                <LayoutGrid size={13} aria-hidden="true" />
                DISCOVERY STREAM
                {preparedCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-sm text-[10px] bg-amber-950 text-amber-300 border border-amber-500/40" aria-label={`${preparedCount} prepared`}>
                    {preparedCount}
                  </span>
                )}
              </button>

              <button
                role="tab"
                aria-selected={activeSection === 'highlights'}
                aria-controls="panel-highlights"
                onClick={() => setActiveSection('highlights')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 active:scale-95 ${
                  activeSection === 'highlights'
                    ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 font-black -amber-950/40 border border-amber-300/50'
                    : 'text-stone-400 hover:text-[#fbf9f4] hover:bg-stone-900/80 border border-transparent'
                }`}
              >
                <Zap size={13} className={activeSection === 'highlights' ? 'text-slate-950' : 'text-amber-400'} aria-hidden="true" />
                ACTION QUEUE
              </button>

              <button
                role="tab"
                aria-selected={activeSection === 'kanban'}
                aria-controls="panel-kanban"
                onClick={() => setActiveSection('kanban')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 active:scale-95 ${
                  activeSection === 'kanban'
                    ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 font-black -amber-950/40 border border-amber-300/50'
                    : 'text-stone-400 hover:text-[#fbf9f4] hover:bg-stone-900/80 border border-transparent'
                }`}
              >
                <Sliders size={13} aria-hidden="true" />
                APPLICATION KANBAN
              </button>

              <button
                role="tab"
                aria-selected={activeSection === 'remote'}
                aria-controls="panel-remote"
                onClick={() => setActiveSection('remote')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 active:scale-95 ${
                  activeSection === 'remote'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white -emerald-900/30 border border-emerald-400/30'
                    : 'text-stone-400 hover:text-[#fbf9f4] hover:bg-stone-900/80 border border-transparent'
                }`}
              >
                <Globe size={13} className={activeSection === 'remote' ? 'text-white' : 'text-emerald-400'} aria-hidden="true" />
                REMOTE ROLES
                {remoteJobsCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-sm text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                    {remoteJobsCount}
                  </span>
                )}
              </button>

              <button
                role="tab"
                aria-selected={activeSection === 'market'}
                aria-controls="panel-market"
                onClick={() => setActiveSection('market')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 active:scale-95 ${
                  activeSection === 'market'
                    ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 font-black -amber-950/40 border border-amber-300/50'
                    : 'text-stone-400 hover:text-[#fbf9f4] hover:bg-stone-900/80 border border-transparent'
                }`}
              >
                <TrendingUp size={13} aria-hidden="true" />
                MARKET INTEL
              </button>

              <button
                role="tab"
                aria-selected={activeSection === 'analytics'}
                aria-controls="panel-analytics"
                onClick={() => setActiveSection('analytics')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 active:scale-95 ${
                  activeSection === 'analytics'
                    ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 font-black -amber-950/40 border border-amber-300/50'
                    : 'text-stone-400 hover:text-[#fbf9f4] hover:bg-stone-900/80 border border-transparent'
                }`}
              >
                <Target size={13} aria-hidden="true" />
                ANALYTICS & FUNNEL
              </button>

              <button
                role="tab"
                aria-selected={activeSection === 'operations'}
                aria-controls="panel-operations"
                onClick={() => setActiveSection('operations')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 active:scale-95 ${
                  activeSection === 'operations'
                    ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 font-black -amber-950/40 border border-amber-300/50'
                    : 'text-stone-400 hover:text-[#fbf9f4] hover:bg-stone-900/80 border border-transparent'
                }`}
              >
                <CalendarClock size={13} aria-hidden="true" />
                STRATEGIC OPS
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Dynamic Industry Theme & Live Profile Scrape Banner */}
      {(profileScrapeStatus || (showSuggestions && suggestedTitles.length > 0)) && (
        <div className="w-full bg-slate-900/95 border-b border-slate-800 backdrop-blur-md px-3 sm:px-5 lg:px-6 py-2.5 animate-in slide-in-from-top-2 duration-300 font-mono text-xs ">
          <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-black uppercase tracking-wider industry-accent-badge -xs">
                <span className="w-2 h-2 rounded-sm animate-pulse" style={{ backgroundColor: currentIndustryTheme.accent }} />
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
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm bg-slate-950/80 hover:bg-slate-800 border border-slate-700 hover:border-amber-400 text-slate-300 hover:text-white transition-all cursor-pointer font-bold group"
                    title={`Add "${title}" to target titles`}
                  >
                    <span>+ {title}</span>
                  </button>
                ))}
                <button
                  onClick={() => setShowSuggestions(false)}
                  className="text-slate-500 hover:text-slate-300 p-1 rounded-sm hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
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
      <main className="w-full px-2 sm:px-4 lg:px-6 py-2.5 pb-24 md:pb-6 space-y-3.5 flex-1">
        {/* Proactive Agent Copilot Intelligence Bar */}
        <CopilotBar
          jobs={jobs}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenGenerator={(j) => setSelectedForGenerator(j)}
          onNavigateView={(view) => setActiveSection(view)}
        />

        {/* Profile Completeness Hub & Calibration CTA */}
        {profileCompleteness && profileCompleteness.score < 100 && !isCompletenessDismissed && (
          <div className="bg-slate-900/95 border border-amber-500/30 rounded-sm p-3.5 text-xs space-y-2.5 relative animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-sm bg-amber-500/20 text-amber-400 border border-amber-400/30 shrink-0">
                  <Sparkles size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2 font-mono font-bold text-white uppercase text-xs">
                    <span>PROFILE COMPLETENESS: {profileCompleteness.score}%</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-sm bg-amber-950 text-amber-300 border border-amber-500/30">
                      +{100 - profileCompleteness.score}% MATCH BOOST AVAILABLE
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-sans mt-0.5">
                    {profileCompleteness.improvements[0]?.description || 'Complete remaining profile details to calibrate discovery and unlock precision match scoring.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => {
                    setEditingProfile(activeProfile);
                    setIsProfileModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-sm bg-amber-600 hover:bg-amber-500 text-black font-mono font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <span>{profileCompleteness.improvements[0]?.actionLabel || 'Improve Profile'}</span>
                  <ArrowRight size={12} className="stroke-[3]" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsCompletenessDismissed(true)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-sm hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Dismiss for this session"
                >
                  <XIcon size={14} />
                </button>
              </div>
            </div>

            {/* Progress Track */}
            <div className="w-full h-1.5 bg-slate-800 rounded-sm overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-sm transition-all duration-500"
                style={{ width: `${profileCompleteness.score}%` }}
              />
            </div>
          </div>
        )}

        {/* Dynamic View Component */}
        {loading ? (
          <DashboardGridSkeleton />
        ) : (
          <>
            {activeSection === 'seeker' && (
              <SafeErrorBoundary sectionName="Job Feed & Discoveries">
                <PrimeTargetSpotlight
                  jobs={jobs}
                  profile={activeProfile}
                  applications={applicationsList}
                  onOpenJobModal={(job) => setSelectedJob(job)}
                  onOpenGenerator={(job) => setSelectedForGenerator(job)}
                  onJobStatusUpdate={(jobId, status, updatedJob) => updateJobStatus(jobId, status, updatedJob)}
                />
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
                  onOpenBatchApply={() => setIsBatchApplyOpen(true)}
                  onJobStatusUpdate={(updatedJob) => updateJobStatus(updatedJob.id || `${updatedJob.company}_${updatedJob.title}`, updatedJob.status, updatedJob)}
                  onTriggerScrape={() => triggerDiscoveryScrape(activeProfile)}
                  onOpenCheatSheet={(j) => setSelectedForCheatSheet(j)}
                  onSaveCustomDocs={(jobId, docData) => {
                    updateJobStatus(jobId, 'Package Prepared / To Submit', {
                      hasCustomDocs: true,
                      resumeText: docData.resumeText,
                      coverLetterText: docData.coverLetterText,
                      docsModel: docData.model,
                      docsGeneratedAt: docData.generatedAt || new Date().toISOString(),
                    });
                  }}
                />
              </SafeErrorBoundary>
            )}

            {activeSection === 'highlights' && (
              <SafeErrorBoundary sectionName="Action Highlights">
                <ActionHighlights
                  jobs={jobs}
                  onOpenMockInterview={(j) => setSelectedForMockInterview(j)}
                  onOpenInterviewPrep={(j) => setSelectedForInterviewPrep(j)}
                  onOpenCheatSheet={(j) => setSelectedForCheatSheet(j)}
                  onOpenOfferHub={(j) => setSelectedForOfferHub(j)}
                  onOpenExecutiveDossier={(j) => setSelectedForDossier(j)}
                  onSelectJob={(j) => setSelectedJob(j)}
                  onJobStatusUpdate={(id, status, extra) => updateJobStatus(id, status, extra)}
                />
              </SafeErrorBoundary>
            )}

            {activeSection === 'kanban' && (
              <SafeErrorBoundary sectionName="Application Pipeline Kanban">
                <ApplicationPipeline
                  onOpenMockInterview={(j) => setSelectedForMockInterview(j)}
                  onOpenInterviewPrep={(j) => setSelectedForInterviewPrep(j)}
                  onOpenCheatSheet={(j) => setSelectedForCheatSheet(j)}
                  jobs={jobs}
                  loading={loading}
                  onUpdateStatus={(id, status, extra) => updateJobStatus(id, status, extra)}
                  onOpenGenerator={(j) => setSelectedForGenerator(j)}
                />
              </SafeErrorBoundary>
            )}

            {activeSection === 'remote' && (
              <SafeErrorBoundary sectionName="Remote Roles Command Hub">
                <Suspense fallback={<DashboardGridSkeleton count={6} />}>
                  <RemoteRolesSection
                    jobs={jobs}
                    onSelectJob={(j) => setSelectedJob(j)}
                    onOpenGenerator={(j) => setSelectedForGenerator(j)}
                    onOpenMockInterview={(j) => setSelectedForMockInterview(j)}
                    onOpenCheatSheet={(j) => setSelectedForCheatSheet(j)}
                  />
                </Suspense>
              </SafeErrorBoundary>
            )}

            {activeSection === 'market' && (
              <SafeErrorBoundary sectionName="Market Intelligence">
                <MarketIntelligence jobs={jobs} />
              </SafeErrorBoundary>
            )}

            {activeSection === 'analytics' && (
              <SafeErrorBoundary sectionName="Analytics & Telemetry">
                <Suspense fallback={<DashboardGridSkeleton count={6} />}>
                  <AnalyticsDashboard
                    jobs={jobs}
                    onUpdateStatus={(id, status, extra) => updateJobStatus(id, status, extra)}
                    onSelectJob={(j) => setSelectedJob(j)}
                    onOpenGenerator={(j) => setSelectedForGenerator(j)}
                  />
                </Suspense>
              </SafeErrorBoundary>
            )}

            {activeSection === 'operations' && (
              <SafeErrorBoundary sectionName="Career Operations">
                <CareerOperations jobs={jobs} />
              </SafeErrorBoundary>
            )}
          </>
        )}
      </main>

      {/* Mobile Slide-Out Drawer */}
      {isMobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer Panel */}
          <div className="relative ml-auto w-4/5 max-w-sm h-full bg-[#101217] border-l border-amber-500/30 flex flex-col z-50 overflow-y-auto pb-safe font-mono">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-amber-400" />
                <span className="text-xs font-black uppercase tracking-wider text-white">OPERATIVE MENU</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-sm touch-target-44 flex items-center justify-center cursor-pointer"
                aria-label="Close menu"
              >
                <XIcon size={18} />
              </button>
            </div>

            {/* Candidate Profile Quick Info */}
            <div className="p-4 border-b border-slate-800/80 bg-amber-950/20">
              <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1">CANDIDATE DOSSIER</div>
              <div className="text-sm font-black text-white">{activeProfile?.name || 'Candidate'}</div>
              <div className="text-[11px] text-slate-300 truncate">{activeProfile?.title || 'Candidate Profile'}</div>
              <button
                type="button"
                onClick={() => { setIsMobileDrawerOpen(false); setEditingProfile(activeProfile); setIsProfileModalOpen(true); }}
                className="mt-2 w-full py-2 px-2.5 rounded-sm bg-amber-600/30 border border-amber-500/50 text-amber-300 text-[11px] font-bold uppercase flex items-center justify-center gap-1 cursor-pointer touch-target-44"
              >
                Edit Profile
              </button>
            </div>

            {/* Secondary Views Navigation */}
            <div className="p-3 border-b border-slate-800/80 space-y-1">
              <div className="text-[9px] text-slate-500 uppercase font-black px-2 py-1">NAVIGATION PORTALS</div>
              <button
                type="button"
                onClick={() => { setActiveSection('seeker'); setIsMobileDrawerOpen(false); }}
                className={`w-full px-3 py-2.5 rounded-sm text-xs font-bold flex items-center gap-2.5 transition-colors touch-target-44 cursor-pointer ${activeSection === 'seeker' ? 'bg-amber-600 text-slate-950 font-black' : 'text-slate-300 hover:bg-slate-900'}`}
              >
                <LayoutGrid size={15} /> DISCOVERY STREAM
              </button>
              <button
                type="button"
                onClick={() => { setActiveSection('highlights'); setIsMobileDrawerOpen(false); }}
                className={`w-full px-3 py-2.5 rounded-sm text-xs font-bold flex items-center gap-2.5 transition-colors touch-target-44 cursor-pointer ${activeSection === 'highlights' ? 'bg-amber-600 text-slate-950 font-black' : 'text-slate-300 hover:bg-slate-900'}`}
              >
                <Zap size={15} /> ACTION QUEUE
              </button>
              <button
                type="button"
                onClick={() => { setActiveSection('kanban'); setIsMobileDrawerOpen(false); }}
                className={`w-full px-3 py-2.5 rounded-sm text-xs font-bold flex items-center gap-2.5 transition-colors touch-target-44 cursor-pointer ${activeSection === 'kanban' ? 'bg-amber-600 text-slate-950 font-black' : 'text-slate-300 hover:bg-slate-900'}`}
              >
                <Sliders size={15} /> APPLICATION KANBAN
              </button>
              <button
                type="button"
                onClick={() => { setActiveSection('remote'); setIsMobileDrawerOpen(false); }}
                className={`w-full px-3 py-2.5 rounded-sm text-xs font-bold flex items-center gap-2.5 transition-colors touch-target-44 cursor-pointer ${activeSection === 'remote' ? 'bg-emerald-600 text-white font-black' : 'text-slate-300 hover:bg-slate-900'}`}
              >
                <Globe size={15} /> REMOTE ROLES {remoteJobsCount > 0 ? `(${remoteJobsCount})` : ''}
              </button>
              <button
                type="button"
                onClick={() => { setActiveSection('market'); setIsMobileDrawerOpen(false); }}
                className={`w-full px-3 py-2.5 rounded-sm text-xs font-bold flex items-center gap-2.5 transition-colors touch-target-44 cursor-pointer ${activeSection === 'market' ? 'bg-amber-600 text-slate-950 font-black' : 'text-slate-300 hover:bg-slate-900'}`}
              >
                <TrendingUp size={15} /> MARKET INTEL
              </button>
              <button
                type="button"
                onClick={() => { setActiveSection('analytics'); setIsMobileDrawerOpen(false); }}
                className={`w-full px-3 py-2.5 rounded-sm text-xs font-bold flex items-center gap-2.5 transition-colors touch-target-44 cursor-pointer ${activeSection === 'analytics' ? 'bg-amber-600 text-slate-950 font-black' : 'text-slate-300 hover:bg-slate-900'}`}
              >
                <Target size={15} /> ANALYTICS
              </button>
              <button
                type="button"
                onClick={() => { setActiveSection('operations'); setIsMobileDrawerOpen(false); }}
                className={`w-full px-3 py-2.5 rounded-sm text-xs font-bold flex items-center gap-2.5 transition-colors touch-target-44 cursor-pointer ${activeSection === 'operations' ? 'bg-amber-600 text-slate-950 font-black' : 'text-slate-300 hover:bg-slate-900'}`}
              >
                <CalendarClock size={15} /> OPERATIONS
              </button>
            </div>

            {/* Intelligence & Studio Tools */}
            <div className="p-3 border-b border-slate-800/80 space-y-1">
              <div className="text-[9px] text-slate-500 uppercase font-black px-2 py-1">SUITE TOOLS</div>
              <button
                type="button"
                onClick={() => { setIsMobileDrawerOpen(false); setIsCustomJobModalOpen(true); }}
                className="w-full px-3 py-2 rounded-sm text-xs text-purple-300 hover:bg-purple-950/40 flex items-center gap-2.5 touch-target-44 cursor-pointer"
              >
                <Sparkles size={14} className="text-purple-400" /> + Custom Job
              </button>
              <button
                type="button"
                onClick={() => { setIsMobileDrawerOpen(false); setIsBatchApplyOpen(true); }}
                className="w-full px-3 py-2 rounded-sm text-xs text-emerald-300 hover:bg-emerald-950/40 flex items-center gap-2.5 touch-target-44 cursor-pointer"
              >
                <Zap size={14} className="text-emerald-400" /> 1-Click Batch Apply
              </button>
              <button
                type="button"
                onClick={() => { setIsMobileDrawerOpen(false); setIsPdfStudioOpen(true); }}
                className="w-full px-3 py-2 rounded-sm text-xs text-amber-300 hover:bg-amber-950/40 flex items-center gap-2.5 touch-target-44 cursor-pointer"
              >
                <FileText size={14} className="text-amber-400" /> Visual ATS PDF Studio
              </button>
              <button
                type="button"
                onClick={() => { setIsMobileDrawerOpen(false); setIsScoringTunerOpen(true); }}
                className="w-full px-3 py-2 rounded-sm text-xs text-blue-300 hover:bg-blue-950/40 flex items-center gap-2.5 touch-target-44 cursor-pointer"
              >
                <Sliders size={14} className="text-blue-400" /> Scoring Matrix Tuner
              </button>
              <button
                type="button"
                onClick={() => { setIsMobileDrawerOpen(false); setIsVoiceInterviewOpen(true); }}
                className="w-full px-3 py-2 rounded-sm text-xs text-purple-300 hover:bg-purple-950/40 flex items-center gap-2.5 touch-target-44 cursor-pointer"
              >
                <Mic size={14} className="text-purple-400" /> Voice Mock Interview
              </button>
              <button
                type="button"
                onClick={() => { setIsMobileDrawerOpen(false); setSelfHealSource(null); setIsSourceSelfHealOpen(true); }}
                className="w-full px-3 py-2 rounded-sm text-xs text-amber-300 hover:bg-amber-950/40 flex items-center gap-2.5 touch-target-44 cursor-pointer"
              >
                <ShieldAlert size={14} className="text-amber-400" /> Scraper Health & Self-Healing
              </button>
              <button
                type="button"
                onClick={() => { setIsMobileDrawerOpen(false); setIsPricingModalOpen(true); }}
                className="w-full px-3 py-2 rounded-sm text-xs text-amber-300 hover:bg-amber-950/40 flex items-center gap-2.5 touch-target-44 cursor-pointer"
              >
                <Crown size={14} className="text-amber-400" /> Subscription & Plans
              </button>
              <button
                type="button"
                onClick={() => { setIsMobileDrawerOpen(false); setIsSettingsOpen(true); }}
                className="w-full px-3 py-2 rounded-sm text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2.5 touch-target-44 cursor-pointer"
              >
                <Settings size={14} className="text-slate-400" /> Settings & LLM Models
              </button>
            </div>

            {/* Footer Controls */}
            <div className="mt-auto p-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setIsMobileDrawerOpen(false); refetch(); }}
                className="px-3 py-2 rounded-sm bg-slate-900 border border-slate-700 text-xs text-slate-300 flex items-center gap-1.5 touch-target-44 cursor-pointer"
              >
                <RefreshCw size={12} /> Sync Feed
              </button>
              {onSignOut && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    logoutUser();
                    onSignOut();
                  }}
                  className="px-3 py-2 rounded-sm bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-1.5 touch-target-44 cursor-pointer"
                >
                  <LogOut size={12} /> Sign Out
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav aria-label="Mobile Navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c0e14]/95 backdrop-blur-2xl border-t border-amber-500/20 pb-safe font-mono shadow-[0_-8px_24px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-around px-1 py-1">
          <button
            type="button"
            onClick={() => setActiveSection('seeker')}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-sm transition-all touch-target-44 cursor-pointer active:scale-95 ${
              activeSection === 'seeker' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`}
            aria-label="Discovery Stream"
          >
            <LayoutGrid size={18} className={activeSection === 'seeker' ? 'text-amber-400 stroke-[2.5]' : ''} />
            <span className="text-[10px] mt-0.5 tracking-tight uppercase">Discover</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('highlights')}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-sm transition-all touch-target-44 cursor-pointer active:scale-95 ${
              activeSection === 'highlights' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`}
            aria-label="Action Queue"
          >
            <Zap size={18} className={activeSection === 'highlights' ? 'text-amber-400 stroke-[2.5]' : ''} />
            <span className="text-[10px] mt-0.5 tracking-tight uppercase">Queue</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('kanban')}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-sm transition-all touch-target-44 cursor-pointer active:scale-95 ${
              activeSection === 'kanban' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`}
            aria-label="Application Kanban"
          >
            <Sliders size={18} className={activeSection === 'kanban' ? 'text-amber-400 stroke-[2.5]' : ''} />
            <span className="text-[10px] mt-0.5 tracking-tight uppercase">Kanban</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('remote')}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-sm transition-all touch-target-44 cursor-pointer active:scale-95 ${
              activeSection === 'remote' ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`}
            aria-label="Remote Roles"
          >
            <div className="relative">
              <Globe size={18} className={activeSection === 'remote' ? 'text-emerald-400 stroke-[2.5]' : ''} />
              {remoteJobsCount > 0 && (
                <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full text-[8px] bg-emerald-500 text-slate-950 font-black">
                  {remoteJobsCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight uppercase">Remote</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-sm transition-all touch-target-44 cursor-pointer active:scale-95 ${
              isMobileDrawerOpen ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`}
            aria-label="More Menu"
          >
            <Menu size={18} className={isMobileDrawerOpen ? 'text-amber-400 stroke-[2.5]' : ''} />
            <span className="text-[10px] mt-0.5 tracking-tight uppercase">Menu</span>
          </button>
        </div>
      </nav>

      {/* Floating Background Application Notifications */}
      {backgroundNotifications.length > 0 && (
        <div className="fixed bottom-20 md:bottom-10 right-4 sm:right-6 z-50 space-y-2 max-w-sm w-full font-mono px-3 sm:px-0">
          {backgroundNotifications.map(n => (
            <div key={n.id} className="bg-slate-900 border-2 border-emerald-500 text-white p-3.5 rounded-sm flex items-start gap-3 animate-in slide-in-from-bottom duration-300">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-sm shrink-0">
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

      {/* Modal Dialogs Container */}
      <DashboardModals
        modalState={modalState}
        jobs={jobs}
        activeProfile={activeProfile}
        setActiveProfile={setActiveProfile}
        editingProfile={editingProfile}
        setEditingProfile={setEditingProfile}
        updateJobStatus={updateJobStatus}
        rejectJob={rejectJob}
        unrejectJob={unrejectJob}
        refetch={refetch}
        addToast={addToast}
        announce={announce}
        activeScoringWeights={activeScoringWeights}
        handleApplyCustomWeights={handleApplyCustomWeights}
        setActiveSection={setActiveSection}
        triggerDiscoveryScrape={triggerDiscoveryScrape}
        setBaseLocation={setBaseLocation}
        currentUser={currentUser}
        setAuthUser={setAuthUser}
      />

      {/* Fixed Bottom Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 h-7 bg-slate-900 border-t border-slate-800 text-slate-400 font-mono text-[11px] font-bold px-4 flex items-center justify-between z-50 select-none ">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-emerald-400">
            <span>⚡ V3.0 AUTONOMOUS ENGINE</span>
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
