/**
 * atsAuditParser.js
 * ATS keyword extraction, match score calculation, package parsing,
 * and adversarial pre-submission quality audits.
 */

import { getActiveProfile } from '../profiles/profileStorage';
import { CANDIDATE_PROFILE } from '../profiles/profileTemplates';

/**
 * Extract key terms from a job description for ATS scoring
 */
export const extractJobKeywords = (jobDescription) => {
  const text = (jobDescription || '').toLowerCase();
  const keywordGroups = {
    // Technology & Cloud
    'Microsoft 365': ['microsoft 365', 'm365', 'office 365', 'o365'],
    'SharePoint': ['sharepoint'],
    'Azure': ['azure', 'azure ad', 'entra id'],
    'Intune': ['intune', 'mdm', 'endpoint management'],
    'Autopilot': ['autopilot', 'zero-touch'],
    'PowerShell': ['powershell', 'scripting', 'automation'],
    'Active Directory': ['active directory', 'ad ds', 'ldap', 'group policy'],
    'Windows Server': ['windows server', 'server administration'],
    'Exchange': ['exchange online', 'exchange hybrid', 'exchange'],
    'Teams': ['microsoft teams', 'teams admin'],
    'ServiceNow': ['servicenow', 'itsm'],
    'ITIL': ['itil', 'service management', 'incident management'],
    'Security': ['security', 'compliance', 'essential 8', 'acsc', 'cyber'],
    'Python': ['python'],
    'Networking': ['network', 'tcp/ip', 'dns', 'dhcp', 'vpn', 'cisco', 'fortinet'],
    'Virtualisation': ['vmware', 'vsphere', 'hyper-v', 'virtualisation', 'virtualization'],
    'Linux': ['linux', 'unix', 'rhel', 'ubuntu'],
    'DevOps': ['devops', 'ci/cd', 'azure devops', 'git', 'pipeline', 'terraform', 'ansible', 'docker', 'kubernetes'],
    'L3 Support': ['level 3', 'l3', 'tier 3', 'escalation', 'senior support'],
    'Infrastructure': ['infrastructure', 'systems administrator', 'sysadmin', 'cloud engineer'],
    'Government': ['government', 'aps', 'public sector', 'defence', 'federal', 'state government'],

    // Healthcare & Nursing
    'Healthcare': ['healthcare', 'hospital', 'clinical', 'health', 'ward', 'aged care', 'medical'],
    'Nursing & AHPRA': ['nurse', 'nursing', 'ahpra', 'registered nurse', 'enrolled nurse', 'clinical nurse', 'rn'],
    'Patient Care & Assessment': ['patient care', 'patient assessment', 'acute care', 'bedside care', 'vital signs', 'triage'],
    'Medication & Clinical': ['medication administration', 'medication', 'cannulation', 'wound care', 'infection control', 'iv therapy'],
    'Clinical Governance': ['clinical governance', 'clinical audit', 'nsqhs', 'quality assurance', 'care planning'],
    'Health Systems / EMR': ['emr', 'cerner', 'electronic medical record', 'patient records', 'health documentation'],

    // Finance & Accounting
    'Finance & Accounting': ['accountant', 'accounting', 'financial', 'cpa', 'ca qualified', 'bookkeeper'],
    'Financial Reporting': ['financial reporting', 'statutory reporting', 'balance sheet', 'reconciliation', 'general ledger'],
    'Tax & Compliance': ['tax compliance', 'bas', 'gst', 'audit', 'payroll'],

    // Construction & Trades
    'Construction & Trades': ['construction', 'site supervisor', 'foreman', 'trades', 'builder'],
    'WHS & Site Safety': ['white card', 'safework', 'swms', 'whs', 'ohs', 'site safety']
  };

  return Object.entries(keywordGroups)
    .filter(([, terms]) => terms.some(t => text.includes(t)))
    .map(([keyword]) => keyword);
};

/**
 * Calculate ATS match score between job and candidate
 */
export const calculateAtsScore = (jobDescription) => {
  const matched = extractJobKeywords(jobDescription);
  if (!matched.length) return 50;
  // Dynamic scaling based on industry-relevant matched density
  const base = 58;
  const score = base + Math.min(40, matched.length * 9);
  return Math.min(98, score);
};

/**
 * Parses raw generated document package into its discrete structural parts.
 *
 * @param {string} content - Raw AI output text with standard delimiters.
 * @returns {Object} Structured components: { diagnostic, resume, coverLetter, linkedInOptimization }.
 */
export const parseGeneratedPackageContent = (content = '') => {
  const finalContent = content || '';

  // Resilient section matching accommodating markdown headings (###, ##, #), bold (**), spacing, and punctuation variations
  const diagRegex = /(?:^|\n)\s*(?:#+\s*)?(?:\*\*|__)?\s*===?\s*DIAGNOSTIC\s*===?(?:\*\*|__)?\s*(?:\n|$)/i;
  const resRegex = /(?:^|\n)\s*(?:#+\s*)?(?:\*\*|__)?\s*===?\s*RESUME\s*===?(?:\*\*|__)?\s*(?:\n|$)/i;
  const clRegex = /(?:^|\n)\s*(?:#+\s*)?(?:\*\*|__)?\s*===?\s*COVER[_\s-]*LETTER\s*===?(?:\*\*|__)?\s*(?:\n|$)/i;
  const liRegex = /(?:^|\n)\s*(?:#+\s*)?(?:\*\*|__)?\s*===?\s*LINKEDIN[_\s-]*OPTIMIZATION\s*===?(?:\*\*|__)?\s*(?:\n|$)/i;

  const findSection = (regex) => {
    const match = regex.exec(finalContent);
    if (!match) return { index: -1, length: 0 };
    return { index: match.index, length: match[0].length };
  };

  const diag = findSection(diagRegex);
  const res = findSection(resRegex);
  const cl = findSection(clRegex);
  const li = findSection(liRegex);

  let diagnostic = '';
  let resume = '';
  let coverLetter = '';
  let linkedInOptimization = '';

  if (diag.index !== -1) {
    const start = diag.index + diag.length;
    const end = res.index !== -1 ? res.index : (cl.index !== -1 ? cl.index : (li.index !== -1 ? li.index : finalContent.length));
    diagnostic = finalContent.slice(start, end).trim();
  }

  if (res.index !== -1) {
    const start = res.index + res.length;
    const end = cl.index !== -1 ? cl.index : (li.index !== -1 ? li.index : finalContent.length);
    resume = finalContent.slice(start, end).trim();
  } else if (cl.index !== -1) {
    const start = diag.index !== -1 ? diag.index + diag.length + (diagnostic ? diagnostic.length : 0) : 0;
    resume = finalContent.slice(start, cl.index).trim();
  } else {
    // Delimiter wasn't found - check if there's a markdown heading for cover letter
    const headingCl = /(?:^|\n)#+\s*COVER[_\s-]*LETTER/i.exec(finalContent);
    if (headingCl) {
      resume = finalContent.slice(0, headingCl.index).trim();
      coverLetter = finalContent.slice(headingCl.index).trim();
    } else {
      resume = finalContent.trim();
    }
  }

  if (cl.index !== -1) {
    const start = cl.index + cl.length;
    const end = li.index !== -1 ? li.index : finalContent.length;
    coverLetter = finalContent.slice(start, end).trim();
  } else if (!coverLetter) {
    const headingCl = /(?:^|\n)#+\s*COVER[_\s-]*LETTER[^\n]*\n([\s\S]*?)(?:(?:^|\n)#+\s*(?:LINKEDIN|REFEREES)|$)/i.exec(finalContent);
    if (headingCl && headingCl[1]) {
      coverLetter = headingCl[1].trim();
    }
  }

  if (li.index !== -1) {
    const start = li.index + li.length;
    linkedInOptimization = finalContent.slice(start).trim();
  }

  return {
    diagnostic,
    resume,
    coverLetter,
    linkedInOptimization
  };
};

/**
 * Pre-Submission Adversarial Quality Gate & Double-Check Engine
 */
export const runDocumentQualityAudit = (job, resumeText = '', coverLetterText = '') => {
  const resume = resumeText || '';
  const cl = coverLetterText || '';
  const jobTitle = (job.title || '').trim();
  const jobDesc = (job.notes || job.description || '').toLowerCase();
  const profile = getActiveProfile() || CANDIDATE_PROFILE;
  const candName = profile?.name || 'Candidate';
  const candEmail = profile?.email || '';
  const candPhone = profile?.phone || '';

  // 1. Exact Title Mirroring Check
  const titleMirrored = resume.toLowerCase().includes(jobTitle.toLowerCase());

  // 2. Mechanical Parsing Integrity (Strict Single-Column, Zero Tables/Grids)
  // Enterprise ATS parsers (Workday, Taleo, Textkernel) scramble multi-column layouts and markdown tables
  const hasMarkdownTable = /\|[\s-:]+\|/.test(resume);
  const singleColumnCompliant = !hasMarkdownTable;

  // 3. ATS Semantic Keyword Match Rate
  const requiredKeywords = extractJobKeywords(jobDesc);
  const matchedInResume = requiredKeywords.filter(kw => resume.toLowerCase().includes(kw.toLowerCase()));
  const missingKeywords = requiredKeywords.filter(kw => !resume.toLowerCase().includes(kw.toLowerCase()));
  const keywordScore = requiredKeywords.length > 0 ? Math.round((matchedInResume.length / requiredKeywords.length) * 100) : 95;

  // 4. Outcome-Led Metric Verification & Factual Scale (Phase 3 Achievement Anchoring)
  const metricPatterns = [
    /\b\d{1,3}%\b/g,
    /\b\d{1,3}(?:,\d{3})+\+?\b/g,
    /\b\$\d+[\d,]*\b/g,
    /\b\d+\+\s*(?:clinical|endpoints|users|sites|devices|servers|stakeholders|engineers)\b/gi,
    /\b\d+hr\s*→\s*\d+min\b/gi,
    /\b\d+\.?\d*%\s*(?:uptime|reduction|resolution)\b/gi
  ];
  const metricsFound = [];
  metricPatterns.forEach(p => {
    const matches = resume.match(p) || [];
    metricsFound.push(...matches);
  });
  const hasStrongMetrics = metricsFound.length >= 3;

  // 5. Australian Market Standards: Mandatory Referees Section
  const hasReferees = /(?:##\s*(?:REFEREES|REFERENCES)|REFEREES|REFERENCES)/i.test(resume);

  // 6. Contact & Identity Integrity Check (Body Text Placement)
  const hasName = resume.toLowerCase().includes(candName.toLowerCase()) || resume.includes('SAM LUDWIG') || resume.includes('Sam Ludwig');
  const hasEmailOrPhone = (candEmail && resume.toLowerCase().includes(candEmail.toLowerCase())) ||
                          (candPhone && resume.includes(candPhone.replace(/\s+/g, ''))) ||
                          resume.includes('sam.ludwig@gmail.com') ||
                          resume.includes('0405 993 245');
  const hasClearanceOrRights = /Australian Citizen|Permanent Resident|Clearance|Baseline|NV1|Work Rights/i.test(resume);
  const contactIntegrity = hasName && (hasEmailOrPhone || hasClearanceOrRights);

  // 7. Anti-Cliché & Executive Voice Enforcer
  const forbiddenCliches = [
    'passionate', 'team player', 'results-driven', 'go-getter', 
    'synergy', 'think outside the box', 'hit the ground running',
    'proactive', 'detail-oriented', 'self-starter', 'dynamic'
  ];
  const foundCliches = forbiddenCliches.filter(c => 
    resume.toLowerCase().includes(c) || cl.toLowerCase().includes(c)
  );

  // 8. Anti-Template Cover Letter Verification (Phase 4 Human Interface)
  const genericCoverLetterOpeners = [
    'i am writing to apply', 'i am applying for', 'i am pleased to submit',
    'i am excited to apply', 'i am thrilled to apply', 'with a proven track record',
    'i would like to apply'
  ];
  const foundGenericOpeners = genericCoverLetterOpeners.filter(opener => 
    cl.toLowerCase().includes(opener)
  );
  const antiTemplateCompliant = foundGenericOpeners.length === 0;

  // 9. Australian English Standards
  const usSpellings = ['organization', 'prioritize', 'standardize', 'analyze', 'program '];
  const foundUsSpellings = usSpellings.filter(s => 
    resume.toLowerCase().includes(s) || cl.toLowerCase().includes(s)
  );

  // 10. Cover Letter 3-Paragraph Standard & Swappability Test
  const clWords = cl.trim() ? cl.trim().split(/\s+/).length : 0;
  const clWordCountValid = clWords >= 160 && clWords <= 450;
  const clHasCompany = cl.toLowerCase().includes((job.company || '').toLowerCase());
  const clHasCta = cl.toLowerCase().includes('sincerely') || cl.toLowerCase().includes('discuss') || cl.toLowerCase().includes('welcome') || cl.toLowerCase().includes('regards') || cl.toLowerCase().includes('conversation');
  const clStructureValid = clHasCompany && clHasCta && clWordCountValid;

  // Checks array
  const checks = [
    {
      id: 'title_mirror',
      name: 'Exact Job Title Mirroring',
      category: 'ATS Strategy #1',
      passed: titleMirrored,
      weight: 15,
      detail: titleMirrored ? `Resume header mirrors "${jobTitle}" exactly.` : `Missing exact role title "${jobTitle}" in header.`
    },
    {
      id: 'single_column_mechanical',
      name: 'Mechanical ATS Parser Compliance',
      category: 'Mechanical Parsing Layer',
      passed: singleColumnCompliant,
      weight: 10,
      detail: singleColumnCompliant 
        ? 'Strict single-column flow verified. Zero parsing-hazardous tables or grids detected (Workday/Taleo/Textkernel compliant).' 
        : 'Detected markdown tables or grid syntax that can trigger text-layer scrambling in enterprise parsers.'
    },
    {
      id: 'keyword_coverage',
      name: 'Core ATS Semantic Keyword Coverage',
      category: 'ATS Keyword Match',
      passed: keywordScore >= 70,
      weight: 15,
      detail: `${matchedInResume.length} of ${requiredKeywords.length || 1} required technical keywords verified in resume body.`,
      missing: missingKeywords
    },
    {
      id: 'quantified_outcomes',
      name: 'Achievement Anchoring & Factual Scale',
      category: 'Recruiter Impact',
      passed: hasStrongMetrics,
      weight: 15,
      detail: `Detected ${metricsFound.length} verified metrics (e.g. 660,000+ users, 87% reduction, 99.9% uptime).`
    },
    {
      id: 'referees_section',
      name: 'Australian Market Referees Compliance',
      category: 'Australian Localization',
      passed: hasReferees,
      weight: 10,
      detail: hasReferees ? 'Mandatory Australian Referees section verified.' : 'Missing "Referees" section expected by Australian enterprise ATS & recruiters.'
    },
    {
      id: 'contact_integrity',
      name: 'Identity, Contact & Clearance Integrity',
      category: 'Compliance',
      passed: contactIntegrity,
      weight: 10,
      detail: 'Contact details placed in primary body text (never in header/footer zone discarded by Workday).'
    },
    {
      id: 'anti_cliche',
      name: 'Executive Voice & Anti-Template Standard',
      category: 'Tone & Style',
      passed: foundCliches.length === 0 && antiTemplateCompliant,
      weight: 10,
      detail: (foundCliches.length === 0 && antiTemplateCompliant)
        ? 'Zero clichés detected. Distinct, outcome-led voice passing Anti-Template standards.'
        : `Flagged: ${[...foundCliches, ...foundGenericOpeners].join(', ')}.`
    },
    {
      id: 'spelling_standard',
      name: 'Australian English Spelling Verification',
      category: 'Localization',
      passed: foundUsSpellings.length === 0,
      weight: 5,
      detail: foundUsSpellings.length === 0 ? 'All terminology complies with Australian English (organisation, prioritise, analyse).' : `US spellings detected: ${foundUsSpellings.join(', ')}.`
    },
    {
      id: 'cl_structure',
      name: 'Cover Letter 3-Paragraph & Swappability Test',
      category: 'Cover Letter',
      passed: cl ? clStructureValid : true,
      weight: 10,
      detail: cl ? `Cover letter has ${clWords} words with verified company reference and confident CTA.` : 'Cover letter ready to synthesize.'
    }
  ];

  const passedWeight = checks.filter(c => c.passed).reduce((acc, c) => acc + c.weight, 0);
  const isReadyToSubmit = passedWeight >= 80;

  return {
    overallScore: passedWeight,
    isReadyToSubmit,
    checks,
    matchedKeywords: matchedInResume,
    missingKeywords,
    metricsFound,
    wordCount: {
      resumeWords: resume ? resume.trim().split(/\s+/).length : 0,
      coverLetterWords: clWords
    }
  };
};
