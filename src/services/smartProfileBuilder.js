/**
 * smartProfileBuilder.js
 * Autonomous Candidate Profile Synthesizer
 * Automatically constructs, infers, and tailors a complete candidate profile upon login
 * by analyzing Google user metadata, scanned Gmail application emails, and matched job ads.
 */

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
export const inferCandidateTitle = (applications = [], defaultTitle = 'Senior IT Systems & Infrastructure Engineer') => {
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
      return `Senior ${topRole} & Systems Specialist`;
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

  const fallbackTitles = [
    'Senior Systems Engineer',
    'M365 & Cloud Infrastructure Specialist',
    'Cloud Endpoint Engineer',
    'SharePoint & Collaboration Administrator',
    'IT Operations Lead',
    'Platform Support Engineer'
  ];

  fallbackTitles.forEach(fb => {
    if (titles.size < 6) titles.add(fb);
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
  if (!applications || applications.length === 0) return 'Technology & IT';

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
    if (text.includes('nurse') || text.includes('clinical') || text.includes('doctor') || text.includes('patient')) {
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
  return sorted[0][1] > 0 ? sorted[0][0] : 'Technology & IT';
};

/**
 * Builds a comprehensive, ATS-optimized candidate profile automatically upon login
 */
export const synthesizeUserProfile = ({
  googleUser = {},
  gmailApplications = [],
  existingProfile = null,
  baseLocation = 'BALACLAVA VIC 3183'
}) => {
  const name = googleUser.name || existingProfile?.name || 'Candidate';
  const email = googleUser.email || existingProfile?.email || 'candidate@gmail.com';
  const profileId = email ? `prof_${email.replace(/[^a-zA-Z0-9]/g, '_')}` : (existingProfile?.id || 'default_candidate');

  const industry = inferPrimaryIndustry(gmailApplications);
  const title = inferCandidateTitle(gmailApplications, existingProfile?.title || 'Senior IT Systems & Infrastructure Engineer');
  const targetTitles = deriveTargetTitles(gmailApplications, title);
  const coreSkills = extractCoreSkills(gmailApplications, industry);

  let suburb = 'Balaclava';
  let location = 'Melbourne, VIC (Balaclava 3183)';
  if (baseLocation) {
    const parts = baseLocation.split(' ');
    if (parts.length > 0) suburb = parts[0];
    location = `Melbourne, VIC (${baseLocation})`;
  }

  const summaryBullets = [
    `Demonstrated enterprise track record delivering high-availability infrastructure, identity security, and endpoint engineering.`,
    `Extensive expertise across ${coreSkills.slice(0, 5).join(', ')} with proven SLA first-contact resolution.`,
    `Automated complex multi-step batch operations, driving significant operational efficiency and reducing recurring incidents.`,
    `Strong cross-functional stakeholder communication, Root Cause Analysis (RCA), and adherence to compliance frameworks.`
  ];

  const fullExperience = `
${name.toUpperCase()} — ${title}
Location: ${location} | Email: ${email}
Australian Citizen | Baseline / NV1 Ready | LinkedIn: linkedin.com/in/${name.toLowerCase().replace(/\s+/g, '-')}

PROFESSIONAL PROFILE:
Senior infrastructure specialist and technology consultant with extensive expertise managing mission-critical enterprise environments, automation frameworks, and cloud endpoints.

CORE COMPETENCIES:
${coreSkills.join(' • ')}

TARGET CAREER PATHWAYS:
${targetTitles.join(' • ')}
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
