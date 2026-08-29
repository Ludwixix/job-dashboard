import React, { useState, useEffect } from 'react';
import { useJobs } from '../hooks/useJobs';
import { ApplicationTracker } from './ApplicationTracker';
import { JobSeeker } from './JobSeeker';
import { JobModal } from './JobModal';
import { GeneratorModal } from './GeneratorModal';
import { InterviewPrepModal } from './InterviewPrepModal';
import { MarketIntelligence } from './MarketIntelligence';
import { KanbanBoard } from './KanbanBoard';
import { CommandPalette } from './CommandPalette';
import { CopilotBar } from './CopilotBar';
import { BatchApplyModal } from './BatchApplyModal';
import { 
  Terminal, Sparkles, Cpu, Activity, RefreshCw, 
  MapPin, Edit2, Check, X, Download, Command, Zap, LayoutGrid, 
  Sliders, TrendingUp, Table 
} from 'lucide-react';

export const Dashboard = () => {
  const { jobs, loading, error, refetch, updateJobStatus, rejectJob, unrejectJob } = useJobs();
  const [activeSection, setActiveSection] = useState('seeker'); // 'seeker', 'kanban', 'market', 'tracker'
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedForGenerator, setSelectedForGenerator] = useState(null);
  const [selectedForInterviewPrep, setSelectedForInterviewPrep] = useState(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isBatchApplyOpen, setIsBatchApplyOpen] = useState(false);

  // Updatable Location Bound State
  const [baseLocation, setBaseLocation] = useState(() => {
    return localStorage.getItem('userBaseLocation') || 'BALACLAVA VIC 3183';
  });
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [tempLocationInput, setTempLocationInput] = useState(baseLocation);

  useEffect(() => {
    localStorage.setItem('userBaseLocation', baseLocation);
  }, [baseLocation]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSaveLocation = (e) => {
    if (e) e.preventDefault();
    if (tempLocationInput.trim()) {
      setBaseLocation(tempLocationInput.trim().toUpperCase());
    }
    setIsEditingLocation(false);
  };

  const PRESET_SUBURBS = [
    'BALACLAVA VIC 3183',
    'ST KILDA VIC 3182',
    'PRAHRAN VIC 3181',
    'ELSTERNWICK VIC 3185',
    'MELBOURNE CBD 3000',
    'RICHMOND VIC 3121',
    'SOUTH YARRA VIC 3141'
  ];

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-slate-100 gap-4 font-mono">
      <div className="relative flex items-center justify-center">
        <div className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-indigo-500/20"></div>
        <Cpu size={32} className="text-indigo-400 animate-pulse" />
      </div>
      <p className="text-xs font-bold tracking-widest uppercase text-slate-400">INITIALIZING V2.0 AUTONOMOUS CAREER ENGINE...</p>
    </div>
  );

  if (error) return (
    <div className="max-w-2xl mx-auto my-12 p-6 bg-rose-950 text-rose-200 rounded-xl border border-rose-800 font-mono text-xs shadow-lg">
      <h2 className="text-sm font-bold tracking-widest uppercase mb-1">SYSTEM ERROR // FETCH FAILED</h2>
      <p>{error}</p>
    </div>
  );

  const preparedCount = jobs.filter(j => 
    !j.isRejected && (
      j.status.toLowerCase().includes('package prepared') || 
      j.status.toLowerCase().includes('to submit') ||
      j.status.toLowerCase().includes('discovered')
    )
  ).length;

  const handleExportCSV = () => {
    if (!jobs || jobs.length === 0) return;

    const headers = ['Date', 'Company', 'Job Title', 'Status', 'Location', 'Salary', 'Source', 'Score', 'Portal Link', 'Notes'];
    const rows = jobs.map(j => [
      `"${(j.date || '').replace(/"/g, '""')}"`,
      `"${(j.company || '').replace(/"/g, '""')}"`,
      `"${(j.title || '').replace(/"/g, '""')}"`,
      `"${(j.status || '').replace(/"/g, '""')}"`,
      `"${(j.location || '').replace(/"/g, '""')}"`,
      `"${(j.salary || '').replace(/"/g, '""')}"`,
      `"${(j.source || '').replace(/"/g, '""')}"`,
      `"${j.score || 85}"`,
      `"${(j.portalLink || '').replace(/"/g, '""')}"`,
      `"${(j.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Job_Tracker_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 pb-16 selection:bg-indigo-600 selection:text-white">
      {/* Top Live Engine Status Bar */}
      <div className="bg-slate-900 text-slate-300 py-1.5 px-4 font-mono text-[11px] border-b border-slate-800 flex items-center justify-between font-semibold">
        <div className="flex items-center gap-4 truncate">
          <span className="flex items-center gap-1.5 text-emerald-400 font-bold shrink-0">
            <Activity size={13} className="animate-pulse" /> V2.0 ENGINE ACTIVE
          </span>
          <span className="text-slate-700 hidden sm:inline">|</span>
          <span className="truncate text-slate-300">
            <strong className="text-white">{jobs.length}</strong> INDEXED POSITIONS
          </span>
          <span className="text-slate-700 hidden md:inline">|</span>
          
          {/* Location Bound selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold">BASE:</span>
            {isEditingLocation ? (
              <form onSubmit={handleSaveLocation} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={tempLocationInput}
                  onChange={(e) => setTempLocationInput(e.target.value)}
                  className="bg-slate-800 text-emerald-300 text-[11px] font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/50 focus:outline-none"
                  placeholder="ENTER SUBURB / POSTCODE..."
                  autoFocus
                />
                <button 
                  type="submit" 
                  className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-500 transition-colors cursor-pointer"
                  title="Save Location"
                >
                  <Check size={12} />
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsEditingLocation(false)} 
                  className="p-1 bg-slate-800 text-slate-400 rounded hover:text-white transition-colors cursor-pointer"
                  title="Cancel"
                >
                  <X size={12} />
                </button>
              </form>
            ) : (
              <button
                onClick={() => { setTempLocationInput(baseLocation); setIsEditingLocation(true); }}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900 transition-all font-bold cursor-pointer group text-[11px]"
                title="Click to change your location bound base"
              >
                <MapPin size={11} className="text-emerald-400" />
                <span>{baseLocation}</span>
                <Edit2 size={10} className="text-emerald-400 opacity-60 group-hover:opacity-100 transition-opacity ml-0.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIsBatchApplyOpen(true)}
            className="flex items-center gap-1 text-emerald-300 hover:text-white transition-colors cursor-pointer text-[10px] uppercase font-black bg-emerald-950 border border-emerald-500/40 px-2 py-0.5 rounded"
            title="Dispatch 1-Click Batch Automated Applications"
          >
            <Zap size={12} className="animate-bounce text-emerald-400" /> BATCH AUTO-APPLY
          </button>

          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex items-center gap-1 text-indigo-300 hover:text-white transition-colors cursor-pointer text-[10px] uppercase font-bold bg-indigo-950 border border-indigo-500/40 px-2 py-0.5 rounded"
            title="Open Command Palette (Ctrl+K)"
          >
            <Command size={12} /> ⌘K
          </button>

          <span className="text-slate-800">|</span>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer text-[10px] uppercase font-bold"
            title="Export all database postings to CSV"
          >
            <Download size={12} /> CSV
          </button>

          <span className="text-slate-800">|</span>

          <button 
            onClick={refetch}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer text-[10px] uppercase font-bold"
          >
            <RefreshCw size={12} /> SYNC
          </button>
        </div>
      </div>

      {/* Location Preset Bar */}
      {isEditingLocation && (
        <div className="bg-slate-900 text-slate-300 py-1.5 px-4 font-mono text-[10px] border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
          <span className="text-slate-500 font-bold uppercase shrink-0">QUICK PRESETS:</span>
          {PRESET_SUBURBS.map(suburb => (
            <button
              key={suburb}
              onClick={() => { setBaseLocation(suburb); setTempLocationInput(suburb); setIsEditingLocation(false); }}
              className={`px-2 py-0.5 rounded border transition-colors shrink-0 cursor-pointer font-bold ${
                baseLocation === suburb 
                  ? 'bg-emerald-600 text-white border-emerald-400'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
              }`}
            >
              {suburb}
            </button>
          ))}
        </div>
      )}

      {/* Technocratic Header & Top Navigation */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 shadow-xl font-mono">
        <div className="w-full max-w-[98vw] 2xl:max-w-[2560px] 3xl:max-w-[3400px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-md border border-indigo-400/40">
              <Terminal size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-wider uppercase text-white">
                  CAREER.AGENT // V2.0
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-400/30">
                  <Sparkles size={11} className="text-indigo-400" /> SUPER INTELLIGENCE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                AUTONOMOUS APPLICATION DISPATCHER & CAREER ACCELERATOR
              </p>
            </div>
          </div>

          {/* 4-Way Tab View Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 overflow-x-auto">
            <button
              onClick={() => setActiveSection('seeker')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                activeSection === 'seeker' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <LayoutGrid size={14} /> 
              STREAM
              {preparedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                  {preparedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSection('kanban')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                activeSection === 'kanban' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Sliders size={14} /> 
              FUNNEL KANBAN
            </button>

            <button
              onClick={() => setActiveSection('market')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                activeSection === 'market' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <TrendingUp size={14} /> 
              MARKET INTEL
            </button>

            <button
              onClick={() => setActiveSection('tracker')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                activeSection === 'tracker' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Table size={14} /> 
              TABLE
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Dashboard Container */}
      <main className="w-full max-w-[98vw] 2xl:max-w-[2560px] 3xl:max-w-[3400px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6 flex-1">
        {/* Proactive Agent Copilot Intelligence Bar */}
        <CopilotBar 
          jobs={jobs} 
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenGenerator={(j) => setSelectedForGenerator(j)}
          onNavigateView={(view) => setActiveSection(view)}
        />

        {/* Dynamic View Component */}
        {activeSection === 'seeker' && (
          <JobSeeker 
            jobs={jobs} 
            onSelectJob={(job) => setSelectedJob(job)} 
            onRejectJob={rejectJob}
            onUnrejectJob={unrejectJob}
            baseLocation={baseLocation} 
          />
        )}

        {activeSection === 'kanban' && (
          <KanbanBoard 
            jobs={jobs} 
            onUpdateStatus={(id, status) => updateJobStatus(id, status)}
            onOpenGenerator={(j) => setSelectedForGenerator(j)}
            onOpenInterviewPrep={(j) => setSelectedForInterviewPrep(j)}
          />
        )}

        {activeSection === 'market' && (
          <MarketIntelligence jobs={jobs} />
        )}

        {activeSection === 'tracker' && (
          <ApplicationTracker 
            jobs={jobs} 
            onSelectJob={(job) => setSelectedJob(job)} 
          />
        )}
      </main>

      {/* Job Details Modal */}
      {selectedJob && (
        <JobModal 
          job={selectedJob} 
          onClose={() => setSelectedJob(null)} 
          onOpenGenerator={(j) => setSelectedForGenerator(j)}
          onJobStatusUpdate={(updated) => {
            updateJobStatus(updated.id || updated.title, updated.status, updated);
            setSelectedJob(updated);
          }}
          onRejectJob={(id) => {
            rejectJob(id);
            setSelectedJob(null);
          }}
          onUnrejectJob={(id) => {
            unrejectJob(id);
            setSelectedJob(prev => prev ? { ...prev, isRejected: false, status: 'Discovered' } : null);
          }}
        />
      )}

      {/* Generator Modal */}
      {selectedForGenerator && (
        <GeneratorModal 
          job={selectedForGenerator} 
          onClose={() => setSelectedForGenerator(null)} 
        />
      )}

      {/* Interview Prep Super Intelligence Modal */}
      {selectedForInterviewPrep && (
        <InterviewPrepModal 
          job={selectedForInterviewPrep} 
          onClose={() => setSelectedForInterviewPrep(null)} 
        />
      )}

      {/* Omni-Command Palette Modal */}
      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        jobs={jobs}
        onSelectJob={(j) => { setSelectedJob(j); setIsCommandPaletteOpen(false); }}
        onNavigateView={(view) => { setActiveSection(view); setIsCommandPaletteOpen(false); }}
      />

      {/* Batch Application Dispatcher Modal */}
      <BatchApplyModal 
        jobs={jobs}
        isOpen={isBatchApplyOpen}
        onClose={() => setIsBatchApplyOpen(false)}
        onComplete={(results) => {
          results.forEach(res => {
            if (res.success) {
              updateJobStatus(res.job.id || res.job.title, 'Applied / Confirmation Received', res.result);
            }
          });
        }}
      />

      {/* Fixed Bottom Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 h-7 bg-slate-900 border-t border-slate-800 text-slate-400 font-mono text-[11px] font-bold px-4 flex items-center justify-between z-50 select-none shadow-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-emerald-400">
            <span>⚡ V2.0 AUTONOMOUS</span>
          </div>
          <div className="flex items-center gap-1 text-slate-500 hidden sm:flex">
            <span>Active Feed: {jobs.length} jobs</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-500">React 19 / Vite 6</span>
          <span className="bg-emerald-950 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-black text-[10px]">
            {baseLocation.split(' ')[0]}
          </span>
        </div>
      </footer>
    </div>
  );
};
