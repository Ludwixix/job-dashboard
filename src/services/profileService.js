/**
 * profileService.js
 * Multi-Profile & Persona Management Engine for Job Discovery
 * Includes Intelligent AI & Heuristic Resume Profiler and Telemetry Deductions
 */

export const STORAGE_KEY_PROFILES = 'job_dashboard_profiles';
export const STORAGE_KEY_ACTIVE_PROFILE_ID = 'job_dashboard_active_profile_id';

// Default Profiles for Demo & Instant Persona Switching
export const DEFAULT_PROFILES = [
  {
    id: 'sam_ludwig',
    name: 'Sam Ludwig',
    title: 'Senior Systems & Infrastructure Engineer',
    industry: 'Technology & IT',
    seniorityLevel: 'Senior / Lead',
    yearsOfExperience: 12,
    marketArchetype: 'Hybrid Cloud & Enterprise Infrastructure Transformation Specialist',
    email: 'sam.ludwig@gmail.com',
    phone: '0405 993 245',
    location: 'Balaclava VIC 3183',
    suburb: 'Balaclava',
    workRights: 'Australian Citizen (Unrestricted)',
    clearance: 'Australian Citizen (Baseline / NV1 Eligible)',
    targetSalary: '$140,000 - $165,000 + Super',
    keyStrengths: [
      'Zero-downtime multi-cloud migrations (AWS, Azure, M365)',
      'Enterprise PowerShell & Infrastructure-as-Code automation',
      'High-security government & healthcare compliance frameworks'
    ],
    managementStyle: 'Player-Coach / Hands-On Technical Mentor',
    targetTitles: [
      'Senior Systems Engineer',
      'Cloud Infrastructure Engineer',
      'M365 / Endpoint Engineer',
      'Infrastructure Architect',
      'Platform Engineer',
      'IT Operations Lead'
    ],
    coreSkills: [
      'Microsoft 365', 'Azure Cloud', 'PowerShell Automation', 'Active Directory / Entra ID',
      'VMware ESXi', 'AWS Cloud', 'Terraform', 'Intune / MDM', 'Exchange Online',
      'SharePoint Online', 'Windows Server', 'Linux (RHEL/Ubuntu)', 'CI/CD Pipelines',
      'Security Hardening', 'Disaster Recovery', 'ITIL Service Management'
    ],
    certifications: [
      'Microsoft Certified: Azure Administrator Associate (AZ-104)',
      'Microsoft 365 Certified: Enterprise Administrator Expert (MS-102)',
      'ITIL v4 Foundation'
    ],
    interviewTalkingPoints: [
      'Automated tenant migration for 660,000+ users with zero unplanned downtime using custom PowerShell runbooks.',
      'Designed and deployed hybrid Azure-on-prem infrastructure achieving 99.99% uptime for mission-critical health services.',
      'Cut server provisioning time by 85% through modular Terraform and Ansible templates.'
    ],
    workHistorySummary: 'Experienced Senior Infrastructure & Systems Engineer with 12+ years optimizing enterprise hybrid cloud environments, automating workflows via PowerShell, and leading complex cloud migration programs across government, education, and private sectors.',
    fullWorkExperienceText: `SENIOR SYSTEMS & INFRASTRUCTURE ENGINEER — Capgemini / Department of Education (2021 – Present)
- Led migration of 660k+ user identities to Azure Entra ID and Exchange Online with custom automation.
- Engineered hybrid cloud backup and disaster recovery architecture meeting strict Victorian Government standards.

INFRASTRUCTURE CONSULTANT — Datacom Systems (2017 – 2021)
- Delivered high-availability virtualization and storage solutions for tier-1 healthcare and enterprise clients.
- Automated endpoint provisioning for 2,500+ endpoints using Microsoft Intune and Autopilot.

SYSTEMS ADMINISTRATOR — Dimension Data (2013 – 2017)
- Administered multi-site Windows Server, VMware ESXi, and Active Directory environments.`
  },
  {
    id: 'sarah_chen',
    name: 'Sarah Chen',
    title: 'Lead Full Stack & Cloud Architect',
    industry: 'Technology & IT',
    seniorityLevel: 'Principal / Architect',
    yearsOfExperience: 9,
    marketArchetype: 'Full-Cycle Distributed Systems Architect & High-Throughput Web Specialist',
    email: 'sarah.chen@techmail.io',
    phone: '0412 345 678',
    location: 'Richmond VIC 3121',
    suburb: 'Richmond',
    workRights: 'Australian Citizen',
    clearance: 'Standard Clearance',
    targetSalary: '$165,000 - $190,000 + Super',
    keyStrengths: [
      'Event-driven microservices with Node.js, Go, and Kafka',
      'Modern reactive frontends with Next.js, React 19, and Tailwind',
      'Kubernetes orchestration & cost-optimized AWS architectures'
    ],
    managementStyle: 'Engineering Manager / Architecture Guild Leader',
    targetTitles: [
      'Lead Full Stack Engineer',
      'Principal Software Engineer',
      'Solutions Architect',
      'Staff Engineer',
      'Engineering Manager'
    ],
    coreSkills: [
      'React', 'TypeScript', 'Node.js', 'Go', 'AWS (ECS/EKS/Lambda)', 'Docker & Kubernetes',
      'GraphQL', 'PostgreSQL', 'Redis', 'Kafka', 'Tailwind CSS', 'Terraform', 'Next.js'
    ],
    certifications: ['AWS Certified Solutions Architect – Professional'],
    interviewTalkingPoints: [
      'Architected microservices handling 45,000 requests/sec with p99 latency < 45ms on AWS EKS.',
      'Reduced annual cloud infrastructure spend by 38% ($180k AUD) through Spot instances and container rightsizing.',
      'Mentored a team of 8 full-stack engineers and established strict CI/CD linting, automated testing, and release gates.'
    ],
    workHistorySummary: 'Staff Software Engineer and Cloud Architect specializing in scalable distributed microservices, modern reactive frontends, and developer platform engineering.',
    fullWorkExperienceText: 'LEAD ARCHITECT — FinTech Global (2022 – Present)\n- Led 8 engineers building event-driven payment pipelines in Node.js and AWS.\nSENIOR FULL STACK ENGINEER — Atlassian Partner (2018 – 2022)\n- Engineered high-traffic React/TypeScript web apps and REST/GraphQL APIs.'
  }
];

export const getProfiles = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(DEFAULT_PROFILES));
      return DEFAULT_PROFILES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PROFILES;
  } catch (e) {
    console.error('Error loading profiles from localStorage:', e);
    return DEFAULT_PROFILES;
  }
};

export const getActiveProfile = () => {
  const profiles = getProfiles();
  try {
    const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE_PROFILE_ID);
    const found = profiles.find(p => p.id === activeId);
    return found || profiles[0] || DEFAULT_PROFILES[0];
  } catch (e) {
    return profiles[0] || DEFAULT_PROFILES[0];
  }
};

export const setActiveProfile = (profileId) => {
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVE_PROFILE_ID, profileId);
    const profile = getProfiles().find(p => p.id === profileId);
    if (profile) {
      localStorage.setItem('candidate_profile', JSON.stringify(profile));
    }
  } catch (e) {
    console.error('Error setting active profile:', e);
  }
};

export const saveProfile = (profile) => {
  try {
    const profiles = getProfiles();
    const existingIdx = profiles.findIndex(p => p.id === profile.id);
    let updated;
    if (existingIdx !== -1) {
      updated = [...profiles];
      updated[existingIdx] = profile;
    } else {
      updated = [...profiles, profile];
    }
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(updated));
    setActiveProfile(profile.id);
    return updated;
  } catch (e) {
    console.error('Error saving profile:', e);
    return DEFAULT_PROFILES;
  }
};

export const deleteProfile = (profileId) => {
  try {
    const profiles = getProfiles();
    const filtered = profiles.filter(p => p.id !== profileId);
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(filtered));
    if (getActiveProfile()?.id === profileId) {
      setActiveProfile(filtered[0]?.id || 'sam_ludwig');
    }
    return filtered;
  } catch (e) {
    console.error('Error deleting profile:', e);
  }
};

/**
 * Intelligent Client-Side Heuristic & Deduction Engine
 * Uses regex, pattern analysis, and domain heuristics to build a rich candidate profile without an LLM key.
 */
export const parseResumeTextClientSide = (rawText = '') => {
  const text = rawText.trim();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Extract Name
  let name = lines[0] || 'Candidate Name';
  if (name.toLowerCase().startsWith('resume') || name.toLowerCase().startsWith('curriculum') || name.toLowerCase().startsWith('cv')) {
    name = lines[1] || 'Candidate Name';
  }
  name = name.replace(/[^a-zA-Z\s.-]/g, '').trim();

  // 2. Contact details
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : '';

  const phoneMatch = text.match(/(?:\+?61|0)[2-478](?:[ -]?[0-9]){8}/) || text.match(/\b\d{4}[ -]?\d{3}[ -]?\d{3}\b/);
  const phone = phoneMatch ? phoneMatch[0] : '';

  const locMatch = text.match(/([A-Z][a-zA-Z\s]+(?:VIC|NSW|QLD|WA|SA|TAS|ACT|NT)\s*\d{4})/i) || text.match(/Melbourne|Sydney|Brisbane|Perth|Adelaide|Canberra/i);
  const location = locMatch ? locMatch[0].trim() : 'Melbourne, VIC';
  const suburb = location.split(',')[0].replace(/(VIC|NSW|QLD|WA|SA|TAS|ACT|NT|\d+)/gi, '').trim() || 'Melbourne';

  // 3. Detect Industry
  let industry = 'Technology & IT';
  const lower = text.toLowerCase();
  if (lower.includes('nurse') || lower.includes('hospital') || lower.includes('ahpra') || lower.includes('clinical') || lower.includes('patient care') || lower.includes('medical officer')) {
    industry = 'Healthcare & Medical';
  } else if (lower.includes('cpa') || lower.includes('chartered accountant') || lower.includes('fp&a') || lower.includes('financial reporting') || lower.includes('audit') || lower.includes('general ledger')) {
    industry = 'Finance & Accounting';
  } else if (lower.includes('seo') || lower.includes('google ads') || lower.includes('growth marketing') || lower.includes('campaign manager') || lower.includes('social media marketing') || lower.includes('hubspot')) {
    industry = 'Marketing & Sales';
  } else if (lower.includes('carpenter') || lower.includes('site manager') || lower.includes('construction') || lower.includes('civil engineer') || lower.includes('trades') || lower.includes('whs')) {
    industry = 'Construction & Trades';
  } else if (lower.includes('curriculum') || lower.includes('teacher') || lower.includes('classroom') || lower.includes('pedagogy') || lower.includes('academic')) {
    industry = 'Education & Training';
  } else if (lower.includes('solicitor') || lower.includes('lawyer') || lower.includes('compliance') || lower.includes('regulatory') || lower.includes('litigation')) {
    industry = 'Legal & Compliance';
  }

  // 4. Extract Skills Catalog
  const skillBank = [
    'React', 'TypeScript', 'JavaScript', 'Node.js', 'Python', 'SQL', 'Java', 'C#', '.NET',
    'HTML', 'CSS', 'Tailwind CSS', 'Next.js', 'Vue', 'Angular', 'AWS', 'Azure', 'GCP',
    'Docker', 'Kubernetes', 'CI/CD', 'Git', 'GitHub', 'PowerShell', 'Active Directory',
    'Microsoft 365', 'SharePoint', 'Intune', 'ServiceNow', 'ITIL', 'Linux', 'VMware',
    'Power BI', 'Tableau', 'Pandas', 'Excel', 'Data Analysis', 'Cybersecurity', 'Terraform',
    'Agile', 'Scrum', 'Leadership', 'Project Management', 'Stakeholder Management',
    'GraphQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Kafka', 'SRE', 'DevOps',
    'AHPRA Registered Nurse', 'Acute Care', 'Clinical Governance', 'Emergency Triage',
    'Financial Modeling', 'Variance Analysis', 'SAP ERP', 'General Ledger', 'IFRS Standards',
    'Google Ads', 'Meta Ads', 'HubSpot', 'SEO Strategy', 'Funnel Optimization'
  ];

  const extractedSkills = skillBank.filter(skill => {
    const reg = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return reg.test(text);
  });

  // 5. Seniority and Title Estimation
  let seniorityLevel = 'Senior';
  let yearsOfExperience = 7;
  if (lower.includes('principal') || lower.includes('architect') || lower.includes('director') || lower.includes('head of')) {
    seniorityLevel = 'Principal / Architect';
    yearsOfExperience = 10;
  } else if (lower.includes('lead') || lower.includes('manager')) {
    seniorityLevel = 'Lead / Manager';
    yearsOfExperience = 8;
  } else if (lower.includes('senior') || lower.includes('sr.')) {
    seniorityLevel = 'Senior';
    yearsOfExperience = 6;
  } else if (lower.includes('junior') || lower.includes('graduate') || lower.includes('entry')) {
    seniorityLevel = 'Junior / Entry';
    yearsOfExperience = 2;
  } else {
    seniorityLevel = 'Mid-Level';
    yearsOfExperience = 4;
  }

  // Detect Best Market Title
  const titleKeywords = [
    'Senior Systems Engineer', 'Cloud Infrastructure Engineer', 'Lead Full Stack Engineer',
    'Solutions Architect', 'DevOps Engineer', 'Site Reliability Engineer', 'Software Engineer',
    'Platform Engineer', 'Data Engineer', 'Cybersecurity Analyst', 'Product Manager',
    'Clinical Nurse Specialist', 'Registered Nurse', 'Senior Financial Analyst',
    'Finance Manager', 'Digital Marketing Manager', 'Operations Lead', 'Project Manager'
  ];
  let title = `${seniorityLevel} Specialist`;
  for (const tk of titleKeywords) {
    if (new RegExp(`\\b${tk}\\b`, 'i').test(text)) {
      title = tk;
      break;
    }
  }

  // Deduce Strategic Target Titles
  const targetTitles = [
    title,
    `Lead ${title.replace(/Senior |Lead |Principal /gi, '')}`,
    `Senior ${title.replace(/Senior |Lead |Principal /gi, '')}`,
    `${title.replace(/Senior |Lead |Principal /gi, '')} Consultant`,
    `Infrastructure & Cloud Specialist`
  ].filter((v, i, a) => a.indexOf(v) === i);

  // Estimate Realistic Market Salary
  let targetSalary = '$130,000 - $155,000 + Super';
  if (seniorityLevel.includes('Principal') || seniorityLevel.includes('Architect')) {
    targetSalary = '$165,000 - $195,000 + Super';
  } else if (seniorityLevel.includes('Lead')) {
    targetSalary = '$145,000 - $175,000 + Super';
  } else if (seniorityLevel.includes('Junior')) {
    targetSalary = '$75,000 - $95,000 + Super';
  } else if (seniorityLevel.includes('Mid')) {
    targetSalary = '$105,000 - $130,000 + Super';
  }

  // Security Clearance Deduction
  const hasClearance = lower.includes('clearance') || lower.includes('nv1') || lower.includes('nv2') || lower.includes('baseline') || lower.includes('defence') || lower.includes('australian citizen');
  const clearance = hasClearance ? 'Australian Citizen (Baseline / NV1 Eligible)' : 'Australian Citizen / Standard';

  return {
    id: `custom_${Date.now()}`,
    name: name || 'New Candidate',
    title: title,
    industry: industry,
    seniorityLevel: seniorityLevel,
    yearsOfExperience: yearsOfExperience,
    marketArchetype: `${seniorityLevel} ${industry} Professional & Specialist`,
    email: email || 'candidate@example.com',
    phone: phone || '0400 000 000',
    location: location,
    suburb: suburb,
    workRights: 'Australian Citizen (Unrestricted)',
    clearance: clearance,
    targetSalary: targetSalary,
    targetTitles: targetTitles,
    coreSkills: extractedSkills.length > 0 ? extractedSkills : ['Leadership', 'Problem Solving', 'Strategic Planning', 'Process Optimization'],
    certifications: [],
    keyStrengths: [
      `Extensive hands-on execution across ${industry} environments`,
      'Proven ability to optimize workflows and reduce operational friction',
      'Strong cross-functional stakeholder communication and delivery focus'
    ],
    managementStyle: 'Collaborative / Outcome-Driven',
    interviewTalkingPoints: [
      'Delivered critical organizational milestones ahead of schedule with zero disruption.',
      'Identified and resolved workflow bottlenecks resulting in measurable operational efficiency gains.',
      'Championed standard operating procedures and mentored junior colleagues on best practices.'
    ],
    workHistorySummary: text.slice(0, 600) || 'Experienced professional with demonstrated background in driving impact and high-quality outcomes.',
    fullWorkExperienceText: text
  };
};

/**
 * Deep AI-Powered Structured Resume Parsing via OpenRouter
 * Extracts exhaustive psychological, structural, and behavioral metadata.
 */
export const parseResumeWithAI = async (resumeText, apiKey, model = 'z-ai/glm-5.3-flash') => {
  if (!apiKey) {
    return parseResumeTextClientSide(resumeText);
  }

  const prompt = `You are a Principal Executive Recruiter, Behavioral Analyst, and Talent Architect.
Analyze the following resume text and synthesize an exhaustive, highly structured candidate profile JSON.

Read deeply into their career timeline to make smart, evidence-based deductions:
1. "industry": Must be one of ["Technology & IT", "Healthcare & Medical", "Finance & Accounting", "Marketing & Sales", "Construction & Trades", "Education & Training", "Legal & Compliance"].
2. "seniorityLevel": One of ["Junior / Graduate", "Mid-Level", "Senior", "Lead / Principal", "Executive / Director"].
3. "yearsOfExperience": Total years of professional experience across their career history (integer).
4. "marketArchetype": A punchy, 5-8 word executive positioning statement (e.g. "Enterprise Hybrid Cloud Transformation & DevOps Modernization Specialist").
5. "targetTitles": 6 to 8 strategic, highly marketable target job titles in the Australian employment market (including current level, lateral targets, and natural promotion steps).
6. "targetSalary": Realistic Australian market benchmark package based on seniority and skills (e.g. "$145,000 - $170,000 + Super").
7. "keyStrengths": 3 to 4 distinct, quantified competitive superpowers that set this candidate apart from generic applicants.
8. "managementStyle": 1-sentence descriptor of their working/leadership archetype (e.g. "Hands-On Technical Player-Coach / Collaborative Architect").
9. "interviewTalkingPoints": Exactly 3 STAR-method signature achievement stories with real numbers/metrics extracted from their resume.
10. "coreSkills": 15-25 high-impact technical, domain, and tool keywords prioritized for ATS scoring.
11. "certifications": Array of verified professional certifications (AWS, Microsoft, CISSP, ITIL, CPA, AHPRA, PMP, Scrum, etc.).
12. "workHistorySummary": A 3-sentence executive career narrative highlighting overall trajectory, scale, and core domain focus.

Return ONLY a valid JSON object matching this schema with NO markdown code blocks, NO backticks, and NO conversational text.

Schema:
{
  "name": "Full Name",
  "title": "Most marketable current professional title",
  "industry": "Industry Category",
  "seniorityLevel": "Seniority Level",
  "yearsOfExperience": 10,
  "marketArchetype": "Executive Market Positioning Descriptor",
  "email": "Email Address",
  "phone": "Phone Number",
  "location": "City, State Postcode",
  "suburb": "Suburb Name",
  "workRights": "Australian Citizen (Unrestricted)",
  "clearance": "Security Clearance Eligibility (e.g. Baseline / NV1 Eligible)",
  "targetSalary": "$140,000 - $165,000 + Super",
  "targetTitles": ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5", "Title 6"],
  "coreSkills": ["Skill 1", "Skill 2", "Skill 3"],
  "certifications": ["Cert 1", "Cert 2"],
  "keyStrengths": ["Strength 1", "Strength 2", "Strength 3"],
  "managementStyle": "Leadership & Working Style",
  "interviewTalkingPoints": ["STAR Story 1", "STAR Story 2", "STAR Story 3"],
  "workHistorySummary": "Executive career summary narrative",
  "fullWorkExperienceText": "Clean, structured chronological resume text"
}

Resume Text:
${resumeText.slice(0, 9000)}`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://job-dashboard-6xrdvjlrcq-ts.a.run.app',
        'X-Title': 'CAREER.AGENT - Deep Profile Engine'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: 'You are a precise talent intelligence parser that outputs strictly valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 3000
      })
    });

    if (!res.ok) {
      throw new Error(`OpenRouter parser API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      id: `custom_${Date.now()}`,
      ...parsed,
      fullWorkExperienceText: parsed.fullWorkExperienceText || resumeText
    };
  } catch (e) {
    console.warn('AI Parsing failed, falling back to enhanced heuristic parser:', e);
    return parseResumeTextClientSide(resumeText);
  }
};

// Aliases for backwards compatibility
export const getAllProfiles = getProfiles;
export const getActiveProfileId = () => {
  return localStorage.getItem(STORAGE_KEY_ACTIVE_PROFILE_ID) || 'sam_ludwig';
};
export const setActiveProfileId = setActiveProfile;
