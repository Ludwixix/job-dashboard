import { getBackendApiBase } from './apiConfig';
import { getActiveProfile } from './profileService';

export const CREDENTIAL_DOMAINS = {
  right_to_work: {
    label: 'Australian Work Rights & Citizenship',
    authority: 'Department of Home Affairs (VEVO)',
    authorityUrl: 'https://online.immi.gov.au/evo/firstParty',
    turnaround: 'Instant via VEVO / SEEK Pass',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    patterns: [
      /(?:australian|nz|new zealand)\s*(?:citizen|citizenship)/i,
      /permanent\s*resid(?:ent|ency)|pr\b/i,
      /unrestricted\s*(?:work|working)\s*rights?/i,
      /full\s*working\s*rights?/i,
      /visa\s*sponsorship\s*(?:not|is\s*not)\s*available/i,
      /must\s*have\s*(?:the\s*)?right\s*to\s*work\s*in\s*australia/i,
    ],
  },
  security_clearance: {
    label: 'AGSVA Security Clearance',
    authority: 'Australian Government Security Vetting Agency (AGSVA)',
    authorityUrl: 'https://www.defence.gov.au/security/clearances',
    turnaround: '3 to 12 months (Requires sponsor)',
    badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    patterns: [
      /baseline\s*(?:security\s*)?clearance/i,
      /negative\s*vetting\s*(?:level\s*)?1|nv1\b/i,
      /negative\s*vetting\s*(?:level\s*)?2|nv2\b/i,
      /positive\s*vetting|pv\b/i,
      /agsva\b/i,
      /defence\s*(?:security\s*)?clearance/i,
    ],
  },
  criminal_history: {
    label: 'National Police Check (Criminal Record)',
    authority: 'Australian Criminal Intelligence Commission (ACIC)',
    authorityUrl: 'https://www.acic.gov.au/services/national-police-checking-service',
    turnaround: '1 to 3 business days online',
    badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    patterns: [
      /national\s*police\s*(?:certificate|check)/i,
      /criminal\s*(?:record|history)\s*check/i,
      /police\s*(?:check|clearance)/i,
      /afac\s*(?:check|clearance)/i,
      /fit2work/i,
    ],
  },
  working_with_children: {
    label: 'Working with Children Check (WWCC / Blue Card)',
    authority: 'State Statutory Authorities (Service VIC / Service NSW)',
    authorityUrl: 'https://www.service.vic.gov.au/services/working-with-children',
    turnaround: '3 to 21 business days',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    patterns: [
      /working\s*with\s*children\s*(?:check|card)?|wwcc\b/i,
      /blue\s*card\b/i,
      /working\s*with\s*vulnerable\s*people|wwvp\b/i,
      /child\s*protection\s*clearance/i,
    ],
  },
  ndis_worker: {
    label: 'NDIS Worker Screening Check',
    authority: 'NDIS Quality & Safeguards Commission',
    authorityUrl: 'https://www.ndiscommission.gov.au/workers/worker-screening-workers',
    turnaround: '1 to 3 weeks',
    badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    patterns: [
      /ndis\s*worker\s*screening(?:\s*check)?/i,
      /ndis\s*clearance/i,
      /ndis\s*check/i,
    ],
  },
  occupational_licences: {
    label: 'Occupational Licences (Driver / White Card / Forklift)',
    authority: 'SafeWork Australia / State Transport Authorities',
    authorityUrl: 'https://www.safeworkaustralia.gov.au/',
    turnaround: '1 day course (White Card) / Immediate',
    badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    patterns: [
      /(?:construction\s*)?white\s*card|cpccwhs1001/i,
      /(?:australian\s*)?driver'?s?\s*licen[sc]e/i,
      /valid\s*c[\s-]class\s*licen[sc]e/i,
      /forklift\s*licen[sc]e|lf\s*licen[sc]e|lo\s*licen[sc]e/i,
      /high\s*risk\s*work\s*licen[sc]e|hrwl\b/i,
      /first\s*aid|hltaid009|hltaid011|cpr\b/i,
    ],
  },
  healthcare_ahpra: {
    label: 'AHPRA Professional Registration',
    authority: 'Australian Health Practitioner Regulation Agency (AHPRA)',
    authorityUrl: 'https://www.ahpra.gov.au/',
    turnaround: '4 to 8 weeks (Mandatory statutory requirement)',
    badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    patterns: [
      /ahpra\b/i,
      /registered\s*nurse|rn\b/i,
      /medical\s*board\s*of\s*australia/i,
      /pharmacy\s*board/i,
      /allied\s*health\s*registration/i,
    ],
  },
  finance_professional: {
    label: 'Accounting & Finance Accreditation (CPA / CA ANZ)',
    authority: 'CPA Australia / CA ANZ',
    authorityUrl: 'https://www.cpaaustralia.com.au/',
    turnaround: 'Professional body membership verification',
    badgeColor: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    patterns: [
      /\bcpa\b|cpa\s*australia/i,
      /ca\s*anz|chartered\s*accountant/i,
      /institute\s*of\s*public\s*accountants|ipa\b/i,
      /fasea\b|financial\s*adviser\s*register/i,
    ],
  },
};

/**
 * Perform local pre-qualification credential audit (offline-safe client engine).
 */
export const auditSeekPassLocally = (job = {}, profile = {}) => {
  const fullText = `${job.title || ''} ${job.company || ''} ${job.description || ''}`;
  const auditedRequirements = [];

  // Build candidate corpus
  const candidateTokens = [
    profile.name || '',
    profile.work_rights || '',
    profile.citizenship || '',
    profile.visa_status || '',
    profile.summary || '',
    profile.headline || '',
    ...(Array.isArray(profile.credentials) ? profile.credentials : []),
    ...(Array.isArray(profile.clearances) ? profile.clearances : []),
    ...(Array.isArray(profile.security_clearances) ? profile.security_clearances : []),
    ...(Array.isArray(profile.certifications) ? profile.certifications : []),
    ...(Array.isArray(profile.licences) ? profile.licences : []),
    ...(Array.isArray(profile.skills) ? profile.skills : []),
  ].join(' ').toLowerCase();

  for (const [domainId, meta] of Object.entries(CREDENTIAL_DOMAINS)) {
    for (const pat of meta.patterns) {
      if (pat.test(fullText)) {
        const isMandatory = /(?:must|mandatory|essential|required|prior\s*to|commencing|prerequisite|non[\s-]negotiable)/i.test(fullText) ||
          ['right_to_work', 'security_clearance', 'healthcare_ahpra', 'ndis_worker'].includes(domainId);

        let isVerified = false;
        let evidence = '';

        if (domainId === 'right_to_work') {
          if (/(?:australian citizen|citizen|permanent resident|pr\b|full working rights|unrestricted)/i.test(candidateTokens)) {
            isVerified = true;
            evidence = 'Australian Citizen / Permanent Resident with full unrestricted working rights';
          }
        } else {
          for (const candPat of meta.patterns) {
            const m = candidateTokens.match(candPat);
            if (m) {
              isVerified = true;
              evidence = `Matched in candidate profile: '${m[0]}'`;
              break;
            }
          }
        }

        let status = 'ACTION_REQUIRED';
        let action = `Apply or link via ${meta.authority} (${meta.turnaround}).`;

        if (isVerified) {
          status = 'VERIFIED';
          action = 'Credential active in profile. Ready for SEEK Pass instant verification.';
        } else if (isMandatory) {
          if (['security_clearance', 'healthcare_ahpra'].includes(domainId)) {
            status = 'KNOCKOUT_RISK';
            action = `Mandatory prerequisite missing. Application risks automatic disqualification to 'Not Suitable' folder.`;
          } else if (domainId === 'right_to_work') {
            status = 'KNOCKOUT_RISK';
            action = 'Unrestricted Australian working rights mandatory. Automated filter will disqualify without valid visa/citizenship.';
          }
        }

        auditedRequirements.push({
          id: `${domainId}_${Math.random().toString(36).substring(2, 7)}`,
          domain: domainId,
          name: meta.label,
          authority: meta.authority,
          authorityUrl: meta.authorityUrl,
          turnaround: meta.turnaround,
          mandatory: isMandatory,
          status,
          evidence,
          actionSteps: action,
        });
        break;
      }
    }
  }

  // Calculate scores
  let totalWeight = 0;
  let verifiedWeight = 0;
  let knockoutCount = 0;
  let actionCount = 0;
  let verifiedCount = 0;

  for (const item of auditedRequirements) {
    const weight = item.mandatory ? 2 : 1;
    totalWeight += weight;
    if (item.status === 'VERIFIED') {
      verifiedWeight += weight;
      verifiedCount++;
    } else if (item.status === 'KNOCKOUT_RISK') {
      knockoutCount++;
    } else {
      actionCount++;
    }
  }

  const readinessScore = totalWeight > 0 ? Math.round((verifiedWeight / totalWeight) * 100) : 100;
  let riskLevel = 'PASS_READY';
  let summary = '100% Verified: All credential requirements satisfied in candidate profile. Ready for instant SEEK Pass submission.';

  if (auditedRequirements.length === 0) {
    riskLevel = 'EXEMPT';
    summary = 'No mandatory statutory or SEEK Pass credential requirements detected. Full application clearance.';
  } else if (knockoutCount > 0) {
    riskLevel = 'HIGH_RISK_KNOCKOUT';
    summary = `High Risk: ${knockoutCount} mandatory credential(s) missing. Application will likely trigger algorithmic knockout rules.`;
  } else if (actionCount > 0) {
    riskLevel = 'MEDIUM_RISK';
    summary = `Medium Risk: ${actionCount} credential(s) require action or declaration before commencement.`;
  }

  // Pre-screening questionnaire scripts
  const screeningResponses = auditedRequirements.map((item) => {
    let resp = 'Yes. I meet all prerequisite regulatory and statutory credentials for this position.';
    if (item.domain === 'right_to_work') {
      resp = 'Yes. I am an Australian Citizen with unrestricted, permanent rights to work in Australia. No visa sponsorship is required.';
    } else if (item.domain === 'security_clearance') {
      resp = item.status === 'VERIFIED'
        ? 'Yes. I hold an active Australian Government Security Clearance verified through AGSVA.'
        : 'I am an Australian Citizen eligible to obtain and maintain an AGSVA security clearance (Baseline / NV1) upon sponsorship.';
    } else if (item.domain === 'criminal_history') {
      resp = item.status === 'VERIFIED'
        ? 'Yes. I hold a current, clean National Police Certificate issued within Australia and am readily able to provide verification or consent to an ACIC check.'
        : 'Yes. I am willing and able to provide a current National Police Certificate and consent to background screening prior to appointment.';
    } else if (item.domain === 'working_with_children') {
      resp = item.status === 'VERIFIED'
        ? 'Yes. I hold a valid Working with Children Check (Employee status) verified for child-related work.'
        : 'I am fully eligible to apply for and hold a valid Working with Children Check upon offer.';
    } else if (item.domain === 'ndis_worker') {
      resp = item.status === 'VERIFIED'
        ? 'Yes. I hold a current NDIS Worker Screening Check clearance.'
        : 'I am eligible and prepared to complete the NDIS Worker Screening Check application immediately.';
    } else if (item.domain === 'occupational_licences') {
      resp = "Yes. I hold the relevant valid Australian driver's licence and required occupational certifications (e.g., SafeWork White Card).";
    }

    return {
      requirementId: item.id,
      requirementName: item.name,
      domain: item.domain,
      promptQuestion: `Do you hold or are you eligible for ${item.name}?`,
      response: resp,
      status: item.status,
    };
  });

  return {
    job_id: job.id || '',
    job_title: job.title || 'Position',
    company: job.company || 'Employer',
    readiness_score: readinessScore,
    risk_level: riskLevel,
    summary,
    verified_count: verifiedCount,
    action_count: actionCount,
    knockout_count: knockoutCount,
    total_requirements: auditedRequirements.length,
    audited_requirements: auditedRequirements,
    screening_responses: screeningResponses,
  };
};

/**
 * Fetch SEEK Pass readiness report from backend with local fallback.
 */
export const fetchJobSeekPassReport = async (job = {}, userProfile = null) => {
  const profile = userProfile || getActiveProfile() || {};
  const jobId = typeof job === 'string' ? job : (job.id || `${job.company}_${job.title}`);
  const jobObj = typeof job === 'string' ? { id: job } : job;
  const apiBase = getBackendApiBase();

  let targetUrl = `${apiBase}/api/jobs/${encodeURIComponent(jobId)}/seek-pass`;
  if (!apiBase && typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    targetUrl = `${window.location.origin}/api/jobs/${encodeURIComponent(jobId)}/seek-pass`;
  }

  try {
    const res = await fetch(targetUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      if (data && data.report) {
        return data.report;
      }
    }
  } catch (err) {
    console.warn('[seekPassService] Backend unreachable, falling back to client auditor:', err?.message || err);
  }

  return auditSeekPassLocally(jobObj, profile);
};

/**
 * Remote audit via POST /api/seek-pass/audit with local fallback.
 */
export const auditSeekPassRemote = async (job = {}, userProfile = null) => {
  const profile = userProfile || getActiveProfile() || {};
  const apiBase = getBackendApiBase();

  let targetUrl = `${apiBase}/api/seek-pass/audit`;
  if (!apiBase && typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    targetUrl = `${window.location.origin}/api/seek-pass/audit`;
  }

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job, profile }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.report) {
        return data.report;
      }
    }
  } catch (err) {
    console.warn('[seekPassService] Remote audit failed, falling back to local:', err?.message || err);
  }

  return auditSeekPassLocally(job, profile);
};

export const getRiskBadge = (riskLevel) => {
  switch (riskLevel) {
    case 'PASS_READY':
      return { label: 'SEEK Pass Ready', badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    case 'EXEMPT':
      return { label: 'Clearance Exempt', badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
    case 'MEDIUM_RISK':
      return { label: 'Action Required', badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    case 'HIGH_RISK_KNOCKOUT':
      return { label: 'Knockout Risk ⛔', badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse' };
    default:
      return { label: 'Audit Pending', badgeClass: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
  }
};
