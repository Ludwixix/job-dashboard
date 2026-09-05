import React, { useState } from 'react';
import { Lock, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

const SITE_PASSCODE = 'Scamper123';
export const STORAGE_KEY_SITE_UNLOCKED = 'career_agent_site_unlocked';

export function isSiteUnlocked() {
  try {
    return localStorage.getItem(STORAGE_KEY_SITE_UNLOCKED) === 'true';
  } catch {
    return false;
  }
}

export function setSiteUnlocked(unlocked = true) {
  try {
    if (unlocked) {
      localStorage.setItem(STORAGE_KEY_SITE_UNLOCKED, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY_SITE_UNLOCKED);
    }
  } catch (e) {
    console.warn('Could not persist site unlock state:', e);
  }
}

export default function SiteGate({ onUnlock = () => {} }) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const input = passcode.trim();
    if (!input) {
      setError('Please enter the site access passcode.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      if (input === SITE_PASSCODE) {
        setSiteUnlocked(true);
        // Ensure standard authenticated session exists
        const sessionUser = {
          id: 'user_sam_ludwig',
          name: 'Sam Ludwig',
          email: 'sam.ludwig@gmail.com',
          authProvider: 'passcode',
          onboardingCompleted: true,
          site_unlocked: true,
          lastActiveAt: new Date().toISOString()
        };
        localStorage.setItem('job_dashboard_current_user_session', JSON.stringify(sessionUser));
        onUnlock(sessionUser);
      } else {
        setError('Incorrect passcode. Access denied.');
        setIsLoading(false);
      }
    }, 300);
  };

  return (
    <div className="min-h-screen bg-[#070605] text-[#ede6dc] font-mono selection:bg-[#c67d34] selection:text-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div 
        className="pointer-events-none fixed inset-0 opacity-[0.04] bg-[radial-gradient(#d4a373_1px,transparent_1px)] [background-size:24px_24px]" 
        aria-hidden="true" 
      />
      <div 
        className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-b from-[#c67d34]/[0.08] via-transparent to-transparent blur-3xl"
        aria-hidden="true" 
      />

      <div className="w-full max-w-md relative z-10 space-y-6 animate-in fade-in zoom-in-95 duration-300">
        {/* Top Monolith Brand Apex */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 border border-[#b87326]/70 bg-[#16120e] flex items-center justify-center shadow-[0_0_20px_rgba(184,115,38,0.3)]">
            <span className="text-[#d48b38] font-black text-lg select-none">▲</span>
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-[0.3em] uppercase text-[#ede6dc]">
              CAREER.AGENT // ACCESS GATE
            </h1>
            <p className="text-[11px] tracking-[0.2em] text-[#8c8275] uppercase mt-1">
              AUTONOMOUS JOB DISCOVERY &amp; APPLICATION DISPATCHER
            </p>
          </div>
        </div>

        {/* Security Access Terminal Card */}
        <div className="bg-[#12100d] border border-[#2e271f] p-6 sm:p-8 space-y-6 shadow-2xl relative">
          <div className="flex items-center justify-between border-b border-[#262019] pb-3 text-xs">
            <span className="flex items-center gap-2 text-[#d48b38] font-bold tracking-wider uppercase text-[10px]">
              <Lock size={13} />
              SYSTEM PROTECTED
            </span>
            <span className="text-[10px] text-[#706659] tracking-widest uppercase">
              ENCRYPTED SESSION
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label 
                htmlFor="site-passcode-input"
                className="text-[11px] font-bold text-[#a89d8e] tracking-widest uppercase block"
              >
                ENTER SITE PASSCODE
              </label>
              <div className="relative">
                <input
                  id="site-passcode-input"
                  type="password"
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    if (error) setError('');
                  }}
                  autoFocus
                  placeholder="••••••••••••"
                  className="w-full bg-[#090807] border border-[#332b22] focus:border-[#d48b38] text-white px-4 py-3.5 text-sm tracking-widest rounded-none focus:outline-none transition-colors font-mono"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs tracking-wider flex items-center gap-2 font-mono">
                <AlertCircle size={14} className="shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !passcode.trim()}
              className="w-full py-3.5 px-6 bg-[#b87326] hover:bg-[#d48b38] disabled:opacity-50 text-black font-black text-xs tracking-[0.25em] uppercase transition-all duration-300 shadow-xl flex items-center justify-center gap-2 cursor-pointer border border-[#d48b38]"
            >
              <span>{isLoading ? 'AUTHENTICATING...' : 'ACCESS DASHBOARD'}</span>
              <ArrowRight size={14} className="stroke-[3]" />
            </button>
          </form>

          <div className="pt-2 border-t border-[#231e19] flex items-center justify-between text-[10px] text-[#706659] tracking-widest uppercase">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-[#b87326]" />
              SESSION PERSISTENT
            </span>
            <span>BUILD V2.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
