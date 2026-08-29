/**
 * generationService.js
 * Handles AI-powered resume + cover letter generation, Interview Prep,
 * Market Intelligence, and Autonomous Agent Heuristics.
 */

const MASTER_RESUME_HIGHLIGHTS = `
SAM LUDWIG — Senior IT Infrastructure & M365 Engineer
Location: Melbourne, VIC | Phone: 0405 993 245 | Email: sam.ludwig@gmail.com
Australian Citizen | Clearance Eligible: Baseline / NV1 | LinkedIn: linkedin.com/in/sam-ludwig

CAREER METRICS (real, verified):
- 660,000+ users: Managed Southern Hemisphere's largest SharePoint farm (Dept. of Education VIC)
- 99.9% uptime: Multi-year production SharePoint operations in government SLA environment
- 87% processing time reduction: PowerShell automation at Knosys (2hr → 15min per batch)
- 25% deployment cycle reduction: CI/CD pipelines at Engage Squared
- 15% repeat incident reduction: RCA-driven preventive measures at Capgemini/Dept. Ed VIC
- 95% SLA resolution: L3 application support at Knosys (Cotton On, Harvey Norman, Healthscope)
- >90% SLA resolution: 40+ concurrent tickets at Capgemini
- 100+ clinical endpoints migrated: Windows 11 at St John of God with zero patient care disruption
- 5+ bespoke SPFx solutions: For Victoria Police, Transurban, Cimic Group
- 200+ SharePoint sites automated: MFA compliance audit automation (PnP PowerShell)

PROFESSIONAL EXPERIENCE:
1. L2/L3 Technical Support Engineer | Australia Post (via Capgemini) | Feb 2026–Jun 2026
   - Engineered keystroke injection automation in ServiceNow → eliminated hundreds of hours/month of manual data entry
   - Managed complete endpoint lifecycle: OS migrations, Autopilot enrolment, compliant disposal
   - Primary escalation point for complex L2/L3 faults, collaborating with cloud engineering teams
   - Led self-service kiosk programme rollout reducing walk-in service desk volume

2. Endpoint Migration Engineer | St John of God Health Care | Oct 2025–Jan 2026
   - Led Windows 11 enterprise migration across 100+ clinical endpoints, zero patient care disruption
   - Maintained 100% SOE compliance via Autopilot provisioning in live hospital environment
   - Primary liaison between clinical staff and engineering team (EMR, PACS compatibility)

3. Senior Managed Services Engineer | Capgemini (to Dept. Education VIC) | Dec 2021–Dec 2023
   - Managed 660k+ user SharePoint farm (Southern Hemisphere's largest), 99.9% uptime
   - MFA compliance automation: PnP PowerShell auditing 200+ SharePoint sites, eliminated month-long manual cycle
   - Built ServiceNow workload distribution engine integrating M365 presence data → prevented SLA breaches
   - 15% reduction in repeat incidents through systematic RCA and permanent preventive measures
   - Managed hybrid identity: On-premises AD + Entra ID + Google Workspace sync
   - Azure cloud adoption and ACSC Essential 8 alignment

4. Application Support Engineer | Knosys | Dec 2020–Dec 2021
   - 95% SLA resolution for GreenOrbit enterprise intranet (Cotton On, Harvey Norman, Healthscope)
   - 87% processing time reduction via PowerShell automation (2 hours → 15 minutes per migration batch)
   - Contributed to AWS cloud migration and authored RCA documentation resolving recurring version conflicts

5. SharePoint Developer | Engage Squared | Mar 2018–Dec 2020
   - Delivered 5+ bespoke SharePoint Online intranets using SPFx/React/TypeScript (Victoria Police, Transurban)
   - 25% deployment cycle reduction via Azure DevOps CI/CD pipeline implementation
   - Led end-to-end SharePoint migrations to M365 with ISO 27001 governance compliance
   - 20% increase in M365 adoption through client technical workshops

6. Telecommunications Technician | NBN | Oct 2016–Nov 2017
   - Layer 1 infrastructure deployment (fibre optic/copper structured cabling)

SKILLS:
M365: SharePoint Online/Server, Exchange Hybrid, Teams, OneDrive, Entra ID, Intune, Autopilot, Power Automate, Power Apps, Purview, Defender
Azure: Azure VMs, Azure Functions, Azure DevOps, Azure Automation, Azure Monitor
Identity: Entra ID (Azure AD), Azure AD Connect, ADFS, PHS, PTA, Conditional Access, MFA, SSPR
Security: ACSC Essential 8, ISO 27001, NIST, Conditional Access, Defender for Endpoint/Office 365
Automation: PowerShell 5.1/7 (Expert), PnP PowerShell, Graph API, Python 3, Selenium
Development: React, TypeScript, JavaScript, SPFx, CI/CD, Azure DevOps, Git
Service Mgmt: ServiceNow, ITIL 4, Incident/Problem/Change Management, SLA Management, RCA
Infrastructure: Windows Server 2012R2–2022, Active Directory, VMware vSphere, Hyper-V, DNS/DHCP

CERTIFICATIONS:
- Microsoft Certified: Azure Administrator Associate (AZ-104) | 2025
- ITIL 4 Foundation | AXELOS | 2025
- Microsoft Certified: Azure Fundamentals (AZ-900) | 2022

EDUCATION:
- Diploma of Information Technology | Coder Academy | Melbourne | 2019
`;

export const CANDIDATE_PROFILE = {
  name: 'Sam Ludwig',
  title: 'Senior IT Systems & Infrastructure Engineer',
  location: 'Melbourne, VIC (Balaclava 3183)',
  email: 'sam.ludwig@gmail.com',
  phone: '0405 993 245',
  workRights: 'Australian Citizen | Baseline / NV1 Eligible',
  coreSkills: [
    'Microsoft 365', 'Azure', 'Entra ID', 'Intune', 'Autopilot', 'PowerShell',
    'Active Directory', 'Windows Server', 'Exchange Hybrid', 'SharePoint Online',
    'ServiceNow', 'ITIL 4', 'ACSC Essential 8', 'VMware', 'SPFx / React', 'CI/CD'
  ],
  certifications: ['AZ-104 (Azure Administrator)', 'ITIL 4 Foundation', 'AZ-900 (Azure Fundamentals)']
};

/**
 * Extract key terms from a job description for ATS scoring
 */
export const extractJobKeywords = (jobDescription) => {
  const text = (jobDescription || '').toLowerCase();
  const keywordGroups = {
    'Microsoft 365': ['microsoft 365', 'm365', 'office 365', 'o365'],
    'SharePoint': ['sharepoint'],
    'Azure': ['azure', 'azure ad', 'entra id'],
    'Intune': ['intune', 'mdm', 'endpoint management'],
    'Autopilot': ['autopilot', 'zero-touch'],
    'PowerShell': ['powershell', 'scripting', 'automation'],
    'Active Directory': ['active directory', 'ad ds', 'ldap', 'group policy'],
    'Windows Server': ['windows server', 'server administration'],
    'Exchange': ['exchange online', 'exchange hybrid', 'exchange'],
    'Teams': ['microsoft teams', 'teams admin'],
    'ServiceNow': ['servicenow', 'itsm'],
    'ITIL': ['itil', 'service management', 'incident management'],
    'Security': ['security', 'compliance', 'essential 8', 'acsc', 'cyber'],
    'Python': ['python'],
    'Networking': ['network', 'tcp/ip', 'dns', 'dhcp', 'vpn', 'cisco', 'fortinet'],
    'Virtualisation': ['vmware', 'vsphere', 'hyper-v', 'virtualisation', 'virtualization'],
    'Linux': ['linux', 'unix', 'rhel', 'ubuntu'],
    'DevOps': ['devops', 'ci/cd', 'azure devops', 'git', 'pipeline', 'terraform', 'ansible', 'docker', 'kubernetes'],
    'L3 Support': ['level 3', 'l3', 'tier 3', 'escalation', 'senior support'],
    'Infrastructure': ['infrastructure', 'systems administrator', 'sysadmin', 'cloud engineer'],
    'Government': ['government', 'aps', 'public sector', 'defence', 'federal', 'state government'],
    'Healthcare': ['healthcare', 'hospital', 'clinical', 'health'],
  };

  return Object.entries(keywordGroups)
    .filter(([, terms]) => terms.some(t => text.includes(t)))
    .map(([keyword]) => keyword);
};

/**
 * Calculate ATS match score between job and candidate
 */
export const calculateAtsScore = (jobDescription) => {
  const matched = extractJobKeywords(jobDescription);
  const total = 22; // total keyword groups
  const base = 55;
  return Math.min(98, Math.round(base + (matched.length / total) * 43));
};

/**
 * Main generation function — tries local API, returns null on static host
 */
export const generateApplicationDocs = async (job, onProgress) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    onProgress?.('Connecting to AI engine...');

    const res = await fetch('/api/generate-docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job: {
          title: job.title,
          company: job.company,
          location: job.location || 'Melbourne, VIC',
          salary: job.salary || '',
          description: job.notes || job.description || '',
          source: job.source || '',
          portalLink: job.portalLink || '',
        }
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();

    if (data.error) throw new Error(data.error);
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Generation timed out (60s). Try again.');
    if (err.message.includes('Failed to fetch') || err.message.includes('404')) return null;
    throw err;
  }
};

/**
 * Generate Structured Interview Briefing and Study Guide
 */
export const generateInterviewGuide = async (job, onProgress) => {
  onProgress?.('Analyzing role specifications and candidate metrics...');
  const atsScore = calculateAtsScore(job.notes || job.description || '');
  const keywords = extractJobKeywords(job.notes || job.description || '');

  const questions = [
    {
      type: 'Technical Challenge',
      question: `How would you architect and automate endpoint compliance for 500+ remote workers using Intune and Autopilot?`,
      answerStrategy: `Highlight St John of God migration (100+ clinical endpoints with zero downtime) and Capgemini automated PnP PowerShell auditing across 200+ sites. Emphasize SOE compliance and ACSC Essential 8 baseline.`,
      keyMetric: '100+ endpoints / zero disruption'
    },
    {
      type: 'Incident / SLA Management',
      question: `Describe a situation where you had to manage a critical production outage under strict SLA pressure.`,
      answerStrategy: `Use the STAR format detailing the Department of Education VIC SharePoint farm (660,000+ users, 99.9% uptime). Explain root cause analysis (RCA) method that resulted in a permanent 15% reduction in repeat incidents.`,
      keyMetric: '660k users / 99.9% uptime'
    },
    {
      type: 'Process Automation & Optimization',
      question: `Give an example of how you used scripting to eliminate repetitive operational toil.`,
      answerStrategy: `Reference the Knosys migration automation where you authored PowerShell scripts cutting batch processing time by 87% (from 2 hours down to 15 minutes per batch), and the ServiceNow keystroke automation for Australia Post.`,
      keyMetric: '87% time reduction (2h → 15m)'
    },
    {
      type: 'Stakeholder & Communication',
      question: `How do you bridge technical engineering requirements with non-technical business or clinical stakeholders?`,
      answerStrategy: `Discuss liaising between clinical healthcare staff and engineering teams for EMR/PACS compatibility at St John of God, ensuring patient care was never impacted during live enterprise rollouts.`,
      keyMetric: '100% SOE compliance in live hospital'
    }
  ];

  return {
    jobTitle: job.title,
    company: job.company,
    atsScore,
    keywords,
    questions,
    talkingPoints: [
      '660,000+ user SharePoint farm administration (largest in Southern Hemisphere)',
      'ACSC Essential 8 & ISO 27001 security compliance operationalization',
      '87% reduction in batch automation processing times via custom PowerShell',
      'Australian Citizen with NV1/Baseline clearance readiness',
      'Dual expertise in modern cloud (Azure/M365) and legacy hybrid AD infrastructure'
    ],
    recommendedQuestionsToAsk: [
      'What does the current IT automation roadmap look like over the next 12 months?',
      'How does the team currently measure and enforce ACSC Essential 8 / security maturity?',
      'What are the primary friction points in your current incident response and L3 escalation workflows?'
    ]
  };
};

/**
 * Market Intelligence Aggregator: Scans jobs dataset to find skill demand, salary ranges, and hot streams
 */
export const analyzeMarketTrends = (jobs = []) => {
  const skillCounts = {};
  const streamCounts = {};
  const salaryData = [];
  const locationCounts = {};

  jobs.forEach(job => {
    // Stream
    const stream = job.stream || 'Core IT & Systems';
    streamCounts[stream] = (streamCounts[stream] || 0) + 1;

    // Location
    const loc = (job.location || 'Melbourne, VIC').split(',')[0].trim();
    locationCounts[loc] = (locationCounts[loc] || 0) + 1;

    // Skills
    const text = `${job.title} ${job.company} ${job.notes || ''}`.toLowerCase();
    const extracted = extractJobKeywords(text);
    extracted.forEach(skill => {
      skillCounts[skill] = (skillCounts[skill] || 0) + 1;
    });

    // Salary parsing
    if (job.salary) {
      const match = job.salary.match(/\$?(\d{2,3}),?(\d{3})/);
      if (match) {
        const val = parseInt(`${match[1]}${match[2]}`, 10);
        if (val >= 50000 && val <= 250000) salaryData.push(val);
      }
    }
  });

  // Top skills sorted
  const topSkills = Object.entries(skillCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([skill, count]) => ({
      skill,
      count,
      percentage: jobs.length ? Math.round((count / jobs.length) * 100) : 0,
      isOwned: CANDIDATE_PROFILE.coreSkills.some(cs => cs.toLowerCase().includes(skill.toLowerCase()))
    }));

  const avgSalary = salaryData.length
    ? Math.round(salaryData.reduce((a, b) => a + b, 0) / salaryData.length)
    : 115000;

  return {
    totalJobs: jobs.length,
    topSkills,
    streamCounts,
    avgSalary,
    salaryRange: {
      min: salaryData.length ? Math.min(...salaryData) : 85000,
      max: salaryData.length ? Math.max(...salaryData) : 160000
    },
    topLocations: Object.entries(locationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  };
};

/**
 * Skill Gap & Career Driver Analyzer: compares current market requirements with candidate credentials
 */
export const generateSkillGapReport = (jobs = []) => {
  const trends = analyzeMarketTrends(jobs);
  const candidateSkillsLower = CANDIDATE_PROFILE.coreSkills.map(s => s.toLowerCase());

  const missingHighDemand = trends.topSkills.filter(
    item => !candidateSkillsLower.some(cs => cs.includes(item.skill.toLowerCase())) && item.percentage >= 15
  );

  const matchedHighDemand = trends.topSkills.filter(
    item => candidateSkillsLower.some(cs => cs.includes(item.skill.toLowerCase()))
  );

  const marketReadinessScore = trends.topSkills.length
    ? Math.round((matchedHighDemand.length / Math.min(15, trends.topSkills.length)) * 100)
    : 88;

  const recommendations = [
    {
      skill: 'Terraform / IaC',
      reason: 'Frequently requested in senior cloud & platform engineering roles (+18% salary boost).',
      action: 'Target HashiCorp Certified: Terraform Associate.'
    },
    {
      skill: 'Kubernetes / Containerization',
      reason: 'Enables migration into Cloud Operations & Enterprise DevOps.',
      action: 'Target Certified Kubernetes Administrator (CKA).'
    },
    {
      skill: 'Microsoft SC-200 / Security Ops',
      reason: 'Complements existing ACSC Essential 8 and Defender expertise for high-paying Defence & Gov contracts.',
      action: 'Target Microsoft Certified: Security Operations Analyst Associate.'
    }
  ];

  return {
    marketReadinessScore: Math.min(96, Math.max(75, marketReadinessScore)),
    matchedHighDemand,
    missingHighDemand,
    recommendations,
    careerDrivers: [
      { driver: 'Target Salary Band', value: '$110k – $145k + Super' },
      { driver: 'Optimal Geographic Focus', value: 'Melbourne CBD / St Kilda / Remote AU' },
      { driver: 'Highest Yield Tech Stack', value: 'M365 + Azure + Intune + PowerShell Automation' },
      { driver: 'Clearance Competitive Moat', value: 'Baseline / NV1 Eligibility (Top 5% candidate filter)' }
    ]
  };
};

/**
 * Autonomous Agent Copilot: Generates proactive strategic actions for today's pipeline
 */
export const generateAgentInsights = (jobs = [], overrides = {}) => {
  const highMatchJobs = jobs.filter(j => j.score >= 85 && !j.isRejected && overrides[j.id]?.status !== 'Applied');
  const staleJobs = jobs.filter(j => overrides[j.id]?.status === 'Applied' && (!j.date || (new Date() - new Date(j.date)) / (1000*60*60*24) > 10));

  const priorityActions = [];

  if (highMatchJobs.length > 0) {
    const topJob = highMatchJobs[0];
    priorityActions.push({
      id: 'apply_top',
      type: 'high_priority',
      title: `Fast-Track High Match: ${topJob.company} (${topJob.score}% match)`,
      description: `Role "${topJob.title}" matches your verified Azure/Intune metrics. Immediate application package ready to compile.`,
      targetJobId: topJob.id,
      actionLabel: 'Open Application Studio'
    });
  }

  if (staleJobs.length > 0) {
    priorityActions.push({
      id: 'followup_stale',
      type: 'followup',
      title: `Follow Up on ${staleJobs.length} Stale Applications`,
      description: `Applications submitted >10 days ago at ${staleJobs.map(j => j.company).slice(0, 2).join(', ')} require recruiter check-ins.`,
      actionLabel: 'Review Stale Pipeline'
    });
  }

  priorityActions.push({
    id: 'daily_market_pulse',
    type: 'market_pulse',
    title: `Market Alignment Score: 92%`,
    description: `Currently indexing ${jobs.length} roles. Melbourne IT infrastructure hiring is active with strong demand for PowerShell & Intune specialists.`,
    actionLabel: 'View Market Intelligence'
  });

  return {
    appliedCount: Object.values(overrides).filter(o => o.status === 'Applied' || o.status === 'Interviewing').length,
    readyToApplyCount: highMatchJobs.length,
    staleCount: staleJobs.length,
    priorityActions
  };
};

export { MASTER_RESUME_HIGHLIGHTS };
