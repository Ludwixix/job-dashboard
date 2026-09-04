import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Flame, Award, Sparkles, ArrowRight, MapPin, ExternalLink, Dices, Navigation,
  ChevronDown, ChevronUp, Clock, Activity, DollarSign
} from 'lucide-react';
import { getJobAgeInDays, formatJobPostedAge } from '../utils/dateUtils';

const BALACLAVA_TIER_1 = [
  'balaclava', 'st kilda', 'prahran', 'windsor', 'elsternwick', 'elwood', 
  'caulfield', 'malvern', 'armadale', 'toorak', 'south yarra', 'port melbourne', 
  'south melbourne', 'albert park', 'bentleigh', 'brighton'
];

const BALACLAVA_TIER_2 = [
  'melbourne cbd', 'cbd', 'melbourne', 'southbank', 'docklands', 'cremorne', 'richmond'
];

const getProximityTier = (locationStr = '') => {
  const loc = locationStr.toLowerCase();
  for (const suburb of BALACLAVA_TIER_1) {
    if (loc.includes(suburb)) return 1;
  }
  for (const suburb of BALACLAVA_TIER_2) {
    if (loc.includes(suburb)) return 2;
  }
  return 3;
};

const COOL_TECH_ARCHETYPES = [
  {
    category: 'AI & Autonomous Robotics',
    emoji: '🤖',
    badge: 'AI & ROBOTICS',
    keywords: ['robotics', 'autonomous', 'drone', 'computer vision', 'machine learning', 'deep learning', 'llm', 'generative ai', 'agentic', 'ros', 'slam', 'perception']
  },
  {
    category: 'DeepTech & Aerospace',
    emoji: '🚀',
    badge: 'DEEPTECH & DEFENSE',
    keywords: ['aerospace', 'defence', 'defense', 'satellite', 'avionics', 'space', 'propulsion', 'radar', 'lidar', 'uav', 'payload', 'spacecraft']
  },
  {
    category: 'Quantum & Frontier Tech',
    emoji: '⚛️',
    badge: 'QUANTUM / FRONTIER',
    keywords: ['quantum', 'qubit', 'supercomputing', 'hpc', 'neuromorphic', 'photonics', 'cryogenic', 'semiconductor', 'superconductor']
  },
  {
    category: 'Creative Tech & Spatial',
    emoji: '🎮',
    badge: 'CREATIVE TECH & VR',
    keywords: ['game', 'gaming', 'unreal engine', 'unity', 'spatial', 'augmented reality', 'virtual reality', 'vr', 'ar', 'creative tech', '3d graphics', 'shader', 'vfx', 'metaverse']
  },
  {
    category: 'GreenTech & BioTech',
    emoji: '🌱',
    badge: 'GREENTECH & BIO',
    keywords: ['biotech', 'bioinformatics', 'genomics', 'greentech', 'cleantech', 'clean energy', 'renewable', 'battery', 'ev', 'climate tech', 'solar']
  },
  {
    category: 'Cyber Intel & Forensics',
    emoji: '🛡️',
    badge: 'CYBER INTEL & FORENSICS',
    keywords: ['forensics', 'threat intel', 'intelligence', 'reverse engineering', 'cryptography', 'incident response', 'red team', 'exploit', 'malware', 'penetration']
  },
  {
    category: 'R&D Labs & Skunkworks',
    emoji: '🧪',
    badge: 'R&D & INNOVATION',
    keywords: ['r&d', 'research', 'innovation lab', 'stealth', 'applied science', 'experimental', 'prototype', 'breakthrough', 'skunkworks', 'futurist', 'novelty', 'incubator']
  }
];

const detectCoolCategory = (job) => {
  if (!job) return { category: 'Frontier Tech', emoji: '⚡', badge: 'FRONTIER TECH' };
  const text = `${job.title || ''} ${job.stream || ''} ${job.description || ''} ${job.company || ''}`.toLowerCase();
  for (const archetype of COOL_TECH_ARCHETYPES) {
    if (archetype.keywords.some(kw => text.includes(kw))) {
      return archetype;
    }
  }
  return {
    category: 'Frontier Tech',
    emoji: '⚡',
    badge: 'CUTTING-EDGE TECH'
  };
};

export const TopMatchesSidebar = ({ jobs = [], onSelectJob, onOpenGenerator, baseLocation = 'BALACLAVA VIC 3183' }) => {
  const [showTopMatches, setShowTopMatches] = useState(true); // Open by default
  const [showLiveInsights, setShowLiveInsights] = useState(true);
  const [showLocalJob, setShowLocalJob] = useState(false);
  const [showWildCard, setShowWildCard] = useState(true); // Enhanced discovery open by default
  const [showMostRecent, setShowMostRecent] = useState(false);
  const [showMostLikely, setShowMostLikely] = useState(false);
  const [wildCardIndex, setWildCardIndex] = useState(0);

  // Available Active Jobs Pool (Excluding only already applied / closed / rejected records)
  const unsubmittedJobs = useMemo(() => {
    if (!jobs || jobs.length === 0) return [];
    return jobs.filter(job => {
      const s = (job.status || 'sourced').toLowerCase();
      return !s.includes('applied') &&
             !s.includes('confirmation') &&
             !s.includes('interview') &&
             !s.includes('under review') &&
             !s.includes('action required') &&
             !s.includes('verification') &&
             !s.includes('unsuccessful') &&
             !s.includes('rejected') &&
             !s.includes('closed') &&
             !s.includes('expired');
    });
  }, [jobs]);

  // Top 10 Best Aligned & Newest Job Ads
  const top10Matches = useMemo(() => {
    return [...unsubmittedJobs]
      .map(job => {
        const score = Number(job.score) || 75;
        const age = getJobAgeInDays(job.date || job.posted);
        const recencyScore = age === null ? 40 : Math.max(0, 100 - (age * 7));
        const compositeRank = (score * 0.65) + (recencyScore * 0.35);
        return { ...job, compositeRank, ageInDays: age };
      })
      .sort((a, b) => b.compositeRank - a.compositeRank || (b.date || '').localeCompare(a.date || ''))
      .slice(0, 10);
  }, [unsubmittedJobs]);

  // Live Analytics & Points of Interest Computation
  const liveInsights = useMemo(() => {
    const totalCount = unsubmittedJobs.length || 1;
    
    // Near Balaclava & Commute Proximity < 10km
    const nearBalaclava = unsubmittedJobs.filter(j => getProximityTier(j.location) <= 2).length;
    const proximityPct = Math.round((nearBalaclava / totalCount) * 100);

    // Top employer & match score
    const sortedByScore = [...unsubmittedJobs].sort((a, b) => (b.score || 0) - (a.score || 0));
    const topEmployer = sortedByScore[0] || null;

    // Fresh < 7 days; an unknown date is not a verified fresh listing.
    const fresh7Days = unsubmittedJobs.filter((job) => {
      const age = getJobAgeInDays(job.date || job.posted);
      return age !== null && age <= 7;
    }).length;

    // High compensation roles ($100k+)
    const highSalaryCount = unsubmittedJobs.filter(j => {
      const sal = `${j.salary || ''} ${j.compensation || ''} ${j.description || ''}`.toLowerCase();
      return (
        sal.includes('$100') || sal.includes('$110') || sal.includes('$120') || 
        sal.includes('$130') || sal.includes('$140') || sal.includes('$150') ||
        sal.includes('100k') || sal.includes('110k') || sal.includes('120k') ||
        sal.includes('130k') || sal.includes('140k') || sal.includes('150k') ||
        sal.includes('100,000') || sal.includes('110,000') || sal.includes('120,000')
      );
    }).length;

    return {
      nearBalaclava,
      proximityPct,
      topEmployer,
      fresh7Days,
      freshPct: Math.round((fresh7Days / totalCount) * 100),
      highSalaryCount
    };
  }, [unsubmittedJobs]);

  // Top 3 Most Recent Jobs
  const mostRecentJobs = useMemo(() => {
    return [...unsubmittedJobs]
      .sort((a, b) => (b.date || b.posted || '').localeCompare(a.date || a.posted || ''))
      .slice(0, 3);
  }, [unsubmittedJobs]);

  // Highlighted Local Job (Sorted by Proximity Tier to Balaclava, VIC 3183)
  const highlightedLocalJob = useMemo(() => {
    const sortedByProximity = [...unsubmittedJobs].sort((a, b) => {
      const tierA = getProximityTier(a.location);
      const tierB = getProximityTier(b.location);
      if (tierA !== tierB) return tierA - tierB;
      return (b.score || 0) - (a.score || 0);
    });
    return sortedByProximity[0] || unsubmittedJobs[0];
  }, [unsubmittedJobs]);

  // Wild Card Jobs: Curated pool of cool, unusual, cutting-edge, or novelty tech opportunities
  const coolWildCardJobs = useMemo(() => {
    if (!unsubmittedJobs.length) return [];

    const scored = unsubmittedJobs.map(job => {
      const text = `${job.title || ''} ${job.stream || ''} ${job.description || ''} ${job.company || ''}`.toLowerCase();
      let matchCount = 0;
      let matchedArchetype = null;

      for (const archetype of COOL_TECH_ARCHETYPES) {
        const matches = archetype.keywords.filter(kw => text.includes(kw));
        if (matches.length > 0) {
          matchCount += matches.length * 3;
          if (!matchedArchetype) matchedArchetype = archetype;
        }
      }

      // Outlier salary bonus (applied only if matching cool tech or extreme comp $180k+)
      const sal = `${job.salary || ''} ${job.compensation || ''}`.toLowerCase();
      const hasExtremeSalary = sal.includes('180') || sal.includes('190') || sal.includes('200') || sal.includes('220') || sal.includes('250');
      if (matchCount > 0) {
        if (sal.includes('140') || sal.includes('150') || sal.includes('160') || sal.includes('170') || hasExtremeSalary) {
          matchCount += 4;
        }
        // Freshness bonus for verified recent listings
        const age = getJobAgeInDays(job.date || job.posted);
        if (age !== null && age <= 7) matchCount += 2;
      } else if (hasExtremeSalary) {
        matchCount += 3;
      }

      return {
        job,
        coolnessScore: matchCount,
        archetype: matchedArchetype || detectCoolCategory(job)
      };
    });

    const coolMatches = scored
      .filter(entry => entry.coolnessScore > 0)
      .sort((a, b) => b.coolnessScore - a.coolnessScore || (b.job.date || '').localeCompare(a.job.date || ''))
      .map(entry => ({ ...entry.job, coolArchetype: entry.archetype }));

    if (coolMatches.length > 0) {
      return coolMatches;
    }

    // Fallback: Pick highest salary or most unique roles
    return [...unsubmittedJobs]
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5)
      .map(j => ({ ...j, coolArchetype: detectCoolCategory(j) }));
  }, [unsubmittedJobs]);

  const activeWildCardJob = useMemo(() => {
    if (!coolWildCardJobs.length) return null;
    return coolWildCardJobs[wildCardIndex % coolWildCardJobs.length];
  }, [coolWildCardJobs, wildCardIndex]);

  const handleCycleWildCard = (e) => {
    if (e) e.stopPropagation();
    setWildCardIndex(prev => (prev + 1) % Math.max(1, coolWildCardJobs.length));
  };

  // Most Likely to Get (High skill match + Core IT stream)
  const mostLikely = useMemo(() => {
    return [...unsubmittedJobs]
      .filter(j => (j.stream || '').toLowerCase().includes('core') || (j.score || 0) >= 80)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 2);
  }, [unsubmittedJobs]);

  const proximityTier = highlightedLocalJob ? getProximityTier(highlightedLocalJob.location) : 3;

  return (
    <aside className="w-full lg:w-80 xl:w-88 2xl:w-[380px] 3xl:w-[420px] shrink-0 space-y-3 font-sans">
      {/* FEATURED INSIGHTS 1: LIVE POINTS OF INTEREST (Real-Time Telemetry HUD) */}
      <div className="bg-slate-900 text-white rounded-xl p-3.5 border border-indigo-500/40 shadow-md font-mono relative overflow-hidden">
        <div 
          onClick={() => setShowLiveInsights(!showLiveInsights)}
          className="flex items-center justify-between cursor-pointer select-none group"
        >
          <div className="flex items-center gap-2">
            <div className="p-1 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-400/30">
              <Activity size={14} className="animate-pulse text-indigo-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-xs text-indigo-300 uppercase tracking-wider group-hover:text-white transition-colors">
                LIVE POINTS OF INTEREST
              </h3>
              <div className="text-[9px] text-slate-400 font-bold">REAL-TIME DATA TELEMETRY</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-500 text-white">
              LIVE
            </span>
            <button className="text-slate-400 hover:text-white p-0.5">
              {showLiveInsights ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
        </div>

        {showLiveInsights && (
          <div className="space-y-2.5 pt-3 mt-2 border-t border-slate-800 animate-in fade-in duration-200">
            <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation size={13} className="text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-black text-emerald-300">{liveInsights.nearBalaclava} POSITIONS ({liveInsights.proximityPct}%)</div>
                </div>
              </div>
              <span className="text-[9px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">&lt;10KM</span>
            </div>


            {/* Telemetry Item 2: Top Fit Employer */}
            {liveInsights.topEmployer && (
              <div 
                onClick={() => onSelectJob(liveInsights.topEmployer)}
                className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-indigo-500 transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award size={13} className="text-indigo-400 shrink-0" />
                    <div>
                      <div className="text-[9px] text-slate-400 uppercase font-bold">TOP MATCH OPPORTUNITY</div>
                      <div className="text-xs font-black text-white group-hover:text-indigo-300 truncate max-w-[140px]">
                        {liveInsights.topEmployer.company}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/40">
                    {liveInsights.topEmployer.score}% FIT
                  </span>
                </div>
              </div>
            )}

            {/* Telemetry Item 3: 7-Day Freshness Rate */}
            <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-cyan-400 shrink-0" />
                <div>
                  <div className="text-[9px] text-slate-400 uppercase font-bold">7-DAY FRESHNESS RATE</div>
                  <div className="text-xs font-black text-cyan-300">{liveInsights.fresh7Days} ROLES ({liveInsights.freshPct}%)</div>
                </div>
              </div>
              <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/20 px-1.5 py-0.5 rounded">NEW</span>
            </div>

            {/* Telemetry Item 4: High Salary Count */}
            <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign size={13} className="text-amber-400 shrink-0" />
                <div>
                  <div className="text-[9px] text-slate-400 uppercase font-bold">HIGH SALARY ($100K+)</div>
                  <div className="text-xs font-black text-amber-300">{liveInsights.highSalaryCount} POSITIONS</div>
                </div>
              </div>
              <span className="text-[9px] font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">$100K+</span>
            </div>
          </div>
        )}
      </div>

      {/* Featured 2: Highlighted Local Job (Bound to Balaclava, VIC Proximity) */}
      {highlightedLocalJob && (
        <div className="bg-gradient-to-br from-emerald-900 to-slate-900 text-white rounded-xl p-3.5 border border-emerald-700/60 shadow-md font-mono">
          <div 
            onClick={() => setShowLocalJob(!showLocalJob)}
            className="flex items-center justify-between cursor-pointer select-none group"
          >
            <div className="flex items-center gap-2">
              <div className="p-1 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-400/30">
                <Navigation size={14} />
              </div>
              <div>
                <h3 className="font-extrabold text-xs text-emerald-300 uppercase tracking-wider group-hover:text-white transition-colors">
                  CLOSEST LOCAL JOB
                </h3>
                <div className="text-[9px] text-emerald-400/90 font-bold">BALACLAVA VIC PROXIMITY</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950">
                {proximityTier === 1 ? '< 5KM' : proximityTier === 2 ? 'CBD / 10KM' : 'LOCAL'}
              </span>
              <button className="text-emerald-300 hover:text-white p-0.5">
                {showLocalJob ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            </div>
          </div>

          {showLocalJob && (
            <div 
              onClick={() => onSelectJob(highlightedLocalJob)}
              className="cursor-pointer group space-y-2 pt-3 mt-2 border-t border-emerald-800/80 animate-in fade-in duration-200"
            >
              <div>
                <h4 className="font-extrabold text-sm text-white group-hover:text-emerald-300 transition-colors leading-snug">
                  {highlightedLocalJob.company}
                </h4>
                <p className="text-xs font-semibold text-slate-300 mt-0.5">{highlightedLocalJob.title}</p>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-emerald-800/60 text-slate-300">
                <span className="flex items-center gap-1 font-bold">
                  <MapPin size={12} className="text-emerald-400" />
                  {highlightedLocalJob.location}
                </span>
                <span className="font-extrabold text-emerald-400">{highlightedLocalJob.score}% MATCH</span>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); onOpenGenerator(highlightedLocalJob); }}
                className="w-full py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                PACK LOCAL ASSETS <ArrowRight size={12} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Featured 3: Wild Card Job (Cool, Unusual, Cutting-Edge Tech Discovery) */}
      {activeWildCardJob && (
        <div className="bg-gradient-to-br from-violet-950 via-slate-900 to-cyan-950 text-white rounded-xl p-3.5 border border-cyan-500/50 shadow-lg font-mono relative overflow-hidden">
          <div 
            onClick={() => setShowWildCard(!showWildCard)}
            className="flex items-center justify-between cursor-pointer select-none group"
          >
            <div className="flex items-center gap-2">
              <div className="p-1 bg-cyan-500/20 text-cyan-300 rounded border border-cyan-400/30">
                <Dices size={14} className="group-hover:rotate-180 transition-transform duration-500 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-xs text-cyan-300 uppercase tracking-wider group-hover:text-white transition-colors">
                  COOL & UNUSUAL DISCOVERY
                </h3>
                <div className="text-[9px] text-cyan-400/90 font-bold">FRONTIER TECH & NOVELTY ROLES</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-cyan-500/30 text-cyan-200 border border-cyan-500/50">
                {activeWildCardJob.coolArchetype?.badge || 'WILD CARD'}
              </span>
              <button className="text-cyan-300 hover:text-white p-0.5">
                {showWildCard ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            </div>
          </div>

          {showWildCard && (
            <div 
              onClick={() => onSelectJob(activeWildCardJob)}
              className="cursor-pointer group space-y-2 pt-3 mt-2 border-t border-cyan-900/60 animate-in fade-in duration-200"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-extrabold text-sm text-white group-hover:text-cyan-300 transition-colors leading-snug">
                    {activeWildCardJob.company}
                  </h4>
                  <p className="text-xs font-semibold text-slate-300 mt-0.5">{activeWildCardJob.title}</p>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shrink-0">
                  {activeWildCardJob.coolArchetype?.emoji || '⚡'} {activeWildCardJob.coolArchetype?.category || 'Novelty'}
                </span>
              </div>

              <p className="text-[10px] text-cyan-200/90 font-medium italic line-clamp-2 bg-slate-950/70 p-2 rounded border border-cyan-500/20">
                "{activeWildCardJob.stream || activeWildCardJob.coolArchetype?.category || 'Frontier Tech'} — Cutting-edge or unusual opportunity!"
              </p>

              <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-cyan-900/60 text-slate-300">
                <span className="text-amber-300 font-bold">{activeWildCardJob.salary || 'Competitive / Unspecified'}</span>
                <span className="text-violet-300 font-extrabold flex items-center gap-1">
                  <MapPin size={10} className="text-violet-400" />
                  {activeWildCardJob.location}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCycleWildCard}
                  className="flex-1 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-extrabold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-cyan-500/30"
                >
                  <Dices size={13} className="text-cyan-400" />
                  <span>RE-ROLL DISCOVERY ({wildCardIndex + 1}/{coolWildCardJobs.length})</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpenGenerator(activeWildCardJob); }}
                  className="py-1.5 px-3 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  PACK <Sparkles size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Widget 4: Most Recent Jobs (Sleek Dark Cyberpunk HUD) */}
      <div className="bg-slate-900 text-white rounded-xl p-3.5 border border-cyan-500/40 shadow-md font-mono">
        <div 
          onClick={() => setShowMostRecent(!showMostRecent)}
          className="flex items-center justify-between cursor-pointer select-none group"
        >
          <div className="flex items-center gap-2">
            <div className="p-1 bg-cyan-500/20 text-cyan-300 rounded border border-cyan-400/30">
              <Clock size={14} className="text-cyan-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-xs text-cyan-300 uppercase tracking-wider group-hover:text-white transition-colors">
                MOST RECENT JOBS
              </h3>
              <div className="text-[9px] text-slate-400 font-bold">LATEST VERIFIED LISTINGS</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-cyan-500/30 text-cyan-200 border border-cyan-500/50">
              NEWEST
            </span>
            <button className="text-slate-400 hover:text-white p-0.5">
              {showMostRecent ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
        </div>

        {showMostRecent && (
          <div className="space-y-2.5 pt-3 mt-2 border-t border-slate-800 animate-in fade-in duration-200">
            {mostRecentJobs.map((job) => (
              <motion.div 
                whileHover={{ scale: 1.02, x: 2 }}
                key={job.id} 
                onClick={() => onSelectJob(job)}
                className="p-3 rounded-lg bg-slate-950/80 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer group shadow-xs"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-extrabold text-white group-hover:text-cyan-300 transition-colors leading-snug truncate pr-2">
                    {job.company}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold text-cyan-300 bg-cyan-950/80 border border-cyan-500/30 px-1.5 py-0.5 rounded shrink-0">
                    {formatJobPostedAge(job.date)}
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-slate-300 truncate mb-2">{job.title}</p>
                
                <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-800">
                  <span className="text-slate-400 truncate max-w-[140px]">
                    <MapPin size={10} className="inline mr-1 text-slate-500" />
                    {job.location}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenGenerator(job); }}
                    className="text-cyan-300 hover:text-white font-bold flex items-center gap-0.5 cursor-pointer bg-cyan-950/60 hover:bg-cyan-900 px-2 py-0.5 rounded border border-cyan-500/30 transition-colors"
                  >
                    PACK <ArrowRight size={10} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Widget 5: Top 10 Matches (Best Aligned & Newest Job Ads) */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 border border-rose-500/40 shadow-lg font-mono">
        <div 
          onClick={() => setShowTopMatches(!showTopMatches)}
          className="flex items-center justify-between cursor-pointer select-none group"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-rose-500/20 text-rose-300 rounded-xl border border-rose-400/30">
              <Flame size={16} className="text-rose-400 animate-pulse" />
            </div>
            <div>
              <h3 className="font-black text-xs text-rose-300 uppercase tracking-wider group-hover:text-white transition-colors">
                TOP 10 BEST MATCHES
              </h3>
              <div className="text-[9px] text-slate-400 font-bold">BEST ALIGNED & NEWEST JOBS</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-200 border border-rose-500/50">
              TOP 10
            </span>
            <button className="text-slate-400 hover:text-white p-0.5">
              {showTopMatches ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {showTopMatches && (
          <div className="space-y-2.5 pt-3.5 mt-2 border-t border-slate-800 animate-in fade-in duration-200">
            {top10Matches.map((job, idx) => (
              <div 
                key={job.id || `${job.company}_${job.title}_${idx}`} 
                onClick={() => onSelectJob(job)}
                className="p-3 rounded-xl bg-slate-950/80 hover:bg-slate-800/90 border border-slate-800 hover:border-rose-500/50 transition-all cursor-pointer group shadow-xs"
              >
                <div className="flex justify-between items-start mb-1 gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-5 h-5 rounded-lg bg-rose-500/20 text-rose-300 font-black text-[10px] flex items-center justify-center shrink-0 border border-rose-500/30">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-black text-white group-hover:text-rose-300 transition-colors leading-snug truncate">
                      {job.company}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-500/30">
                      <Clock size={9} /> {formatJobPostedAge(job.date)}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/40">
                      <Award size={10} /> {job.score}%
                    </span>
                  </div>
                </div>

                <p className="text-[11px] font-bold text-slate-300 truncate mb-1.5">{job.title}</p>
                
                <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-800 text-slate-400">
                  <span className="truncate max-w-[150px]">
                    <MapPin size={10} className="inline mr-1 text-slate-500" />
                    {job.location}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenGenerator(job); }}
                    className="text-rose-300 hover:text-white font-black flex items-center gap-0.5 cursor-pointer bg-rose-950/60 hover:bg-rose-900 px-2 py-0.5 rounded border border-rose-500/30 transition-colors"
                  >
                    PREP DOCS <ArrowRight size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* Widget 6: Most Likely to Get (Sleek Dark Cyberpunk HUD) */}
      <div className="bg-slate-900 text-white rounded-xl p-3.5 border border-indigo-500/40 shadow-md font-mono">
        <div 
          onClick={() => setShowMostLikely(!showMostLikely)}
          className="flex items-center justify-between cursor-pointer select-none group"
        >
          <div className="flex items-center gap-2">
            <div className="p-1 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-400/30">
              <Sparkles size={14} className="text-indigo-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-xs text-indigo-300 uppercase tracking-wider group-hover:text-white transition-colors">
                MOST LIKELY TO GET
              </h3>
              <div className="text-[9px] text-slate-400 font-bold">MAXIMUM ALIGNMENT & FIT</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-500/50">
              HIGH FIT
            </span>
            <button className="text-slate-400 hover:text-white p-0.5">
              {showMostLikely ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
        </div>

        {showMostLikely && (
          <div className="space-y-2.5 pt-3 mt-2 border-t border-slate-800 animate-in fade-in duration-200">
            {mostLikely.map((job) => (
              <div 
                key={job.id} 
                onClick={() => onSelectJob(job)}
                className="p-3 rounded-lg bg-slate-950/80 hover:bg-slate-800/90 border border-slate-800 hover:border-indigo-500/50 transition-all cursor-pointer group shadow-xs"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-extrabold text-white group-hover:text-indigo-300 transition-colors leading-snug truncate pr-2">
                    {job.company}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[9px] font-black shrink-0">
                    {job.score || 85}% FIT
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-slate-300 truncate mb-2">{job.title}</p>
                
                <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-800">
                  <span className="text-amber-300 font-bold">{job.salary || 'Competitive'}</span>
                  {job.portalLink ? (
                    <a
                      href={job.portalLink.startsWith('http') ? job.portalLink : `http://${job.portalLink}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-indigo-300 hover:text-white font-bold flex items-center gap-0.5 bg-indigo-950/60 hover:bg-indigo-900 px-2 py-0.5 rounded border border-indigo-500/30 transition-colors"
                    >
                      APPLY <ExternalLink size={10} />
                    </a>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenGenerator(job); }}
                      className="text-indigo-300 hover:text-white font-bold flex items-center gap-0.5 cursor-pointer bg-indigo-950/60 hover:bg-indigo-900 px-2 py-0.5 rounded border border-indigo-500/30 transition-colors"
                    >
                      PACK <ArrowRight size={10} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
