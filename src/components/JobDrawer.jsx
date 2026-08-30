import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, ExternalLink, Calendar, MapPin, DollarSign, Building2, UserCircle, 
  Edit3, AlignLeft, Activity, Sparkles, CheckCircle2, FileText, Copy, Check, 
  Download, Zap, Navigation, Train, Car, Bike, Clock, AlertTriangle
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { getCommuteDetails } from '../services/commuteService';

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

export const JobDrawer = ({ job, isOpen, onClose, onUpdateStatus, onSaveNotes, onOpenGenerator }) => {
  const [notes, setNotes] = useState(job?.notes || '');
  const [docTab, setDocTab] = useState('cover_letter'); // 'cover_letter' or 'resume'
  const [commuteTab, setCommuteTab] = useState('transit'); // 'transit', 'car', 'bike'
  const [copiedDoc, setCopiedDoc] = useState(false);

  const baseLocation = localStorage.getItem('userBaseLocation') || 'BALACLAVA VIC 3183';

  useEffect(() => {
    setNotes(job?.notes || '');
  }, [job?.id, job?.notes]);

  const commute = useMemo(() => {
    if (!job) return null;
    return getCommuteDetails(baseLocation, job.location);
  }, [baseLocation, job?.location]);
  
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

  const coverLetter = job.coverLetterText || job.cover_letter_text || '';
  const resume = job.resumeText || job.resume_text || '';
  const hasCustomDocs = Boolean(coverLetter || resume);

  const activeDocText = docTab === 'cover_letter' ? coverLetter : resume;

  const handleCopyDoc = () => {
    if (activeDocText) {
      navigator.clipboard.writeText(activeDocText);
      setCopiedDoc(true);
      setTimeout(() => setCopiedDoc(false), 2000);
    }
  };

  const handleDownloadDoc = () => {
    if (activeDocText) {
      const blob = new Blob([activeDocText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${job.company}_${job.title}_${docTab}.txt`.replace(/\s+/g, '_');
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-end font-sans">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="relative w-full max-w-xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex justify-between items-start mb-3">
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
          
          <h2 className="text-lg sm:text-xl font-bold text-white mb-1.5 leading-tight">{job.title}</h2>
          
          <div className="flex items-center gap-2 text-indigo-400 font-semibold mb-3">
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
          
          <div className="mt-4 flex gap-2">
            {(job.link || job.url) && (
              <a 
                href={job.link || job.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors text-xs font-mono"
              >
                <span>VIEW JOB PORTAL</span> <ExternalLink size={13} />
              </a>
            )}
            {onOpenGenerator && (
              <button
                onClick={() => {
                  onClose();
                  onOpenGenerator(job);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors text-xs font-mono cursor-pointer shadow-md"
              >
                <Zap size={13} />
                <span>{hasCustomDocs ? 'EDIT ASSETS STUDIO' : 'GENERATE ASSETS'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* Daily Commute Intelligence & Google Maps Transit Radar */}
          {commute && (
            <section className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 border border-slate-800 space-y-3 font-mono">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    <Navigation size={14} />
                  </div>
                  <div>
                    <div className="text-xs font-black text-white flex items-center gap-2">
                      GOOGLE MAPS COMMUTE ESTIMATOR
                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-800 text-slate-300">
                        {commute.isRemote ? 'REMOTE' : `${commute.distanceKm} KM FROM BASE`}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-sans">
                      Base: {baseLocation.split(' ')[0]} → {job.location || 'Melbourne'}
                    </div>
                  </div>
                </div>

                {!commute.isRemote && (
                  <a
                    href={commute.googleMapsUrls[commuteTab === 'transit' ? 'transit' : commuteTab === 'car' ? 'driving' : 'bicycling']}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Google Maps</span>
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>

              {!commute.isRemote ? (
                <div className="space-y-3 pt-1">
                  {/* Commute Mode Selector */}
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold">
                    <button
                      onClick={() => setCommuteTab('transit')}
                      className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        commuteTab === 'transit' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Train size={13} />
                      <span>TRAIN ({commute.transit.durationMin}m)</span>
                    </button>
                    <button
                      onClick={() => setCommuteTab('car')}
                      className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        commuteTab === 'car' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Car size={13} />
                      <span>CAR ({commute.car.peakMin}m)</span>
                    </button>
                    <button
                      onClick={() => setCommuteTab('bike')}
                      className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        commuteTab === 'bike' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Bike size={13} />
                      <span>BIKE ({commute.bike.durationMin}m)</span>
                    </button>
                  </div>

                  {/* Mode Details Display */}
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2">
                    {commuteTab === 'transit' && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Estimated Transit Time:</span>
                          <span className="font-black text-indigo-300 text-sm">{commute.transit.label}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500">Transit Line / Route:</span>
                          <span className="text-slate-300 font-semibold">{commute.transit.lines}</span>
                        </div>
                      </div>
                    )}

                    {commuteTab === 'car' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                            <div className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                              <Clock size={10} /> PEAK HOURS (8AM / 5PM)
                            </div>
                            <div className="text-sm font-black text-white mt-0.5">{commute.car.peakLabel}</div>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                            <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                              <Clock size={10} /> OFF-PEAK HOURS
                            </div>
                            <div className="text-sm font-black text-white mt-0.5">{commute.car.offPeakLabel}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
                          <span className="text-slate-400">Tolls &amp; Tollways:</span>
                          <span className={`font-bold ${commute.car.tolls.hasTolls ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {commute.car.tolls.hasTolls ? `${commute.car.tolls.tollRoads} (${commute.car.tolls.estimatedCost})` : 'Toll-Free Route ($0.00)'}
                          </span>
                        </div>
                      </div>
                    )}

                    {commuteTab === 'bike' && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Estimated Cycling Time:</span>
                          <span className="font-black text-emerald-400 text-sm">{commute.bike.label}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500">Dedicated Bike Trails:</span>
                          <span className="text-slate-300 font-semibold">{commute.bike.bikePaths}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>100% Remote Opportunity — No daily commute required.</span>
                </div>
              )}
            </section>
          )}

          {/* Generated Cover Letter & Resume Assets Section */}
          <section className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 font-mono">
            <div className="flex items-center justify-between">
              <div className="text-xs font-black text-indigo-300 flex items-center gap-2">
                <FileText size={14} className="text-indigo-400" />
                <span>APPLICATION ASSETS &amp; GENERATED DOCS</span>
              </div>
              {hasCustomDocs && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCopyDoc}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1 cursor-pointer font-bold"
                    title="Copy Document"
                  >
                    {copiedDoc ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{copiedDoc ? 'COPIED' : 'COPY'}</span>
                  </button>
                  <button
                    onClick={handleDownloadDoc}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1 cursor-pointer font-bold"
                    title="Download Document"
                  >
                    <Download size={11} />
                    <span>TXT</span>
                  </button>
                </div>
              )}
            </div>

            {hasCustomDocs ? (
              <div className="space-y-2.5">
                {/* Doc Switcher Tabs */}
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
                  <button
                    onClick={() => setDocTab('cover_letter')}
                    className={`flex-1 py-1 px-2 rounded-lg transition-colors cursor-pointer text-center ${
                      docTab === 'cover_letter' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    COVER LETTER {coverLetter ? '✓' : ''}
                  </button>
                  <button
                    onClick={() => setDocTab('resume')}
                    className={`flex-1 py-1 px-2 rounded-lg transition-colors cursor-pointer text-center ${
                      docTab === 'resume' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    TAILORED RESUME {resume ? '✓' : ''}
                  </button>
                </div>

                {/* Doc Preview Content */}
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200 font-sans leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto custom-scrollbar">
                  {activeDocText || (
                    <span className="text-slate-500 italic font-mono text-xs">
                      No {docTab === 'cover_letter' ? 'cover letter' : 'resume'} generated for this position yet.
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-center space-y-2">
                <p className="text-xs text-slate-400 font-sans">
                  No bespoke resume or cover letter has been generated for this position yet.
                </p>
                {onOpenGenerator && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenGenerator(job);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    <Sparkles size={13} />
                    <span>⚡ Generate Bespoke Application Package</span>
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Notes Section */}
          <section className="space-y-2">
            <div className="flex items-center justify-between text-slate-300 font-bold uppercase tracking-wider text-xs font-mono">
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
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-xl p-4 text-sm min-h-[120px] focus:outline-none focus:border-indigo-500 resize-y custom-scrollbar font-sans"
              />
              <Edit3 size={12} className="absolute top-3 right-3 text-slate-600" />
            </div>
          </section>

          {/* Job Snippet / Description */}
          {job.description && (
            <section className="space-y-2">
              <div className="text-slate-300 font-bold uppercase tracking-wider text-xs flex items-center gap-2 font-mono">
                <Sparkles size={14} className="text-indigo-400" />
                Job Summary
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed max-h-40 overflow-y-auto custom-scrollbar font-sans">
                {job.description}
              </div>
            </section>
          )}

          {/* Stage History */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-300 font-bold uppercase tracking-wider text-xs font-mono">
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
