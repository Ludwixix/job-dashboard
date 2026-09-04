import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Building2, MapPin, Clock, Sparkles } from 'lucide-react';
import { parseISO, isValid, differenceInDays } from 'date-fns';

const KanbanCard = ({ job, onSelectJob }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: String(job.id), 
    data: { ...job, stage: job.stage } 
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  let daysAgo = 0;
  try {
    const rawDate = job.applied_at || job.date || job.posted;
    if (rawDate) {
      const parsed = typeof rawDate === 'string' ? parseISO(rawDate) : new Date(rawDate);
      if (isValid(parsed)) {
        daysAgo = Math.max(0, differenceInDays(new Date(), parsed));
      }
    }
  } catch {}

  const s = (job.status || '').toLowerCase();
  const needsFollowUp = daysAgo > 7 && (s.includes('applied') || s.includes('interview'));

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Only open job drawer if not actively dragging
        if (!isDragging && onSelectJob) {
          onSelectJob(job);
        }
      }}
      className={`p-4 rounded-xl bg-slate-800 border ${needsFollowUp ? 'border-amber-500/50 ring-1 ring-amber-500/30' : 'border-slate-700'} shadow-sm cursor-pointer hover:border-indigo-500/60 hover:bg-slate-750 transition-all group ${isDragging ? 'ring-2 ring-indigo-500' : ''}`}
    >
      <div className="flex justify-between items-start mb-1.5 gap-2">
        <h4 className="text-sm font-bold text-slate-100 leading-tight group-hover:text-indigo-300 transition-colors">{job.title}</h4>
      </div>
      
      {needsFollowUp && (
        <div className="inline-block mt-0.5 mb-2 px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[9px] font-mono font-bold uppercase">
          Follow-Up Due ({daysAgo}d)
        </div>
      )}

      <div className="space-y-1.5 mt-2.5">
        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
          <Building2 size={13} className="text-indigo-400 shrink-0" />
          <span className="truncate">{job.company}</span>
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <div className="flex items-center gap-1 truncate max-w-[60%]">
            <MapPin size={10} className="text-slate-500" />
            <span className="truncate">{job.location || 'Melbourne, VIC'}</span>
          </div>
          <div className="flex items-center gap-1 whitespace-nowrap">
            <Clock size={10} className="text-slate-500" />
            <span>{daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const KanbanColumn = ({ stage, jobs = [], onSelectJob }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: { type: 'column', stage: stage.id }
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
      className={`flex-1 min-w-[280px] sm:min-w-[320px] max-w-[350px] flex flex-col h-full rounded-2xl border ${colors[stage.color]} ${isOver ? 'ring-2 ring-indigo-500/50 bg-slate-850' : ''} transition-all snap-center shrink-0 shadow-lg`}
    >
      <div className="p-3.5 border-b border-slate-800/60 flex items-center justify-between sticky top-0 bg-inherit z-10 rounded-t-2xl">
        <h3 className="font-bold text-xs tracking-wider uppercase font-mono">{stage.title}</h3>
        <span className={`px-2 py-0.5 rounded-lg text-xs font-mono font-black shadow-xs ${headerColors[stage.color]}`}>
          {jobs.length}
        </span>
      </div>
      
      <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar min-h-[200px]">
        <SortableContext items={jobs.map(j => String(j.id))} strategy={verticalListSortingStrategy}>
          {jobs.map(job => (
            <KanbanCard key={job.id} job={job} onSelectJob={onSelectJob} />
          ))}
        </SortableContext>
        {jobs.length === 0 && (
          <div className="h-full min-h-[120px] flex items-center justify-center text-xs font-mono text-slate-500 italic p-4 text-center opacity-60 border-2 border-dashed border-slate-800 rounded-xl">
            Drag jobs here
          </div>
        )}
      </div>
    </div>
  );
};
