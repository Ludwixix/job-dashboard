import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseMeetingDetailsFromText,
  extractInterviewMeetingInfo,
  deriveTrapsToAvoid,
  deriveNumbersToDrop,
  deriveStarStories,
  deriveReverseQuestions,
  deriveQnACards,
  generateInterviewCheatSheetHtml,
  openCheatSheetInNewTab,
  downloadCheatSheetHtml,
} from '../interviewCheatSheetService';

describe('interviewCheatSheetService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('parseMeetingDetailsFromText', () => {
    it('parses Microsoft Teams conference details, ID, passcode, and timing', () => {
      const emailText = `
        Microsoft Teams meeting
        Join: https://teams.microsoft.com/meet/269079741559951?p=1KLAZ7fN2N1mF1U6Xj
        Meeting ID: 269 079 741 559 951
        Passcode: ZB69tr3u
        Ive booked in the interview for 7:30am tomorrow, is that timing ok?
      `;

      const result = parseMeetingDetailsFromText(emailText);
      expect(result.platform).toBe('teams');
      expect(result.meetingUrl).toBe('https://teams.microsoft.com/meet/269079741559951?p=1KLAZ7fN2N1mF1U6Xj');
      expect(result.meetingId).toBe('269 079 741 559 951');
      expect(result.passcode).toBe('ZB69tr3u');
      expect(result.scheduledTime).toBe('7:30am');
    });

    it('parses Zoom meeting links and credentials', () => {
      const emailText = `
        Hi Sam,
        Join Zoom Meeting: https://us02web.zoom.us/j/84920485923?pwd=xyz
        Meeting ID: 849 2048 5923
        Passcode: 984210
        Time: 10:00 AM AEST
      `;

      const result = parseMeetingDetailsFromText(emailText);
      expect(result.platform).toBe('zoom');
      expect(result.meetingUrl).toBe('https://us02web.zoom.us/j/84920485923?pwd=xyz');
      expect(result.meetingId).toBe('849 2048 5923');
      expect(result.passcode).toBe('984210');
      expect(result.scheduledTime).toBe('10:00 AM AEST');
    });

    it('parses Google Meet links', () => {
      const emailText = 'Video call link: https://meet.google.com/abc-defg-hij at 2:30 PM';
      const result = parseMeetingDetailsFromText(emailText);
      expect(result.platform).toBe('meet');
      expect(result.meetingUrl).toBe('https://meet.google.com/abc-defg-hij');
      expect(result.scheduledTime).toBe('2:30 PM');
    });

    it('handles quoted-printable email formatting cleanly', () => {
      const emailText = 'Join: https://teams.microsoft.com/meet/12345?p=3Dabc=\r\n123\nMeeting ID: 123 456 789\nPasscode: testpass';
      const result = parseMeetingDetailsFromText(emailText);
      expect(result.platform).toBe('teams');
      expect(result.meetingUrl).toBe('https://teams.microsoft.com/meet/12345?p=abc123');
      expect(result.meetingId).toBe('123 456 789');
      expect(result.passcode).toBe('testpass');
    });

    it('returns empty defaults for null, empty or non-meeting text', () => {
      const result = parseMeetingDetailsFromText('');
      expect(result.platform).toBe('unknown');
      expect(result.meetingUrl).toBe('');
      expect(result.meetingId).toBe('');
      expect(result.passcode).toBe('');
    });
  });

  describe('extractInterviewMeetingInfo', () => {
    it('extracts meeting info and panel attendees from job email events and notes', () => {
      const sampleJob = {
        title: 'SharePoint and Automation Analyst',
        company: 'KBR',
        notes: `
          Ive booked in the interview for 7:30am tomorrow, is that timing ok?
          Mace and Lisle aren’t online yet to officially accepted but it looks suitable for them. Andrew Sidebottom will also join, he is based in Australia.
        `,
        email_events: [
          {
            subject: 'KBR Interview - SharePoint and Automation Analyst, Sam Ludwig',
            body: `
              Microsoft Teams meeting
              Join: https://teams.microsoft.com/meet/269079741559951?p=1KLAZ7fN2N1mF1U6Xj
              Meeting ID: 269 079 741 559 951
              Passcode: ZB69tr3u
            `,
          },
        ],
      };

      const extracted = extractInterviewMeetingInfo(sampleJob);
      expect(extracted.platform).toBe('teams');
      expect(extracted.meetingUrl).toContain('teams.microsoft.com');
      expect(extracted.meetingId).toBe('269 079 741 559 951');
      expect(extracted.passcode).toBe('ZB69tr3u');
      expect(extracted.scheduledTime).toBe('7:30am');
      expect(extracted.interviewers.length).toBeGreaterThanOrEqual(2);
      expect(extracted.interviewers.some(p => p.name.includes('Mace'))).toBe(true);
      expect(extracted.interviewers.some(p => p.name.includes('Lisle'))).toBe(true);
    });

    it('falls back to structured executive panel roles when no emails are present', () => {
      const sampleJob = {
        title: 'Cloud Systems Architect',
        company: 'Atlassian',
      };

      const extracted = extractInterviewMeetingInfo(sampleJob);
      expect(extracted.interviewers.length).toBe(3);
      expect(extracted.interviewers[0].role).toContain('Manager');
      expect(extracted.interviewers[1].role).toContain('Architect');
    });
  });

  describe('deriveTrapsToAvoid', () => {
    it('returns SharePoint and Nintex specific landmines for M365 roles', () => {
      const job = { title: 'SharePoint and Nintex Specialist' };
      const traps = deriveTrapsToAvoid(job);
      expect(traps.length).toBe(3);
      expect(traps[0]).toContain('Nintex');
      expect(traps[1]).toContain('Entra ID');
      expect(traps[2]).toContain('Service Principals');
    });

    it('returns DevOps and Cloud specific landmines for AWS/Cloud roles', () => {
      const job = { title: 'DevOps Engineer (AWS/Terraform)' };
      const traps = deriveTrapsToAvoid(job);
      expect(traps.length).toBe(3);
      expect(traps[0]).toContain('IaC');
    });
  });

  describe('deriveNumbersToDrop', () => {
    it('returns 6 high-impact numbers tailored to the domain', () => {
      const numbers = deriveNumbersToDrop({}, { title: 'SharePoint Engineer' });
      expect(numbers.length).toBe(6);
      expect(numbers.some(n => n.value === '5,000')).toBe(true);
      expect(numbers.some(n => n.value === '660k')).toBe(true);
    });
  });

  describe('deriveStarStories', () => {
    it('returns 5 verified STAR stories with Situation, Action, Result', () => {
      const stories = deriveStarStories();
      expect(stories.length).toBe(5);
      stories.forEach(s => {
        expect(s.title).toBeTruthy();
        expect(s.situation).toBeTruthy();
        expect(s.action).toBeTruthy();
        expect(s.result).toBeTruthy();
      });
    });
  });

  describe('deriveReverseQuestions', () => {
    it('synthesizes questions tailored to the company and role', () => {
      const questions = deriveReverseQuestions({ company: 'Telstra', title: 'Lead Platform Engineer' });
      expect(questions.length).toBeGreaterThanOrEqual(4);
      expect(questions[0].question).toContain('Telstra');
      expect(questions[0].targetAudience).toBeTruthy();
    });
  });

  describe('deriveQnACards', () => {
    it('synthesizes opening pitch, technical deep dives, and behavioral cards', () => {
      const cards = deriveQnACards({ company: 'KBR', title: 'Automation Analyst' }, { name: 'Sam Ludwig' });
      expect(cards.length).toBeGreaterThanOrEqual(4);
      expect(cards[0].id).toBe('pitch');
      expect(cards[0].spokenScript).toContain('Sam');
      expect(cards[0].scanBar).toContain('660k');
    });
  });

  describe('generateInterviewCheatSheetHtml', () => {
    it('generates a full standalone HTML document with 3-column layout and timers', () => {
      const job = {
        title: 'SharePoint and Automation Analyst',
        company: 'KBR',
        meetingUrl: 'https://teams.microsoft.com/meet/12345',
        meetingId: '123 456 789',
        passcode: 'ZB69tr3u',
      };

      const html = generateInterviewCheatSheetHtml(job);

      // Verify HTML boilerplate
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<title>KBR Master Interview Command Center — Sam Ludwig</title>');

      // Verify 3-column architecture
      expect(html).toContain('class="layout-grid"');
      expect(html).toContain('class="sidebar sidebar-left"');
      expect(html).toContain('class="main-column"');
      expect(html).toContain('class="sidebar sidebar-right"');

      // Verify meeting card
      expect(html).toContain('https://teams.microsoft.com/meet/12345');
      expect(html).toContain('123 456 789');
      expect(html).toContain('ZB69tr3u');

      // Verify 90s pacing timer and ADHD focus mode
      expect(html).toContain('90s Answer Timer');
      expect(html).toContain('toggleTimer');
      expect(html).toContain('toggleFocusMode');
      expect(html).toContain('body.focus-mode');

      // Verify spoken scripts and STAR stories
      expect(html).toContain('What to Actually Say');
      expect(html).toContain('5-Second Brain Glances');
      expect(html).toContain('5 Verified STAR Stories');
      expect(html).toContain('660,000 users');
      expect(html).toContain('localStorage.setItem');
    });
  });

  describe('openCheatSheetInNewTab & downloadCheatSheetHtml', () => {
    it('opens window without throwing error', () => {
      const openSpy = vi.spyOn(window, 'open').mockReturnValue({
        document: { title: '', open: vi.fn(), write: vi.fn(), close: vi.fn() },
      });

      const win = openCheatSheetInNewTab('<html><body>Test</body></html>', 'Test Title');
      expect(openSpy).toHaveBeenCalled();
      expect(win).toBeDefined();
    });

    it('triggers download without throwing error', () => {
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      downloadCheatSheetHtml({ company: 'KBR', title: 'SharePoint Analyst' }, '<html>test</html>');
      expect(clickSpy).toHaveBeenCalled();
    });
  });
});
