import React, { useEffect, useState } from 'react';
import { BookmarkPlus, CalendarClock, RefreshCw, ShieldCheck } from 'lucide-react';
import { createReminder, dismissReminder, getJobExplanation, getReminders, getSavedSearches, getSourceHealth, saveSearch } from '../services/careerOperationsService';

export const CareerOperations = ({ jobs = [] }) => {
  const [savedSearches, setSavedSearches] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [sourceHealth, setSourceHealth] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [explanation, setExplanation] = useState(null);
  const [searchName, setSearchName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');

  const refresh = async () => {
    try {
      const [searchResponse, reminderResponse, healthResponse] = await Promise.all([getSavedSearches(), getReminders(), getSourceHealth()]);
      setSavedSearches(searchResponse.saved_searches || []);
      setReminders(reminderResponse.reminders || []);
      setSourceHealth(healthResponse.checks || []);
    } catch (error) {
      setStatus(error.message);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleSaveSearch = async (event) => {
    event.preventDefault();
    if (!searchName.trim() || !keyword.trim()) return;
    try {
      await saveSearch(searchName, { include: keyword.split(',').map((value) => value.trim()).filter(Boolean) });
      setSearchName('');
      setKeyword('');
      setStatus('Search profile saved.');
      refresh();
    } catch (error) {
      setStatus(error.message);
    }
  };

  const handleExplain = async (jobId) => {
    setSelectedJobId(jobId);
    try {
      const response = await getJobExplanation(jobId);
      setExplanation(response.explanation);
      setStatus('');
    } catch (error) {
      setExplanation(null);
      setStatus(error.message);
    }
  };

  const handleFollowUp = async (job) => {
    try {
      const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await createReminder(job.id, 'follow_up', date, { title: job.title, company: job.company });
      setStatus('Follow-up scheduled for one week from today.');
      refresh();
    } catch (error) {
      setStatus(error.message);
    }
  };

  const handleDismiss = async (id) => {
    try {
      await dismissReminder(id);
      refresh();
    } catch (error) {
      setStatus(error.message);
    }
  };

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_1.25fr] font-sans text-slate-100">
      <div className="space-y-5">
        <div className="border border-slate-800 bg-slate-900 p-5 rounded-lg">
          <div className="flex items-center gap-2 text-indigo-300"><BookmarkPlus size={18} /><h2 className="font-black">Saved search profiles</h2></div>
          <form onSubmit={handleSaveSearch} className="mt-4 grid gap-2">
            <input value={searchName} onChange={(event) => setSearchName(event.target.value)} placeholder="Profile name" className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Keywords, comma separated" className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <button className="inline-flex w-fit items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500"><BookmarkPlus size={14} />Save profile</button>
          </form>
          <div className="mt-4 space-y-2">
            {savedSearches.length ? savedSearches.map((search) => <div key={search.id} className="border-t border-slate-800 pt-2 text-sm"><strong>{search.name}</strong><span className="ml-2 text-slate-400">{(search.query?.include || []).join(', ')}</span></div>) : <p className="text-sm text-slate-500">No saved profiles yet.</p>}
          </div>
        </div>
        <div className="border border-slate-800 bg-slate-900 p-5 rounded-lg">
          <div className="flex items-center gap-2 text-amber-300"><CalendarClock size={18} /><h2 className="font-black">Application reminders</h2></div>
          <div className="mt-4 space-y-2">
            {reminders.length ? reminders.map((reminder) => <div key={reminder.id} className="flex items-center justify-between gap-3 border-t border-slate-800 pt-2 text-sm"><div><strong>{reminder.details?.title || reminder.job_id}</strong><span className="ml-2 text-slate-400">{new Date(reminder.remind_at).toLocaleDateString()} · {reminder.reminder_type.replace('_', ' ')}</span></div><button onClick={() => handleDismiss(reminder.id)} className="text-xs font-bold text-slate-400 hover:text-white">Dismiss</button></div>) : <p className="text-sm text-slate-500">No active reminders.</p>}
          </div>
        </div>
        <div className="border border-slate-800 bg-slate-900 p-5 rounded-lg"><h2 className="font-black text-sky-300">Source health</h2><div className="mt-3 space-y-2">{sourceHealth.length ? sourceHealth.slice(0, 6).map((check) => <div key={`${check.component}-${check.timestamp}`} className="text-sm"><strong>{check.component.replace('scraper:', '')}</strong><span className={`ml-2 ${check.status === 'healthy' ? 'text-emerald-300' : 'text-amber-300'}`}>{check.status}</span><span className="ml-2 text-slate-500">{check.details.jobs || 0} jobs</span></div>) : <p className="text-sm text-slate-500">No recorded source runs yet.</p>}</div></div>
      </div>
      <div className="border border-slate-800 bg-slate-900 p-5 rounded-lg">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-emerald-300"><ShieldCheck size={18} /><h2 className="font-black">Fit audit</h2></div><button onClick={refresh} className="p-2 text-slate-400 hover:text-white" title="Refresh career operations"><RefreshCw size={16} /></button></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <select value={selectedJobId} onChange={(event) => handleExplain(event.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="">Select a job</option>{jobs.slice(0, 200).map((job) => <option key={job.id} value={job.id}>{job.title} · {job.company}</option>)}</select>
          {selectedJobId && <button onClick={() => handleFollowUp(jobs.find((job) => job.id === selectedJobId))} className="rounded-md border border-amber-500/50 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/10">Follow up +7d</button>}
        </div>
        {explanation && <div className="mt-5 space-y-4 text-sm"><div><span className="text-3xl font-black text-emerald-300">{explanation.score}%</span><span className="ml-2 font-bold text-slate-300">{explanation.tier}</span></div><div><h3 className="text-xs font-bold uppercase text-slate-500">Strengths</h3><ul className="mt-1 space-y-1 text-slate-300">{explanation.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3 className="text-xs font-bold uppercase text-slate-500">Gaps to verify</h3><ul className="mt-1 space-y-1 text-slate-300">{explanation.gaps.map((item) => <li key={item}>{item}</li>)}</ul></div></div>}
        {status && <p className="mt-4 text-sm text-amber-300">{status}</p>}
      </div>
    </section>
  );
};