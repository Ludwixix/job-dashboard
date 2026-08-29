import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, Briefcase, ArrowRight, Sliders } from 'lucide-react';

export const CommandPalette = ({ isOpen, onClose, jobs = [], onSelectJob, onNavigateView }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Filter commands & jobs
  const cleanQ = query.toLowerCase().trim();

  const staticActions = [
    { id: 'view_stream', label: 'View: Live Stream & All Jobs', icon: <Briefcase size={14} className="text-indigo-400" />, action: () => onNavigateView('stream') },
    { id: 'view_kanban', label: 'View: Application Pipeline (Kanban)', icon: <Sliders size={14} className="text-emerald-400" />, action: () => onNavigateView('kanban') },
    { id: 'view_market', label: 'View: Market Intelligence & Skill Gap Analysis', icon: <Sparkles size={14} className="text-amber-400" />, action: () => onNavigateView('market') },
  ];

  const matchedActions = staticActions.filter(a => a.label.toLowerCase().includes(cleanQ));
  const matchedJobs = cleanQ
    ? jobs.filter(j => 
        j.company.toLowerCase().includes(cleanQ) || 
        j.title.toLowerCase().includes(cleanQ) ||
        (j.location && j.location.toLowerCase().includes(cleanQ))
      ).slice(0, 8)
    : jobs.slice(0, 5);

  const totalItems = [...matchedActions, ...matchedJobs];

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, totalItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + totalItems.length) % Math.max(1, totalItems.length));
    } else if (e.key === 'Enter' && totalItems[selectedIndex]) {
      e.preventDefault();
      const item = totalItems[selectedIndex];
      if (item.action) {
        item.action();
      } else {
        onSelectJob(item);
      }
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-start justify-center pt-20 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[75vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-950">
          <Search size={18} className="text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent text-white text-sm focus:outline-none placeholder-slate-500 font-medium"
            placeholder="Type a command, job title, company, or tech keyword... (e.g. 'Azure', 'Kanban', 'Australia Post')"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] bg-slate-800 border border-slate-700 text-slate-400 rounded-md font-mono">ESC</kbd>
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {matchedActions.length > 0 && (
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              System Views & Actions
            </div>
          )}
          {matchedActions.map((item, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <div
                key={item.id}
                onClick={() => { item.action(); onClose(); }}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                  isSelected ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                <ArrowRight size={13} className={isSelected ? 'text-white' : 'text-slate-600'} />
              </div>
            );
          })}

          {matchedJobs.length > 0 && (
            <div className="px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Jobs & Target Companies ({matchedJobs.length})
            </div>
          )}
          {matchedJobs.map((job, idx) => {
            const actualIdx = matchedActions.length + idx;
            const isSelected = selectedIndex === actualIdx;
            return (
              <div
                key={job.id || idx}
                onClick={() => { onSelectJob(job); onClose(); }}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                  isSelected ? 'bg-slate-800 text-white border border-indigo-500/50' : 'text-slate-300 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-[11px] font-bold text-indigo-400 shrink-0">
                    {job.company.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="truncate">
                    <div className="font-bold text-slate-200 truncate">{job.title}</div>
                    <div className="text-[11px] text-slate-400 truncate">{job.company} • {job.location || 'Melbourne'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-950 border border-slate-800 text-emerald-400">
                    {job.score || 85}%
                  </span>
                </div>
              </div>
            );
          })}

          {totalItems.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-500">
              No matching commands or jobs found for "{query}".
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>Navigate with <kbd className="text-slate-400 font-mono">↑</kbd> <kbd className="text-slate-400 font-mono">↓</kbd>, Select <kbd className="text-slate-400 font-mono">↵</kbd></span>
          <span>Open with <kbd className="text-slate-400 font-mono">Ctrl+K</kbd> / <kbd className="text-slate-400 font-mono">⌘K</kbd></span>
        </div>
      </div>
    </div>
  );
};
