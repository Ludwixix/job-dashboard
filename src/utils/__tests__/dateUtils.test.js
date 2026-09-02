import { describe, expect, it } from 'vitest';
import { getJobAgeInDays, formatJobPostedAge, parseJobPostedDate } from '../dateUtils';

describe('dateUtils', () => {
  it('parses valid ISO dates and computes age in days', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(getJobAgeInDays(tenDaysAgo)).toBe(10);
    expect(formatJobPostedAge(tenDaysAgo)).toBe('10 days ago');
  });

  it('recognizes relative "Xd ago" style dates, even with trailing garbage', () => {
    expect(getJobAgeInDays('9d ago')).toBe(9);
    expect(getJobAgeInDays('9d ago\u2022Expiring')).toBe(9);
  });

  it('returns null (not 0) for missing, empty, or unparseable dates instead of implying "posted today"', () => {
    expect(getJobAgeInDays(undefined)).toBeNull();
    expect(getJobAgeInDays('')).toBeNull();
    expect(getJobAgeInDays('Featured')).toBeNull();
    expect(getJobAgeInDays('Wed, 26 Au')).toBeNull();
    expect(parseJobPostedDate('Featured')).toBeNull();
  });

  it('formats unknown dates honestly instead of "Recently"/"Today"', () => {
    expect(formatJobPostedAge('Featured')).toBe('Date unavailable');
    expect(formatJobPostedAge(undefined)).toBe('Date unavailable');
  });

  it('formats today and yesterday distinctly', () => {
    expect(formatJobPostedAge(new Date().toISOString())).toBe('Today');
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(formatJobPostedAge(yesterday)).toBe('1 day ago');
  });
});
