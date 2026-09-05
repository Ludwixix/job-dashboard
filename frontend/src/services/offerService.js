/**
 * Offer Intelligence & Compensation Benchmarking Service
 * Provides:
 * 1. Australian market compensation benchmarking & take-home tax estimations.
 * 2. 3-posture evidence-grounded counter-offer proposal generation (Assertive, Collaborative, Benefits-focused).
 * 3. Employment contract clause risk scanner (Fair Work & NES compliance).
 */

import { getActiveProfile, CANDIDATE_PROFILE } from './profileService';
import { getApiBase } from './dataService';

export const STATUTORY_SUPER_RATE = 0.115; // 11.5%

export const SECTOR_SALARY_BENCHMARKS = {
  technology: {
    junior: { p10: 75000, p25: 85000, p50: 98000, p75: 115000, p90: 130000 },
    mid: { p10: 105000, p25: 120000, p50: 135000, p75: 155000, p90: 175000 },
    senior: { p10: 140000, p25: 160000, p50: 180000, p75: 205000, p90: 230000 },
    lead: { p10: 175000, p25: 195000, p50: 220000, p75: 250000, p90: 285000 }
  },
  healthcare: {
    junior: { p10: 70000, p25: 78000, p50: 86000, p75: 96000, p90: 108000 },
    mid: { p10: 88000, p25: 96000, p50: 108000, p75: 122000, p90: 135000 },
    senior: { p10: 110000, p25: 125000, p50: 140000, p75: 158000, p90: 175000 },
    lead: { p10: 135000, p25: 150000, p50: 170000, p75: 195000, p90: 220000 }
  },
  finance: {
    junior: { p10: 68000, p25: 75000, p50: 85000, p75: 98000, p90: 110000 },
    mid: { p10: 95000, p25: 110000, p50: 125000, p75: 142000, p90: 160000 },
    senior: { p10: 130000, p25: 148000, p50: 168000, p75: 192000, p90: 220000 },
    lead: { p10: 170000, p25: 195000, p50: 225000, p75: 260000, p90: 300000 }
  },
  trades: {
    junior: { p10: 65000, p25: 72000, p50: 82000, p75: 94000, p90: 105000 },
    mid: { p10: 85000, p25: 98000, p50: 115000, p75: 132000, p90: 150000 },
    senior: { p10: 120000, p25: 138000, p50: 155000, p75: 178000, p90: 205000 },
    lead: { p10: 150000, p25: 172000, p50: 195000, p75: 225000, p90: 260000 }
  },
  legal: {
    junior: { p10: 75000, p25: 85000, p50: 98000, p75: 115000, p90: 132000 },
    mid: { p10: 110000, p25: 130000, p50: 150000, p75: 175000, p90: 205000 },
    senior: { p10: 160000, p25: 185000, p50: 215000, p75: 250000, p90: 290000 },
    lead: { p10: 210000, p25: 245000, p50: 285000, p75: 330000, p90: 390000 }
  }
};

SECTOR_SALARY_BENCHMARKS.tech = SECTOR_SALARY_BENCHMARKS.technology;

const GENERAL_BENCHMARKS = {
  junior: { p10: 65000, p25: 75000, p50: 85000, p75: 100000, p90: 115000 },
  mid: { p10: 90000, p25: 105000, p50: 120000, p75: 140000, p90: 160000 },
  senior: { p10: 130000, p25: 145000, p50: 165000, p75: 190000, p90: 215000 },
  lead: { p10: 160000, p25: 180000, p50: 205000, p75: 235000, p90: 270000 }
};

export const detectSeniorityTier = (title = '') => {
  const t = title.toLowerCase();
  if (/lead|principal|head|director|manager|chief|vp|partner/i.test(t)) return 'lead';
  if (/senior|sr|specialist|coordinator|iv|iii/i.test(t)) return 'senior';
  if (/junior|graduate|grad|associate|intern|entry|assistant/i.test(t)) return 'junior';
  return 'mid';
};

export const detectSector = (text = '') => {
  const s = text.toLowerCase();
  if (/nurs|health|medic|clinic|patient|aged care|hospital|doctor/i.test(s)) return 'healthcare';
  if (/construct|builder|site supervisor|site manager|carpenter|trade|whs|foreman|electric|plumb|mechanic/i.test(s)) return 'trades';
  if (/account|cpa|\bca\b|tax|financ|bookkeep|payroll|ledger|treasury/i.test(s)) return 'finance';
  if (/legal|lawyer|counsel|paralegal|solicitor|barrister|litigat/i.test(s)) return 'legal';
  if (/cloud|azure|software|engineer|developer|devops|data|analyst|cyber|network|tech|architect|platform/i.test(s)) return 'tech';
  return 'general';
};

/**
 * Calculates estimated Australian income tax (Stage 3) and Medicare levy
 */
export const calculateAtoTax = (taxableIncome = 0) => {
  const inc = Math.max(0, Number(taxableIncome) || 0);
  let baseTax = 0;

  if (inc <= 18200) {
    baseTax = 0;
  } else if (inc <= 45000) {
    baseTax = (inc - 18200) * 0.16;
  } else if (inc <= 135000) {
    baseTax = 4288 + (inc - 45000) * 0.30;
  } else if (inc <= 190000) {
    baseTax = 31288 + (inc - 135000) * 0.37;
  } else {
    baseTax = 51638 + (inc - 190000) * 0.45;
  }

  const medicare = inc > 24000 ? inc * 0.02 : 0;
  const totalTax = Math.round(baseTax + medicare);
  const netAnnual = Math.round(inc - totalTax);
  const netMonthly = Math.round(netAnnual / 12);
  const netFortnightly = Math.round(netAnnual / 26);
  const effectiveRate = inc > 0 ? Number(((totalTax / inc) * 100).toFixed(1)) : 0;

  return {
    grossAnnual: inc,
    incomeTax: Math.round(baseTax),
    medicareLevy: Math.round(medicare),
    totalTax,
    netAnnual,
    netMonthly,
    netFortnightly,
    effectiveRate,
    effectiveTaxRate: effectiveRate
  };
};

/**
 * Evaluates offer compensation details against sector market distributions
 */
export const evaluateOfferCompensation = (offerData = {}, job = {}, profileOverride = null) => {
  const candidate = profileOverride || getActiveProfile() || CANDIDATE_PROFILE;
  const roleTitle = job.title || offerData.title || candidate?.title || '';
  let sector = offerData.sector || detectSector(`${roleTitle} ${candidate?.industry || ''} ${job.description || ''}`);
  if (sector === 'tech') sector = 'technology';
  const seniority = offerData.seniority || detectSeniorityTier(roleTitle);
  const isSuperIncluded = Boolean(offerData.superIncluded || offerData.superInclusive);

  const rawSalary = Math.max(0, Number(offerData.baseSalary ?? offerData.salary) || 120000);
  let actualBase = rawSalary;
  let superAmount = 0;
  let trp = rawSalary;

  if (isSuperIncluded) {
    actualBase = Math.round(rawSalary / (1 + STATUTORY_SUPER_RATE));
    superAmount = Math.round(rawSalary - actualBase);
    trp = rawSalary;
  } else {
    actualBase = rawSalary;
    superAmount = Math.round(actualBase * STATUTORY_SUPER_RATE);
    trp = Math.round(actualBase + superAmount);
  }

  const brackets = (SECTOR_SALARY_BENCHMARKS[sector] || GENERAL_BENCHMARKS)[seniority] || GENERAL_BENCHMARKS.mid;
  const { p10, p25, p50, p75, p90 } = brackets;

  let percentile = 50;
  if (actualBase <= p10) {
    percentile = Math.max(5, Math.round(10 * (actualBase / p10)));
  } else if (actualBase <= p25) {
    percentile = Math.round(10 + 15 * ((actualBase - p10) / (p25 - p10)));
  } else if (actualBase <= p50) {
    percentile = Math.round(25 + 25 * ((actualBase - p25) / (p50 - p25)));
  } else if (actualBase <= p75) {
    percentile = Math.round(50 + 25 * ((actualBase - p50) / (p75 - p50)));
  } else if (actualBase <= p90) {
    percentile = Math.round(75 + 15 * ((actualBase - p75) / (p90 - p75)));
  } else {
    percentile = Math.min(99, Math.round(90 + 9 * ((actualBase - p90) / (p90 * 0.3))));
  }

  let verdict = 'Competitive Market Rate';
  let verdictColor = 'cyan';
  if (percentile >= 75) {
    verdict = 'Top Quartile Offer (Strong)';
    verdictColor = 'emerald';
  } else if (percentile >= 40) {
    verdict = 'Competitive Market Rate';
    verdictColor = 'cyan';
  } else if (percentile >= 25) {
    verdict = 'Below Median (Room to Negotiate)';
    verdictColor = 'amber';
  } else {
    verdict = 'Bottom Quartile (Under Market)';
    verdictColor = 'rose';
  }

  const tax = calculateAtoTax(actualBase);

  return {
    actualBase,
    baseSalary: actualBase,
    superAmount,
    superannuation: superAmount,
    superRatePercent: Number((STATUTORY_SUPER_RATE * 100).toFixed(1)),
    trp,
    totalRemuneration: trp,
    sector,
    seniority,
    percentile,
    verdict,
    assessmentBand: verdict,
    verdictColor,
    marketMedian: p50,
    marketBands: { p10, p25, p50, p75, p90 },
    tax,
    location: job.location || offerData.location || 'Melbourne, VIC'
  };
};

/**
 * Generates tailored counter-offer proposals across 3 distinct postures
 */
export const generateCounterOfferProposal = (offerData = {}, job = {}, posture = 'collaborative', profileOverride = null) => {
  const candidate = profileOverride || getActiveProfile() || CANDIDATE_PROFILE;
  const activeJob = offerData.job || job || {};
  const activePosture = offerData.posture || posture || 'collaborative';
  const candidateName = offerData.candidateName || candidate?.name || 'Candidate';
  const roleTitle = activeJob.title || offerData.title || candidate?.title || 'Role';
  const company = activeJob.company || offerData.company || 'the Team';
  const currentBase = Number(offerData.offeredSalary || offerData.baseSalary || offerData.salary) || 120000;
  const targetBase = Number(offerData.targetSalary || offerData.targetBase) || Math.round(currentBase * 1.10);
  const sector = offerData.sector || detectSector(`${roleTitle} ${candidate?.industry || ''}`);

  const phone = candidate?.phone ? ` | ${candidate.phone}` : '';
  const email = candidate?.email ? ` | ${candidate.email}` : '';
  const signature = `Warm regards,\n\n${candidateName}\n${candidate?.title || roleTitle}${phone}${email}`;

  let sectorLeverage = '';
  if (sector === 'healthcare') {
    sectorLeverage = 'bringing verified AHPRA clinical compliance, acute patient escalation experience, and immediate contribution to ward quality benchmarks';
  } else if (sector === 'finance') {
    sectorLeverage = 'delivering end-to-end AASB/IFRS statutory compliance, multi-ledger reconciliation automation, and clean audit outcomes';
  } else if (sector === 'trades') {
    sectorLeverage = 'enforcing rigorous SafeWork WHS governance, CPCCWHS1001 site safety standards, and defect-free handover track records';
  } else if (sector === 'legal') {
    sectorLeverage = 'driving Australian Consumer Law risk mitigation, commercial contract negotiation, and proactive legal governance';
  } else {
    sectorLeverage = 'providing enterprise cloud automation, ACSC Essential 8 security posture alignment, and high-availability architecture experience';
  }

  let subject = '';
  let body = '';

  if (activePosture === 'assertive') {
    // Assertive: Anchored on market top-quartile and clear value delivery
    subject = `Offer Consideration & Counter-Proposal: ${roleTitle} at ${company} — ${candidateName}`;
    body = `Dear ${company} Hiring Team,

Thank you very much for extending the formal offer for the ${roleTitle} position. I am enthusiastic about the mission of ${company} and the strategic impact we can achieve together.

Having reviewed the remuneration details in light of current Australian market benchmarks and market compensation analysis for senior practitioners in this domain—and factoring in my background ${sectorLeverage}—I would like to propose an adjusted base salary of $${targetBase.toLocaleString()} plus statutory superannuation.

Given my ability to deliver immediate operational results without extensive ramp-up time, I am confident this adjustment reflects the market value of my contributions. With this agreement in place, I am prepared to sign the offer letter immediately.

Thank you again for your consideration, and I look forward to finalizing our commencement details.

${signature}`;
  } else if (activePosture === 'benefits_focused') {
    // Benefits-Focused: Flexible work, CPD allowance, accelerated review
    subject = `Offer Discussion & Package Alignment: ${roleTitle} — ${candidateName}`;
    body = `Dear ${company} Hiring Team,

Thank you sincerely for extending the offer for the ${roleTitle} role. I am very excited about joining ${company} and contributing to your upcoming initiatives.

The compensation package is close to my expectations. To ensure complete alignment and set up a balanced holistic package for long-term success, I would like to explore a few structural adjustments:

1. Base Remuneration: An adjustment toward $${targetBase.toLocaleString()} base salary, or establishing a formalized 6-month performance review with agreed milestones for salary progression.
2. Work Arrangements: Confirmation of a hybrid schedule (2-3 days remote / in-office) to maintain maximum deep-work productivity.
3. Professional Development: An annual CPD/education allowance ($3,000–$5,000) to support ongoing specialization and professional development directly benefiting the team.

If we can reach consensus on these items, I will be delighted to accept the offer.

Thank you for your partnership and flexibility, and I look forward to speaking soon.

${signature}`;
  } else {
    // Collaborative (Default): Balanced win-win with milestone commitments
    subject = `Appreciation & Offer Discussion: ${roleTitle} — ${candidateName}`;
    body = `Dear ${company} Hiring Team,

Thank you very much for extending the offer to join ${company} as ${roleTitle}. I truly enjoyed our discussions and came away thoroughly impressed by the team and the opportunity ahead.

I am eager to accept the position. Based on my evaluation of the role's scope and the specific value I will provide—particularly ${sectorLeverage}—I would like to respectfully propose a base salary of $${targetBase.toLocaleString()} plus statutory superannuation.

I believe this represents a balanced and fair recognition of the immediate deliverables I will oversee. Would you be open to a brief discussion regarding this adjustment? I am confident we can find a collaborative solution that allows us to move forward.

Thank you again for your time, support, and consideration.

${signature}`;
  }

  const contactEmail = activeJob?.contactEmail || offerData.contactEmail || '';
  const mailtoUrl = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const keyLevers = [
    `Target remuneration proposed at $${targetBase.toLocaleString()}`,
    `Sector-aligned domain expertise (${sector})`,
    'Immediate operational delivery without ramp-up latency',
    'Fair Work NES aligned terms & balanced flexibility'
  ];

  return {
    posture: activePosture,
    subject,
    body,
    mailtoUrl,
    targetBase,
    currentBase,
    sector,
    keyLevers
  };
};

/**
 * Audits contract text against Fair Work & Australian National Employment Standards (NES)
 */
export const auditContractClauses = async (contractText = '') => {
  const text = contractText || '';
  if (!text.trim()) {
    return {
      contractSafetyScore: 100,
      riskRating: 'No Contract Text Provided',
      ratingColor: 'slate',
      totalFlags: 0,
      highRiskCount: 0,
      mediumRiskCount: 0,
      flags: [],
      summary: 'Paste your offer letter or contract text to run the Fair Work risk scanner.'
    };
  }

  // Try backend API first
  try {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/api/contracts/scan-risks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contract_text: text })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.analysis) {
        return {
          contractSafetyScore: data.analysis.contract_safety_score,
          overallRiskScore: Math.max(0, 100 - data.analysis.contract_safety_score),
          riskRating: data.analysis.risk_rating,
          ratingColor: data.analysis.rating_color,
          totalFlags: data.analysis.total_flags,
          totalRisksFound: data.analysis.total_flags,
          highRiskCount: data.analysis.high_risk_count,
          criticalRisksCount: data.analysis.high_risk_count,
          mediumRiskCount: data.analysis.medium_risk_count,
          flags: data.analysis.flags,
          findings: data.analysis.flags,
          summary: data.analysis.summary
        };
      }
    }
  } catch {
    // Fall back to client-side evaluation
  }

  // Client-side fallback scanner
  const flags = [];

  if (/restraint|non-compete|covenant not to compete|restraint period|shall not work for any competitor/i.test(text)) {
    const isHigh = /(?:12|18|24)\s*months?|(?:1|2)\s*years?|(?:20|50|100|250)\s*k(?:m|ilometers)|worldwide|throughout Australia/i.test(text);
    flags.push({
      category: 'Restraint of Trade / Non-Compete',
      severity: isHigh ? 'high' : 'medium',
      title: 'Post-Employment Restraint Clause Detected',
      description: 'Clauses restricting future employment are only enforceable in Australia if strictly reasonable. Restraints exceeding 6 months or wide geographic boundaries are frequently void.',
      fairWorkGuidance: 'Under Australian common law and Fair Work principles, unreasonable restraints restricting a worker\'s livelihood are contrary to public policy.',
      recommendedCounter: 'Propose narrowing restraint to 3 months, limiting to direct client solicitation, and striking blanket geographic bans.'
    });
  }

  if (/reasonable additional (?:hours|overtime)|all-inclusive|salary is inclusive|no overtime penalty|in full satisfaction/i.test(text)) {
    flags.push({
      category: 'All-Inclusive Salary & Unpaid Overtime',
      severity: 'medium',
      title: 'All-Inclusive Additional Hours Clause',
      description: 'The contract designates salary as all-inclusive for any additional hours worked without overtime rates or TOIL.',
      fairWorkGuidance: 'Section 62 of the Fair Work Act 2009 allows employees to refuse unreasonable additional hours taking into account health and family commitments.',
      recommendedCounter: 'Add a clause specifying that sustained hours beyond 38 hours/week will be compensated via Time Off In Lieu (TOIL).'
    });
  }

  if (/all intellectual property created at any time|whether during or outside working hours|all inventions created during the period of employment|any invention created at any time/i.test(text)) {
    flags.push({
      category: 'Blanket IP Assignment',
      severity: 'high',
      title: 'Blanket Off-Duty Intellectual Property Assignment',
      description: 'The IP clause claims ownership over personal projects created outside working hours or unrelated to employer business.',
      fairWorkGuidance: 'Australian courts protect private intellectual property created entirely on personal time without employer equipment.',
      recommendedCounter: 'Amend clause to explicitly exclude personal projects created outside working hours without use of company equipment or confidential data.'
    });
  }

  if (/employee (?:shall provide|must give) \d+ weeks? notice.*company may (?:terminate with|give) \d+ week/is.test(text)) {
    flags.push({
      category: 'Notice Period Asymmetry',
      severity: 'high',
      title: 'Notice Period Asymmetry',
      description: 'The notice period required from the employee significantly exceeds the notice period promised by the employer.',
      fairWorkGuidance: 'Mutual notice parity is standard Australian practice under National Employment Standards (NES).',
      recommendedCounter: 'Request mutual notice parity (e.g. 4 weeks mutual notice for both parties).'
    });
  }

  const highRiskCount = flags.filter(f => f.severity === 'high').length;
  const mediumRiskCount = flags.filter(f => f.severity === 'medium').length;
  const contractSafetyScore = Math.max(20, 100 - (highRiskCount * 25) - (mediumRiskCount * 12));
  const overallRiskScore = Math.max(0, 100 - contractSafetyScore);

  let riskRating = 'Low Risk (Standard Contract)';
  let ratingColor = 'emerald';
  if (contractSafetyScore < 65) {
    riskRating = 'High Risk (Careful Redline Required)';
    ratingColor = 'rose';
  } else if (contractSafetyScore < 85) {
    riskRating = 'Moderate Risk (Amendments Recommended)';
    ratingColor = 'amber';
  }

  return {
    contractSafetyScore,
    overallRiskScore,
    riskRating,
    ratingColor,
    totalFlags: flags.length,
    totalRisksFound: flags.length,
    highRiskCount,
    criticalRisksCount: highRiskCount,
    mediumRiskCount,
    flags,
    findings: flags,
    summary: `Detected ${flags.length} clause item(s) requiring candidate attention before signing.`
  };
};
