import { describe, expect, it } from 'vitest';
import { compareJobPostedDates } from '../dateUtils';

describe('compareJobPostedDates', () => {
  it('sorts newest first and reverses to oldest first', () => {
    const old = '2026-08-20';
    const recent = '2026-08-28';
    expect(compareJobPostedDates(old, recent, 'desc')).toBeGreaterThan(0);
    expect(compareJobPostedDates(old, recent, 'asc')).toBeLessThan(0);
  });

  it('puts unknown dates after valid dates in either direction', () => {
    expect(compareJobPostedDates('Featured', '2026-08-28', 'desc')).toBeGreaterThan(0);
    expect(compareJobPostedDates('Featured', '2026-08-28', 'asc')).toBeGreaterThan(0);
  });
});