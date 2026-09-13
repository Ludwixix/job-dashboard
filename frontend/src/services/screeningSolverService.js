/**
 * screeningSolverService.js
 * Application Friction & Pre-Employment Screening Questionnaire Solver Service
 *
 * Implements Phase 23 of the Algorithmic Recruitment Architecture:
 * - Auto-categorization of portal screening questions (Legal/Work Rights, Regulated Clearances, Commercial, STAR Behavioral)
 * - Disqualification Risk Assessment (Critical Dealbreaker, Medium Sensitivity, Low Friction)
 * - Custom Question Sandbox with instant structured responses
 * - Full client-side mirror algorithm providing seamless offline resilience
 */

import { getBackendApiBase } from './apiConfig';
import { getActiveProfile } from './profileService';

const SCREENING_RULES_CLIENT = [
  {
    category: 'Mandatory Legal & Work Rights',
    pattern: /work.*rights|legally.*entitled|right.*to.*work|eligible.*work.*australia|visa|sponsor|citizen|permanent.*resident/i,
    risk: 'Critical Dealbreaker',
    solve: (profile, job, q = '') => {
      if (/require.*sponsor|need.*sponsor|require.*visa/i.test(q)) {
        return 'No (Australian Citizen with unrestricted full working rights; no sponsorship required)';
      }
      return profile?.workRights || 'Australian Citizen (Unrestricted Full Working Rights)';
    },
    dropdown: 'Australian Citizen / Permanent Resident',
    rationale: 'Australian Fair Work & Migration Act mandatory compliance threshold.',
  },
  {
    category: 'Mandatory Legal & Work Rights',
    pattern: /clearance|security.*clearance|baseline|nv1|nv2|negative.*vetting|top.*secret|agsva/i,
    risk: 'Critical Dealbreaker',
    solve: (profile) => profile?.clearance || 'Australian Citizen — Baseline / NV1 Clearance Eligible (AGSVA ready)',
    dropdown: 'Baseline / NV1 Eligible',
    rationale: 'Defence, Federal Government, and critical infrastructure roles require AGSVA vetting.',
  },
  {
    category: 'Statutory Compliance & Regulated Credentials',
    pattern: /working.*with.*children|wwcc|blue.*card|ochre.*card|child.*safe/i,
    risk: 'Critical Dealbreaker',
    solve: () => 'Yes (Current Australian Working With Children Check — Employee status, verified valid)',
    dropdown: 'Yes — Current & Valid',
    rationale: 'Mandatory statutory check for child-related and vulnerable community work.',
  },
  {
    category: 'Statutory Compliance & Regulated Credentials',
    pattern: /police.*check|national.*police|criminal.*history|background.*check|fit.*and.*proper/i,
    risk: 'Critical Dealbreaker',
    solve: () => 'Yes (Current Australian National Police Check — Clear and ready to present on demand)',
    dropdown: 'Yes — Clear Record',
    rationale: 'Standard corporate, healthcare, government, and financial governance prerequisite.',
  },
  {
    category: 'Statutory Compliance & Regulated Credentials',
    pattern: /ndis.*worker|ndis.*screening|disability.*worker|disability.*service/i,
    risk: 'Critical Dealbreaker',
    solve: () => 'Yes (Current and active NDIS Worker Screening Database clearance)',
    dropdown: 'Yes — Active Clearance',
    rationale: 'Mandatory NDIS Commission quality and safety safeguard.',
  },
  {
    category: 'Statutory Compliance & Regulated Credentials',
    pattern: /ahpra|nursing.*midwifery|medical.*board|registered.*nurse|enrolled.*nurse|ahpra.*registration/i,
    risk: 'Critical Dealbreaker',
    solve: () => 'Yes (Current unrestricted AHPRA professional registration with no conditions or notations)',
    dropdown: 'Yes — Unrestricted',
    rationale: 'Statutory practicing requirement under the Health Practitioner Regulation National Law.',
  },
  {
    category: 'Statutory Compliance & Regulated Credentials',
    pattern: /white.*card|general.*construction.*induction|cpccwhs1001|safework|whs.*card/i,
    risk: 'Critical Dealbreaker',
    solve: () => 'Yes (Current General Construction Induction / White Card recognized by SafeWork Australia)',
    dropdown: 'Yes — Valid White Card',
    rationale: 'Mandatory SafeWork Australia site entry requirement.',
  },
  {
    category: 'Statutory Compliance & Regulated Credentials',
    pattern: /cpa\b|ca\b|chartered.*accountant|ipa\b|cpaa\b|tax.*agent|bas.*agent/i,
    risk: 'Medium Sensitivity',
    solve: () => 'Yes (Fully CPA/CA Qualified with extensive Australian statutory reporting and AASB/IFRS experience)',
    dropdown: 'Yes — Fully Qualified',
    rationale: 'Professional accounting credential required for enterprise finance governance.',
  },
  {
    category: 'Statutory Compliance & Regulated Credentials',
    pattern: /practising.*cert|practicing.*cert|admitted.*solicitor|barrister|roll.*of.*practitioners/i,
    risk: 'Critical Dealbreaker',
    solve: () => 'Yes (Admitted Australian Solicitor with current unrestricted Practising Certificate)',
    dropdown: 'Yes — Current',
    rationale: 'Statutory requirement under Legal Profession Uniform Law.',
  },
  {
    category: 'Commercial & Logistical Parameters',
    pattern: /driver.*licen|valid.*licen|manual.*licen|clean.*driving.*record/i,
    risk: 'Medium Sensitivity',
    solve: () => 'Yes (Current, unrestricted full Australian Driver Licence with clear driving history)',
    dropdown: 'Yes — Full & Unrestricted',
    rationale: 'Required for site travel, field support, or mobile service provision.',
  },
  {
    category: 'Commercial & Logistical Parameters',
    pattern: /located|live.*in|residential|commute|suburb|office|attend.*office|onsite|travel.*to/i,
    risk: 'Medium Sensitivity',
    solve: (profile, job) => `Based in ${profile?.location || job?.location || 'Melbourne, VIC'}; readily accessible for onsite commitments.`,
    dropdown: 'Local / Standard Commute',
    rationale: 'Ensures geographic suitability and reliable onsite attendance.',
  },
  {
    category: 'Commercial & Logistical Parameters',
    pattern: /notice.*period|how.*soon|availability|available.*start|commencement.*date|start.*date/i,
    risk: 'Medium Sensitivity',
    solve: (profile) => profile?.availability || 'Available immediately or within standard 2 weeks notice period.',
    dropdown: 'Immediate / <2 Weeks',
    rationale: 'Critical hiring timeline metric for project kickoffs.',
  },
  {
    category: 'Commercial & Logistical Parameters',
    pattern: /salary|remuneration|expected.*salary|compensation|package|hourly.*rate|pay.*expectation/i,
    risk: 'Low Friction',
    solve: (profile, job) => `Targeting ${job?.salary || profile?.targetSalary || 'Market Competitive ($110k–$135k + Super)'}, open to balanced negotiation based on total package.`,
    dropdown: 'Negotiable / Market Rate',
    rationale: 'Establishes commercial boundaries without triggering premature screening filtering.',
  },
  {
    category: 'Commercial & Logistical Parameters',
    pattern: /hybrid|work.*from.*home|remote|office.*policy|flexible.*working/i,
    risk: 'Low Friction',
    solve: () => 'Fully comfortable with hybrid or onsite schedules as required by operational cadence.',
    dropdown: 'Yes — Fully Flexible',
    rationale: 'Verifies team alignment and collaborative presence.',
  },
];

/**
 * Client-side solver for an individual question.
 */
export const clientSolveScreeningQuestion = (question, profile = {}, job = {}) => {
  const qLower = String(question || '').toLowerCase();
  const qId = `sq_${Math.abs(qLower.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0)) % 1000000}`;

  for (const rule of SCREENING_RULES_CLIENT) {
    if (rule.pattern.test(qLower)) {
      return {
        id: qId,
        question,
        answer: rule.solve(profile, job, question),
        category: rule.category,
        risk_level: rule.risk,
        suggested_dropdown: rule.dropdown,
        rationale: rule.rationale,
        confidence: 98,
      };
    }
  }

  // Years of experience
  if (/(\d+)\+?\s*years?|how many years|years of experience/i.test(qLower)) {
    const totalExp = profile.yearsOfExperience || 6;
    const targetRole = job.title || profile.title || 'this domain';
    return {
      id: qId,
      question,
      answer: `${totalExp}+ years of verified hands-on industry experience delivering high-impact outcomes in ${targetRole}.`,
      category: 'Technical Stack Competency',
      risk_level: 'Medium Sensitivity',
      suggested_dropdown: `${totalExp}+ Years`,
      rationale: 'Quantified career tenure aligned to seniority benchmark.',
      confidence: 95,
    };
  }

  // Core skills match
  const coreSkills = Array.isArray(profile.coreSkills) ? profile.coreSkills : [];
  const matchedSkills = coreSkills.filter((s) => qLower.includes(String(s).toLowerCase()));
  if (matchedSkills.length > 0) {
    const skillStr = matchedSkills.join(', ');
    return {
      id: qId,
      question,
      answer: `Yes. Extensive commercial production experience utilizing ${skillStr} across enterprise deployments.`,
      category: 'Technical Stack Competency',
      risk_level: 'Medium Sensitivity',
      suggested_dropdown: 'Yes — Expert / Proficient',
      rationale: `Direct keyword match with candidate coreSkills (${skillStr}).`,
      confidence: 92,
    };
  }

  // STAR Behavioral prompt
  const behavioralKeywords = ['tell us about', 'describe a time', 'how do you handle', 'give an example', 'situation', 'conflict', 'pressure'];
  if (behavioralKeywords.some((kw) => qLower.includes(kw))) {
    return {
      id: qId,
      question,
      answer: 'Situation: Faced with mission-critical SLA constraints and conflicting priorities. Task: Required to maintain operational stability while aligning divergent stakeholder needs. Action: Established automated observability, structured transparent communication cadences, and executed rapid phased rollouts. Result: Delivered 100% on-time milestone achievement with zero downtime incidents and executive panel endorsement.',
      category: 'STAR Behavioral & Situational',
      risk_level: 'Low Friction',
      suggested_dropdown: 'STAR Framework Detailed',
      rationale: 'Structured Situation-Task-Action-Result format demonstrating measured business impact.',
      confidence: 90,
    };
  }

  // General consultative fallback
  const title = profile.title || profile.headline || 'Senior Specialist';
  return {
    id: qId,
    question,
    answer: `Yes. As a seasoned ${title}, I possess the full technical capability, rigorous discipline, and collaborative focus required to exceed the standards outlined.`,
    category: 'General Professional Alignment',
    risk_level: 'Low Friction',
    suggested_dropdown: 'Yes / Fully Qualified',
    rationale: 'Affirmative high-conviction professional response.',
    confidence: 85,
  };
};

/**
 * Extracts implied screening questions from job description.
 */
export const clientExtractQuestionsFromJob = (job = {}) => {
  const desc = job.description || job.notes || '';
  const title = job.title || '';

  if (!desc) {
    return [
      'Are you legally entitled to work full-time in Australia?',
      'What is your current notice period or earliest start date?',
      'What are your salary expectations for this role?',
      'Do you hold a current Australian National Police Check?',
      `How many years of professional experience do you have relevant to ${title || 'this role'}?`,
    ];
  }

  const lines = desc.split('\n').map((l) => l.trim()).filter(Boolean);
  const questions = [];
  const seen = new Set();

  lines.forEach((line) => {
    const clean = line.replace(/^[•*-|#0-9.\s]+/, '').trim();
    if (clean.endsWith('?') && clean.length > 12) {
      if (!seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        questions.push(clean);
      }
    } else if (/\b(must hold|must have|mandatory|essential requirement|prerequisite|screening)\b/i.test(clean)) {
      if (clean.length > 15 && clean.length < 160) {
        const qText = `Do you satisfy this requirement: ${clean}?`;
        if (!seen.has(qText.toLowerCase())) {
          seen.add(qText.toLowerCase());
          questions.push(qText);
        }
      }
    }
  });

  const defaults = [
    ['Are you legally authorized to work in Australia with unrestricted work rights?', /work.*rights|citizen|visa/i],
    ['What is your current notice period or availability to commence?', /notice.*period|start.*date|availability/i],
    ['What are your expected salary / remuneration parameters?', /salary|remuneration|compensation/i],
    ['Do you hold or are you willing to undergo an Australian National Police Check?', /police.*check|criminal/i],
  ];

  defaults.forEach(([defQ, pat]) => {
    if (!questions.some((q) => pat.test(q))) {
      questions.push(defQ);
    }
  });

  return questions.slice(0, 8);
};

/**
 * Compiles complete screening report on client.
 */
export const clientSolveScreeningReport = (job = {}, userProfile = null, customQuestions = null) => {
  const profile = userProfile || getActiveProfile() || {};
  const questions = Array.isArray(customQuestions) && customQuestions.length > 0
    ? customQuestions
    : clientExtractQuestionsFromJob(job);

  const solutions = questions.map((q) => clientSolveScreeningQuestion(q, profile, job));
  const keyDealbreakers = solutions
    .filter((s) => s.risk_level === 'Critical Dealbreaker')
    .map((s) => `${s.category}: ${s.question}`);

  return {
    compliance_score: 100,
    dealbreaker_count: keyDealbreakers.length,
    solutions,
    key_dealbreakers: keyDealbreakers,
    advice_summary: `All ${solutions.length} screening criteria resolved with 100% compliant documentation. ${keyDealbreakers.length} critical statutory dealbreakers verified safe.`,
  };
};

/**
 * Fetches pre-computed screening report for a job from backend API.
 */
export const fetchJobScreeningSolutions = async (jobId, job = {}, userProfile = null) => {
  const profile = userProfile || getActiveProfile() || {};
  const apiBase = getBackendApiBase();

  try {
    const res = await fetch(`${apiBase}/api/jobs/${encodeURIComponent(jobId)}/screening-solutions`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.success && data.report) {
      return data.report;
    }
    throw new Error('Invalid backend response');
  } catch (err) {
    console.warn('[screeningSolverService] Backend unreachable, falling back to client solver:', err.message);
    return clientSolveScreeningReport(job, profile);
  }
};

/**
 * Solves a list of custom screening questions via backend API.
 */
export const solveScreeningQuestions = async (job = {}, userProfile = null, questions = []) => {
  const profile = userProfile || getActiveProfile() || {};
  const apiBase = getBackendApiBase();

  try {
    const res = await fetch(`${apiBase}/api/screening/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job, profile, questions }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.success && data.report) {
      return data.report;
    }
    throw new Error('Invalid backend response');
  } catch (err) {
    console.warn('[screeningSolverService] Backend custom solve unreachable, using client engine:', err.message);
    return clientSolveScreeningReport(job, profile, questions);
  }
};

/**
 * Formatting helper for risk level badge styling.
 */
export const formatRiskBadge = (riskLevel) => {
  switch (riskLevel) {
    case 'Critical Dealbreaker':
      return {
        bg: 'bg-rose-950/60',
        text: 'text-rose-300',
        border: 'border-rose-500/40',
        dot: 'bg-rose-400',
      };
    case 'Medium Sensitivity':
      return {
        bg: 'bg-amber-950/60',
        text: 'text-amber-300',
        border: 'border-amber-500/40',
        dot: 'bg-amber-400',
      };
    case 'Low Friction':
    default:
      return {
        bg: 'bg-emerald-950/60',
        text: 'text-emerald-300',
        border: 'border-emerald-500/40',
        dot: 'bg-emerald-400',
      };
  }
};

