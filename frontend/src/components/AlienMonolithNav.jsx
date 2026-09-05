import React, { useState, useRef, useCallback } from 'react';
import { 
  Target, 
  Zap, 
  Activity, 
  Send, 
  Compass, 
  Sliders, 
  Terminal
} from 'lucide-react';

/**
 * AlienMonolithNav - Simplified, cleverly and artistically animated left-hand menu.
 * Reminiscent of a long-lost ancient alien technology.
 * Generates subtle, satisfying wave ripples through the obsidian stone when moused over.
 */
export default function AlienMonolithNav({
  activeTab = 'prime', // 'prime' | 'autopilot' | 'radar'
  onSelectTab = () => {},
  onOpenBatchApply,
  onOpenProfileModal,
  onOpenCommandPalette,
  onSwitchToStudio,
  readyCount = 0,
  isAutonomousActive = true,
  isScanningRadar = false
}) {
  const [ripples, setRipples] = useState([]);
  const railRef = useRef(null);
  const lastRippleTime = useRef(0);

  // Trigger organic wave ripples on mouseover / pointer move
  const handlePointerMove = useCallback((e) => {
    const now = Date.now();
    // Throttle to create rhythmic, harmonic ripples
    if (now - lastRippleTime.current < 200) return;
    lastRippleTime.current = now;

    if (!railRef.current) return;
    const rect = railRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = `${now}_${Math.random()}`;

    setRipples((prev) => [...prev.slice(-6), { id, x, y }]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 1400);
  }, []);

  const navItems = [
    {
      id: 'prime',
      title: 'Prime Monolith',
      glyph: '◬',
      icon: Target,
      subtitle: 'Highest Strategic Convergence',
      isAction: false
    },
    {
      id: 'autopilot',
      title: 'Autonomous Deck',
      glyph: '◈',
      icon: Zap,
      subtitle: 'Zen Auto-Prepared Queue',
      badge: readyCount > 0 ? readyCount : null,
      isAction: false
    },
    {
      id: 'radar',
      title: 'Alien Radar & Telemetry',
      glyph: '⌬',
      icon: Activity,
      subtitle: 'Ingestion Pulse & Gmail Sync',
      indicator: isScanningRadar ? 'scanning' : isAutonomousActive ? 'active' : null,
      isAction: false
    }
  ];

  return (
    <nav
      ref={railRef}
      onPointerMove={handlePointerMove}
      className="alien-monolith-rail group/rail select-none shrink-0 fixed bottom-0 inset-x-0 h-16 w-full z-40 flex flex-row justify-around items-center px-2 border-t border-[#231e19] bg-[#0d0b09]/95 backdrop-blur-xl md:relative md:w-16 lg:w-20 md:min-h-screen md:z-30 md:flex-col md:justify-between md:py-6 md:px-0 md:border-r md:border-t-0 shadow-2xl transition-all"
      aria-label="Ancient Alien Artifact Navigation"
    >
      {/* Background Interactive Ripples Layer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="alien-ripple-wave"
            style={{
              left: `${ripple.x}px`,
              top: `${ripple.y}px`,
              width: '130px',
              height: '130px',
              marginLeft: '-65px',
              marginTop: '-65px'
            }}
          />
        ))}
      </div>

      {/* Top Runic Brand Apex - Hidden on mobile bottom bar, visible on desktop rail */}
      <div className="hidden md:flex relative z-10 flex-col items-center space-y-4">
        <div 
          className="w-10 h-10 border border-[#b87326]/70 bg-[#16120e] flex items-center justify-center relative cursor-default group shadow-[0_0_15px_rgba(184,115,38,0.25)] hover:border-[#d48b38] transition-all duration-500"
          title="Monolith Core Artifact"
        >
          {/* Subtle spinning internal rune ring */}
          <div className="absolute inset-0 border border-[#b87326]/20 group-hover:rotate-90 transition-transform duration-700 pointer-events-none" />
          <span className="text-[#d48b38] font-black text-sm select-none">▲</span>
        </div>
        
        {/* Ancient Alien Glyphic Energy Channel */}
        <div className="w-[1px] h-8 bg-gradient-to-b from-[#d48b38]/60 via-[#b87326]/20 to-transparent" />
      </div>

      {/* Core Navigation Glyphs: Row on mobile, Column on desktop */}
      <div className="relative z-10 flex flex-row md:flex-col items-center justify-around md:justify-start space-x-1.5 sm:space-x-2 md:space-x-0 md:space-y-5 w-full md:px-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const IconComponent = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`alien-glyph-button w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex flex-col items-center justify-center relative rounded-none transition-all duration-300 cursor-pointer ${
                isActive
                  ? 'bg-[#1e1812] border border-[#d48b38] text-[#d48b38] shadow-[0_0_20px_rgba(212,139,56,0.35)]'
                  : 'bg-[#100e0b] border border-[#262019] text-[#8c8275] hover:text-[#ede6dc] hover:border-[#b87326]/50 hover:bg-[#16130f]'
              }`}
              title={`${item.title} — ${item.subtitle}`}
            >
              {/* Rune Tag */}
              <span className="text-[8px] sm:text-[9px] tracking-widest font-mono text-[#b87326]/70 mb-0.5">
                {item.glyph}
              </span>

              {/* Icon */}
              <IconComponent size={15} className={isActive ? 'text-[#d48b38] scale-110' : 'text-inherit'} />

              {/* Counter Badge if available */}
              {item.badge && (
                <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 min-w-[16px] sm:min-w-[18px] h-[16px] sm:h-[18px] px-1 bg-[#b87326] text-black font-mono font-black text-[8px] sm:text-[9px] flex items-center justify-center border border-[#d48b38]">
                  {item.badge}
                </span>
              )}

              {/* Pulse Indicator if available */}
              {item.indicator && (
                <span className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-[#d48b38] animate-ping" />
              )}

              {/* Active Golden Edge Notch (Top on mobile dock, Left on desktop rail) */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 md:h-full md:w-1 md:right-auto md:bottom-0 bg-[#d48b38] shadow-[0_0_8px_#d48b38]" />
              )}
            </button>
          );
        })}

        {/* Separator Line */}
        <div className="hidden md:block w-6 h-[1px] bg-[#2a241d]" />

        {/* Quick Batch Dispatch Action */}
        {onOpenBatchApply && (
          <button
            type="button"
            onClick={onOpenBatchApply}
            className="alien-glyph-button w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex flex-col items-center justify-center bg-[#130f0b] border border-[#b87326]/40 hover:border-[#d48b38] text-[#d48b38] hover:text-white transition-all cursor-pointer group shadow-xs"
            title="Batch Dispatch Applications"
          >
            <span className="text-[8px] sm:text-[9px] font-mono text-[#b87326]/60 mb-0.5">⬡</span>
            <Send size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        )}

        {/* Profile / Candidate Matrix */}
        {onOpenProfileModal && (
          <button
            type="button"
            onClick={onOpenProfileModal}
            className="alien-glyph-button w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex flex-col items-center justify-center bg-[#100e0b] border border-[#262019] hover:border-[#b87326]/50 text-[#8c8275] hover:text-[#ede6dc] transition-all cursor-pointer"
            title="Candidate Matrix & Strategy Profile"
          >
            <span className="text-[8px] sm:text-[9px] font-mono text-[#8c8275] mb-0.5">⟡</span>
            <Compass size={14} />
          </button>
        )}
      </div>

      {/* Bottom Controls: Studio Gateway & Command */}
      <div className="relative z-10 flex flex-row md:flex-col items-center space-x-1.5 sm:space-x-2 md:space-x-0 md:space-y-3 shrink-0 px-1 md:w-full md:px-2">
        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="hidden sm:flex w-9 h-9 sm:w-10 sm:h-10 border border-[#231e19] hover:border-[#b87326]/60 bg-[#0d0b09] hover:bg-[#15120e] text-[#706659] hover:text-[#d48b38] items-center justify-center transition-all cursor-pointer"
            title="Command Interface (⌘K)"
          >
            <Terminal size={13} />
          </button>
        )}

        {onSwitchToStudio && (
          <button
            type="button"
            onClick={onSwitchToStudio}
            className="w-9 h-9 sm:w-10 sm:h-10 border border-[#2a231b] hover:border-[#d48b38] bg-[#120f0d] text-[#8c8275] hover:text-white flex items-center justify-center transition-all cursor-pointer group"
            title="Full Workbench"
            aria-label="Full Workbench"
          >
            <Sliders size={14} className="group-hover:rotate-90 transition-transform duration-300" />
          </button>
        )}
      </div>
    </nav>
  );
}
