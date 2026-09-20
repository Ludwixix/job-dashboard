import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useInRouterContext, useLocation, useNavigate } from 'react-router-dom';
import { getActiveProfile, saveProfile, fetchProfileFromBackend, calculateProfileCompleteness } from '../services/profileService';
import { fetchPreferencesFromBackend, savePreferencesToBackend } from '../services/scoringEngine';
import { fetchBillingStatus, getCachedBillingStatus } from '../services/billingService';
import { getWorkforceSettings } from '../services/workforceAustraliaService';
import { getSpendSummary, subscribeToSpendUpdates } from '../services/llmCostService';
import { fetchCadenceRadar } from '../services/recruiterCrmService';
import { applyIndustryTheme, getIndustryTheme } from '../services/industryThemeService';
import { syncProfileQueriesToBackend } from '../services/profileOnboardingPipeline';

// Client routing path mappings
export const SECTION_ROUTES = {
  seeker: '/',
  highlights: '/highlights',
  kanban: '/pipeline',
  remote: '/remote',
  market: '/market',
  analytics: '/analytics',
  operations: '/operations',
};

export const ROUTE_SECTIONS = {
  '/': 'seeker',
  '/seeker': 'seeker',
  '/highlights': 'highlights',
  '/pipeline': 'kanban',
  '/kanban': 'kanban',
  '/remote': 'remote',
  '/market': 'market',
  '/analytics': 'analytics',
  '/operations': 'operations',
};

// Safe bridge for React Router DOM (no-ops gracefully if rendered without Router context in unit tests)
function ActiveRouteSync({ activeSection, setActiveSection, jobs, setSelectedJob }) {
  const location = useLocation();
  const navigate = useNavigate();
  const lastSectionRef = useRef(activeSection);

  // 1. URL Path -> State synchronization (driven strictly when location.pathname changes)
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/job/')) {
      const jobId = decodeURIComponent(path.replace('/job/', '').trim());
      if (jobId && jobs && jobs.length > 0) {
        const found = jobs.find(j => String(j.id) === jobId || `${j.company}_${j.title}` === jobId);
        if (found) {
          setSelectedJob(found);
        }
      }
    } else if (ROUTE_SECTIONS[path]) {
      const targetSection = ROUTE_SECTIONS[path];
      lastSectionRef.current = targetSection;
      setActiveSection(prev => (prev === targetSection ? prev : targetSection));
    }
  }, [location.pathname, jobs, setActiveSection, setSelectedJob]);

  // 2. ActiveSection -> URL synchronization (driven strictly when activeSection state changes)
  useEffect(() => {
    if (activeSection === lastSectionRef.current) return;
    lastSectionRef.current = activeSection;

    const targetPath = SECTION_ROUTES[activeSection];
    if (targetPath && !location.pathname.startsWith('/job/') && location.pathname !== targetPath) {
      navigate(targetPath, { replace: false });
    }
  }, [activeSection, location.pathname, navigate]);

  return null;
}

/**
 * Route synchronization component that conditionally renders when inside a Router context.
 */
export function RouteSync({ activeSection, setActiveSection, jobs, setSelectedJob }) {
  const inRouter = useInRouterContext();
  if (!inRouter) return null;
  return React.createElement(ActiveRouteSync, {
    activeSection,
    setActiveSection,
    jobs,
    setSelectedJob,
  });
}

/**
 * Helper to match an item against the current jobs collection.
 */
function resolveLiveJob(target, jobs) {
  if (!target || !jobs || jobs.length === 0) return target;
  const match = jobs.find(j =>
    (j.id && String(j.id) === String(target.id)) ||
    `${j.company}_${j.title}` === `${target.company}_${target.title}`
  );
  return match || target;
}

/**
 * Custom hook to encapsulate top-level dashboard state, view routing, modal dialog visibility,
 * candidate personalization profile synchronization, and billing tier events.
 *
 * @param {Object} params
 * @param {Array} params.jobs - Current opportunity jobs list.
 * @param {Object|null} params.currentUser - Authenticated user info.
 * @param {Function|null} params.addToast - Toast notification dispatcher.
 * @returns {Object} Structured state and handlers for Dashboard and DashboardModals.
 */
export function useDashboardState({
  jobs = [],
  currentUser = null,
  addToast = null,
} = {}) {
  // Navigation
  const [activeSection, setActiveSection] = useState('seeker'); // 'seeker', 'kanban', 'market', 'tracker'

  // Profile
  const [activeProfile, setActiveProfile] = useState(() => getActiveProfile());
  const [editingProfile, setEditingProfile] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCompletenessDismissed, setIsCompletenessDismissed] = useState(false);
  const profileCompleteness = useMemo(() => calculateProfileCompleteness(activeProfile), [activeProfile]);

  // Billing & Subscriptions
  const [billingStatus, setBillingStatus] = useState(() => getCachedBillingStatus());
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [pricingModalReason, setPricingModalReason] = useState('upgrade');

  // View Mode (Ambient vs Dashboard)
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const saved = localStorage.getItem('job_dashboard_view_mode');
    return saved === 'ambient' ? 'ambient' : 'dashboard';
  });

  // Telemetry & Spend
  const [spendSummary, setSpendSummary] = useState(() => getSpendSummary());
  const [overdueTouchpointCount, setOverdueTouchpointCount] = useState(0);
  const [fallbackBanner, setFallbackBanner] = useState(null);

  // Workforce Australia
  const [isWorkforceModalOpen, setIsWorkforceModalOpen] = useState(false);
  const [isWorkforceEnabled, setIsWorkforceEnabled] = useState(() => getWorkforceSettings().enabled);

  // Modals - Selected Entities
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedForGenerator, setSelectedForGenerator] = useState(null);
  const [selectedForInterviewPrep, setSelectedForInterviewPrep] = useState(null);
  const [selectedForMockInterview, setSelectedForMockInterview] = useState(null);
  const [selectedForOutreach, setSelectedForOutreach] = useState(null);
  const [selectedForOfferHub, setSelectedForOfferHub] = useState(null);
  const [selectedForDossier, setSelectedForDossier] = useState(null);
  const [selectedForInfluenceHub, setSelectedForInfluenceHub] = useState(null);
  const [selectedForAtsDiagnostic, setSelectedForAtsDiagnostic] = useState(null);
  const [selectedForLinkedInInbound, setSelectedForLinkedInInbound] = useState(null);
  const [selectedForCoverLetterPolarizer, setSelectedForCoverLetterPolarizer] = useState(null);
  const [selectedForScreeningSolver, setSelectedForScreeningSolver] = useState(null);
  const [selectedForKscGenerator, setSelectedForKscGenerator] = useState(null);
  const [selectedForSeekPass, setSelectedForSeekPass] = useState(null);
  const [selectedForCheatSheet, setSelectedForCheatSheet] = useState(null);
  const [selectedForRecruiterCrm, setSelectedForRecruiterCrm] = useState(null);
  const [selectedAutoApplyJob, setSelectedAutoApplyJob] = useState(null);
  const [compareJobs, setCompareJobs] = useState([]);
  const [selfHealSource, setSelfHealSource] = useState(null);

  // Modals - Boolean Open Flags
  const [isRecruiterCrmOpen, setIsRecruiterCrmOpen] = useState(false);
  const [isFunnelModalOpen, setIsFunnelModalOpen] = useState(false);
  const [isCareerModalOpen, setIsCareerModalOpen] = useState(false);
  const [isPdfStudioOpen, setIsPdfStudioOpen] = useState(false);
  const [isScoringTunerOpen, setIsScoringTunerOpen] = useState(false);
  const [isVoiceInterviewOpen, setIsVoiceInterviewOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isBatchApplyOpen, setIsBatchApplyOpen] = useState(false);
  const [isCustomJobModalOpen, setIsCustomJobModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSkillGapModalOpen, setIsSkillGapModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isSourceSelfHealOpen, setIsSourceSelfHealOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isGoogleIntegrationOpen, setIsGoogleIntegrationOpen] = useState(false);

  // Header Dropdown / Drawer
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const toolsMenuRef = useRef(null);

  // Subscribe to LLM Spend Updates
  useEffect(() => {
    const unsubscribe = subscribeToSpendUpdates((summary) => {
      setSpendSummary(summary);
    });
    return () => unsubscribe();
  }, []);

  // Fetch recruiter cadence radar on mount
  useEffect(() => {
    fetchCadenceRadar().then((radar) => {
      if (radar && typeof radar.overdue_count === 'number') {
        setOverdueTouchpointCount(radar.overdue_count);
      }
    }).catch(() => {});
  }, []);

  // Workforce Australia settings event listener
  useEffect(() => {
    const handleSettingsUpdate = (e) => {
      if (e?.detail?.enabled !== undefined) {
        setIsWorkforceEnabled(Boolean(e.detail.enabled));
      } else {
        setIsWorkforceEnabled(getWorkforceSettings().enabled);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('workforce-settings-updated', handleSettingsUpdate);
      return () => window.removeEventListener('workforce-settings-updated', handleSettingsUpdate);
    }
  }, []);

  // Sync profile when updated across any component or window event
  useEffect(() => {
    const handleProfileUpdate = (e) => {
      if (e?.detail && typeof e.detail === 'object') {
        setActiveProfile(e.detail);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('profile-updated', handleProfileUpdate);
      window.addEventListener('candidate-profile-updated', handleProfileUpdate);
      window.addEventListener('profile_updated', handleProfileUpdate);
      window.addEventListener('user_profile_updated', handleProfileUpdate);
      return () => {
        window.removeEventListener('profile-updated', handleProfileUpdate);
        window.removeEventListener('candidate-profile-updated', handleProfileUpdate);
        window.removeEventListener('profile_updated', handleProfileUpdate);
        window.removeEventListener('user_profile_updated', handleProfileUpdate);
      };
    }
  }, []);

  // Load backend profile when currentUser is authenticated
  useEffect(() => {
    if (currentUser?.id) {
      fetchProfileFromBackend(currentUser.id, currentUser.email)
        .then((remoteProf) => {
          if (remoteProf && Object.keys(remoteProf).length > 0) {
            setActiveProfile((prev) => ({
              ...(prev || {}),
              ...remoteProf,
              email: currentUser.email || remoteProf.email || prev?.email,
              name: currentUser.name || remoteProf.name || prev?.name,
            }));
          }
        })
        .catch(() => {});
    }
  }, [currentUser?.id, currentUser?.email, currentUser?.name]);

  // Keep backend profile queries in sync
  useEffect(() => {
    if (activeProfile) {
      syncProfileQueriesToBackend(activeProfile);
    }
  }, [activeProfile?.id, activeProfile?.industry]);

  // View mode persistence and remote sync
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('job_dashboard_view_mode', viewMode);
    }
    fetchPreferencesFromBackend()
      .then((prefs) => savePreferencesToBackend({ ...(prefs || {}), viewMode }))
      .catch(() => {});
  }, [viewMode]);

  // First-visit restore: adopt backend's saved viewMode if none in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('job_dashboard_view_mode')) return undefined;
    let cancelled = false;
    fetchPreferencesFromBackend()
      .then((prefs) => {
        if (!cancelled && prefs?.viewMode) {
          setViewMode(prefs.viewMode);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Static fallback data listener
  useEffect(() => {
    const handleFallbackActive = (e) => {
      const detail = e.detail || {};
      const ts = detail.fallbackTimestamp;
      const formattedAge = ts ? new Date(ts).toLocaleString() : 'Cached Snapshot';
      setFallbackBanner(`Serving static fallback data (Snapshot: ${formattedAge}). Live scraper API offline or unreachable.`);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('jobs-fallback-active', handleFallbackActive);
      return () => window.removeEventListener('jobs-fallback-active', handleFallbackActive);
    }
  }, []);

  // Billing status & pricing modal event listeners
  useEffect(() => {
    fetchBillingStatus().then((status) => {
      if (status) setBillingStatus(status);
    }).catch(() => {});

    const handleOpenPricingModal = (e) => {
      setPricingModalReason(e?.detail?.reason || 'upgrade');
      setIsPricingModalOpen(true);
    };

    const handleBillingStatusUpdate = (e) => {
      if (e?.detail) setBillingStatus(e.detail);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('open-pricing-modal', handleOpenPricingModal);
      window.addEventListener('billing-status-updated', handleBillingStatusUpdate);

      // Check URL parameters for Stripe return redirects
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('payment') === 'success') {
        if (addToast) addToast('Pro subscription activated! Built-in AI models are ready.', 'success');
        fetchBillingStatus({ force: true }).then((status) => {
          if (status) setBillingStatus(status);
        }).catch(() => {});
        window.history.replaceState({}, '', window.location.pathname);
      } else if (urlParams.get('payment') === 'cancelled') {
        if (addToast) addToast('Checkout cancelled. You can upgrade anytime to access built-in AI.', 'info');
        window.history.replaceState({}, '', window.location.pathname);
      }

      return () => {
        window.removeEventListener('open-pricing-modal', handleOpenPricingModal);
        window.removeEventListener('billing-status-updated', handleBillingStatusUpdate);
      };
    }
  }, [addToast]);

  // Global Ctrl+K / Cmd+K listener for Command Palette
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, []);

  // Tools menu outside click listener
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target)) {
        setIsToolsMenuOpen(false);
      }
    };
    if (isToolsMenuOpen && typeof document !== 'undefined') {
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [isToolsMenuOpen]);

  // Derive current industry theme and apply variables smoothly
  const currentIndustryTheme = useMemo(() => {
    return getIndustryTheme(activeProfile?.industry);
  }, [activeProfile?.industry]);

  useEffect(() => {
    applyIndustryTheme(activeProfile?.industry, billingStatus);
  }, [activeProfile?.industry, billingStatus]);

  // Add suggested title helper
  const handleAddSuggestedTitle = useCallback((title) => {
    if (!activeProfile) return;
    const updated = {
      ...activeProfile,
      targetTitles: [...new Set([...(activeProfile.targetTitles || []), title])],
    };
    saveProfile(updated);
    setActiveProfile(updated);
  }, [activeProfile]);

  // Real-time live derived modal targets
  const liveSelectedJob = useMemo(() => resolveLiveJob(selectedJob, jobs), [selectedJob, jobs]);
  const liveSelectedForGenerator = useMemo(() => resolveLiveJob(selectedForGenerator, jobs), [selectedForGenerator, jobs]);
  const liveSelectedForInterviewPrep = useMemo(() => resolveLiveJob(selectedForInterviewPrep, jobs), [selectedForInterviewPrep, jobs]);
  const liveSelectedForMockInterview = useMemo(() => resolveLiveJob(selectedForMockInterview, jobs), [selectedForMockInterview, jobs]);
  const liveSelectedForOutreach = useMemo(() => resolveLiveJob(selectedForOutreach, jobs), [selectedForOutreach, jobs]);
  const liveSelectedForOfferHub = useMemo(() => resolveLiveJob(selectedForOfferHub, jobs), [selectedForOfferHub, jobs]);
  const liveSelectedForDossier = useMemo(() => resolveLiveJob(selectedForDossier, jobs), [selectedForDossier, jobs]);
  const liveSelectedForInfluenceHub = useMemo(() => resolveLiveJob(selectedForInfluenceHub, jobs), [selectedForInfluenceHub, jobs]);
  const liveSelectedForAtsDiagnostic = useMemo(() => resolveLiveJob(selectedForAtsDiagnostic, jobs), [selectedForAtsDiagnostic, jobs]);
  const liveSelectedForLinkedInInbound = useMemo(() => resolveLiveJob(selectedForLinkedInInbound, jobs), [selectedForLinkedInInbound, jobs]);
  const liveSelectedForCoverLetterPolarizer = useMemo(() => resolveLiveJob(selectedForCoverLetterPolarizer, jobs), [selectedForCoverLetterPolarizer, jobs]);
  const liveSelectedForScreeningSolver = useMemo(() => resolveLiveJob(selectedForScreeningSolver, jobs), [selectedForScreeningSolver, jobs]);
  const liveSelectedForKscGenerator = useMemo(() => resolveLiveJob(selectedForKscGenerator, jobs), [selectedForKscGenerator, jobs]);
  const liveSelectedForSeekPass = useMemo(() => resolveLiveJob(selectedForSeekPass, jobs), [selectedForSeekPass, jobs]);
  const liveSelectedForCheatSheet = useMemo(() => resolveLiveJob(selectedForCheatSheet, jobs), [selectedForCheatSheet, jobs]);

  // Bundle structured modal state
  const modalState = useMemo(() => ({
    selected: {
      job: liveSelectedJob,
      generator: liveSelectedForGenerator,
      interviewPrep: liveSelectedForInterviewPrep,
      mockInterview: liveSelectedForMockInterview,
      outreach: liveSelectedForOutreach,
      offerHub: liveSelectedForOfferHub,
      dossier: liveSelectedForDossier,
      influenceHub: liveSelectedForInfluenceHub,
      atsDiagnostic: liveSelectedForAtsDiagnostic,
      linkedInInbound: liveSelectedForLinkedInInbound,
      coverLetterPolarizer: liveSelectedForCoverLetterPolarizer,
      screeningSolver: liveSelectedForScreeningSolver,
      kscGenerator: liveSelectedForKscGenerator,
      seekPass: liveSelectedForSeekPass,
      cheatSheet: liveSelectedForCheatSheet,
      recruiterCrm: selectedForRecruiterCrm,
      autoApply: selectedAutoApplyJob,
      compareJobs,
      selfHealSource,
    },
    setSelected: {
      setJob: setSelectedJob,
      setGenerator: setSelectedForGenerator,
      setInterviewPrep: setSelectedForInterviewPrep,
      setMockInterview: setSelectedForMockInterview,
      setOutreach: setSelectedForOutreach,
      setOfferHub: setSelectedForOfferHub,
      setDossier: setSelectedForDossier,
      setInfluenceHub: setSelectedForInfluenceHub,
      setAtsDiagnostic: setSelectedForAtsDiagnostic,
      setLinkedInInbound: setSelectedForLinkedInInbound,
      setCoverLetterPolarizer: setSelectedForCoverLetterPolarizer,
      setScreeningSolver: setSelectedForScreeningSolver,
      setKscGenerator: setSelectedForKscGenerator,
      setSeekPass: setSelectedForSeekPass,
      setCheatSheet: setSelectedForCheatSheet,
      setRecruiterCrm: setSelectedForRecruiterCrm,
      setAutoApply: setSelectedAutoApplyJob,
      setCompareJobs,
      setSelfHealSource,
    },
    flags: {
      isRecruiterCrmOpen,
      isFunnelModalOpen,
      isCareerModalOpen,
      isWorkforceModalOpen,
      isWorkforceEnabled,
      isPdfStudioOpen,
      isScoringTunerOpen,
      isVoiceInterviewOpen,
      isCommandPaletteOpen,
      isBatchApplyOpen,
      isCustomJobModalOpen,
      isProfileModalOpen,
      isSettingsOpen,
      isSkillGapModalOpen,
      isCompareModalOpen,
      isSourceSelfHealOpen,
      isAuthModalOpen,
      isGoogleIntegrationOpen,
      isPricingModalOpen,
      pricingModalReason,
    },
    setFlags: {
      setIsRecruiterCrmOpen,
      setIsFunnelModalOpen,
      setIsCareerModalOpen,
      setIsWorkforceModalOpen,
      setIsWorkforceEnabled,
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
      setIsSourceSelfHealOpen,
      setIsAuthModalOpen,
      setIsGoogleIntegrationOpen,
      setIsPricingModalOpen,
      setPricingModalReason,
    },
  }), [
    liveSelectedJob,
    liveSelectedForGenerator,
    liveSelectedForInterviewPrep,
    liveSelectedForMockInterview,
    liveSelectedForOutreach,
    liveSelectedForOfferHub,
    liveSelectedForDossier,
    liveSelectedForInfluenceHub,
    liveSelectedForAtsDiagnostic,
    liveSelectedForLinkedInInbound,
    liveSelectedForCoverLetterPolarizer,
    liveSelectedForScreeningSolver,
    liveSelectedForKscGenerator,
    liveSelectedForSeekPass,
    liveSelectedForCheatSheet,
    selectedForRecruiterCrm,
    selectedAutoApplyJob,
    compareJobs,
    selfHealSource,
    isRecruiterCrmOpen,
    isFunnelModalOpen,
    isCareerModalOpen,
    isWorkforceModalOpen,
    isWorkforceEnabled,
    isPdfStudioOpen,
    isScoringTunerOpen,
    isVoiceInterviewOpen,
    isCommandPaletteOpen,
    isBatchApplyOpen,
    isCustomJobModalOpen,
    isProfileModalOpen,
    isSettingsOpen,
    isSkillGapModalOpen,
    isCompareModalOpen,
    isSourceSelfHealOpen,
    isAuthModalOpen,
    isGoogleIntegrationOpen,
    isPricingModalOpen,
    pricingModalReason,
  ]);

  return {
    // Navigation
    activeSection,
    setActiveSection,
    RouteSync,

    // Profile
    activeProfile,
    setActiveProfile,
    editingProfile,
    setEditingProfile,
    profileCompleteness,
    isCompletenessDismissed,
    setIsCompletenessDismissed,
    handleAddSuggestedTitle,

    // Billing & Mode
    billingStatus,
    setBillingStatus,
    isPricingModalOpen,
    setIsPricingModalOpen,
    pricingModalReason,
    setPricingModalReason,
    viewMode,
    setViewMode,

    // Telemetry & Spend
    spendSummary,
    overdueTouchpointCount,
    fallbackBanner,
    setFallbackBanner,
    isWorkforceEnabled,
    setIsWorkforceEnabled,
    isWorkforceModalOpen,
    setIsWorkforceModalOpen,
    currentIndustryTheme,

    // UI Drawer / Menu
    isToolsMenuOpen,
    setIsToolsMenuOpen,
    isMobileDrawerOpen,
    setIsMobileDrawerOpen,
    toolsMenuRef,

    // Direct access to modal setters (for Header and Tabs)
    setSelectedJob,
    setSelectedForGenerator,
    setSelectedForInterviewPrep,
    setSelectedForMockInterview,
    setSelectedForOutreach,
    setSelectedForOfferHub,
    setSelectedForDossier,
    setSelectedForInfluenceHub,
    setSelectedForAtsDiagnostic,
    setSelectedForLinkedInInbound,
    setSelectedForCoverLetterPolarizer,
    setSelectedForScreeningSolver,
    setSelectedForKscGenerator,
    setSelectedForSeekPass,
    setSelectedForCheatSheet,
    setSelectedForRecruiterCrm,
    setSelectedAutoApplyJob,
    setCompareJobs,
    setSelfHealSource,
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
    setIsSourceSelfHealOpen,
    setIsAuthModalOpen,
    setIsGoogleIntegrationOpen,

    // Structured modal state for DashboardModals component
    modalState,
  };
}
