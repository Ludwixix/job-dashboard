import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Calendar, MapPin, DollarSign, Building2, UserCircle, Edit3, AlignLeft, Activity, Sparkles, CheckCircle2 } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

const formatDateSafe = (dateStr, formatStr = 'MMM d, yyyy') => {
  if (!dateStr) return 'Recently';
  try {
    const parsed = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    if (isValid(parsed)) {
      return format(parsed, formatStr);
    }
  } catch {}
  return 'Recently';
};

export const JobDrawer = ({ job, isOpen, onClose, onUpdateStatus, onSaveNotes }) => {
  const [notes, setNotes] = useState(job?.notes || '');

  useEffect(() => {
    setNotes(job?.notes || '');
  }, [job?.id, job?.notes]);
  
  if (!isOpen || !job) return null;

  const handleSaveNotes = () => {
    if (onSaveNotes) {
      onSaveNotes(job.id, notes);
    }
  };

  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('reject') || s.includes('unsuccessful')) return 'bg-rose-950/60 text-rose-400 border-rose-800/50';
    if (s.includes('offer')) return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50';
    if (s.includes('interview')) return 'bg-amber-950/60 text-amber-400 border-amber-800/50';
    if (s.includes('applied')) return 'bg-indigo-950/60 text-indigo-400 border-indigo-800/50';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  const history = job.history || [
    { stage: job.status || 'Discovered', date: job.applied_at || job.date || new Date().toISOString() }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex justify-end font-sans">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="relative w-full max-w-md h-full bg-slate-900 border-l border-slate-800 shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/90">
          <div className="flex justify-between items-start mb-4">
            <select
              value={job.status || 'Discovered'}
              onChange={(e) => onUpdateStatus && onUpdateStatus(job.id, e.target.value)}
              className={`text-[11px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer ${getStatusColor(job.status)}`}
            >
              <option value="Discovered">Wishlist / Discovered</option>
              <option value="Applied">Applied (In Review)</option>
              <option value="Interviewing">Interviewing</option>
              <option value="Offer Received">Offer Received</option>
              <option value="Rejected">Rejected / Closed</option>
            </select>
            
            <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer">
              <X size={16} />
            </button>
          </div>
          
          <h2 className="text-lg sm:text-xl font-bold text-white mb-2 leading-tight">{job.title}</h2>
          
          <div className="flex items-center gap-2 text-indigo-400 font-semibold mb-4">
            <Building2 size={16} />
            <span>{job.company}</span>
          </div>

          <div className="flex flex-wrap gap-y-2 gap-x-4 text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-1.5">
              <MapPin size={14} className="text-slate-500" />
              <span>{job.location || 'Melbourne, VIC'}</span>
            </div>
            {job.salary && (
              <div className="flex items-center gap-1.5">
                <DollarSign size={14} className="text-slate-500" />
                <span>{job.salary}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-slate-500" />
              <span>{formatDateSafe(job.applied_at || job.date || job.posted)}</span>
            </div>
          </div>
          
          {(job.link || job.url) && (
            <div className="mt-4 flex gap-2">
              <a 
                href={job.link || job.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors text-sm"
              >
                <span>View Job Portal</span> <ExternalLink size={14} />
              </a>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* Notes Section */}
          <section className="space-y-2">
            <div className="flex items-center justify-between text-slate-300 font-bold uppercase tracking-wider text-xs">
              <span className="flex items-center gap-2">
                <AlignLeft size={14} className="text-indigo-400" />
                Tracking &amp; Interview Notes
              </span>
              <button 
                onClick={handleSaveNotes} 
                className="text-[10px] text-indigo-400 hover:underline font-mono cursor-pointer"
              >
                Save Notes
              </button>
            </div>
            <div className="relative">
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleSaveNotes}
                placeholder="Add application notes, follow-up dates, interviewer feedback, or prep thoughts..."
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-xl p-4 text-sm min-h-[140px] focus:outline-none focus:border-indigo-500 resize-y custom-scrollbar"
              />
              <Edit3 size={12} className="absolute top-3 right-3 text-slate-600" />
            </div>
          </section>

          {/* Job Snippet / Description */}
          {job.description && (
            <section className="space-y-2">
              <div className="text-slate-300 font-bold uppercase tracking-wider text-xs flex items-center gap-2">
                <Sparkles size={14} className="text-indigo-400" />
                Job Summary
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed max-h-48 overflow-y-auto">
                {job.description}
              </div>
            </section>
          )}

          {/* Stage History */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-300 font-bold uppercase tracking-wider text-xs">
              <Activity size={14} className="text-indigo-400" />
              Lifecycle History
            </div>
            
            <div className="relative border-l border-slate-700 ml-3 space-y-4">
              {history.map((h, i) => (
                <div key={i} className="relative pl-6">
                  <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-slate-900" />
                  <p className="text-sm font-bold text-white mb-0.5">{h.stage}</p>
                  <p className="text-[11px] font-mono text-slate-500">{formatDateSafe(h.date, 'MMM d, yyyy - h:mm a')}</p>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};
