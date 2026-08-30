import { MULTI_INDUSTRY_JOBS } from './multiIndustryJobData';
import { buildQueriesFromProfile, triggerProfileScrape, SCRAPER_BASE_URL } from './jobQueryService';

const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const getApiBase = () => {
  return isLocalHost ? '' : (SCRAPER_BASE_URL || '');
};

const getAuthToken = () => {
  try {
    return localStorage.getItem('job_dashboard_auth_token') || '';
  } catch {
    return '';
  }
};

const CANDIDATE_SKILLS = [
  { term: 'system administrator', weight: 15 },
  { term: 'it support', weight: 15 },
  { term: 'azure', weight: 12 },
  { term: 'm365', weight: 12 },
  { term: 'microsoft 365', weight: 12 },
  { term: 'intune', weight: 12 },
  { term: 'network', weight: 10 },
  { term: 'help desk', weight: 10 },
  { term: 'desktop support', weight: 10 },
  { term: 'cloud', weight: 10 },
  { term: 'devops', weight: 10 },
  { term: 'cyber', weight: 10 },
  { term: 'infrastructure', weight: 8 },
  { term: 'windows server', weight: 8 },
  { term: 'linux', weight: 8 },
  { term: 'powershell', weight: 8 },
  { term: 'active directory', weight: 8 }
];

export const calculateCandidateMatchScore = (row) => {
  if (row['score'] !== undefined && row['score'] !== null && row['score'] !== '') {
    const val = Number(row['score']);
    if (!isNaN(val) && val > 0) return Math.round(val);
  }
  
  if (row['audit'] && row['audit']['score']) {
    const val = Number(row['audit']['score']);
    if (!isNaN(val) && val > 0) return Math.round(val);
  }

  // Calculate dynamic keyword match score against Candidate IT Profile
  const text = `${row['Job Title'] || row['title'] || ''} ${row['Company'] || row['company'] || ''} ${row['Notes & Next Steps'] || row['notes'] || row['description'] || ''}`.toLowerCase();
  
  let matchScore = 65;
  CANDIDATE_SKILLS.forEach(skill => {
    if (text.includes(skill.term)) {
      matchScore += skill.weight;
    }
  });

  return Math.min(98, Math.max(55, matchScore));
};

/**
 * Validates whether a URL points to an actual external job listing
 * and NOT to candidate Google Docs, Google Drive, or user profile pages.
 */
export const isJobAdUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) return false;
  if (clean.includes('docs.google.com') || clean.includes('drive.google.com')) return false;
  if (clean.includes('linkedin.com/in/') || clean.includes('samludwig.au') || clean.includes('github.com/ludwixix')) return false;
  return true;
};

/**
 * Resolves a direct job ad URL, extracting from candidate row, notes, or generating a direct SEEK / employer search link.
 */
export const resolveJobAdLink = (rawLink, notesStr = '', company = '', title = '') => {
  if (isJobAdUrl(rawLink)) {
    return rawLink.trim();
  }

  // Extract from notes text if present
  if (notesStr) {
    const matchedUrls = notesStr.match(/https?:\/\/[^\s|)]+/gi) || [];
    for (const u of matchedUrls) {
      if (isJobAdUrl(u)) {
        return u.trim();
      }
    }
  }

  // Fallback: direct targeted SEEK search link for this exact company & position
  const comp = String(company || '').trim();
  const tit = String(title || '').trim();
  if (tit || comp) {
    const query = encodeURIComponent(`${tit} ${comp} Melbourne`.trim());
    return `https://www.seek.com.au/jobs?keywords=${query}`;
  }

  return 'https://www.seek.com.au';
};

export const parseMetadata = (row, index) => {
  const notesStr = row['Notes & Next Steps'] || row['notes'] || row['description'] || row['why'] || '';
  const company = row['Company'] || row['company'] || 'Unknown Company';
  const title = row['Job Title'] || row['title'] || 'Unknown Title';
  
  let salary = row['salary'] || null;
  if (!salary || salary === '') {
    const salaryMatch = notesStr.match(/(?:Salary|Rate):\s*([^|.]+)/i) || notesStr.match(/(\$\d+[\d,.]*(?:–|-|\s*to\s*)\$\d+[\d,.]*(?:\/hr|\s*\+\s*Super|\s*casual)?)/i);
    if (salaryMatch) {
      salary = salaryMatch[1].trim();
    }
  }

  // Parse Cover Letter link / text
  let coverLetterLink = row['coverLetterLink'] || row['cover'] || row['cover_md'] || null;
  let cvLink = row['cvLink'] || row['resumeLink'] || row['resume'] || row['resume_md'] || row['cv'] || row['CV'] || null;

  // Direct Job Ad portal link resolution
  const rawPortal = row['Email / Portal Link'] || row['portalLink'] || row['url'] || row['application_route'] || row['link'] || '';
  const portalLink = resolveJobAdLink(rawPortal, notesStr, company, title);

  // Parse rich audit & score
  const matchScore = calculateCandidateMatchScore(row);
  const location = row['location'] || row['Location'] || 'Melbourne, VIC';
  const stream = row['stream'] || row['industry'] || 'Core IT & Systems';
  const tags = Array.isArray(row['tags']) ? row['tags'] : [];
  const audit = row['audit'] || null;
  const remote = Boolean(row['remote']);
  const status = row['Status'] || row['status'] || 'sourced';

  const rowId = row['id'] || (index !== undefined ? String(index) : `${company}_${title}`);

  return {
    id: String(rowId),
    date: row['Date'] || row['date'] || row['posted'] || new Date().toISOString().split('T')[0],
    company,
    title,
    status,
    source: row['Source'] || row['source'] || 'SEEK',
    emailSubject: row['Email Subject'] || row['emailSubject'] || '',
    portalLink,
    notes: notesStr,
    salary,
    coverLetterLink,
    cvLink,
    resumeText: row['resumeText'] || row['resume_text'] || '',
    coverLetterText: row['coverLetterText'] || row['cover_letter_text'] || '',
    score: matchScore,
    location,
    stream,
    tags,
    audit,
    remote
  };
};

/**
 * Fetch paginated & filterable public jobs from the database API
 */
export const fetchJobsFromApi = async ({
  page = 1,
  pageSize = 50,
  search = '',
  industry = '',
  remote = null,
  sortBy = 'newest'
} = {}) => {
  const apiBase = getApiBase();
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  if (search) params.set('search', search);
  if (industry && industry !== 'All') params.set('industry', industry);
  if (remote !== null && remote !== undefined) params.set('remote', String(remote));
  if (sortBy) params.set('sortBy', sortBy);

  try {
    const res = await fetch(`${apiBase}/api/jobs?${params.toString()}`, {
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.jobs) && data.jobs.length > 0) {
        return {
          jobs: data.jobs.map((item, idx) => parseMetadata(item, item.id || `api_${idx}`)),
          total: data.total || data.jobs.length,
          page: data.page || page,
          pageSize: data.pageSize || pageSize,
          totalPages: data.totalPages || 1
        };
      }
    }
  } catch (err) {
    console.warn("Backend /api/jobs fetch failed, falling back to local static payload:", err);
  }

  // Fallback to demo / static jobs if API is unreachable or returned 0 items
  return fetchDemoFallbackJobs();
};

/**
 * Fetch private application tracking records for the authenticated user
 */
export const fetchUserApplications = async () => {
  let localApps = [];
  try {
    const raw = localStorage.getItem('job_dashboard_local_applications');
    if (raw) {
      const parsed = JSON.parse(raw);
      localApps = Object.values(parsed);
    }
  } catch {}

  const token = getAuthToken();
  if (!token) return localApps;

  const apiBase = getApiBase();
  try {
    const res = await fetch(`${apiBase}/api/applications`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.applications)) {
        const combinedMap = new Map();
        localApps.forEach(a => combinedMap.set(String(a.id || a.job_id), a));
        data.applications.forEach(a => combinedMap.set(String(a.job_id || a.id), a));
        return Array.from(combinedMap.values());
      }
    }
  } catch (err) {
    console.warn("Failed to fetch user applications from backend:", err);
  }
  return localApps;
};

/**
 * Upsert private application tracking status and notes for the authenticated user
 */
export const saveUserApplication = async (jobData) => {
  const targetId = jobData.id || `${jobData.company}_${jobData.title}`;
  
  // 1. Persist locally in localStorage for instant offline / cache recovery
  try {
    const saved = JSON.parse(localStorage.getItem('job_dashboard_local_applications') || '{}');
    saved[targetId] = {
      ...jobData,
      id: targetId,
      updated_at: new Date().toISOString()
    };
    localStorage.setItem('job_dashboard_local_applications', JSON.stringify(saved));
  } catch {}

  // 2. Persist to backend SQLite if authenticated
  const token = getAuthToken();
  if (!token) return;

  const apiBase = getApiBase();
  try {
    await fetch(`${apiBase}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        job_id: targetId,
        status: jobData.status || 'sourced',
        notes: jobData.notes || '',
        resume_text: jobData.resumeText || jobData.resume_text || '',
        cover_letter_text: jobData.coverLetterText || jobData.cover_letter_text || '',
        applied_at: jobData.applied_at || jobData.date || null,
        company: jobData.company || '',
        title: jobData.title || '',
        location: jobData.location || '',
        source: jobData.source || '',
        salary: jobData.salary || '',
        portalLink: jobData.portalLink || jobData.link || jobData.url || '',
        job_data: jobData
      })
    });
  } catch (e) {
    console.warn('Failed to persist user application to SQLite:', e);
  }
};

const fetchDemoFallbackJobs = async () => {
  const fallbackPaths = [
    `${import.meta.env.BASE_URL || '/'}data/scraped_jobs.json`,
    `${import.meta.env.BASE_URL || '/'}demo_jobs.json`,
    './demo_jobs.json'
  ];


  for (const path of fallbackPaths) {
    try {
      const res = await fetch(path);
      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data) ? data : (data.jobs || []);
        if (rawList.length > 0) {
          const parsed = rawList.map((row, index) => parseMetadata(row, row.id || `db_${index}`));
          return {
            jobs: parsed,
            total: parsed.length,
            page: 1,
            pageSize: parsed.length,
            totalPages: 1
          };
        }
      }
    } catch {}
  }

  return {
    jobs: (MULTI_INDUSTRY_JOBS || []).map((row, index) => parseMetadata(row, `mi_${index}`)),
    total: (MULTI_INDUSTRY_JOBS || []).length,
    page: 1,
    pageSize: (MULTI_INDUSTRY_JOBS || []).length,
    totalPages: 1
  };
};

/**
 * Main fetch function for populating the active dashboard state.
 * Queries /api/jobs (or cached jobs) and merges user-scoped applications.
 */
export const fetchJobsData = async () => {
  const [apiJobsResult, userApps] = await Promise.all([
    fetchJobsFromApi({ page: 1, pageSize: 5000 }),
    fetchUserApplications()
  ]);

  const userAppsMap = new Map();
  userApps.forEach(app => {
    userAppsMap.set(String(app.job_id || app.id), app);
    if (app.company && app.title) {
      userAppsMap.set(`${app.company}_${app.title}`, app);
    }
  });

  const mergedJobs = apiJobsResult.jobs.map(job => {
    const userApp = userAppsMap.get(String(job.id)) || userAppsMap.get(`${job.company}_${job.title}`);
    if (userApp) {
      userAppsMap.delete(String(job.id));
      userAppsMap.delete(String(userApp.job_id || userApp.id));
      userAppsMap.delete(`${job.company}_${job.title}`);
      return {
        ...job,
        status: userApp.status || job.status,
        notes: userApp.notes || job.notes,
        applied_at: userApp.applied_at || job.applied_at,
        hasCustomDocs: Boolean(userApp.resume_text || userApp.cover_letter_text || job.hasCustomDocs)
      };
    }
    return job;
  });

  const remainingApps = [];
  const seenIds = new Set(mergedJobs.map(j => String(j.id)));

  userAppsMap.forEach((userApp, key) => {
    const id = String(userApp.job_id || userApp.id || key);
    if (seenIds.has(id)) return;
    seenIds.add(id);
    const comp = userApp.company || 'Applied Employer';
    const tit = userApp.title || 'Applied Role';
    remainingApps.push(parseMetadata({
      id: id,
      company: comp,
      title: tit,
      status: userApp.status || 'Applied / In Review',
      notes: userApp.notes || '',
      applied_at: userApp.applied_at || new Date().toISOString(),
      location: userApp.location || 'Melbourne, VIC',
      source: 'User Application',
      score: 90,
      tags: ['Tracked Application', userApp.status || 'Applied / In Review']
    }, id));
  });

  return [...remainingApps, ...mergedJobs];
};

/**
 * Triggers scraper run on backend for given search queries
 */
export const triggerLiveScrape = async (queries = []) => {
  const apiBase = getApiBase();
  try {
    const res = await fetch(`${apiBase}/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries })
    });
    if (res.ok) {
      const data = await res.json();
      return { liveScraped: true, queriesUsed: queries, cacheStats: data };
    }
  } catch (err) {
    console.warn('Scraper API trigger error:', err);
  }
  return { liveScraped: false, queriesUsed: queries, cacheStats: null };
};

/**
 * Fetches jobs for active profile using custom queries
 */
export const fetchJobsForProfile = async (targetProfile) => {
  const queries = targetProfile?.searchQueries || targetProfile?.keywords || ['IT Support', 'Systems Administrator'];
  return triggerLiveScrape(queries);
};

