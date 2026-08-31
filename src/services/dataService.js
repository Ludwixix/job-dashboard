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

/**
 * Normalizes company and title into a robust deduplication key
 */
export const normalizeJobKey = (company = '', title = '') => {
  const c = String(company || '').toLowerCase().replace(/\b(pty|ltd|limited|inc|corporation|corp|australia|group|services|technologies|solutions|holdings)\b/g, '').replace(/[^a-z0-9]/g, '');
  const t = String(title || '').toLowerCase().replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '').replace(/\b(immediate start|urgent|urgent:?|contract|permanent|full time|part time|temp|hybrid|remote)\b/g, '').replace(/[^a-z0-9]/g, '');
  return `${c}__${t}`;
};

/**
 * Cleans and un-mangles job descriptions from HTML, email alerts, or encoded strings
 */
export const cleanDescriptionText = (raw = '') => {
  if (!raw || typeof raw !== 'string') return '';
  
  // 1. Remove style, script, head, comment tags completely
  let text = raw.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
                .replace(/<!--[\s\S]*?-->/g, '');

  // 2. Remove email headers, MIME boundaries and footers
  text = text.replace(/^[\s\S]*?Content-Type:\s*text\/html[\s\S]*?\n\n/gi, '')
             .replace(/^[\s\S]*?boundary=[\s\S]*?\n\n/gi, '')
             .replace(/(?:unsubscribe|view this job on seek|manage alerts|email preference|terms of service)[\s\S]*?$/gi, '');

  // 3. Format breaks and lists
  text = text.replace(/<\s*(?:br\s*\/?|p|div|section|article|h[1-6]|ul|ol|tr)\b[^>]*>/gi, '\n\n')
             .replace(/<\s*li\b[^>]*>/gi, '\n• ')
             .replace(/<\s*\/\s*(?:p|div|section|article|h[1-6]|ul|ol|li|tr|table)\s*>/gi, '\n')
             .replace(/<[^>]+>/g, '');

  // 4. Decode HTML entities thoroughly
  text = text.replace(/&nbsp;/gi, ' ')
             .replace(/&amp;/gi, '&')
             .replace(/&quot;/gi, '"')
             .replace(/&#39;/gi, "'")
             .replace(/&lt;/gi, '<')
             .replace(/&gt;/gi, '>')
             .replace(/\\n/g, '\n')
             .replace(/\\"/g, '"');

  // 5. Clean excess whitespace and lines
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const cleanLines = [];
  for (const line of lines) {
    if (/^[-=_*~]{4,}$/.test(line)) continue;
    cleanLines.push(line);
  }

  return cleanLines.join('\n\n').trim();
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

  // Calculate dynamic keyword match score against Candidate Profile
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
 * Resolves a direct job ad URL
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
  const rawNotes = row['Notes & Next Steps'] || row['notes'] || row['description'] || row['why'] || '';
  const notesStr = cleanDescriptionText(rawNotes);
  const company = String(row['Company'] || row['company'] || 'Unknown Company').trim();
  const title = String(row['Job Title'] || row['title'] || 'Unknown Title').trim();
  
  let salary = row['salary'] || null;
  if (!salary || salary === '') {
    const salaryMatch = rawNotes.match(/(?:Salary|Rate):\s*([^|.]+)/i) || rawNotes.match(/(\$\d+[\d,.]*(?:–|-|\s*to\s*)\$\d+[\d,.]*(?:\/hr|\s*\+\s*Super|\s*casual)?)/i);
    if (salaryMatch) {
      salary = salaryMatch[1].trim();
    }
  }

  // Parse Cover Letter link / text
  let coverLetterLink = row['coverLetterLink'] || row['cover'] || row['cover_md'] || null;
  let cvLink = row['cvLink'] || row['resumeLink'] || row['resume'] || row['resume_md'] || row['cv'] || row['CV'] || null;

  // Direct Job Ad portal link resolution
  const rawPortal = row['Email / Portal Link'] || row['portalLink'] || row['url'] || row['application_route'] || row['link'] || '';
  const portalLink = resolveJobAdLink(rawPortal, rawNotes, company, title);

  // Parse rich audit & score
  const matchScore = calculateCandidateMatchScore(row);
  const location = String(row['location'] || row['Location'] || 'Melbourne, VIC').trim();
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
    description: notesStr,
    salary,
    coverLetterLink,
    cvLink,
    resumeText: row['resumeText'] || row['resume_text'] || '',
    coverLetterText: row['coverLetterText'] || row['cover_letter_text'] || '',
    psychologyInsights: row['psychologyInsights'] || row['psychology_insights'] || null,
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

  return fetchDemoFallbackJobs();
};

/**
 * Synchronous local retrieval of user applications cache
 */
export const getLocalUserApplications = () => {
  try {
    const raw = localStorage.getItem('job_dashboard_local_applications');
    if (raw) {
      const parsed = JSON.parse(raw);
      return Object.values(parsed);
    }
  } catch {}
  return [];
};

/**
 * Fetch application statuses submitted/tracked by the user
 */
export const fetchUserApplications = async () => {
  let localApps = getLocalUserApplications();

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
        psychology_insights: jobData.psychologyInsights || null,
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
        const raw = await res.json();
        const arrayData = Array.isArray(raw) ? raw : (raw.jobs || []);
        if (arrayData.length > 0) {
          return {
            jobs: arrayData.map((row, index) => parseMetadata(row, index)),
            total: arrayData.length,
            page: 1,
            pageSize: arrayData.length,
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
 * Queries /api/jobs (or cached jobs), deduplicates them cleanly, and merges user-scoped applications.
 */
export const fetchJobsData = async () => {
  const [apiJobsResult, userApps] = await Promise.all([
    fetchJobsFromApi({ page: 1, pageSize: 5000 }),
    fetchUserApplications()
  ]);

  // Index user applications by exact ID, direct company_title, and normalized company_title
  const userAppsMap = new Map();
  userApps.forEach(app => {
    const rawId = String(app.job_id || app.id || '');
    if (rawId) userAppsMap.set(rawId, app);
    if (app.company && app.title) {
      userAppsMap.set(`${app.company}_${app.title}`, app);
      userAppsMap.set(normalizeJobKey(app.company, app.title), app);
    }
  });

  // Client-side deduplication & application reconciliation
  const seenUrls = new Set();
  const seenNormKeys = new Set();
  const deduplicatedJobs = [];

  for (const rawJob of (apiJobsResult.jobs || [])) {
    const job = { ...rawJob };
    const rawUrl = String(job.portalLink || job.link || job.url || '').split('?')[0].split('#')[0].trim();
    const normKey = normalizeJobKey(job.company, job.title);

    // Skip true duplicates
    if (rawUrl && seenUrls.has(rawUrl)) continue;
    if (normKey && normKey !== '__' && seenNormKeys.has(normKey)) continue;

    if (rawUrl) seenUrls.add(rawUrl);
    if (normKey && normKey !== '__') seenNormKeys.add(normKey);

    // Check if user has an active application or customization for this job
    const userApp = userAppsMap.get(String(job.id)) || 
                    userAppsMap.get(`${job.company}_${job.title}`) || 
                    userAppsMap.get(normKey);

    if (userApp) {
      job.status = userApp.status || job.status;
      job.notes = userApp.notes || job.notes;
      job.applied_at = userApp.applied_at || job.applied_at;
      job.hasCustomDocs = Boolean(userApp.resume_text || userApp.cover_letter_text || userApp.hasCustomDocs || job.hasCustomDocs);
      job.resumeText = userApp.resume_text || userApp.resumeText || job.resumeText;
      job.coverLetterText = userApp.cover_letter_text || userApp.coverLetterText || job.coverLetterText;
      job.psychologyInsights = userApp.psychology_insights || userApp.psychologyInsights || job.psychologyInsights;
    }

    deduplicatedJobs.push(job);
  }

  // Ensure any tracked user applications not present in the public feed are appended
  const seenIds = new Set(deduplicatedJobs.map(j => String(j.id)));
  const remainingApps = [];

  userApps.forEach(userApp => {
    const id = String(userApp.job_id || userApp.id || `${userApp.company}_${userApp.title}`);
    const normKey = normalizeJobKey(userApp.company, userApp.title);
    if (seenIds.has(id) || seenNormKeys.has(normKey)) return;
    
    seenIds.add(id);
    if (normKey && normKey !== '__') seenNormKeys.add(normKey);

    remainingApps.push(parseMetadata({
      id: id,
      company: userApp.company || 'Applied Employer',
      title: userApp.title || 'Applied Role',
      status: userApp.status || 'Applied / In Review',
      notes: userApp.notes || '',
      applied_at: userApp.applied_at || new Date().toISOString(),
      location: userApp.location || 'Melbourne, VIC',
      source: 'User Application',
      resumeText: userApp.resume_text || userApp.resumeText || '',
      coverLetterText: userApp.cover_letter_text || userApp.coverLetterText || '',
      psychologyInsights: userApp.psychology_insights || userApp.psychologyInsights || null
    }));
  });

  return [...deduplicatedJobs, ...remainingApps];
};


/**
 * Backward compatibility alias for profile-targeted job fetching
 */
export const fetchJobsForProfile = async (profile) => {
  return fetchJobsData();
};
