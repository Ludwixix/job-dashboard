/**
 * profileLearningEngine.js
 * ------------------------
 * Autonomous User Profile Intelligence & Adaptive Learning Engine.
 */

import { saveProfile, getActiveProfile, saveProfileToBackend } from './profileService';

const STORAGE_PREFIX = 'job_dashboard_learned_context_';

const CANONICAL_SKILL_PATTERNS = [
  { name: 'Kubernetes', regex: /\b(kubernetes|k8s)\b/i },
  { name: 'Docker', regex: /\b(docker|containerization|containers)\b/i },
  { name: 'Terraform', regex: /\b(terraform|opentofu)\b/i },
  { name: 'Ansible', regex: /\bansible\b/i },
  { name: 'AWS Cloud', regex: /\b(aws|amazon web services)\b/i },
  { name: 'Azure Cloud', regex: /\b(azure|entra id|azure ad)\b/i },
  { name: 'Microsoft 365', regex: /\b(microsoft 365|m365|office 365|o365)\b/i },
  { name: 'Intune / MDM', regex: /\b(intune|autopilot|endpoint manager|mdm)\b/i },
  { name: 'PowerShell Automation', regex: /\b(powershell|posh)\b/i },
  { name: 'Python', regex: /\bpython\b/i },
  { name: 'CI/CD Pipelines', regex: /\b(ci\/cd|github actions|gitlab ci|jenkins)\b/i },
  { name: 'Linux Administration', regex: /\b(linux|rhel|ubuntu|centos|debian)\b/i },
  { name: 'VMware ESXi', regex: /\b(vmware|vsphere|esxi)\b/i },
  { name: 'Security Hardening', regex: /\b(essential 8|acsc|iso 27001|soc2|hardening|zero trust)\b/i },
  { name: 'Disaster Recovery', regex: /\b(disaster recovery|rto|rpo|business continuity)\b/i },
  { name: 'ITIL Service Management', regex: /\b(itil|servicenow|incident management)\b/i },
  { name: 'Clinical Governance', regex: /\b(clinical governance|nsqhs|patient safety)\b/i },
  { name: 'Financial Modeling', regex: /\b(financial model|fp&a|aasb|ifrs|xero)\b/i },
  { name: 'Stakeholder Management', regex: /\b(stakeholder management|cross-functional|vendor management)\b/i },
];

export function resetLearnedContext(profileId = null) {
  if (typeof localStorage === 'undefined') return;
  if (profileId) {
    localStorage.removeItem(`${STORAGE_PREFIX}${profileId}`);
  } else {
    Object.keys(localStorage)
      .filter(k => k.startsWith(STORAGE_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  }
}

export function getLearnedContext(profileId = null) {
  const targetId = profileId || getActiveProfile()?.id || 'default_user';
  if (typeof localStorage === 'undefined') {
    return {
      profileId: targetId,
      totalInteractions: 0,
      skillsFrequency: {},
      discoveredSkills: [],
      appliedTitles: [],
      salaryObservations: [],
      lastUpdated: new Date().toISOString()
    };
  }

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${targetId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error parsing learned context:', e);
  }

  return {
    profileId: targetId,
    totalInteractions: 0,
    skillsFrequency: {},
    discoveredSkills: [],
    appliedTitles: [],
    salaryObservations: [],
    lastUpdated: new Date().toISOString()
  };
}

export function saveLearnedContext(profileId, context) {
  if (typeof localStorage === 'undefined') return;
  const targetId = profileId || getActiveProfile()?.id || 'default_user';
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${targetId}`, JSON.stringify(context));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('learned-context-updated', {
        detail: { profileId: targetId, context }
      }));
    }
  } catch (e) {
    console.warn('Error saving learned context:', e);
  }
}

export function extractSkillsAndContextFromJob(job = {}) {
  const text = `${job.title || ''} ${job.description || ''} ${job.notes || ''} ${(job.tags || []).join(' ')}`.toLowerCase();
  const matchedSkills = [];

  CANONICAL_SKILL_PATTERNS.forEach(({ name, regex }) => {
    if (regex.test(text)) {
      matchedSkills.push(name);
    }
  });

  if (Array.isArray(job.tags)) {
    job.tags.forEach(tag => {
      if (tag && !matchedSkills.some(s => s.toLowerCase() === tag.toLowerCase())) {
        matchedSkills.push(tag);
      }
    });
  }

  let salary = null;
  const salaryText = String(job.salary || job.remuneration || '');
  const salMatch = salaryText.match(/\$?(\d{2,3})[,\s]?(\d{3})/);
  if (salMatch) {
    salary = parseInt(`${salMatch[1]}${salMatch[2]}`, 10);
  }

  return {
    skills: matchedSkills,
    salary,
    title: job.title || '',
    company: job.company || '',
    location: job.location || '',
  };
}

export function recordJobInteraction(job = {}, interactionType = 'view', candidateProfile = null) {
  if (!job || !job.title) return;
  const profile = candidateProfile || getActiveProfile() || {};
  const profileId = profile.id || 'default_user';

  const context = getLearnedContext(profileId);
  const extracted = extractSkillsAndContextFromJob(job);

  context.totalInteractions = (context.totalInteractions || 0) + 1;
  context.lastUpdated = new Date().toISOString();

  context.skillsFrequency = context.skillsFrequency || {};
  const currentProfileSkills = new Set((profile.coreSkills || []).map(s => s.toLowerCase()));

  extracted.skills.forEach(skill => {
    context.skillsFrequency[skill] = (context.skillsFrequency[skill] || 0) + 1;
    if (!currentProfileSkills.has(skill.toLowerCase())) {
      if (!context.discoveredSkills.includes(skill)) {
        context.discoveredSkills.push(skill);
      }
    }
  });

  if (job.title && !context.appliedTitles.includes(job.title)) {
    context.appliedTitles.push(job.title);
    if (context.appliedTitles.length > 25) {
      context.appliedTitles = context.appliedTitles.slice(-25);
    }
  }

  if (extracted.salary && !context.salaryObservations.includes(extracted.salary)) {
    context.salaryObservations.push(extracted.salary);
    if (context.salaryObservations.length > 20) {
      context.salaryObservations = context.salaryObservations.slice(-20);
    }
  }

  saveLearnedContext(profileId, context);
  return context;
}

export function evolveProfileFromLearnedContext(candidateProfile, options = {}) {
  const profile = candidateProfile || getActiveProfile();
  if (!profile) return null;

  const threshold = options.threshold || 2;
  const context = getLearnedContext(profile.id);

  const existingSkills = new Set((profile.coreSkills || []).map(s => s.toLowerCase()));
  const skillsToAdd = [];

  Object.entries(context.skillsFrequency || {}).forEach(([skill, count]) => {
    if (count >= threshold && !existingSkills.has(skill.toLowerCase())) {
      skillsToAdd.push(skill);
    }
  });

  if (skillsToAdd.length === 0) {
    return profile;
  }

  const updatedSkills = [...(profile.coreSkills || []), ...skillsToAdd];
  const updatedProfile = {
    ...profile,
    coreSkills: updatedSkills,
    learnedEvolutionCount: (profile.learnedEvolutionCount || 0) + skillsToAdd.length,
    lastLearnedAt: new Date().toISOString()
  };

  saveProfile(updatedProfile);
  saveProfileToBackend(updatedProfile).catch(() => {});
  return updatedProfile;
}

export function generateSmartJobSuggestions(jobs = [], candidateProfile = null) {
  const profile = candidateProfile || getActiveProfile() || {};
  if (!Array.isArray(jobs) || jobs.length === 0) return [];

  const coreSkills = new Set((profile.coreSkills || []).map(s => s.toLowerCase()));
  const targetTitles = (profile.targetTitles || []).map(t => t.toLowerCase());
  const context = getLearnedContext(profile.id);

  const results = [];

  jobs.forEach(job => {
    if (!job || job.isRejected) return;

    const extracted = extractSkillsAndContextFromJob(job);
    const reasons = [];
    let score = 0;

    const matchedSkills = extracted.skills.filter(s => {
      const sLower = s.toLowerCase();
      return Array.from(coreSkills).some(cs => cs.includes(sLower) || sLower.includes(cs));
    });
    if (matchedSkills.length > 0) {
      score += Math.min(50, matchedSkills.length * 15);
      reasons.push(`Matches ${matchedSkills.length} core skills: ${matchedSkills.slice(0, 3).join(', ')}`);
    }

    const learnedOverlap = extracted.skills.filter(s => {
      const sLower = s.toLowerCase();
      return context.discoveredSkills.some(ds => ds.toLowerCase().includes(sLower) || sLower.includes(ds.toLowerCase()));
    });
    if (learnedOverlap.length > 0) {
      score += Math.min(20, learnedOverlap.length * 10);
      reasons.push(`Aligns with recent focus in ${learnedOverlap[0]}`);
    }

    const jobTitleLower = (job.title || '').toLowerCase();
    const titleMatch = targetTitles.some(tt => {
      const words = tt.split(/\s+/).filter(w => w.length > 3);
      return jobTitleLower.includes(tt) || tt.includes(jobTitleLower) || words.filter(w => jobTitleLower.includes(w)).length >= 2;
    });
    if (titleMatch) {
      score += 25;
      reasons.push(`Direct match with your target role title`);
    }

    const userLocation = (profile.location || 'melbourne').toLowerCase();
    if (job.location && (job.location.toLowerCase().includes('melbourne') || userLocation.includes(job.location.toLowerCase()))) {
      score += 10;
    }

    if (score >= 35) {
      results.push({
        job,
        matchScore: Math.min(99, score),
        reasons,
        extractedSkills: extracted.skills
      });
    }
  });

  return results.sort((a, b) => b.matchScore - a.matchScore);
}
