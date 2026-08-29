import Papa from 'papaparse';
import { MULTI_INDUSTRY_JOBS } from './multiIndustryJobData';
import { buildQueriesFromProfile, triggerProfileScrape, SCRAPER_BASE_URL } from './jobQueryService';



const CSV_URL = '/api/sheet-csv';
const FALLBACK_CSV_URL = 'https://docs.google.com/spreadsheets/d/1IciRjQBBQoykm0K6NljjDNEWDTzdjsSaEPef8-hw8Lk/export?format=csv';
const SUGGESTIONS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1IciRjQBBQoykm0K6NljjDNEWDTzdjsSaEPef8-hw8Lk/export?format=csv&gid=123456789';

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

const parseMetadata = (row, index) => {
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

  // Parse Cover Letter link
  let coverLetterLink = row['coverLetterLink'] || row['cover'] || row['cover_md'] || null;
  if (!coverLetterLink) {
    const clMatch = notesStr.match(/(?:Cover Letter:\s*)(https:\/\/docs\.google\.com\/document\/d\/[^\s|]+)/i) || 
                    notesStr.match(/(https:\/\/docs\.google\.com\/document\/d\/[^\s|]+)/i);
    if (clMatch) {
      coverLetterLink = clMatch[1];
    }
  }

  // Parse CV / Resume link
  let cvLink = row['cvLink'] || row['resumeLink'] || row['resume'] || row['resume_md'] || row['cv'] || row['CV'] || null;
  if (!cvLink) {
    const cvMatch = notesStr.match(/(?:Resume|CV):\s*(https:\/\/[^\s|]+)/i);
    if (cvMatch) {
      cvLink = cvMatch[1];
    }
  }

  // Direct Job Ad portal link resolution (strictly excludes google docs / profile links)
  const rawPortal = row['Email / Portal Link'] || row['portalLink'] || row['url'] || row['application_route'] || row['link'] || '';
  const portalLink = resolveJobAdLink(rawPortal, notesStr, company, title);

  // Parse rich audit & score
  const matchScore = calculateCandidateMatchScore(row);
  const location = row['location'] || row['Location'] || 'Melbourne, VIC';
  const stream = row['stream'] || 'Core IT & Systems';
  const tags = Array.isArray(row['tags']) ? row['tags'] : [];
  const audit = row['audit'] || null;
  const remote = row['remote'] || false;
  const status = row['Status'] || row['status'] || 'Package Prepared / To Submit';

  return {
    id: String(index),
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
    score: matchScore,
    location,
    stream,
    tags,
    audit,
    remote
  };
};

const parseSuggestionRow = (row, index) => {
  const company = row['Company'] || row['company'] || '';
  const title = row['Job Title'] || row['title'] || '';
  if (!company && !title) return null;

  const location = row['Location'] || row['location'] || 'Melbourne, VIC';
  const source = row['Source / Platform'] || row['Source'] || 'Suggested Role';
  const rawPortal = row['Job Ad / Email Link'] || row['portalLink'] || '';
  const notes = row['Key Highlights'] || row['notes'] || '';
  const date = row['Date'] || new Date().toISOString().split('T')[0];

  const portalLink = resolveJobAdLink(rawPortal, notes, company, title);

  const candidateRow = {
    'Company': company,
    'Job Title': title,
    'Location': location,
    'Source': `${source} (Suggested)`,
    'Email / Portal Link': portalLink,
    'Notes & Next Steps': notes,
    'Date': date,
    'Status': 'Package Prepared / To Submit',
    'score': 85
  };

  return parseMetadata(candidateRow, `sug_${index}`);
};

export const fetchJobsData = async () => {
  const [sheetJobs, scrapedJobs] = await Promise.all([
    fetchSheetData(),
    fetchStoredScrapedJobs()
  ]);

  const existingKeys = new Set(sheetJobs.map(j => `${(j.company || '').toLowerCase()}_${(j.title || '').toLowerCase()}`));
  
  const uniqueScrapedJobs = scrapedJobs.filter(j => {
    const key = `${(j.company || '').toLowerCase()}_${(j.title || '').toLowerCase()}`;
    return !existingKeys.has(key);
  });

  const allCombined = [...sheetJobs, ...uniqueScrapedJobs];
  const combinedKeys = new Set(allCombined.map(j => `${(j.company || '').toLowerCase()}_${(j.title || '').toLowerCase()}`));

  const uniqueMultiIndustry = (MULTI_INDUSTRY_JOBS || []).filter(j => {
    const key = `${(j.company || '').toLowerCase()}_${(j.title || '').toLowerCase()}`;
    return !combinedKeys.has(key);
  });

  return [...allCombined, ...uniqueMultiIndustry];
};

/**
 * Fetch jobs personalised to a user profile.
 * On localhost with the Python backend running: triggers a live rescrape via
 * POST /api/refresh using profile-derived search queries.
 * Everywhere else: filters existing jobs by profile industry/skills.
 *
 * @param {object} profile - Active user profile from profileService
 * @returns {{ jobs: object[], queriesUsed: object[], liveScraped: boolean }}
 */
export const fetchJobsForProfile = async (profile) => {
  const queriesUsed = buildQueriesFromProfile(profile);

  // Attempt a live rescrape if we're on localhost (Python backend available)
  if (isLocalHost) {
    try {
      const result = await triggerProfileScrape(profile);
      if (result.success && result.jobs.length > 0) {
        const parsed = result.jobs.map((item, idx) => parseMetadata(item, `ps_${idx}`));
        return { jobs: parsed, queriesUsed, liveScraped: true, errors: result.errors };
      }
    } catch {
      // Fall through to static path
    }
  }

  // Static fallback: return all jobs (Dashboard scoring will still rank by profile)
  const all = await fetchJobsData();
  return { jobs: all, queriesUsed, liveScraped: false };
};



const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const fetchSheetData = async () => {
  if (isLocalHost) {
    return new Promise((resolve) => {
      Papa.parse(CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const mainData = (results.data || [])
            .filter(row => row['Company'] || row['Job Title'])
            .map((row, index) => parseMetadata(row, index));

          Papa.parse(SUGGESTIONS_CSV_URL, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (sugResults) => {
              const sugData = (sugResults.data || [])
                .map((row, index) => parseSuggestionRow(row, index))
                .filter(Boolean);
              
              resolve([...mainData, ...sugData]);
            },
            error: () => {
              resolve(mainData);
            }
          });
        },
        error: () => {
          fetchFallbackData(resolve);
        }
      });
    });
  }

  // Production static host (GitHub Pages) -> fetch directly from Google Sheets CSV
  return new Promise((resolve) => {
    fetchFallbackData(resolve);
  });
};

const fetchFallbackData = (resolve) => {
  Papa.parse(FALLBACK_CSV_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const mainData = (results.data || [])
        .filter(row => row['Company'] || row['Job Title'])
        .map((row, index) => parseMetadata(row, index));

      Papa.parse(SUGGESTIONS_CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (sugResults) => {
          const sugData = (sugResults.data || [])
            .map((row, index) => parseSuggestionRow(row, index))
            .filter(Boolean);
          
          resolve([...mainData, ...sugData]);
        },
        error: () => {
          resolve(mainData);
        }
      });
    },
    error: () => {
      resolve([]);
    }
  });
};

const fetchStoredScrapedJobs = async () => {
  // Try local backend (dev) or Cloud Run backend (production)
  const apiBase = isLocalHost ? '' : SCRAPER_BASE_URL;
  if (isLocalHost || SCRAPER_BASE_URL) {
    try {
      const res = await fetch(`${apiBase}/api/scraped-jobs`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.jobs)) {
          return data.jobs.map((item, idx) => parseMetadata(item, `scraped_${idx}`));
        }
      }
    } catch {}
  }

  // Static fallback: bundled jobs_combined.json copied to public/ at build time
  try {
    const base = import.meta.env.BASE_URL || '/';
    const res = await fetch(`${base}jobs_combined.json`);
    if (res.ok) {
      const data = await res.json();
      const jobs = Array.isArray(data) ? data : (data.jobs || []);
      return jobs.map((item, idx) => parseMetadata(item, `scraped_${idx}`));
    }
  } catch (err) {
    console.warn('Static jobs fallback also unavailable:', err);
  }

  return [];
};

