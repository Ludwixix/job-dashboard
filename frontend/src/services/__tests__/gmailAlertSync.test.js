import { describe, it, expect } from 'vitest';
import { parseJobAlertEmail, scoreJobTitleForAlert } from '../gmailSyncService';

describe('Gmail Job Alerts & Suggested Opportunities Parsing', () => {
  it('correctly scores target titles and suppresses L1 helpdesk / technician noise', () => {
    expect(scoreJobTitleForAlert('Senior Infrastructure Engineer')).toBeGreaterThanOrEqual(90);
    expect(scoreJobTitleForAlert('Senior Systems Administrator')).toBeGreaterThanOrEqual(88);
    expect(scoreJobTitleForAlert('Cloud Engineer')).toBeGreaterThanOrEqual(88);

    // Suppressed noise
    expect(scoreJobTitleForAlert('Level 1 Helpdesk Technician')).toBeLessThan(50);
    expect(scoreJobTitleForAlert('EFTPOS Field Service Technician')).toBeLessThan(50);
    expect(scoreJobTitleForAlert('Junior Desktop Support Specialist')).toBeLessThan(50);
  });

  it('parses multi-job SEEK alert digest into individual job cards and filters noise', () => {
    const from = 'alerts@seek.com.au';
    const subject = 'Jobs recommended for you based on your activity';
    const body = `
      Jobs recommended for you based on your activity:

      Senior Infrastructure Engineer
      Centorrino Technologies - Melbourne VIC
      $130k - $150k
      https://www.seek.com.au/job/78910111

      Level 1 Helpdesk Technician
      Retail IT Services - Dandenong VIC
      $55,000
      https://www.seek.com.au/job/78910112

      Cloud Systems Engineer
      Versent - Melbourne VIC
      https://www.seek.com.au/job/78910113
    `;

    const jobs = parseJobAlertEmail(from, subject, body, '', 60);

    expect(jobs.length).toBe(2);
    const titles = jobs.map(j => j.title);
    expect(titles).toContain('Senior Infrastructure Engineer');
    expect(titles).toContain('Cloud Systems Engineer');
    expect(titles).not.toContain('Level 1 Helpdesk Technician');

    expect(jobs[0].source).toBe('Gmail Alert');
    expect(jobs[0].score).toBeGreaterThanOrEqual(60);
    expect(jobs[0].url).toContain('seek.com.au/job/78910111');
  });

  it('parses LinkedIn job alert emails', () => {
    const from = 'jobalerts-noreply@linkedin.com';
    const subject = "Sam, 3 new jobs for 'Senior Systems Administrator'";
    const body = `
      Sam, 3 new jobs for 'Senior Systems Administrator'

      Senior Systems Administrator
      Macquarie Group
      Melbourne, Victoria, Australia
      https://www.linkedin.com/comm/jobs/view/4123456789/

      Service Desk Technician L1
      Terminal Support
      https://www.linkedin.com/comm/jobs/view/4123456790/
    `;

    const jobs = parseJobAlertEmail(from, subject, body, '', 60);
    expect(jobs.length).toBe(1);
    expect(jobs[0].title).toBe('Senior Systems Administrator');
    expect(jobs[0].company).toBe('Macquarie Group');
    expect(jobs[0].source).toBe('Gmail Alert');
  });
});
