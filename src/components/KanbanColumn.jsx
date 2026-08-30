import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Building2, MapPin, Clock } from 'lucide-react';
import { parseISO, differenceInDays } from 'date-fns';

const KanbanCard = ({ job, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id, data: job });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  const daysAgo = job.date ? differenceInDays(new Date(), parseISO(job.date)) : 0;
  const needsFollowUp = daysAgo > 7 && (job.status?.includes('Applied') || job.status?.includes('Interviewing'));

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`p-4 rounded-xl bg-slate-800 border ${needsFollowUp ? 'border-rose-500/50' : 'border-slate-700'} shadow-sm cursor-grab hover:border-indigo-500/50 transition-colors group ${isDragging ? 'ring-2 ring-indigo-500' : ''}`}
    >
      <div className="flex justify-between items-start mb-2 gap-2">
        <h4 className="text-sm font-bold text-slate-100 leading-tight group-hover:text-indigo-300 transition-colors">{job.title}</h4>
      </div>
      {needsFollowUp && (
        <div className="inline-block mt-1 mb-2 px-2 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-[10px] font-bold uppercase">
          Action Needed
        </div>
      )}
      <div className="space-y-1.5 mt-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <Building2 size={12} className="shrink-0" />
          <span className="truncate">{job.company}</span>
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
          <div className="flex items-center gap-1 truncate max-w-[60%]">
            <MapPin size={10} />
            <span className="truncate">{job.location || 'Remote'}</span>
          </div>
          <div className="flex items-center gap-1 whitespace-nowrap">
            <Clock size={10} />
            <span>{daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const KanbanColumn = ({ stage, jobs, onSelectJob }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const colors = {
    slate: 'border-slate-800 bg-slate-900/50 text-slate-300',
    indigo: 'border-indigo-900/40 bg-indigo-950/20 text-indigo-300',
    amber: 'border-amber-900/40 bg-amber-950/20 text-amber-300',
    emerald: 'border-emerald-900/40 bg-emerald-950/20 text-emerald-300',
    rose: 'border-rose-900/40 bg-rose-950/20 text-rose-300',
  };

  const headerColors = {
    slate: 'bg-slate-800 text-slate-300',
    indigo: 'bg-indigo-900/80 text-indigo-300',
    amber: 'bg-amber-900/80 text-amber-300',
    emerald: 'bg-emerald-900/80 text-emerald-300',
    rose: 'bg-rose-900/80 text-rose-300',
  };

  return (
    <div 
      ref={setNodeRef}
      className={`flex-1 min-w-[280px] sm:min-w-[320px] max-w-[350px] flex flex-col h-full rounded-2xl border ${colors[stage.color]} ${isOver ? 'ring-2 ring-indigo-500/50 bg-slate-800/80' : ''} transition-colors snap-center shrink-0`}
    >
      <div className="p-3 border-b border-slate-800/60 flex items-center justify-between sticky top-0 bg-inherit z-10 rounded-t-2xl">
        <h3 className="font-bold text-sm tracking-wide font-sans">{stage.title}</h3>
        <span className={`px-2 py-0.5 rounded-lg text-xs font-mono font-black shadow-xs ${headerColors[stage.color]}`}>
          {jobs.length}
        </span>
      </div>
      
      <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar min-h-[150px]">
        <SortableContext items={jobs.map(j => j.id)} strategy={verticalListSortingStrategy}>
          {jobs.map(job => (
            <KanbanCard key={job.id} job={job} onClick={() => onSelectJob && onSelectJob(job)} />
          ))}
        </SortableContext>
        {jobs.length === 0 && (
          <div className="h-full flex items-center justify-center text-xs font-mono text-slate-500 italic p-4 text-center opacity-50 border-2 border-dashed border-slate-700/50 rounded-xl">
            Drag jobs here
          </div>
        )}
      </div>
    </div>
  );
};
