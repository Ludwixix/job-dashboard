import React from 'react';
import {
  Sparkles, Sliders, CheckCircle2, RefreshCw, Zap, ArrowRight
} from 'lucide-react';
import { PROVIDERS } from '../../services/llmConfig';

export function StepReviewLaunch({
  readinessAnalysis,
  readinessScore,
  profileData,
  aiEngineMode,
  llmProvider,
  llmModel,
  setStep,
  isLaunching,
  launchMessage,
  handleFinalSubmit
}) {
  return (
<div className="space-y-6">
 <div className="text-center space-y-2">
 <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
 <CheckCircle2 size={14} /> STEP 6 OF 6 // BESPOKE BLUEPRINT READY
 </div>
 <h1 className="text-2xl sm:text-3xl font-black text-white">
 Your Bespoke Candidate Matrix is Configured!
 </h1>
 <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto">
 Every job match score, commute radius, and auto-generated application is now calibrated specifically to your career goals.
 </p>
 </div>

 {/* Bespoke Blueprint Summary Card */}
 <div className="p-6 rounded-sm bg-slate-950 border-2 border-amber-500/50 space-y-5 font-mono text-xs industry-glow-">
 <div className="flex items-center justify-between flex-wrap gap-3">
 <div className="flex items-center gap-3">
 <div className="w-14 h-14 rounded-sm bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-black text-xl flex items-center justify-center border border-amber-400/40">
 {profileData.name?.[0] || 'C'}
 </div>
 <div>
 <div className="text-lg font-black text-white">{profileData.name || 'Candidate'}</div>
 <div className="text-xs text-amber-400 font-bold">{profileData.title || profileData.targetTitles[0]}</div>
 <div className="text-[10px] text-slate-400">{profileData.email}</div>
 </div>
 </div>
 <div className="text-right">
 <span className="px-3.5 py-1.5 rounded-sm bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold text-xs inline-flex items-center gap-1.5 -xs">
 <Sparkles size={13} className="text-amber-400" />
 {readinessScore}% BESPOKE FIT
 </span>
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-slate-800 text-[11px] text-slate-300">
 <div className="p-2.5 rounded-sm bg-slate-900/80 border border-slate-800">
 <div className="text-[9px] text-slate-500 uppercase font-bold">AI ENGINE</div>
 <div className="font-bold truncate mt-0.5">
 {aiEngineMode === 'builtin' ? (
 <span className="text-emerald-400 font-bold flex items-center gap-1">
 <Sparkles size={11} className="inline shrink-0" /> Built-In (Claude 3.7)
 </span>
 ) : (
 <span className="text-amber-400">{PROVIDERS[llmProvider]?.name || 'Configured'} ({llmModel.split('/').pop()})</span>
 )}
 </div>
 </div>
 <div className="p-2.5 rounded-sm bg-slate-900/80 border border-slate-800">
 <div className="text-[9px] text-slate-500 uppercase font-bold">INDUSTRY</div>
 <div className="font-bold text-white truncate mt-0.5">{profileData.industry}</div>
 </div>
 <div className="p-2.5 rounded-sm bg-slate-900/80 border border-slate-800">
 <div className="text-[9px] text-slate-500 uppercase font-bold">COMMUTE BASE</div>
 <div className="font-bold text-white truncate mt-0.5">{profileData.location}</div>
 </div>
 <div className="p-2.5 rounded-sm bg-slate-900/80 border border-slate-800">
 <div className="text-[9px] text-slate-500 uppercase font-bold">WORK STYLE</div>
 <div className="font-bold text-white truncate mt-0.5">{profileData.workMode}</div>
 </div>
 <div className="p-2.5 rounded-sm bg-slate-900/80 border border-slate-800">
 <div className="text-[9px] text-slate-500 uppercase font-bold">TARGET PAY</div>
 <div className="font-bold text-white truncate mt-0.5">{profileData.targetSalary}</div>
 </div>
 </div>

 {/* Target Titles & Skills */}
 <div className="space-y-3 pt-2">
 <div>
 <div className="text-[10px] text-slate-400 uppercase font-bold mb-1.5">ACTIVE SEARCH QUERIES:</div>
 <div className="flex flex-wrap gap-1.5">
 {profileData.targetTitles.map(t => (
 <span key={t} className="px-2.5 py-1 rounded-sm bg-amber-950/90 text-amber-200 border border-amber-500/40 text-[11px] font-bold">
 🎯 {t}
 </span>
 ))}
 </div>
 </div>

 <div>
 <div className="text-[10px] text-slate-400 uppercase font-bold mb-1.5">TOP MATCHED SKILLS ({profileData.coreSkills.length}):</div>
 <div className="flex flex-wrap gap-1.5">
 {profileData.coreSkills.slice(0, 10).map(s => (
 <span key={s} className="px-2.5 py-0.5 rounded-sm bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
 {s}
 </span>
 ))}
 </div>
 </div>
 </div>
 </div>

      {/* Profile Completeness & Optimization Hub */}
      <div className="p-5 rounded-sm bg-slate-900/90 border border-slate-800 space-y-4 font-mono">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div>
            <div className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Sliders size={14} className="text-amber-400" />
              PROFILE COMPLETENESS & CALIBRATION SCORE
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Quantified match quality based on ATS keywords, commute preferences, and AI engine status.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded text-xs font-black border ${
              readinessScore === 100 
                ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50' 
                : readinessScore >= 75
                ? 'bg-indigo-950 text-indigo-300 border-indigo-500/50'
                : 'bg-amber-950 text-amber-300 border-amber-500/50'
            }`}>
              {readinessScore}% COMPLETE
            </span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-slate-950 rounded-full h-3 p-0.5 border border-slate-800 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                readinessScore === 100
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500'
                  : readinessScore >= 75
                  ? 'bg-gradient-to-r from-indigo-500 to-emerald-400'
                  : 'bg-gradient-to-r from-amber-500 to-indigo-500'
              }`}
              style={{ width: `${readinessScore}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0% (Bare Minimum)</span>
            <span>75% (Strong Match Power)</span>
            <span>100% (Maximum Optimization)</span>
          </div>
        </div>

        {/* What more can be done to reach 100% */}
        {readinessAnalysis.improvements.length > 0 ? (
          <div className="space-y-3 pt-2">
            <div className="text-amber-300 font-bold flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-400" /> WHAT MORE CAN BE DONE TO REACH 100%:
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                +{100 - readinessScore}% Potential Boost Available
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {readinessAnalysis.improvements.map((item) => (
                <div 
                  key={item.id}
                  className="p-3 rounded-sm bg-slate-950/90 border border-amber-500/30 hover:border-amber-500/60 transition-colors flex flex-col justify-between gap-2.5"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/30">
                        {item.category}
                      </span>
                      <span className="text-[10px] font-black text-emerald-400">
                        +{item.points}%
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white leading-snug">
                      {item.title}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setStep(item.stepTarget)}
                    className="w-full py-1.5 px-2.5 rounded-sm bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer group"
                  >
                    <span>{item.actionLabel}</span>
                    <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-sm bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold">Full 100% Candidate Profile Power Reached!</span> All ATS keywords, commute preferences, and AI engine calibrations are fully optimized.
            </div>
          </div>
        )}
      </div>

      {/* Launch & Back Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={handleFinalSubmit}
          disabled={isLaunching}
          className="w-full py-4 px-6 rounded-sm bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-mono font-black text-sm transition-all cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-75 shadow-lg shadow-emerald-950/50"
        >
          {isLaunching ? (
            <RefreshCw size={18} className="animate-spin text-white" />
          ) : (
            <Zap size={20} className="animate-bounce text-amber-300" />
          )}
          <span>{isLaunching ? (launchMessage || 'CALIBRATING PROFILE & SCRAPERS...') : `⚡ LAUNCH BESPOKE MATRIX (${readinessScore}% READY)`}</span>
        </button>

        <p className="text-center font-mono text-[11px] text-slate-400">
          Any skipped steps or settings can be updated anytime in Settings after launch.
        </p>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setStep(5)}
            disabled={isLaunching}
            className="text-slate-400 hover:text-white font-mono text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
          >
            ← Back to edit preferences
          </button>
        </div>
      </div>
 </div>
  );
}
