import React, { useState, useRef, useEffect } from 'react';
import { User, ChevronDown, Plus, Edit2, Check, Sparkles, MapPin, Briefcase } from 'lucide-react';
import { getAllProfiles, setActiveProfileId } from '../services/profileService';

export const ProfileSwitcher = ({ activeProfile, onProfileChange, onOpenProfileModal }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const profiles = getAllProfiles();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectProfile = (profile) => {
    setActiveProfileId(profile.id);
    if (onProfileChange) {
      onProfileChange(profile);
    }
    setIsOpen(false);
  };

  const getInitials = (name = '') => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U';
  };

  return (
    <div className="relative font-mono" ref={dropdownRef}>
      {/* Active Profile Pill Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-500/80 transition-all cursor-pointer shadow-sm group"
        title="Switch Candidate Profile or Personalize with your Resume"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white font-black text-xs flex items-center justify-center shadow-xs">
          {getInitials(activeProfile?.name)}
        </div>
        
        <div className="text-left hidden sm:block">
          <div className="text-[11px] font-black text-white group-hover:text-indigo-300 transition-colors flex items-center gap-1 leading-tight">
            <span>{activeProfile?.name || 'Select Profile'}</span>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              ACTIVE
            </span>
          </div>
          <div className="text-[9px] text-slate-400 font-semibold truncate max-w-[140px] leading-tight">
            {activeProfile?.suburb || 'Balaclava'} • {activeProfile?.title?.split('&')?.[0] || 'Engineer'}
          </div>
        </div>

        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-indigo-400' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl z-50 p-2 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150 text-xs">
          <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <User size={12} className="text-indigo-400" />
              <span>CANDIDATE PROFILES</span>
            </div>
            <span className="text-[10px] text-indigo-400 font-bold">{profiles.length} available</span>
          </div>

          {/* Profile List */}
          <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {profiles.map(p => {
              const isSelected = p.id === activeProfile?.id;
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectProfile(p)}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between group ${
                    isSelected
                      ? 'bg-indigo-950/80 border border-indigo-500/60 text-white shadow-xs'
                      : 'hover:bg-slate-800/80 text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                      isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {getInitials(p.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-white truncate text-[11px] flex items-center gap-1">
                        <span>{p.name}</span>
                        {isSelected && <Check size={12} className="text-emerald-400 shrink-0" />}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {p.title}
                      </div>
                      <div className="text-[9px] text-indigo-300 flex items-center gap-1">
                        <MapPin size={9} /> {p.suburb || p.location}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-slate-800 space-y-1">
            <button
              onClick={() => {
                setIsOpen(false);
                if (onOpenProfileModal) onOpenProfileModal(activeProfile);
              }}
              className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit2 size={12} className="text-indigo-400" />
              <span>Edit Active Profile Details</span>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                if (onOpenProfileModal) onOpenProfileModal(null); // new profile
              }}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-[11px] flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Plus size={13} className="text-amber-300" />
              <span>+ Add Profile / Upload Resume</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
