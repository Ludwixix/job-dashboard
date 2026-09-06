import React from 'react';
import { 
  Target, 
  Zap, 
  Activity, 
  Send, 
  Compass, 
  Sliders, 
  Terminal,
  Settings,
  Sparkles,
  Layers,
  Award
} from 'lucide-react';

/**
 * AutopilotNav - Clean Modern Obsidian SaaS Navigation Rail.
 * Linear/Vercel-inspired high-contrast interface dock.
 */
export default function AlienMonolithNav({
  activeTab = 'prime', // 'prime' | 'autopilot' | 'radar'
  onSelectTab = () => {},
  onOpenBatchApply,
  onOpenProfileModal,
  onOpenCommandPalette,
  onOpenSettings,
  onSwitchToStudio,
  onOpenWorkforceAustralia,
  showWorkforceAustralia = false,

  readyCount = 0,
  isAutonomousActive = true,
  isScanningRadar = false
}) {
  const navItems = [
    {
      id: 'prime',
      title: 'Prime Focus',
      icon: Target,
      subtitle: 'Highest Strategic Convergence'
    },
    {
      id: 'autopilot',
      title: 'Autonomous Queue',
      icon: Zap,
      subtitle: 'Prepared Application Queue',
      badge: readyCount > 0 ? readyCount : null
    },
    {
      id: 'radar',
      title: 'Live Telemetry',
      icon: Activity,
      subtitle: 'Ingestion Pulse & Gmail Sync',
      indicator: isScanningRadar ? 'scanning' : isAutonomousActive ? 'active' : null
    }
  ];

  return (
    <nav
      className="obsidian-saas-rail select-none shrink-0 fixed bottom-0 inset-x-0 h-16 w-full z-40 flex flex-row justify-around items-center px-2 border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-xl md:relative md:w-16 lg:w-20 md:min-h-screen md:z-30 md:flex-col md:justify-between md:py-6 md:px-0 md:border-r md:border-t-0 shadow-2xl transition-all"
      aria-label="Application Navigation Rail"
    >
      {/* Top Brand Apex - Visible on desktop */}
      <div className="hidden md:flex relative z-10 flex-col items-center space-y-4">
        <div 
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center relative cursor-pointer shadow-md shadow-indigo-600/30 hover:scale-105 transition-transform"
          title="CAREER.AGENT // Autopilot Core"
          onClick={() => onSelectTab('prime')}
        >
          <Layers size={18} className="text-white" />
        </div>
        
        {/* Subtle Vertical Hairline Divider */}
        <div className="w-[1px] h-6 bg-gradient-to-b from-indigo-500/40 to-transparent" />
      </div>

      {/* Core Navigation Items */}
      <div className="relative z-10 flex flex-row md:flex-col items-center justify-around md:justify-start space-x-2 md:space-x-0 md:space-y-4 w-full md:px-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const IconComponent = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 flex flex-col items-center justify-center relative rounded-xl transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-1 ring-indigo-400/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-800/60'
              }`}
              title={`${item.title} — ${item.subtitle}`}
            >
              <IconComponent size={17} className={isActive ? 'scale-105' : 'text-inherit'} />

              {/* Counter Badge */}
              {item.badge && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-emerald-500 text-slate-950 font-mono font-black text-[10px] rounded-full flex items-center justify-center border border-slate-950 shadow-xs">
                  {item.badge}
                </span>
              )}

              {/* Pulse Indicator */}
              {item.indicator && (
                <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              )}
            </button>
          );
        })}

        {/* Separator Line */}
        <div className="hidden md:block w-6 h-[1px] bg-slate-800 my-1" />
        {/* Workforce Australia PBAS Hub (when enabled in Settings) */}
        {showWorkforceAustralia && onOpenWorkforceAustralia && (
          <button
            type="button"
            onClick={onOpenWorkforceAustralia}
            className="w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 flex items-center justify-center rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-500/60 transition-all cursor-pointer shadow-xs"
            title="Workforce Australia PBAS Evidence Hub"
            aria-label="Workforce Australia PBAS Evidence Hub"
          >
            <Award size={16} />
          </button>
        )}


        {/* Quick Batch Dispatch Action */}
        {onOpenBatchApply && (
          <button
            type="button"
            onClick={onOpenBatchApply}
            className="w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 flex items-center justify-center rounded-xl bg-slate-900/80 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/60 transition-all cursor-pointer shadow-xs"
            title="Batch Dispatch Applications"
          >
            <Send size={15} />
          </button>
        )}

        {/* Switch to Kanban / Studio Mode */}
        {onSwitchToStudio && (
          <button
            type="button"
            onClick={onSwitchToStudio}
            className="w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 flex items-center justify-center rounded-xl bg-slate-900/80 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/60 transition-all cursor-pointer shadow-xs"
            title="Full Workbench"
            aria-label="Full Workbench"
          >
            <Sliders size={15} />
          </button>
        )}
      </div>

      {/* Bottom Auxiliary Controls (Desktop only) */}
      <div className="hidden md:flex relative z-10 flex-col items-center space-y-3">
        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent hover:border-slate-700/60 transition-all cursor-pointer"
            title="Command Palette (⌘K)"
          >
            <Terminal size={16} />
          </button>
        )}

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent hover:border-slate-700/60 transition-all cursor-pointer"
            title="System & AI Model Settings"
          >
            <Settings size={16} />
          </button>
        )}

        {/* User Avatar Chip */}
        {onOpenProfileModal && (
          <button
            type="button"
            onClick={onOpenProfileModal}
            className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:border-indigo-500/50 transition-all cursor-pointer font-mono font-bold text-xs shadow-xs"
            title="Candidate Profile & Target Tracks"
          >
            SL
          </button>
        )}
      </div>
    </nav>
  );
}
