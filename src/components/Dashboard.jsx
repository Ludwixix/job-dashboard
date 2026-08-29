import React, { useState, useEffect } from 'react';
import { useJobs } from '../hooks/useJobs';
import { ApplicationTracker } from './ApplicationTracker';
import { JobSeeker } from './JobSeeker';
import { JobModal } from './JobModal';
import { GeneratorModal } from './GeneratorModal';
import { CommandPalette } from './CommandPalette';
import { BatchApplyModal } from './BatchApplyModal';
import { Terminal, Sparkles, CheckCircle2, Cpu, Activity, RefreshCw, MapPin, Edit2, Check, X, Download, Command, Zap } from 'lucide-react';

export const Dashboard = () => {
  const { jobs, loading, error, refetch, updateJobStatus, rejectJob, unrejectJob } = useJobs();
  const [activeSection, setActiveSection] = useState('seeker');
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedForGenerator, setSelectedForGenerator] = useState(null);
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
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-900 gap-4 font-mono">
      <div className="relative flex items-center justify-center">
        <div className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-indigo-500/20"></div>
        <Cpu size={32} className="text-indigo-600 animate-pulse" />
      </div>
      <p className="text-xs font-bold tracking-widest uppercase text-slate-600">LOADING GOOGLE SHEETS PIPELINE...</p>
    </div>
  );

  if (error) return (
    <div className="max-w-2xl mx-auto my-12 p-6 bg-rose-50 text-rose-900 rounded-lg border border-rose-200 font-mono text-xs shadow-xs">
      <h2 className="text-sm font-bold tracking-widest uppercase mb-1">SYSTEM ERROR // FETCH FAILED</h2>
      <p>{error}</p>
    </div>
  );

  const preparedCount = jobs.filter(j => 
    j.status.toLowerCase().includes('package prepared') || 
    j.status.toLowerCase().includes('to submit')
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
    <div className="min-h-screen bg-slate-50 bg-tech-grid font-sans text-slate-900 pb-12 selection:bg-indigo-600 selection:text-white">
      {/* Dynamic Live Ticker Bar */}
      <div className="bg-slate-900 text-slate-300 py-1.5 px-4 font-mono text-[11px] border-b border-slate-800 flex items-center justify-between font-semibold">
        <div className="flex items-center gap-4 truncate">
          <span className="flex items-center gap-1.5 text-emerald-400 font-bold shrink-0">
            <Activity size={13} className="animate-pulse" /> ENGINE ACTIVE
          </span>
          <span className="text-slate-400 hidden sm:inline">|</span>
          <span className="truncate text-slate-300">
            <strong className="text-white">{jobs.length}</strong> TOTAL POSITIONS IN DATABASE
          </span>
          <span className="text-slate-400 hidden md:inline">|</span>
          
          {/* Updatable Location Bound Bar */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-bold">LOCATION BOUND:</span>
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
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900 transition-all font-black cursor-pointer group"
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
            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer text-[10px] uppercase font-black bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded"
            title="Dispatch 1-Click Batch Automated Applications"
          >
            <Zap size={12} className="animate-bounce text-emerald-400" /> BATCH AUTO-APPLY
          </button>

          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex items-center gap-1 text-purple-300 hover:text-white transition-colors cursor-pointer text-[10px] uppercase font-bold bg-purple-950/80 border border-purple-500/40 px-2 py-0.5 rounded"
            title="Open Command Palette (Ctrl+K)"
          >
            <Command size={12} /> CTRL+K
          </button>

          <span className="text-slate-700">|</span>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer text-[10px] uppercase font-bold"
            title="Export all database postings to CSV"
          >
            <Download size={12} /> EXPORT CSV
          </button>

          <span className="text-slate-700">|</span>

          <button 
            onClick={refetch}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer text-[10px] uppercase font-bold"
          >
            <RefreshCw size={12} /> SYNC DATA
          </button>
        </div>
      </div>

      {/* Quick Location Preset Selector Bar when editing */}
      {isEditingLocation && (
        <div className="bg-slate-800 text-slate-300 py-1.5 px-4 font-mono text-[10px] border-b border-slate-700 flex items-center gap-2 overflow-x-auto animate-in fade-in duration-150">
          <span className="text-slate-400 font-bold uppercase shrink-0">QUICK PRESETS:</span>
          {PRESET_SUBURBS.map(suburb => (
            <button
              key={suburb}
              onClick={() => { setBaseLocation(suburb); setTempLocationInput(suburb); setIsEditingLocation(false); }}
              className={`px-2 py-0.5 rounded border transition-colors shrink-0 cursor-pointer font-extrabold ${
                baseLocation === suburb 
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {suburb}
            </button>
          ))}
        </div>
      )}

      {/* High-Contrast Technocratic Header */}
      <header className="bg-slate-900 border-b-2 border-slate-800 text-white sticky top-0 z-40 shadow-md font-mono">
        <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs border border-indigo-400/40">
              <Terminal size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-wider uppercase text-white">
                  APPLICATIONS.HUB // v3.0
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 pulse-emerald">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> LIVE SYNCED
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono font-bold mt-0.5">
                REAL-TIME GOOGLE SHEETS & AUTOMATED APPLICATION DISPATCHER
              </p>
            </div>
          </div>

          {/* Section Navigation Tabs */}
          <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveSection('seeker')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                activeSection === 'seeker' 
                  ? 'bg-indigo-600 text-white shadow-md border border-indigo-400/50 pulse-indigo' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Sparkles size={15} className={activeSection === 'seeker' ? "text-indigo-200 animate-spin-slow" : "text-indigo-400"} /> 
              JOB SEEKER & PREP
              {preparedCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                  activeSection === 'seeker' ? 'bg-white text-indigo-900' : 'bg-indigo-950 text-indigo-300 border border-indigo-500/40'
                }`}>
                  {preparedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSection('tracker')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                activeSection === 'tracker' 
                  ? 'bg-emerald-600 text-white shadow-md border border-emerald-400/50 pulse-emerald' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <CheckCircle2 size={15} className={activeSection === 'tracker' ? "text-emerald-200" : "text-emerald-400"} /> 
              APPLICATION TRACKER
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeSection === 'seeker' ? (
          <JobSeeker 
            jobs={jobs} 
            onSelectJob={(job) => setSelectedJob(job)} 
            onRejectJob={rejectJob}
            onUnrejectJob={unrejectJob}
            baseLocation={baseLocation} 
          />
        ) : (
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

      {/* Intelligent Quick Action Command Palette */}
      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={setIsCommandPaletteOpen}
        onSelectAction={(actionId) => {
          if (actionId === 'batch_apply') setIsBatchApplyOpen(true);
          else if (actionId === 'export_csv') handleExportCSV();
          else if (actionId === 'sync_data') refetch();
          else if (actionId === 'set_location') setIsEditingLocation(true);
          else if (actionId === 'view_table') setActiveSection('tracker');
          else if (actionId === 'view_kanban') setActiveSection('tracker');
        }}
      />

      {/* 1-Click Batch Application Dispatcher Modal */}
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

      {/* VS Code Dark Theme Fixed Bottom Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 h-7 bg-[#007acc] text-white font-mono text-[11px] font-bold px-3 flex items-center justify-between z-50 select-none shadow-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 hover:bg-white/20 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
            <span>⚡ master*</span>
          </div>
          <div className="flex items-center gap-1 hover:bg-white/20 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
            <span>0 errors, 0 warnings</span>
          </div>
          <div className="flex items-center gap-1 text-sky-200">
            <span>Synced: {jobs.length} jobs</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="hover:bg-white/20 px-1.5 py-0.5 rounded cursor-pointer">UTF-8</span>
          <span className="hover:bg-white/20 px-1.5 py-0.5 rounded cursor-pointer">Prettier</span>
          <span className="hover:bg-white/20 px-1.5 py-0.5 rounded cursor-pointer">React 19 / Vite</span>
          <span className="bg-emerald-500 text-slate-950 px-2 py-0.5 rounded font-black text-[10px]">
            {baseLocation.split(' ')[0]}
          </span>
        </div>
      </footer>
    </div>
  );
};
