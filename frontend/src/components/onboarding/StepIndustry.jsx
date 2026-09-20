import React from 'react';
import {
  Building2, Sparkles, Award, ArrowRight, ArrowLeft, ChevronRight, Check
} from 'lucide-react';
import { getIndustryTheme } from '../../services/industryThemeService';

export function StepIndustry({
  profileData,
  setProfileData,
  handleSelectIndustry,
  INDUSTRY_OPTIONS,
  SENIORITY_OPTIONS,
  setStep
}) {
  return (
<div className="space-y-6">
 <div className="text-center space-y-2">
 <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono font-black bg-amber-500/20 text-amber-300 border border-amber-400/30">
 <Building2 size={14} /> STEP 3 OF 6 // TARGET SECTOR & INDUSTRY
 </div>
 <h1 className="text-2xl sm:text-3xl font-black text-white">
 What Industry Do You Specialize In?
 </h1>
 <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto">
 Selecting your industry primes our scraping engine and shifts your entire workspace color scheme to match your domain.
 </p>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
 {INDUSTRY_OPTIONS.map((ind) => {
 const Icon = ind.icon;
 const isSelected = profileData.industry === ind.id;
 const indTheme = getIndustryTheme(ind.id);

 return (
 <button
 key={ind.id}
 onClick={() => handleSelectIndustry(ind)}
 className={`p-4 rounded-sm border text-left transition-all flex flex-col justify-between gap-3 cursor-pointer group ${
 isSelected 
 ? 'bg-slate-900 border-2 ' 
 : 'bg-slate-950/80 hover:bg-slate-800/80 border-slate-800 text-slate-300 hover:border-slate-700'
 }`}
 style={{
 borderColor: isSelected ? indTheme.accent : undefined,
 boxShadow: isSelected ? `0 0 20px ${indTheme.glow}` : undefined
 }}
 >
 <div className="flex items-center justify-between">
 <div 
 className="p-2.5 rounded-sm transition-colors"
 style={{
 backgroundColor: isSelected ? indTheme.badgeBg : 'rgba(15, 23, 42, 0.8)',
 color: indTheme.light
 }}
 >
 <Icon size={20} />
 </div>
 {isSelected && <Check size={18} style={{ color: indTheme.light }} />}
 </div>
 <div>
 <div className={`font-black text-sm ${isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
 {ind.name}
 </div>
 <div className="text-[10px] text-slate-400 mt-1 truncate">
 {ind.defaultTitles.slice(0, 2).join(', ')}
 </div>
 </div>
 </button>
 );
 })}
 </div>

 {/* Seniority Level Calibration */}
 <div className="space-y-2.5 pt-4 border-t border-slate-800 font-mono text-xs">
 <div className="flex items-center justify-between">
 <label className="text-slate-300 font-bold flex items-center gap-1.5">
 <Award size={14} className="text-amber-400" /> CAREER SENIORITY STAGE:
 </label>
 <span className="text-[10px] text-amber-400 font-bold">
 Active: {SENIORITY_OPTIONS.find(s => s.id === profileData.seniorityLevel)?.label || 'Senior'}
 </span>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-2">
 {SENIORITY_OPTIONS.map((sen) => {
 const isSelected = profileData.seniorityLevel === sen.id;
 return (
 <button
 key={sen.id}
 type="button"
 onClick={() => setProfileData(prev => ({ ...prev, seniorityLevel: sen.id }))}
 className={`p-2.5 rounded-sm border text-left transition-all cursor-pointer flex flex-col justify-between ${
 isSelected
 ? 'bg-amber-950/90 border-amber-400 text-white '
 : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
 }`}
 >
 <div className="font-black text-xs">{sen.label}</div>
 <div className="text-[10px] text-slate-400 mt-0.5">{sen.exp}</div>
 </button>
 );
 })}
 </div>
 </div>

 {/* Hand-Holding Coach Guidance Box */}
 <div className="p-3.5 rounded-sm bg-amber-950/40 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200 font-mono">
 <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
 <div className="space-y-1">
 <div className="font-bold text-white text-[11px] uppercase tracking-wide">
 💡 Why This Matters: Targeted Query Calibration
 </div>
 <p className="text-[11px] text-slate-300 leading-relaxed">
 Selecting your industry and seniority primes our search engines (Seek, LinkedIn, Adzuna) to crawl roles matching your exact career tier. This eliminates entry-level noise and guarantees every job in your feed matches your compensation expectations.
 </p>
 </div>
 </div>

 <div className="space-y-2 pt-4 border-t border-slate-800 font-mono text-xs">
 <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
 <button
 type="button"
 onClick={() => setStep(1)}
 className="px-4 py-2.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
 >
 <ArrowLeft size={14} /> Back
 </button>
 <div className="flex items-center gap-2 flex-wrap justify-end">
 <button
 type="button"
 onClick={() => setStep(4)}
 className="px-4 py-2.5 rounded-sm bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
 >
 Skip this step <ChevronRight size={14} />
 </button>
 <button
 type="button"
 onClick={() => setStep(4)}
 className="px-6 py-2.5 rounded-sm bg-amber-600 hover:bg-amber-500 text-white font-black transition-colors cursor-pointer flex items-center justify-center gap-1.5"
 >
 Continue to Roles & Skills <ArrowRight size={14} />
 </button>
 </div>
 </div>
 <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
 <span>💡 Default industry ({profileData.industry}) will be applied.</span>
 <button
 type="button"
 onClick={() => setStep(6)}
 className="text-slate-400 hover:text-amber-400 font-bold transition-colors cursor-pointer underline"
 >
 Skip directly to Review & Launch (Step 6) →
 </button>
 </div>
 </div>
 </div>
  );
}
