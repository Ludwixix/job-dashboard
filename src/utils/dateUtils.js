/**
 * dateUtils.js
 * Single source of truth for "how old is this job posting" across every job
 * card, filter, and ranking surface.
 *
 * Previously, ~5 components each had their own near-duplicate implementation
 * that defaulted missing/unparseable posted dates to age=0 ("posted today").
 * That silently let stale, expired, or garbage-dated listings (e.g. a source
 * accidentally capturing a UI badge like "Featured" instead of the real
 * date) display as freshly posted and pass every "posted in the last N days"
 * filter. Callers must treat a null age/date as genuinely unknown, not as
 * the most-recent possible value.
 */
import { parseISO, isValid } from 'date-fns';

/** Parses ISO dates, common relative formats ("9d ago"), and loose date strings. */
export const parseJobPostedDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const str = dateStr.trim();
  if (!str) return null;

  const lower = str.toLowerCase();
  if (lower.includes('today') || lower.includes('just now') || lower.includes('hour')) {
    return new Date();
  }

  const dayMatch = str.match(/(\d+)\s*d(?:ay)?/i);
  if (dayMatch) {
    const parsedDate = new Date();
    parsedDate.setDate(parsedDate.getDate() - parseInt(dayMatch[1], 10));
    return parsedDate;
  }

  const isoDate = parseISO(str);
  if (isValid(isoDate)) return isoDate;

  const looseDate = new Date(str);
  if (!isNaN(looseDate.getTime())) return looseDate;

  return null;
};

/**
 * Days since posting, or null when the date is missing/unparseable. Callers
 * MUST check for null explicitly — `null <= 13` is `true` in JavaScript, so
 * naively reusing this in a numeric comparison silently reintroduces the bug.
 */
export const getJobAgeInDays = (dateStr) => {
  const parsed = parseJobPostedDate(dateStr);
  if (!parsed) return null;
  const diffMs = Date.now() - parsed.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return days >= 0 ? days : null;
};

/** Human-readable "posted X days ago" label; honest about unknown dates instead of implying freshness. */
export const formatJobPostedAge = (dateStr) => {
  const age = getJobAgeInDays(dateStr);
  if (age === null) return 'Date unavailable';
  if (age === 0) return 'Today';
  if (age === 1) return '1 day ago';
  return `${age} days ago`;
};

/** Compare two posted-date values; unknown dates always sort after known dates. */
export const compareJobPostedDates = (left, right, direction = 'desc') => {
  const leftDate = parseJobPostedDate(left);
  const rightDate = parseJobPostedDate(right);
  if (!leftDate && !rightDate) return 0;
  if (!leftDate) return 1;
  if (!rightDate) return -1;
  const comparison = leftDate.getTime() - rightDate.getTime();
  return direction === 'asc' ? comparison : -comparison;
};
