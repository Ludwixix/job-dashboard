import React from 'react';

export const Tabs = ({
  tabs = [],
  activeTab,
  onChange,
  className = '',
  tabClassName = '',
  activeColor = 'indigo' // 'indigo', 'teal', 'cyan', 'amber', 'emerald'
}) => {
  const activeColorMap = {
    indigo: 'border-indigo-500 text-indigo-300 bg-indigo-500/10',
    teal: 'border-teal-400 text-teal-300 bg-teal-500/10',
    cyan: 'border-cyan-400 text-cyan-300 bg-cyan-500/10',
    amber: 'border-amber-400 text-amber-300 bg-amber-500/10',
    emerald: 'border-emerald-400 text-emerald-300 bg-emerald-500/10'
  };

  const activeIndicator = activeColorMap[activeColor] || activeColorMap.indigo;

  return (
    <div className={`flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800 scrollbar-none font-mono text-xs ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-t-lg font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap border-b-2 select-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              isActive
                ? `${activeIndicator}`
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            } ${tabClassName}`}
          >
            {Icon && <Icon size={14} className="shrink-0" />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

