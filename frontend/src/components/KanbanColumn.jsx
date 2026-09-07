import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Building2, MapPin, Clock } from 'lucide-react';
import { parseISO, isValid, differenceInDays } from 'date-fns';
import { Badge } from './ui/Badge';
import { statusBadgeClass, statusDotClass } from '../utils/statusStyles';

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
      role="article"
      aria-label={`${job.title} at ${job.company}${needsFollowUp ? ' — follow-up due' : ''}`}
      onClick={() => {
        if (!isDragging && onSelectJob) {
          onSelectJob(job);
        }
      }}
      className={`p-3.5 rounded-xl bg-slate-800/90 border ${needsFollowUp ? 'border-amber-500/60 ring-1 ring-amber-500/30' : 'border-slate-700/80'} shadow-sm cursor-pointer hover:border-indigo-500/60 hover:bg-slate-800 transition-all group select-none active:scale-[0.99] ${isDragging ? 'ring-2 ring-indigo-500 shadow-xl' : ''}`}
    >
      {/* Title — primary hierarchy */}
      <h4 className="text-sm font-semibold text-white leading-tight group-hover:text-indigo-300 transition-colors line-clamp-2 mb-1">
        {job.title}
      </h4>

      {/* Company — secondary hierarchy */}
      <div className="flex items-center gap-1.5 mb-2">
        <Building2 size={12} className="text-indigo-400 shrink-0" aria-hidden="true" />
        <span className="text-xs text-slate-400 truncate font-medium">{job.company}</span>
      </div>
      
      {needsFollowUp && (
        <div className="mb-2">
          <Badge variant="amber" size="xs">Follow-Up Due ({daysAgo}d)</Badge>
        </div>
      )}

      {/* Meta row — tertiary */}
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
        <div className="flex items-center gap-1 truncate max-w-[60%]">
          <MapPin size={10} aria-hidden="true" />
          <span className="truncate">{job.location || 'Melbourne, VIC'}</span>
        </div>
        <div className="flex items-center gap-1 whitespace-nowrap">
          <Clock size={10} aria-hidden="true" />
          <span>{daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}</span>
        </div>
      </div>
    </div>
  );
};

export const KanbanColumn = ({ stage, jobs = [], onSelectJob, className = '' }) => {
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
    <section 
      ref={setNodeRef}
      aria-label={`${stage.title} — ${jobs.length} job${jobs.length !== 1 ? 's' : ''}`}
      className={`w-full md:w-auto flex-1 min-w-[260px] md:min-w-[280px] xl:min-w-[300px] max-w-full flex flex-col h-full rounded-2xl border ${colors[stage.color]} ${isOver ? 'ring-2 ring-indigo-500/50 bg-slate-850' : ''} transition-all snap-center lg:shrink xl:flex-1 shadow-lg ${className}`}
    >
      <div className="p-3.5 border-b border-slate-800/60 flex items-center justify-between sticky top-0 bg-inherit z-10 rounded-t-2xl">
        <h3 className="font-bold text-xs tracking-wider uppercase font-mono">{stage.title}</h3>
        <span
          className={`px-2 py-0.5 rounded-lg text-xs font-mono font-black shadow-xs ${headerColors[stage.color]}`}
          aria-label={`${jobs.length} jobs`}
        >
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
          <div
            role="status"
            aria-label={`No jobs in ${stage.title} — drag jobs here`}
            className="h-full min-h-[120px] flex items-center justify-center text-xs font-mono text-slate-500 italic p-4 text-center opacity-60 border-2 border-dashed border-slate-800 rounded-xl"
          >
            Drag jobs here
          </div>
        )}
      </div>
    </section>
  );
};
