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
import { LayoutGrid, List, Search, Filter, Download, Upload } from 'lucide-react';
import { useURLState } from '../hooks/useURLState';

const PIPELINE_STAGES = [
  { id: 'Wishlist', title: 'Wishlist', color: 'slate' },
  { id: 'Applied', title: 'Applied', color: 'indigo' },
  { id: 'Interviewing', title: 'Interviewing', color: 'amber' },
  { id: 'Offer', title: 'Offer', color: 'emerald' },
  { id: 'Rejected', title: 'Rejected / Closed', color: 'rose' }
];

const getJobStage = (job, starredSet = new Set()) => {
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

export const ApplicationPipeline = ({ jobs = [], onUpdateStatus, loading }) => {
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
        return (j.title?.toLowerCase().includes(q) || j.company?.toLowerCase().includes(q));
      }
      return true;
    });
  }, [jobs, searchQuery, statusFilter, starredSet]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    const jobId = active.id;
    const newStage = over.id; // column id
    const currentStage = active.data.current?.sortable?.containerId;

    if (currentStage && newStage && currentStage !== newStage) {
      // Find proper status string to send to backend
      const stageStatuses = {
        'Wishlist': 'Discovered',
        'Applied': 'Applied',
        'Interviewing': 'Interviewing',
        'Offer': 'Offer Received',
        'Rejected': 'Rejected'
      };
      onUpdateStatus(jobId, stageStatuses[newStage]);
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
    e.target.value = ''; // reset
  };

  const confirmImport = (data) => {
    // Ideally we would send to the backend batch upload API.
    // For now, we simulate success and rely on parent reload.
    alert(`Successfully parsed ${data.length} records. (Backend sync pending)`);
    setImportData(null);
  };

  return (
    <div className="w-full flex flex-col h-full space-y-4">
      {/* Pipeline Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search applications..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="relative hidden sm:block">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-slate-950 border border-slate-700 text-slate-300 rounded-xl pl-4 pr-8 py-2 text-sm focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="All">All Stages</option>
              {PIPELINE_STAGES.map(s => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
            <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
          
          <div className="hidden lg:flex items-center gap-2 border-l border-slate-800 pl-4 ml-1">
            <button
              onClick={() => exportToJSON(jobs)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Export as JSON"
            >
              <Download size={14} /> JSON
            </button>
            <button
              onClick={() => exportToCSV(jobs)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Export as CSV"
            >
              <Download size={14} /> CSV
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors"
              title="Import JSON/CSV"
            >
              <Upload size={14} /> Import
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json,.csv" onChange={handleFileUpload} />
          </div>
        </div>

        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
              viewMode === 'kanban' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid size={16} /> <span className="hidden sm:inline">Kanban</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
              viewMode === 'table' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <List size={16} /> <span className="hidden sm:inline">Table</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden min-h-[500px]">
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
                    jobs={activeJobs.filter(j => getJobStage(j) === stage.id)} 
                    onUpdateStatus={onUpdateStatus}
                    onSelectJob={setSelectedJob}
                  />
                ))}
              </div>
            </DndContext>
          ) : (
            <PipelineTableView 
              jobs={activeJobs} 
              onUpdateStatus={onUpdateStatus} 
              onSelectJob={setSelectedJob}
            />
          )
        )}
      </div>

      <JobDrawer 
        job={selectedJob} 
        isOpen={!!selectedJob} 
        onClose={() => setSelectedJob(null)} 
        onUpdateStatus={onUpdateStatus} 
      />

      <ImportPreviewModal 
        isOpen={!!importData} 
        data={importData} 
        onClose={() => setImportData(null)} 
        onConfirm={confirmImport} 
      />
    </div>
  );
};
