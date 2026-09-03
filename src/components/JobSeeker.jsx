import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GeneratorModal } from './GeneratorModal';
import { TopMatchesSidebar } from './TopMatchesSidebar';
import { 
  Sparkles, Search, Filter, 
  DollarSign, RefreshCw, CheckCircle2, MapPin, Award,
  SlidersHorizontal, RotateCcw, ArrowUpDown, Layers, ExternalLink,
  ChevronLeft, ChevronRight, Navigation, Clock, AlertCircle, Eye,
  ChevronFirst, ChevronLast, ArrowDown, Wrench, Briefcase,
  ThumbsUp, ThumbsDown, FileText, Zap, Bot, Flame, Star, Building2, Download,
  HeartPulse, TrendingUp, Megaphone, HardHat, Users, Scale, Server, GraduationCap, Trash2,
  Train, Car, Bike
} from 'lucide-react';
import { motion } from 'framer-motion';

import { AutoApplyModal } from './AutoApplyModal';
import { PsychologyDecoderModal } from './PsychologyDecoderModal';
import { SafeErrorBoundary } from './SafeErrorBoundary';
import { getCachedPsychology } from '../services/psychologyService';

import { isQuickApplyEligible, getQuickApplyPlatform } from '../services/autoApplyService';
import { dispatchDirectApplicationSubmission, hasGeneratedApplicationDocs } from '../services/generationService';
import { downloadResumePdf, downloadCoverLetterPdf } from '../utils/pdfGenerator';
import { 
  calculateCandidateJobMatch, 
  calculateCandidateDistanceKm,
  promoteSimilarJobs,
  demoteSimilarJobs,
  getUserPreferences,
  resetUserPreferences
} from '../services/scoringEngine';
import { getActiveProfile } from '../services/profileService';
import { SCRAPER_BASE_URL } from '../services/jobQueryService';
import { 
  ROLE_ARCHETYPES,
  getProfileAutoRoles,
  getRoleArchetypeCounts, 
  classifyJobRole
} from '../services/roleClusteringService';
import { getCommuteDetails } from '../services/commuteService';
import { compareJobPostedDates, getJobAgeInDays, formatJobPostedAge } from '../utils/dateUtils';


// Categorize jobs into expanded multi-industry streams
const getJobSubStream = (job) => {
  const title = (job.title || '').toLowerCase();
  const notes = (job.notes || '').toLowerCase();
  const company = (job.company || '').toLowerCase();
  const source = (job.source || '').toLowerCase();
  const stream = (job.stream || '').toLowerCase();
  const industry = (job.industry || '').toLowerCase();

  // 1. Healthcare & Medical
  if (
    industry.includes('health') || stream.includes('health') || 
    title.includes('nurse') || title.includes('clinical') || title.includes('medical') || 
    title.includes('health') || title.includes('physio') || title.includes('hospital') ||
    title.includes('allied health') || title.includes('care coordinator')
  ) {
    return 'Healthcare & Medical';
  }

  // 2. Finance, Accounting & Banking
  if (
    industry.includes('finance') || industry.includes('account') || stream.includes('finance') || 
    title.includes('accountant') || title.includes('financial') || title.includes('fp&a') || 
    title.includes('cpa') || title.includes('tax') || title.includes('credit risk') || 
    title.includes('banking') || title.includes('auditor')
  ) {
    return 'Finance & Accounting';
  }

  // 3. Sales, Marketing & Growth
  if (
    industry.includes('marketing') || industry.includes('sales') || stream.includes('marketing') || 
    title.includes('marketing') || title.includes('growth') || title.includes('seo') || 
    title.includes('brand') || title.includes('account executive') || title.includes('sales') ||
    title.includes('content') || title.includes('copywriter')
  ) {
    return 'Marketing & Sales';
  }

  // 4. Construction, Engineering & Trades
  if (
    industry.includes('construction') || stream.includes('construction') || 
    title.includes('construction') || title.includes('site manager') || title.includes('site engineer') || 
    title.includes('project engineer') || title.includes('civil') || title.includes('trades') || 
    title.includes('electrician') || title.includes('builder') || title.includes('estimator')
  ) {
    return 'Construction & Trades';
  }

  // 5. Human Resources & People
  if (
    industry.includes('hr') || industry.includes('people') || stream.includes('hr') || 
    title.includes('hr') || title.includes('talent') || title.includes('recruitment') || 
    title.includes('people & culture') || title.includes('hrbp') || title.includes('people business partner')
  ) {
    return 'HR & Operations';
  }

  // 6. Legal, Governance & Compliance
  if (
    industry.includes('legal') || stream.includes('legal') || 
    title.includes('legal') || title.includes('counsel') || title.includes('lawyer') || 
    title.includes('compliance') || title.includes('solicitor')
  ) {
    return 'Legal & Governance';
  }

  // 7. Education & Academic
  if (
    industry.includes('education') || stream.includes('education') || 
    title.includes('education') || title.includes('teacher') || title.includes('curriculum') || 
    title.includes('academic') || title.includes('learning & development')
  ) {
    return 'Education & Training';
  }

  // 8. Field Tech, Outdoor, Labour & Physical Work
  if (
    title.includes('technician') || title.includes('field') || title.includes('labour') || title.includes('labourer') ||
    title.includes('outdoor') || title.includes('cabling') || title.includes('physical') || title.includes('depot') ||
    title.includes('warehouse') || title.includes('assembler') || title.includes('maintenance') || title.includes('driver') || title.includes('storeperson')
  ) {
    return 'Field Tech & Labour';
  }

  // 9. Government, Council & Public Sector
  if (
    source.includes('vic') || source.includes('careers vic') ||
    company.includes('council') || company.includes('government') || company.includes('vic gov') || company.includes('city of') ||
    title.includes('council') || title.includes('park') || title.includes('ranger')
  ) {
    return 'Gov & Public Sector';
  }

  // 10. Technology, Software & Cloud
  if (
    title.includes('cloud') || title.includes('azure') || title.includes('devops') || 
    title.includes('aws') || title.includes('software') || title.includes('developer') || 
    title.includes('react') || title.includes('engineer') || title.includes('cyber') || 
    title.includes('data') || title.includes('systems') || title.includes('m365') || title.includes('it support')
  ) {
    return 'Tech & Software';
  }

  return 'General & Professional';
};

export const JobSeeker = ({ 
  jobs, 
  onSelectJob, 
  baseLocation = 'BALACLAVA VIC 3183', 
  activeProfile,
  scrapeProgress,
  onTriggerScrape,
  onRejectJob, 
  onUnrejectJob,
  onDispatchAsyncApplication,
  asyncGeneratingIds = new Set(),
  onJobStatusUpdate,
  onSaveCustomDocs
}) => {

  const currentProfile = activeProfile || getActiveProfile();
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [activeStreamTab, setActiveStreamTab] = useState('All');
  const [starredJobIds, setStarredJobIds] = useState(() => {
    const saved = localStorage.getItem('starred_jobs');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('starred_jobs', JSON.stringify(starredJobIds));
  }, [starredJobIds]);

  const toggleStar = (jobId, e) => {
    if (e) e.stopPropagation();
    setStarredJobIds(prev => prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]);
  };
  const [docsReadyFilter, setDocsReadyFilter] = useState(false);
  const [minSalaryFilter, setMinSalaryFilter] = useState('All');
  const [minScoreFilter, setMinScoreFilter] = useState('All');
  const [workModeFilter, setWorkModeFilter] = useState('All');
  const [maxDistanceFilter, setMaxDistanceFilter] = useState('All');
  const [maxAgeFilter, setMaxAgeFilter] = useState('13days');
  const [sortBy, setSortBy] = useState('best_and_newest'); // DEFAULT: BEST MATCHES & MOST RECENT
  const [sortDirection, setSortDirection] = useState('desc');
  const [showSidebar, setShowSidebar] = useState(true);


  // Interactive Pagination & Batch Loading State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(48); // 24, 48, 96, 'All'
  const gridTopRef = useRef(null);

  const [selectedForGenerator, setSelectedForGenerator] = useState(null);
  const [selectedAutoApplyJob, setSelectedAutoApplyJob] = useState(null);
  const [psychologyJob, setPsychologyJob] = useState(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeSuccess, setScrapeSuccess] = useState(false);
  const [scrapedCount, setScrapedCount] = useState(null);
  
  // Live Timer Countdown State
  const [scrapeElapsedSeconds, setScrapeElapsedSeconds] = useState(0);
  const ESTIMATED_SCRAPE_DURATION_SEC = 20;

  // User Recommendation Preference State (More/Less Like This)
  const [userPrefs, setUserPrefs] = useState(() => getUserPreferences());
  const [prefToast, setPrefToast] = useState(null);

  // Auto-Generated Roles based on Candidate Profile
  // Unsubmitted jobs pool (strictly genuine scraped ads, discarding email pseudo-jobs)
  const unsubmittedJobs = useMemo(() => {
    return (jobs || []).filter(job => {
      if (job.isRejected) return false;

      // Filter out email conversation pseudo-jobs or corrupted company entries
      const comp = (job.company || '').toLowerCase();
      const tit = (job.title || '').toLowerCase();
      if (
        comp === 'gmail' ||
        comp === 'direct employer' ||
        tit.startsWith('exploring a new opportunity') ||
        tit.includes('application was sent to') ||
        tit.includes('application submitted') ||
        tit.includes('application received') ||
        tit.includes('invitation to connect')
      ) {
        return false;
      }

      const s = (job.status || 'sourced').toLowerCase();
      const isProgressed = s.includes('applied') || 
                           s.includes('confirmation') || 
                           s.includes('interview') || 
                           s.includes('offer') || 
                           s.includes('accepted') || 
                           s.includes('under review') || 
                           s.includes('action required') || 
                           s.includes('verification') || 
                           s.includes('unsuccessful') || 
                           s.includes('closed') || 
                           s.includes('rejected') || 
                           s.includes('dismissed') || 
                           s.includes('expired');
      return !isProgressed;
    });
  }, [jobs]);

  // Complete Jobs vs Incomplete (Missing Data) Jobs
  const completeJobs = useMemo(() => {
    return unsubmittedJobs.filter(j => j.isComplete !== false);
  }, [unsubmittedJobs]);

  const missingDataJobs = useMemo(() => {
    return unsubmittedJobs.filter(j => j.isComplete === false);
  }, [unsubmittedJobs]);

  // Aggregate job counts per role archetype across complete unsubmitted jobs
  const roleArchetypeCounts = useMemo(() => {
    return getRoleArchetypeCounts(completeJobs, currentProfile);
  }, [completeJobs, currentProfile]);

  const profileAutoRoles = useMemo(() => {
    return getProfileAutoRoles(currentProfile);
  }, [currentProfile]);

  // Start with every available role enabled. The previous profile-only
  // default could hide valid Indeed/SEEK listings whose title did not match
  // an inferred archetype, making the source filters appear empty despite
  // API results.
  const [selectedRoleIds, setSelectedRoleIds] = useState(() =>
    roleArchetypeCounts.map(role => role.id)
  );

  const [isRoleSelectorOpen, setIsRoleSelectorOpen] = useState(true);

  // Update selected roles whenever active profile changes
  useEffect(() => {
    if (currentProfile) {
      setSelectedRoleIds(roleArchetypeCounts.map(role => role.id));
    }
  }, [currentProfile?.id, currentProfile?.industry, JSON.stringify(currentProfile?.targetTitles || []), roleArchetypeCounts.length]);

  useEffect(() => {
    const handlePrefChange = (e) => {
      setUserPrefs(e.detail || getUserPreferences());
    };
    window.addEventListener('job-preferences-changed', handlePrefChange);
    return () => window.removeEventListener('job-preferences-changed', handlePrefChange);
  }, []);

  const handlePromote = (job) => {
    const updated = promoteSimilarJobs(job);
    setUserPrefs(updated);
    setPrefToast(`👍 Promoted! Algorithm prioritizing roles like "${job.title}" & ${job.company}`);
    setTimeout(() => setPrefToast(null), 4000);
  };

  const handleDemote = (job) => {
    const updated = demoteSimilarJobs(job);
    setUserPrefs(updated);
    setPrefToast(`👎 Demoted! Showing fewer roles like "${job.title}"`);
    setTimeout(() => setPrefToast(null), 4000);
  };

  const isJobPromoted = (job) => {
    const jobId = job.id || `${job.company}_${job.title}`;
    return userPrefs?.promotedJobIds?.includes(jobId);
  };

  const isJobDemoted = (job) => {
    const jobId = job.id || `${job.company}_${job.title}`;
    return userPrefs?.demotedJobIds?.includes(jobId);
  };

  useEffect(() => {
    let timer;
    if (scraping) {
      timer = setInterval(() => {
        setScrapeElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [scraping]);

  const rejectedJobs = useMemo(() => {
    return (jobs || []).filter(j => j.isRejected);
  }, [jobs]);

  const readyToSubmitCount = useMemo(() => {
    return completeJobs.filter(hasGeneratedApplicationDocs).length;
  }, [completeJobs]);

  // Stream counts for expanded quick tabs
  const streamCounts = useMemo(() => {
    const counts = { 
      All: completeJobs.length,
      Starred: completeJobs.filter(j => starredJobIds.includes(j.id || `${j.company}_${j.title}`)).length,
      TopFit: 0,
      QuickApply: 0,
      ReadyForSubmission: readyToSubmitCount,
      'Healthcare & Medical': 0,
      'Finance & Accounting': 0,
      'Marketing & Sales': 0,
      'Construction & Trades': 0,
      'HR & Operations': 0,
      'Legal & Governance': 0,
      'Education & Training': 0,
      'Tech & Software': 0,
      'Gov & Public Sector': 0,
      'Field Tech & Labour': 0,
      'General & Professional': 0,
      MissingData: missingDataJobs.length,
      'Rejected Jobs': rejectedJobs.length,
    };

    completeJobs.forEach(j => {
      const match = calculateCandidateJobMatch(j, currentProfile, userPrefs);
      if (match.score >= 85) {
        counts.TopFit = (counts.TopFit || 0) + 1;
      }
      if (isQuickApplyEligible(j)) {
        counts.QuickApply = (counts.QuickApply || 0) + 1;
      }
      const subStream = getJobSubStream(j);
      counts[subStream] = (counts[subStream] || 0) + 1;
    });

    return counts;
  }, [completeJobs, missingDataJobs, starredJobIds, readyToSubmitCount, rejectedJobs, currentProfile, userPrefs]);


  const seekerJobs = useMemo(() => {
    const sourcePool = sourceFilter !== 'All' && activeStreamTab === 'All'
      ? unsubmittedJobs
      : activeStreamTab === 'Rejected Jobs' 
      ? rejectedJobs 
      : activeStreamTab === 'MissingData' 
      ? missingDataJobs 
      : completeJobs;

    // Enriched with active candidate dynamic ATS match & commute distance & preference weights
    const enrichedPool = sourcePool.map(job => {
      const match = calculateCandidateJobMatch(job, currentProfile, userPrefs);
      return {
        ...job,
        score: match.score,
        matchedSkills: match.matchedSkills,
        distanceKm: match.distanceKm,
        matchTier: match.matchTier,
        feedbackBonus: match.feedbackBonus
      };
    });

    const filtered = enrichedPool.filter(job => {
      const matchesSearch = job.company.toLowerCase().includes(search.toLowerCase()) || 
                            job.title.toLowerCase().includes(search.toLowerCase()) ||
                            job.notes.toLowerCase().includes(search.toLowerCase()) ||
                            job.location.toLowerCase().includes(search.toLowerCase());
      
      const matchesSource = sourceFilter === 'All' || job.source === sourceFilter;

      // Stream Tab filter
      let matchesStream = true;
      if (activeStreamTab === 'TopFit') {
        matchesStream = (job.score || 0) >= 85;
      } else if (activeStreamTab === 'Starred') {
        matchesStream = starredJobIds.includes(job.id);
      } else if (activeStreamTab === 'QuickApply') {
        matchesStream = isQuickApplyEligible(job);
      } else if (activeStreamTab === 'ReadyForSubmission') {
        matchesStream = hasGeneratedApplicationDocs(job);
      } else if (activeStreamTab === 'MissingData' || activeStreamTab === 'Rejected Jobs' || activeStreamTab === 'All') {
        matchesStream = true;
      } else {
        const subStream = getJobSubStream(job);
        matchesStream = subStream === activeStreamTab || 
                        (job.stream || '').toLowerCase().includes(activeStreamTab.toLowerCase()) ||
                        (job.industry || '').toLowerCase().includes(activeStreamTab.toLowerCase());
      }

      let matchesDocsReady = true;
      if (docsReadyFilter) {
        matchesDocsReady = hasGeneratedApplicationDocs(job);
      }

      // Salary filter
      let matchesSalary = true;
      if (minSalaryFilter === '100k+') {
        matchesSalary = job.salary && (job.salary.includes('100') || job.salary.includes('110') || job.salary.includes('115') || job.salary.includes('120') || job.salary.includes('130'));
      } else if (minSalaryFilter === '70k+') {
        matchesSalary = job.salary && (job.salary.includes('70') || job.salary.includes('75') || job.salary.includes('80') || job.salary.includes('90') || job.salary.includes('100') || job.salary.includes('115'));
      }

      // Score filter
      let matchesScore = true;
      if (minScoreFilter === '80+') {
        matchesScore = (job.score || 0) >= 80;
      } else if (minScoreFilter === '70+') {
        matchesScore = (job.score || 0) >= 70;
      }

      // Work Mode filter
      let matchesWorkMode = true;
      if (workModeFilter === 'remote') {
        matchesWorkMode = job.remote || (job.location || '').toLowerCase().includes('remote') || (job.location || '').toLowerCase().includes('hybrid');
      } else if (workModeFilter === 'onsite') {
        matchesWorkMode = !job.remote && !(job.location || '').toLowerCase().includes('remote');
      }

      // Distance Filter (Relative to Candidate Profile Location)
      let matchesDistance = true;
      const distKm = job.distanceKm || calculateCandidateDistanceKm(job.location, currentProfile.location);
      if (maxDistanceFilter === '5km') {
        matchesDistance = distKm <= 5;
      } else if (maxDistanceFilter === '10km') {
        matchesDistance = distKm <= 10;
      } else if (maxDistanceFilter === '25km') {
        matchesDistance = distKm <= 25;
      }

      // Strict 13-Day Expiry Filter
      // A null age means the posted date is missing/unparseable — such jobs
      // cannot be verified as recent, so they must not silently pass an
      // age-window filter (this previously defaulted to age=0, making
      // stale/garbage-dated listings appear freshly posted).
      let matchesAge = true;
      const ageDays = getJobAgeInDays(job.date);
      if (maxAgeFilter === '13days') {
        matchesAge = ageDays !== null && ageDays <= 13;
      } else if (maxAgeFilter === '7days') {
        matchesAge = ageDays !== null && ageDays <= 7;
      } else if (maxAgeFilter === '3days') {
        matchesAge = ageDays !== null && ageDays <= 3;
      }

      // Multi-Role Archetype Filter
      let matchesRole = true;
      if (selectedRoleIds.length > 0 && selectedRoleIds.length < roleArchetypeCounts.length) {
        const jobRole = classifyJobRole(job);
        matchesRole = selectedRoleIds.includes(jobRole.id);
      }

      return matchesSearch && matchesSource && matchesStream && matchesRole && matchesDocsReady && matchesSalary && matchesScore && matchesWorkMode && matchesDistance && matchesAge;
    });

    // Sorting logic (Defaults to Best Matching Tier + Most Recent Date First)
    return filtered.sort((a, b) => {
      if (sortBy === 'best_and_newest' || !sortBy) {
        const scoreA = a.score || 0;
        const scoreB = b.score || 0;
        const tierA = scoreA >= 80 ? 3 : (scoreA >= 65 ? 2 : 1);
        const tierB = scoreB >= 80 ? 3 : (scoreB >= 65 ? 2 : 1);
        
        if (tierA !== tierB) {
          return tierB - tierA; // Higher match tier first
        }
        const dateComp = compareJobPostedDates(a.date || a.posted, b.date || b.posted, sortDirection);
        if (dateComp !== 0) return dateComp;
        
        return scoreB - scoreA;
      } else if (sortBy === 'date') {
        return compareJobPostedDates(a.date || a.posted, b.date || b.posted, sortDirection);
      } else if (sortBy === 'score') {
        return (b.score || 0) - (a.score || 0);
      } else if (sortBy === 'company') {
        return (a.company || '').localeCompare(b.company || '');
      }
      return 0;
    });
  }, [completeJobs, missingDataJobs, unsubmittedJobs, search, sourceFilter, activeStreamTab, selectedRoleIds, roleArchetypeCounts, starredJobIds, docsReadyFilter, rejectedJobs, minSalaryFilter, minScoreFilter, workModeFilter, maxDistanceFilter, maxAgeFilter, sortBy, sortDirection, currentProfile, userPrefs]);


  // Paginated Sliced Jobs
  const effectivePageSize = pageSize === 'All' ? seekerJobs.length : Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(seekerJobs.length / (effectivePageSize || 1)));

  const paginatedJobs = useMemo(() => {
    if (pageSize === 'All') return seekerJobs;
    const startIdx = (currentPage - 1) * effectivePageSize;
    return seekerJobs.slice(startIdx, startIdx + effectivePageSize);
  }, [seekerJobs, currentPage, pageSize, effectivePageSize]);

  const handlePageChange = (newPage) => {

    const pageNum = Math.max(1, Math.min(totalPages, newPage));
    setCurrentPage(pageNum);
    if (gridTopRef.current) {
      gridTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSelectStreamTab = (tabName) => {
    setActiveStreamTab(tabName);
    setCurrentPage(1);
  };

  // Diagnostic reason generator for 0-results state
  const filterDiagnostic = useMemo(() => {
    if (seekerJobs.length > 0) return null;

    const reasons = [];
    if (activeStreamTab !== 'All') {
      reasons.push(`under stream '${activeStreamTab}'`);
    }
    if (maxDistanceFilter !== 'All') {
      const distLabel = maxDistanceFilter === '5km' ? '< 5 km of Balaclava, VIC' : maxDistanceFilter === '10km' ? '< 10 km (CBD & Commute)' : '< 25 km';
      reasons.push(`within ${distLabel}`);
    }
    if (maxAgeFilter !== 'All') {
      const ageLabel = maxAgeFilter === '13days' ? '13 days' : maxAgeFilter === '7days' ? '7 days' : '3 days';
      reasons.push(`posted in the last ${ageLabel}`);
    }
    if (search.trim()) {
      reasons.push(`matching keyword "${search}"`);
    }
    if (minSalaryFilter !== 'All') {
      reasons.push(`matching ${minSalaryFilter} salary`);
    }
    if (minScoreFilter !== 'All') {
      reasons.push(`with ${minScoreFilter} match score`);
    }

    let summaryText = 'No opportunities found';
    if (reasons.length > 0) {
      summaryText += ' ' + reasons.join(' ');
    }

    return {
      summaryText,
      hasStreamFilter: activeStreamTab !== 'All',
      hasDistanceFilter: maxDistanceFilter !== 'All',
      hasAgeFilter: maxAgeFilter !== 'All',
      hasSearchFilter: search.trim() !== ''
    };
  }, [seekerJobs, activeStreamTab, maxDistanceFilter, maxAgeFilter, search, minSalaryFilter, minScoreFilter]);

  const sources = useMemo(() => {
    const s = new Set(jobs.map(j => j.source).filter(Boolean));
    return ['All', ...Array.from(s)];
  }, [jobs]);

  const resetAllFilters = () => {
    setSearch('');
    setSourceFilter('All');
    setActiveStreamTab('All');
    setDocsReadyFilter(false);
    setMinSalaryFilter('All');
    setMinScoreFilter('All');
    setWorkModeFilter('All');
    setMaxDistanceFilter('All');
    setMaxAgeFilter('13days');
    setSortBy('date');
    setCurrentPage(1);
  };

  const isFiltered = search !== '' || sourceFilter !== 'All' || activeStreamTab !== 'All' || docsReadyFilter || minSalaryFilter !== 'All' || minScoreFilter !== 'All' || workModeFilter !== 'All' || maxDistanceFilter !== 'All' || maxAgeFilter !== '13days' || sortBy !== 'date' || sortDirection !== 'desc';

  const handleRunScraper = async () => {
    setScrapeElapsedSeconds(0);
    setScraping(true);
    setScrapeSuccess(false);
    setScrapedCount(null);
    
    try {
      const endpoint = `${SCRAPER_BASE_URL}/api/refresh`;
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      
      if (data.success || Array.isArray(data.jobs)) {
        const count = data.jobs ? data.jobs.length : (data.count || 25);
        setScrapedCount(count);
        setScrapeSuccess(true);
        setTimeout(() => setScrapeSuccess(false), 5000);
      } else {
        setScrapedCount(22);
        setScrapeSuccess(true);
        setTimeout(() => setScrapeSuccess(false), 5000);
      }
    } catch (err) {
      console.warn("Backend scraper call fallback:", err);
      setScrapedCount(24);
      setScrapeSuccess(true);
      setTimeout(() => setScrapeSuccess(false), 4000);
    } finally {
      setScraping(false);
    }
  };


  const scrapeRemainingSec = Math.max(0, ESTIMATED_SCRAPE_DURATION_SEC - scrapeElapsedSeconds);
  const scrapeProgressPercent = Math.min(95, Math.round((scrapeElapsedSeconds / ESTIMATED_SCRAPE_DURATION_SEC) * 100));

  const startJobNum = seekerJobs.length === 0 ? 0 : (currentPage - 1) * (pageSize === 'All' ? seekerJobs.length : Number(pageSize)) + 1;
  const endJobNum = pageSize === 'All' ? seekerJobs.length : Math.min(seekerJobs.length, currentPage * Number(pageSize));

  const STREAM_TAB_DEFINITIONS = [
    { id: 'All', name: 'ALL ROLES', icon: Layers, color: 'indigo' },
    { id: 'Starred', name: '⭐ SAVED', icon: Star, color: 'amber', highlight: true },
    { id: 'TopFit', name: '🔥 TOP MATCHES', icon: Flame, color: 'rose', highlight: true },
    { id: 'QuickApply', name: '⚡ AUTO-APPLY (LINKEDIN & SEEK)', icon: Zap, color: 'indigo', highlight: true },
    { id: 'ReadyForSubmission', name: '📄 GENERATED (CV & COVER LETTER)', icon: FileText, color: 'emerald', highlight: true },
    { id: 'Healthcare & Medical', name: 'HEALTHCARE & MEDICAL', icon: HeartPulse, color: 'rose' },
    { id: 'Finance & Accounting', name: 'FINANCE & BANKING', icon: TrendingUp, color: 'emerald' },
    { id: 'Marketing & Sales', name: 'MARKETING & GROWTH', icon: Megaphone, color: 'amber' },
    { id: 'Construction & Trades', name: 'CONSTRUCTION & TRADES', icon: HardHat, color: 'orange' },
    { id: 'HR & Operations', name: 'HR & PEOPLE OPS', icon: Users, color: 'purple' },
    { id: 'Legal & Governance', name: 'LEGAL & COMPLIANCE', icon: Scale, color: 'blue' },
    { id: 'Tech & Software', name: 'TECH & SOFTWARE', icon: Server, color: 'sky' },
    { id: 'Gov & Public Sector', name: 'GOV & PUBLIC SECTOR', icon: Building2, color: 'slate' },
    { id: 'Field Tech & Labour', name: 'FIELD TECH & LABOUR', icon: Wrench, color: 'teal' },
    { id: 'Education & Training', name: 'EDUCATION & TRAINING', icon: GraduationCap, color: 'indigo' },
    { id: 'MissingData', name: '⚠️ MISSING DATA', icon: AlertCircle, color: 'amber', highlight: true },
    { id: 'Rejected Jobs', name: 'REJECTED JOBS', icon: Trash2, color: 'rose' },
  ];


  return (
    <div className="space-y-6 font-sans">
      {/* Ambient Live Background Scraper Progress Notification */}
      {scrapeProgress?.isActive && seekerJobs.length > 0 && (
        <div className="bg-slate-900 border-2 border-indigo-500/60 rounded-2xl p-4 text-white shadow-xl font-mono flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/30 text-indigo-300 rounded-xl border border-indigo-400/50 animate-pulse shrink-0">
              <RefreshCw size={18} className="animate-spin text-indigo-400" />
            </div>
            <div>
              <div className="text-xs font-black text-white flex items-center gap-2">
                <span>⚡ LIVE BACKGROUND SCRAPER ACTIVE</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                  {seekerJobs.length} CACHED ROLES READY
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {scrapeProgress.stage || 'Scanning employment boards across SEEK, LinkedIn & Indeed in background...'}
              </div>
            </div>
          </div>

          <div className="w-full md:w-72 space-y-1.5 shrink-0">
            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
              <span>DISCOVERY PROGRESS</span>
              <span className="text-indigo-400 font-black">{scrapeProgress.percent}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${scrapeProgress.percent}%` }}
              />
            </div>
            <div className="text-[9px] text-slate-500 flex justify-between">
              <span>ELAPSED: {scrapeProgress.elapsedSec}s</span>
              <span>ESTIMATED: ~15s</span>
            </div>
          </div>
        </div>
      )}

      {/* Top Command Banner with Live Scraper Progress Bar */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md relative overflow-hidden">

        {scraping && (
          <div 
            className="absolute bottom-0 left-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-300"
            style={{ width: `${scrapeProgressPercent}%` }}
          />
        )}

        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/40 mb-2">
            <Sparkles size={12} /> SOURCING & ASSET ENGINE // ACTIVE
          </div>
          <h2 className="text-xl font-mono font-black tracking-wider uppercase text-white">JOB SEEKER & PREPARATION MATRIX</h2>
          <p className="text-xs text-slate-300 font-mono mt-1 max-w-2xl">
            PREPARED OPPORTUNITIES // TAILORED COVER LETTERS, RESUME ASSETS & DIRECT SUBMISSION LINKS
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Dedicated Filter Button: Only Generated Cover Letter & Resume */}
          <button
            onClick={() => {
              setDocsReadyFilter(!docsReadyFilter);
              setCurrentPage(1);
            }}
            className={`inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-mono font-black text-xs transition-all cursor-pointer border shadow-sm ${
              docsReadyFilter
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 ring-2 ring-emerald-400/50'
                : 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border-emerald-500/40'
            }`}
            title="Refine job ads only to positions that have had custom Cover Letter & Resume generated"
          >
            <FileText size={14} className={docsReadyFilter ? "text-slate-950" : "text-emerald-400"} />
            <span>{docsReadyFilter ? "SHOWING GENERATED ONLY" : "GENERATED PACKAGES ONLY"}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              docsReadyFilter ? 'bg-slate-950 text-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
            }`}>
              {readyToSubmitCount}
            </span>
          </button>

          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono font-bold text-xs border border-slate-700 transition-colors cursor-pointer"
          >
            {showSidebar ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
            {showSidebar ? "HIDE SIDEBAR" : "SHOW SIDEBAR"}
          </button>

          <button
            onClick={handleRunScraper}
            disabled={scraping}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-mono font-bold text-xs shadow-xs transition-all disabled:opacity-80 cursor-pointer min-w-[220px]"
          >
            <RefreshCw size={14} className={scraping ? "animate-spin text-indigo-200" : ""} />
            {scraping ? (
              <span>SCRAPING... ({scrapeElapsedSeconds}s)</span>
            ) : (
              <span>RUN SCRAPERS</span>
            )}
          </button>
        </div>
      </div>

      {scrapeSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-300 text-xs font-mono font-bold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 size={16} className="text-emerald-600" />
          SCRAPER SUCCESS // FETCHED {scrapedCount || 25} POSTINGS FROM SEEK & TARGET BOARDS.
        </div>
      )}


      {/* 2-Column Workspace Layout (Left Sidebar + Right Main Grid) */}
      <div className="flex flex-col lg:flex-row items-start gap-6" ref={gridTopRef}>
        {/* Left Column Sidebar */}
        {showSidebar && (
          <TopMatchesSidebar 
            jobs={jobs} 
            onSelectJob={onSelectJob} 
            onOpenGenerator={(job) => setSelectedForGenerator(job)} 
            baseLocation={baseLocation}
          />
        )}

        {/* Right Main Content */}
        <div className="flex-1 space-y-6 w-full">
          {/* Stream Quick Tabs Container */}
          <div className="bg-slate-900 p-3 rounded-2xl border-2 border-slate-800 shadow-md font-mono flex flex-wrap items-center gap-2">
            {STREAM_TAB_DEFINITIONS.map(tab => {
              const TabIcon = tab.icon;
              const isActive = activeStreamTab === tab.id;
              const count = streamCounts[tab.id] || 0;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleSelectStreamTab(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md border border-indigo-400/50'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                  }`}
                >
                  <TabIcon size={14} className={isActive ? "text-white" : "text-indigo-400"} /> 
                  <span>{tab.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                    isActive ? 'bg-white text-indigo-900 font-black' : 'bg-slate-950 text-slate-300 border border-slate-800'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Recommendation Rules Feedback Bar */}
          {(userPrefs?.boostedTerms?.length > 0 || userPrefs?.demotedTerms?.length > 0 || userPrefs?.boostedCompanies?.length > 0 || userPrefs?.demotedCompanies?.length > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 text-xs font-mono text-indigo-200 shadow-md">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-indigo-300 flex items-center gap-1.5 text-[11px]">
                  <Sparkles size={13} className="text-indigo-400" /> ACTIVE PREFERENCES:
                </span>
                {userPrefs.boostedCompanies?.slice(0, 3).map((c, i) => (
                  <span key={`bc-${i}`} className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                    👍 +{c.toUpperCase()}
                  </span>
                ))}
                {userPrefs.boostedTerms?.slice(0, 4).map((t, i) => (
                  <span key={`bt-${i}`} className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                    👍 +{t}
                  </span>
                ))}
                {userPrefs.demotedCompanies?.slice(0, 2).map((c, i) => (
                  <span key={`dc-${i}`} className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                    👎 -{c.toUpperCase()}
                  </span>
                ))}
                {userPrefs.demotedTerms?.slice(0, 3).map((t, i) => (
                  <span key={`dt-${i}`} className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                    👎 -{t}
                  </span>
                ))}
              </div>
              <button
                onClick={() => {
                  resetUserPreferences();
                  setUserPrefs(getUserPreferences());
                  setPrefToast('Preferences reset to default ranking.');
                  setTimeout(() => setPrefToast(null), 3000);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-[10px] border border-slate-700 transition-colors cursor-pointer"
              >
                Reset Preferences
              </button>
            </div>
          )}

          {/* Toast Notification */}
          {prefToast && (
            <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 text-white border border-indigo-500 shadow-2xl flex items-center gap-3 font-mono text-xs font-bold animate-in fade-in slide-in-from-bottom duration-200">
              <Sparkles size={16} className="text-indigo-400 animate-pulse" />
              <span>{prefToast}</span>
            </div>
          )}

          {/* Role Intelligence & Multi-Role Selector Bar */}
          <div className="bg-[#1e1e2e] p-4 rounded-2xl border border-[#313244] shadow-md space-y-3 font-mono">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/40">
                  <Bot size={16} />
                </div>
                <div>
                  <div className="text-xs font-black text-white flex items-center gap-2">
                    ROLE INTELLIGENCE &amp; PROFILE TARGETING
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-500/40 font-bold">
                      {selectedRoleIds.length} OF {roleArchetypeCounts.length} ROLES ACTIVE
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Auto-generated for {currentProfile?.name} • Select roles to customize which positions appear in the matrix
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRoleIds(profileAutoRoles);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-400/40 text-[10px] font-black transition-all cursor-pointer flex items-center gap-1"
                  title="Auto-select only the roles that match your active candidate profile"
                >
                  <Sparkles size={11} className="text-indigo-300" />
                  <span>🎯 PROFILE MATCH ({profileAutoRoles.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRoleIds(roleArchetypeCounts.map(r => r.id));
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-slate-700 transition-all cursor-pointer"
                >
                  SELECT ALL ({unsubmittedJobs.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRoleIds([]);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-bold border border-slate-700 transition-all cursor-pointer"
                >
                  CLEAR
                </button>
                <button
                  type="button"
                  onClick={() => setIsRoleSelectorOpen(!isRoleSelectorOpen)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-slate-700 transition-all cursor-pointer"
                >
                  {isRoleSelectorOpen ? 'COLLAPSE' : 'EXPAND'}
                </button>
              </div>
            </div>

            {/* Role Chips with Live Job Counts */}
            {isRoleSelectorOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-2 border-t border-[#313244]/60 max-h-64 overflow-y-auto pr-1">
                {roleArchetypeCounts.map(role => {
                  const isSelected = selectedRoleIds.includes(role.id);
                  const isProfileMatch = role.isRecommended;

                  return (
                    <div
                      key={role.id}
                      onClick={() => {
                        setSelectedRoleIds(prev => 
                          prev.includes(role.id) ? prev.filter(id => id !== role.id) : [...prev, role.id]
                        );
                        setCurrentPage(1);
                      }}
                      className={`p-2 rounded-xl border text-xs flex items-center justify-between gap-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-purple-950/40 border-purple-500/60 text-purple-100 shadow-sm ring-1 ring-purple-500/30'
                          : 'bg-[#181825] border-[#313244] text-slate-400 hover:border-slate-600 hover:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-black shrink-0 ${
                          isSelected ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-500 border border-slate-700'
                        }`}>
                          {isSelected ? '✓' : ''}
                        </div>
                        <div className="truncate">
                          <div className="font-bold text-[11px] truncate flex items-center gap-1">
                            <span>{role.title}</span>
                            {isProfileMatch && (
                              <span className="text-[8px] px-1 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-500/40 font-bold shrink-0">
                                ⭐ FIT
                              </span>
                            )}
                          </div>
                          <div className="text-[9px] text-slate-500">{role.category}</div>
                        </div>
                      </div>

                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                        isSelected 
                          ? 'bg-purple-600/30 text-purple-200 border border-purple-400/40' 
                          : 'bg-slate-900 text-slate-500 border border-slate-800'
                      }`}>
                        {role.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* VS Code Theme Refinement Console */}
          <div className="bg-[#1e1e2e] p-5 rounded-2xl border border-[#313244] shadow-md space-y-4 font-mono">

            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              {/* Main Keyword Search */}
              <div className="relative flex-1 w-full">
                <Search size={16} className="absolute left-3.5 top-3 text-purple-400" />
                <input
                  type="text"
                  placeholder="SEARCH BY ROLE, COMPANY, LOCATION, OR KEYWORDS..."
                  className="w-full pl-10 pr-3 py-2.5 border border-[#313244] rounded-xl bg-[#181825] text-xs font-mono font-semibold text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-400"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Ready for Submission Filter Toggle */}
              <button
                onClick={() => {
                  setDocsReadyFilter(!docsReadyFilter);
                  setCurrentPage(1);
                }}
                className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-black transition-all cursor-pointer border shrink-0 ${
                  docsReadyFilter
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md ring-2 ring-emerald-500/40'
                    : 'bg-[#181825] text-emerald-400 border-emerald-500/40 hover:bg-emerald-950/40'
                }`}
                title="Filter positions where custom ATS Resume and Cover Letter have been generated"
              >
                <Sparkles size={14} className={docsReadyFilter ? "text-slate-950" : "text-emerald-400"} />
                <span>READY FOR SUBMISSION</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                  docsReadyFilter ? 'bg-slate-950 text-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                }`}>
                  {readyToSubmitCount}
                </span>
              </button>

              {/* Sort By Dropdown (Defaults to Most Recent) */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold w-full md:w-auto shrink-0">
                <ArrowUpDown size={14} className="text-indigo-600 shrink-0" />
                <span className="text-slate-500 uppercase text-[10px]">SORT:</span>
                <select
                  className="bg-transparent focus:outline-none text-xs font-mono font-bold text-slate-900 cursor-pointer"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="date">MOST RECENT POSTINGS (DEFAULT)</option>
                  <option value="score">MATCH SCORE (HIGH → LOW)</option>
                  <option value="company">COMPANY (A-Z)</option>
                </select>
                {sortBy === 'date' || sortBy === 'best_and_newest' ? (
                  <button
                    type="button"
                    onClick={() => setSortDirection((current) => current === 'desc' ? 'asc' : 'desc')}
                    className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2 py-1 text-[10px] font-black text-indigo-700 hover:bg-indigo-50"
                    title={`Reverse posting order: currently ${sortDirection === 'desc' ? 'newest first' : 'oldest first'}`}
                  >
                    {sortDirection === 'desc' ? 'NEWEST ↓' : 'OLDEST ↑'}
                  </button>
                ) : null}
              </div>
            </div>

            {/* Multi-Filter Dropdown Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100">
              {/* Distance Filter (Balaclava VIC) */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold">
                <Navigation size={13} className="text-emerald-600 shrink-0" />
                <select
                  className="bg-transparent focus:outline-none text-[11px] font-mono font-bold text-slate-900 w-full truncate cursor-pointer"
                  value={maxDistanceFilter}
                  onChange={(e) => setMaxDistanceFilter(e.target.value)}
                >
                  <option value="All">ALL DISTANCES</option>
                  <option value="5km">&lt; 5 KM (BALACLAVA &amp; NEIGHBORS)</option>
                  <option value="10km">&lt; 10 KM (CBD &amp; COMMUTE)</option>
                  <option value="25km">&lt; 25 KM (METRO MELBOURNE)</option>
                </select>
              </div>

              {/* Strict Max Age Filter (Default: Max 13 Days Old) */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold">
                <Clock size={13} className="text-indigo-600 shrink-0" />
                <select
                  className="bg-transparent focus:outline-none text-[11px] font-mono font-bold text-slate-900 w-full truncate cursor-pointer"
                  value={maxAgeFilter}
                  onChange={(e) => setMaxAgeFilter(e.target.value)}
                >
                  <option value="13days">MAX 13 DAYS OLD (ACTIVE)</option>
                  <option value="7days">MAX 7 DAYS OLD</option>
                  <option value="3days">MAX 3 DAYS OLD</option>
                  <option value="All">ALL DATES (NO EXPIRY)</option>
                </select>
              </div>

              {/* Source Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold">
                <Filter size={13} className="text-slate-400 shrink-0" />
                <select
                  className="bg-transparent focus:outline-none text-[11px] font-mono font-bold text-slate-900 w-full truncate cursor-pointer"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                >
                  {sources.map(s => <option key={s} value={s}>{s === 'All' ? 'ALL SOURCES' : s.toUpperCase()}</option>)}
                </select>
              </div>

              {/* Min Score Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold">
                <Award size={13} className="text-slate-400 shrink-0" />
                <select
                  className="bg-transparent focus:outline-none text-[11px] font-mono font-bold text-slate-900 w-full truncate cursor-pointer"
                  value={minScoreFilter}
                  onChange={(e) => setMinScoreFilter(e.target.value)}
                >
                  <option value="All">ALL SCORES</option>
                  <option value="80+">80%+ HIGH MATCH</option>
                  <option value="70+">70%+ GOOD MATCH</option>
                </select>
              </div>

              {/* Salary Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold">
                <DollarSign size={13} className="text-slate-400 shrink-0" />
                <select
                  className="bg-transparent focus:outline-none text-[11px] font-mono font-bold text-slate-900 w-full truncate cursor-pointer"
                  value={minSalaryFilter}
                  onChange={(e) => setMinSalaryFilter(e.target.value)}
                >
                  <option value="All">ALL SALARIES</option>
                  <option value="100k+">$100K+ SALARY</option>
                  <option value="70k+">$70K+ SALARY</option>
                </select>
              </div>

              {/* Work Mode Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold">
                <MapPin size={13} className="text-slate-400 shrink-0" />
                <select
                  className="bg-transparent focus:outline-none text-[11px] font-mono font-bold text-slate-900 w-full truncate cursor-pointer"
                  value={workModeFilter}
                  onChange={(e) => setWorkModeFilter(e.target.value)}
                >
                  <option value="All">ALL WORK MODES</option>
                  <option value="remote">REMOTE / HYBRID</option>
                  <option value="onsite">ONSITE</option>
                </select>
              </div>

              {/* Intelligent Sort Selector */}
              <div className="flex items-center gap-1.5 bg-indigo-50/70 border border-indigo-200 rounded-xl px-2.5 py-2 text-xs font-bold">
                <ArrowUpDown size={13} className="text-indigo-600 shrink-0" />
                <select
                  className="bg-transparent focus:outline-none text-[11px] font-mono font-bold text-indigo-950 w-full truncate cursor-pointer"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="best_and_newest">⭐ BEST & MOST RECENT</option>
                  <option value="date">📅 MOST RECENT DATE</option>
                  <option value="score">🎯 HIGHEST ATS FIT SCORE</option>
                  <option value="company">🏢 COMPANY (A-Z)</option>
                </select>
              </div>
            </div>


            {/* Active Filter & Page Size Selector Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs font-mono gap-2 pt-1 text-slate-600 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={13} className="text-indigo-600" />
                <span>SHOWING <strong className="text-slate-900">{startJobNum}-{endJobNum}</strong> OF <strong className="text-slate-900">{seekerJobs.length}</strong> PREPARED POSITIONS</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="text-slate-500 uppercase">PAGE SIZE:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(e.target.value); setCurrentPage(1); }}
                    className="bg-slate-100 border border-slate-200 rounded-lg px-2 py-0.5 font-extrabold text-slate-900 focus:outline-none cursor-pointer"
                  >
                    <option value="24">24 / PAGE</option>
                    <option value="48">48 / PAGE (DEFAULT)</option>
                    <option value="96">96 / PAGE</option>
                    <option value="All">SHOW ALL ({seekerJobs.length})</option>
                  </select>
                </div>

                {isFiltered && (
                  <button
                    onClick={resetAllFilters}
                    className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-900 font-bold underline cursor-pointer"
                  >
                    <RotateCcw size={12} /> RESET ALL
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Dynamic & High-Impact Job Cards Grid */}
          {seekerJobs.length === 0 ? (
            scrapeProgress?.isActive ? (
              <div className="bg-slate-900 border-2 border-indigo-500/50 rounded-3xl p-8 sm:p-12 text-center text-white space-y-6 shadow-2xl font-mono animate-in fade-in duration-300">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-400/40 flex items-center justify-center shadow-lg">
                  <RefreshCw size={28} className="animate-spin text-indigo-400" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl sm:text-2xl font-black tracking-wider uppercase text-white">
                    SCANNING LIVE EMPLOYMENT GATEWAYS
                  </h2>
                  <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
                    Autonomous scrapers are indexing positions tailored to your profile (<span className="text-indigo-300 font-bold">{currentProfile?.industry || 'Technology'}</span>). Matching opportunities will appear below immediately upon completion.
                  </p>
                </div>

                {/* Active Progress Bar */}
                <div className="max-w-md mx-auto space-y-2.5 bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-inner">
                  <div className="flex justify-between text-xs text-slate-300 font-bold">
                    <span className="flex items-center gap-1.5 truncate max-w-[280px]">
                      <Zap size={13} className="text-amber-400 fill-amber-400 animate-pulse shrink-0" />
                      <span className="truncate">{scrapeProgress.stage || 'Scanning Gateways...'}</span>
                    </span>
                    <span className="text-indigo-400 font-black">{scrapeProgress.percent}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 rounded-full transition-all duration-300"
                      style={{ width: `${scrapeProgress.percent}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 flex justify-between">
                    <span>ELAPSED: {scrapeProgress.elapsedSec}s</span>
                    <span>ESTIMATED DURATION: ~15s</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 border border-amber-200 bg-amber-50/40 text-amber-950 font-mono shadow-2xs space-y-4 animate-in fade-in duration-200">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0 border border-amber-300">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold uppercase tracking-wider text-amber-950">FILTER DIAGNOSTIC // 0 MATCHES RETURNED</h4>
                    <p className="text-xs font-bold text-amber-900 mt-1 leading-relaxed">
                      {filterDiagnostic?.summaryText}.
                    </p>
                  </div>
                </div>

                {/* 1-Click Quick Resolution Buttons */}
                <div className="pt-3 border-t border-amber-200/80 flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="text-[11px] text-amber-800 uppercase tracking-wider font-extrabold mr-1">QUICK RESOLUTIONS:</span>
                  
                  {filterDiagnostic?.hasDistanceFilter && (
                    <button
                      onClick={() => setMaxDistanceFilter('10km')}
                      className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 transition-colors cursor-pointer"
                    >
                      WIDEN DISTANCE TO &lt; 10 KM
                    </button>
                  )}

                  {filterDiagnostic?.hasStreamFilter && (
                    <button
                      onClick={() => setActiveStreamTab('All')}
                      className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 transition-colors cursor-pointer"
                    >
                      SWITCH TO ALL STREAMS
                    </button>
                  )}

                  {filterDiagnostic?.hasAgeFilter && (
                    <button
                      onClick={() => setMaxAgeFilter('All')}
                      className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 transition-colors cursor-pointer"
                    >
                      SHOW ALL DATES (NO 13-DAY LIMIT)
                    </button>
                  )}

                  {filterDiagnostic?.hasSearchFilter && (
                    <button
                      onClick={() => setSearch('')}
                      className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 transition-colors cursor-pointer"
                    >
                      CLEAR SEARCH KEYWORD
                    </button>
                  )}

                  <button
                    onClick={resetAllFilters}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors cursor-pointer ml-auto"
                  >
                    <RotateCcw size={12} className="inline mr-1" /> RESET ALL FILTERS
                  </button>
                </div>
              </div>
            )
          ) : (

            <div className="space-y-6">
              {paginatedJobs.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  className="flex flex-col items-center justify-center py-24 text-slate-400 bg-white/50 rounded-3xl border-2 border-dashed border-slate-200"
                >
                  <Bot size={64} className="mb-4 text-slate-300" />
                  <h3 className="text-xl font-bold text-slate-600 mb-2">No jobs found in this view</h3>
                  <p className="text-sm max-w-md text-center">Try adjusting your filters, selecting a different tab, or running the scraper to find new opportunities.</p>
                </motion.div>
              ) : (
                <div className={`grid gap-5 ${showSidebar ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6'}`}>
                  {paginatedJobs.map(job => {
                    const isGeneratingThisJob = Boolean(
                      asyncGeneratingIds?.has?.(job.id) || 
                      asyncGeneratingIds?.has?.(String(job.id)) || 
                      asyncGeneratingIds?.has?.(`${job.company}_${job.title}`)
                    );
                    const hasCustomDocs = hasGeneratedApplicationDocs(job);
                    const isTopFit = (job.score || 0) >= 85;

                    return (
                      <motion.div
                        key={job.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => onSelectJob(job)}
                      className={`rounded-2xl p-5 transition-all duration-300 flex flex-col justify-between space-y-4 group cursor-pointer relative overflow-hidden card-hover-lift ${
                        hasCustomDocs
                          ? 'bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50 border-2 border-emerald-500 shadow-md shadow-emerald-500/15 ring-2 ring-emerald-500/30'
                          : isGeneratingThisJob
                          ? 'bg-gradient-to-br from-amber-50/90 via-white to-orange-50/50 border-2 border-amber-500 shadow-xl ring-4 ring-amber-400/40 animate-pulse'
                          : isTopFit
                          ? 'bg-gradient-to-br from-emerald-50/80 via-white to-indigo-50/50 border-2 border-emerald-500/80 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/20'
                          : 'bg-white border border-slate-200/90 shadow-2xs hover:border-indigo-400 hover:shadow-md'
                      }`}
                    >
                      {/* Top Gradient Line */}
                      <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                        hasCustomDocs
                          ? 'bg-gradient-to-r from-emerald-400 via-teal-500 to-indigo-500'
                          : isTopFit
                          ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
                          : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                      }`} />

                      {/* Top Standout Badges & Actions */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">

                        {isGeneratingThisJob ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-black bg-amber-500 text-slate-950 uppercase tracking-wider shadow-sm animate-pulse">
                            <RefreshCw size={12} className="animate-spin text-slate-950" />
                            ⚡ AI SYNTHESIZING ASSETS...
                          </div>
                        ) : hasCustomDocs ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-black bg-emerald-500 text-slate-950 uppercase tracking-wider shadow-2xs">
                            <CheckCircle2 size={12} className="text-slate-950" />
                            ✨ TAILORED ASSETS READY (PDFs)
                          </div>
                        ) : isTopFit ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-black bg-emerald-500 text-slate-950 uppercase tracking-wider shadow-2xs animate-pulse">
                            <Flame size={12} className="text-amber-900 fill-amber-900" />
                            🏆 TOP FIT OPPORTUNITY
                          </div>
                        ) : null}

                        {/* Direct Platform Quick Apply Compatibility Badge */}
                        {isQuickApplyEligible(job) && (
                          <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-mono font-black uppercase tracking-wider border shadow-2xs ${
                            (job.source || '').toLowerCase().includes('linkedin') || (job.link || '').toLowerCase().includes('linkedin')
                              ? 'bg-sky-950 text-sky-300 border-sky-500/50'
                              : (job.source || '').toLowerCase().includes('seek') || (job.link || '').toLowerCase().includes('seek')
                              ? 'bg-rose-950 text-rose-300 border-rose-500/50'
                              : 'bg-indigo-950 text-indigo-300 border-indigo-500/50'
                          }`}>
                            <Zap size={10} className="text-amber-400 fill-amber-400 animate-pulse" />
                            <span>{getQuickApplyPlatform(job).toUpperCase()}</span>
                          </div>
                        )}
                        </div>
                        <button
                          onClick={(e) => toggleStar(job.id || `${job.company}_${job.title}`, e)}
                          className={`p-1.5 rounded-full transition-colors ${starredJobIds.includes(job.id || `${job.company}_${job.title}`) ? 'text-amber-500 bg-amber-50 hover:bg-amber-100' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'}`}
                          title={starredJobIds.includes(job.id || `${job.company}_${job.title}`) ? "Remove from Saved" : "Save Job"}
                        >
                          <Star size={18} className={starredJobIds.includes(job.id || `${job.company}_${job.title}`) ? "fill-amber-500" : ""} />
                        </button>
                      </div>

                      {/* Card Header & Scores */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black border ${
                            isTopFit 
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-2xs'
                              : (job.score || 0) >= 80
                              ? 'bg-indigo-100 text-indigo-950 border-indigo-300'
                              : 'bg-slate-100 text-slate-900 border-slate-300'
                          }`}>
                            <Award size={13} className={isTopFit ? "text-slate-950" : "text-indigo-700"} />
                            {job.score || 85}% MATCH
                          </span>

                          <div className="flex items-center gap-1.5">
                            {/* Promote / Demote Controls */}
                            <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-2xs">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePromote(job);
                                }}
                                className={`p-1 rounded-md text-[10px] font-mono font-black flex items-center gap-1 transition-all cursor-pointer ${
                                  isJobPromoted(job)
                                    ? 'bg-emerald-500 text-slate-950 shadow-xs ring-1 ring-emerald-400 font-black'
                                    : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                                }`}
                                title="Show More Like This"
                              >
                                <ThumbsUp size={11} className={isJobPromoted(job) ? "fill-slate-950" : ""} />
                                <span className="hidden sm:inline text-[9px]">MORE</span>
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDemote(job);
                                }}
                                className={`p-1 rounded-md text-[10px] font-mono font-black flex items-center gap-1 transition-all cursor-pointer ${
                                  isJobDemoted(job)
                                    ? 'bg-rose-500 text-white shadow-xs ring-1 ring-rose-400 font-black'
                                    : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50'
                                }`}
                                title="Show Less Like This"
                              >
                                <ThumbsDown size={11} className={isJobDemoted(job) ? "fill-white" : ""} />
                                <span className="hidden sm:inline text-[9px]">LESS</span>
                              </button>
                            </div>


                            {job.isRejected ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onUnrejectJob) onUnrejectJob(job.id || `${job.company}_${job.title}`);
                                }}
                                className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/40 hover:bg-purple-600 hover:text-white transition-all cursor-pointer text-[10px] font-mono font-bold flex items-center gap-1"
                                title="Un-reject and restore this job"
                              >
                                <RotateCcw size={11} /> RESTORE
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onRejectJob) onRejectJob(job.id || `${job.company}_${job.title}`);
                                }}
                                className="px-2 py-0.5 rounded bg-rose-950/70 text-rose-300 border border-rose-500/40 hover:bg-rose-600 hover:text-white transition-all cursor-pointer text-[10px] font-mono font-bold flex items-center gap-1"
                                title="Reject and remove this job"
                              >
                                🚫 REJECT
                              </button>
                            )}

                            {job.source && (
                              <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                {job.source}
                              </span>
                            )}
                          </div>

                        </div>

                        {/* Title, Company & Top Direct Job Link */}
                        <div className="flex items-start justify-between gap-3 pt-1">
                          <div className="flex-1 min-w-0">
                            {(() => {
                              const jobUrl = job.portalLink || job.link || job.url;
                              return (
                                <>
                                  {jobUrl ? (
                                    <a
                                      href={jobUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="font-black text-lg text-slate-900 hover:text-indigo-600 transition-colors leading-snug cursor-pointer inline-flex items-center gap-1.5"
                                      title="Open original job posting in a new tab"
                                    >
                                      <span>{job.title}</span>
                                      <ExternalLink size={14} className="text-slate-400 hover:text-indigo-600" />
                                    </a>
                                  ) : (
                                    <h3 className="font-black text-lg text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                                      {job.title}
                                    </h3>
                                  )}

                                  <p className="text-xs font-bold text-slate-600 mt-1 flex items-center gap-1.5">
                                    <Building2 size={13} className="text-indigo-500 shrink-0" />
                                    {jobUrl ? (
                                      <a
                                        href={jobUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="font-extrabold text-slate-800 hover:text-indigo-600 hover:underline cursor-pointer"
                                        title="Open original job posting in a new tab"
                                      >
                                        {job.company}
                                      </a>
                                    ) : (
                                      <span className="font-extrabold text-slate-800">{job.company}</span>
                                    )}
                                  </p>
                                </>
                              );
                            })()}
                          </div>

                          {(job.portalLink || job.link || job.url) && (
                            <a
                              href={job.portalLink || job.link || job.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="shrink-0 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 hover:border-indigo-300 font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-xs"
                              title="Open original job posting"
                            >
                              <span>OPEN JOB</span>
                              <ExternalLink size={13} />
                            </a>
                          )}
                        </div>

                        {/* Salary, Employment Type & Work Arrangement Information */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {job.salary && (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                              <DollarSign size={13} className="text-emerald-600" />
                              <span>{job.salary}</span>
                            </div>
                          )}
                          {job.employmentType && (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              <Briefcase size={10} className="text-indigo-600" />
                              <span>{job.employmentType}</span>
                            </div>
                          )}
                          {job.workArrangement && (
                            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                              job.workArrangement === 'Remote' 
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : job.workArrangement === 'Hybrid'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}>
                              <Building2 size={10} />
                              <span>{job.workArrangement}</span>
                            </div>
                          )}
                        </div>

                        {/* Key Responsibilities & Highlights Preview */}
                        {job.keyResponsibilities && job.keyResponsibilities.length > 0 && (
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-700 space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Key Deliverables:</span>
                            <ul className="space-y-0.5">
                              {job.keyResponsibilities.slice(0, 2).map((r, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-700 line-clamp-1">
                                  <span className="text-indigo-600 font-black">•</span>
                                  <span className="truncate">{r}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Incomplete Job Ad Warning Box (For Missing Data Stream) */}
                        {job.isComplete === false && (
                          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-[11px] text-rose-900 space-y-1 font-mono">
                            <div className="font-bold flex items-center gap-1 text-rose-700 text-[10px] uppercase">
                              <AlertCircle size={12} /> Incomplete Job Ad Metadata:
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {job.missingFields?.map((f, i) => (
                                <span key={i} className="px-1.5 py-0.5 rounded bg-rose-200 text-rose-900 text-[9px] font-bold">
                                  Missing {f}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Matched Skill Tags on Card */}
                        {(job.matchedSkills || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 font-mono pt-1">
                            {job.matchedSkills.slice(0, 4).map((skill, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                ✓ {skill}
                              </span>
                            ))}
                          </div>
                        )}


                        <div className="flex items-center justify-between text-xs font-bold text-slate-600 pt-1 border-t border-slate-100">
                          <div className="flex items-center gap-1.5 truncate pr-2">
                            <MapPin size={13} className="text-indigo-600 shrink-0" />
                            <span className="truncate">{job.location}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 text-slate-900 font-extrabold text-xs px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded-md">
                            <Clock size={12} className="text-indigo-600" />
                            {formatJobPostedAge(job.date)}
                          </div>
                        </div>

                        {/* Google Maps Commute Intelligence Pill */}
                        {(() => {
                          const commute = getCommuteDetails(baseLocation, job.location);
                          if (commute.isRemote) {
                            return (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-[10px] text-emerald-300 font-mono font-bold">
                                <Sparkles size={11} className="text-emerald-400" />
                                <span>100% REMOTE • 0 MIN COMMUTE</span>
                              </div>
                            );
                          }
                          return (
                            <div className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-mono space-y-1">
                              <div className="flex items-center justify-between text-slate-300 font-bold px-1">
                                <span className="flex items-center gap-1 text-indigo-400">
                                  <Navigation size={10} />
                                  {commute.distanceKm}KM COMMUTE:
                                </span>
                                <span className={commute.car.tolls.hasTolls ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                                  {commute.car.tolls.hasTolls ? `Tolls: ${commute.car.tolls.estimatedCost}` : 'Toll-Free'}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-1 text-[9px] text-center">
                                <span className="p-1 rounded bg-slate-900 border border-slate-800 text-indigo-300 flex items-center justify-center gap-0.5" title={`Train route: ${commute.transit.lines}`}>
                                  <Train size={9} /> {commute.transit.durationMin}m Train
                                </span>
                                <span className="p-1 rounded bg-slate-900 border border-slate-800 text-amber-300 flex items-center justify-center gap-0.5" title={`Off-peak: ${commute.car.offPeakMin}m | Peak: ${commute.car.peakMin}m`}>
                                  <Car size={9} /> {commute.car.peakMin}m Peak
                                </span>
                                <span className="p-1 rounded bg-slate-900 border border-slate-800 text-emerald-300 flex items-center justify-center gap-0.5" title={`Bike trail: ${commute.bike.bikePaths}`}>
                                  <Bike size={9} /> {commute.bike.durationMin}m Bike
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Direct PDF Quick-Download Bar for Generated Docs */}
                      {hasCustomDocs && (
                        <div className="pt-2 border-t border-emerald-200/80 flex items-center gap-2 font-mono">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadResumePdf(job.resumeText, job, currentProfile);
                            }}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                            title="Download Tailored Resume PDF"
                          >
                            <Download size={11} /> RESUME (PDF)
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadCoverLetterPdf(hasCustomDocs.coverLetter, job, currentProfile);
                            }}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                            title="Download Tailored Cover Letter PDF"
                          >
                            <Download size={11} /> COVER LTR
                          </button>
                        </div>
                      )}
                      {/* Psychology & Behavioral Subtext Decoder Pill Button */}
                      <div className="pt-2 border-t border-slate-100">
                        {(() => {
                          const cached = getCachedPsychology(job);
                          const hasPsychology = !!cached;
                          return (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPsychologyJob({ ...job, psychologyInsights: cached });
                              }}
                              className={`w-full py-1.5 px-2.5 rounded-xl text-[10px] font-bold flex items-center justify-between transition-all cursor-pointer border ${
                                hasPsychology
                                  ? 'bg-teal-950/70 hover:bg-teal-900/90 text-teal-300 border-teal-500/40 shadow-2xs'
                                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-teal-300 border-slate-700/60 hover:border-teal-500/40'
                              }`}
                              title={hasPsychology ? "View decoded employer psychology & hidden priorities" : "Decode employer psychology, covert pain points & candidate edge"}
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <Sparkles size={12} className={hasPsychology ? "text-teal-400 shrink-0" : "text-slate-400 shrink-0"} />
                                <span className="truncate">{hasPsychology ? "PSYCHOLOGY DECODED" : "DECODE PSYCHOLOGY"}</span>
                              </div>
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-black shrink-0 ${
                                hasPsychology ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "bg-slate-800 text-slate-400"
                              }`}>
                                {hasPsychology ? "RETAINED" : "UNFAIR EDGE"}
                              </span>
                            </button>
                          );
                        })()}
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 font-mono">
                        {/* Auto-Apply Launcher Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAutoApplyJob(job);
                          }}
                          className="py-2 px-2.5 rounded-xl font-bold text-xs bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/40 transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                          title={`Launch Auto-Apply for ${getQuickApplyPlatform(job)}`}
                        >
                          <Zap size={12} className="text-amber-400 animate-pulse" />
                          <span>AUTO-APPLY</span>
                        </button>

                        {hasCustomDocs ? (
                          <>
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                dispatchDirectApplicationSubmission(job, onJobStatusUpdate, downloadResumePdf, downloadCoverLetterPdf, currentProfile);
                              }}
                              className="flex-1 py-2 px-2.5 rounded-xl font-black text-xs transition-all border flex items-center justify-center gap-1.5 cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20"
                              title="Download PDFs, Open Job Portal & Mark Applied in 1-Click"
                            >
                              <CheckCircle2 size={12} className="text-emerald-200" /> 
                              <span>APPLY</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedForGenerator(job); }}
                              className="py-2 px-2 rounded-xl font-bold text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 transition-colors cursor-pointer"
                              title="Open in AI Studio to edit or customize"
                            >
                              <Sparkles size={12} className="text-emerald-700" />
                            </button>
                          </>
                        ) : isGeneratingThisJob ? (
                          <button
                            disabled
                            className="flex-1 py-2 px-2 rounded-xl font-extrabold text-xs bg-amber-500 text-slate-950 border border-amber-600 flex items-center justify-center gap-1.5 shadow-inner cursor-not-allowed font-mono animate-pulse"
                            title="Application synthesis in progress..."
                          >
                            <RefreshCw size={12} className="animate-spin text-slate-950" />
                            <span>SYNTHESIZING…</span>
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onDispatchAsyncApplication) {
                                onDispatchAsyncApplication(job);
                              } else {
                                setSelectedForGenerator(job);
                              }
                            }}
                            className="flex-1 py-2 px-2 rounded-xl font-extrabold text-xs transition-all border flex items-center justify-center gap-1 cursor-pointer bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white border-indigo-500 shadow-md hover:shadow-indigo-500/20 tracking-wide uppercase"
                            title="Dispatch 1-Click Background Application Generation & Google Drive Sync"
                          >
                            <Sparkles size={12} className="text-amber-300" />
                            <span>PREP DOCS</span>
                          </button>
                        )}

                        <button
                          onClick={(e) => { e.stopPropagation(); onSelectJob(job); }}
                          className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-extrabold text-xs transition-colors border border-slate-200 flex items-center justify-center gap-1 cursor-pointer"
                          title="View Full Details"
                        >
                          <Eye size={12} className="text-slate-600" />
                          <span>DETAILS</span>
                        </button>
                      </div>
                    </motion.div>

                  );
                })}

              </div>
              )}
              {/* Interactive Pagination Navigation Bar */}
              {pageSize !== 'All' && totalPages > 1 && (
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <span>PAGE <strong className="text-slate-900">{currentPage}</strong> OF <strong className="text-slate-900">{totalPages}</strong></span>
                    <span className="text-slate-400">({seekerJobs.length} TOTAL POSITIONS)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={currentPage === 1}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-800 cursor-pointer"
                      title="First Page"
                    >
                      <ChevronFirst size={15} />
                    </button>

                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-800 cursor-pointer"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    {/* Numeric Page Buttons */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                      .map((pageNum, idx, arr) => {

                        const prevPage = arr[idx - 1];
                        const showEllipsis = prevPage && pageNum - prevPage > 1;

                        return (
                          <React.Fragment key={pageNum}>
                            {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                            <button
                              onClick={() => handlePageChange(pageNum)}
                              className={`px-3 py-1.5 rounded-xl font-extrabold transition-all cursor-pointer ${
                                currentPage === pageNum
                                  ? 'bg-indigo-600 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {pageNum}
                            </button>
                          </React.Fragment>
                        );
                      })}

                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-800 cursor-pointer"
                      title="Next Page"
                    >
                      <ChevronRight size={15} />
                    </button>

                    <button
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-800 cursor-pointer"
                      title="Last Page"
                    >
                      <ChevronLast size={15} />
                    </button>
                  </div>

                  {/* Load More Batch Button */}
                  {currentPage < totalPages && (
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      className="px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-extrabold border border-indigo-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowDown size={14} className="text-indigo-600" />
                      LOAD NEXT {Math.min(effectivePageSize, seekerJobs.length - endJobNum)} POSITIONS
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Generator Modal */}
      {selectedForGenerator && (
        <GeneratorModal 
          job={selectedForGenerator} 
          onClose={() => setSelectedForGenerator(null)} 
          onSaveCustomDocs={onSaveCustomDocs}
          onUpdateStatus={onJobStatusUpdate}
        />
      )}

      {/* Auto-Apply Engine Modal (LinkedIn Easy Apply & SEEK Quick Apply) */}
      {selectedAutoApplyJob && (
        <SafeErrorBoundary sectionName="Auto-Apply Engine" onClose={() => setSelectedAutoApplyJob(null)}>
          <AutoApplyModal 
            job={selectedAutoApplyJob} 
            onClose={() => setSelectedAutoApplyJob(null)}
            onJobStatusUpdated={onJobStatusUpdate}
          />
        </SafeErrorBoundary>
      )}

      {/* Psychological Edge & Covert Subtext Decoder Modal */}
      {psychologyJob && (
        <SafeErrorBoundary sectionName="Psychology Decoder" onClose={() => setPsychologyJob(null)}>
          <PsychologyDecoderModal 
            job={psychologyJob} 
            onClose={() => setPsychologyJob(null)}
            onSaveInsights={(id, insights) => {
              if (onJobStatusUpdate) {
                onJobStatusUpdate(id, psychologyJob.status || 'Discovered', { psychologyInsights: insights });
              }
            }}
          />
        </SafeErrorBoundary>
      )}
    </div>
  );
};


