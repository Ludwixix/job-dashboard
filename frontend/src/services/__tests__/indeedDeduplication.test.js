import { describe, it, expect } from 'vitest';
import { cleanJobUrl } from '../dataService';

describe('cleanJobUrl & Indeed URL Preservation', () => {
  it('preserves Indeed ?jk= parameter while stripping tracking params', () => {
    const rawUrl = 'https://au.indeed.com/viewjob?jk=07ecce32d08b367f&utm_source=feed&ref=job_board';
    const cleaned = cleanJobUrl(rawUrl);
    expect(cleaned).toContain('jk=07ecce32d08b367f');
    expect(cleaned).not.toContain('utm_source');
    expect(cleaned).not.toContain('ref=');
  });

  it('ensures distinct Indeed jobs do not produce identical cleaned URLs', () => {
    const job1Url = 'https://au.indeed.com/viewjob?jk=07ecce32d08b367f';
    const job2Url = 'https://au.indeed.com/viewjob?jk=b02b0bbb35286cd5';
    expect(cleanJobUrl(job1Url)).not.toEqual(cleanJobUrl(job2Url));
  });

  it('removes fragments from URLs', () => {
    const urlWithHash = 'https://www.seek.com.au/job/12345#applySection';
    expect(cleanJobUrl(urlWithHash)).toBe('https://www.seek.com.au/job/12345');
  });
});

