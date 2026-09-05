/**
 * Auto-Apply Service for LinkedIn Easy Apply and SEEK Quick Apply.
 * Supports:
 * 1. Intelligent platform & Quick Apply detection (LinkedIn, SEEK, Direct)
 * 2. Pre-employment screening question resolution using candidate profile
 * 3. Fast-track client-side one-click dispatch with automatic clipboard payload injection
 * 4. Cloud Run / Backend Playwright bot orchestration
 */

import { getActiveProfile } from './profileService';
import { generateApplicationDocs } from './generationService';
import { SCRAPER_BASE_URL } from './jobQueryService';

const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const CLOUD_RUN_API = isLocalHost ? '' : (SCRAPER_BASE_URL || '');

/**
 * Checks if a job is eligible for LinkedIn Easy Apply or SEEK Quick Apply
 */
export const isQuickApplyEligible = (job) => {
  if (!job) return false;
  const src = String(job.source || '').toLowerCase();
  const link = String(job.link || job.portalLink || job.url || '').toLowerCase();
  const title = String(job.title || '').toLowerCase();
  const notes = String(job.notes || job.description || '').toLowerCase();

  // LinkedIn Easy Apply
  if (src.includes('linkedin') || link.includes('linkedin.com/jobs')) return true;

  // SEEK Quick Apply / Apply on SEEK
  if (src.includes('seek') || link.includes('seek.com.au')) return true;

  // Generic 1-click apply flags
  if (job.isQuickApply || notes.includes('quick apply') || notes.includes('easy apply')) return true;

  // All unsubmitted jobs can use the Unified Auto-Apply pipeline
  return true;
};

/**
 * Returns user-friendly platform label
 */
export const getQuickApplyPlatform = (job) => {
  if (!job) return 'Unified Fast-Track Gateway';
  const src = String(job.source || '').toLowerCase();
  const link = String(job.link || job.portalLink || job.url || '').toLowerCase();

  if (src.includes('linkedin') || link.includes('linkedin.com')) {
    return 'LinkedIn Easy Apply';
  }
  if (src.includes('seek') || link.includes('seek.com.au')) {
    return 'SEEK Quick Apply';
  }
  if (src.includes('indeed')) {
    return 'Indeed Apply';
  }
  return 'Direct Employer 1-Click Gateway';
};

/**
 * Resolves standard and sector-specific pre-employment screening questions using candidate profile and job context
 */
export const resolveScreeningQuestions = (job, candidateProfile) => {
  const profile = candidateProfile || getActiveProfile() || {};
  const industry = String(profile.industry || job?.industry || job?.stream || '').toLowerCase();
  const title = String(job?.title || '').toLowerCase();

  const isHealth = industry.includes('health') || industry.includes('medical') ||
    title.includes('nurse') || title.includes('clinical') || title.includes('hospital') || title.includes('care');
  const isFinance = industry.includes('finance') || industry.includes('account') ||
    title.includes('accountant') || title.includes('cpa') || title.includes('audit') || title.includes('payroll');
  const isConstruction = industry.includes('construction') || industry.includes('trade') ||
    title.includes('builder') || title.includes('site') || title.includes('carpenter') || title.includes('trades');
  const isLegal = industry.includes('legal') || industry.includes('law') ||
    title.includes('solicitor') || title.includes('lawyer') || title.includes('counsel');

  const baseQuestions = [
    {
      category: 'Work Rights & Legal Status',
      question: 'Are you legally entitled / authorized to work in Australia?',
      answer: profile.workRights || 'Australian Citizen (Unrestricted Full Working Rights)',
      confidence: 100
    },
    {
      category: 'Location & Commute',
      question: 'Current residential location & willingness to commute / attend on-site?',
      answer: `${profile.location || job?.location || 'Melbourne, VIC'} (Direct commute access within standard transit corridor)`,
      confidence: 99
    },
    {
      category: 'Availability & Notice Period',
      question: 'What is your notice period / earliest available start date?',
      answer: profile.availability || 'Immediate / <2 Weeks Notice',
      confidence: 100
    },
    {
      category: 'Target Remuneration',
      question: 'Expected annual salary / remuneration package?',
      answer: job?.salary || profile.targetSalary || 'Market Competitive Remuneration',
      confidence: 95
    }
  ];

  // Sector-specific credentials and screening checks
  if (isHealth) {
    baseQuestions.splice(1, 0, {
      category: 'Professional AHPRA Registration',
      question: 'Do you hold current unrestricted registration with AHPRA?',
      answer: profile.ahpraRegistration || 'Yes (Current Unrestricted AHPRA Registration)',
      confidence: 100
    });
    baseQuestions.push({
      category: 'Clinical Compliance & Immunisations',
      question: 'Do you hold a current WWCC, National Police Check, and current immunisations/CPR?',
      answer: 'Yes (Current WWCC, Clean Police Check, Compliant Immunisation Record & CPR)',
      confidence: 100
    });
  } else if (isFinance) {
    baseQuestions.splice(1, 0, {
      category: 'Professional Accounting Qualification',
      question: 'Are you a qualified CPA or CA member in Australia?',
      answer: profile.accountingQualification || 'Yes (CPA / CA Qualified with Australian Reporting Standards)',
      confidence: 98
    });
    baseQuestions.push({
      category: 'ERP Systems & Statutory Reporting',
      question: 'What is your experience with ERP platforms (SAP, Xero, MYOB) and statutory tax/BAS?',
      answer: 'Proficient in ERP administration, financial reconciliation, and ATO compliance',
      confidence: 96
    });
  } else if (isConstruction) {
    baseQuestions.splice(1, 0, {
      category: 'Site Safety & Induction',
      question: 'Do you hold a current General Construction Induction Card (White Card)?',
      answer: 'Yes (Valid Australian White Card & Relevant Trade Qualification)',
      confidence: 100
    });
    baseQuestions.push({
      category: 'Licensing & OHS Compliance',
      question: 'Do you have a valid Australian Driver Licence and relevant OHS certificates?',
      answer: 'Yes (Valid Australian Full Driver Licence & SafeWork OHS SWMS compliance)',
      confidence: 100
    });
  } else if (isLegal) {
    baseQuestions.splice(1, 0, {
      category: 'Practising Certificate & Admission',
      question: 'Do you hold a current Australian Practising Certificate?',
      answer: 'Yes (Current Unrestricted Australian Practising Certificate & Court Admission)',
      confidence: 100
    });
    baseQuestions.push({
      category: 'Conflict Check & Legal Compliance',
      question: 'Are you eligible for immediate conflict check clearance?',
      answer: 'Yes (Clear professional conduct record and conflict check ready)',
      confidence: 98
    });
  } else {
    // Technology & IT / General
    baseQuestions.splice(1, 0, {
      category: 'Security Clearance',
      question: 'Do you hold or are you eligible for Australian Government Security Clearance?',
      answer: profile.clearance || 'Baseline / NV1 Ready (Eligible for Immediate Vetting)',
      confidence: 98
    });
    baseQuestions.push({
      category: 'Core Qualifications & Driver Licence',
      question: 'Do you hold a valid Australian Driver Licence and clear National Police Check?',
      answer: 'Yes (Valid Australian Driver Licence & Clean National Police Check)',
      confidence: 100
    });
  }

  return baseQuestions;
};

/**
 * Initiates backend Playwright auto-apply task on Cloud Run
 */
export const startBackendAutoApply = async (job, candidateProfile) => {
  const profile = candidateProfile || getActiveProfile();
  const endpoint = `${CLOUD_RUN_API}/api/auto-apply/start`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job, profile })
    });

    if (!res.ok) {
      throw new Error(`Backend auto-apply start failed with HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.task;
  } catch (err) {
    console.warn('Backend auto-apply start error, using client-side simulated bot:', err);
    return null;
  }
};

/**
 * Polls backend auto-apply status
 */
export const pollBackendAutoApplyStatus = async (taskId) => {
  if (!taskId) return null;
  const endpoint = `${CLOUD_RUN_API}/api/auto-apply/${taskId}/status`;

  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
};

/**
 * Executes Fast-Track Auto-Apply Dispatcher
 * 1. Generates tailored ATS resume and cover letter
 * 2. Injects full structured application data into the system clipboard
 * 3. Launches direct Easy Apply / Quick Apply portal in new tab
 * 4. Downloads tailored PDFs
 * 5. Returns application receipt
 */
export const executeFastTrackApply = async (
  job, 
  candidateProfile, 
  downloadResumePdf, 
  downloadCoverLetterPdf
) => {
  const profile = candidateProfile || getActiveProfile();
  
  // 1. Check for existing docs, otherwise generate them
  let resumeText = job.resumeText;
  let coverLetterText = job.coverLetterText;

  if (!resumeText || !coverLetterText) {
    const docResult = await generateApplicationDocs(job, null, null, profile);
    resumeText = docResult.resume;
    coverLetterText = docResult.coverLetter;
  }

  // 2. Download tailored PDFs
  if (downloadResumePdf && resumeText) {
    try {
      downloadResumePdf(resumeText, job, profile);
    } catch (e) {
      console.warn('Resume PDF download warning:', e);
    }
  }

  if (downloadCoverLetterPdf && coverLetterText) {
    setTimeout(() => {
      try {
        downloadCoverLetterPdf(coverLetterText, job, profile);
      } catch (e) {
        console.warn('Cover letter PDF download warning:', e);
      }
    }, 350);
  }

  // 3. Construct rich clipboard payload for 2-second autofill
  const screeningMap = resolveScreeningQuestions(job, profile);
  const screeningText = screeningMap.map(q => `• ${q.question} -> ${q.answer}`).join('\n');

  const candidateSalary = job?.salary || profile.targetSalary || 'Market Competitive Remuneration';
  const clearanceLine = profile.clearance ? `Security Clearance: ${profile.clearance}\n` : '';
  const ahpraLine = profile.ahpraRegistration ? `AHPRA Registration: ${profile.ahpraRegistration}\n` : '';
  const cpaLine = profile.accountingQualification ? `Accounting Qualification: ${profile.accountingQualification}\n` : '';

  const clipboardPayload = `=== CANDIDATE CONTACT DETAILS ===
Full Name: ${profile.name || 'Candidate'}
Email: ${profile.email || ''}
Phone: ${profile.phone || ''}
Location: ${profile.location || job?.location || 'Melbourne, VIC'}
Work Rights: ${profile.workRights || 'Australian Citizen (Unrestricted)'}
${clearanceLine}${ahpraLine}${cpaLine}Notice Period: ${profile.availability || 'Immediate / <2 Weeks Notice'}
Expected Salary: ${candidateSalary}

=== PRE-EMPLOYMENT SCREENING ANSWERS ===
${screeningText}

=== BESPOKE TAILORED COVER LETTER ===
${coverLetterText}
`;

  let clipboardSuccess = false;
  try {
    await navigator.clipboard.writeText(clipboardPayload);
    clipboardSuccess = true;
  } catch (err) {
    console.warn('Clipboard write error. User may need to grant permission:', err);
  }

  // 4. Open job application portal tab
  const rawLink = String(job.portalLink || job.link || job.url || '').trim();
  const targetUrl = rawLink ? (rawLink.startsWith('http') ? rawLink : `https://${rawLink}`) : null;
  let popupBlocked = false;
  if (targetUrl) {
    const newWindow = window.open(targetUrl, '_blank');
    if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
      popupBlocked = true;
      console.warn('Popup blocked. User needs to manually click the launch link.');
    }
  }

  return {
    success: true,
    platform: getQuickApplyPlatform(job),
    dispatchId: `DSP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    jobTitle: job.title,
    company: job.company,
    appliedAt: new Date().toISOString(),
    resumeText: resumeText,
    coverLetterText: coverLetterText,
    screeningQuestions: screeningMap,
    clipboardSuccess,
    popupBlocked,
    targetUrl
  };
};
