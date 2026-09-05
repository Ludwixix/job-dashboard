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
 * Sanitizes job URLs by stripping tracking parameters (UTM, click IDs) while
 * preserving essential identity parameters such as Indeed's '?jk=' query key.
 */
export const cleanJobUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let s = rawUrl.trim().split('#')[0];
  if (s.includes('?')) {
    const [base, qs] = s.split('?', 2);
    const trackingParams = new Set([
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'ref', 'source', 'spm', 'from', 'xptdk',
      'cmpid', 'fromage', 'pub', 'vsk'
    ]);
    const kept = qs.split('&').filter(kv => {
      if (!kv) return false;
      const paramName = kv.split('=')[0].toLowerCase();
      return !trackingParams.has(paramName);
    });
    s = kept.length > 0 ? `${base}?${kept.join('&')}` : base;
  }
  return s.replace(/\/+$/, '');
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

/**
 * Extracts structured sections (responsibilities, requirements, benefits, employment type, work arrangement) from raw description
 */
export const extractStructuredJobSections = (text = '') => {
  if (!text || typeof text !== 'string') {
    return {
      responsibilities: [],
      requirements: [],
      benefits: [],
      employmentType: 'Full-time',
      workArrangement: 'Hybrid'
    };
  }

  const clean = text;
  
  // 1. Employment Type
  let employmentType = 'Full-time';
  if (/part[\s-]?time/i.test(clean)) employmentType = 'Part-time';
  else if (/contract(?:or)?|temp(?:orary)?|fixed[\s-]?term/i.test(clean)) employmentType = 'Contract / Temp';
  else if (/casual/i.test(clean)) employmentType = 'Casual';
  else if (/permanent/i.test(clean)) employmentType = 'Permanent';

  // 2. Work Arrangement
  let workArrangement = 'Hybrid';
  if (/\b(?:remote|work from home|wfh|100% remote|anywhere in australia)\b/i.test(clean)) workArrangement = 'Remote';
  else if (/\b(?:on[\s-]?site|in[\s-]?office|client site|depot)\b/i.test(clean)) workArrangement = 'On-site';
  else if (/\b(?:hybrid|flexible work)\b/i.test(clean)) workArrangement = 'Hybrid';

  // 3. Extract bullets by sections
  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
  const responsibilities = [];
  const requirements = [];
  const benefits = [];

  let currentSection = null; // 'resp' | 'req' | 'ben'

  for (const line of lines) {
    const lLower = line.toLowerCase();

    // Section headers detection
    if (/^(?:key\s+)?(?:responsibilities|duties|what you('ll| will) do|role overview|the opportunity|about the role|in this role)[:\s]*$/i.test(line) ||
        /(?:key responsibilities|what you'll do|duties and responsibilities):/i.test(line)) {
      currentSection = 'resp';
      continue;
    } else if (/^(?:requirements|about you|qualifications|skills\s*(?:&|and)\s*experience|what you('ll| will) bring|key selection criteria)[:\s]*$/i.test(line) ||
               /(?:skills and experience|what you'll bring|requirements):/i.test(line)) {
      currentSection = 'req';
      continue;
    } else if (/^(?:benefits|what we offer|perks|why join us|our culture|employee benefits)[:\s]*$/i.test(line) ||
               /(?:what we offer|benefits and perks|why you'll love working here):/i.test(line)) {
      currentSection = 'ben';
      continue;
    }

    // Capture bullet points
    if (/^[-•*▪▫►→✔✓]/.test(line) || /^\d+\.\s+/.test(line)) {
      const bulletText = line.replace(/^[-•*▪▫►→✔✓\d.]+\s*/, '').trim();
      if (bulletText.length > 5) {
        if (currentSection === 'resp' && responsibilities.length < 6) {
          responsibilities.push(bulletText);
        } else if (currentSection === 'req' && requirements.length < 6) {
          requirements.push(bulletText);
        } else if (currentSection === 'ben' && benefits.length < 6) {
          benefits.push(bulletText);
        }
      }
    }
  }

  return {
    responsibilities,
    requirements,
    benefits,
    employmentType,
    workArrangement
  };
};

/**
 * Evaluates whether a scraped job ad has all required data for complete presentation
 */
export const evaluateJobCompleteness = (job) => {
  const missing = [];

  const company = String(job.company || '').trim().toLowerCase();
  if (!company || company === 'unknown' || company === 'undefined' || company === 'null' || company === 'gmail' || company === 'direct employer') {
    missing.push('Company Name');
  }

  const title = String(job.title || '').trim().toLowerCase();
  if (!title || title === 'unknown' || title === 'undefined' || title.length < 3 || title.startsWith('exploring a new opportunity') || title.includes('application was sent to')) {
    missing.push('Job Title');
  }

  const url = String(job.portalLink || job.link || job.url || '').trim();
  if (!url || !url.startsWith('http')) {
    missing.push('Application Link');
  }

  const desc = String(job.description || job.notes || '').trim();
  if (!desc || (desc.length < 25 && (!url || !title))) {
    missing.push('Job Description');
  }

  return {
    isComplete: missing.length === 0,
    missingFields: missing
  };
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

  // Extract structured sections
  const structured = extractStructuredJobSections(notesStr);

  const cleanDate = (val) => {
    if (!val || typeof val !== 'string') return '';
    const trimmed = val.trim();
    if (trimmed === 'None' || trimmed === 'none' || trimmed === 'null' || trimmed === 'undefined') return '';
    return trimmed;
  };

  const rawDate = cleanDate(row['Date']) || cleanDate(row['date']) || cleanDate(row['posted']) || cleanDate(row['raw_posted']) || '';

  const jobObject = {
    id: String(rowId),
    // Never manufacture today's date: a missing provider date must remain
    // unknown so it cannot appear as a freshly posted job.
    date: rawDate,
    company,
    title,
    status,
    source: row['Source'] || row['source'] || 'SEEK',
    emailSubject: row['Email Subject'] || row['emailSubject'] || '',
    portalLink,
    notes: notesStr,
    description: notesStr,
    salary: salary || row['salary'] || 'Market Competitive Salary',
    employmentType: row['employmentType'] || structured.employmentType,
    workArrangement: row['workArrangement'] || structured.workArrangement,
    keyResponsibilities: row['keyResponsibilities'] || structured.responsibilities,
    requirements: row['requirements'] || structured.requirements,
    benefits: row['benefits'] || structured.benefits,
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

  // Evaluate data completeness
  const completeness = evaluateJobCompleteness(jobObject);
  jobObject.isComplete = completeness.isComplete;
  jobObject.missingFields = completeness.missingFields;

  return jobObject;
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
      // Large indexed responses need time to serialize on Cloud Run.
      signal: AbortSignal.timeout(30000)
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
      let changed = false;
      const valid = {};

      Object.entries(parsed).forEach(([k, app]) => {
        const comp = String(app.company || '').trim().toLowerCase();
        const tit = String(app.title || '').trim().toLowerCase();

        // Discard corrupted email conversation or fake company records
        const isCorrupt = !comp || !tit ||
          comp === 'gmail' ||
          comp === 'direct employer' ||
          comp === 'unknown' ||
          tit.startsWith('exploring a new opportunity') ||
          tit.includes('application was sent to') ||
          tit.includes('application submitted') ||
          tit.includes('application received') ||
          tit.includes('invitation to connect');

        if (!isCorrupt) {
          valid[k] = app;
        } else {
          changed = true;
        }
      });

      if (changed) {
        localStorage.setItem('job_dashboard_local_applications', JSON.stringify(valid));
      }

      return Object.values(valid);
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
        data.applications.forEach(a => {
          const comp = String(a.company || '').trim().toLowerCase();
          const tit = String(a.title || '').trim().toLowerCase();
          if (comp && tit && comp !== 'gmail' && !tit.startsWith('exploring a new opportunity')) {
            combinedMap.set(String(a.job_id || a.id), a);
          }
        });
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
  const comp = String(jobData.company || '').trim().toLowerCase();
  const tit = String(jobData.title || '').trim().toLowerCase();
  
  // Never save corrupted email conversation cards
  if (!comp || !tit || comp === 'gmail' || tit.startsWith('exploring a new opportunity')) {
    return;
  }

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
        job_id: String(targetId),
        company: jobData.company,
        title: jobData.title,
        status: jobData.status || 'Applied / In Review',
        notes: jobData.notes || '',
        applied_at: jobData.applied_at || jobData.date || new Date().toISOString(),
        resume_text: jobData.resumeText || jobData.resume_text || null,
        cover_letter_text: jobData.coverLetterText || jobData.cover_letter_text || null,
        psychology_insights: jobData.psychologyInsights || jobData.psychology_insights || null
      }),
      signal: AbortSignal.timeout(5000)
    });
  } catch (err) {
    console.warn("Failed to persist application to backend:", err);
  }
};

const fetchDemoFallbackJobs = async () => {
  const fallbackPaths = [
    `${import.meta.env.BASE_URL || '/'}jobs_combined.json`,
    `${import.meta.env.BASE_URL || '/'}data/scraped_jobs.json`,
    `${import.meta.env.BASE_URL || '/'}demo_jobs.json`,
    './jobs_combined.json',
    './demo_jobs.json'
  ];

  for (const path of fallbackPaths) {
    try {
      const res = await fetch(path);
      if (res.ok) {
        const raw = await res.json();
        const arrayData = Array.isArray(raw) ? raw : (raw.jobs || []);
        const fallbackUpdated = raw.updated || raw.scraped_at || null;
        if (arrayData.length > 0) {
          return {
            jobs: arrayData.map((row, index) => parseMetadata(row, index)),
            total: arrayData.length,
            page: 1,
            pageSize: arrayData.length,
            totalPages: 1,
            isFallback: true,
            fallbackTimestamp: fallbackUpdated
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
    totalPages: 1,
    isFallback: true,
    fallbackTimestamp: null
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

  const jobs = apiJobsResult?.jobs || [];
  if (apiJobsResult?.isFallback && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('jobs-fallback-active', {
      detail: {
        isFallback: true,
        fallbackTimestamp: apiJobsResult.fallbackTimestamp
      }
    }));
  }

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
    const cleanUrl = cleanJobUrl(job.portalLink || job.link || job.url || '');
    const normKey = normalizeJobKey(job.company, job.title);

    // Skip true duplicates
    if (cleanUrl && seenUrls.has(cleanUrl)) continue;
    if (normKey && normKey !== '__' && seenNormKeys.has(normKey)) continue;

    if (cleanUrl) seenUrls.add(cleanUrl);
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

  // Load user-added custom jobs so they always appear in the dashboard index
  try {
    const rawCustom = localStorage.getItem('job_dashboard_custom_jobs');
    if (rawCustom) {
      const customJobs = JSON.parse(rawCustom);
      if (Array.isArray(customJobs)) {
        customJobs.forEach((customJob, idx) => {
          const parsed = parseMetadata(customJob, customJob.id || `custom_${idx}`);
          parsed.isCustom = true;
          // Apply any user applications state if present
          const userApp = userAppsMap.get(String(parsed.id));
          if (userApp) {
            parsed.status = userApp.status || parsed.status;
            parsed.resumeText = userApp.resume_text || userApp.resumeText || parsed.resumeText;
            parsed.coverLetterText = userApp.cover_letter_text || userApp.coverLetterText || parsed.coverLetterText;
            parsed.hasCustomDocs = Boolean(parsed.resumeText || parsed.coverLetterText);
          }
          deduplicatedJobs.unshift(parsed);
        });
      }
    }
  } catch (err) {
    console.warn("Failed to load local custom jobs:", err);
  }

  // Return strictly genuine scraped & custom job ads
  return deduplicatedJobs;
};


/**
 * Fetches the full detailed job description on-demand from the backend resolver.
 */
export const fetchDetailedJobDescription = async (job, force = false) => {
  if (!job) return '';
  const jobId = job.id || '';
  const jobUrl = job.portalLink || job.link || job.url || '';
  
  // If description is already detailed (>350 chars) and not forced, return it
  if (!force && job.description && job.description.trim().length >= 350) {
    return job.description;
  }

  if (!jobId && !jobUrl) {
    return job.description || '';
  }

  try {
    const apiBase = getApiBase();
    const token = getAuthToken();
    const params = new URLSearchParams();
    if (jobId) params.set('job_id', jobId);
    if (jobUrl) params.set('url', jobUrl);
    if (force) params.set('force', 'true');

    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let targetUrl = `${apiBase}/api/job-description?${params.toString()}`;
    if (!apiBase && typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
      targetUrl = `${window.location.origin}/api/job-description?${params.toString()}`;
    }

    const res = await fetch(targetUrl, {
      headers,
    });

    if (!res.ok) {
      return job.description || '';
    }

    const data = await res.json();
    if (data && data.success && data.description) {
      const cleanDesc = cleanDescriptionText(data.description);
      job.description = cleanDesc || data.description;
      return job.description;
    }
  } catch (err) {
    if (typeof process === 'undefined' || !process.env?.VITEST) {
      console.warn('Failed to fetch detailed job description:', err);
    }
  }

  return job.description || '';
};

/**
 * Backward compatibility alias for profile-targeted job fetching
 */
export const fetchJobsForProfile = async (profile) => {
  return fetchJobsData();
};

