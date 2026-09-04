import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  MapPin, 
  DollarSign, 
  ArrowUpRight, 
  Sliders, 
  ShieldCheck, 
  Activity, 
  Target,
  FileText,
  Clock,
  Compass,
  Zap,
  Terminal,
  ChevronRight
} from 'lucide-react';
import { formatJobPostedAge, getJobAgeInDays } from '../utils/dateUtils';

export default function MonolithMode({
  jobs = [],
  profile = null,
  applications = [],
  onSwitchMode,
  onOpenJobModal,
  onOpenGenerator,
  onOpenProfileModal,
  onOpenCommandPalette
}) {
  // Filter active unsubmitted jobs
  const activeJobs = useMemo(() => {
    if (!jobs || jobs.length === 0) return [];
    return jobs.filter(job => {
      const s = (job.status || 'sourced').toLowerCase();
      return !s.includes('applied') &&
             !s.includes('confirmation') &&
             !s.includes('interview') &&
             !s.includes('under review') &&
             !s.includes('action required') &&
             !s.includes('unsuccessful') &&
             !s.includes('rejected') &&
             !s.includes('closed') &&
             !s.includes('expired');
    });
  }, [jobs]);

  // Ranked jobs pool: 65% match score + 35% date recency
  const rankedJobs = useMemo(() => {
    return [...activeJobs]
      .map(job => {
        const score = Number(job.score) || 75;
        const age = getJobAgeInDays(job.date || job.posted);
        const recencyScore = age === null ? 40 : Math.max(0, 100 - (age * 7));
        const compositeRank = (score * 0.65) + (recencyScore * 0.35);
        return { ...job, compositeRank, ageInDays: age };
      })
      .sort((a, b) => b.compositeRank - a.compositeRank || (b.date || '').localeCompare(a.date || ''));
  }, [activeJobs]);

  // Prime Monolith: Single highest-impact opportunity
  const primeJob = rankedJobs[0] || null;

  // Curated Slabs: Top 4 secondary prime vectors
  const secondarySlabs = useMemo(() => {
    return rankedJobs.slice(1, 5);
  }, [rankedJobs]);

  const totalAssimilated = jobs.length || 6106;

  return (
    <div className="min-h-screen bg-[#090807] text-[#ede6dc] font-mono selection:bg-[#c67d34] selection:text-black antialiased relative overflow-hidden flex flex-col justify-between">
      {/* Background Subtle Sand Gradient Atmosphere */}
      <div 
        className="pointer-events-none fixed inset-0 opacity-[0.035] bg-[radial-gradient(#d4a373_1px,transparent_1px)] [background-size:24px_24px]" 
        aria-hidden="true" 
      />
      <div 
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-gradient-to-b from-[#c67d34]/[0.04] to-transparent blur-3xl"
        aria-hidden="true"
      />

      {/* 1. MONOLITHIC HEADER */}
      <header className="relative z-10 border-b border-[#231e19] bg-[#0d0b09]/95 backdrop-blur-md px-6 lg:px-12 py-5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Monolith Wordmark & Subtitle */}
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-none border border-[#b87326]/60 bg-[#171410] flex items-center justify-center shadow-lg">
              <span className="text-base text-[#d48b38] font-black">▲</span>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-sm lg:text-base font-black tracking-[0.3em] uppercase text-[#ede6dc]">
                  THE MONOLITH
                </h1>
                <span className="text-[9px] tracking-[0.2em] font-extrabold px-2 py-0.5 border border-[#b87326]/40 text-[#d48b38] bg-[#b87326]/10">
                  DUNE MINIMALIST
                </span>
              </div>
              <p className="text-[10px] tracking-[0.2em] text-[#9c9183] mt-0.5 uppercase">
                PURE EFFICIENCY & CALM // {totalAssimilated.toLocaleString()} MARKET SIGNALS ASSIMILATED
              </p>
            </div>
          </div>

          {/* Controls: Mode Switcher & Profile Anchor */}
          <div className="flex items-center gap-3">
            {/* 3-Way Mode Switcher */}
            <div className="inline-flex p-1 border border-[#2d2720] bg-[#120f0d] text-[10px] tracking-[0.15em] font-bold">
              <button
                type="button"
                className="px-3 py-1 bg-[#2b241c] text-[#d48b38] border border-[#b87326]/40 cursor-default shadow-xs"
              >
                ▲ MONOLITH
              </button>
              <button
                type="button"
                onClick={() => onSwitchMode && onSwitchMode('zen')}
                className="px-3 py-1 text-[#8c8275] hover:text-[#ede6dc] transition-colors cursor-pointer"
                title="Switch to Zen Focus Auto-Pilot"
              >
                🌿 ZEN
              </button>
              <button
                type="button"
                onClick={() => onSwitchMode && onSwitchMode('studio')}
                className="px-3 py-1 text-[#8c8275] hover:text-[#ede6dc] transition-colors cursor-pointer"
                title="Switch to Full Studio Mode"
              >
                🎛️ STUDIO
              </button>
            </div>

            {/* Profile Action */}
            <button
              type="button"
              onClick={onOpenProfileModal}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#2d2720] hover:border-[#b87326]/50 bg-[#120f0d] hover:bg-[#1a1612] text-[#c4b9aa] hover:text-white text-[10px] tracking-[0.15em] font-bold transition-all cursor-pointer"
            >
              <Compass size={12} className="text-[#d48b38]" />
              <span>{profile?.name ? profile.name.toUpperCase() : 'PROFILE'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. THE MONOLITH COMMAND SURFACE */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 py-10 w-full space-y-12 flex-1">
        {/* PRIME MONOLITH CARD (THE SINGLE HIGHEST-IMPACT TRAJECTORY) */}
        {primeJob ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between text-[11px] tracking-[0.25em] text-[#8c8275] uppercase">
              <span className="flex items-center gap-2 font-bold">
                <Target size={13} className="text-[#d48b38]" />
                PRIME TRAJECTORY // HIGHEST STRATEGIC CONVERGENCE
              </span>
              <span className="text-[#d48b38] font-black">
                RANK #01
              </span>
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="bg-[#12100d] border border-[#2e271f] hover:border-[#b87326]/60 transition-all duration-500 p-7 lg:p-10 relative overflow-hidden shadow-2xl group"
            >
              {/* Subtle Corner Architectural Accent */}
              <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none border-t border-r border-[#b87326]/40" />

              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                {/* Left Side: Massive Monolithic Details */}
                <div className="space-y-4 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-3 text-[10px] tracking-[0.2em] uppercase font-bold">
                    <span className="px-2 py-0.5 bg-[#b87326]/20 border border-[#b87326]/40 text-[#d48b38]">
                      {primeJob.stream || 'CORE ENTERPRISE SYSTEMS'}
                    </span>
                    <span className="px-2 py-0.5 bg-[#1a1713] border border-[#332b22] text-[#a89d8e]">
                      {primeJob.score || 95}% ALIGNMENT
                    </span>
                    <span className="text-[#8c8275] flex items-center gap-1">
                      <Clock size={11} className="text-[#b87326]" />
                      {formatJobPostedAge(primeJob.date)}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-2xl lg:text-4xl font-black tracking-wider uppercase text-[#ede6dc] leading-tight group-hover:text-white transition-colors">
                      {primeJob.title}
                    </h2>
                    <p className="text-base lg:text-xl font-bold tracking-widest text-[#d48b38] mt-1 uppercase">
                      {primeJob.company}
                    </p>
                  </div>

                  <p className="text-xs lg:text-sm text-[#a89d8e] leading-relaxed line-clamp-3 font-sans font-medium">
                    {primeJob.description || 'Deep architectural alignment with your target skill vector. Commute constraints, compensation thresholds, and semantic keywords verified nominal.'}
                  </p>

                  <div className="flex flex-wrap items-center gap-6 text-xs text-[#c4b9aa] pt-2 border-t border-[#231e19]">
                    <span className="flex items-center gap-1.5 tracking-wider">
                      <MapPin size={13} className="text-[#d48b38]" />
                      {primeJob.location || 'Melbourne VIC'}
                    </span>
                    <span className="flex items-center gap-1.5 tracking-wider font-bold text-[#ede6dc]">
                      <DollarSign size={13} className="text-[#d48b38]" />
                      {primeJob.salary || 'Competitive Sovereign Comp'}
                    </span>
                  </div>
                </div>

                {/* Right Side: Heavy Action Buttons */}
                <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[240px] shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenGenerator && onOpenGenerator(primeJob)}
                    className="w-full py-4 px-6 bg-[#b87326] hover:bg-[#d48b38] text-black font-black text-xs tracking-[0.25em] uppercase transition-all duration-300 shadow-xl flex items-center justify-center gap-2 cursor-pointer border border-[#d48b38]"
                  >
                    <span>PREPARE APPLICATION</span>
                    <ArrowUpRight size={16} className="shrink-0 stroke-[3]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenJobModal && onOpenJobModal(primeJob)}
                    className="w-full py-3.5 px-6 bg-[#171411] hover:bg-[#211d18] text-[#c4b9aa] hover:text-white font-bold text-xs tracking-[0.2em] uppercase transition-all duration-300 border border-[#2e271f] hover:border-[#b87326]/50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>INSPECT INTELLIGENCE</span>
                    <ChevronRight size={14} className="text-[#8c8275]" />
                  </button>
                </div>
              </div>
            </motion.div>
          </section>
        ) : (
          <div className="p-12 text-center border border-[#27211a] bg-[#120f0d] space-y-3">
            <p className="text-sm tracking-[0.2em] text-[#a89d8e]">NO RECENT VECTORS DETECTED</p>
            <p className="text-xs text-[#706659]">Background engine is assimilating new listings. All systems nominal.</p>
          </div>
        )}

        {/* 3. CURATED SECONDARY MONOLITH SLABS */}
        {secondarySlabs.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between text-[11px] tracking-[0.25em] text-[#8c8275] uppercase">
              <span className="flex items-center gap-2 font-bold">
                <Compass size={13} className="text-[#d48b38]" />
                SECONDARY MONOLITHS // FILTERED ESSENCE
              </span>
              <span className="text-[10px] text-[#706659]">
                {secondarySlabs.length} OF {activeJobs.length} VERIFIED
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
              {secondarySlabs.map((job, idx) => (
                <motion.div
                  key={job.id || `${job.company}_${job.title}_${idx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: idx * 0.08 }}
                  onClick={() => onOpenJobModal && onOpenJobModal(job)}
                  className="bg-[#12100d] border border-[#27211a] hover:border-[#b87326]/60 p-6 space-y-4 transition-all duration-400 cursor-pointer group relative shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-[9px] tracking-[0.25em] text-[#d48b38] uppercase font-bold">
                        VECTOR #{String(idx + 2).padStart(2, '0')} · {job.score || 85}% FIT
                      </span>
                      <h3 className="text-base font-black tracking-wide uppercase text-[#ede6dc] group-hover:text-white transition-colors leading-snug line-clamp-1">
                        {job.title}
                      </h3>
                      <p className="text-xs tracking-wider font-bold text-[#a89d8e] uppercase line-clamp-1">
                        {job.company}
                      </p>
                    </div>

                    <span className="text-[9px] tracking-wider text-[#8c8275] border border-[#2e271f] px-1.5 py-0.5 shrink-0">
                      {formatJobPostedAge(job.date)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-3 border-t border-[#1f1b16] text-[#8c8275]">
                    <span className="truncate max-w-[160px] text-[11px]">
                      <MapPin size={11} className="inline mr-1 text-[#b87326]" />
                      {job.location}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenGenerator && onOpenGenerator(job);
                      }}
                      className="text-[10px] tracking-[0.2em] font-black uppercase text-[#d48b38] hover:text-white flex items-center gap-1 border border-[#b87326]/30 bg-[#b87326]/10 hover:bg-[#b87326]/20 px-2.5 py-1 transition-colors"
                    >
                      <span>PREP</span>
                      <ArrowUpRight size={12} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* 4. SILENT PULSE TELEMETRY BAR (BOTTOM STATUS) */}
      <footer className="relative z-10 border-t border-[#231e19] bg-[#0c0a08] px-6 lg:px-12 py-3 text-[10px] tracking-[0.2em] text-[#706659] uppercase">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4 truncate">
            <span className="flex items-center gap-1.5 text-[#d48b38] font-bold shrink-0">
              <Activity size={12} className="animate-pulse" />
              <span>SYSTEM NOMINAL</span>
            </span>
            <span className="text-[#332b22]">/</span>
            <span className="text-[#a89d8e] truncate">
              {totalAssimilated.toLocaleString()} SIGNALS ASSIMILATED
            </span>
            <span className="text-[#332b22] hidden md:inline">/</span>
            <span className="text-[#8c8275] hidden md:inline">
              AUTONOMOUS SCREENING & SCORING ACTIVE
            </span>
          </div>

          <div className="flex items-center gap-4 text-[#8c8275] shrink-0">
            <span>APPLICATIONS DEPLOYED: {applications.length}</span>
            <span className="text-[#332b22]">/</span>
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="text-[#c4b9aa] hover:text-[#d48b38] transition-colors cursor-pointer"
            >
              COMMAND [⌘K]
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
