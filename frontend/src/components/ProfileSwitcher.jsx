import React, { useState, useRef, useEffect } from 'react';
import { User, ChevronDown, Edit2, Sparkles, MapPin, Briefcase, Mail, Phone, ShieldCheck, DollarSign, Award, RefreshCw, Settings } from 'lucide-react';
import { getActiveProfile } from '../services/profileService';

export const ProfileSwitcher = ({ activeProfile, onProfileChange, onOpenProfileModal, onOpenSettings }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const profile = activeProfile || getActiveProfile();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name = '') => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SL';
  };

  return (
    <div className="relative font-mono" ref={dropdownRef}>
      {/* Active Profile Pill Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-500/80 transition-all cursor-pointer shadow-sm group"
        title="Your Logged-in Candidate Profile & Settings"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white font-black text-xs flex items-center justify-center shadow-xs">
          {getInitials(profile?.name)}
        </div>
        
        <div className="text-left hidden sm:block">
          <div className="text-[11px] font-black text-white group-hover:text-indigo-300 transition-colors flex items-center gap-1.5 leading-tight">
            <span>{profile?.name || 'Sam Ludwig'}</span>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              LOGGED IN
            </span>
          </div>
          <div className="text-[9px] text-slate-400 font-semibold truncate max-w-[150px] leading-tight">
            {profile?.suburb || 'Balaclava'} • {profile?.title?.split('&')?.[0] || 'Senior Systems Specialist'}
          </div>
        </div>

        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-indigo-400' : ''}`} />
      </button>

      {/* User Account & Profile Modal Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-84 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl z-50 p-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150 text-xs">
          {/* Header Strip */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <User size={12} className="text-indigo-400" />
              <span>AUTHENTICATED CANDIDATE</span>
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              100% PERSISTED
            </span>
          </div>

          {/* User Dossier Summary Card */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-md">
                {getInitials(profile?.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-white text-sm leading-tight truncate">
                  {profile?.name}
                </div>
                <div className="text-[11px] text-indigo-300 font-semibold truncate leading-tight mt-0.5">
                  {profile?.title}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                  <MapPin size={10} className="text-slate-500" />
                  <span>{profile?.location || 'Balaclava VIC 3183'}</span>
                </div>
              </div>
            </div>

            {/* Target Remuneration & Seniority */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900 text-[10px] font-mono">
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-500 uppercase block text-[8px] font-bold">TARGET SALARY</span>
                <span className="text-emerald-400 font-bold truncate block">{profile?.targetSalary || '$140k - $165k'}</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-500 uppercase block text-[8px] font-bold">SENIORITY LEVEL</span>
                <span className="text-purple-300 font-bold truncate block">{profile?.seniorityLevel || 'Senior / Lead'}</span>
              </div>
            </div>
          </div>

          {/* Core Superpowers / Strengths */}
          {Array.isArray(profile?.keyStrengths) && profile.keyStrengths.length > 0 && (
            <div className="space-y-1 font-mono text-[10px]">
              <div className="text-slate-500 uppercase font-black tracking-wider text-[9px] flex items-center gap-1">
                <Sparkles size={10} className="text-amber-400" /> ACTIVE SUPERPOWERS
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-slate-300">
                {profile.keyStrengths.slice(0, 2).map((str, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 leading-tight">
                    <span className="text-indigo-400 shrink-0">•</span>
                    <span className="truncate">{str}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 border-t border-slate-800 space-y-1.5">
            <button
              onClick={() => {
                setIsOpen(false);
                if (onOpenProfileModal) onOpenProfileModal(profile);
              }}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Edit2 size={13} className="text-amber-300" />
              <span>Edit Profile & Update Resume</span>
            </button>

            {onOpenSettings && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenSettings();
                }}
                className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700/70 transition-all cursor-pointer"
              >
                <Settings size={13} className="text-indigo-400" />
                <span>Settings & LLM Configuration</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
