/**
 * roleClusteringService.js
 * Intelligent Role Extraction, Multi-Sector Expanded Taxonomy,
 * Profile-Based Auto Generation & Custom Role Targeting
 */

export const ROLE_DOMAINS = [
  'Technology & IT',
  'Product & Leadership',
  'Healthcare & Clinical',
  'Finance & Commercial',
  'Engineering & Construction',
  'Corporate & Operations',
  'Growth & Marketing'
];

export const ROLE_ARCHETYPES = [
  // ── Technology & IT ────────────────────────────────────────────────────────
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
    keywords: ['cyber security', 'security analyst', 'infosec', 'soc analyst', 'penetration', 'security engineer', 'risk & security', 'ciso'],
    category: 'Technology & IT'
  },
  {
    id: 'data_ai',
    title: 'Data Engineer, AI & Analytics',
    keywords: ['data engineer', 'data analyst', 'bi analyst', 'machine learning', 'data scientist', 'power bi', 'sql developer', 'bigquery', 'analytics'],
    category: 'Technology & IT'
  },
  {
    id: 'network_eng',
    title: 'Network & Security Engineer',
    keywords: ['network engineer', 'network administrator', 'cisco', 'firewall', 'network specialist', 'lan/wan', 'telecom', 'routing'],
    category: 'Technology & IT'
  },

  // ── Product & Leadership ───────────────────────────────────────────────────
  {
    id: 'product_mgmt',
    title: 'Product Manager & Delivery Lead',
    keywords: ['product manager', 'product owner', 'scrum master', 'delivery lead', 'agile coach', 'program manager'],
    category: 'Product & Leadership'
  },
  {
    id: 'it_management',
    title: 'IT Leadership & Delivery Management',
    keywords: ['project manager', 'it manager', 'head of it', 'engineering manager', 'service delivery', 'technical director', 'cto', 'cio'],
    category: 'Product & Leadership'
  },

  // ── Healthcare & Clinical ──────────────────────────────────────────────────
  {
    id: 'nursing_clinical',
    title: 'Registered Nursing & Clinical Care',
    keywords: ['registered nurse', 'nurse', 'clinical nurse', 'clinical care', 'midwife', 'patient care', 'staff nurse', 'nurse coordinator'],
    category: 'Healthcare & Clinical'
  },
  {
    id: 'allied_health',
    title: 'Allied Health & Physiotherapy',
    keywords: ['allied health', 'physiotherapist', 'occupational therapist', 'speech pathologist', 'psychologist', 'optometrist', 'podiatrist', 'pharmacist'],
    category: 'Healthcare & Clinical'
  },
  {
    id: 'medical_admin',
    title: 'Medical & Health Administration',
    keywords: ['medical receptionist', 'health administration', 'clinic coordinator', 'practice manager', 'health records', 'medical officer', 'clinical coordinator'],
    category: 'Healthcare & Clinical'
  },

  // ── Finance & Commercial ───────────────────────────────────────────────────
  {
    id: 'accounting_tax',
    title: 'Corporate Accounting & Tax',
    keywords: ['accountant', 'financial accountant', 'tax accountant', 'cpa', 'chartered accountant', 'auditor', 'audit', 'bookkeeper', 'management accountant'],
    category: 'Finance & Commercial'
  },
  {
    id: 'fpa_analysis',
    title: 'FP&A & Commercial Finance',
    keywords: ['financial analyst', 'fp&a', 'commercial analyst', 'financial controller', 'finance business partner', 'credit risk', 'investment analyst'],
    category: 'Finance & Commercial'
  },
  {
    id: 'payroll_operations',
    title: 'Payroll & Accounts Operations',
    keywords: ['payroll officer', 'payroll manager', 'accounts payable', 'accounts receivable', 'billing specialist', 'bookkeeping'],
    category: 'Finance & Commercial'
  },

  // ── Engineering & Construction ─────────────────────────────────────────────
  {
    id: 'civil_construction',
    title: 'Civil, Structural & Construction Engineering',
    keywords: ['civil engineer', 'site manager', 'site engineer', 'project engineer', 'structural engineer', 'construction manager', 'estimator', 'building surveyor'],
    category: 'Engineering & Construction'
  },
  {
    id: 'trades_mechanical',
    title: 'Trades, Electrical & Mechanical Operations',
    keywords: ['electrician', 'mechanic', 'technician', 'fitter', 'plumber', 'maintenance technician', 'boilermaker', 'tradesperson'],
    category: 'Engineering & Construction'
  },
  {
    id: 'logistics_warehouse',
    title: 'Logistics, Supply Chain & Warehousing',
    keywords: ['warehouse', 'logistics', 'storeperson', 'supply chain', 'inventory controller', 'forklift', 'dispatch', 'transport coordinator'],
    category: 'Engineering & Construction'
  },

  // ── Corporate & Operations ─────────────────────────────────────────────────
  {
    id: 'hr_talent',
    title: 'HR, People & Talent Acquisition',
    keywords: ['human resources', 'hr business partner', 'hrbp', 'talent acquisition', 'recruiter', 'recruitment consultant', 'people & culture', 'hr coordinator'],
    category: 'Corporate & Operations'
  },
  {
    id: 'legal_compliance',
    title: 'Legal, Governance & Risk',
    keywords: ['legal counsel', 'lawyer', 'solicitor', 'compliance officer', 'risk officer', 'legal assistant', 'paralegal', 'general counsel', 'governance'],
    category: 'Corporate & Operations'
  },

  // ── Growth & Marketing ─────────────────────────────────────────────────────
  {
    id: 'sales_account',
    title: 'B2B Sales & Account Management',
    keywords: ['account executive', 'business development', 'bdm', 'account manager', 'sales executive', 'client director', 'sales manager', 'commercial manager'],
    category: 'Growth & Marketing'
  },
  {
    id: 'digital_marketing',
    title: 'Digital Marketing, Growth & Content',
    keywords: ['marketing manager', 'digital marketing', 'seo', 'performance marketing', 'content strategist', 'social media manager', 'copywriter', 'brand manager'],
    category: 'Growth & Marketing'
  }
];

// ─── Local Storage Persistence Helpers ────────────────────────────────────────

const getStorageKey = (prefix, profileId) => `${prefix}_${profileId || 'default'}`;

export const loadSavedRoleSelections = (profileId) => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getStorageKey('job_dashboard_selected_roles', profileId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveRoleSelections = (profileId, roleIds) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey('job_dashboard_selected_roles', profileId), JSON.stringify(roleIds));
  } catch (err) {
    console.warn('Failed to save role selections to localStorage', err);
  }
};

export const getCustomRoles = (profileId) => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey('job_dashboard_custom_roles', profileId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveCustomRoles = (profileId, customRoles) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey('job_dashboard_custom_roles', profileId), JSON.stringify(customRoles));
  } catch (err) {
    console.warn('Failed to save custom roles to localStorage', err);
  }
};

export const addCustomRole = (profileId, { title, keywords = [], category = 'Custom' }) => {
  const current = getCustomRoles(profileId);
  const id = `custom_${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
  const newRole = {
    id,
    title,
    keywords: keywords.length > 0 ? keywords : [title.toLowerCase()],
    category: category || 'Custom',
    isCustom: true
  };
  const updated = [...current, newRole];
  saveCustomRoles(profileId, updated);
  return newRole;
};

export const removeCustomRole = (profileId, roleId) => {
  const current = getCustomRoles(profileId);
  const updated = current.filter(r => r.id !== roleId);
  saveCustomRoles(profileId, updated);
  return updated;
};

// ─── Classification & Archetype Counting ─────────────────────────────────────

/**
 * Classifies a job title into a primary role archetype (checking custom roles first, then canonical)
 */
export const classifyJobRole = (job, customRoles = []) => {
  const text = `${job.title || ''} ${job.stream || ''} ${job.notes || ''} ${job.description || ''}`.toLowerCase();

  // Check custom user roles first
  if (Array.isArray(customRoles) && customRoles.length > 0) {
    for (const role of customRoles) {
      if (role.keywords && role.keywords.some(k => text.includes(k.toLowerCase()))) {
        return role;
      }
    }
  }

  // Check canonical roles
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
export const getProfileAutoRoles = (profile, customRoles = []) => {
  if (!profile) return ['cloud_infra', 'sysadmin', 'it_support'];

  const targetTitles = (profile.targetTitles || []).map(t => t.toLowerCase());
  const skills = (profile.coreSkills || []).map(s => s.toLowerCase());
  const industry = (profile.industry || '').toLowerCase();

  const recommendedIds = new Set();

  // Always include user custom roles
  if (Array.isArray(customRoles)) {
    customRoles.forEach(r => recommendedIds.add(r.id));
  }

  ROLE_ARCHETYPES.forEach(role => {
    // Check title match
    const matchesTitle = role.keywords.some(k => targetTitles.some(t => t.includes(k) || k.includes(t)));
    // Check skill match
    const matchesSkill = role.keywords.some(k => skills.some(s => s.includes(k) || k.includes(s)));
    // Check industry match
    let matchesIndustry = false;
    if (industry.includes('health') || industry.includes('medical')) {
      matchesIndustry = role.category === 'Healthcare & Clinical';
    } else if (industry.includes('finance') || industry.includes('account')) {
      matchesIndustry = role.category === 'Finance & Commercial';
    } else if (industry.includes('construction') || industry.includes('trade')) {
      matchesIndustry = role.category === 'Engineering & Construction';
    } else if (industry.includes('legal')) {
      matchesIndustry = role.id === 'legal_compliance';
    } else if (industry.includes('marketing') || industry.includes('sales')) {
      matchesIndustry = role.category === 'Growth & Marketing';
    } else if (industry.includes('hr') || industry.includes('people')) {
      matchesIndustry = role.id === 'hr_talent';
    } else if (industry.includes('tech') || industry.includes('it')) {
      matchesIndustry = role.category === 'Technology & IT';
    }

    if (matchesTitle || (matchesSkill && matchesIndustry) || matchesIndustry) {
      recommendedIds.add(role.id);
    }
  });

  // Default fallback if no specific match
  if (recommendedIds.size === 0) {
    if (industry.includes('health')) {
      recommendedIds.add('nursing_clinical');
      recommendedIds.add('allied_health');
    } else if (industry.includes('finance')) {
      recommendedIds.add('accounting_tax');
      recommendedIds.add('fpa_analysis');
    } else {
      recommendedIds.add('cloud_infra');
      recommendedIds.add('sysadmin');
      recommendedIds.add('it_support');
    }
  }

  return Array.from(recommendedIds);
};

/**
 * Aggregates job counts across all role archetypes (canonical + custom)
 */
export const getRoleArchetypeCounts = (jobs = [], profile = null, customRoles = []) => {
  const recommendedIds = new Set(getProfileAutoRoles(profile, customRoles));
  const counts = {};

  // Initialize canonical roles
  ROLE_ARCHETYPES.forEach(r => {
    counts[r.id] = {
      ...r,
      count: 0,
      isRecommended: recommendedIds.has(r.id)
    };
  });

  // Initialize custom roles
  if (Array.isArray(customRoles)) {
    customRoles.forEach(r => {
      counts[r.id] = {
        ...r,
        count: 0,
        isRecommended: true
      };
    });
  }

  counts['general_prof'] = {
    id: 'general_prof',
    title: 'General & Other Professional Roles',
    category: 'General',
    count: 0,
    isRecommended: false
  };

  jobs.forEach(job => {
    const matchedRole = classifyJobRole(job, customRoles);
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
