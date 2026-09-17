/**
 * @file calendarService.js
 * @description Provides calendar integration helpers for CAREER.AGENT.
 * Supports direct Google Calendar web scheduling, RFC 5545 iCalendar (.ics) exports,
 * and pre-interview briefing packet compilation.
 */

/**
 * Compiles a structured, high-yield interview briefing packet tailored for
 * calendar event descriptions and pre-meeting review.
 *
 * @param {Object} job - The job target data object.
 * @param {Object} [interviewDetails={}] - Additional interview parameters.
 * @param {string} [interviewDetails.interviewType] - E.g. 'Technical Architecture', 'Executive Culture Fit'.
 * @param {string} [interviewDetails.interviewers] - Names and titles of interview panel.
 * @param {string} [interviewDetails.meetingLink] - Video conference URL.
 * @param {string} [interviewDetails.notes] - Personal candidate focus points.
 * @returns {string} Plain-text formatted briefing document.
 */
export function formatCalendarBriefing(job = {}, interviewDetails = {}) {
  const lines = [
    '=================================================================',
    '         CAREER.AGENT PRE-INTERVIEW BRIEFING PACKET             ',
    '=================================================================',
    '',
    `TARGET ROLE : ${job.title || 'Role Target'}`,
    `ORGANISATION: ${job.company || 'Confidential'}`,
    `LOCATION    : ${job.location || 'Australia (Remote / Hybrid)'}`,
    `COMPENSATION: ${job.salary || 'Competitive Australian Market Package'}`,
    `MATCH SCORE : ${job.matchScore || job.score || 'High Match'}%`,
    ''
  ];

  if (interviewDetails.interviewType) {
    lines.push(`SESSION STAGE: ${interviewDetails.interviewType}`);
  }
  if (interviewDetails.interviewers) {
    lines.push(`PANEL MEMBERS: ${interviewDetails.interviewers}`);
  }
  if (interviewDetails.meetingLink) {
    lines.push(`MEETING LINK : ${interviewDetails.meetingLink}`);
  }
  if (interviewDetails.notes) {
    lines.push(`STRATEGY NOTE: ${interviewDetails.notes}`);
  }

  lines.push('');
  lines.push('--- CORE ROLE REQUIREMENTS & INTELLIGENCE ---');
  if (job.key_requirements && Array.isArray(job.key_requirements) && job.key_requirements.length > 0) {
    job.key_requirements.forEach(req => lines.push(`• ${req}`));
  } else if (job.tags && Array.isArray(job.tags) && job.tags.length > 0) {
    job.tags.forEach(tag => lines.push(`• ${tag}`));
  } else {
    lines.push('• Refer to primary job specification in CAREER.AGENT dashboard');
  }

  lines.push('');
  lines.push('--- CANDIDATE VALUE PROPOSITION & STAR HIGHLIGHTS ---');
  if (job.star_highlights && Array.isArray(job.star_highlights) && job.star_highlights.length > 0) {
    job.star_highlights.forEach(star => lines.push(`[STAR] ${star}`));
  } else {
    lines.push('• Focus on quantifiable business impact, system resilience, and cross-functional leadership');
  }

  lines.push('');
  lines.push('--- HIGH-VALUE QUESTIONS TO ASK THE PANEL ---');
  lines.push('1. "What does excellence in this position look like in the first 90 days?"');
  lines.push('2. "What are the primary architectural or delivery bottlenecks facing this team right now?"');
  lines.push('3. "How does leadership empower technical autonomy and continuous improvement?"');
  lines.push('');
  lines.push('Generated automatically by CAREER.AGENT Intelligence Hub.');

  return lines.join('\n');
}

/**
 * Formats a Date object into Google Calendar compact UTC ISO format (YYYYMMDDTHHmmssZ).
 *
 * @param {Date} date - Source date.
 * @returns {string} Compact timestamp.
 */
function toGCalTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Builds a direct web URL to schedule an event in Google Calendar without API credentials.
 *
 * @param {Object} options - Scheduling parameters.
 * @param {string} options.title - Event title.
 * @param {string} [options.description=''] - Event notes or pre-interview briefing.
 * @param {string} [options.location=''] - Location or meeting link.
 * @param {Date} [options.startTime] - Start timestamp (defaults to current time + 1 day).
 * @param {number} [options.durationMinutes=45] - Duration in minutes.
 * @returns {string} Fully encoded Google Calendar URL.
 */
export function generateGoogleCalendarUrl({
  title = 'Interview Session',
  description = '',
  location = '',
  startTime = null,
  durationMinutes = 45
}) {
  const start = startTime instanceof Date ? startTime : new Date(Date.now() + 86400000);
  const end = new Date(start.getTime() + (durationMinutes || 45) * 60000);

  const startIso = toGCalTimestamp(start);
  const endIso = toGCalTimestamp(end);

  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', title);
  params.set('dates', `${startIso}/${endIso}`);
  if (description) {
    params.set('details', description);
  }
  if (location) {
    params.set('location', location);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Escapes plain text for RFC 5545 iCalendar content lines.
 *
 * @param {string} str - Raw input text.
 * @returns {string} Escaped iCal text.
 */
function escapeIcsText(str = '') {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Produces an RFC 5545 compliant iCalendar string (.ics) for universal import
 * across Apple Calendar, Microsoft Outlook, and Google Calendar.
 *
 * @param {Object} options - Scheduling options.
 * @returns {string} RFC 5545 .ics formatted text.
 */
export function generateIcsContent({
  title = 'Interview Session',
  description = '',
  location = '',
  startTime = null,
  durationMinutes = 45
}) {
  const start = startTime instanceof Date ? startTime : new Date(Date.now() + 86400000);
  const end = new Date(start.getTime() + (durationMinutes || 45) * 60000);

  const dtStart = toGCalTimestamp(start);
  const dtEnd = toGCalTimestamp(end);
  const nowStamp = toGCalTimestamp(new Date());
  const uid = `career-agent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@careeragent.local`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CAREER.AGENT//Interview Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    location ? `LOCATION:${escapeIcsText(location)}` : '',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ]
    .filter(Boolean)
    .join('\r\n');
}

/**
 * Triggers a client-side download of an RFC 5545 .ics file.
 *
 * @param {Object} options - Scheduling options.
 */
export function downloadIcsFile(options = {}) {
  const icsContent = generateIcsContent(options);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const cleanTitle = (options.title || 'interview')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const link = document.createElement('a');
  link.href = url;
  link.download = `${cleanTitle || 'interview-event'}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

