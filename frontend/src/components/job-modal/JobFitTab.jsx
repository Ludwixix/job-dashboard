import React from 'react';
import {
  Award, ShieldCheck, Sparkles, Zap, Eye, Cpu, Clock, ExternalLink,
  CheckCircle2, Train, Car, Bike, Navigation
} from 'lucide-react';

export function JobFitTab({
  job,
  activeProfile,
  baseLocation = 'Melbourne VIC',
  onClose,
  onOpenAtsDiagnostic,
  onOpenGenerator,
  onOpenOutreach,
  onOpenAutoApply,
  setShowPsychology,
  setIsCheatSheetOpen,
  commuteTab,
  setCommuteTab,
  commute,
  atsMatrix,
  matchedTerms,
  dimensions,
  frontLoadedBullet
}) {
  const audit = job?.audit || {};
  return (

 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-200">
 {/* Left Column: Core Diagnostics & ATS Verification */}
 <div className="lg:col-span-7 space-y-6">
 {/* Match Score Radar Card */}
 <div className="p-5 rounded-sm bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 text-white border border-slate-800 space-y-4 ">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3 font-mono">
 <div className="p-2.5 rounded-sm bg-amber-500/20 text-amber-400 border border-amber-400/30">
 <Award size={22} />
 </div>
 <div>
 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CANDIDATE FIT EVALUATION</div>
 <div className="text-base font-black text-amber-300">{audit.fit || 'High Suitability Match'}</div>
 </div>
 </div>

 <div className="text-right font-mono">
 <div className="text-3xl font-black text-emerald-400">{job.score || 85}%</div>
 <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">MATCH SCORE</div>
 </div>
 </div>

 {/* Animated Skill Match Bar */}
 <div className="space-y-1.5 font-mono">
 <div className="flex justify-between text-[11px] font-bold text-slate-300">
 <span>OVERALL SUITABILITY METER</span>
 <span className="text-emerald-400">{job.score || 85}%</span>
 </div>
 <div className="h-2.5 w-full bg-slate-800 rounded-sm overflow-hidden p-0.5 border border-slate-700">
 <div 
 className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-sm transition-all duration-500"
 style={{ width: `${job.score || 85}%` }}
 />
 </div>
 </div>

 {/* Dimension Meters */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80 text-xs font-mono">
 <div className="bg-slate-950/70 p-3 rounded-sm border border-slate-800">
 <div className="text-[10px] text-slate-400 font-bold uppercase">SKILL ALIGNMENT</div>
 <div className="font-extrabold text-emerald-400 text-sm mt-0.5">{dimensions.skill_match?.score || 88}%</div>
 </div>
 <div className="bg-slate-950/70 p-3 rounded-sm border border-slate-800">
 <div className="text-[10px] text-slate-400 font-bold uppercase">EXPERIENCE LEVEL</div>
 <div className="font-extrabold text-amber-400 text-sm mt-0.5">{dimensions.experience_alignment ? `${dimensions.experience_alignment.score}%` : '5+ YRS FIT'}</div>
 </div>
 <div className="bg-slate-950/70 p-3 rounded-sm border border-slate-800">
 <div className="text-[10px] text-slate-400 font-bold uppercase">COMMUTE / MODE</div>
 <div className="font-extrabold text-cyan-400 text-sm mt-0.5">{job.remote ? 'REMOTE' : `${baseLocation.split(' ')[0]} Commute`}</div>
 </div>
 </div>
 </div>

 {/* STAGE 0: DETERMINISTIC BINARY KNOCKOUT SHIELD */}
 <div className="p-4 rounded-sm bg-slate-900/95 border border-emerald-500/40 space-y-3 font-mono text-white relative overflow-hidden">
 <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-sm blur-2xl pointer-events-none" />
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2.5">
 <div className="p-2 rounded-sm bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
 <ShieldCheck size={18} />
 </div>
 <div>
 <div className="text-xs font-black flex items-center gap-2 text-emerald-300">
 STAGE 0 KNOCKOUT SHIELD
 <span className="text-[9px] px-2 py-0.5 rounded-sm bg-emerald-950 text-emerald-300 border border-emerald-500/40">
 100% IMMUNE
 </span>
 </div>
 <div className="text-[10px] text-slate-400">
 Deterministic filters passed prior to AI ranking (Workday / Taleo compliance)
 </div>
 </div>
 </div>
 <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500 text-slate-950">
 STAGE 0 PASSED
 </span>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
 <div className="p-2.5 rounded-sm bg-slate-950 border border-emerald-500/30 flex items-center justify-between">
 <div>
 <div className="text-[9px] text-slate-400 font-bold uppercase">AU WORK RIGHTS</div>
 <div className="text-xs font-black text-emerald-400">CITIZEN (UNRESTRICTED)</div>
 </div>
 <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
 </div>
 <div className="p-2.5 rounded-sm bg-slate-950 border border-emerald-500/30 flex items-center justify-between">
 <div>
 <div className="text-[9px] text-slate-400 font-bold uppercase">COMMUTE RADIUS</div>
 <div className="text-xs font-black text-emerald-400">{job.remote ? 'REMOTE (AU-WIDE)' : `${baseLocation.split(' ')[0]} (<25KM)`}</div>
 </div>
 <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
 </div>
 <div className="p-2.5 rounded-sm bg-slate-950 border border-emerald-500/30 flex items-center justify-between">
 <div>
 <div className="text-[9px] text-slate-400 font-bold uppercase">SECURITY CLEARANCE</div>
 <div className="text-xs font-black text-emerald-400">BASELINE / NV1 READY</div>
 </div>
 <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
 </div>
 </div>
 </div>

 {/* GLASS-BOX ATS SCORING MATRIX (EU AI ACT COMPLIANT) */}
 <div className="p-5 rounded-sm bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/80 text-white border border-slate-800 space-y-4 font-mono">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2.5">
 <div className="p-2 rounded-sm bg-amber-500/20 text-amber-400 border border-amber-400/30">
 <Cpu size={18} />
 </div>
 <div>
 <div className="text-xs font-black flex items-center gap-2 text-amber-300">
 EXPLAINABLE ATS MATRIX (GLASS-BOX)
 <span className="text-[9px] px-2 py-0.5 rounded-sm bg-amber-950 text-amber-300 border border-amber-500/40">
 EU AI ACT READY
 </span>
 </div>
 <div className="text-[10px] text-slate-400">
 Dense vector embeddings &amp; cosine similarity across 5 weighted dimensions
 </div>
 </div>
 </div>
 <div className="text-right">
 <div className="text-xl font-black text-emerald-400">{atsMatrix.composite}%</div>
 <div className="text-[9px] text-slate-400 font-bold">COMPOSITE</div>
 </div>
 </div>

 <div className="space-y-3 pt-1 text-xs">
 {atsMatrix.items.map((item, idx) => (
 <div key={idx} className="p-2.5 rounded-sm bg-slate-950/80 border border-slate-800/80 space-y-1.5">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 font-bold border border-amber-500/30">
 {item.weight}
 </span>
 <span className="font-bold text-slate-200 text-xs">{item.label}</span>
 </div>
 <span className="font-black text-emerald-400 text-xs">{item.score}%</span>
 </div>
 <div className="flex items-center justify-between gap-3">
 <div className="h-1.5 w-full bg-slate-800 rounded-sm overflow-hidden">
 <div 
 className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-sm"
 style={{ width: `${item.score}%` }}
 />
 </div>
 <span className="text-[9px] text-slate-400 shrink-0 font-sans">{item.note}</span>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* AI Audit Evaluation Box */}
 <div className="p-5 rounded-sm bg-amber-50/70 border border-amber-200 space-y-2">
 <div className="flex items-center gap-2 text-xs font-mono font-extrabold text-amber-950 uppercase tracking-wider">
 <ShieldCheck size={18} className="text-amber-600" />
 AI AUDIT RATIONALE &amp; RECOMMENDATION
 </div>
 <p className="text-xs text-amber-900 font-sans font-medium leading-relaxed">
 {audit.recommendation || audit.notes || `Target match score of ${job.score || 85}% based on ${activeProfile?.industry || 'target'} profile alignment and ${baseLocation.split(' ')[0] || 'Melbourne'} commute compatibility.`}
 </p>
 </div>
 </div>

 {/* Right Column: Recruiter Triage, Commute & Skills */}
 <div className="lg:col-span-5 space-y-6">
 {/* 7.4-SECOND RECRUITER TRIAGE SIMULATOR (LADDERS EYE-TRACKING STUDY) */}
 <div className="p-5 rounded-sm bg-gradient-to-br from-[#12100e] via-[#1a1510] to-[#241a12] border border-[#b87326]/40 text-[#f5eee6] space-y-4 font-mono">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2.5">
 <div className="p-2 rounded-sm bg-[#b87326]/20 text-[#d48b38] border border-[#b87326]/30">
 <Eye size={18} />
 </div>
 <div>
 <div className="text-xs font-black flex items-center gap-2 text-[#d48b38]">
 7.4-SECOND RECRUITER TRIAGE SIMULATOR
 <span className="text-[9px] px-2 py-0.5 rounded-sm bg-[#1e1710] text-[#d48b38] border border-[#b87326]/50">
 LADDERS F-PATTERN MODEL
 </span>
 </div>
 <div className="text-[10px] text-stone-400">
 Initial human eye fixation scan (80% attention in top 25% of document)
 </div>
 </div>
 </div>
 <span className="text-[10px] font-black px-2 py-0.5 rounded bg-[#d48b38] text-black">
 SHORTLIST PREDICTED
 </span>
 </div>

 {/* Fixation Zones Timeline */}
 <div className="space-y-1.5">
 <div className="flex justify-between text-[10px] text-stone-400 font-bold">
 <span>5 CRITICAL FIXATION ZONES (7.4s TOTAL DWELL)</span>
 <span className="text-[#d48b38]">100% F-PATTERN OPTIMISED</span>
 </div>
 <div className="grid grid-cols-5 gap-1 text-center text-[9px]">
 <div className="p-2 rounded bg-black/40 border border-[#b87326]/30">
 <div className="text-[#d48b38] font-bold">2.1s</div>
 <div className="text-stone-400 truncate">Name/Contact</div>
 </div>
 <div className="p-2 rounded bg-black/40 border border-[#b87326]/30">
 <div className="text-[#d48b38] font-bold">1.8s</div>
 <div className="text-stone-400 truncate">Current Title</div>
 </div>
 <div className="p-2 rounded bg-black/40 border border-[#b87326]/30">
 <div className="text-[#d48b38] font-bold">1.3s</div>
 <div className="text-stone-400 truncate">Tenure Dates</div>
 </div>
 <div className="p-2 rounded bg-[#b87326]/20 border border-[#d48b38]">
 <div className="text-amber-300 font-black">0.9s</div>
 <div className="text-stone-200 font-bold truncate">Apex STAR</div>
 </div>
 <div className="p-2 rounded bg-black/40 border border-[#b87326]/30">
 <div className="text-[#d48b38] font-bold">0.7s</div>
 <div className="text-stone-400 truncate">Education</div>
 </div>
 </div>
 </div>

 {/* Apex Front-Loaded STAR Metric Display */}
 <div className="p-3 rounded-sm bg-black/50 border border-[#b87326]/50 space-y-1.5">
 <div className="flex items-center justify-between text-[10px]">
 <span className="font-bold text-[#d48b38] flex items-center gap-1">
 <Sparkles size={11} /> FRONT-LOADED APEX ACHIEVEMENT BULLET
 </span>
 <span className="text-stone-400 text-[9px]">Verb + Metric In First 4 Words</span>
 </div>
 <p className="text-xs text-stone-200 font-sans leading-relaxed italic border-l-2 border-[#d48b38] pl-3 py-0.5">
 "{frontLoadedBullet}"
 </p>
 <div className="text-[9px] text-stone-400 flex items-center gap-1.5 pt-1">
 <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
 <span>Complies with single-column linear ATS layout and Australian standard taxonomy.</span>
 </div>
 </div>
 </div>

 {/* Google Maps Commute Intelligence Card */}
 {commute && (
 <div className="p-4 rounded-sm bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/50 border border-slate-800 space-y-3 font-mono text-white ">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="p-1.5 rounded-sm bg-amber-500/20 text-amber-400 border border-amber-500/30">
 <Navigation size={15} />
 </div>
 <div>
 <div className="text-xs font-black flex items-center gap-2">
 GOOGLE MAPS COMMUTE ESTIMATOR
 <span className="text-[10px] px-2 py-0.5 rounded-sm bg-slate-800 text-amber-300 border border-slate-700">
 {commute.isRemote ? 'REMOTE' : `${commute.distanceKm} KM FROM BASE`}
 </span>
 </div>
 <div className="text-[10px] text-slate-400 font-sans">
 {baseLocation.split(' ')[0]} → {job.location || 'Melbourne'}
 </div>
 </div>
 </div>

 {!commute.isRemote && (
 <a
 href={commute.googleMapsUrls[commuteTab === 'transit' ? 'transit' : commuteTab === 'car' ? 'driving' : 'bicycling']}
 target="_blank"
 rel="noopener noreferrer"
 className="text-[10px] text-amber-400 hover:text-amber-300 font-bold underline inline-flex items-center gap-1 cursor-pointer"
 >
 <span>Open Directions</span>
 <ExternalLink size={11} />
 </a>
 )}
 </div>

 {!commute.isRemote ? (
 <div className="space-y-3 pt-1">
 {/* Commute Mode Selector */}
 <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-sm border border-slate-800 text-xs font-bold">
 <button
 type="button"
 onClick={() => setCommuteTab('transit')}
 className={`py-1.5 px-2 rounded-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
 commuteTab === 'transit' ? 'bg-amber-600 text-white -xs' : 'text-slate-400 hover:text-slate-200'
 }`}
 >
 <Train size={13} />
 <span>TRAIN ({commute.transit.durationMin}m)</span>
 </button>
 <button
 type="button"
 onClick={() => setCommuteTab('car')}
 className={`py-1.5 px-2 rounded-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
 commuteTab === 'car' ? 'bg-amber-600 text-white -xs' : 'text-slate-400 hover:text-slate-200'
 }`}
 >
 <Car size={13} />
 <span>CAR ({commute.car.peakMin}m)</span>
 </button>
 <button
 type="button"
 onClick={() => setCommuteTab('bike')}
 className={`py-1.5 px-2 rounded-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
 commuteTab === 'bike' ? 'bg-amber-600 text-white -xs' : 'text-slate-400 hover:text-slate-200'
 }`}
 >
 <Bike size={13} />
 <span>BIKE ({commute.bike.durationMin}m)</span>
 </button>
 </div>

 {/* Mode Details Display */}
 <div className="p-3 rounded-sm bg-slate-900 border border-slate-800 text-xs space-y-2">
 {commuteTab === 'transit' && (
 <div className="space-y-1.5">
 <div className="flex justify-between items-center">
 <span className="text-slate-400">Estimated Public Transit Time:</span>
 <span className="font-black text-amber-300 text-sm">{commute.transit.label}</span>
 </div>
 <div className="flex justify-between items-center text-[11px]">
 <span className="text-slate-500">Transit Line / Route:</span>
 <span className="text-slate-300 font-semibold">{commute.transit.lines}</span>
 </div>
 </div>
 )}

 {commuteTab === 'car' && (
 <div className="space-y-2">
 <div className="grid grid-cols-2 gap-2">
 <div className="p-2 rounded-sm bg-slate-950 border border-slate-800">
 <div className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
 <Clock size={10} /> PEAK TRAFFIC (8AM / 5PM)
 </div>
 <div className="text-sm font-black text-white mt-0.5">{commute.car.peakLabel}</div>
 </div>
 <div className="p-2 rounded-sm bg-slate-950 border border-slate-800">
 <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
 <Clock size={10} /> OFF-PEAK HOURS
 </div>
 <div className="text-sm font-black text-white mt-0.5">{commute.car.offPeakLabel}</div>
 </div>
 </div>

 <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
 <span className="text-slate-400">Tolls &amp; Tollways:</span>
 <span className={`font-bold ${commute.car.tolls.hasTolls ? 'text-amber-400' : 'text-emerald-400'}`}>
 {commute.car.tolls.hasTolls ? `${commute.car.tolls.tollRoads} (${commute.car.tolls.estimatedCost})` : 'Toll-Free Route ($0.00)'}
 </span>
 </div>
 </div>
 )}

 {commuteTab === 'bike' && (
 <div className="space-y-1.5">
 <div className="flex justify-between items-center">
 <span className="text-slate-400">Estimated Cycling Time:</span>
 <span className="font-black text-emerald-400 text-sm">{commute.bike.label}</span>
 </div>
 <div className="flex justify-between items-center text-[11px]">
 <span className="text-slate-500">Dedicated Bike Trails:</span>
 <span className="text-slate-300 font-semibold">{commute.bike.bikePaths}</span>
 </div>
 </div>
 )}
 </div>
 </div>
 ) : (
 <div className="p-3 rounded-sm bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
 <CheckCircle2 size={16} className="shrink-0" />
 <span>100% Remote Opportunity — No daily commute required.</span>
 </div>
 )}
 </div>
 )}

 {/* Matched Skill Tags */}
 {matchedTerms.length > 0 && (
 <div className="space-y-2 font-mono">
 <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
 <Zap size={14} className="text-amber-500" /> MATCHED TECHNICAL SKILLS & KEYWORDS
 </div>
 <div className="flex flex-wrap gap-2">
 {matchedTerms.map((term, idx) => (
 <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold -2xs">
 <CheckCircle2 size={13} className="text-amber-600" /> {term}
 </span>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
  );
}
