import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWorkforceSettings,
  saveWorkforceSettings,
  calculatePBASPoints,
  formatPortalSubmissionText,
  generateWorkforceCsvString,
  getCycleDateRange
} from '../workforceAustraliaService';

describe('workforceAustraliaService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('settings management', () => {
    it('returns default settings when none are stored (disabled by default)', () => {
      const settings = getWorkforceSettings();
      expect(settings.enabled).toBe(false);
      expect(settings.pointsTarget).toBe(100);
      expect(settings.cycleStartDay).toBe(1);
      expect(settings.jobseekerId).toBe('');
      expect(settings.providerName).toBe('');
    });

    it('saves and retrieves updated settings', () => {
      const updated = saveWorkforceSettings({
        enabled: true,
        pointsTarget: 80,
        cycleStartDay: 15,
        jobseekerId: 'JS987654321',
        providerName: 'Workforce Australia APM'
      });

      expect(updated.enabled).toBe(true);
      expect(updated.pointsTarget).toBe(80);
      expect(updated.cycleStartDay).toBe(15);
      expect(updated.jobseekerId).toBe('JS987654321');

      const retrieved = getWorkforceSettings();
      expect(retrieved.enabled).toBe(true);
      expect(retrieved.pointsTarget).toBe(80);
      expect(retrieved.jobseekerId).toBe('JS987654321');
    });
  });

  describe('cycle date calculation', () => {
    it('calculates calendar month cycle when cycleStartDay is 1', () => {
      const refDate = new Date(2026, 8, 10); // 10 Sep 2026
      const { start, end, label } = getCycleDateRange(1, refDate);
      expect(start.getFullYear()).toBe(2026);
      expect(start.getMonth()).toBe(8);
      expect(start.getDate()).toBe(1);
      expect(end.getDate()).toBe(30);
      expect(label).toContain('Sep 2026');
    });

    it('calculates rolling mid-month cycle when cycleStartDay is 15', () => {
      const refDate = new Date(2026, 8, 20); // 20 Sep 2026
      const { start, end } = getCycleDateRange(15, refDate);
      expect(start.getDate()).toBe(15);
      expect(start.getMonth()).toBe(8);
      expect(end.getDate()).toBe(14);
      expect(end.getMonth()).toBe(9);
    });
  });

  describe('calculatePBASPoints', () => {
    const sampleJobs = [
      {
        id: 'job-1',
        title: 'Systems Administrator',
        company: 'Acme Health',
        status: 'applied',
        applied_at: '2026-09-02T10:00:00Z',
        url: 'https://seek.com.au/job/1'
      },
      {
        id: 'job-2',
        title: 'Infrastructure Engineer',
        company: 'Global Logistics',
        status: 'interviewing',
        applied_at: '2026-09-04T12:00:00Z',
        url: 'https://linkedin.com/jobs/2'
      },
      {
        id: 'job-3',
        title: 'Cloud Specialist',
        company: 'FinTech Hub',
        status: 'applied',
        applied_at: '2026-08-10T10:00:00Z',
        url: 'https://indeed.com/viewjob/3'
      },
      {
        id: 'job-4',
        title: 'Senior Consultant',
        company: 'Enterprise Tech',
        status: 'sourced',
        url: 'https://seek.com.au/job/4'
      }
    ];

    it('correctly calculates points within reporting cycle', () => {
      const refDate = new Date(2026, 8, 15);
      const result = calculatePBASPoints(sampleJobs, {
        cycleStartDay: 1,
        pointsTarget: 100,
        referenceDate: refDate
      });

      expect(result.totalPoints).toBe(25);
      expect(result.pointsTarget).toBe(100);
      expect(result.pointsRemaining).toBe(75);
      expect(result.percentage).toBe(25);
      expect(result.isMet).toBe(false);
      expect(result.applicationCount).toBe(1);
      expect(result.interviewCount).toBe(1);
      expect(result.items.length).toBe(2);
    });

    it('handles point target exceeded', () => {
      const manyInterviews = Array.from({ length: 6 }).map((_, i) => ({
        id: `int-${i}`,
        title: `Role ${i}`,
        company: `Company ${i}`,
        status: 'interviewing',
        applied_at: '2026-09-05T09:00:00Z'
      }));

      const result = calculatePBASPoints(manyInterviews, {
        cycleStartDay: 1,
        pointsTarget: 100,
        referenceDate: new Date(2026, 8, 15)
      });

      expect(result.totalPoints).toBe(120);
      expect(result.pointsRemaining).toBe(0);
      expect(result.surplusPoints).toBe(20);
      expect(result.isMet).toBe(true);
    });
  });

  describe('formatting and CSV exports', () => {
    it('formats a clean copy string for the Workforce Australia portal', () => {
      const item = {
        title: 'Infrastructure Specialist',
        company: 'St Vincent Hospital',
        status: 'applied',
        applied_at: '2026-09-03T11:00:00Z',
        url: 'https://seek.com.au/job/999',
        source: 'SEEK'
      };

      const copyText = formatPortalSubmissionText(item);
      expect(copyText).toContain('Employer: St Vincent Hospital');
      expect(copyText).toContain('Position: Infrastructure Specialist');
      expect(copyText).toContain('Method: Online Application (SEEK)');
      expect(copyText).toContain('Status: Applied');
      expect(copyText).toContain('Date: 2026-09-03');
    });

    it('generates compliant CSV with header and proper fields', () => {
      const items = [
        {
          dateStr: '2026-09-03',
          company: 'St Vincent Hospital',
          title: 'Infrastructure Specialist',
          type: 'Job Application',
          pointsAwarded: 5,
          channel: 'SEEK',
          status: 'Applied',
          evidenceUrl: 'https://seek.com.au/job/999'
        }
      ];

      const csv = generateWorkforceCsvString(items, {
        candidateName: 'Samuel Ludwig',
        jobseekerId: 'JS12345'
      });

      expect(csv).toContain('Date,Employer / Business Name,Job Title,Activity Type,Points,Channel / Method,Status,Evidence / Listing URL');
      expect(csv).toContain('"2026-09-03","St Vincent Hospital","Infrastructure Specialist","Job Application","5","SEEK","Applied"');
    });
  });
});
