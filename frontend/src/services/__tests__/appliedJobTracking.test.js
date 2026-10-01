import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  getUnifiedAppliedLookup, 
  isJobAppliedOrTracked, 
  saveUserApplication,
  normalizeJobKey 
} from '../dataService';
import { saveUserApplicationToBackend } from '../trackerService';

describe('Unified Applied Job Tracking and Deduplication', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('correctly matches jobs across different ID representations (prefix stripping)', () => {
    // Stored with 'seek-12345678'
    localStorage.setItem('job_dashboard_local_applications', JSON.stringify({
      'seek-12345678': {
        id: 'seek-12345678',
        company: 'Telstra',
        title: 'Senior Cloud Engineer',
        status: 'Applied'
      }
    }));

    const lookup = getUnifiedAppliedLookup();

    // Raw job with prefix
    expect(isJobAppliedOrTracked({ id: 'seek-12345678', company: 'Telstra', title: 'Senior Cloud Engineer' }, lookup)).toBe(true);

    // Raw job with pure numeric ID
    expect(isJobAppliedOrTracked({ id: '12345678', company: 'Telstra', title: 'Senior Cloud Engineer' }, lookup)).toBe(true);

    // Unrelated job
    expect(isJobAppliedOrTracked({ id: '99999999', company: 'Optus', title: 'Network Admin' }, lookup)).toBe(false);
  });

  it('matches jobs by normalized company and title regardless of punctuation or corporate suffixes', () => {
    localStorage.setItem('tracked_applications', JSON.stringify([
      {
        id: 'app-99',
        company: 'Acme Technologies Pty Ltd',
        title: 'Lead Systems Engineer (Immediate Start)',
        status: 'Applied / In Review'
      }
    ]));

    const lookup = getUnifiedAppliedLookup();

    // Different spelling/casing/suffix on scraped job
    const scrapedJob = {
      id: 'scraped-001',
      company: 'ACME Technologies Australia',
      title: 'Lead Systems Engineer',
      status: 'Discovered'
    };

    expect(isJobAppliedOrTracked(scrapedJob, lookup)).toBe(true);
  });

  it('matches jobs by clean portal/job URL', () => {
    localStorage.setItem('job_dashboard_local_applications', JSON.stringify({
      'app-url-1': {
        id: 'app-url-1',
        url: 'https://www.seek.com.au/job/7891011?tracking=search',
        company: 'Commonwealth Bank',
        title: 'Infrastructure Specialist'
      }
    }));

    const lookup = getUnifiedAppliedLookup();

    const scrapedJob = {
      id: 'diff-id-456',
      url: 'https://www.seek.com.au/job/7891011',
      company: 'CBA',
      title: 'Infrastructure Spec'
    };

    expect(isJobAppliedOrTracked(scrapedJob, lookup)).toBe(true);
  });

  it('detects progressed status directly on the job object', () => {
    expect(isJobAppliedOrTracked({ status: 'Applied / Confirmation Received' })).toBe(true);
    expect(isJobAppliedOrTracked({ status: 'Interview Stage 2' })).toBe(true);
    expect(isJobAppliedOrTracked({ status: 'Offer Received' })).toBe(true);
    expect(isJobAppliedOrTracked({ status: 'Under Review' })).toBe(true);
    expect(isJobAppliedOrTracked({ status: 'Discovered' })).toBe(false);
    expect(isJobAppliedOrTracked({ status: 'sourced' })).toBe(false);
  });

  it('saveUserApplication synchronizes to both local storage caches and broadcasts events', async () => {
    const eventSpy = vi.fn();
    window.addEventListener('application-status-updated', eventSpy);

    const jobData = {
      id: 'job-xyz-100',
      company: 'Atlassian',
      title: 'Site Reliability Engineer',
      status: 'Applied'
    };

    await saveUserApplication(jobData);

    // Verify written to job_dashboard_local_applications
    const local = JSON.parse(localStorage.getItem('job_dashboard_local_applications') || '{}');
    expect(local['job-xyz-100']).toBeDefined();
    expect(local['job-xyz-100'].company).toBe('Atlassian');

    // Verify written to tracked_applications
    const tracked = JSON.parse(localStorage.getItem('tracked_applications') || '[]');
    expect(tracked.some(a => a.id === 'job-xyz-100')).toBe(true);

    // Verify window event was dispatched
    expect(eventSpy).toHaveBeenCalled();
    window.removeEventListener('application-status-updated', eventSpy);
  });

  it('saveUserApplicationToBackend synchronizes across all caches and dispatches window events', async () => {
    const eventSpy = vi.fn();
    window.addEventListener('job-applied', eventSpy);

    const jobData = {
      id: 'custom-job-200',
      company: 'Canva',
      title: 'Platform Engineer',
      status: 'Applied'
    };

    await saveUserApplicationToBackend(jobData, 'test-user-id');

    // Verify written to tracked_applications
    const tracked = JSON.parse(localStorage.getItem('tracked_applications') || '[]');
    expect(tracked.some(a => a.id === 'custom-job-200')).toBe(true);

    // Verify written to jobOverrides
    const overrides = JSON.parse(localStorage.getItem('jobOverrides') || '{}');
    expect(overrides['custom-job-200']).toBeDefined();
    expect(overrides['custom-job-200'].status).toBe('Applied');

    // Verify event fired
    expect(eventSpy).toHaveBeenCalled();
    window.removeEventListener('job-applied', eventSpy);
  });
});
