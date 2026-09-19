/**
 * smartProfileBuilder.js
 * Autonomous Candidate Profile Synthesizer
 * Automatically constructs, infers, and tailors a complete candidate profile upon login
 * by analyzing Google user metadata, scanned Gmail application emails, and matched job ads.
 */

import { DEFAULT_USER_PROFILE } from './profileService';

const INDUSTRY_SKILL_MAP = {
  'Technology & IT': [
    'Microsoft 365', 'Azure', 'Entra ID', 'Intune', 'Autopilot', 'PowerShell',
    'Active Directory', 'Windows Server', 'Exchange Hybrid', 'SharePoint Online',
    'ServiceNow', 'ITIL 4', 'ACSC Essential 8', 'VMware', 'CI/CD', 'Cloud Infrastructure',
    'Network Security', 'Linux', 'Docker', 'Kubernetes'
  ],
  'Cloud & DevOps': [
    'AWS', 'Azure', 'GCP', 'Terraform', 'Kubernetes', 'Docker', 'CI/CD Pipelines',
    'GitHub Actions', 'Python', 'Bash / Shell', 'Prometheus', 'Grafana', 'Linux Administration'
  ],
  'Healthcare & Clinical': [
    'Patient Care', 'Clinical Governance', 'EMR Systems', 'Medication Administration',
    'AHPRA Registration', 'Infection Control', 'Triage Assessment', 'Healthcare Compliance'
  ],
  'Finance & Accounting': [
    'Financial Modeling', 'Xero', 'MYOB', 'Payroll Compliance', 'Taxation',
    'Auditing', 'CPA / CA Qualifications', 'Cash Flow Forecasting', 'BAS Lodgement'
  ],
  'Executive & Project Management': [
    'Agile / Scrum', 'Stakeholder Management', 'Budget Management', 'Risk Mitigation',
    'Prince2', 'PMP', 'Vendor Management', 'Strategic Roadmapping', 'Resource Allocation'
  ]
};

/**
 * Extracts and synthesizes a high-accuracy job title and seniority level from a list of applied roles
 */
export const inferCandidateTitle = (applications = [], defaultTitle = '') => {
  if (!applications || applications.length === 0) return defaultTitle;

  const titleCounts = {};
  applications.forEach(app => {
    const raw = (app.title || '').trim();
    if (!raw || raw.toLowerCase().includes('job application') || raw.toLowerCase().includes('application')) return;
    titleCounts[raw] = (titleCounts[raw] || 0) + 1;
  });

  const sortedTitles = Object.entries(titleCounts).sort((a, b) => b[1] - a[1]);
  if (sortedTitles.length > 0) {
    const topRole = sortedTitles[0][0];
    if (!topRole.toLowerCase().includes('senior') && !topRole.toLowerCase().includes('lead') && !topRole.toLowerCase().includes('specialist')) {
      return `Senior ${topRole}`;
    }
    return topRole;
  }

  return defaultTitle;
};

/**
 * Derives top target search titles based on applications and primary domain
 */
export const deriveTargetTitles = (applications = [], candidateTitle = '') => {
  const titles = new Set();
  if (candidateTitle) titles.add(candidateTitle);

  applications.forEach(app => {
    const t = (app.title || '').trim();
    if (t && t.length > 4 && !t.toLowerCase().includes('application')) {
      const clean = t.replace(/^(re:|fwd:|applied:?|application for:?)\s*/gi, '').split(' - ')[0].trim();
      if (clean && clean.length > 4) {
        titles.add(clean);
      }
    }
  });

  return Array.from(titles).slice(0, 6);
};

/**
 * Extracts and ranks core candidate skills based on applied jobs and matched catalog ads
 */
export const extractCoreSkills = (applications = [], industry = 'Technology & IT') => {
  const skillFrequency = {};
  const baseIndustrySkills = INDUSTRY_SKILL_MAP[industry] || INDUSTRY_SKILL_MAP['Technology & IT'];

  baseIndustrySkills.forEach(s => {
    skillFrequency[s] = 1;
  });

  applications.forEach(app => {
    const text = `${app.title || ''} ${app.description || ''} ${app.notes || ''} ${(app.matchedSkills || []).join(' ')}`.toLowerCase();

    baseIndustrySkills.forEach(skill => {
      if (text.includes(skill.toLowerCase())) {
        skillFrequency[skill] = (skillFrequency[skill] || 1) + 2;
      }
    });

    if (Array.isArray(app.matchedSkills)) {
      app.matchedSkills.forEach(s => {
        const clean = s.trim();
        if (clean) skillFrequency[clean] = (skillFrequency[clean] || 1) + 3;
      });
    }
  });

  return Object.entries(skillFrequency)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0])
    .slice(0, 16);
};

/**
 * Determines primary candidate industry from applications
 */
export const inferPrimaryIndustry = (applications = []) => {
  if (!applications || applications.length === 0) return 'General';

  const industryScores = {
    'Technology & IT': 0,
    'Cloud & DevOps': 0,
    'Healthcare & Clinical': 0,
    'Finance & Accounting': 0,
    'Executive & Project Management': 0
  };

  applications.forEach(app => {
    const text = `${app.title || ''} ${app.stream || ''} ${app.description || ''}`.toLowerCase();
    if (text.includes('devops') || text.includes('cloud') || text.includes('aws') || text.includes('terraform')) {
      industryScores['Cloud & DevOps'] += 2;
    }
    if (text.includes('system') || text.includes('it support') || text.includes('engineer') || text.includes('m365') || text.includes('azure')) {
      industryScores['Technology & IT'] += 3;
    }
    if (text.includes('nurse') || text.includes('clinical') || text.includes('doctor') || text.includes('patient') || text.includes('hospital')) {
      industryScores['Healthcare & Clinical'] += 3;
    }
    if (text.includes('accountant') || text.includes('finance') || text.includes('payroll') || text.includes('tax')) {
      industryScores['Finance & Accounting'] += 3;
    }
    if (text.includes('project manager') || text.includes('scrum') || text.includes('director') || text.includes('program')) {
      industryScores['Executive & Project Management'] += 2;
    }
  });

  const sorted = Object.entries(industryScores).sort((a, b) => b[1] - a[1]);
  return sorted[0][1] > 0 ? sorted[0][0] : 'General';
};

/**
 * Builds a comprehensive, ATS-optimized candidate profile automatically upon login
 */
export const synthesizeUserProfile = ({
  googleUser = {},
  gmailApplications = [],
  existingProfile = null,
  baseLocation = ''
}) => {
  const name = googleUser.name || existingProfile?.name || '';
  const email = googleUser.email || existingProfile?.email || '';
  const profileId = email ? `prof_${email.replace(/[^a-zA-Z0-9]/g, '_')}` : (existingProfile?.id || `cand_${Date.now()}`);

  const isSamLudwig = (email && email.toLowerCase() === 'sam.ludwig@gmail.com') ||
                      (name && name.toLowerCase().includes('sam') && name.toLowerCase().includes('ludwig'));

  if (isSamLudwig) {
    return {
      ...DEFAULT_USER_PROFILE,
      ...(existingProfile || {}),
      id: profileId,
      name: 'Sam Ludwig',
      email: 'sam.ludwig@gmail.com',
      avatarUrl: googleUser.picture || existingProfile?.avatarUrl || DEFAULT_USER_PROFILE.avatarUrl || '',
      title: existingProfile?.title || DEFAULT_USER_PROFILE.title,
      fullWorkExperienceText: (existingProfile?.fullWorkExperienceText && !existingProfile.fullWorkExperienceText.includes('Datacom Systems') && existingProfile.fullWorkExperienceText.includes('Capgemini')) 
        ? existingProfile.fullWorkExperienceText 
        : DEFAULT_USER_PROFILE.fullWorkExperienceText,
      workHistorySummary: (existingProfile?.workHistorySummary && existingProfile.workHistorySummary.length > 50) 
        ? existingProfile.workHistorySummary 
        : DEFAULT_USER_PROFILE.workHistorySummary,
      projects: (existingProfile?.projects && existingProfile.projects.length >= 3)
        ? existingProfile.projects
        : DEFAULT_USER_PROFILE.projects,
      certifications: (existingProfile?.certifications && existingProfile.certifications.length >= 4)
        ? existingProfile.certifications
        : DEFAULT_USER_PROFILE.certifications,
      interviewTalkingPoints: (existingProfile?.interviewTalkingPoints && existingProfile.interviewTalkingPoints.length >= 4)
        ? existingProfile.interviewTalkingPoints
        : DEFAULT_USER_PROFILE.interviewTalkingPoints,
      updatedAt: new Date().toISOString(),
      isAuthenticMasterResume: true
    };
  }

  const industry = existingProfile?.industry || inferPrimaryIndustry(gmailApplications);
  const title = inferCandidateTitle(gmailApplications, existingProfile?.title || '');
  const targetTitles = deriveTargetTitles(gmailApplications, title);
  const coreSkills = extractCoreSkills(gmailApplications, industry);

  let suburb = '';
  let location = '';
  if (baseLocation) {
    const parts = baseLocation.split(' ');
    if (parts.length > 0) suburb = parts[0];
    location = baseLocation;
  }

  const summaryBullets = [
    title ? `Demonstrated track record as ${title} with proven outcome-driven delivery.` : 'Demonstrated professional track record with proven outcome-driven delivery.',
    coreSkills.length > 0 ? `Core domain expertise across ${coreSkills.slice(0, 5).join(', ')}.` : 'Broad domain expertise and collaborative execution.',
    'Strong cross-functional stakeholder communication, structured problem-solving, and adherence to quality standards.'
  ];

  const fullExperience = `
${name ? name.toUpperCase() : 'CANDIDATE'}${title ? ` — ${title}` : ''}
${location ? `Location: ${location} | ` : ''}${email ? `Email: ${email}` : ''}

PROFESSIONAL PROFILE:
${summaryBullets.join('\n')}

${coreSkills.length > 0 ? `CORE COMPETENCIES:\n${coreSkills.join(' • ')}\n` : ''}
${targetTitles.length > 0 ? `TARGET ROLES:\n${targetTitles.join(' • ')}` : ''}
  `.trim();

  const synthesized = {
    id: profileId,
    name: name,
    email: email,
    title: title,
    phone: existingProfile?.phone || '0405 993 245',
    location: location,
    suburb: suburb,
    workRights: 'Australian Citizen | Baseline / NV1 Eligible',
    clearance: 'Baseline / NV1 Ready',
    targetSalary: existingProfile?.targetSalary || '$115,000 + Super',
    industry: industry,
    targetTitles: targetTitles,
    coreSkills: coreSkills,
    certifications: existingProfile?.certifications || ['AZ-104 (Azure Administrator)', 'ITIL 4 Foundation', 'AZ-900 (Azure Fundamentals)'],
    workHistorySummary: summaryBullets.map(b => `- ${b}`).join('\n'),
    fullWorkExperienceText: fullExperience,
    avatarUrl: googleUser.picture || existingProfile?.avatarUrl || '',
    isAutoSynthesized: true,
    synthesizedAt: new Date().toISOString()
  };

  return synthesized;
};
