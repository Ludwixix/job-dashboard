import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Flame, Award, Sparkles, ArrowRight, MapPin, ExternalLink, Dices, Navigation,
  ChevronDown, ChevronUp, Clock, Activity, DollarSign, Filter
} from 'lucide-react';
import { getJobAgeInDays, formatJobPostedAge } from '../utils/dateUtils';
import { matchesSalaryThreshold, parseSalaryNumeric } from '../utils/salaryUtils';
import { calculateDistanceKm } from '../services/commuteService';

export const extractSuburb = (locStr = '') => {
  if (!locStr) return 'Local';
  const cleaned = locStr.replace(/,\s*(AU|Australia)/i, '').trim();
  const parts = cleaned.split(/\s+(?:VIC|NSW|QLD|WA|SA|TAS|ACT|NT)\b/i);
  if (parts[0] && parts[0].trim().length > 1) return parts[0].trim();
  return cleaned.split(',')[0].trim() || 'Local';
};

export const getDistanceToOrigin = (job, originLoc = '') => {
  if (!job) return 20;
  if (typeof job.distanceKm === 'number' && !isNaN(job.distanceKm)) {
    return job.distanceKm;
  }
  const loc = (job.location || '').toLowerCase();
  if (job.remote || loc.includes('remote') || loc.includes('wfh') || loc.includes('anywhere')) {
    return 0; // Remote roles have 0km commute
  }
  try {
    return calculateDistanceKm(originLoc || 'Melbourne CBD', job.location || 'Melbourne CBD');
  } catch {
    return 15;
  }
};

export const getProximityTier = (locOrJob, originLoc = '') => {
  if (!locOrJob) return 3;
  const dist = typeof locOrJob === 'number' 
    ? locOrJob 
    : getDistanceToOrigin(typeof locOrJob === 'string' ? { location: locOrJob } : locOrJob, originLoc);
  if (dist <= 5) return 1;
  if (dist <= 10) return 2;
  return 3;
};

export const COOL_TECH_ARCHETYPES = [
  {
    category: 'AI & Autonomous Robotics',
    emoji: '🤖',
    badge: 'AI & ROBOTICS',
    keywords: [
      'robotics', 'autonomous', 'drone', 'computer vision', 'machine learning', 
      'deep learning', 'llm', 'generative ai', 'agentic', 'ros', 'slam', 
      'perception', 'humanoid', 'mechatronics'
    ]
  },
  {
    category: 'DeepTech & Aerospace',
    emoji: '🚀',
    badge: 'DEEPTECH & DEFENSE',
    keywords: [
      'aerospace', 'defence', 'defense', 'satellite', 'avionics', 'spacecraft', 
      'orbital', 'propulsion', 'radar', 'lidar', 'uav', 'payload', 'deep space', 'rocketry'
    ]
  },
  {
    category: 'Quantum & Frontier Tech',
    emoji: '⚛️',
    badge: 'QUANTUM / FRONTIER',
    keywords: [
      'quantum', 'qubit', 'supercomputing', 'hpc', 'neuromorphic', 'photonics', 
      'cryogenic', 'semiconductor', 'superconductor', 'nanotechnology'
    ]
  },
  {
    category: 'Creative Tech & Spatial',
    emoji: '🎮',
    badge: 'CREATIVE TECH & VR',
    keywords: [
      'game engine', 'unreal engine', 'unity3d', 'spatial computing', 
      'augmented reality', 'virtual reality', 'creative tech', '3d graphics', 
      'shader', 'vfx', 'metaverse', 'interactive media'
    ]
  },
  {
    category: 'GreenTech & BioTech',
    emoji: '🌱',
    badge: 'GREENTECH & BIO',
    keywords: [
      'biotech', 'bioinformatics', 'genomics', 'greentech', 'cleantech', 
      'clean energy', 'renewable energy', 'battery storage', 'electric vehicle', 
      'climate tech', 'synthetic biology'
    ]
  },
  {
    category: 'Cyber Intel & Forensics',
    emoji: '🛡️',
    badge: 'CYBER INTEL & FORENSICS',
    keywords: [
      'threat intel', 'cyber forensics', 'reverse engineering', 'cryptography', 
      'incident response', 'red team', 'exploit development', 'malware analysis', 
      'penetration testing', 'zero-day'
    ]
  },
  {
    category: 'R&D Labs & Skunkworks',
    emoji: '🧪',
    badge: 'R&D & INNOVATION',
    keywords: [
      'r&d', 'applied research', 'innovation lab', 'stealth startup', 
      'applied science', 'experimental prototype', 'skunkworks', 'futurist', 'advanced research'
    ]
  }
];

export const matchesKeyword = (text, kw) => {
  if (!text || !kw) return false;
  const lowerText = text.toLowerCase();
  const lowerKw = kw.toLowerCase();
  // Short keywords or symbols require word boundary matching so e.g. "ev" doesn't match "development"
  if (lowerKw.length <= 4 || lowerKw.includes('&')) {
    const escaped = lowerKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9])${escaped}(?:$|[^a-zA-Z0-9])`, 'i');
    return regex.test(lowerText);
  }
  return lowerText.includes(lowerKw);
};

export const extractHighlightSnippet = (job, keywords = []) => {
  const desc = job.description || job.snippet || '';
  if (!desc) return null;
  const sentences = desc.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    if (keywords.some(kw => matchesKeyword(sentence, kw))) {
      const clean = sentence.trim().replace(/^["'\s]+|["'\s]+$/g, '');
      if (clean.length >= 25 && clean.length <= 180) {
        return clean;
      }
    }
  }
  return desc.slice(0, 130).trim() + (desc.length > 130 ? '...' : '');
};

const detectCoolCategory = (job) => {
  if (!job) return { category: 'Frontier Tech', emoji: '⚡', badge: 'FRONTIER TECH' };
  const text = `${job.title || ''} ${job.stream || ''} ${job.description || ''} ${job.company || ''}`;
  for (const archetype of COOL_TECH_ARCHETYPES) {
    if (archetype.keywords.some(kw => matchesKeyword(text, kw))) {
      return archetype;
    }
  }
  return {
    category: 'Frontier Tech',
    emoji: '⚡',
    badge: 'CUTTING-EDGE TECH'
  };
};

// Global WeakMap cache to prevent re-evaluating regexes across unchanged job instances
const coolnessCache = new WeakMap();

const evaluateJobCoolness = (job) => {
  if (!job) return null;
  if (coolnessCache.has(job)) {
    return coolnessCache.get(job);
  }

  const title = job.title || '';
  const desc = job.description || job.snippet || '';
  const stream = job.stream || '';
  const tags = Array.isArray(job.tags) ? job.tags.join(' ') : '';

  let matchScore = 0;
  let matchedArchetype = null;
  const matchedKwList = [];

  for (const archetype of COOL_TECH_ARCHETYPES) {
    let archetypeMatches = 0;
    for (const kw of archetype.keywords) {
      if (matchesKeyword(title, kw)) {
        archetypeMatches += 6;
        matchedKwList.push(kw);
      } else if (matchesKeyword(stream, kw) || matchesKeyword(tags, kw)) {
        archetypeMatches += 4;
        matchedKwList.push(kw);
      } else if (matchesKeyword(desc, kw)) {
        archetypeMatches += 2;
        matchedKwList.push(kw);
      }
    }
    if (archetypeMatches > 0) {
      matchScore += archetypeMatches;
      if (!matchedArchetype) matchedArchetype = archetype;
    }
  }

  // Outlier salary bonus
  const parsedSal = parseSalaryNumeric(job);
  if (matchScore > 0 && parsedSal.max && parsedSal.max >= 150000) {
    matchScore += 4;
  }

  // Freshness bonus for verified recent listings that matched an archetype
  const age = getJobAgeInDays(job.date || job.posted);
  if (matchScore > 0 && age !== null && age <= 7) matchScore += 2;

  const result = {
    job,
    coolnessScore: matchScore,
    archetype: matchedArchetype || detectCoolCategory(job),
    matchedKeywords: Array.from(new Set(matchedKwList))
  };

  coolnessCache.set(job, result);
  return result;
};

export const TopMatchesSidebar = ({ 
  jobs = [], 
  onSelectJob, 
  onOpenGenerator, 
  baseLocation = 'BALACLAVA VIC 3183',
  allJobsCount = 0,
  activeStreamTab = 'All',
  searchQuery = ''
}) => {
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

  // Live Analytics & Points of Interest Computation (Dynamic to candidate's base location)
  const liveInsights = useMemo(() => {
    const totalCount = unsubmittedJobs.length || 1;
    let nearLocation = 0;
    let topEmployer = null;
    let topScore = -Infinity;
    let fresh7Days = 0;
    let highSalaryCount = 0;

    for (let i = 0; i < unsubmittedJobs.length; i++) {
      const j = unsubmittedJobs[i];
      if (getDistanceToOrigin(j, baseLocation) <= 10) {
        nearLocation++;
      }
      const score = j.score || 0;
      if (score > topScore) {
        topScore = score;
        topEmployer = j;
      }
      const age = getJobAgeInDays(j.date || j.posted);
      if (age !== null && age <= 7) {
        fresh7Days++;
      }
      if (matchesSalaryThreshold(j, '100k+')) {
        highSalaryCount++;
      }
    }

    return {
      nearLocation,
      nearBalaclava: nearLocation,
      proximityPct: Math.round((nearLocation / totalCount) * 100),
      topEmployer,
      fresh7Days,
      freshPct: Math.round((fresh7Days / totalCount) * 100),
      highSalaryCount
    };
  }, [unsubmittedJobs, baseLocation]);

  // Top 3 Most Recent Jobs
  const mostRecentJobs = useMemo(() => {
    return [...unsubmittedJobs]
      .sort((a, b) => (b.date || b.posted || '').localeCompare(a.date || a.posted || ''))
      .slice(0, 3);
  }, [unsubmittedJobs]);

  // Highlighted Local Job (Single-pass O(n) proximity search to candidate's baseLocation)
  const baseSuburb = useMemo(() => extractSuburb(baseLocation), [baseLocation]);

  const highlightedLocalJob = useMemo(() => {
    if (!unsubmittedJobs.length) return null;
    let closest = unsubmittedJobs[0];
    let minDist = getDistanceToOrigin(closest, baseLocation);

    for (let i = 1; i < unsubmittedJobs.length; i++) {
      const j = unsubmittedJobs[i];
      const dist = getDistanceToOrigin(j, baseLocation);
      if (dist < minDist) {
        closest = j;
        minDist = dist;
      } else if (dist === minDist && (j.score || 0) > (closest.score || 0)) {
        closest = j;
        minDist = dist;
      }
    }
    return closest;
  }, [unsubmittedJobs, baseLocation]);

  const localJobDist = highlightedLocalJob ? getDistanceToOrigin(highlightedLocalJob, baseLocation) : 0;

  // Wild Card Jobs: Curated pool of cool, unusual, cutting-edge, or novelty tech opportunities (Cached via WeakMap)
  const coolWildCardJobs = useMemo(() => {
    if (!unsubmittedJobs.length) return [];

    const scored = unsubmittedJobs.map(evaluateJobCoolness).filter(Boolean);

    const coolMatches = scored
      .filter(entry => entry.coolnessScore > 0)
      .sort((a, b) => b.coolnessScore - a.coolnessScore || (b.job.date || '').localeCompare(a.job.date || ''))
      .map(entry => ({
        ...entry.job,
        coolArchetype: entry.archetype,
        matchedKeywords: entry.matchedKeywords,
        highlightSnippet: extractHighlightSnippet(entry.job, entry.matchedKeywords)
      }));

    if (coolMatches.length > 0) {
      return coolMatches;
    }

    // Fallback: Pick highest salary or most unique roles
    return [...unsubmittedJobs]
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5)
      .map(j => ({
        ...j,
        coolArchetype: detectCoolCategory(j),
        matchedKeywords: [],
        highlightSnippet: extractHighlightSnippet(j, [])
      }));
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
 <div className="bg-slate-900 text-white rounded-sm p-3.5 border border-amber-500/40 font-mono relative overflow-hidden">
 <div 
 onClick={() => setShowLiveInsights(!showLiveInsights)}
 className="flex items-center justify-between cursor-pointer select-none group"
 >
 <div className="flex items-center gap-2">
 <div className="p-1 bg-amber-500/20 text-amber-300 rounded border border-amber-400/30">
 <Activity size={14} className="animate-pulse text-amber-400" />
 </div>
 <div>
 <h3 className="font-extrabold text-xs text-amber-300 uppercase tracking-wider group-hover:text-white transition-colors">
 LIVE POINTS OF INTEREST
 </h3>
 <div className="text-[9px] text-slate-400 font-bold">REAL-TIME DATA TELEMETRY</div>
 </div>
 </div>
 <div className="flex items-center gap-1.5">
 <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500 text-white">
 LIVE
 </span>
 <button className="text-slate-400 hover:text-white p-0.5">
 {showLiveInsights ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
 </button>
 </div>
 </div>

 {showLiveInsights && (
 <div className="space-y-2.5 pt-3 mt-2 border-t border-slate-800 animate-in fade-in duration-200">
 <div className="p-2.5 rounded-sm bg-slate-950/70 border border-slate-800 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Navigation size={13} className="text-emerald-400 shrink-0" />
 <div>
 <div className="text-[9px] text-slate-400 uppercase font-bold">COMMUTE PROXIMITY (&lt;10KM)</div>
 <div className="text-xs font-black text-emerald-300">{liveInsights.nearLocation} POSITIONS ({liveInsights.proximityPct}%)</div>
 </div>
 </div>
 <span className="text-[9px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">&lt;10KM</span>
 </div>


 {/* Telemetry Item 2: Top Fit Employer */}
 {liveInsights.topEmployer && (
 <div 
 onClick={() => onSelectJob(liveInsights.topEmployer)}
 className="p-2.5 rounded-sm bg-slate-950/70 border border-slate-800 hover:border-amber-500 transition-colors cursor-pointer group"
 >
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Award size={13} className="text-amber-400 shrink-0" />
 <div>
 <div className="text-[9px] text-slate-400 uppercase font-bold">TOP MATCH OPPORTUNITY</div>
 <div className="text-xs font-black text-white group-hover:text-amber-300 truncate max-w-[140px]">
 {liveInsights.topEmployer.company}
 </div>
 <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
 {liveInsights.topEmployer.title}
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
 <div className="p-2.5 rounded-sm bg-slate-950/70 border border-slate-800 flex items-center justify-between">
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
 <div className="p-2.5 rounded-sm bg-slate-950/70 border border-slate-800 flex items-center justify-between">
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
 <div className="bg-gradient-to-br from-emerald-900 to-slate-900 text-white rounded-sm p-3.5 border border-emerald-700/60 font-mono">
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
 <div className="text-[9px] text-emerald-400/90 font-bold">{baseSuburb.toUpperCase()} PROXIMITY</div>
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
 className="w-full py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs -xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
 >
 PACK LOCAL ASSETS <ArrowRight size={12} />
 </button>
 </div>
 )}
 </div>
 )}

 {/* Featured 3: Wild Card Job (Cool, Unusual, Cutting-Edge Tech Discovery) */}
 {activeWildCardJob && (
 <div className="bg-gradient-to-br from-violet-950 via-slate-900 to-cyan-950 text-white rounded-sm p-3.5 border border-cyan-500/50 font-mono relative overflow-hidden">
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

 <p className="text-[10px] text-cyan-100 font-normal italic line-clamp-2 bg-slate-950/70 p-2 rounded border border-cyan-500/20">
 "{activeWildCardJob.highlightSnippet || `${activeWildCardJob.stream || activeWildCardJob.coolArchetype?.category || 'Frontier Tech'} — Cutting-edge or unusual opportunity!`}"
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
 className="flex-1 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-extrabold text-xs -xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-cyan-500/30"
 >
 <Dices size={13} className="text-cyan-400" />
 <span>RE-ROLL DISCOVERY ({wildCardIndex + 1}/{coolWildCardJobs.length})</span>
 </button>

 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); onOpenGenerator(activeWildCardJob); }}
 className="py-1.5 px-3 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs -xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
 >
 PACK <Sparkles size={12} />
 </button>
 </div>
 </div>
 )}
 </div>
 )}

 {/* Widget 4: Most Recent Jobs (Sleek Dark Cyberpunk HUD) */}
 <div className="bg-slate-900 text-white rounded-sm p-3.5 border border-cyan-500/40 font-mono">
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
 className="p-3 rounded-sm bg-slate-950/80 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer group -xs"
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
 <span className="text-slate-300 truncate max-w-[140px]">
 <MapPin size={10} className="inline mr-1 text-slate-400" />
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
 <div className="bg-slate-900 text-white rounded-sm p-4 border border-rose-500/40 font-mono">
 <div 
 onClick={() => setShowTopMatches(!showTopMatches)}
 className="flex items-center justify-between cursor-pointer select-none group"
 >
 <div className="flex items-center gap-2.5">
 <div className="p-1.5 bg-rose-500/20 text-rose-300 rounded-sm border border-rose-400/30">
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
 <span className="text-[9px] font-black px-2 py-0.5 rounded-sm bg-rose-500/30 text-rose-200 border border-rose-500/50">
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
 className="p-3 rounded-sm bg-slate-950/80 hover:bg-slate-800/90 border border-slate-800 hover:border-rose-500/50 transition-all cursor-pointer group -xs"
 >
 <div className="flex justify-between items-start mb-1 gap-2">
 <div className="flex items-center gap-2 truncate">
 <span className="w-5 h-5 rounded-sm bg-rose-500/20 text-rose-300 font-black text-[10px] flex items-center justify-center shrink-0 border border-rose-500/30">
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
 
 <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-800 text-slate-300">
 <span className="truncate max-w-[150px]">
 <MapPin size={10} className="inline mr-1 text-slate-400" />
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
 <div className="bg-slate-900 text-white rounded-sm p-3.5 border border-amber-500/40 font-mono">
 <div 
 onClick={() => setShowMostLikely(!showMostLikely)}
 className="flex items-center justify-between cursor-pointer select-none group"
 >
 <div className="flex items-center gap-2">
 <div className="p-1 bg-amber-500/20 text-amber-300 rounded border border-amber-400/30">
 <Sparkles size={14} className="text-amber-400" />
 </div>
 <div>
 <h3 className="font-extrabold text-xs text-amber-300 uppercase tracking-wider group-hover:text-white transition-colors">
 MOST LIKELY TO GET
 </h3>
 <div className="text-[9px] text-slate-400 font-bold">MAXIMUM ALIGNMENT & FIT</div>
 </div>
 </div>
 <div className="flex items-center gap-1.5">
 <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-200 border border-amber-500/50">
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
 className="p-3 rounded-sm bg-slate-950/80 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/50 transition-all cursor-pointer group -xs"
 >
 <div className="flex justify-between items-start mb-1">
 <span className="text-xs font-extrabold text-white group-hover:text-amber-300 transition-colors leading-snug truncate pr-2">
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
 className="text-amber-300 hover:text-white font-bold flex items-center gap-0.5 bg-amber-950/60 hover:bg-amber-900 px-2 py-0.5 rounded border border-amber-500/30 transition-colors"
 >
 APPLY <ExternalLink size={10} />
 </a>
 ) : (
 <button
 onClick={(e) => { e.stopPropagation(); onOpenGenerator(job); }}
 className="text-amber-300 hover:text-white font-bold flex items-center gap-0.5 cursor-pointer bg-amber-950/60 hover:bg-amber-900 px-2 py-0.5 rounded border border-amber-500/30 transition-colors"
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
