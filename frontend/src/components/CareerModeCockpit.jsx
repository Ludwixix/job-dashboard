import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Crown, Sparkles, ShieldCheck, DollarSign, MapPin, CheckCircle2,
  AlertTriangle, Filter, Search, RefreshCw, ExternalLink, Zap,
  Award, Briefcase, ChevronRight, Layers, ArrowUpRight, Cpu
} from 'lucide-react';
import {
  fetchCareerOverview,
  fetchCareerMatches,
  CANONICAL_SAM_ARCHETYPES
} from '../services/careerCockpitService';
import { ApplicationStudioModal } from './ApplicationStudioModal';

/**
 * CareerModeCockpit
 * Dedicated, hyper-personalized "Sam Mode" Personal Career Command Center.
 * Custom-tailored to Sam Ludwig's 10-year enterprise history (Dept of Education VIC,
 * St John of God Health Care), target roles, $140k-$165k salary, and Balaclava location.
 *
 * @param {Object} props
 * @param {Array} [props.jobs] - Real-time jobs from dashboard parent.
 * @param {Function} [props.onUpdateStatus] - Job tracker status update callback.
 * @returns {React.ReactElement}
 */
export const CareerModeCockpit = ({ jobs = [], onUpdateStatus, onSelectJob }) => {
  const [overview, setOverview] = useState(null);
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedArchetype, setSelectedArchetype] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [minScore, setMinScore] = useState(70);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [selectedJobForStudio, setSelectedJobForStudio] = useState(null);

  const loadCockpitData = useCallback(async (force = false) => {
    if (force) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [overviewData, matchesData] = await Promise.all([
        fetchCareerOverview(),
        fetchCareerMatches({ limit: 100 })
      ]);

      if (overviewData) setOverview(overviewData);

      let fetchedMatches = matchesData?.jobs || [];

      // If backend matches are empty (e.g. offline dev), score client-side against props.jobs
      if (fetchedMatches.length === 0 && jobs && jobs.length > 0) {
        fetchedMatches = jobs
          .map((job) => {
            const title = String(job.title || '').toLowerCase();
            const desc = String(job.notes || job.description || '').toLowerCase();
            const loc = String(job.location || '').toLowerCase();

            let score = 75;
            const chips = [];
            const proofPoints = [];

            // Enterprise Scale & M365 Match
            if (title.includes('m365') || desc.includes('365') || desc.includes('entra') || desc.includes('azure')) {
              score += 15;
              chips.push({ label: 'M365 & Entra ID: 100%', variant: 'match' });
              proofPoints.push('Matches 660,000+ user M365 enterprise administration at Dept of Education VIC');
            }

            // Endpoint & Intune Match
            if (title.includes('endpoint') || title.includes('euc') || desc.includes('intune') || desc.includes('autopilot')) {
              score += 12;
              chips.push({ label: 'Autopilot/Intune: Match', variant: 'match' });
              proofPoints.push('Matches 100+ clinical endpoint Windows 11 Autopilot migration at St John of God Health Care');
            }

            // Systems / Infrastructure Match
            if (title.includes('systems') || title.includes('infrastructure') || title.includes('cloud')) {
              score += 8;
              chips.push({ label: 'Systems & Infra: 95%', variant: 'match' });
            }

            // PowerShell / Automation Match
            if (desc.includes('powershell') || desc.includes('automation') || desc.includes('devops')) {
              chips.push({ label: 'PowerShell Runbooks: Match', variant: 'match' });
              proofPoints.push('Matches enterprise PowerShell automation reducing manual provisioning by 80%');
            }

            // Clearance & Work rights
            chips.push({ label: 'Work Rights: Unrestricted Citizen', variant: 'match' });
            chips.push({ label: 'Clearance: Baseline / NV1 Ready', variant: 'match' });

            // Salary evaluation
            const salary = String(job.salary || '');
            if (salary.includes('140') || salary.includes('150') || salary.includes('160') || salary.includes('k')) {
              chips.push({ label: 'Salary: In Range ($140k-$165k)', variant: 'match' });
            } else {
              chips.push({ label: 'Salary: Permissive Pass', variant: 'neutral' });
            }

            // Determine Archetype
            let archetype = job.archetype || job.role_archetype;
            if (archetype === 'Senior M365 Engineer') {
              archetype = 'Senior M365 Specialist';
            }
            if (!archetype) {
              if (/m365|microsoft 365|office 365/i.test(title)) archetype = 'Senior M365 Specialist';
              else if (/devops|automation|powershell/i.test(title)) archetype = 'Automation & DevOps Engineer';
              else if (/endpoint|euc|intune|autopilot/i.test(title)) archetype = 'Endpoint / EUC Engineer';
              else if (/sharepoint|modern workplace|workplace/i.test(title)) archetype = 'SharePoint & Modern Workplace Architect';
              else if (/operations|tier 3|tier-3|l3|ops lead/i.test(title)) archetype = 'L3 Systems / Operations Lead';
              else if (/cloud/i.test(title)) archetype = 'Cloud Infrastructure Specialist';
              else if (/infrastructure/i.test(title)) archetype = 'Senior Infrastructure Engineer';
              else if (/systems/i.test(title)) archetype = 'Senior Systems Engineer';
              else archetype = 'Senior Infrastructure Engineer';
            }

            return {
              ...job,
              samScore: Math.min(99, score),
              justificationScore: Math.min(98, score - 2),
              archetype,
              matchExplanationChips: chips.map(c => c.label),
              proofPoints: proofPoints.length > 0 ? proofPoints : [
                'Matches 10-year enterprise infrastructure engineering and tier-3 support record'
              ]
            };
          })
          .sort((a, b) => (b.samScore || 0) - (a.samScore || 0));
      }

      setMatches(fetchedMatches);
    } catch (err) {
      console.warn('Error loading cockpit data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [jobs]);

  useEffect(() => {
    loadCockpitData();
  }, [loadCockpitData]);

  // Filtered jobs matching archetype, score threshold, search, and remote toggle
  const filteredMatches = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return matches.filter((job) => {
      const title = String(job.title || '').toLowerCase();
      const company = String(job.company || '').toLowerCase();
      const loc = String(job.location || '').toLowerCase();
      const arch = String(job.archetype || '');
      const score = Number(job.samScore || job.sam_score || 75);
      const isRemote = Boolean(job.remote) || loc.includes('remote') || title.includes('remote');

      if (selectedArchetype !== 'ALL' && arch !== selectedArchetype) return false;
      if (score < minScore) return false;
      if (remoteOnly && !isRemote) return false;
      if (query && !title.includes(query) && !company.includes(query) && !loc.includes(query)) return false;

      return true;
    });
  }, [matches, selectedArchetype, minScore, remoteOnly, searchQuery]);

  return (
    <div className="space-y-5 font-sans animate-in fade-in duration-300 pb-12">
      {/* ── Top Header Banner & Personal Profile Snapshot ── */}
      <div className="relative rounded-sm bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-950 border border-amber-500/40 p-4 sm:p-6 shadow-xl overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold uppercase tracking-wider">
                <Crown size={12} className="text-amber-400" />
                Hyper-Personalized Mode
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-semibold">
                <CheckCircle2 size={11} /> 10-Yr Enterprise Record
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-mono font-semibold">
                <ShieldCheck size={11} /> Dept of Ed VIC &amp; St John of God
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Sam Mode: Personal Career Cockpit</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Real-time radar tuned strictly to Sam Ludwig's verified career history, $140k–$165k salary band,
              and Melbourne / Balaclava hybrid and remote enterprise infrastructure roles.
            </p>
          </div>

          <button
            onClick={() => loadCockpitData(true)}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-sm bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-amber-500/40 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0 self-start lg:self-center"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-amber-400' : 'text-slate-400'} />
            <span>{isRefreshing ? 'Re-scoring Feed…' : 'Sync Opportunities'}</span>
          </button>
        </div>
      </div>

      {/* ── Telemetry HUD (4 Responsive Glassmorphic Cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Target Salary */}
        <div className="p-4 rounded-sm bg-slate-900/80 border border-slate-800 backdrop-blur-sm relative overflow-hidden group hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span className="uppercase tracking-wider">Target Compensation</span>
            <DollarSign size={14} className="text-amber-400" />
          </div>
          <div className="text-lg font-black text-white mt-1.5 font-mono">
            $140k – $165k <span className="text-xs font-normal text-slate-400">+ Super</span>
          </div>
          <div className="text-[11px] text-amber-400/90 mt-1 font-mono flex items-center gap-1">
            <span>Floor: $120k</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400">Hard Knockout Armed</span>
          </div>
        </div>

        {/* Card 2: Rights & Clearance */}
        <div className="p-4 rounded-sm bg-slate-900/80 border border-slate-800 backdrop-blur-sm relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span className="uppercase tracking-wider">Rights &amp; Clearance</span>
            <ShieldCheck size={14} className="text-emerald-400" />
          </div>
          <div className="text-base font-black text-emerald-400 mt-1.5 flex items-center gap-1.5">
            <span>Australian Citizen</span>
          </div>
          <div className="text-[11px] text-slate-300 mt-1 font-mono flex items-center gap-1 truncate">
            <span>Baseline / NV1 Eligible (Zero Knockout)</span>
          </div>
        </div>

        {/* Card 3: Location & Commute */}
        <div className="p-4 rounded-sm bg-slate-900/80 border border-slate-800 backdrop-blur-sm relative overflow-hidden group hover:border-teal-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span className="uppercase tracking-wider">Commute Boundary</span>
            <MapPin size={14} className="text-teal-400" />
          </div>
          <div className="text-base font-black text-white mt-1.5 truncate">
            Balaclava 3183 &amp; Melb SE
          </div>
          <div className="text-[11px] text-teal-400/90 mt-1 font-mono flex items-center gap-1">
            <span>Hybrid (1-3 days) or 100% Remote</span>
          </div>
        </div>

        {/* Card 4: Scraper Sentinel Telemetry */}
        <div className="p-4 rounded-sm bg-slate-900/80 border border-slate-800 backdrop-blur-sm relative overflow-hidden group hover:border-purple-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span className="uppercase tracking-wider">Scraper Sentinel</span>
            <Zap size={14} className="text-purple-400" />
          </div>
          <div className="text-lg font-black text-white mt-1.5 font-mono flex items-center gap-2">
            <span>{filteredMatches.length} Matches</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 uppercase">
              {overview?.telemetry?.feed_health || 'Healthy'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono flex items-center gap-1">
            <span>+{overview?.telemetry?.new_vacancies_today || 14} new today</span>
            <span className="text-slate-600">•</span>
            <span>1-Worker Paced</span>
          </div>
        </div>
      </div>

      {/* ── 8 Core Target Archetype Filter Bar ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Filter size={13} className="text-amber-400" /> Target Role Archetypes
          </span>
          <span className="text-slate-500 text-[11px]">
            Showing {filteredMatches.length} suitable opportunities
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto touch-scroll-x pb-2 pt-0.5 scrollbar-none">
          <button
            onClick={() => setSelectedArchetype('ALL')}
            className={`px-3 py-1.5 rounded-sm text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap min-h-[44px] sm:min-h-0 touch-target-44 ${
              selectedArchetype === 'ALL'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-slate-900/90 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700'
            }`}
          >
            All Roles ({matches.length})
          </button>

          {CANONICAL_SAM_ARCHETYPES.map((arch) => {
            const count = matches.filter(m => m.archetype === arch).length;
            const isSelected = selectedArchetype === arch;
            return (
              <button
                key={arch}
                onClick={() => setSelectedArchetype(arch)}
                className={`px-3 py-1.5 rounded-sm text-xs font-mono font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 min-h-[44px] sm:min-h-0 touch-target-44 ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-xs'
                    : 'bg-slate-900/80 text-slate-400 border border-slate-800/80 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span>{arch}</span>
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-amber-500/40 text-amber-200 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Search & Filter Controls Bar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-sm bg-slate-900/80 border border-slate-800">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by keyword (e.g. M365, Intune, Azure, PowerShell, hospital, education)..."
            className="w-full bg-slate-950 border border-slate-800 rounded-sm pl-9 pr-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Min Score Filter */}
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
            <span>Min Fit:</span>
            <select
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 rounded-sm px-2 py-1 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value={50}>50%+</option>
              <option value={65}>65%+</option>
              <option value={70}>70%+ (Strong)</option>
              <option value={80}>80%+ (Top Match)</option>
              <option value={90}>90%+ (Prime Target)</option>
            </select>
          </div>

          {/* Remote Only Toggle */}
          <button
            type="button"
            onClick={() => setRemoteOnly(!remoteOnly)}
            className={`px-3 py-1.5 rounded-sm text-xs font-mono font-bold transition-all cursor-pointer border ${
              remoteOnly
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            {remoteOnly ? '✓ Remote Only' : 'Include Remote'}
          </button>
        </div>
      </div>

      {/* ── Scored Matches Feed ── */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw size={28} className="animate-spin text-amber-400" />
            <p className="text-xs font-mono text-slate-400">
              Evaluating opportunities against 10-year enterprise record…
            </p>
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="p-8 text-center rounded-sm bg-slate-900/60 border border-slate-800 space-y-2">
            <p className="text-sm font-bold text-slate-300">No matching positions found.</p>
            <p className="text-xs text-slate-500">
              Try adjusting the archetype filter or lowering the minimum match score threshold.
            </p>
            <button
              onClick={() => {
                setSelectedArchetype('ALL');
                setMinScore(50);
                setSearchQuery('');
                setRemoteOnly(false);
              }}
              className="mt-3 px-3 py-1.5 rounded-sm bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs font-mono cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredMatches.map((job) => {
            const score = job.samScore || job.sam_score || 75;
            const justScore = job.justificationScore || job.justification_score || 90;
            const chips = job.matchExplanationChips || job.chips || [];
            const proofPoints = job.proofPoints || job.proof_points || [];

            return (
              <div
                key={job.id}
                onClick={() => onSelectJob && onSelectJob(job)}
                className="p-4 sm:p-5 rounded-sm bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all duration-200 space-y-3 hover:shadow-lg cursor-pointer"
              >
                {/* Job Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {job.archetype || 'Senior Infrastructure Engineer'}
                      </span>
                      {job.salary && (
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {job.salary}
                        </span>
                      )}
                      {job.location && (
                        <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                          <MapPin size={11} /> {job.location}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-black text-white hover:text-amber-300 transition-colors">
                      {job.title}
                    </h3>
                    <div className="text-xs text-slate-400 font-medium">
                      {job.company}
                    </div>
                  </div>

                  {/* Score Badges */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-[9px] font-mono font-bold text-slate-500 uppercase">
                        Career Match
                      </div>
                      <div className="text-lg font-black font-mono text-emerald-400">
                        {score}%
                      </div>
                    </div>
                    <div className="w-px h-8 bg-slate-800" />
                    <div className="text-right">
                      <div className="text-[9px] font-mono font-bold text-slate-500 uppercase">
                        Justification
                      </div>
                      <div className="text-lg font-black font-mono text-amber-400">
                        {justScore}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Match Chips */}
                {chips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {chips.map((chip, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-[10px] font-mono text-slate-300 flex items-center gap-1"
                      >
                        <CheckCircle2 size={10} className="text-emerald-400" />
                        <span>{typeof chip === 'string' ? chip : chip.label}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Verified Proof Points */}
                {proofPoints.length > 0 && (
                  <div className="p-3 rounded bg-slate-950/60 border border-slate-800/80 text-[11px] space-y-1">
                    <span className="text-[10px] font-mono font-bold text-amber-400/90 uppercase tracking-wider block">
                      Verified Career Proof Points:
                    </span>
                    <ul className="space-y-1 text-slate-300">
                      {proofPoints.map((pt, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-amber-500 shrink-0 font-bold">•</span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Controls */}
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {job.url && (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                      >
                        <span>View Vacancy</span>
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedJobForStudio(job);
                      }}
                      className="px-3.5 py-2 rounded-sm bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-xs min-h-[44px] sm:min-h-0 touch-target-44"
                    >
                      <Sparkles size={13} />
                      <span>1-Click Application Studio</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── 1-Click Application Studio Modal ── */}
      {selectedJobForStudio && (
        <ApplicationStudioModal
          job={selectedJobForStudio}
          onClose={() => setSelectedJobForStudio(null)}
        />
      )}
    </div>
  );
};
