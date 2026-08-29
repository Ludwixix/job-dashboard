import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchJobsData } from '../services/dataService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LS_REJECTED  = 'rejectedJobIds';
const LS_OVERRIDES = 'jobOverrides'; // { [jobKey]: { status, notes, ... } }

const readLS = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeLS = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
};

const jobKey = (j) => j.id ? String(j.id) : `${j.company}_${j.title}`;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useJobs = () => {
  const [rawJobs, setRawJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');

  // Persisted: rejected IDs
  const [rejectedIds, setRejectedIds] = useState(() => readLS(LS_REJECTED, []));
  useEffect(() => { writeLS(LS_REJECTED, rejectedIds); }, [rejectedIds]);

  // Persisted: per-job field overrides (status, notes, applied date, etc.)
  const [overrides, setOverrides] = useState(() => readLS(LS_OVERRIDES, {}));
  useEffect(() => { writeLS(LS_OVERRIDES, overrides); }, [overrides]);

  // ── Load remote data ──────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchJobsData();
      setRawJobs(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load job data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    loadData().finally(() => { if (!mounted) return; });
    return () => { mounted = false; };
  }, [loadData]);

  const refetch = loadData;

  // ── Merge overrides + rejection flags on top of remote data ───────────────
  const enrichedJobs = useMemo(() => {
    return rawJobs.map(j => {
      const key   = jobKey(j);
      const patch = overrides[key] || {};
      const merged = { ...j, ...patch };
      const isRejected =
        rejectedIds.includes(String(j.id)) ||
        rejectedIds.includes(`${j.company}_${j.title}`) ||
        (merged.status || '').toLowerCase().includes('rejected') ||
        (merged.status || '').toLowerCase().includes('dismissed');
      return { ...merged, isRejected };
    });
  }, [rawJobs, overrides, rejectedIds]);

  // ── Mutation helpers ──────────────────────────────────────────────────────

  /** Persist a status change + optional extra fields for a job. Survives page refresh. */
  const updateJobStatus = useCallback((targetJobIdentifier, newStatus, extraData = {}) => {
    setOverrides(prev => {
      const next  = { ...prev };
      const match = rawJobs.find(j =>
        (j.id && String(j.id) === String(targetJobIdentifier)) ||
        `${j.company}_${j.title}` === targetJobIdentifier ||
        j.title === targetJobIdentifier
      );
      const key  = match ? jobKey(match) : String(targetJobIdentifier);
      next[key]  = { ...(prev[key] || {}), status: newStatus, ...extraData };
      return next;
    });
  }, [rawJobs]);

  /** Persist a notes/description edit for a job. */
  const updateJobNotes = useCallback((targetJobIdentifier, notes) => {
    setOverrides(prev => {
      const next  = { ...prev };
      const match = rawJobs.find(j =>
        (j.id && String(j.id) === String(targetJobIdentifier)) ||
        `${j.company}_${j.title}` === targetJobIdentifier
      );
      const key  = match ? jobKey(match) : String(targetJobIdentifier);
      next[key]  = { ...(prev[key] || {}), notes };
      return next;
    });
  }, [rawJobs]);

  const rejectJob = useCallback((targetJobIdentifier) => {
    setRejectedIds(prev => {
      const strId = String(targetJobIdentifier);
      return prev.includes(strId) ? prev : [...prev, strId];
    });
    updateJobStatus(targetJobIdentifier, 'Rejected / Dismissed');
  }, [updateJobStatus]);

  const unrejectJob = useCallback((targetJobIdentifier) => {
    setRejectedIds(prev => prev.filter(id => id !== String(targetJobIdentifier)));
    // Remove the status override so the job reverts to its original status
    setOverrides(prev => {
      const next  = { ...prev };
      const match = rawJobs.find(j =>
        (j.id && String(j.id) === String(targetJobIdentifier)) ||
        `${j.company}_${j.title}` === targetJobIdentifier
      );
      const key = match ? jobKey(match) : String(targetJobIdentifier);
      if (next[key]) {
        const { status: _s, ...rest } = next[key];
        if (Object.keys(rest).length === 0) {
          delete next[key];
        } else {
          next[key] = rest;
        }
      }
      return next;
    });
  }, [rawJobs]);

  // ── Filtered view for ApplicationTracker ─────────────────────────────────
  const filteredJobs = useMemo(() => {
    return enrichedJobs.filter(job => {
      const matchesSearch =
        job.company.toLowerCase().includes(search.toLowerCase()) ||
        job.title.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'All' || job.status === statusFilter;
      const matchesSource = sourceFilter === 'All' || job.source === sourceFilter;
      return matchesSearch && matchesStatus && matchesSource;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [enrichedJobs, search, statusFilter, sourceFilter]);

  const statuses = useMemo(() => {
    const s = new Set(enrichedJobs.map(j => j.status).filter(Boolean));
    return ['All', ...Array.from(s)];
  }, [enrichedJobs]);

  const sources = useMemo(() => {
    const s = new Set(enrichedJobs.map(j => j.source).filter(Boolean));
    return ['All', ...Array.from(s)];
  }, [enrichedJobs]);

  return {
    jobs: filteredJobs,
    allRawJobs: enrichedJobs,
    rejectedIds,
    rejectJob,
    unrejectJob,
    loading,
    error,
    refetch,
    updateJobStatus,
    updateJobNotes,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sourceFilter,
    setSourceFilter,
    statuses,
    sources,
  };
};
