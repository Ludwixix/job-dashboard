/**
 * roleClusteringService.js
 * Intelligent Role Extraction, Profile-Based Auto Generation & Count Aggregator
 */

export const ROLE_ARCHETYPES = [
  {
    id: 'cloud_infra',
    title: 'Cloud & Infrastructure Engineer',
    keywords: ['cloud', 'aws', 'azure', 'infrastructure', 'm365', 'systems engineer', 'virtualisation', 'vmware', 'gcp'],
    category: 'Technology & IT'
  },
  {
    id: 'sysadmin',
    title: 'Systems Administrator & Operations',
    keywords: ['systems administrator', 'sysadmin', 'it administrator', 'it operations', 'server administrator', 'infrastructure admin'],
    category: 'Technology & IT'
  },
  {
    id: 'devops_platform',
    title: 'DevOps, SRE & Platform Engineer',
    keywords: ['devops', 'sre', 'site reliability', 'platform engineer', 'kubernetes', 'docker', 'ci/cd', 'terraform'],
    category: 'Technology & IT'
  },
  {
    id: 'it_support',
    title: 'IT Support & Service Desk Analyst',
    keywords: ['service desk', 'it support', 'help desk', 'desktop support', 'technical support', 'field tech', 'support specialist', 'it officer'],
    category: 'Technology & IT'
  },
  {
    id: 'software_dev',
    title: 'Software & Full Stack Engineer',
    keywords: ['software engineer', 'developer', 'full stack', 'frontend', 'backend', 'react', 'python', 'java', '.net', 'c#', 'node'],
    category: 'Technology & IT'
  },
  {
    id: 'cybersecurity',
    title: 'Cyber Security & InfoSec Analyst',
    keywords: ['cyber security', 'security analyst', 'infosec', 'soc analyst', 'penetration', 'security engineer', 'risk & security'],
    category: 'Technology & IT'
  },
  {
    id: 'data_ai',
    title: 'Data Engineer, AI & Analytics',
    keywords: ['data engineer', 'data analyst', 'bi analyst', 'machine learning', 'data scientist', 'power bi', 'sql developer'],
    category: 'Technology & IT'
  },
  {
    id: 'network_eng',
    title: 'Network & Security Engineer',
    keywords: ['network engineer', 'network administrator', 'cisco', 'firewall', 'network specialist', 'lan/wan', 'telecom'],
    category: 'Technology & IT'
  },
  {
    id: 'it_management',
    title: 'IT Leadership & Delivery Management',
    keywords: ['project manager', 'it manager', 'head of it', 'engineering manager', 'service delivery', 'scrum master', 'product manager'],
    category: 'Management'
  },
  {
    id: 'healthcare',
    title: 'Healthcare, Nursing & Medical',
    keywords: ['nurse', 'medical', 'clinical', 'doctor', 'healthcare', 'patient', 'hospital', 'allied health', 'pharmacist'],
    category: 'Healthcare'
  },
  {
    id: 'finance_accounting',
    title: 'Finance, Accounting & Commercial',
    keywords: ['accountant', 'finance', 'payroll', 'auditor', 'bookkeeper', 'financial analyst', 'tax', 'accounts payable'],
    category: 'Finance'
  },
  {
    id: 'trades_logistics',
    title: 'Logistics, Trades & Operations',
    keywords: ['warehouse', 'logistics', 'storeperson', 'technician', 'electrician', 'mechanic', 'labourer', 'driver', 'forklift'],
    category: 'Operations'
  },
  {
    id: 'hr_legal',
    title: 'HR, Talent & Governance',
    keywords: ['hr', 'human resources', 'talent acquisition', 'recruiter', 'legal', 'compliance', 'governance', 'paralegal'],
    category: 'Corporate'
  }
];

/**
 * Classifies a job title into a primary role archetype
 */
export const classifyJobRole = (job) => {
  const text = `${job.title || ''} ${job.stream || ''} ${job.notes || ''}`.toLowerCase();
  
  for (const role of ROLE_ARCHETYPES) {
    if (role.keywords.some(k => text.includes(k))) {
      return role;
    }
  }

  return {
    id: 'general_prof',
    title: 'General & Professional Roles',
    category: 'General'
  };
};

/**
 * Returns role recommendations automatically tailored to the candidate's profile
 */
export const getProfileAutoRoles = (profile) => {
  if (!profile) return ['cloud_infra', 'sysadmin', 'it_support'];

  const targetTitles = (profile.targetTitles || []).map(t => t.toLowerCase());
  const skills = (profile.coreSkills || []).map(s => s.toLowerCase());
  const industry = (profile.industry || '').toLowerCase();

  const recommendedIds = new Set();

  ROLE_ARCHETYPES.forEach(role => {
    // Check if role keywords match target titles
    const matchesTitle = role.keywords.some(k => targetTitles.some(t => t.includes(k) || k.includes(t)));
    // Check if role keywords match core skills
    const matchesSkill = role.keywords.some(k => skills.some(s => s.includes(k) || k.includes(s)));
    // Check if industry matches
    const matchesIndustry = industry.includes('tech') || industry.includes('it') ? role.category === 'Technology & IT' : false;

    if (matchesTitle || (matchesSkill && matchesIndustry)) {
      recommendedIds.add(role.id);
    }
  });

  // Default fallback if no specific match
  if (recommendedIds.size === 0) {
    if (industry.includes('health')) recommendedIds.add('healthcare');
    else if (industry.includes('finance')) recommendedIds.add('finance_accounting');
    else {
      recommendedIds.add('cloud_infra');
      recommendedIds.add('sysadmin');
      recommendedIds.add('it_support');
    }
  }

  return Array.from(recommendedIds);
};

/**
 * Aggregates job counts across all role archetypes
 */
export const getRoleArchetypeCounts = (jobs = [], profile = null) => {
  const recommendedIds = new Set(getProfileAutoRoles(profile));
  const counts = {};

  ROLE_ARCHETYPES.forEach(r => {
    counts[r.id] = {
      ...r,
      count: 0,
      isRecommended: recommendedIds.has(r.id)
    };
  });

  counts['general_prof'] = {
    id: 'general_prof',
    title: 'General & Other Professional Roles',
    category: 'General',
    count: 0,
    isRecommended: false
  };

  jobs.forEach(job => {
    const matchedRole = classifyJobRole(job);
    if (counts[matchedRole.id]) {
      counts[matchedRole.id].count += 1;
    } else {
      counts['general_prof'].count += 1;
    }
  });

  return Object.values(counts).sort((a, b) => {
    // Sort recommended first, then by highest count
    if (a.isRecommended && !b.isRecommended) return -1;
    if (!a.isRecommended && b.isRecommended) return 1;
    return b.count - a.count;
  });
};

/**
 * Extracts top specific job titles with counts
 */
export const getTopJobTitlesWithCounts = (jobs = [], limit = 30) => {
  const counts = {};

  jobs.forEach(j => {
    const raw = (j.title || '').trim();
    if (!raw) return;
    
    // Clean common prefixes
    const clean = raw
      .replace(/^(senior|junior|lead|principal|contract|immediate start|urgent:?)\s+/gi, '')
      .split(' - ')[0]
      .split(' | ')[0]
      .trim();

    if (clean.length > 2) {
      counts[clean] = (counts[clean] || 0) + 1;
    }
  });

  return Object.entries(counts)
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};
