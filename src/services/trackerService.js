import { parseISO, isValid, differenceInDays } from 'date-fns';
import { cleanDescriptionText } from './dataService';
import { getBackendApiBase } from './apiConfig';

/**
 * Validates whether a job record is valid and belongs in the Application Tracker.
 */
export const isValidTrackerJob = (job) => {
  if (!job || typeof job !== 'object') return false;

  const company = String(job.company || '').trim();
  const title = String(job.title || '').trim();

  // Filter out corrupted or placeholder values
  const compLower = company.toLowerCase();
  const titLower = title.toLowerCase();

  if (
    !company ||
    compLower === 'unknown' ||
    compLower === 'undefined' ||
    compLower === 'null' ||
    compLower === 'gmail' ||
    compLower === 'direct employer'
  ) {
    return false;
  }

  if (
    !title ||
    titLower === 'unknown' ||
    titLower === 'undefined' ||
    titLower === 'null' ||
    titLower.startsWith('exploring a new opportunity') ||
    titLower.includes('application was sent to') ||
    titLower.includes('application submitted') ||
    titLower.includes('application received') ||
    titLower.includes('invitation to connect')
  ) {
    return false;
  }

  // Check valid tracker status
  const s = String(job.status || '').toLowerCase();
  const isExcluded = s.includes('package prepared') || 
                     s.includes('to submit') || 
                     s.includes('discovered') || 
                     s.includes('draft') ||
                     s.includes('sourced');

  return !isExcluded;
};

/**
 * Extracts and cleans a readable summary brief of the job description.
 */
export const getCleanJobDescriptionBrief = (job, maxChars = 160) => {
  if (!job) return '';
  const rawText = job.description || job.notes || job.summary || '';
  const cleaned = cleanDescriptionText(rawText);

  if (cleaned && cleaned.length > 0) {
    const firstPara = cleaned.split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim();
    if (firstPara.length <= maxChars) return firstPara;
    return firstPara.substring(0, maxChars).trim() + '...';
  }

  // Fallback synthetic brief based on job metadata
  const tags = Array.isArray(job.tags) && job.tags.length > 0 ? job.tags.slice(0, 3).join(', ') : 'IT Systems & Infrastructure';
  return `${job.title} opportunity at ${job.company}. Focus areas: ${tags}.`;
};

/**
 * Computes the workflow state, current position, and next action step for an application.
 */
export const getApplicationWorkflow = (job) => {
  const statusStr = String(job?.status || 'Applied').toLowerCase();
  
  // Calculate days elapsed since application date
  let daysAgo = 0;
  let dateObj = null;
  const rawDate = job?.appliedDate || job?.date || job?.statusUpdatedAt || job?.created_at;
  if (rawDate) {
    try {
      const parsed = typeof rawDate === 'string' ? parseISO(rawDate) : new Date(rawDate);
      if (isValid(parsed)) {
        dateObj = parsed;
        daysAgo = Math.max(0, differenceInDays(new Date(), parsed));
      }
    } catch {
      daysAgo = 0;
    }
  }

  // Stage classification
  let stageKey = 'applied';
  let stageLabel = 'Applied (In Review)';
  let currentStep = `Application submitted and active in recruiter queue (${daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}).`;
  let nextStep = 'Waiting for initial talent screening.';
  let nextActionType = 'view_ad';
  let isFollowUpDue = false;
  let isAutoClosed = false;

  if (statusStr.includes('hired') || statusStr.includes('accepted')) {
    stageKey = 'hired';
    stageLabel = 'Accepted / Hired 🚀';
    currentStep = 'Offer formally accepted. Onboarding preparation active.';
    nextStep = 'Prepare onboarding documentation, police checks, and commencement schedule.';
    nextActionType = 'offer_hub';
  } else if (statusStr.includes('offer')) {
    stageKey = 'offer';
    stageLabel = 'Offer Received 🎉';
    currentStep = 'Formal employment package extended by employer.';
    nextStep = 'Review base salary, superannuation, and WFH terms in Offer Action Hub.';
    nextActionType = 'offer_hub';
  } else if (statusStr.includes('interview')) {
    stageKey = 'interview';
    stageLabel = 'Interview Scheduled';
    currentStep = 'Shortlisted for formal interview & evaluation rounds.';
    nextStep = 'Launch Interview Simulator & rehearse STAR talking points.';
    nextActionType = 'interview_prep';
  } else if (statusStr.includes('unsuccessful') || statusStr.includes('rejected') || statusStr.includes('dismissed')) {
    stageKey = 'unsuccessful';
    stageLabel = 'Unsuccessful / Closed';
    currentStep = 'Application closed by employer.';
    nextStep = 'Archived. Key skill dimensions captured for future matching.';
    nextActionType = 'view_ad';
  } else if (daysAgo >= 14 || statusStr.includes('non-responsive')) {
    stageKey = 'non_responsive';
    stageLabel = 'Non-Responsive (Closed)';
    currentStep = `No response received after ${daysAgo} days. Automatically archived.`;
    nextStep = 'Optional: Re-engage direct hiring manager via LinkedIn if high priority.';
    isAutoClosed = true;
    nextActionType = 'follow_up';
  } else {
    // Standard Applied
    stageKey = 'applied';
    stageLabel = 'Applied (In Review)';
    if (daysAgo >= 5) {
      isFollowUpDue = true;
      currentStep = `Under review by hiring team (${daysAgo} days elapsed).`;
      nextStep = '✉️ Follow-up due: Send a polite check-in email to hiring team.';
      nextActionType = 'follow_up';
    } else {
      currentStep = `Application submitted ${daysAgo === 0 ? 'today' : `${daysAgo} days ago`} via ${job?.source || 'job gateway'}.`;
      const daysLeft = 5 - daysAgo;
      nextStep = `Waiting for recruiter screening. Follow-up window opens in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`;
      nextActionType = 'view_ad';
    }
  }

  // Pre-generate professional follow-up email
  const followUpEmail = generateFollowUpEmail(job);

  return {
    stageKey,
    stageLabel,
    currentStep,
    nextStep,
    nextActionType,
    daysAgo,
    dateObj,
    isFollowUpDue,
    isAutoClosed,
    followUpEmail
  };
};

/**
 * Generates structured follow-up email content and mailto link.
 */
export const generateFollowUpEmail = (job) => {
  const title = job?.title || 'Technical Specialist';
  const company = job?.company || 'the Hiring Organization';
  const subject = `Application Follow-up: ${title} - Sam Ludwig`;
  
  const body = `Dear ${company} Hiring Team,

I hope this note finds you well.

I am following up on my recent application for the ${title} position with ${company}. I remain very enthusiastic about the role and confident that my enterprise systems administration, Azure/M365 cloud architecture, and technical support background will deliver immediate value to your team.

Please let me know if there are any further details, project references, or materials I can provide to support my application.

Thank you very much for your time and consideration. I look forward to speaking with you.

Warm regards,
Sam Ludwig
0405 993 245 | sam.ludwig@gmail.com
Balaclava VIC 3183`;

  const contactEmail = job?.contactEmail || '';
  const mailtoUrl = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return {
    subject,
    body,
    mailtoUrl,
    contactEmail
  };
};

/**
 * Persists an applied job to backend SQLite database.
 */
export const saveUserApplicationToBackend = async (job, userId) => {
  if (!job || typeof job !== 'object') return null;
  const targetUserId = userId || getActiveProfile()?.id;
  if (!targetUserId) {
    throw new Error('Authentication required: valid userId or active profile is required to save application.');
  }
  const apiBase = getBackendApiBase();
  const jobId = job.id || `${job.company}_${job.title}`;

  try {
    const res = await fetch(`${apiBase}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': targetUserId
      },
      body: JSON.stringify({
        job_id: jobId,
        company: job.company || '',
        title: job.title || '',
        status: job.status || 'Applied',
        notes: job.notes || '',
        resume_text: job.resume_text || '',
        cover_letter_text: job.cover_letter_text || '',
        applied_at: job.appliedDate || job.applied_at || new Date().toISOString(),
        job_data: job
      })
    });
    if (res.ok) {
      const data = await res.json();
      return data.application;
    }
  } catch (e) {
    console.warn('Backend application save non-blocking error:', e);
  }
  return null;
};

/**
 * Synchronizes batch application array to backend database.
 */
export const syncApplicationsToBackend = async (appsList, userId) => {
  if (!Array.isArray(appsList) || appsList.length === 0) return null;
  const targetUserId = userId || getActiveProfile()?.id;
  if (!targetUserId) {
    throw new Error('Authentication required: valid userId or active profile is required to sync applications.');
  }
  const apiBase = getBackendApiBase();

  try {
    const res = await fetch(`${apiBase}/api/applications/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': targetUserId
      },
      body: JSON.stringify({
        applications: appsList.map(j => ({
          job_id: j.id || `${j.company}_${j.title}`,
          company: j.company || '',
          title: j.title || '',
          status: j.status || 'Applied',
          notes: j.notes || '',
          applied_at: j.appliedDate || j.applied_at || new Date().toISOString(),
          job_data: j
        }))
      })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Backend batch applications sync error:', e);
  }
  return null;
};

/**
 * Fetches all saved applications for user from backend database.
 */
export const fetchUserApplicationsFromBackend = async (userId) => {
  const targetUserId = userId || getActiveProfile()?.id;
  if (!targetUserId) {
    console.warn('fetchUserApplicationsFromBackend called without userId or active profile; returning empty');
    return [];
  }
  const apiBase = getBackendApiBase();

  try {
    const res = await fetch(`${apiBase}/api/applications?user_id=${encodeURIComponent(targetUserId)}`, {
      headers: { 'X-User-Id': targetUserId }
    });
    if (res.ok) {
      const data = await res.json();
      return data.applications || [];
    }
  } catch (e) {
    console.warn('Backend fetch applications error:', e);
  }
  return [];
};

/**
 * Scans targeted Gmail inbox for recruiter/ATS updates for applied jobs.
 */
export const scanGmailForApplicationUpdates = async ({ username, appPassword, jobId = null, days = 14, userId }) => {
  const targetUserId = userId || getActiveProfile()?.id;
  if (!targetUserId) {
    throw new Error('Authentication required: valid userId or active profile is required to scan application updates.');
  }
  const apiBase = getBackendApiBase();

  const res = await fetch(`${apiBase}/api/applications/scan-updates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': targetUserId
    },
    body: JSON.stringify({
      username,
      app_password: appPassword,
      job_id: jobId,
      days: days
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Gmail scan failed with HTTP ${res.status}`);
  }

  return await res.json();
};
