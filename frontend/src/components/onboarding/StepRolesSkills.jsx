import React from 'react';
import {
  Target, Sparkles, Briefcase, Tag, RefreshCw, Upload, CheckCircle2,
  ArrowRight, ArrowLeft, ChevronRight
} from 'lucide-react';

export function StepRolesSkills({
  profileData,
  currentIndustryObj,
  readinessAnalysis,
  setProfileData,
  newTitleInput,
  setNewTitleInput,
  newSkillInput,
  setNewSkillInput,
  handleFileUpload,
  handleParseResumeText,
  handleAddTitle,
  handleRemoveTitle,
  handleAddSkill,
  handleRemoveSkill,
  resumeText,
  setResumeText,
  isParsing,
  parseSuccessMsg,
  setStep
}) {
  return (
<div className="space-y-6">
 <div className="text-center space-y-2">
 <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono font-black industry-accent-badge">
 <Target size={14} /> STEP 4 OF 6 // TARGET ROLES & CORE SKILLS
 </div>
 <h1 className="text-2xl sm:text-3xl font-black text-white">
 Target Roles & Technical Skills
 </h1>
 <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto">
 Provide your target titles and domain tools. Upload your resume for 1-click automatic extraction.
 </p>
 </div>

 {/* Upload Dropzone */}
 <div className="border-2 border-dashed border-slate-700 hover:border-amber-400 rounded-sm p-5 text-center transition-all bg-slate-950/40 font-mono">
 <input
 type="file"
 id="onboard-resume-input"
 accept=".txt,.md,.rtf,.pdf"
 onChange={handleFileUpload}
 className="hidden"
 />
 <label
 htmlFor="onboard-resume-input"
 className="cursor-pointer flex flex-col items-center justify-center space-y-2"
 >
 <div className="p-3 bg-amber-600/20 text-amber-400 rounded-sm border border-amber-400/30">
 <Upload size={22} />
 </div>
 <div className="text-xs font-bold text-white">
 1-Click Auto-Fill: Drop Resume (.pdf, .txt, .md) or <span className="text-amber-400 underline">Browse</span>
 </div>
 <div className="text-[10px] text-slate-500">
 Automatically fills your titles, skills, and quantified career achievements
 </div>
 </label>
 </div>

 {parseSuccessMsg && (
 <div className="p-3 rounded-sm bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-mono flex items-center gap-2">
 <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
 <span>{parseSuccessMsg}</span>
 </div>
 )}

 {/* Target Job Titles Selector */}
 <div className="space-y-2 font-mono text-xs">
 <div className="flex items-center justify-between">
 <label className="text-slate-300 font-bold flex items-center gap-1.5">
 <Briefcase size={13} className="text-amber-400" /> TARGET JOB TITLES ({profileData.targetTitles.length}):
 </label>
 <span className="text-[10px] text-slate-500">Click to remove</span>
 </div>

 <div className="flex flex-wrap gap-1.5 p-3 rounded-sm bg-slate-950 border border-slate-800 min-h-[46px]">
 {profileData.targetTitles.map(t => (
 <span
 key={t}
 className="px-2.5 py-1 rounded-sm bg-amber-950 text-amber-200 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1.5 -xs"
 >
 {t}
 <button type="button" onClick={() => handleRemoveTitle(t)} className="hover:text-rose-400 cursor-pointer font-black">×</button>
 </span>
 ))}
 <div className="flex items-center gap-1">
 <input
 type="text"
 value={newTitleInput}
 onChange={(e) => setNewTitleInput(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTitle())}
 placeholder="+ Add custom title..."
 className="bg-transparent border-none text-[11px] text-slate-300 focus:outline-none px-2 py-0.5"
 />
 {newTitleInput && (
 <button type="button" onClick={() => handleAddTitle()} className="text-emerald-400 font-bold text-xs cursor-pointer">+</button>
 )}
 </div>
 </div>

 {/* Quick Industry Suggestions */}
 <div className="flex items-center gap-1.5 flex-wrap pt-1">
 <span className="text-[10px] text-slate-500 uppercase font-bold">SUGGESTED FOR {profileData.industry}:</span>
 {currentIndustryObj.defaultTitles.filter(t => !profileData.targetTitles.includes(t)).slice(0, 4).map(t => (
 <button
 key={t}
 type="button"
 onClick={() => handleAddTitle(t)}
 className="px-2 py-0.5 rounded-sm bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-slate-300 hover:text-white transition-colors cursor-pointer font-bold"
 >
 + {t}
 </button>
 ))}
 </div>
 </div>

 {/* Core Skills Selector */}
 <div className="space-y-2 font-mono text-xs">
 <div className="flex items-center justify-between">
 <label className="text-slate-300 font-bold flex items-center gap-1.5">
 <Tag size={13} className="text-emerald-400" /> CORE SKILLS & DOMAIN TOOLS ({profileData.coreSkills.length}):
 </label>
 <span className="text-[10px] text-slate-500">Essential for ATS score match</span>
 </div>

 <div className="flex flex-wrap gap-1.5 p-3 rounded-sm bg-slate-950 border border-slate-800 min-h-[46px]">
 {profileData.coreSkills.map(skill => (
 <span
 key={skill}
 className="px-2.5 py-1 rounded-sm bg-emerald-950/80 text-emerald-200 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1.5 -xs"
 >
 {skill}
 <button type="button" onClick={() => handleRemoveSkill(skill)} className="hover:text-rose-400 cursor-pointer font-black">×</button>
 </span>
 ))}
 <div className="flex items-center gap-1">
 <input
 type="text"
 value={newSkillInput}
 onChange={(e) => setNewSkillInput(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
 placeholder="+ Add skill..."
 className="bg-transparent border-none text-[11px] text-slate-300 focus:outline-none px-2 py-0.5"
 />
 {newSkillInput && (
 <button type="button" onClick={() => handleAddSkill()} className="text-emerald-400 font-bold text-xs cursor-pointer">+</button>
 )}
 </div>
 </div>

 {/* Quick Industry Skill Suggestions */}
 <div className="flex items-center gap-1.5 flex-wrap pt-1">
 <span className="text-[10px] text-slate-500 uppercase font-bold">DOMAIN SKILLS:</span>
 {currentIndustryObj.defaultSkills.filter(s => !profileData.coreSkills.includes(s)).slice(0, 5).map(s => (
 <button
 key={s}
 type="button"
 onClick={() => handleAddSkill(s)}
 className="px-2 py-0.5 rounded-sm bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-emerald-400 hover:text-white transition-colors cursor-pointer font-bold"
 >
 + {s}
 </button>
 ))}
 </div>
 </div>

 {/* ATS Keyword Strength Bar */}
 <div className="p-3.5 rounded-sm bg-slate-950 border border-slate-800 space-y-2 font-mono text-xs">
 <div className="flex items-center justify-between text-[11px]">
 <span className="text-slate-400 font-bold flex items-center gap-1.5">
 <Target size={13} className="text-amber-400" /> ATS KEYWORD DENSITY:
 </span>
 <span className={`font-black uppercase text-xs ${
 readinessAnalysis.atsDensity === 'Optimal' ? 'text-emerald-400' :
 readinessAnalysis.atsDensity === 'Good' ? 'text-amber-400' : 'text-rose-400'
 }`}>
 {readinessAnalysis.atsDensity} ({profileData.coreSkills.length} SKILLS)
 </span>
 </div>
 <div className="w-full h-1.5 bg-slate-900 rounded-sm overflow-hidden">
 <div
 className={`h-full transition-all duration-300 ${
 readinessAnalysis.atsDensity === 'Optimal' ? 'bg-emerald-500' :
 readinessAnalysis.atsDensity === 'Good' ? 'bg-amber-500' : 'bg-rose-500'
 }`}
 style={{ width: `${Math.min(100, (profileData.coreSkills.length / 8) * 100)}%` }}
 />
 </div>
 <div className="text-[10px] text-slate-400">
 {readinessAnalysis.atsDensity === 'Optimal'
 ? '✨ Optimal! High semantic coverage across modern ATS candidate screeners.'
 : readinessAnalysis.atsDensity === 'Good'
 ? '⚡ Good foundation. Add 2+ specialized tools or cloud certifications to unlock 90%+ match tiers.'
 : '⚠️ Warning: Add at least 4 core skills so the auto-scoring engine can match job descriptions.'}
 </div>
 </div>

 {/* Hand-Holding Coach Guidance Box */}
 <div className="p-3.5 rounded-sm bg-amber-950/40 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200 font-mono">
 <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
 <div className="space-y-1">
 <div className="font-bold text-white text-[11px] uppercase tracking-wide">
 💡 Why This Matters: ATS Screening & Recommendation Engine
 </div>
 <p className="text-[11px] text-slate-300 leading-relaxed">
 98% of tier-1 recruiters filter applicants using strict keyword matching algorithms. Our local scoring engine cross-references these tags against live job postings to surface roles where you are statistically in the top 10% of applicants.
 </p>
 </div>
 </div>

 {/* Paste Text Fallback */}
 <div className="space-y-1.5 font-mono text-xs pt-2 border-t border-slate-800">
 <div className="flex items-center justify-between text-slate-400">
 <span>OR PASTE WORK HISTORY / RESUME TEXT:</span>
 {resumeText && (
 <button
 type="button"
 onClick={() => handleParseResumeText()}
 disabled={isParsing}
 className="text-amber-400 hover:text-amber-300 font-black cursor-pointer flex items-center gap-1 text-[11px]"
 >
 {isParsing ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
 <span>RE-ANALYZE WITH AI</span>
 </button>
 )}
 </div>
 <textarea
 rows={3}
 value={resumeText}
 onChange={(e) => setResumeText(e.target.value)}
 placeholder="Paste work experience, past positions, metrics (e.g. 99.9% uptime, 40% time savings)..."
 className="w-full p-3 rounded-sm bg-slate-950 border border-slate-800 text-slate-200 font-sans text-xs focus:border-amber-500 focus:outline-none"
 />
 </div>

 <div className="space-y-2 pt-4 border-t border-slate-800 font-mono text-xs">
 <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
 <button
 type="button"
 onClick={() => setStep(3)}
 className="px-4 py-2.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
 >
 <ArrowLeft size={14} /> Back
 </button>
 <div className="flex items-center gap-2 flex-wrap justify-end">
 <button
 type="button"
 onClick={() => setStep(5)}
 className="px-4 py-2.5 rounded-sm bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
 >
 Skip this step <ChevronRight size={14} />
 </button>
 <button
 type="button"
 onClick={() => {
 if (newTitleInput && newTitleInput.trim()) handleAddTitle();
 if (newSkillInput && newSkillInput.trim()) handleAddSkill();
 setStep(5);
 }}
 className="px-6 py-2.5 rounded-sm bg-amber-600 hover:bg-amber-500 text-white font-black transition-colors cursor-pointer flex items-center justify-center gap-1.5"
 >
 Continue to Location & Preferences <ArrowRight size={14} />
 </button>
 </div>
 </div>
 <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
 <span>💡 You can upload a resume and tune skills anytime later in your Profile settings.</span>
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
