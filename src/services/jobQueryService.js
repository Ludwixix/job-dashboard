/**
 * jobQueryService.js
 * Generates smart, profile-aware job search queries from a user's profile.
 * Used to personalise what the scraper looks for based on industry, target
 * titles, skills and location.
 */

// ---------------------------------------------------------------------------
// Cloud Run API URL
// On localhost: uses relative URLs (Vite dev proxy → local Python server)
// On GitHub Pages: routes to the Cloud Run deployment
// After deploying: replace CLOUD_RUN_URL with your actual service URL from:
//   gcloud run services describe job-dashboard --region australia-southeast1 --format "value(status.url)"
// ---------------------------------------------------------------------------
const CLOUD_RUN_URL = import.meta.env.VITE_SCRAPER_API_URL || 'https://job-dashboard-6xrdvjlrcq-ts.a.run.app';
export const isLocalDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
export const SCRAPER_BASE_URL = isLocalDev ? '' : CLOUD_RUN_URL;




// Industry → related job titles map
// Keep titles concise — passed directly to job-board search APIs
// ---------------------------------------------------------------------------
export const INDUSTRY_QUERY_MAP = {
  'Technology & IT': {
    stream: 'core',
    titles: [
      'systems administrator',
      'support engineer',
      'helpdesk',
      'infrastructure engineer',
      'cloud engineer',
      'devops engineer',
      'service desk analyst',
      'microsoft 365 administrator',
      'azure administrator',
      'sharepoint administrator',
      'intune administrator',
      'endpoint engineer',
      'network engineer',
      'site reliability engineer',
      'platform engineer',
      'IT manager',
    ],
    bridgeTitles: ['IT support', 'technical support officer', 'desktop support'],
  },

  'Healthcare & Medical': {
    stream: 'core',
    titles: [
      'registered nurse',
      'enrolled nurse',
      'clinical nurse consultant',
      'nurse practitioner',
      'ward manager',
      'hospital administrator',
      'allied health professional',
      'physiotherapist',
      'occupational therapist',
      'medical receptionist',
      'healthcare coordinator',
      'patient services officer',
      'clinical coordinator',
      'aged care worker',
      'disability support worker',
    ],
    bridgeTitles: ['healthcare assistant', 'medical administrator', 'health information manager'],
  },

  'Finance & Accounting': {
    stream: 'core',
    titles: [
      'financial analyst',
      'accountant',
      'senior accountant',
      'management accountant',
      'financial controller',
      'CFO',
      'tax accountant',
      'payroll officer',
      'bookkeeper',
      'finance manager',
      'business analyst',
      'investment analyst',
      'risk analyst',
      'AML analyst',
      'compliance officer',
      'credit analyst',
    ],
    bridgeTitles: ['accounts payable', 'accounts receivable', 'finance administrator'],
  },

  'Marketing & Sales': {
    stream: 'core',
    titles: [
      'marketing manager',
      'digital marketing manager',
      'SEO specialist',
      'content strategist',
      'brand manager',
      'product marketing manager',
      'social media manager',
      'growth hacker',
      'account manager',
      'business development manager',
      'sales manager',
      'CRM manager',
      'email marketing specialist',
      'performance marketing manager',
      'media buyer',
    ],
    bridgeTitles: ['marketing coordinator', 'sales representative', 'marketing assistant'],
  },

  'Construction & Trades': {
    stream: 'core',
    titles: [
      'site manager',
      'project manager construction',
      'project engineer',
      'construction manager',
      'estimator',
      'quantity surveyor',
      'building supervisor',
      'civil engineer',
      'structural engineer',
      'site foreman',
      'contracts administrator',
      'building inspector',
      'trades supervisor',
      'safety officer construction',
    ],
    bridgeTitles: ['construction coordinator', 'building estimator', 'site administrator'],
  },

  'Education': {
    stream: 'core',
    titles: [
      'teacher',
      'primary school teacher',
      'secondary school teacher',
      'early childhood educator',
      'learning support teacher',
      'curriculum developer',
      'education consultant',
      'instructional designer',
      'school administrator',
      'assistant principal',
      'TAFE trainer',
      'learning and development specialist',
    ],
    bridgeTitles: ['teacher aide', 'education support officer', 'school coordinator'],
  },

  'Legal': {
    stream: 'core',
    titles: [
      'solicitor',
      'senior solicitor',
      'lawyer',
      'legal counsel',
      'in-house counsel',
      'paralegal',
      'legal secretary',
      'conveyancer',
      'litigation lawyer',
      'corporate lawyer',
      'employment lawyer',
      'legal analyst',
    ],
    bridgeTitles: ['law clerk', 'legal administrator', 'contracts manager'],
  },

  'HR & People': {
    stream: 'core',
    titles: [
      'HR business partner',
      'HR manager',
      'human resources officer',
      'talent acquisition specialist',
      'recruiter',
      'learning and development manager',
      'organisational development consultant',
      'people and culture manager',
      'remuneration analyst',
      'HRIS specialist',
      'workplace relations advisor',
      'diversity and inclusion manager',
    ],
    bridgeTitles: ['HR administrator', 'recruitment coordinator', 'people operations specialist'],
  },

  'Retail & Hospitality': {
    stream: 'core',
    titles: [
      'retail manager',
      'store manager',
      'assistant store manager',
      'hospitality manager',
      'restaurant manager',
      'hotel manager',
      'operations manager retail',
      'visual merchandiser',
      'customer experience manager',
      'food and beverage manager',
    ],
    bridgeTitles: ['team leader retail', 'shift supervisor', 'front of house manager'],
  },

  'Engineering': {
    stream: 'core',
    titles: [
      'mechanical engineer',
      'electrical engineer',
      'chemical engineer',
      'process engineer',
      'project engineer',
      'design engineer',
      'manufacturing engineer',
      'maintenance engineer',
      'reliability engineer',
      'systems engineer',
      'automation engineer',
      'instrumentation engineer',
    ],
    bridgeTitles: ['engineering coordinator', 'technical officer', 'engineering consultant'],
  },

  'Logistics & Supply Chain': {
    stream: 'core',
    titles: [
      'supply chain manager',
      'logistics coordinator',
      'warehouse manager',
      'operations manager logistics',
      'procurement manager',
      'inventory manager',
      'distribution manager',
      'freight coordinator',
      'import export coordinator',
      'demand planner',
    ],
    bridgeTitles: ['logistics administrator', 'warehouse supervisor', 'supply chain analyst'],
  },

  'Creative & Design': {
    stream: 'core',
    titles: [
      'graphic designer',
      'UX designer',
      'UI designer',
      'product designer',
      'creative director',
      'art director',
      'motion designer',
      'video editor',
      'web designer',
      'brand designer',
      'illustrator',
    ],
    bridgeTitles: ['junior designer', 'design coordinator', 'creative coordinator'],
  },
};

// ---------------------------------------------------------------------------
// Skills → additional inferred search terms
// ---------------------------------------------------------------------------
const SKILL_INFERENCE_MAP = {
  'PowerShell':            ['powershell engineer', 'automation engineer'],
  'Microsoft 365':         ['microsoft 365 administrator', 'M365 engineer'],
  'Azure':                 ['azure administrator', 'azure cloud engineer'],
  'Entra ID':              ['entra ID administrator', 'identity and access administrator'],
  'Intune':                ['intune administrator', 'endpoint engineer'],
  'SharePoint':            ['sharepoint administrator', 'sharepoint developer'],
  'AWS':                   ['aws solutions architect', 'cloud engineer AWS'],
  'Kubernetes':            ['kubernetes engineer', 'platform engineer'],
  'Terraform':             ['devops engineer', 'infrastructure as code engineer'],
  'React':                 ['frontend developer', 'React developer'],
  'Python':                ['python developer', 'data engineer python'],
  'SQL':                   ['SQL developer', 'data analyst', 'database administrator'],
  'Salesforce':            ['salesforce administrator', 'salesforce developer'],
  'ServiceNow':            ['servicenow administrator', 'itsm analyst'],
  'ITIL':                  ['service delivery manager', 'ITSM manager'],
  'SAP':                   ['SAP consultant', 'SAP functional analyst'],
  'Xero':                  ['bookkeeper', 'accountant xero'],
  'MYOB':                  ['bookkeeper MYOB', 'accountant MYOB'],
  'Google Analytics':      ['SEO analyst', 'digital marketing analyst'],
  'AutoCAD':               ['CAD designer', 'drafting technician'],
  'Revit':                 ['BIM coordinator', 'revit technician'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a clean "City, STATE" location string from the profile's freeform location.
 */
export const extractLocationForQuery = (profile) => {
  const raw = (profile?.location || profile?.suburb || '').trim();
  if (!raw) return 'Melbourne, VIC';
  const stateMatch = raw.match(/([A-Za-z\s]+),?\s*(VIC|NSW|QLD|WA|SA|TAS|ACT|NT)/i);
  if (stateMatch) return `${stateMatch[1].trim()}, ${stateMatch[2].toUpperCase()}`;
  return raw.split('(')[0].trim() || 'Melbourne, VIC';
};

/**
 * Build a de-duplicated list of SearchQuery-compatible objects from a profile.
 * Priority:
 *   1. User's own targetTitles  (weight: 1.5)
 *   2. Industry-mapped titles   (weight: 1.0)
 *   3. Skills-inferred titles   (weight: 0.8)
 *   4. Industry bridge titles   (weight: 0.6, stream: 'bridge')
 */
export const buildQueriesFromProfile = (profile) => {
  if (!profile) return [];

  const location = extractLocationForQuery(profile);
  const industry = profile.industry || 'Technology & IT';
  const industryData = INDUSTRY_QUERY_MAP[industry] || INDUSTRY_QUERY_MAP['Technology & IT'];
  const seen = new Set();
  const queries = [];

  const add = (term, stream = 'core', weight = 1.0) => {
    const key = term.toLowerCase().trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    queries.push({ term: term.trim(), location, stream, weight });
  };

  // 1. Explicit target titles — highest priority
  for (const title of (profile.targetTitles || [])) add(title, 'core', 1.5);

  // 2. Industry-mapped core titles
  for (const title of (industryData.titles || [])) {
    add(title, 'core', 1.0);
    if (queries.length >= 20) break;
  }

  // 3. Skills-inferred additions
  const profileSkills = (profile.coreSkills || []).map(s => s.toLowerCase());
  for (const [skill, inferred] of Object.entries(SKILL_INFERENCE_MAP)) {
    if (profileSkills.some(s => s.includes(skill.toLowerCase()))) {
      for (const t of inferred) add(t, 'core', 0.8);
    }
    if (queries.length >= 28) break;
  }

  // 4. Bridge / adjacent titles
  for (const title of (industryData.bridgeTitles || [])) {
    add(title, 'bridge', 0.6);
    if (queries.length >= 30) break;
  }

  return queries;
};

/**
 * Returns suggested job titles the user hasn't already listed in targetTitles.
 * Used for clickable suggestion chips in the Dashboard.
 */
export const suggestRelatedTitles = (profile) => {
  if (!profile) return [];
  const industry = profile.industry || 'Technology & IT';
  const industryData = INDUSTRY_QUERY_MAP[industry] || INDUSTRY_QUERY_MAP['Technology & IT'];
  const existing = new Set((profile.targetTitles || []).map(t => t.toLowerCase()));

  const suggestions = [];
  for (const title of [...(industryData.titles || []), ...(industryData.bridgeTitles || [])]) {
    if (!existing.has(title.toLowerCase())) suggestions.push(title);
    if (suggestions.length >= 12) break;
  }
  return suggestions;
};

/**
 * Push profile-derived queries to the Python backend's PUT /api/search-criteria.
 * Only succeeds when running locally (backend on localhost).
 */
export const pushQueriesToBackend = async (profile) => {
  const queries = buildQueriesFromProfile(profile);
  if (!queries.length) return { success: false, error: 'No queries generated' };
  try {
    const res = await fetch(`${SCRAPER_BASE_URL}/api/search-criteria`, {

      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { success: true, queries: data.queries || queries };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

/**
 * Trigger an intelligent query refresh via POST /api/refresh using profile-derived queries.
 * Queries recent database cache first; only performs external board scraping for new/stale terms.
 */
export const triggerProfileScrape = async (profile, options = {}) => {
  const queries = buildQueriesFromProfile(profile);
  if (!queries.length) return { success: false, jobs: [] };
  try {
    const res = await fetch(`${SCRAPER_BASE_URL}/api/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        queries, 
        force: Boolean(options.force),
        ttl_hours: options.ttl_hours || 12.0
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { 
      success: true, 
      jobs: data.jobs || [], 
      errors: data.errors || [],
      cacheStats: data.cache_stats || null
    };
  } catch (err) {
    return { success: false, jobs: [], error: err.message };
  }
};

