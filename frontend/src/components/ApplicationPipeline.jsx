import React, { useState, useMemo } from 'react';
import { 
  DndContext, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors 
} from '@dnd-kit/core';
import { 
  SortableContext, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { PipelineTableView } from './PipelineTableView';
import { JobDrawer } from './JobDrawer';
import { KanbanColumnSkeleton, TableSkeleton } from './SkeletonLoaders';
import { ImportPreviewModal } from './ImportPreviewModal';
import { exportToJSON, exportToCSV, parseImportFile } from '../services/DataPortability';
import { LayoutGrid, List, Search, Filter, Download, Upload, Sparkles } from 'lucide-react';
import { useURLState } from '../hooks/useURLState';

const PIPELINE_STAGES = [
  { id: 'Wishlist', title: 'Wishlist / Saved', color: 'slate' },
  { id: 'Applied', title: 'Applied (In Review)', color: 'indigo' },
  { id: 'Interviewing', title: 'Interviewing', color: 'amber' },
  { id: 'Offer', title: 'Offer Received', color: 'emerald' },
  { id: 'Rejected', title: 'Rejected / Closed', color: 'rose' }
];

export const getJobStage = (job, starredSet = new Set()) => {
  const s = (job.status || '').toLowerCase();
  if (s.includes('reject') || s.includes('unsuccessful') || s.includes('closed') || job.isRejected) return 'Rejected';
  if (s.includes('offer') || s.includes('accepted')) return 'Offer';
  if (s.includes('interview') || s.includes('screen') || s.includes('assessment')) return 'Interviewing';
  if (s.includes('applied') || s.includes('submitted') || s.includes('confirmation')) return 'Applied';
  
  // Wishlist ONLY includes jobs that are starred or explicitly marked wishlist
  const isStarred = job.isStarred || 
                    starredSet.has(String(job.id)) || 
                    starredSet.has(`${job.company}_${job.title}`) ||
                    s.includes('wishlist') || 
                    s.includes('shortlist') || 
                    s.includes('starred') || 
                    s.includes('saved');
                    
  if (isStarred) return 'Wishlist';
  return null;
};

export const ApplicationPipeline = ({ jobs = [], onUpdateStatus, onOpenGenerator, loading }) => {
  const [selectedJob, setSelectedJob] = useState(null);
  const [viewMode, setViewMode] = useURLState('view', 'kanban'); // 'kanban' or 'table'
  const [searchQuery, setSearchQuery] = useURLState('q', '');
  const [statusFilter, setStatusFilter] = useURLState('status', 'All');
  
  const [importData, setImportData] = useState(null);
  const fileInputRef = React.useRef(null);

  const starredSet = useMemo(() => {
    try {
      const raw = localStorage.getItem('starred_jobs');
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Derived state: Only display active pipeline stages and starred wishlist items
  const activeJobs = useMemo(() => {
    return jobs.filter(j => {
      const stage = getJobStage(j, starredSet);
      if (!stage) return false;
      if (statusFilter !== 'All' && stage !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (j.title?.toLowerCase().includes(q) || j.company?.toLowerCase().includes(q) || j.notes?.toLowerCase().includes(q));
      }
      return true;
    });
  }, [jobs, searchQuery, statusFilter, starredSet]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    const jobId = active.id;
    let targetStage = over.id;

    // Check if over.id is one of our column stage IDs
    const isStageColumn = PIPELINE_STAGES.some(s => s.id === targetStage);
    if (!isStageColumn) {
      // It was dropped onto a card inside a column, find that target card's stage
      const targetCard = activeJobs.find(j => String(j.id) === String(targetStage));
      if (targetCard) {
        targetStage = getJobStage(targetCard, starredSet);
      }
    }

    const currentJob = activeJobs.find(j => String(j.id) === String(jobId));
    const currentStage = currentJob ? getJobStage(currentJob, starredSet) : null;

    if (targetStage && currentStage !== targetStage) {
      const stageStatuses = {
        'Wishlist': 'Discovered',
        'Applied': 'Applied',
        'Interviewing': 'Interviewing',
        'Offer': 'Offer Received',
        'Rejected': 'Rejected'
      };
      if (onUpdateStatus && stageStatuses[targetStage]) {
        onUpdateStatus(jobId, stageStatuses[targetStage]);
      }
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseImportFile(file);
      setImportData(parsed);
    } catch (err) {
      alert(`Import Failed: ${err}`);
    }
    e.target.value = '';
  };

  const confirmImport = (data) => {
    alert(`Successfully parsed ${data.length} records.`);
    setImportData(null);
  };

  return (
    <div className="w-full flex flex-col h-full space-y-4 font-sans">
      {/* Pipeline Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md font-mono">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="SEARCH APPLICATIONS..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-colors placeholder-slate-600"
            />
          </div>
          <div className="relative hidden sm:block">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-slate-950 border border-slate-700 text-slate-300 rounded-xl pl-3 pr-8 py-2 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer font-bold"
            >
              <option value="All">ALL STAGES ({activeJobs.length})</option>
              {PIPELINE_STAGES.map(s => {
                const count = activeJobs.filter(j => getJobStage(j, starredSet) === s.id).length;
                return (
                  <option key={s.id} value={s.id}>{s.title.toUpperCase()} ({count})</option>
                );
              })}
            </select>
            <Filter size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
          
          <div className="hidden lg:flex items-center gap-2 border-l border-slate-800 pl-3 ml-1">
            <button
              onClick={() => exportToJSON(activeJobs)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Export as JSON"
            >
              <Download size={13} /> JSON
            </button>
            <button
              onClick={() => exportToCSV(activeJobs)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Export as CSV"
            >
              <Download size={13} /> CSV
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer"
              title="Import JSON/CSV"
            >
              <Upload size={13} /> Import
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json,.csv" onChange={handleFileUpload} />
          </div>
        </div>

        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0 font-mono text-xs font-bold">
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'kanban' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid size={14} /> <span>KANBAN</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'table' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <List size={14} /> <span>TABLE</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden min-h-[550px]">
        {loading ? (
          viewMode === 'kanban' ? (
            <div className="flex gap-4 overflow-x-auto h-full pb-4">
              {[...Array(5)].map((_, i) => <KanbanColumnSkeleton key={i} />)}
            </div>
          ) : (
            <TableSkeleton />
          )
        ) : (
          viewMode === 'kanban' ? (
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
              <div className="flex gap-4 overflow-x-auto h-full pb-4 items-start snap-x snap-mandatory">
                {PIPELINE_STAGES.map(stage => (
                  <KanbanColumn 
                    key={stage.id} 
                    stage={stage} 
                    jobs={activeJobs.filter(j => getJobStage(j, starredSet) === stage.id)} 
                    onSelectJob={(job) => setSelectedJob(job)}
                  />
                ))}
              </div>
            </DndContext>
          ) : (
            <PipelineTableView 
              jobs={activeJobs} 
              onUpdateStatus={onUpdateStatus} 
              onSelectJob={(job) => setSelectedJob(job)}
            />
          )
        )}
      </div>

      {selectedJob && (
        <JobDrawer 
          job={selectedJob} 
          isOpen={!!selectedJob} 
          onClose={() => setSelectedJob(null)} 
          onOpenGenerator={onOpenGenerator}
          onUpdateStatus={(jobId, newStatus) => {
            if (onUpdateStatus) onUpdateStatus(jobId, newStatus);
            setSelectedJob(prev => prev ? { ...prev, status: newStatus } : null);
          }}
          onSaveNotes={(jobId, newNotes) => {
            if (onUpdateStatus) onUpdateStatus(jobId, selectedJob.status, newNotes);
            setSelectedJob(prev => prev ? { ...prev, notes: newNotes } : null);
          }}
        />
      )}

      <ImportPreviewModal 
        isOpen={!!importData} 
        data={importData} 
        onClose={() => setImportData(null)} 
        onConfirm={confirmImport} 
      />
    </div>
  );
};
