import { describe, it, expect } from 'vitest';
import { calculateProfileCompleteness } from '../profiles/profileCompleteness';

describe('calculateProfileCompleteness', () => {
  it('gives 100% when standard candidate profile fields are provided', () => {
    const profile = {
      name: 'Jane Doe',
      industry: 'Technology & IT',
      targetTitles: ['Frontend Engineer'],
      coreSkills: ['React', 'TypeScript', 'CSS'],
      location: 'Melbourne, VIC',
      workHistorySummary: 'Experienced frontend engineer with 5 years building responsive web apps.'
    };

    const result = calculateProfileCompleteness(profile);
    expect(result.score).toBe(100);
    expect(result.isComplete).toBe(true);
    expect(result.improvements).toHaveLength(0);
  });

  it('supports snake_case and alias field names from backend / scrapers', () => {
    const profile = {
      candidate_name: 'Alex Smith',
      domain: 'Healthcare & Nursing',
      target_roles: ['Registered Nurse'],
      core_skills: ['Triage', 'Patient Care', 'CPR'],
      suburb: 'Richmond',
      work_history_summary: 'Senior Registered Nurse with acute care and emergency ward leadership.'
    };

    const result = calculateProfileCompleteness(profile);
    expect(result.score).toBe(100);
    expect(result.isComplete).toBe(true);
    expect(result.improvements).toHaveLength(0);
  });

  it('awards full skills points when 3 or more core skills are present and does not nag to add more', () => {
    const profile = {
      name: 'Sam',
      industry: 'Technology & IT',
      targetTitles: ['Systems Engineer'],
      coreSkills: ['Linux', 'Bash', 'Docker'],
      location: 'Sydney',
      workHistorySummary: 'Experienced systems administrator managing containerized infrastructure.'
    };

    const result = calculateProfileCompleteness(profile);
    const skillImprovement = result.improvements.find(i => i.id === 'skills');
    expect(skillImprovement).toBeUndefined();
    expect(result.score).toBe(100);
  });

  it('suggests adding skills when fewer than 3 skills are present', () => {
    const profile = {
      name: 'Sam',
      industry: 'Technology & IT',
      targetTitles: ['Systems Engineer'],
      coreSkills: ['Linux'],
      location: 'Sydney',
      workHistorySummary: 'Experienced systems administrator managing containerized infrastructure.'
    };

    const result = calculateProfileCompleteness(profile);
    const skillImprovement = result.improvements.find(i => i.id === 'skills');
    expect(skillImprovement).toBeDefined();
    expect(result.score).toBeLessThan(100);
  });

  it('accepts projects or work experience text as valid experience history', () => {
    const profileWithProjects = {
      name: 'Developer',
      industry: 'Technology & IT',
      targetTitles: ['Full Stack Developer'],
      coreSkills: ['Node.js', 'PostgreSQL', 'React'],
      location: 'Brisbane',
      projects: [{ name: 'Portal', description: 'Enterprise job dashboard' }]
    };

    const result = calculateProfileCompleteness(profileWithProjects);
    expect(result.score).toBe(100);
    expect(result.isComplete).toBe(true);
  });
});
