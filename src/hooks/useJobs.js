import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchJobsData, saveUserApplication, normalizeJobKey } from '../services/dataService';

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

  // ── Merge overrides + non-responsive policy + rejection flags ──────────────
  const [currentTime] = useState(() => Date.now());

  const enrichedJobs = useMemo(() => {
    const now = currentTime;

    return rawJobs.map(j => {
      const key   = jobKey(j);
      const altKey = `${j.company}_${j.title}`;
      const normKey = normalizeJobKey(j.company, j.title);

      const patch = overrides[key] || overrides[altKey] || (normKey !== '__' ? overrides[normKey] : null) || {};
      const merged = { ...j, ...patch };

      let status = merged.status || 'sourced';
      const statusLower = status.toLowerCase();

      // Non-responsive employer auto-closing rule:
      // If applied >= 14 days ago and no subsequent status update (e.g. interview/offer), auto-close.
      const isApplied = statusLower.includes('applied') || statusLower.includes('submitted');
      const isInterviewOrOffer = statusLower.includes('interview') || 
                                 statusLower.includes('offer') || 
                                 statusLower.includes('unsuccessful') || 
                                 statusLower.includes('closed') ||
                                 statusLower.includes('non-responsive');

      let isNonResponsive = false;
      if (isApplied && !isInterviewOrOffer && merged.date) {
        try {
          const appliedDate = new Date(merged.date);
          const diffDays = Math.floor((now - appliedDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays >= 14) {
            status = 'Non-Responsive Employer (Closed)';
            isNonResponsive = true;
          }
        } catch {
          // ignore date parse errors
        }
      }

      const isRejected =
        rejectedIds.includes(String(j.id)) ||
        rejectedIds.includes(altKey) ||
        (normKey !== '__' && rejectedIds.includes(normKey)) ||
        statusLower.includes('rejected') ||
        statusLower.includes('dismissed');

      const isClosed = isNonResponsive || statusLower.includes('closed') || statusLower.includes('unsuccessful');

      return { 
        ...merged, 
        status, 
        isRejected,
        isNonResponsive,
        isClosed 
      };
    });
  }, [rawJobs, overrides, rejectedIds, currentTime]);

  // ── Mutation helpers ──────────────────────────────────────────────────────

  /** Persist a status change + optional extra fields for a job. Survives page refresh. */
  const updateJobStatus = useCallback((targetJobIdentifier, newStatus, extraData = {}) => {
    let resolvedStatus = typeof newStatus === 'string' ? newStatus : undefined;
    let resolvedExtra = typeof newStatus === 'object' && newStatus !== null ? { ...newStatus, ...extraData } : { ...extraData };

    if (typeof targetJobIdentifier === 'object' && targetJobIdentifier !== null) {
      resolvedExtra = { ...targetJobIdentifier, ...resolvedExtra };
      if (!resolvedStatus && targetJobIdentifier.status) {
        resolvedStatus = targetJobIdentifier.status;
      }
    }

    const targetStr = typeof targetJobIdentifier === 'object' && targetJobIdentifier !== null
      ? (targetJobIdentifier.id || `${targetJobIdentifier.company}_${targetJobIdentifier.title}`)
      : String(targetJobIdentifier || '');

    const targetObj = typeof targetJobIdentifier === 'object' && targetJobIdentifier !== null
      ? targetJobIdentifier
      : null;

    const matchedJob = targetObj || rawJobs.find(j =>
      (j.id && String(j.id) === targetStr) ||
      `${j.company}_${j.title}` === targetStr ||
      (j.company && j.title && normalizeJobKey(j.company, j.title) === normalizeJobKey(resolvedExtra.company, resolvedExtra.title))
    );

    const key = matchedJob ? jobKey(matchedJob) : targetStr;
    const altKey = matchedJob ? `${matchedJob.company}_${matchedJob.title}` : targetStr;
    const normKey = matchedJob ? normalizeJobKey(matchedJob.company, matchedJob.title) : normalizeJobKey(resolvedExtra.company, resolvedExtra.title);

    const patch = { ...(resolvedStatus ? { status: resolvedStatus } : {}), ...resolvedExtra };

    setOverrides(prev => {
      const next = { ...prev };
      next[key] = { ...(prev[key] || {}), ...patch };
      if (altKey) next[altKey] = { ...(prev[altKey] || {}), ...patch };
      if (normKey && normKey !== '__') next[normKey] = { ...(prev[normKey] || {}), ...patch };
      return next;
    });

    const jobObj = matchedJob
      ? { ...matchedJob, ...patch }
      : {
          id: targetStr,
          company: resolvedExtra.company || (targetStr.includes('_') ? targetStr.split('_')[0] : 'Direct Employer'),
          title: resolvedExtra.title || (targetStr.includes('_') ? targetStr.split('_')[1] : 'Direct Position'),
          date: resolvedExtra.date || new Date().toISOString().split('T')[0],
          applied_at: resolvedExtra.applied_at || (resolvedStatus && resolvedStatus.toLowerCase().includes('applied') ? new Date().toISOString().split('T')[0] : null),
          status: resolvedStatus || resolvedExtra.status || 'Applied / In Review',
          ...resolvedExtra
        };

    saveUserApplication(jobObj);
  }, [rawJobs]);

  /** Update user notes for a specific job */
  const updateJobNotes = useCallback((targetJobIdentifier, notes) => {
    updateJobStatus(targetJobIdentifier, undefined, { notes });
  }, [updateJobStatus]);

  /** Reject / dismiss a job */
  const rejectJob = useCallback((targetJobIdentifier) => {
    const strId = String(targetJobIdentifier);
    setRejectedIds(prev => prev.includes(strId) ? prev : [...prev, strId]);
    updateJobStatus(targetJobIdentifier, 'Rejected / Dismissed');
  }, [updateJobStatus]);

  const unrejectJob = useCallback((targetJobIdentifier) => {
    const strId = String(targetJobIdentifier);
    setRejectedIds(prev => prev.filter(id => id !== strId));
    setOverrides(prev => {
      const next  = { ...prev };
      const match = rawJobs.find(j =>
        (j.id && String(j.id) === strId) ||
        `${j.company}_${j.title}` === strId
      );
      const key = match ? jobKey(match) : strId;
      const altKey = match ? `${match.company}_${match.title}` : strId;
      const normKey = match ? normalizeJobKey(match.company, match.title) : '';

      delete next[key];
      delete next[altKey];
      if (normKey) delete next[normKey];

      return next;
    });
  }, [rawJobs]);

  /** Batch closes all applied jobs that have had no updates for >= 14 days */
  const closeNonResponsiveJobs = useCallback(() => {
    setOverrides(prev => {
      const next = { ...prev };
      enrichedJobs.forEach(job => {
        if (job.isNonResponsive) {
          const key = jobKey(job);
          next[key] = { ...(prev[key] || {}), status: 'Non-Responsive Employer (Closed)' };
        }
      });
      return next;
    });
  }, [enrichedJobs]);

  // ── Filtered view for ApplicationTracker ─────────────────────────────────
  const filteredJobs = useMemo(() => {
    return enrichedJobs.filter(job => {
      const matchesSearch =
        (job.company || '').toLowerCase().includes(search.toLowerCase()) ||
        (job.title || '').toLowerCase().includes(search.toLowerCase());
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
    closeNonResponsiveJobs,
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

