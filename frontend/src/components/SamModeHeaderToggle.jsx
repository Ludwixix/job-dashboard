import React, { useState, useEffect } from 'react';
import { Crown, Sparkles, CheckCircle2 } from 'lucide-react';

/**
 * SamModeHeaderToggle
 * Persistent glassmorphic header capsule toggle that switches between standard search
 * and the hyper-personalized "Sam Mode" Personal Career Cockpit.
 *
 * @param {Object} props
 * @param {boolean} props.isActive - Whether Sam Mode is currently active.
 * @param {Function} props.onToggle - Callback invoked when the toggle state changes.
 * @param {string} [props.className] - Optional container classes.
 * @returns {React.ReactElement}
 */
export const SamModeHeaderToggle = ({ isActive, onToggle, className = '' }) => {
  const [active, setActive] = useState(() => {
    if (typeof isActive === 'boolean') return isActive;
    return localStorage.getItem('sam_mode_active') === 'true';
  });

  useEffect(() => {
    if (typeof isActive === 'boolean') {
      setActive(isActive);
    }
  }, [isActive]);

  const handleToggle = () => {
    const next = !active;
    setActive(next);
    localStorage.setItem('sam_mode_active', next ? 'true' : 'false');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sam-mode-toggled', { detail: { active: next } }));
    }
    if (onToggle) {
      onToggle(next);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      role="switch"
      aria-checked={active}
      aria-label="Toggle Sam Mode Personal Career Cockpit"
      title={active ? 'Sam Mode Active: Personalized to 10-Yr Enterprise Career' : 'Switch to Sam Mode Career Cockpit'}
      className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 cursor-pointer min-h-[44px] touch-target-44 select-none ${
        active
          ? 'bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.25)] text-white'
          : 'bg-slate-900/60 border-slate-700/80 hover:border-slate-600 text-slate-400 hover:text-slate-200'
      } ${className}`}
    >
      {/* Ambient Pulsing Aura when Active */}
      {active && (
        <span className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-500/30 to-amber-500/20 blur-xs -z-10 animate-pulse" />
      )}

      {/* Icon Badge */}
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
          active
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
            : 'bg-slate-800 text-slate-500 border border-slate-700'
        }`}
      >
        <Crown size={13} className={active ? 'text-amber-400' : 'text-slate-400'} />
      </div>

      {/* Text Labels */}
      <div className="flex flex-col text-left leading-none">
        <span className="text-[11px] font-black tracking-wide flex items-center gap-1">
          <span className={active ? 'text-amber-300' : 'text-slate-300'}>SAM MODE</span>
          {active && <Sparkles size={10} className="text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />}
        </span>
        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mt-0.5">
          {active ? 'Cockpit Active' : 'Off'}
        </span>
      </div>

      {/* Switch Indicator */}
      <div
        className={`w-8 h-4 rounded-full p-0.5 transition-colors relative flex items-center ml-1 ${
          active ? 'bg-amber-500' : 'bg-slate-800 border border-slate-700'
        }`}
      >
        <div
          className={`w-3 h-3 rounded-full bg-slate-950 shadow-xs transition-transform transform ${
            active ? 'translate-x-4 bg-white' : 'translate-x-0'
          }`}
        />
      </div>
    </button>
  );
};
