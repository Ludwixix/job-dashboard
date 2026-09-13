/**
 * Inbound Sourcing Optimization & LinkedIn Boolean Search Service
 * Fulfills Phase 21 specifications from docs/Resume_Optimization.md.
 */

import { getBackendApiBase } from './apiConfig';
import { getActiveProfile } from './profileService';

const VAGUE_BUZZWORDS = [
  'guru', 'ninja', 'rockstar', 'wizard', 'enthusiast', 'visionary',
  'passionate', 'evangelist', 'game changer', 'synergy', 'dynamic',
  'go-getter', 'self-starter', 'thought leader'
];

/**
 * Tokenize a Boolean query in JavaScript
 */
const tokenizeBooleanQuery = (query = '') => {
  const tokens = [];
  let i = 0;
  const n = query.length;

  while (i < n) {
    const c = query[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '(') {
      tokens.push({ type: 'LPAREN', val: '(' });
      i++;
    } else if (c === ')') {
      tokens.push({ type: 'RPAREN', val: ')' });
      i++;
    } else if (c === '"') {
      i++;
      const start = i;
      while (i < n && query[i] !== '"') {
        i++;
      }
      const val = query.slice(start, i).trim();
      if (val) tokens.push({ type: 'TERM', val });
      if (i < n && query[i] === '"') i++;
    } else {
      const start = i;
      while (i < n && !/\s/.test(query[i]) && query[i] !== '(' && query[i] !== ')' && query[i] !== '"') {
        i++;
      }
      const word = query.slice(start, i);
      const upper = word.toUpperCase();
      if (upper === 'AND' || upper === 'OR' || upper === 'NOT') {
        tokens.push({ type: upper, val: upper });
      } else {
        tokens.push({ type: 'TERM', val: word });
      }
    }
  }
  return tokens;
};

/**
 * Client-Side Boolean Query Evaluator Fallback
 */
export const calculateClientBooleanEvaluation = (query = '', text = '') => {
  const hasCurlyQuotes = /[“”‘’]/.test(query);
  const normalizedQuery = query.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  const tokens = tokenizeBooleanQuery(normalizedQuery);
  const textLower = ` ${text.toLowerCase()} `;
  const matchedTerms = new Set();
  const missingTerms = new Set();

  const checkTerm = (term) => {
    const clean = term.trim().toLowerCase();
    if (!clean) return true;
    let matches = false;
    if (clean.includes(' ')) {
      matches = textLower.includes(clean);
    } else {
      const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      matches = new RegExp(`\\b${escaped}\\b`, 'i').test(textLower);
    }
    if (matches) matchedTerms.add(term);
    else missingTerms.add(term);
    return matches;
  };

  let pos = 0;
  const peek = () => (pos < tokens.length ? tokens[pos] : null);
  const consume = () => (pos < tokens.length ? tokens[pos++] : null);

  const parseOr = () => {
    let left = parseAnd();
    while (true) {
      const tok = peek();
      if (tok && tok.type === 'OR') {
        consume();
        const right = parseAnd();
        left = left || right;
      } else break;
    }
    return left;
  };

  const parseAnd = () => {
    let left = parseNot();
    while (true) {
      const tok = peek();
      if (tok && tok.type === 'AND') {
        consume();
        const right = parseNot();
        left = left && right;
      } else if (tok && tok.type !== 'OR' && tok.type !== 'RPAREN') {
        const right = parseNot();
        left = left && right;
      } else break;
    }
    return left;
  };

  const parseNot = () => {
    const tok = peek();
    if (tok && tok.type === 'NOT') {
      consume();
      const right = parsePrimary();
      return !right;
    }
    return parsePrimary();
  };

  const parsePrimary = () => {
    const tok = peek();
    if (!tok) return true;
    if (tok.type === 'LPAREN') {
      consume();
      const res = parseOr();
      const close = peek();
      if (close && close.type === 'RPAREN') consume();
      return res;
    }
    if (tok.type === 'TERM') {
      consume();
      return checkTerm(tok.val);
    }
    consume();
    return true;
  };

  const isMatch = parseOr();

  return {
    is_match: isMatch,
    matched_terms: Array.from(matchedTerms).sort(),
    missing_terms: Array.from(missingTerms).sort(),
    has_curly_quotes_warning: hasCurlyQuotes,
    token_count: tokens.length,
  };
};

/**
 * Client-Side Inbound Indexability Audit Fallback
 */
export const calculateClientLinkedInAudit = ({
  headline = '',
  about = '',
  targetRole = 'Systems Engineer',
  coreSkills = []
}) => {
  const headlineClean = (headline || '').trim();
  const aboutClean = (about || '').trim();
  const target = (targetRole || '').trim().toLowerCase();
  const skills = (coreSkills || []).map(s => s.trim().toLowerCase()).filter(Boolean);

  let score = 100;
  const recommendations = [];
  const strengths = [];

  // 1. Headline Audit
  if (!headlineClean) {
    score -= 45;
    recommendations.push('Add a structured LinkedIn headline containing your exact target job title.');
  } else {
    if (target && headlineClean.toLowerCase().includes(target)) {
      strengths.push(`Headline contains literal target role title: '${targetRole}'.`);
    } else {
      score -= 25;
      recommendations.push(`Include the exact literal title '${targetRole}' in your headline.`);
    }

    if (/[|•—/]/.test(headlineClean)) {
      strengths.push('Headline uses visual delimiter piping for high recruiter scanability.');
    } else {
      score -= 10;
      recommendations.push('Use "|" or "•" dividers in your headline to separate Title, Core Skills, and Value Proposition.');
    }

    const foundBuzzwords = VAGUE_BUZZWORDS.filter(bw => headlineClean.toLowerCase().includes(bw));
    if (foundBuzzwords.length > 0) {
      score -= 15;
      recommendations.push(`Remove abstract buzzwords (${foundBuzzwords.join(', ')}) from your headline. Replace with factual skills.`);
    }
  }

  // 2. About Section Audit
  if (!aboutClean) {
    score -= 35;
    recommendations.push('Draft a structured "About" section featuring grouped skills and searchable keywords.');
  } else {
    const matchedSkills = skills.filter(s => aboutClean.toLowerCase().includes(s));
    const missingSkills = skills.filter(s => !aboutClean.toLowerCase().includes(s));

    if (matchedSkills.length >= Math.max(2, Math.floor(skills.length / 2))) {
      strengths.push(`About section integrates ${matchedSkills.length} core technical keywords.`);
    } else {
      score -= 15;
      recommendations.push(`Integrate missing core skills in About section: ${missingSkills.slice(0, 4).join(', ')}.`);
    }

    if (/core competencies|technical skills|ecosystem|expertise|specialties/i.test(aboutClean)) {
      strengths.push('About section contains structured competency headers for LinkedIn semantic clustering.');
    } else {
      score -= 10;
      recommendations.push('Add an explicit "CORE COMPETENCIES" or "TECHNICAL ECOSYSTEM" section to your About text.');
    }

    if (/\b\d+[%+kKmM]?\b|\$\d+/.test(aboutClean)) {
      strengths.push('About section features quantified scale metrics.');
    } else {
      score -= 10;
      recommendations.push('Include quantifiable operational metrics (e.g. "5,000+ endpoints", "99.9% uptime").');
    }
  }

  // 3. Typographic quotes check
  if (/[“”‘’]/.test(`${headlineClean} ${aboutClean}`)) {
    score -= 5;
    recommendations.push('Replace curly typographic quotes (“ ”) with straight quotes (").');
  }

  const finalScore = Math.max(15, Math.min(100, score));

  return {
    inbound_visibility_score: finalScore,
    strengths,
    recommendations,
    headline_character_count: headlineClean.length,
    headline_character_limit: 220,
    about_word_count: aboutClean ? aboutClean.split(/\s+/).length : 0,
  };
};

/**
 * Generate 3 Boolean-friendly headlines (Client Fallback)
 */
export const generateClientHeadlines = (targetRole, coreSkills = []) => {
  const role = targetRole || 'Senior Systems Engineer';
  const skills = coreSkills.length >= 3 ? coreSkills : ['Azure', 'Terraform', 'PowerShell', 'Intune'];
  return [
    `${role} | ${skills.slice(0, 3).join(', ')} | ACSC Essential 8 & Infrastructure Automation`,
    `${role} | Cloud & Infrastructure Specialist | ${skills[0]} & ${skills[1]} Architecture | DevSecOps`,
    `${role} | Enterprise Systems (5,000+ Endpoints) | ${skills[0]}, ${skills[2]} | Baseline Clearance`,
  ];
};

/**
 * Generate structured keyword About index (Client Fallback)
 */
export const generateClientAboutIndex = (targetRole, coreSkills = []) => {
  const role = targetRole || 'Senior Systems & Cloud Engineer';
  const skills = coreSkills.length ? coreSkills : ['Azure', 'Terraform', 'PowerShell', 'Intune', 'M365'];
  return `Experienced ${role} with a proven track record architecting, automating, and securing enterprise infrastructure environments. Specializing in high-availability systems, cloud modernization, and zero-downtime operations (5,000+ Endpoints, 99.9% Uptime).

─── CORE COMPETENCIES (Recruiter Index) ───
• Architecture & Design: Cloud Infrastructure, Hybrid Identity, Enterprise Systems
• Automation & DevOps: CI/CD Pipelines, Infrastructure-as-Code, Scripting & Orchestration
• Governance & Security: ACSC Essential 8, ISO 27001, Endpoint Hardening, SLA Management

─── TECHNICAL ECOSYSTEM ───
${skills.join(' • ')}

─── TARGET ROLES & SYNONYMS ───
${role} | Cloud Infrastructure Engineer | Systems Administrator | Technical Specialist | Enterprise Architect

Open to discussing senior enterprise engineering, cloud transformation, and architecture initiatives across Australia.`;
};

/**
 * Generate 5 high-converting Recruiter Boolean Queries (Client Fallback)
 */
export const generateClientRecruiterQueries = (title, skills = []) => {
  const cleanTitle = title || 'Systems Engineer';
  const s = skills.length >= 4 ? skills : ['Azure', 'Terraform', 'PowerShell', 'Kubernetes'];
  return [
    {
      strategy: 'Exact Target Title & Core Stack',
      description: 'Used by corporate in-house recruiters for exact headline targeting.',
      query: `"${cleanTitle}" AND (${s[0]} OR ${s[1]}) AND (${s[2]} OR ${s[3]})`,
    },
    {
      strategy: 'Broad Title Synonyms & Seniority',
      description: 'Used by agency headhunters searching across title variations.',
      query: `("${cleanTitle}" OR "Cloud Infrastructure Engineer") AND (${s[0]} OR ${s[1]})`,
    },
    {
      strategy: 'Methodology & Architecture Deep Dive',
      description: 'Pinpoints hands-on senior practitioners with delivery leadership.',
      query: `("${cleanTitle}") AND (Architecture OR Deployment OR Implementation OR Optimization) AND (${s[0]})`,
    },
    {
      strategy: 'Negative-Filtered Senior Talent Pool',
      description: 'Prunes junior candidates, entry-level, interns, and academic profiles.',
      query: `("${cleanTitle}") AND (${s[0]}) NOT (Junior OR Intern OR Graduate OR "Entry Level")`,
    },
    {
      strategy: 'Enterprise Scale & Australian Clearance Moat',
      description: 'High-yield filter for Australian enterprise & sovereign government mandates.',
      query: `("${cleanTitle}") AND (${s[0]} OR ${s[1]}) AND (Enterprise OR "Large Scale" OR Baseline OR NV1 OR "Australian Citizen")`,
    },
  ];
};

/**
 * Fetch recruiter queries from backend with client fallback
 */
export const fetchRecruiterQueries = async ({ title = 'Systems Engineer', industry = 'Technology', skills = [] }) => {
  const base = getBackendApiBase();
  try {
    const skillsParam = encodeURIComponent(skills.join(','));
    const url = `${base}/api/inbound-sourcing/queries?title=${encodeURIComponent(title)}&industry=${encodeURIComponent(industry)}&skills=${skillsParam}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.queries) return data.queries;
    }
  } catch (err) {
    console.warn('[inboundSourcingService] Backend unreachable, using client queries:', err.message);
  }
  return generateClientRecruiterQueries(title, skills);
};

/**
 * Audit LinkedIn profile for inbound recruiter search visibility
 */
export const auditLinkedInProfile = async ({ headline, about, targetRole, coreSkills }) => {
  const base = getBackendApiBase();
  const profile = getActiveProfile() || {};
  const effectiveHeadline = headline || profile.headline || profile.title || '';
  const effectiveAbout = about || profile.about || profile.summary || '';
  const effectiveRole = targetRole || profile.title || 'Systems Engineer';
  const effectiveSkills = coreSkills || profile.coreSkills || ['Cloud', 'Infrastructure', 'Automation'];

  try {
    const res = await fetch(`${base}/api/inbound-sourcing/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        headline: effectiveHeadline,
        about: effectiveAbout,
        target_role: effectiveRole,
        core_skills: effectiveSkills,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.audit) {
        return {
          audit: data.audit,
          headlines: data.headlines,
          aboutIndex: data.about_index,
        };
      }
    }
  } catch (err) {
    console.warn('[inboundSourcingService] Backend unreachable, using client audit:', err.message);
  }

  const audit = calculateClientLinkedInAudit({
    headline: effectiveHeadline,
    about: effectiveAbout,
    targetRole: effectiveRole,
    coreSkills: effectiveSkills,
  });
  const headlines = generateClientHeadlines(effectiveRole, effectiveSkills);
  const aboutIndex = generateClientAboutIndex(effectiveRole, effectiveSkills);

  return { audit, headlines, aboutIndex };
};

/**
 * Test a Boolean query against text
 */
export const testBooleanQuery = async ({ query, text }) => {
  const base = getBackendApiBase();
  try {
    const res = await fetch(`${base}/api/inbound-sourcing/test-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, text }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.result) return data.result;
    }
  } catch (err) {
    console.warn('[inboundSourcingService] Backend unreachable, using client evaluator:', err.message);
  }
  return calculateClientBooleanEvaluation(query, text);
};

/**
 * Fetch role-specific LinkedIn inbound optimization assets for a job
 */
export const fetchJobInboundOptimization = async (jobId, jobTitle, coreSkills = []) => {
  const base = getBackendApiBase();
  if (jobId) {
    try {
      const res = await fetch(`${base}/api/jobs/${encodeURIComponent(jobId)}/inbound-optimization`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          return {
            targetTitle: data.target_title,
            queries: data.queries,
            headlines: data.headlines,
            aboutIndex: data.about_index,
          };
        }
      }
    } catch (err) {
      console.warn('[inboundSourcingService] Backend job optimization fetch error:', err.message);
    }
  }

  const title = jobTitle || 'Senior Systems Engineer';
  return {
    targetTitle: title,
    queries: generateClientRecruiterQueries(title, coreSkills),
    headlines: generateClientHeadlines(title, coreSkills),
    aboutIndex: generateClientAboutIndex(title, coreSkills),
  };
};

/**
 * Helper to get badge style for inbound visibility score
 */
export const formatInboundScoreBadge = (score) => {
  if (score >= 85) {
    return {
      label: 'High Visibility',
      colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      dotClass: 'bg-emerald-400',
    };
  }
  if (score >= 65) {
    return {
      label: 'Moderate Visibility',
      colorClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      dotClass: 'bg-amber-400',
    };
  }
  return {
    label: 'Low Search Indexability',
    colorClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    dotClass: 'bg-rose-400',
  };
};
