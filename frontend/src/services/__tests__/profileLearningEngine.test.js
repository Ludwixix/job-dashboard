import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractSkillsAndContextFromJob,
  recordJobInteraction,
  getLearnedContext,
  evolveProfileFromLearnedContext,
  generateSmartJobSuggestions,
  resetLearnedContext
} from '../profileLearningEngine';

describe('profileLearningEngine', () => {
  beforeEach(() => {
    localStorage.clear();
    resetLearnedContext();
  });

  const baseProfile = {
    id: 'sam_ludwig',
    name: 'Sam Ludwig',
    title: 'Senior Systems & Infrastructure Engineer',
    industry: 'Technology & IT',
    coreSkills: ['Microsoft 365', 'Azure Cloud', 'PowerShell Automation'],
    targetTitles: ['Senior Systems Engineer', 'Cloud Infrastructure Engineer'],
    targetSalary: '$140,000 - $165,000 + Super',
    location: 'Melbourne, VIC'
  };

  const sampleJob = {
    id: 'job-docker-1',
    title: 'Cloud Infrastructure & Platform Engineer',
    company: 'Enterprise FinTech',
    location: 'Melbourne, VIC',
    salary: '$155,000 + Super',
    description: 'Seeking a Systems Engineer with deep expertise in Kubernetes, Docker, Terraform, and Microsoft 365 tenant migration.',
    tags: ['Kubernetes', 'Docker', 'Terraform', 'Azure']
  };

  describe('extractSkillsAndContextFromJob', () => {
    it('extracts technical skills and salary hints from job description and tags', () => {
      const extracted = extractSkillsAndContextFromJob(sampleJob);
      expect(extracted.skills).toContain('Kubernetes');
      expect(extracted.skills).toContain('Docker');
      expect(extracted.skills).toContain('Terraform');
      expect(extracted.salary).toBe(155000);
      expect(extracted.title).toBe('Cloud Infrastructure & Platform Engineer');
    });
  });

  describe('recordJobInteraction', () => {
    it('tracks learned skills, frequency, and interaction counts over time', () => {
      recordJobInteraction(sampleJob, 'applied', baseProfile);
      recordJobInteraction(sampleJob, 'starred', baseProfile);

      const context = getLearnedContext(baseProfile.id);
      expect(context.totalInteractions).toBe(2);
      expect(context.skillsFrequency['Kubernetes']).toBe(2);
      expect(context.skillsFrequency['Docker']).toBe(2);
      expect(context.discoveredSkills).toContain('Kubernetes');
      expect(context.discoveredSkills).toContain('Docker');
      // Existing skills in baseProfile should not be marked as undiscovered
      expect(context.discoveredSkills).not.toContain('Microsoft 365');
    });
  });

  describe('evolveProfileFromLearnedContext', () => {
    it('automatically promotes repeated discovered skills into coreSkills', () => {
      // Simulate applying to 2 jobs that require Kubernetes and Terraform
      recordJobInteraction(sampleJob, 'applied', baseProfile);
      recordJobInteraction(sampleJob, 'applied', baseProfile);

      const evolved = evolveProfileFromLearnedContext(baseProfile, { threshold: 2 });
      expect(evolved.coreSkills).toContain('Kubernetes');
      expect(evolved.coreSkills).toContain('Terraform');
      expect(evolved.coreSkills).toContain('Microsoft 365'); // retains existing
      expect(evolved.learnedEvolutionCount).toBeGreaterThan(0);
    });
  });

  describe('generateSmartJobSuggestions', () => {
    it('ranks jobs with clear explanation rationale based on profile and learned context', () => {
      const jobList = [
        sampleJob,
        {
          id: 'job-unrelated',
          title: 'Registered Nurse',
          company: 'Regional Health',
          location: 'Geelong, VIC',
          description: 'Emergency ward patient care and triage.',
          tags: ['Nursing', 'Clinical']
        }
      ];

      const suggestions = generateSmartJobSuggestions(jobList, baseProfile);
      expect(suggestions.length).toBe(1);
      expect(suggestions[0].job.id).toBe('job-docker-1');
      expect(suggestions[0].matchScore).toBeGreaterThanOrEqual(70);
      expect(suggestions[0].reasons.length).toBeGreaterThan(0);
      expect(suggestions[0].reasons.some(r => r.includes('skills') || r.includes('title'))).toBe(true);
    });
  });
});
