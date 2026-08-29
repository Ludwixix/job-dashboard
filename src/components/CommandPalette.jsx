import React, { useState, useEffect } from 'react';
import { 
  Search, Zap, Download, RefreshCw, Wrench, Building2, 
  Server, ShieldCheck, Database, LayoutList, Kanban, MapPin, X
} from 'lucide-react';

export const CommandPalette = ({ isOpen, onClose, onSelectAction }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose(!isOpen);
      }
      if (e.key === 'Escape' && isOpen) {
        onClose(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const COMMANDS = [
    { id: 'batch_apply', title: '🚀 Execute Automated Application Pipeline for Top Matches', category: 'Automation', icon: Zap, action: () => onSelectAction('batch_apply') },
    { id: 'export_csv', title: '📥 Export Complete Job Database to CSV', category: 'Data', icon: Download, action: () => onSelectAction('export_csv') },
    { id: 'sync_data', title: '🔄 Sync Google Sheets & Scraper Telemetry', category: 'Data', icon: RefreshCw, action: () => onSelectAction('sync_data') },
    { id: 'tab_field_tech', title: '🛠️ Filter Stream: Field Tech, Labour & Outdoor Work', category: 'Stream Filter', icon: Wrench, action: () => onSelectAction('stream_Field Tech, Labour & Physical') },
    { id: 'tab_gov', title: '🏛️ Filter Stream: Government & Council Pathways', category: 'Stream Filter', icon: Building2, action: () => onSelectAction('stream_Gov & Council Pathways') },
    { id: 'tab_it', title: '🖥️ Filter Stream: Core IT & Systems Engineering', category: 'Stream Filter', icon: Server, action: () => onSelectAction('stream_Core IT & Systems') },
    { id: 'tab_cyber', title: '🛡️ Filter Stream: Cybersecurity & SOC Operations', category: 'Stream Filter', icon: ShieldCheck, action: () => onSelectAction('stream_Cybersecurity') },
    { id: 'tab_data', title: '📊 Filter Stream: Data & Analytics', category: 'Stream Filter', icon: Database, action: () => onSelectAction('stream_Data & Analytics') },
    { id: 'view_table', title: '📋 Switch to Table View in Application Tracker', category: 'View', icon: LayoutList, action: () => onSelectAction('view_table') },
    { id: 'view_kanban', title: '🗂️ Switch to Kanban Board in Application Tracker', category: 'View', icon: Kanban, action: () => onSelectAction('view_kanban') },
    { id: 'set_location', title: '📍 Update Base Location (Current: Balaclava VIC)', category: 'Settings', icon: MapPin, action: () => onSelectAction('set_location') },
  ];

  const filteredCommands = COMMANDS.filter(cmd => 
    cmd.title.toLowerCase().includes(query.toLowerCase()) || 
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-950/80 backdrop-blur-md font-mono p-4">
      <div className="w-full max-w-2xl bg-[#181825] border-2 border-purple-500/50 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-100">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#313244] bg-[#1e1e2e]">
          <Search size={18} className="text-purple-400 shrink-0" />
          <input
            type="text"
            placeholder="TYPE A COMMAND OR ACTION (e.g., EXPORT, FIELD TECH, SYNC)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-xs font-mono font-bold text-white placeholder-slate-500 focus:outline-none"
            autoFocus
          />
          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700 font-bold shrink-0">
            ESC TO CLOSE
          </span>
          <button 
            onClick={() => onClose(false)} 
            className="text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Command List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No matching commands found for "{query}".
            </div>
          ) : (
            filteredCommands.map(cmd => {
              const CmdIcon = cmd.icon;
              return (
                <div
                  key={cmd.id}
                  onClick={() => { cmd.action(); onClose(false); }}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-purple-600/30 hover:border-purple-400/50 border border-transparent transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-900 text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                      <CmdIcon size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-black text-white group-hover:text-purple-200">
                        {cmd.title}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">
                        {cmd.category}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-purple-400 group-hover:text-white bg-purple-950/80 group-hover:bg-purple-500 px-2.5 py-1 rounded-full border border-purple-500/30 transition-all">
                    RUN ↵
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
