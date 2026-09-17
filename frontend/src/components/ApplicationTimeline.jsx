import React, { useState, useEffect, useCallback } from 'react';
import { 
  Clock, Plus, Calendar, CheckCircle2, MessageSquare, 
  FileText, Send, AlertCircle, Sparkles, ChevronDown, ChevronUp,
  CalendarPlus, Download
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { 
  generateGoogleCalendarUrl, 
  downloadIcsFile, 
  formatCalendarBriefing 
} from '../services/calendarService';

const formatTimestamp = (ts) => {
  if (!ts) return 'Just now';
  try {
    const d = typeof ts === 'string' ? parseISO(ts) : new Date(ts);
    if (isValid(d)) {
      return format(d, 'MMM d, yyyy · h:mm a');
    }
  } catch {}
  return String(ts);
};

const getEventBadge = (type = 'stage_change') => {
  switch (type.toLowerCase()) {
    case 'applied':
    case 'submission':
      return { label: 'Application Submitted', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40', icon: Send };
    case 'interview':
    case 'screening':
      return { label: 'Interview Scheduled', color: 'bg-amber-950/80 text-amber-300 border-amber-500/40', icon: Calendar };
    case 'offer':
      return { label: 'Offer Received', color: 'bg-emerald-900/90 text-emerald-200 border-emerald-400', icon: Sparkles };
    case 'rejection':
    case 'unsuccessful':
      return { label: 'Outcome Logged', color: 'bg-rose-950/80 text-rose-300 border-rose-500/40', icon: AlertCircle };
    case 'generated_doc':
      return { label: 'Document Tailored', color: 'bg-blue-950/80 text-blue-300 border-blue-500/40', icon: FileText };
    case 'note':
    default:
      return { label: 'Status Update', color: 'bg-slate-900 text-slate-300 border-slate-700', icon: MessageSquare };
  }
};

export const ApplicationTimeline = ({ 
  jobId, 
  application = null, 
  events: propEvents = null,
  onAddEvent = null 
}) => {
  const [events, setEvents] = useState(() => {
    if (propEvents && Array.isArray(propEvents)) return propEvents;
    if (application?.events && Array.isArray(application.events)) return application.events;
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [newEventText, setNewEventText] = useState('');
  const [newEventType, setNewEventType] = useState('note');
  const [isAdding, setIsAdding] = useState(false);

  // Sync prop events
  useEffect(() => {
    if (propEvents && Array.isArray(propEvents)) {
      setEvents(propEvents);
    } else if (application?.events && Array.isArray(application.events)) {
      setEvents(application.events);
    }
  }, [propEvents, application]);

  // Fetch events from backend API if jobId is present
  useEffect(() => {
    if (!jobId || (propEvents && propEvents.length > 0)) return;

    let isMounted = true;
    const fetchEvents = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('access_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/applications/${encodeURIComponent(jobId)}/events`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.events && Array.isArray(data.events)) {
            setEvents(data.events);
          }
        }
      } catch {
        // Fallback to local application events
        if (isMounted && application?.events) {
          setEvents(application.events);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchEvents();
    return () => { isMounted = false; };
  }, [jobId]);

  const handleCreateEvent = useCallback((e) => {
    e.preventDefault();
    if (!newEventText.trim()) return;

    const newRecord = {
      id: `evt_${Date.now()}`,
      job_id: jobId,
      event_type: newEventType,
      timestamp: new Date().toISOString(),
      note: newEventText.trim(),
    };

    const updated = [newRecord, ...events];
    setEvents(updated);
    setNewEventText('');
    setIsAdding(false);

    if (onAddEvent) {
      onAddEvent(newRecord);
    }
  }, [newEventText, newEventType, events, jobId, onAddEvent]);

  // Default synthetic timeline if empty
  const displayEvents = events.length > 0 ? events : [
    {
      id: 'default_discovered',
      event_type: 'stage_change',
      timestamp: application?.applied_at || application?.date || new Date().toISOString(),
      note: `Application tracking initiated for ${application?.company || 'position'}. Status: ${application?.status || 'In Progress'}.`,
    }
  ];

  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-md p-4 font-mono text-xs text-slate-200">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-amber-400" />
          <h3 className="text-sm font-bold text-white tracking-wide uppercase">Audit Trail & Activity Log</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold border border-slate-700">
            {displayEvents.length} Events
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 font-bold text-[11px] transition-colors cursor-pointer"
        >
          <Plus size={12} /> Log Activity
        </button>
      </div>

      {/* New Event Form */}
      {isAdding && (
        <form onSubmit={handleCreateEvent} className="mt-3 p-3 bg-slate-900 border border-amber-500/30 rounded-md animate-in fade-in duration-150">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-[10px] text-slate-400 font-bold uppercase">Activity Type:</label>
            <select
              value={newEventType}
              onChange={(e) => setNewEventType(e.target.value)}
              className="bg-slate-950 text-slate-200 text-xs px-2 py-1 rounded border border-slate-700 focus:border-amber-400 outline-none"
            >
              <option value="note">Candidate Note</option>
              <option value="interview">Interview Scheduled</option>
              <option value="applied">Application Submitted</option>
              <option value="offer">Offer Update</option>
              <option value="rejection">Rejection / Closed</option>
            </select>
          </div>
          <textarea
            value={newEventText}
            onChange={(e) => setNewEventText(e.target.value)}
            placeholder="Record recruiter touchpoint, interview feedback, follow-up notes..."
            rows={2}
            className="w-full bg-slate-950 text-slate-100 text-xs p-2 rounded border border-slate-700 focus:border-amber-400 outline-none resize-none"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-2.5 py-1 rounded text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold transition-colors cursor-pointer"
            >
              Save Event
            </button>
          </div>
        </form>
      )}

      {/* Timeline List */}
      <div className="relative mt-4 pl-4 border-l border-slate-800 space-y-4">
        {displayEvents.map((evt) => {
          const badge = getEventBadge(evt.event_type);
          const BadgeIcon = badge.icon;
          return (
            <div key={evt.id || evt.timestamp} className="relative group">
              {/* Timeline Marker Dot */}
              <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-slate-950 group-hover:scale-125 transition-transform" />
              
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}>
                  <BadgeIcon size={10} />
                  {badge.label}
                </span>
                <span className="text-[10px] text-slate-500 font-bold">
                  {formatTimestamp(evt.timestamp || evt.created_at)}
                </span>
              </div>

              <p className="text-slate-300 text-xs leading-relaxed">
                {evt.note || evt.message || 'No additional details logged.'}
              </p>

              {(evt.event_type === 'interview' || evt.event_type === 'screening') && (
                <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                  <a
                    href={generateGoogleCalendarUrl({
                      title: `Interview: ${application?.company || 'Target Role'}`,
                      description: formatCalendarBriefing(application || {}, {
                        interviewType: badge.label,
                        notes: evt.note,
                      }),
                      startTime: evt.timestamp ? new Date(evt.timestamp) : null,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold text-[10px] transition-colors cursor-pointer"
                  >
                    <CalendarPlus size={12} /> Add to Google Calendar
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      downloadIcsFile({
                        title: `Interview: ${application?.company || 'Target Role'}`,
                        description: formatCalendarBriefing(application || {}, {
                          interviewType: badge.label,
                          notes: evt.note,
                        }),
                        startTime: evt.timestamp ? new Date(evt.timestamp) : null,
                      });
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-[10px] transition-colors cursor-pointer"
                  >
                    <Download size={12} /> Download .ics
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ApplicationTimeline;

