import { describe, it, expect, vi } from 'vitest';
import {
  formatCalendarBriefing,
  generateGoogleCalendarUrl,
  generateIcsContent,
  downloadIcsFile
} from '../calendarService';

describe('calendarService', () => {
  const mockJob = {
    id: 'job-123',
    title: 'Principal Systems Architect',
    company: 'Atlassian Australia',
    location: 'Sydney, NSW (Hybrid)',
    salary: '$210,000 - $240,000 + Super',
    matchScore: 92,
    score_breakdown: {
      semantic_density: 95,
      skills_match: 90
    },
    key_requirements: ['Distributed Systems', 'Go / Python', 'Cloud Architecture'],
    star_highlights: [
      'Engineered multi-region failover handling 4.2M daily transactions'
    ]
  };

  const dynamicFutureDate = new Date(Date.now() + 3 * 86400000); // 3 days in future

  describe('formatCalendarBriefing', () => {
    it('generates a comprehensive structured interview briefing packet', () => {
      const briefing = formatCalendarBriefing(mockJob, {
        interviewType: 'System Architecture Deep Dive',
        interviewers: 'Jane Doe (VP Eng), John Smith (Lead Architect)',
        meetingLink: 'https://meet.google.com/xyz-abc-qrs'
      });

      expect(briefing).toContain('CAREER.AGENT PRE-INTERVIEW BRIEFING');
      expect(briefing).toContain('Principal Systems Architect');
      expect(briefing).toContain('Atlassian Australia');
      expect(briefing).toContain('$210,000 - $240,000 + Super');
      expect(briefing).toContain('System Architecture Deep Dive');
      expect(briefing).toContain('Jane Doe (VP Eng)');
      expect(briefing).toContain('https://meet.google.com/xyz-abc-qrs');
      expect(briefing).toContain('Distributed Systems');
      expect(briefing).toContain('Engineered multi-region failover');
      expect(briefing).toContain('HIGH-VALUE QUESTIONS TO ASK');
    });

    it('handles minimal job details gracefully without crashing', () => {
      const briefing = formatCalendarBriefing({ title: 'Software Engineer', company: 'Canva' });
      expect(briefing).toContain('Software Engineer');
      expect(briefing).toContain('Canva');
      expect(briefing).toContain('CAREER.AGENT PRE-INTERVIEW BRIEFING');
    });
  });

  describe('generateGoogleCalendarUrl', () => {
    it('constructs a valid Google Calendar TEMPLATE url with compact ISO dates', () => {
      const startTime = new Date(Date.UTC(2026, 8, 20, 10, 0, 0)); // Sep 20, 2026 10:00:00 UTC
      const url = generateGoogleCalendarUrl({
        title: 'Interview with Atlassian',
        description: 'System Architecture Round',
        location: 'https://meet.google.com/xyz',
        startTime,
        durationMinutes: 60
      });

      expect(url).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE');
      expect(url).toContain('text=Interview+with+Atlassian');
      expect(url).toContain('location=https%3A%2F%2Fmeet.google.com%2Fxyz');
      expect(url).toContain('dates=20260920T100000Z%2F20260920T110000Z');
      expect(url).toContain('details=System+Architecture+Round');
    });

    it('defaults duration to 45 minutes when unspecified', () => {
      const startTime = new Date(Date.UTC(2026, 8, 20, 14, 0, 0));
      const url = generateGoogleCalendarUrl({
        title: 'Screening Call',
        startTime
      });

      // 14:00 to 14:45 UTC
      expect(url).toContain('dates=20260920T140000Z%2F20260920T144500Z');
    });
  });

  describe('generateIcsContent', () => {
    it('produces an RFC 5545 compliant iCalendar string', () => {
      const startTime = new Date(Date.UTC(2026, 8, 20, 10, 0, 0));
      const ics = generateIcsContent({
        title: 'Tech Screen: Canva',
        description: 'Line 1\nLine 2, with comma and; semicolon',
        location: 'Zoom Meeting',
        startTime,
        durationMinutes: 30
      });

      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('VERSION:2.0');
      expect(ics).toContain('PRODID:-//CAREER.AGENT//Interview Calendar//EN');
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('SUMMARY:Tech Screen: Canva');
      expect(ics).toContain('DTSTART:20260920T100000Z');
      expect(ics).toContain('DTEND:20260920T103000Z');
      expect(ics).toContain('LOCATION:Zoom Meeting');
      // Verify iCal escaping for newlines
      expect(ics).toContain('DESCRIPTION:Line 1\\nLine 2\\, with comma and\\; semicolon');
      expect(ics).toContain('END:VEVENT');
      expect(ics).toContain('END:VCALENDAR');
    });
  });

  describe('downloadIcsFile', () => {
    it('triggers DOM element creation and click for download', () => {
      const clickMock = vi.fn();
      const mockAnchor = {
        href: '',
        download: '',
        click: clickMock
      };
      
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
      const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/dummy');
      const revokeObjectURLMock = vi.fn();
      
      global.URL.createObjectURL = createObjectURLMock;
      global.URL.revokeObjectURL = revokeObjectURLMock;

      downloadIcsFile({
        title: 'Canva Interview',
        description: 'Briefing',
        startTime: dynamicFutureDate
      });

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockAnchor.download).toBe('canva-interview.ics');
      expect(clickMock).toHaveBeenCalled();

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });
  });
});
