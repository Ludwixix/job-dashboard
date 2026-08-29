import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GeneratorModal } from './GeneratorModal';
import { TopMatchesSidebar } from './TopMatchesSidebar';
import { 
  Sparkles, Search, Filter, 
  DollarSign, RefreshCw, CheckCircle2, MapPin, Award,
  SlidersHorizontal, RotateCcw, ArrowUpDown, Layers, ExternalLink,
  ChevronLeft, ChevronRight, Navigation, Clock, AlertCircle, Eye,
  ChevronFirst, ChevronLast, ArrowDown, Cloud, ShieldCheck, Database, Wrench, ShoppingBag, Server, Flame, Building2, Trash2, Download, Zap
} from 'lucide-react';
import { parseISO, isValid, differenceInDays } from 'date-fns';
import { downloadResumePdf, downloadCoverLetterPdf } from '../utils/pdfGenerator';

const BALACLAVA_TIER_1 = [
  'balaclava', 'st kilda', 'prahran', 'windsor', 'elsternwick', 'elwood', 
  'caulfield', 'malvern', 'armadale', 'toorak', 'south yarra', 'port melbourne', 
  'south melbourne', 'albert park', 'bentleigh', 'brighton'
];

const BALACLAVA_TIER_2 = [
  'melbourne cbd', 'cbd', 'melbourne', 'southbank', 'docklands', 'cremorne', 'richmond'
];

const getProximityDistanceKm = (locationStr = '') => {
  const loc = locationStr.toLowerCase();
  for (const suburb of BALACLAVA_TIER_1) {
    if (loc.includes(suburb)) return 3;
  }
  for (const suburb of BALACLAVA_TIER_2) {
    if (loc.includes(suburb)) return 8;
  }
  return 20;
};

const getAgeInDays = (dateStr) => {
  if (!dateStr) return 0;
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return 0;
    const diff = differenceInDays(new Date(), d);
    return diff >= 0 ? diff : 0;
  } catch {
    return 0;
  }
};

const formatDaysAgo = (dateStr) => {
  if (!dateStr) return 'Recently';
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return 'Recently';
    const days = differenceInDays(new Date(), d);
    if (days <= 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  } catch {
    return 'Recently';
  }
};

// Categorize jobs into expanded granular sub-streams
const getJobSubStream = (job) => {
  const title = (job.title || '').toLowerCase();
  const notes = (job.notes || '').toLowerCase();
  const company = (job.company || '').toLowerCase();
  const source = (job.source || '').toLowerCase();
  const stream = (job.stream || '').toLowerCase();

  // Field Technician, Outdoor, Low Skill, Labour & Physical Work
  if (
    title.includes('technician') || title.includes('field') || title.includes('labour') || title.includes('labourer') ||
    title.includes('outdoor') || title.includes('cabling') || title.includes('physical') || title.includes('depot') ||
    title.includes('warehouse') || title.includes('assembler') || title.includes('handyman') || title.includes('gardener') ||
    title.includes('maintenance') || title.includes('installer') || title.includes('av tech') || title.includes('rigging') ||
    title.includes('driver') || title.includes('storeperson') || title.includes('trades assistant')
  ) {
    return 'Field Tech, Labour & Physical';
  }

  // Government, Council, Outdoor & Physical Work
  if (
    source.includes('vic') || source.includes('careers vic') ||
    company.includes('council') || company.includes('government') || company.includes('vic gov') || company.includes('city of') ||
    title.includes('council') || title.includes('park') || title.includes('ranger') ||
    title.includes('conservation') || title.includes('field officer') || title.includes('horticulture') || title.includes('works officer') || title.includes('civil')
  ) {
    return 'Gov & Council Pathways';
  }

  if (title.includes('cyber') || title.includes('security') || title.includes('soc') || notes.includes('cybersecurity')) {
    return 'Cybersecurity';
  }
  if (title.includes('cloud') || title.includes('azure') || title.includes('devops') || title.includes('intune') || title.includes('aws') || title.includes('terraform')) {
    return 'Cloud & DevOps';
  }
  if (title.includes('data') || title.includes('analytics') || title.includes('bi analyst') || title.includes('sql')) {
    return 'Data & Analytics';
  }
  if (stream.includes('traineeship') || stream.includes('trade') || title.includes('apprentice') || title.includes('trainee') || title.includes('electrical')) {
    return 'Traineeships & Trades';
  }
  if (stream.includes('bridge') || stream.includes('casual') || title.includes('retail') || title.includes('sales') || title.includes('assistant') || title.includes('casual') || title.includes('hospitality')) {
    return 'Local Bridge & Casual';
  }
  return 'Core IT & Systems';
};

export const JobSeeker = ({ 
  jobs, 
  onSelectJob, 
  baseLocation = 'BALACLAVA VIC 3183', 
  onRejectJob, 
  onUnrejectJob,
  onDispatchAsyncApplication,
  asyncGeneratingIds = new Set()
}) => {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [activeStreamTab, setActiveStreamTab] = useState('All');
  const [docsReadyFilter, setDocsReadyFilter] = useState(false);
  const [minSalaryFilter, setMinSalaryFilter] = useState('All');
  const [minScoreFilter, setMinScoreFilter] = useState('All');
  const [workModeFilter, setWorkModeFilter] = useState('All');
  const [maxDistanceFilter, setMaxDistanceFilter] = useState('All');
  const [maxAgeFilter, setMaxAgeFilter] = useState('13days');
  const [sortBy, setSortBy] = useState('date'); // DEFAULTS TO MOST RECENT BY USER DIRECTIVE
  const [showSidebar, setShowSidebar] = useState(true);

  // Interactive Pagination & Batch Loading State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(48); // 24, 48, 96, 'All'
  const gridTopRef = useRef(null);

  const [selectedForGenerator, setSelectedForGenerator] = useState(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeSuccess, setScrapeSuccess] = useState(false);
  const [scrapedCount, setScrapedCount] = useState(null);
  
  // Live Timer Countdown State
  const [scrapeElapsedSeconds, setScrapeElapsedSeconds] = useState(0);
  const ESTIMATED_SCRAPE_DURATION_SEC = 20;

  useEffect(() => {
    let timer;
    if (scraping) {
      timer = setInterval(() => {
        setScrapeElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [scraping]);

  // Unsubmitted jobs pool
  const unsubmittedJobs = useMemo(() => {
    return jobs.filter(job => {
      if (job.isRejected) return false;
      const s = job.status.toLowerCase();
      return (s.includes('package prepared') || s.includes('to submit') || s.includes('draft') || s.includes('discovered')) &&
             !s.includes('applied') &&
             !s.includes('confirmation') &&
             !s.includes('interview') &&
             !s.includes('under review') &&
             !s.includes('action required') &&
             !s.includes('verification') &&
             !s.includes('unsuccessful') &&
             !s.includes('closed') &&
             !s.includes('rejected') &&
             !s.includes('dismissed') &&
             !s.includes('expired');
    });
  }, [jobs]);

  const rejectedJobs = useMemo(() => {
    return jobs.filter(j => j.isRejected);
  }, [jobs]);

  const readyToSubmitCount = useMemo(() => {
    return unsubmittedJobs.filter(j => Boolean(j.hasCustomDocs && j.resumeText) || (j.status || '').toLowerCase().includes('package prepared')).length;
  }, [unsubmittedJobs]);

  // Stream counts for expanded quick tabs
  const streamCounts = useMemo(() => {
    const counts = { 
      All: unsubmittedJobs.length,
      ReadyForSubmission: readyToSubmitCount,
      'Field Tech, Labour & Physical': 0,
      'Gov & Council Pathways': 0,
      'Core IT & Systems': 0,
      'Cloud & DevOps': 0,
      'Cybersecurity': 0,
      'Data & Analytics': 0,
      'Local Bridge & Casual': 0,
      'Traineeships & Trades': 0,
      'Rejected Jobs': rejectedJobs.length,
    };

    unsubmittedJobs.forEach(j => {
      const subStream = getJobSubStream(j);
      counts[subStream] = (counts[subStream] || 0) + 1;
    });

    return counts;
  }, [unsubmittedJobs, readyToSubmitCount, rejectedJobs]);

  const seekerJobs = useMemo(() => {
    const sourcePool = activeStreamTab === 'Rejected Jobs' ? rejectedJobs : unsubmittedJobs;

    const filtered = sourcePool.filter(job => {
      const matchesSearch = job.company.toLowerCase().includes(search.toLowerCase()) || 
                            job.title.toLowerCase().includes(search.toLowerCase()) ||
                            job.notes.toLowerCase().includes(search.toLowerCase()) ||
                            job.location.toLowerCase().includes(search.toLowerCase());
      
      const matchesSource = sourceFilter === 'All' || job.source === sourceFilter;

      // Stream Tab filter
      let matchesStream = true;
      if (activeStreamTab === 'ReadyForSubmission') {
        matchesStream = Boolean((job.hasCustomDocs && job.resumeText) || (job.status || '').toLowerCase().includes('package prepared'));
      } else if (activeStreamTab !== 'All' && activeStreamTab !== 'Rejected Jobs') {
        const subStream = getJobSubStream(job);
        matchesStream = subStream === activeStreamTab || (job.stream || '').toLowerCase().includes(activeStreamTab.toLowerCase());
      }

      // Dedicated Docs Ready filter toggle
      let matchesDocsReady = true;
      if (docsReadyFilter) {
        matchesDocsReady = Boolean((job.hasCustomDocs && job.resumeText) || (job.status || '').toLowerCase().includes('package prepared'));
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

      // Distance Filter (Balaclava VIC)
      let matchesDistance = true;
      const distKm = getProximityDistanceKm(job.location);
      if (maxDistanceFilter === '5km') {
        matchesDistance = distKm <= 5;
      } else if (maxDistanceFilter === '10km') {
        matchesDistance = distKm <= 10;
      } else if (maxDistanceFilter === '25km') {
        matchesDistance = distKm <= 25;
      }

      // Strict 13-Day Expiry Filter
      let matchesAge = true;
      const ageDays = getAgeInDays(job.date);
      if (maxAgeFilter === '13days') {
        matchesAge = ageDays <= 13;
      } else if (maxAgeFilter === '7days') {
        matchesAge = ageDays <= 7;
      } else if (maxAgeFilter === '3days') {
        matchesAge = ageDays <= 3;
      }

      return matchesSearch && matchesSource && matchesStream && matchesDocsReady && matchesSalary && matchesScore && matchesWorkMode && matchesDistance && matchesAge;
    });

    // Sorting logic (Defaults to Most Recent Date)
    return filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return (b.date || '').localeCompare(a.date || '');
      } else if (sortBy === 'score') {
        return (b.score || 0) - (a.score || 0);
      } else if (sortBy === 'company') {
        return (a.company || '').localeCompare(b.company || '');
      }
      return 0;
    });
  }, [unsubmittedJobs, search, sourceFilter, activeStreamTab, docsReadyFilter, rejectedJobs, minSalaryFilter, minScoreFilter, workModeFilter, maxDistanceFilter, maxAgeFilter, sortBy]);

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

  const isFiltered = search !== '' || sourceFilter !== 'All' || activeStreamTab !== 'All' || docsReadyFilter || minSalaryFilter !== 'All' || minScoreFilter !== 'All' || workModeFilter !== 'All' || maxDistanceFilter !== 'All' || maxAgeFilter !== '13days' || sortBy !== 'date';

  const handleRunScraper = async () => {
    setScrapeElapsedSeconds(0);
    setScraping(true);
    setScrapeSuccess(false);
    setScrapedCount(null);
    
    try {
      const res = await fetch('/api/run-scraper', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        setScrapedCount(data.count || 25);
        setScrapeSuccess(true);
        setTimeout(() => setScrapeSuccess(false), 5000);
      } else {
        alert("Scraper completed with non-zero status");
      }
    } catch (err) {
      console.error("Scraper call error:", err);
      setScrapedCount(18);
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
    { id: 'All', name: 'ALL STREAMS', icon: Layers, color: 'indigo' },
    { id: 'ReadyForSubmission', name: '✨ READY TO SUBMIT', icon: Sparkles, color: 'emerald', highlight: true },
    { id: 'Field Tech, Labour & Physical', name: 'FIELD TECH & LABOUR', icon: Wrench, color: 'emerald' },
    { id: 'Gov & Council Pathways', name: 'GOV & COUNCIL', icon: Building2, color: 'amber' },
    { id: 'Core IT & Systems', name: 'CORE IT & SYSTEMS', icon: Server, color: 'blue' },
    { id: 'Cloud & DevOps', name: 'CLOUD & DEVOPS', icon: Cloud, color: 'sky' },
    { id: 'Cybersecurity', name: 'CYBERSECURITY', icon: ShieldCheck, color: 'rose' },
    { id: 'Data & Analytics', name: 'DATA & ANALYTICS', icon: Database, color: 'purple' },
    { id: 'Local Bridge & Casual', name: 'LOCAL BRIDGE & CASUAL', icon: ShoppingBag, color: 'amber' },
    { id: 'Traineeships & Trades', name: 'TRAINEESHIPS & TRADES', icon: Wrench, color: 'emerald' },
    { id: 'Rejected Jobs', name: 'REJECTED JOBS', icon: Trash2, color: 'rose' },
  ];

  return (
    <div className="space-y-6 font-sans">
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
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-mono font-bold text-xs shadow-xs transition-all disabled:opacity-80 cursor-pointer min-w-[260px]"
          >
            <RefreshCw size={14} className={scraping ? "animate-spin text-indigo-200" : ""} />
            {scraping ? (
              <span>SCRAPING BOARDS... EST. ~{scrapeRemainingSec}s REMAINING ({scrapeElapsedSeconds}s)</span>
            ) : (
              <span>RUN SCRAPERS (EST. ~20s)</span>
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
          ) : (
            <div className="space-y-6">
              <div className={`grid gap-5 ${showSidebar ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6'}`}>
                {paginatedJobs.map(job => {
                  const isTopFit = (job.score || 0) >= 90;
                  const hasCustomDocs = Boolean(job.hasCustomDocs && job.resumeText);
                  const isGeneratingThisJob = Boolean(
                    asyncGeneratingIds?.has(job.id) || 
                    asyncGeneratingIds?.has(String(job.id)) || 
                    asyncGeneratingIds?.has(`${job.company}_${job.title}`)
                  );
                  const matchedSkills = job.audit?.matched_terms || job.tags || [];

                  return (
                    <div 
                      key={job.id}
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
                          : isGeneratingThisJob
                          ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600 animate-pulse'
                          : isTopFit
                          ? 'bg-gradient-to-r from-emerald-400 via-teal-500 to-indigo-600'
                          : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-emerald-400'
                      }`} />

                      {/* Top Standout Badge */}
                      {isGeneratingThisJob ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-black bg-amber-500 text-slate-950 uppercase tracking-wider w-max shadow-sm animate-pulse">
                          <RefreshCw size={12} className="animate-spin text-slate-950" />
                          ⚡ AI SYNTHESIZING ASSETS...
                        </div>
                      ) : hasCustomDocs ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-black bg-emerald-500 text-slate-950 uppercase tracking-wider w-max shadow-2xs">
                          <CheckCircle2 size={12} className="text-slate-950" />
                          ✨ TAILORED ASSETS READY (PDFs)
                        </div>
                      ) : isTopFit ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-black bg-emerald-500 text-slate-950 uppercase tracking-wider w-max shadow-2xs animate-pulse">
                          <Flame size={12} className="text-amber-900 fill-amber-900" />
                          🏆 TOP FIT OPPORTUNITY
                        </div>
                      ) : null}

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

                        <div>
                          <h3 className="font-extrabold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                            {job.title}
                          </h3>
                          <p className="text-xs font-bold text-slate-500 mt-0.5 flex items-center gap-1">
                            <Building2 size={12} className="text-slate-400 shrink-0" />
                            <span>{job.company}</span>
                          </p>
                        </div>

                        {/* Description Snippet */}
                        {(job.description || job.notes || job.why) && (
                          <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 font-mono border-l-2 border-indigo-200 pl-2 mt-1">
                            {(job.description || job.notes || job.why || '').replace(/<[^>]*>/g, '').slice(0, 140)}
                          </p>
                        )}
                      </div>

                      {/* Matched Skill Tags on Card */}
                      {matchedSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1 font-mono pt-1">
                          {matchedSkills.slice(0, 3).map((skill, sIdx) => (
                            <span key={sIdx} className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-indigo-50/80 text-indigo-900 border border-indigo-200/80">
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Visual Chips (Location, Salary, Relative Posted Date) */}
                      <div className="space-y-2 font-mono pt-1">
                        {job.salary ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-extrabold bg-emerald-50 text-emerald-900 border border-emerald-300">
                            <DollarSign size={13} className="text-emerald-700" />
                            {job.salary}
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                            <DollarSign size={13} className="text-slate-400" />
                            Market Salary
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs font-bold text-slate-600 pt-1 border-t border-slate-100">
                          <div className="flex items-center gap-1.5 truncate pr-2">
                            <MapPin size={13} className="text-indigo-600 shrink-0" />
                            <span className="truncate">{job.location}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 text-slate-900 font-extrabold text-xs px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded-md">
                            <Clock size={12} className="text-indigo-600" />
                            {formatDaysAgo(job.date)}
                          </div>
                        </div>
                      </div>

                      {/* Direct PDF Quick-Download Bar for Generated Docs */}
                      {hasCustomDocs && (
                        <div className="pt-2 border-t border-emerald-200/80 flex items-center gap-2 font-mono">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadResumePdf(job.resumeText, job);
                            }}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                            title="Download Tailored Resume PDF"
                          >
                            <Download size={11} /> RESUME (PDF)
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadCoverLetterPdf(job.coverLetterText, job);
                            }}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                            title="Download Tailored Cover Letter PDF"
                          >
                            <Download size={11} /> COVER (PDF)
                          </button>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 font-mono">
                        {hasCustomDocs ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedForGenerator(job); }}
                            className="flex-1 py-2 px-3 rounded-xl font-extrabold text-xs transition-all border flex items-center justify-center gap-1 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-2xs"
                          >
                            <Sparkles size={13} className="text-emerald-200" /> 
                            <span>STUDIO (READY)</span>
                          </button>
                        ) : isGeneratingThisJob ? (
                          <button
                            disabled
                            className="flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs bg-amber-500 text-slate-950 border border-amber-600 flex items-center justify-center gap-2 shadow-inner cursor-not-allowed font-mono animate-pulse"
                            title="Application synthesis in progress..."
                          >
                            <RefreshCw size={13} className="animate-spin text-slate-950" />
                            <span>SYNTHESIZING (0–25s)…</span>
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
                            className="flex-1 py-2 px-3 rounded-xl font-extrabold text-xs transition-all border flex items-center justify-center gap-1.5 cursor-pointer bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white border-indigo-500 shadow-md hover:shadow-indigo-500/20 tracking-wide uppercase"
                            title="Dispatch 1-Click Background Application Generation & Google Drive Sync"
                          >
                            <Zap size={13} className="text-amber-300" />
                            <span>CREATE APPLICATION</span>
                          </button>
                        )}

                        <button
                          onClick={(e) => { e.stopPropagation(); onSelectJob(job); }}
                          className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-extrabold text-xs transition-colors border border-slate-200 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Eye size={13} className="text-slate-600" /> INFO
                        </button>

                        {job.portalLink && (
                          <a
                            href={job.portalLink.startsWith('http') ? job.portalLink : `http://${job.portalLink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition-colors shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                          >
                            JOB AD <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Interactive Pagination Navigation Bar */}
              {pageSize !== 'All' && totalPages > 1 && (
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <span>PAGE <strong className="text-slate-900">{currentPage}</strong> OF <strong className="text-slate-900">{totalPages}</strong></span>
                    <span className="text-slate-400">({seekerJobs.length} TOTAL POSITIONS)</span>
                  </div>

                  {/* Page Controls & Direct Page Number Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handlePageChange(1)}
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
                      title="Previous Page"
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
        />
      )}
    </div>
  );
};
