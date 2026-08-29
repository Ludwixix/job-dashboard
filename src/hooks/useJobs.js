import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchJobsData } from '../services/dataService';

export const useJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');

  const [rejectedIds, setRejectedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('rejectedJobIds');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('rejectedJobIds', JSON.stringify(rejectedIds));
  }, [rejectedIds]);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchJobsData();
        if (mounted) {
          setJobs(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          console.error("Error fetching data:", err);
          setError(err.message || "Failed to load job data");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    loadData();
    return () => { mounted = false; };
  }, []);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchJobsData();
      setJobs(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to load job data");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateJobStatus = useCallback((targetJobIdentifier, newStatus, extraData = {}) => {
    setJobs(prevJobs => {
      return prevJobs.map(j => {
        const matchesId = j.id && String(j.id) === String(targetJobIdentifier);
        const matchesKey = `${j.company}_${j.title}` === targetJobIdentifier;
        const matchesTitle = j.title === targetJobIdentifier;

        if (matchesId || matchesKey || matchesTitle) {
          return {
            ...j,
            status: newStatus,
            date: new Date().toISOString().split('T')[0],
            ...extraData
          };
        }
        return j;
      });
    });
  }, []);

  const rejectJob = useCallback((targetJobIdentifier) => {
    setRejectedIds(prev => {
      const strId = String(targetJobIdentifier);
      if (!prev.includes(strId)) return [...prev, strId];
      return prev;
    });
    updateJobStatus(targetJobIdentifier, 'Rejected / Dismissed');
  }, [updateJobStatus]);

  const unrejectJob = useCallback((targetJobIdentifier) => {
    setRejectedIds(prev => prev.filter(id => id !== String(targetJobIdentifier)));
    updateJobStatus(targetJobIdentifier, 'Discovered');
  }, [updateJobStatus]);

  const enrichedJobs = useMemo(() => {
    return jobs.map(j => {
      const identifier = j.id || `${j.company}_${j.title}`;
      const isRejected = rejectedIds.includes(String(j.id)) || 
                         rejectedIds.includes(`${j.company}_${j.title}`) || 
                         (j.status || '').toLowerCase().includes('rejected') ||
                         (j.status || '').toLowerCase().includes('dismissed');
      return {
        ...j,
        isRejected
      };
    });
  }, [jobs, rejectedIds]);

  const filteredJobs = useMemo(() => {
    return enrichedJobs.filter(job => {
      const matchesSearch = job.company.toLowerCase().includes(search.toLowerCase()) || 
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
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sourceFilter,
    setSourceFilter,
    statuses,
    sources
  };
};
