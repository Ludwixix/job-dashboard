import Papa from 'papaparse';

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

const parseMetadata = (row, index) => {
  const notesStr = row['Notes & Next Steps'] || row['notes'] || row['description'] || row['why'] || '';
  
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

  // Parse rich audit & score
  const matchScore = calculateCandidateMatchScore(row);
  const location = row['location'] || row['Location'] || 'Melbourne, VIC';
  const stream = row['stream'] || 'Core IT & Systems';
  const tags = Array.isArray(row['tags']) ? row['tags'] : [];
  const audit = row['audit'] || null;
  const remote = row['remote'] || false;

  return {
    id: String(index),
    date: row['Date'] || row['date'] || row['posted'] || new Date().toISOString().split('T')[0],
    company: row['Company'] || row['company'] || 'Unknown Company',
    title: row['Job Title'] || row['title'] || 'Unknown Title',
    status: row['Status'] || row['status'] || 'Package Prepared / To Submit',
    source: row['Source'] || row['source'] || 'SEEK',
    emailSubject: row['Email Subject'] || row['emailSubject'] || '',
    portalLink: row['Email / Portal Link'] || row['portalLink'] || row['url'] || row['application_route'] || row['link'] || '',
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
  const portalLink = row['Job Ad / Email Link'] || row['portalLink'] || '';
  const notes = row['Key Highlights'] || row['notes'] || '';
  const date = row['Date'] || new Date().toISOString().split('T')[0];

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

  const existingKeys = new Set(sheetJobs.map(j => `${j.company.toLowerCase()}_${j.title.toLowerCase()}`));
  
  const uniqueScrapedJobs = scrapedJobs.filter(j => {
    const key = `${j.company.toLowerCase()}_${j.title.toLowerCase()}`;
    return !existingKeys.has(key);
  });

  return [...sheetJobs, ...uniqueScrapedJobs];
};

const fetchSheetData = async () => {
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
  // Try local Vite dev-server API first
  try {
    const res = await fetch('/api/scraped-jobs', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.jobs)) {
        return data.jobs.map((item, idx) => parseMetadata(item, `scraped_${idx}`));
      }
    }
  } catch {
    // Not running locally — fall through to static bundled data
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
