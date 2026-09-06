import { parseISO, isValid, format, startOfMonth, endOfMonth, isWithinInterval, addMonths, subMonths } from 'date-fns';

export const PBAS_POINTS = {
  APPLICATION_SUBMITTED: 5,
  INTERVIEW_ATTENDED: 20
};

const STORAGE_KEY = 'workforce_australia_settings';

export const DEFAULT_WORKFORCE_SETTINGS = {
  enabled: false,
  pointsTarget: 100,
  cycleStartDay: 1,
  jobseekerId: '',
  providerName: ''
};

export const getWorkforceSettings = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WORKFORCE_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed.enabled),
      pointsTarget: Number(parsed.pointsTarget) || 100,
      cycleStartDay: Number(parsed.cycleStartDay) || 1,
      jobseekerId: String(parsed.jobseekerId || ''),
      providerName: String(parsed.providerName || '')
    };
  } catch (e) {
    console.warn('Error reading workforce settings:', e);
    return { ...DEFAULT_WORKFORCE_SETTINGS };
  }
};

export const saveWorkforceSettings = (updates = {}) => {
  try {
    const current = getWorkforceSettings();
    const merged = {
      ...current,
      ...updates,
      enabled: updates.enabled !== undefined ? Boolean(updates.enabled) : current.enabled,
      pointsTarget: updates.pointsTarget !== undefined ? Math.max(10, Number(updates.pointsTarget)) : current.pointsTarget,
      cycleStartDay: updates.cycleStartDay !== undefined ? Math.max(1, Math.min(31, Number(updates.cycleStartDay))) : current.cycleStartDay,
      jobseekerId: updates.jobseekerId !== undefined ? String(updates.jobseekerId).trim() : current.jobseekerId,
      providerName: updates.providerName !== undefined ? String(updates.providerName).trim() : current.providerName
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch (e) {
    console.warn('Error saving workforce settings:', e);
    return { ...DEFAULT_WORKFORCE_SETTINGS, ...updates };
  }
};

export const getCycleDateRange = (cycleStartDay = 1, refDate = new Date()) => {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const day = refDate.getDate();

  if (cycleStartDay === 1) {
    const start = startOfMonth(refDate);
    const end = endOfMonth(refDate);
    const label = `${format(start, 'dd MMM yyyy')} – ${format(end, 'dd MMM yyyy')} (${format(start, 'MMM yyyy')})`;
    return { start, end, label };
  }

  let start;
  let end;

  if (day >= cycleStartDay) {
    start = new Date(year, month, cycleStartDay, 0, 0, 0, 0);
    const nextMonth = addMonths(start, 1);
    end = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), cycleStartDay - 1, 23, 59, 59, 999);
  } else {
    const prevMonth = subMonths(new Date(year, month, 1), 1);
    start = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), cycleStartDay, 0, 0, 0, 0);
    end = new Date(year, month, cycleStartDay - 1, 23, 59, 59, 999);
  }

  const label = `${format(start, 'dd MMM yyyy')} – ${format(end, 'dd MMM yyyy')}`;
  return { start, end, label };
};

const extractJobDate = (job) => {
  const dateCandidates = [
    job.applied_at,
    job.appliedAt,
    job.interview_date,
    job.interviewDate,
    job.updated_at,
    job.updatedAt,
    job.created_at,
    job.createdAt
  ];

  for (const candidate of dateCandidates) {
    if (!candidate) continue;
    try {
      const parsed = typeof candidate === 'string' ? parseISO(candidate) : new Date(candidate);
      if (isValid(parsed)) return parsed;
    } catch {
      // ignore
    }
  }
  return new Date();
};

export const calculatePBASPoints = (jobs = [], options = {}) => {
  const settings = getWorkforceSettings();
  const pointsTarget = options.pointsTarget || settings.pointsTarget || 100;
  const cycleStartDay = options.cycleStartDay || settings.cycleStartDay || 1;
  const refDate = options.referenceDate || new Date();

  const cycle = getCycleDateRange(cycleStartDay, refDate);
  const eligibleItems = [];

  let applicationCount = 0;
  let interviewCount = 0;
  let totalPoints = 0;

  jobs.forEach(job => {
    if (!job) return;
    const status = String(job.status || '').toLowerCase().trim();

    const isInterview = status.includes('interview') || status.includes('meeting') || status.includes('screening');
    const isApplied = isInterview || status.includes('applied') || status.includes('submitted') || status.includes('offer');

    if (!isApplied) return;

    const eventDate = extractJobDate(job);
    const inCycle = isWithinInterval(eventDate, { start: cycle.start, end: cycle.end });

    if (!inCycle) return;

    let pointsAwarded = 0;
    let activityType = 'Job Application';

    if (isInterview) {
      pointsAwarded = PBAS_POINTS.INTERVIEW_ATTENDED;
      activityType = 'Job Interview';
      interviewCount += 1;
    } else {
      pointsAwarded = PBAS_POINTS.APPLICATION_SUBMITTED;
      activityType = 'Job Application';
      applicationCount += 1;
    }

    totalPoints += pointsAwarded;

    eligibleItems.push({
      id: job.id,
      title: job.title || 'Untitled Role',
      company: job.company || 'Direct Employer',
      status: job.status || 'Applied',
      channel: job.source || 'Online Job Board',
      evidenceUrl: job.url || '',
      eventDate,
      dateStr: format(eventDate, 'yyyy-MM-dd'),
      formattedDate: format(eventDate, 'dd MMM yyyy'),
      pointsAwarded,
      type: activityType,
      notes: job.notes || job.why || ''
    });
  });

  eligibleItems.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());

  const pointsRemaining = Math.max(0, pointsTarget - totalPoints);
  const surplusPoints = Math.max(0, totalPoints - pointsTarget);
  const percentage = Math.round((totalPoints / pointsTarget) * 100);
  const isMet = totalPoints >= pointsTarget;

  return {
    cycle,
    totalPoints,
    pointsTarget,
    pointsRemaining,
    surplusPoints,
    percentage,
    isMet,
    applicationCount,
    interviewCount,
    totalEvidenceItems: eligibleItems.length,
    items: eligibleItems
  };
};

export const formatPortalSubmissionText = (item) => {
  if (!item) return '';
  let dateFormatted = item.dateStr;
  if (!dateFormatted && item.applied_at) {
    try {
      dateFormatted = format(parseISO(item.applied_at), 'yyyy-MM-dd');
    } catch {
      // ignore
    }
  }
  if (!dateFormatted) {
    dateFormatted = item.eventDate ? format(item.eventDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  }

  const rawStatus = String(item.status || 'Applied').trim();
  const normalizedStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);

  const channel = item.channel || item.source || 'Online';
  const method = channel.toLowerCase().includes('seek') ? 'Online Application (SEEK)' :
                 channel.toLowerCase().includes('indeed') ? 'Online Application (Indeed)' :
                 channel.toLowerCase().includes('linkedin') ? 'Online Application (LinkedIn)' :
                 `Online Application (${channel})`;

  return [
    `Employer: ${item.company || 'Target Employer'}`,
    `Position: ${item.title || 'Position'}`,
    `Method: ${method}`,
    `Status: ${normalizedStatus}`,
    `Date: ${dateFormatted}`,
    item.evidenceUrl || item.url ? `URL: ${item.evidenceUrl || item.url}` : ''
  ].filter(Boolean).join('\n');
};

export const generateWorkforceCsvString = (items = [], _meta = {}) => {
  const header = [
    'Date',
    'Employer / Business Name',
    'Job Title',
    'Activity Type',
    'Points',
    'Channel / Method',
    'Status',
    'Evidence / Listing URL'
  ].join(',');

  const rows = items.map(item => {
    return [
      `"${item.dateStr || ''}"`,
      `"${(item.company || '').replace(/"/g, '""')}"`,
      `"${(item.title || '').replace(/"/g, '""')}"`,
      `"${(item.type || 'Job Application').replace(/"/g, '""')}"`,
      `"${item.pointsAwarded || 5}"`,
      `"${(item.channel || '').replace(/"/g, '""')}"`,
      `"${(item.status || '').replace(/"/g, '""')}"`,
      `"${(item.evidenceUrl || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  return [header, ...rows].join('\n');
};
