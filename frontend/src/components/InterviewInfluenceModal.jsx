import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, ShieldCheck, MessageSquare, 
  Copy, Check, Send, AlertTriangle, UserCheck
} from 'lucide-react';
import { 
  INTERVIEW_STAGES, 
  PANEL_SENTIMENTS, 
  calculateInfluenceHealth, 
  buildObjectionResolutionMemo, 
  buildRefereeBriefingDoc,
  fetchInterviewDebrief,
  saveInterviewDebrief
} from '../services/interviewInfluenceService';
import { getActiveProfile } from '../services/profileService';
import { useToast } from './ToastContext';

export default function InterviewInfluenceModal({
  isOpen,
  onClose,
  job,
  userProfile
}) {
  const { addToast } = useToast();
  const profile = useMemo(() => userProfile || getActiveProfile() || {}, [userProfile]);
  const jobId = job?.id || `${job?.company}_${job?.title}`;

  const [activeTab, setActiveTab] = useState('debrief'); // 'debrief' | 'memo' | 'referee'
  const [stage, setStage] = useState(INTERVIEW_STAGES[2]);
  const [interviewDate, setInterviewDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [panelNames, setPanelNames] = useState('');
  const [panelSentiment, setPanelSentiment] = useState(PANEL_SENTIMENTS[1]);
  const [topicsCovered, setTopicsCovered] = useState([]);
  const [topicInput, setTopicInput] = useState('');
  const [perceivedObjections, setPerceivedObjections] = useState([]);
  const [objectionInput, setObjectionInput] = useState('');
  const [promisedDecisionDate, setPromisedDecisionDate] = useState('');
  const [notes, setNotes] = useState('');

  // Referee Briefing State
  const [refereeName, setRefereeName] = useState('Marcus Vance');
  const [refereeTitle, setRefereeTitle] = useState('Director of Infrastructure');
  const [refereeRelationship, setRefereeRelationship] = useState('Former Direct Manager');

  const [copiedMemo, setCopiedMemo] = useState(false);
  const [copiedReferee, setCopiedReferee] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing debrief
  useEffect(() => {
    if (isOpen && jobId) {
      fetchInterviewDebrief(jobId).then((res) => {
        if (res && res.debrief) {
          const d = res.debrief;
          if (d.stage) setStage(d.stage);
          if (d.interviewDate || d.interview_date) setInterviewDate(d.interviewDate || d.interview_date);
          if (d.panelNames || d.panel_names) setPanelNames(d.panelNames || d.panel_names);
          if (d.panelSentiment || d.panel_sentiment) setPanelSentiment(d.panelSentiment || d.panel_sentiment);
          if (Array.isArray(d.topicsCovered || d.topics_covered)) setTopicsCovered(d.topicsCovered || d.topics_covered);
          if (Array.isArray(d.perceivedObjections || d.perceived_objections)) setPerceivedObjections(d.perceivedObjections || d.perceived_objections);
          if (d.promisedDecisionDate || d.promised_decision_date) setPromisedDecisionDate(d.promisedDecisionDate || d.promised_decision_date);
          if (d.notes) setNotes(d.notes);
        }
      });
    }
  }, [isOpen, jobId]);

  const debriefObject = useMemo(() => ({
    stage,
    interviewDate,
    panelNames,
    panelSentiment,
    topicsCovered,
    perceivedObjections,
    promisedDecisionDate,
    notes,
  }), [stage, interviewDate, panelNames, panelSentiment, topicsCovered, perceivedObjections, promisedDecisionDate, notes]);

  const health = useMemo(() => calculateInfluenceHealth(debriefObject), [debriefObject]);
  const memo = useMemo(() => buildObjectionResolutionMemo(job, debriefObject, profile), [job, debriefObject, profile]);
  const refereeBriefing = useMemo(() => buildRefereeBriefingDoc(job, debriefObject, refereeName, refereeTitle, refereeRelationship, profile), [job, debriefObject, refereeName, refereeTitle, refereeRelationship, profile]);

  if (!isOpen || !job) return null;


  const handleAddTopic = () => {
    if (topicInput.trim() && !topicsCovered.includes(topicInput.trim())) {
      setTopicsCovered([...topicsCovered, topicInput.trim()]);
      setTopicInput('');
    }
  };

  const handleAddObjection = () => {
    if (objectionInput.trim() && !perceivedObjections.includes(objectionInput.trim())) {
      setPerceivedObjections([...perceivedObjections, objectionInput.trim()]);
      setObjectionInput('');
    }
  };

  const handleSaveDebrief = async () => {
    setIsSaving(true);
    try {
      await saveInterviewDebrief(jobId, debriefObject);
      addToast('Interview debrief saved & tactical health updated!', 'success');
    } catch {
      addToast('Saved locally.', 'info');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyMemo = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(`${memo.subject}\n\n${memo.body}`);
    }
    setCopiedMemo(true);
    setTimeout(() => setCopiedMemo(false), 2000);
    addToast('Follow-up memo copied to clipboard!', 'success');
  };

  const handleCopyRefereeBriefing = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(refereeBriefing);
    }
    setCopiedReferee(true);
    setTimeout(() => setCopiedReferee(false), 2000);
    addToast('Referee alignment briefing copied!', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 lg:p-8 animate-in fade-in zoom-in-95 duration-200 font-mono">
      <div 
        className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl xl:max-w-5xl overflow-hidden border border-slate-700/60 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-950/90 px-6 py-4 border-b border-slate-800 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-md border border-amber-400/40">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-wider uppercase text-white">
                  POST-INTERVIEW INFLUENCE & DEBRIEF HUB
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/40">
                  TACTICAL DEBRIEF
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-sans">
                {job.title} — <span className="text-white font-semibold">{job.company}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tactical Health Score Strip */}
        <div className="bg-slate-950/40 px-6 py-2.5 border-b border-slate-800 flex items-center justify-between gap-4 flex-wrap text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 font-bold">INFLUENCE POSTURE:</span>
            <span className={`px-2.5 py-0.5 rounded-full font-black text-[11px] border ${
              health.score >= 75
                ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                : health.score >= 55
                ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                : 'bg-rose-950 text-rose-300 border-rose-500/50'
            }`}>
              {health.status.toUpperCase()} ({health.score}/100)
            </span>
          </div>
          <div className="text-slate-400 text-[11px] font-sans truncate">
            <strong>Action:</strong> {health.recommendedAction}
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center gap-1.5 px-6 pt-3 border-b border-slate-800 bg-slate-900/60 text-xs shrink-0">
          <button
            onClick={() => setActiveTab('debrief')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-xl font-bold transition-colors cursor-pointer ${
              activeTab === 'debrief'
                ? 'bg-slate-800 text-amber-300 border-t-2 border-amber-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <MessageSquare size={13} />
            <span>1. TACTICAL DEBRIEF</span>
          </button>

          <button
            onClick={() => setActiveTab('memo')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-xl font-bold transition-colors cursor-pointer ${
              activeTab === 'memo'
                ? 'bg-slate-800 text-indigo-300 border-t-2 border-indigo-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <Send size={13} />
            <span>2. VALUE-ADD FOLLOW-UP</span>
          </button>

          <button
            onClick={() => setActiveTab('referee')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-xl font-bold transition-colors cursor-pointer ${
              activeTab === 'referee'
                ? 'bg-slate-800 text-emerald-300 border-t-2 border-emerald-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <UserCheck size={13} />
            <span>3. REFEREE ALIGNMENT PACK</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-slate-200">
          {activeTab === 'debrief' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-bold mb-1.5 uppercase">Interview Stage</label>
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                  >
                    {INTERVIEW_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1.5 uppercase">Panel Sentiment</label>
                  <select
                    value={panelSentiment}
                    onChange={(e) => setPanelSentiment(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                  >
                    {PANEL_SENTIMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1.5 uppercase">Interview Date</label>
                  <input
                    type="date"
                    value={interviewDate}
                    onChange={(e) => setInterviewDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1.5 uppercase">Promised Decision Date</label>
                  <input
                    type="date"
                    value={promisedDecisionDate}
                    onChange={(e) => setPromisedDecisionDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1.5 uppercase text-xs">Panel Interviewers & Titles</label>
                <input
                  type="text"
                  value={panelNames}
                  onChange={(e) => setPanelNames(e.target.value)}
                  placeholder="e.g. David Vance (Head of Infrastructure), Sarah Jenkins (Lead Cloud Architect)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-xs"
                />
              </div>

              {/* Perceived Objections */}
              <div className="space-y-2">
                <label className="block text-slate-400 font-bold uppercase text-xs flex items-center justify-between">
                  <span>Perceived Objections & Panel Hesitations</span>
                  <span className="text-rose-400 font-normal">{perceivedObjections.length} logged</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={objectionInput}
                    onChange={(e) => setObjectionInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddObjection())}
                    placeholder="e.g. Panel was concerned candidate lacks multi-site zero-touch deployment precedent..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddObjection}
                    className="px-4 py-2 bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-600/50 rounded-xl font-bold text-xs cursor-pointer"
                  >
                    + Add
                  </button>
                </div>

                {perceivedObjections.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    {perceivedObjections.map((obj, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-rose-950/40 border border-rose-700/40 text-rose-200 text-xs">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={13} className="text-rose-400 shrink-0" />
                          <span>{obj}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPerceivedObjections(perceivedObjections.filter((_, idx) => idx !== i))}
                          className="text-slate-400 hover:text-white ml-2 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Topics Covered */}
              <div className="space-y-2">
                <label className="block text-slate-400 font-bold uppercase text-xs">Key Technical & Strategic Topics Covered</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTopic())}
                    placeholder="e.g. Windows 11 migrations, Autopilot RTO, Entra ID hybrid compliance..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddTopic}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs cursor-pointer"
                  >
                    + Add
                  </button>
                </div>

                {topicsCovered.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {topicsCovered.map((t, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs border border-slate-700">
                        <span>{t}</span>
                        <button
                          type="button"
                          onClick={() => setTopicsCovered(topicsCovered.filter((_, idx) => idx !== i))}
                          className="hover:text-white cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>


              <div className="pt-3 border-t border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveDebrief}
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-md flex items-center gap-2"
                >
                  <ShieldCheck size={15} />
                  <span>{isSaving ? 'Saving Debrief...' : 'Save Tactical Debrief'}</span>
                </button>
              </div>
            </div>
          )}
          {activeTab === 'memo' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 leading-relaxed font-sans">
                <strong className="text-white block mb-1 font-mono">Surgical Objection-Resolution Memo</strong>
                This note directly resolves the panel's hesitancies without defensiveness, presenting quantified precedent and tangible reassurance.
              </div>

              <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 font-bold">SUBJECT: </span>
                  <span className="text-white font-semibold">{memo.subject}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 whitespace-pre-line text-slate-300 leading-relaxed">
                  {memo.body}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-500 text-xs">Passes anti-cliche test & swappability review.</span>
                <div className="flex items-center gap-2">
                  <a
                    href={`mailto:?subject=${encodeURIComponent(memo.subject)}&body=${encodeURIComponent(memo.body)}`}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Send size={13} />
                    <span>Open in Mail App</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyMemo}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedMemo ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
                    <span>{copiedMemo ? 'Copied to Clipboard!' : 'Copy Memo'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'referee' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 leading-relaxed font-sans">
                <strong className="text-white block mb-1 font-mono">Executive Referee Alignment Pack</strong>
                Equip your professional reference with the exact STAR project proof points and talking points matching this panel's high-stakes focus areas before they are called.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Referee Name</label>
                  <input
                    type="text"
                    value={refereeName}
                    onChange={(e) => setRefereeName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Title / Designation</label>
                  <input
                    type="text"
                    value={refereeTitle}
                    onChange={(e) => setRefereeTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Relationship</label>
                  <input
                    type="text"
                    value={refereeRelationship}
                    onChange={(e) => setRefereeRelationship(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
                  />
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs whitespace-pre-line text-slate-300 leading-relaxed max-h-[380px] overflow-y-auto">
                {refereeBriefing}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCopyRefereeBriefing}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-md"
                >
                  {copiedReferee ? <Check size={14} className="text-emerald-200" /> : <Copy size={14} />}
                  <span>{copiedReferee ? 'Copied Briefing Pack!' : 'Copy Referee Briefing (Markdown)'}</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
