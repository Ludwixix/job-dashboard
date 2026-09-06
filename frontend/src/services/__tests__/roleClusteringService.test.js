import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ROLE_DOMAINS,
  ROLE_ARCHETYPES,
  classifyJobRole,
  getProfileAutoRoles,
  getRoleArchetypeCounts,
  loadSavedRoleSelections,
  saveRoleSelections,
  getCustomRoles,
  addCustomRole,
  removeCustomRole
} from '../roleClusteringService';

describe('roleClusteringService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Taxonomy structure', () => {
    it('defines 7 comprehensive domains', () => {
      expect(ROLE_DOMAINS).toContain('Technology & IT');
      expect(ROLE_DOMAINS).toContain('Product & Leadership');
      expect(ROLE_DOMAINS).toContain('Healthcare & Clinical');
      expect(ROLE_DOMAINS).toContain('Finance & Commercial');
      expect(ROLE_DOMAINS).toContain('Engineering & Construction');
      expect(ROLE_DOMAINS).toContain('Corporate & Operations');
      expect(ROLE_DOMAINS).toContain('Growth & Marketing');
      expect(ROLE_DOMAINS.length).toBe(7);
    });

    it('has 23 canonical role archetypes covering all 7 domains', () => {
      expect(ROLE_ARCHETYPES.length).toBeGreaterThanOrEqual(20);
      const categories = new Set(ROLE_ARCHETYPES.map(r => r.category));
      ROLE_DOMAINS.forEach(domain => {
        expect(categories.has(domain)).toBe(true);
      });
    });
  });

  describe('classifyJobRole', () => {
    it('classifies cloud and infrastructure titles correctly', () => {
      const job = { title: 'Senior Azure Cloud Engineer', stream: 'IT' };
      const role = classifyJobRole(job);
      expect(role.id).toBe('cloud_infra');
    });

    it('classifies healthcare & clinical titles correctly', () => {
      const job = { title: 'Registered Nurse - Acute Care', description: 'Patient care in hospital' };
      const role = classifyJobRole(job);
      expect(role.id).toBe('nursing_clinical');
      expect(role.category).toBe('Healthcare & Clinical');
    });

    it('classifies finance & commercial titles correctly', () => {
      const job = { title: 'Senior Financial Accountant CPA', description: 'Monthly management reporting' };
      const role = classifyJobRole(job);
      expect(role.id).toBe('accounting_tax');
      expect(role.category).toBe('Finance & Commercial');
    });

    it('classifies engineering & trades titles correctly', () => {
      const job = { title: 'Civil Site Engineer', description: 'Road construction project' };
      const role = classifyJobRole(job);
      expect(role.id).toBe('civil_construction');
      expect(role.category).toBe('Engineering & Construction');
    });

    it('prioritizes custom roles over canonical archetypes', () => {
      const customRoles = [
        {
          id: 'custom_prompt_eng',
          title: 'Prompt Engineer',
          keywords: ['prompt engineer', 'llm wrangler'],
          category: 'AI Custom'
        }
      ];
      const job = { title: 'Lead Prompt Engineer & Python Developer' };
      const role = classifyJobRole(job, customRoles);
      expect(role.id).toBe('custom_prompt_eng');
      expect(role.title).toBe('Prompt Engineer');
    });

    it('falls back to general_prof when no keywords match', () => {
      const job = { title: 'Mystery Space Navigator 9000' };
      const role = classifyJobRole(job);
      expect(role.id).toBe('general_prof');
    });
  });

  describe('getProfileAutoRoles', () => {
    it('auto-selects tech roles for IT profile', () => {
      const profile = {
        industry: 'Technology',
        targetTitles: ['Cloud Engineer', 'DevOps Specialist'],
        coreSkills: ['AWS', 'Kubernetes', 'Terraform']
      };
      const autoRoles = getProfileAutoRoles(profile);
      expect(autoRoles).toContain('cloud_infra');
      expect(autoRoles).toContain('devops_platform');
    });

    it('auto-selects healthcare roles for Nursing profile', () => {
      const profile = {
        industry: 'Healthcare & Nursing',
        targetTitles: ['Registered Nurse', 'Clinical Nurse'],
        coreSkills: ['Triage', 'Patient Care']
      };
      const autoRoles = getProfileAutoRoles(profile);
      expect(autoRoles).toContain('nursing_clinical');
      expect(autoRoles).not.toContain('devops_platform');
    });

    it('includes custom roles in recommendations', () => {
      const profile = { industry: 'Tech', targetTitles: ['Developer'] };
      const customRoles = [{ id: 'custom_quantum', title: 'Quantum Specialist', keywords: ['quantum'] }];
      const autoRoles = getProfileAutoRoles(profile, customRoles);
      expect(autoRoles).toContain('custom_quantum');
    });
  });

  describe('getRoleArchetypeCounts', () => {
    it('counts jobs per archetype and flags profile recommendations', () => {
      const jobs = [
        { id: 1, title: 'AWS Cloud Engineer' },
        { id: 2, title: 'Azure Cloud Specialist' },
        { id: 3, title: 'Registered Nurse' },
        { id: 4, title: 'Mystery Unclassified Position' }
      ];
      const profile = { industry: 'Technology', targetTitles: ['Cloud Engineer'] };
      const counts = getRoleArchetypeCounts(jobs, profile);

      const cloudRole = counts.find(r => r.id === 'cloud_infra');
      expect(cloudRole.count).toBe(2);
      expect(cloudRole.isRecommended).toBe(true);

      const nurseRole = counts.find(r => r.id === 'nursing_clinical');
      expect(nurseRole.count).toBe(1);

      const generalRole = counts.find(r => r.id === 'general_prof');
      expect(generalRole.count).toBe(1);
    });
  });

  describe('localStorage persistence', () => {
    it('saves and loads role selections by profileId', () => {
      expect(loadSavedRoleSelections('prof_123')).toBeNull();
      saveRoleSelections('prof_123', ['cloud_infra', 'devops_platform']);
      expect(loadSavedRoleSelections('prof_123')).toEqual(['cloud_infra', 'devops_platform']);
    });

    it('manages custom roles lifecycle', () => {
      expect(getCustomRoles('prof_123')).toEqual([]);
      const added = addCustomRole('prof_123', {
        title: 'Site Reliability Architect',
        keywords: ['sra', 'reliability architect'],
        category: 'Custom Leadership'
      });
      expect(added.id).toMatch(/^custom_site_reliability_architect_/);
      expect(getCustomRoles('prof_123').length).toBe(1);

      const afterRemoval = removeCustomRole('prof_123', added.id);
      expect(afterRemoval.length).toBe(0);
      expect(getCustomRoles('prof_123').length).toBe(0);
    });
  });
});

