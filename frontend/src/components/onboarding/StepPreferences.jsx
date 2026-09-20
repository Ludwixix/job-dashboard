import React from 'react';
import {
  Sliders, Sparkles, MapPin, DollarSign, Award, ShieldCheck,
  ArrowRight, ArrowLeft, ChevronRight
} from 'lucide-react';

export function StepPreferences({
  profileData,
  setProfileData,
  PRESET_SUBURBS,
  WORK_MODE_OPTIONS,
  WORK_RIGHTS_OPTIONS,
  CLEARANCE_OPTIONS,
  setStep
}) {
  return (
<div className="space-y-6 font-mono text-xs">
 <div className="text-center space-y-2">
 <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono font-black industry-accent-badge">
 <MapPin size={14} /> STEP 5 OF 6 // LOCATION, WORK STYLE & COMPENSATION
 </div>
 <h1 className="text-2xl sm:text-3xl font-black text-white">
 Location & Work Style Preferences
 </h1>
 <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto">
 Configure your commute baseline and target pay to ensure roles meet your practical day-to-day requirements.
 </p>
 </div>

 {/* Work Mode Selection */}
 <div className="space-y-2">
 <label className="text-slate-300 font-bold flex items-center gap-1.5">
 <Sliders size={13} className="text-amber-400" /> PREFERRED WORK MODE:
 </label>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 {WORK_MODE_OPTIONS.map(mode => (
 <button
 key={mode.id}
 type="button"
 onClick={() => setProfileData({ ...profileData, workMode: mode.id })}
 className={`p-3 rounded-sm border text-left transition-all cursor-pointer ${
 profileData.workMode === mode.id
 ? 'bg-amber-950/80 border-amber-500 text-white '
 : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
 }`}
 >
 <div className="font-bold text-xs">{mode.label}</div>
 <div className="text-[10px] text-slate-400 mt-0.5">{mode.desc}</div>
 </button>
 ))}
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
 {/* Location & Suburb */}
 <div className="space-y-1.5">
 <label className="text-emerald-400 font-bold flex items-center gap-1.5">
 <MapPin size={13} /> PRIMARY SUBURB / COMMUTE BASE
 </label>
 <input
 type="text"
 value={profileData.location}
 onChange={(e) => {
 const loc = e.target.value;
 const sub = loc.split(',')[0].replace(/(VIC|NSW|QLD|WA|SA|TAS|ACT|NT|\d+)/gi, '').trim();
 setProfileData({ ...profileData, location: loc, suburb: sub || 'Melbourne' });
 }}
 placeholder="e.g. Balaclava VIC 3183"
 className="w-full p-3 rounded-sm bg-slate-950 border border-emerald-500/40 text-emerald-300 font-bold focus:border-emerald-400 focus:outline-none"
 />
 </div>

 {/* Salary Target */}
 <div className="space-y-1.5">
 <label className="text-emerald-400 font-bold flex items-center gap-1.5">
 <DollarSign size={13} /> TARGET COMPENSATION / SALARY
 </label>
 <input
 type="text"
 value={profileData.targetSalary}
 onChange={(e) => setProfileData({ ...profileData, targetSalary: e.target.value })}
 placeholder="e.g. $125,000 + Super"
 className="w-full p-3 rounded-sm bg-slate-950 border border-emerald-500/40 text-emerald-300 font-bold focus:border-emerald-400 focus:outline-none"
 />
 </div>
 </div>

 {/* Quick Suburb Presets */}
 <div className="space-y-2">
 <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
 QUICK BASELINE PRESETS:
 </div>
 <div className="flex flex-wrap gap-1.5">
 {PRESET_SUBURBS.map(sub => (
 <button
 key={sub}
 type="button"
 onClick={() => {
 const cleanSub = sub.split(' ')[0];
 setProfileData(prev => ({ ...prev, location: sub, suburb: cleanSub }));
 }}
 className={`px-2.5 py-1 rounded-sm text-[11px] font-bold border transition-colors cursor-pointer ${
 profileData.location === sub
 ? 'bg-emerald-600 text-white border-emerald-400'
 : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white'
 }`}
 >
 {sub.split(' ')[0]}
 </button>
 ))}
 </div>
 </div>

 {/* Work Rights & Security Clearance */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
 <div className="space-y-1.5">
 <label className="text-slate-300 font-bold flex items-center gap-1.5">
 <ShieldCheck size={13} className="text-amber-400" /> WORK RIGHTS / CITIZENSHIP
 </label>
 <select
 value={profileData.workRights}
 onChange={(e) => setProfileData({ ...profileData, workRights: e.target.value })}
 className="w-full p-3 rounded-sm bg-slate-950 border border-slate-800 text-slate-200 focus:border-amber-500 focus:outline-none"
 >
 {WORK_RIGHTS_OPTIONS.map(opt => (
 <option key={opt} value={opt}>{opt}</option>
 ))}
 </select>
 </div>

 <div className="space-y-1.5">
 <label className="text-slate-300 font-bold flex items-center gap-1.5">
 <Award size={13} className="text-amber-400" /> SECURITY CLEARANCE / CHECKS
 </label>
 <select
 value={profileData.clearance}
 onChange={(e) => setProfileData({ ...profileData, clearance: e.target.value })}
 className="w-full p-3 rounded-sm bg-slate-950 border border-slate-800 text-slate-200 focus:border-amber-500 focus:outline-none"
 >
 {CLEARANCE_OPTIONS.map(opt => (
 <option key={opt} value={opt}>{opt}</option>
 ))}
 </select>
 </div>
 </div>

 {/* Hand-Holding Coach Guidance Box */}
 <div className="p-3.5 rounded-sm bg-amber-950/40 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200 font-mono">
 <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
 <div className="space-y-1">
 <div className="font-bold text-white text-[11px] uppercase tracking-wide">
 💡 Why This Matters: Commute Distance & Lifestyle Boundaries
 </div>
 <p className="text-[11px] text-slate-300 leading-relaxed">
 Our platform computes door-to-door transit times and distance from your home base. Establishing your commute baseline and target pay ensures our Auto-Pilot filters out unsustainable commutes and roles that don't meet your salary floor.
 </p>
 </div>
 </div>

 <div className="space-y-2 pt-4 border-t border-slate-800 font-mono text-xs">
 <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
 <button
 type="button"
 onClick={() => setStep(4)}
 className="px-4 py-2.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
 >
 <ArrowLeft size={14} /> Back
 </button>
 <div className="flex items-center gap-2 flex-wrap justify-end">
 <button
 type="button"
 onClick={() => setStep(6)}
 className="px-4 py-2.5 rounded-sm bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
 >
 Skip this step <ChevronRight size={14} />
 </button>
 <button
 type="button"
 onClick={() => setStep(6)}
 className="px-6 py-2.5 rounded-sm bg-amber-600 hover:bg-amber-500 text-white font-black transition-colors cursor-pointer flex items-center justify-center gap-1.5"
 >
 Review Bespoke Blueprint <ArrowRight size={14} />
 </button>
 </div>
 </div>
 <div className="pt-1 text-[10px] text-slate-500">
 <span>💡 Default commute location ({profileData.location}) will be used.</span>
 </div>
 </div>
 </div>
  );
}
