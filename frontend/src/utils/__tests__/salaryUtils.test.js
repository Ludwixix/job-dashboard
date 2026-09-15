import { describe, it, expect } from 'vitest';
import { parseSalaryNumeric, matchesSalaryThreshold } from '../salaryUtils';

describe('salaryUtils - parseSalaryNumeric', () => {
  it('handles null, undefined and empty jobs gracefully', () => {
    expect(parseSalaryNumeric(null)).toEqual({ min: null, max: null, isAnnual: true, raw: '' });
    expect(parseSalaryNumeric({})).toEqual({ min: null, max: null, isAnnual: true, raw: '' });
    expect(parseSalaryNumeric({ salary: '' })).toEqual({ min: null, max: null, isAnnual: true, raw: '' });
  });

  it('prefers structured numeric backend fields if available', () => {
    const job = {
      salary: '$120,000 - $140,000',
      salary_min: 130000,
      salary_max: 150000
    };
    const parsed = parseSalaryNumeric(job);
    expect(parsed.min).toBe(130000);
    expect(parsed.max).toBe(150000);
    expect(parsed.isAnnual).toBe(true);
  });

  it('parses Australian comma-formatted annual ranges', () => {
    const job = { salary: '$140,000 - $170,000 + Super' };
    const parsed = parseSalaryNumeric(job);
    expect(parsed.min).toBe(140000);
    expect(parsed.max).toBe(170000);
    expect(parsed.isAnnual).toBe(true);
  });

  it('parses shorthand "k" values accurately', () => {
    const job = { salary: '$120k - $150k' };
    const parsed = parseSalaryNumeric(job);
    expect(parsed.min).toBe(120000);
    expect(parsed.max).toBe(150000);

    const singleJob = { salary: '$165k base' };
    const singleParsed = parseSalaryNumeric(singleJob);
    expect(singleParsed.min).toBe(165000);
    expect(singleParsed.max).toBe(165000);
  });

  it('parses hourly contractor rates and annualizes them', () => {
    const job = { salary: '$75 - $90 / hr' };
    const parsed = parseSalaryNumeric(job);
    expect(parsed.isAnnual).toBe(false);
    expect(parsed.min).toBe(75 * 1950);
    expect(parsed.max).toBe(90 * 1950);
  });

  it('parses daily contractor rates and annualizes them', () => {
    const job = { salary: '$800 - $1,000 per day' };
    const parsed = parseSalaryNumeric(job);
    expect(parsed.isAnnual).toBe(false);
    expect(parsed.min).toBe(800 * 230);
    expect(parsed.max).toBe(1000 * 230);
  });

  it('handles non-numeric strings safely', () => {
    const job = { salary: 'Competitive Market Remuneration + Super' };
    const parsed = parseSalaryNumeric(job);
    expect(parsed.min).toBe(null);
    expect(parsed.max).toBe(null);
  });
});

describe('salaryUtils - matchesSalaryThreshold', () => {
  it('returns true for "All" or empty threshold', () => {
    expect(matchesSalaryThreshold({ salary: '$80,000' }, 'All')).toBe(true);
    expect(matchesSalaryThreshold({ salary: null }, 'All')).toBe(true);
    expect(matchesSalaryThreshold(null, 'All')).toBe(true);
  });

  it('evaluates "100k+" correctly for higher and boundary values', () => {
    // $140,000 should match 100k+
    expect(matchesSalaryThreshold({ salary: '$140,000 - $160,000' }, '100k+')).toBe(true);
    // $150k shorthand
    expect(matchesSalaryThreshold({ salary: '$150k' }, '100k+')).toBe(true);
    // $100,000 exact
    expect(matchesSalaryThreshold({ salary: '$100,000' }, '100k+')).toBe(true);
    // Below 100k should fail
    expect(matchesSalaryThreshold({ salary: '$85,000' }, '100k+')).toBe(false);
    expect(matchesSalaryThreshold({ salary: '$60k - $80k' }, '100k+')).toBe(false);
    // $45,100 should NOT match 100k+ even though it contains "100"
    expect(matchesSalaryThreshold({ salary: '$45,100' }, '100k+')).toBe(false);
  });

  it('evaluates "70k+" correctly', () => {
    expect(matchesSalaryThreshold({ salary: '$85,000' }, '70k+')).toBe(true);
    expect(matchesSalaryThreshold({ salary: '$55,000' }, '70k+')).toBe(false);
  });

  it('excludes undisclosed salaries when filtering by positive minimum', () => {
    expect(matchesSalaryThreshold({ salary: 'Negotiable' }, '100k+')).toBe(false);
    expect(matchesSalaryThreshold({ salary: '' }, '100k+')).toBe(false);
    expect(matchesSalaryThreshold({}, '100k+')).toBe(false);
  });
});

