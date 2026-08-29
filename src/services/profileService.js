/**
 * profileService.js
 * Multi-user Candidate Profile Storage, Management & AI Resume Extraction
 */

export const DEFAULT_PROFILES = [
  {
    id: 'sam_ludwig',
    name: 'Sam Ludwig',
    title: 'Senior IT Systems & Infrastructure Engineer',
    email: 'sam.ludwig@gmail.com',
    phone: '0405 993 245',
    location: 'Melbourne, VIC (Balaclava 3183)',
    suburb: 'Balaclava',
    workRights: 'Australian Citizen | Baseline / NV1 Eligible',
    clearance: 'Baseline / NV1 Ready',
    targetSalary: '$115,000 + Super',
    industry: 'Technology & IT',
    targetTitles: [

      'Senior Systems Engineer', 'M365 Engineer', 'Cloud Infrastructure Engineer',
      'SharePoint Administrator', 'IT Operations Lead', 'Platform Support Engineer'
    ],
    coreSkills: [
      'Microsoft 365', 'Azure', 'Entra ID', 'Intune', 'Autopilot', 'PowerShell',
      'Active Directory', 'Windows Server', 'Exchange Hybrid', 'SharePoint Online',
      'ServiceNow', 'ITIL 4', 'ACSC Essential 8', 'VMware', 'SPFx / React', 'CI/CD'
    ],
    certifications: ['AZ-104 (Azure Administrator)', 'ITIL 4 Foundation', 'AZ-900 (Azure Fundamentals)'],
    workHistorySummary: `
- 660,000+ users: Managed Southern Hemisphere's largest SharePoint farm (Dept. of Education VIC)
- 99.9% uptime: Multi-year production SharePoint operations in government SLA environment
- 87% processing time reduction: PowerShell automation at Knosys (2hr → 15min per batch)
- 25% deployment cycle reduction: CI/CD pipelines at Engage Squared
- 15% repeat incident reduction: RCA-driven preventive measures at Capgemini/Dept. Ed VIC
- 95% SLA resolution: L3 application support at Knosys (Cotton On, Harvey Norman, Healthscope)
- 100+ clinical endpoints migrated: Windows 11 at St John of God with zero patient care disruption
`,
    fullWorkExperienceText: `
SAM LUDWIG — Senior IT Infrastructure & M365 Engineer
Location: Melbourne, VIC | Phone: 0405 993 245 | Email: sam.ludwig@gmail.com
Australian Citizen | Clearance Eligible: Baseline / NV1 | LinkedIn: linkedin.com/in/sam-ludwig

PROFESSIONAL EXPERIENCE:
1. Knosys — Senior Application Support Engineer (2025 – Present)
- Delivered tier-3 application support and systems engineering for SaaS knowledge management platforms.
- Automated bulk tenant configurations with PowerShell, reducing deployment cycle times by 87%.

2. Engage Squared — Microsoft 365 / SharePoint Systems Consultant (2022 – 2024)
- Engineered scalable M365 and SharePoint enterprise intranets across enterprise clients.
- Automated governance workflows and tenant migrations with PowerShell and Power Automate.

3. Capgemini — Systems & Application Engineer (Contract: Dept of Education VIC) (2020 – 2022)
- Managed core infrastructure for 660,000+ student and teacher accounts with 99.9% SLA uptime.
- Enforced ACSC Essential 8 endpoint and access security across all education regional hubs.

4. St John of God Health Care — Clinical Systems Deployment Specialist (2019 – 2020)
- Upgraded 100+ clinical endpoint workstations to Windows 11 with zero interruption to medical operations.
`
  },
  {
    id: 'alex_chen_dev',
    name: 'Alex Chen',
    title: 'Senior Full Stack & React Developer',
    email: 'alex.chen.dev@gmail.com',
    phone: '0412 345 678',
    location: 'Richmond, VIC 3121',
    suburb: 'Richmond',
    workRights: 'Australian Citizen (Unrestricted)',
    clearance: 'None / Citizen',
    targetSalary: '$135,000 + Super',
    targetTitles: [
      'Senior Full Stack Engineer', 'React Developer', 'Frontend Architect',
      'JavaScript / TypeScript Engineer', 'Node.js Developer', 'Software Engineer'
    ],
    coreSkills: [
      'React', 'TypeScript', 'JavaScript', 'Node.js', 'Next.js', 'Tailwind CSS',
      'GraphQL', 'REST APIs', 'PostgreSQL', 'AWS (Lambda, S3)', 'Docker', 'Jest / Vitest'
    ],
    certifications: ['AWS Certified Developer Associate', 'Meta Frontend Professional'],
    workHistorySummary: `
- Built high-traffic React SPA serving 250k+ monthly active users with sub-second LCP.
- Modernized legacy codebases into modular TypeScript/Vite architectures, cutting bundle sizes by 45%.
- Implemented robust CI/CD automated test suites covering 90%+ core code paths.
`,
    fullWorkExperienceText: `
ALEX CHEN — Senior Full Stack & React Developer
Location: Melbourne, VIC | Phone: 0412 345 678 | Email: alex.chen.dev@gmail.com

PROFESSIONAL EXPERIENCE:
1. FinTech Innovations — Senior Frontend Engineer (2022 – Present)
- Led frontend architecture for consumer-facing payments portal using React 18, TypeScript, and Tailwind CSS.
- Optimized rendering cycles and asset pipelines, achieving 98+ Google Lighthouse performance scores.

2. CloudScale Digital — Full Stack Engineer (2020 – 2022)
- Developed scalable Node.js microservices and React dashboards connecting to PostgreSQL and AWS Lambda.
`
  },
  {
    id: 'sarah_miller_data',
    name: 'Sarah Miller',
    title: 'Senior Data Analyst & Business Intelligence Specialist',
    email: 'sarah.miller.data@gmail.com',
    phone: '0423 456 789',
    location: 'Melbourne CBD, VIC 3000',
    suburb: 'Melbourne CBD',
    workRights: 'Australian Citizen (Unrestricted)',
    clearance: 'Baseline Ready',
    targetSalary: '$120,000 + Super',
    targetTitles: [
      'Senior Data Analyst', 'BI Analyst', 'Power BI Developer',
      'Analytics Engineer', 'Data & Reporting Specialist', 'SQL Analyst'
    ],
    coreSkills: [
      'Power BI', 'SQL', 'Python (Pandas, NumPy)', 'Tableau', 'DAX',
      'Data Modeling', 'Snowflake', 'BigQuery', 'ETL Pipelines', 'Excel Advanced'
    ],
    certifications: ['Microsoft Certified: Power BI Data Analyst Associate (PL-300)', 'Snowflake Core'],
    workHistorySummary: `
- Designed 50+ interactive executive Power BI dashboards driving $15M+ annual procurement decisions.
- Automated daily ETL data pipelines in Python and SQL, saving 15 hours of manual reporting per week.
- Performed predictive customer cohort analyses boosting retention by 18%.
`,
    fullWorkExperienceText: `
SARAH MILLER — Senior Data Analyst & BI Specialist
Location: Melbourne, VIC | Phone: 0423 456 789 | Email: sarah.miller.data@gmail.com

PROFESSIONAL EXPERIENCE:
1. Horizon Retail Group — Lead BI & Reporting Analyst (2022 – Present)
- Architected enterprise Power BI and SQL reporting dashboards across 120 retail outlets.
- Conducted multivariate revenue and inventory forecasting in Python.

2. Metro Health Analytics — Data Analyst (2019 – 2022)
- Maintained SQL data warehouses and automated compliance reports for healthcare operations.
`
    ,
    industry: 'Technology & IT'
  },
  {
    id: 'emma_watson_health',
    name: 'Emma Watson',
    title: 'Clinical Nurse Specialist & Associate Nurse Unit Manager',
    email: 'emma.watson.rn@gmail.com',
    phone: '0434 567 890',
    location: 'Parkville, VIC 3052',
    suburb: 'Parkville',
    workRights: 'Australian Citizen (Unrestricted)',
    clearance: 'Working with Children / Police Check Cleared',
    targetSalary: '$105,000 + Super',
    industry: 'Healthcare & Medical',
    targetTitles: [
      'Clinical Nurse Specialist', 'Associate Nurse Unit Manager (ANUM)',
      'Registered Nurse — Emergency / Acute Care', 'Clinical Care Coordinator', 'Nurse Educator'
    ],
    coreSkills: [
      'AHPRA Registered Nurse', 'Acute Patient Assessment', 'Emergency Triage',
      'Clinical Governance', 'Medication Administration', 'Multidisciplinary Team Leadership',
      'EMR / Cerner / Epic', 'Patient Safety & Quality Care', 'Preceptorship / Mentoring'
    ],
    certifications: ['Postgraduate Certificate in Acute Care Nursing', 'Advanced Life Support (ALS 2)'],
    workHistorySummary: `
- 7+ years acute clinical nursing and shift leadership across major Victorian public hospitals.
- Led surgical and emergency ward shifts of 12+ nurses maintaining 100% medication safety standards.
- Preceptored 25+ graduate nurses and developed standardized clinical triage training workflows.
`,
    fullWorkExperienceText: `
EMMA WATSON — Clinical Nurse Specialist / RN
Location: Melbourne, VIC | Phone: 0434 567 890 | Email: emma.watson.rn@gmail.com

PROFESSIONAL EXPERIENCE:
1. Royal Melbourne Hospital — Clinical Nurse Specialist (2021 – Present)
- Delivered advanced acute nursing care and stepped in as acting Nurse Unit Manager.
- Coordinated rapid response protocols and multidisciplinary patient discharge pathways.

2. Epworth Healthcare — Registered Nurse (2018 – 2021)
- Managed complex post-operative surgical patients and supervised junior nursing staff.
`
  },
  {
    id: 'david_park_finance',
    name: 'David Park',
    title: 'Senior Financial Analyst & CPA',
    email: 'david.park.cpa@gmail.com',
    phone: '0445 678 901',
    location: 'Melbourne CBD, VIC 3000',
    suburb: 'Melbourne CBD',
    workRights: 'Australian Citizen (Unrestricted)',
    clearance: 'None / Citizen',
    targetSalary: '$130,000 + Super',
    industry: 'Finance & Accounting',
    targetTitles: [
      'Senior Financial Analyst', 'FP&A Manager', 'Commercial Finance Analyst',
      'Senior Management Accountant', 'Finance Business Partner'
    ],
    coreSkills: [
      'CPA Qualified', 'Financial Modeling (3-Statement)', 'FP&A & Budgeting',
      'Variance Analysis', 'SAP ERP', 'Power BI / Advanced Excel', 'Cashflow Forecasting',
      'Commercial Advisory', 'IFRS Compliance', 'Stakeholder Management'
    ],
    certifications: ['Certified Practising Accountant (CPA Australia)', 'FMVA (Financial Modeling & Valuation)'],
    workHistorySummary: `
- Led annual budgeting & rolling 5-year financial planning cycles for $85M+ enterprise business units.
- Built automated Power BI financial reporting models reducing month-end close by 3 days.
- Delivered commercial pricing sensitivity models boosting gross margins by 4.2%.
`,
    fullWorkExperienceText: `
DAVID PARK — Senior Financial Analyst (CPA)
Location: Melbourne, VIC | Phone: 0445 678 901 | Email: david.park.cpa@gmail.com

PROFESSIONAL EXPERIENCE:
1. Telstra Enterprise — Senior Commercial Analyst (2022 – Present)
- Built financial models evaluating multi-million dollar telecommunications bids.
- Partnered with product executives on quarterly OPEX/CAPEX variance forecasting.

2. Deloitte Australia — Financial Advisory Consultant (2019 – 2022)
- Prepared valuation models, statutory balance sheets, and working capital optimization analyses.
`
  },
  {
    id: 'jessica_taylor_mkt',
    name: 'Jessica Taylor',
    title: 'Senior Digital Marketing & Growth Manager',
    email: 'jessica.taylor.mkt@gmail.com',
    phone: '0456 789 012',
    location: 'South Yarra, VIC 3141',
    suburb: 'South Yarra',
    workRights: 'Australian Citizen (Unrestricted)',
    clearance: 'None / Citizen',
    targetSalary: '$125,000 + Super',
    industry: 'Marketing & Sales',
    targetTitles: [
      'Digital Marketing Manager', 'Growth Marketing Lead', 'Head of Performance Marketing',
      'Brand & Acquisition Specialist', 'Campaign Manager'
    ],
    coreSkills: [
      'Performance Marketing', 'Google Ads / Meta Ads', 'SEO / SEM Strategy',
      'HubSpot / Marketo', 'Growth Funnel Optimization', 'Content Marketing',
      'Google Analytics 4', 'A/B Testing & CRO', 'Paid Acquisition ROI', 'Brand Strategy'
    ],
    certifications: ['Google Ads Search & Measurement Certified', 'HubSpot Inbound Marketing'],
    workHistorySummary: `
- Scaled digital acquisition channels delivering 42% YoY revenue growth across ANZ markets.
- Managed $1.2M+ annual performance ad budgets achieving 4.1x blended ROAS.
- Spearheaded omnichannel SEO and content overhaul generating 180k+ monthly organic visitors.
`,
    fullWorkExperienceText: `
JESSICA TAYLOR — Senior Digital Marketing & Growth Lead
Location: Melbourne, VIC | Phone: 0456 789 012 | Email: jessica.taylor.mkt@gmail.com

PROFESSIONAL EXPERIENCE:
1. Kogan.com — Senior Performance Marketing Specialist (2022 – Present)
- Optimized paid search, social, and programmatic ad funnels across 5,000+ SKU categories.

2. Agency 360 Digital — Digital Strategy Lead (2019 – 2022)
- Orchestrated full-funnel B2B and B2C campaigns for high-growth Australian brands.
`
  },
  {
    id: 'michael_thompson_con',
    name: 'Michael Thompson',
    title: 'Senior Construction Project Manager & Civil Engineer',
    location: 'Hawthorn, VIC 3122',
    suburb: 'Hawthorn',
    email: 'michael.thompson.pm@gmail.com',
    phone: '0467 890 123',
    workRights: 'Australian Citizen (Unrestricted)',
    clearance: 'White Card / Rail Industry Worker Cleared',
    targetSalary: '$165,000 + Super',
    industry: 'Construction & Trades',
    targetTitles: [
      'Construction Project Manager', 'Senior Project Engineer', 'Site Manager — Tier 1 Commercial',
      'Civil Project Manager', 'Contracts Administrator'
    ],
    coreSkills: [
      'Tier 1 Commercial Delivery', 'Project Scheduling (MS Project/Primavera)', 'Procore',
      'Contract Administration (AS4000/AS2124)', 'Subcontractor Procurement', 'Site WHS Compliance',
      'Budget Management ($40M+)', 'Civil Engineering', 'Structural QA / Inspections'
    ],
    certifications: ['Engineers Australia (MIEAust CPEng)', 'White Card / First Aid Level 2'],
    workHistorySummary: `
- 10+ years delivering major commercial, transport, and structural high-rise building projects.
- Successfully delivered a $65M commercial office tower in Melbourne CBD on time and 3% under budget.
- Championed zero-LTI safety protocols across 140+ on-site personnel and trade subcontractors.
`,
    fullWorkExperienceText: `
MICHAEL THOMPSON — Construction Project Manager (CPEng)
Location: Melbourne, VIC | Phone: 0467 890 123 | Email: michael.thompson.pm@gmail.com

PROFESSIONAL EXPERIENCE:
1. John Holland Group — Senior Project Manager (2021 – Present)
- Overseeing structural and civil construction works for transport and commercial hub packages.

2. Probuild Constructions — Project Engineer (2017 – 2021)
- Managed site QA, RFIs, subcontract packages, and handover schedules on multi-level developments.
`
  }
];

const LS_CUSTOM_PROFILES = 'job_dashboard_custom_profiles';
const LS_ACTIVE_PROFILE_ID = 'job_dashboard_active_profile_id';

/**
 * Get all available candidate profiles (default presets + user saved custom profiles)
 */
export const getAllProfiles = () => {
  try {
    const raw = localStorage.getItem(LS_CUSTOM_PROFILES);
    const customProfiles = raw ? JSON.parse(raw) : [];
    return [...DEFAULT_PROFILES, ...customProfiles];
  } catch (e) {
    console.error('Error loading custom profiles:', e);
    return DEFAULT_PROFILES;
  }
};

/**
 * Get the currently active candidate profile
 */
export const getActiveProfile = () => {
  const all = getAllProfiles();
  const activeId = localStorage.getItem(LS_ACTIVE_PROFILE_ID) || 'sam_ludwig';
  const found = all.find(p => p.id === activeId);
  return found || all[0] || DEFAULT_PROFILES[0];
};

/**
 * Set the currently active profile ID
 */
export const setActiveProfileId = (profileId) => {
  localStorage.setItem(LS_ACTIVE_PROFILE_ID, profileId);
};

/**
 * Save or update a custom candidate profile in localStorage
 */
export const saveProfile = (profile) => {
  if (!profile) return;
  const profileToSave = {
    ...profile,
    id: profile.id || `custom_${Date.now()}`,
    updatedAt: new Date().toISOString()
  };

  try {
    const raw = localStorage.getItem(LS_CUSTOM_PROFILES);
    let customProfiles = raw ? JSON.parse(raw) : [];
    
    const existingIdx = customProfiles.findIndex(p => p.id === profileToSave.id);
    if (existingIdx >= 0) {
      customProfiles[existingIdx] = profileToSave;
    } else {
      customProfiles = [profileToSave, ...customProfiles];
    }

    localStorage.setItem(LS_CUSTOM_PROFILES, JSON.stringify(customProfiles));
    localStorage.setItem(LS_ACTIVE_PROFILE_ID, profileToSave.id);
    return profileToSave;
  } catch (e) {
    console.error('Error saving profile:', e);
    return profileToSave;
  }
};

/**
 * Delete a custom profile
 */
export const deleteProfile = (profileId) => {
  try {
    const raw = localStorage.getItem(LS_CUSTOM_PROFILES);
    let customProfiles = raw ? JSON.parse(raw) : [];
    customProfiles = customProfiles.filter(p => p.id !== profileId);
    localStorage.setItem(LS_CUSTOM_PROFILES, JSON.stringify(customProfiles));

    if (localStorage.getItem(LS_ACTIVE_PROFILE_ID) === profileId) {
      localStorage.setItem(LS_ACTIVE_PROFILE_ID, DEFAULT_PROFILES[0].id);
    }
  } catch (e) {
    console.error('Error deleting profile:', e);
  }
};

/**
 * Fast Client-Side Regex + Heuristic Resume Text Extractor
 * Automatically extracts candidate details without requiring an LLM API key.
 */
export const parseResumeTextClientSide = (rawText = '') => {
  const text = rawText.trim();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let name = lines[0] || 'Candidate Name';
  if (name.toLowerCase().startsWith('resume') || name.toLowerCase().startsWith('curriculum')) {
    name = lines[1] || 'Candidate Name';
  }
  name = name.replace(/[^a-zA-Z\s.-]/g, '').trim();

  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : '';

  const phoneMatch = text.match(/(?:\+?61|0)[2-478](?:[ -]?[0-9]){8}/) || text.match(/\b\d{4}[ -]?\d{3}[ -]?\d{3}\b/);
  const phone = phoneMatch ? phoneMatch[0] : '';

  const locMatch = text.match(/([A-Z][a-zA-Z\s]+(?:VIC|NSW|QLD|WA|SA|TAS|ACT|NT)\s*\d{4})/i) || text.match(/Melbourne|Sydney|Brisbane|Perth|Adelaide/i);
  const location = locMatch ? locMatch[0].trim() : 'Melbourne, VIC';

  const suburb = location.split(',')[0].replace(/(VIC|NSW|QLD|WA|SA|TAS|ACT|NT|\d+)/gi, '').trim() || 'Melbourne';

  const commonTechSkills = [
    'React', 'JavaScript', 'TypeScript', 'Node.js', 'Python', 'SQL', 'Java', 'C#', '.NET',
    'HTML', 'CSS', 'Tailwind CSS', 'Next.js', 'Vue', 'Angular', 'AWS', 'Azure', 'GCP',
    'Docker', 'Kubernetes', 'CI/CD', 'Git', 'GitHub', 'PowerShell', 'Active Directory',
    'Microsoft 365', 'SharePoint', 'Intune', 'ServiceNow', 'ITIL', 'Linux', 'VMware',
    'Power BI', 'Tableau', 'Pandas', 'Excel', 'Data Analysis', 'Cybersecurity', 'Terraform'
  ];

  const extractedSkills = commonTechSkills.filter(skill => {
    const reg = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return reg.test(text);
  });

  const titleKeywords = [
    'Senior Systems Engineer', 'Software Engineer', 'Full Stack Developer', 'Frontend Developer',
    'Backend Developer', 'Data Analyst', 'DevOps Engineer', 'Cloud Architect', 'Project Manager',
    'IT Support Specialist', 'Network Engineer', 'Cybersecurity Analyst', 'Business Analyst'
  ];
  let title = 'Experienced Professional';
  for (const tk of titleKeywords) {
    if (new RegExp(`\\b${tk}\\b`, 'i').test(text)) {
      title = tk;
      break;
    }
  }

  return {
    id: `custom_${Date.now()}`,
    name: name || 'New Candidate',
    title: title,
    email: email,
    phone: phone,
    location: location,
    suburb: suburb,
    workRights: 'Australian Citizen (Unrestricted)',
    clearance: text.toLowerCase().includes('clearance') || text.toLowerCase().includes('nv1') || text.toLowerCase().includes('baseline') ? 'Baseline / NV1 Ready' : 'Citizen / Standard',
    targetSalary: '$115,000 + Super',
    targetTitles: [title],
    coreSkills: extractedSkills.length > 0 ? extractedSkills : ['Communication', 'Problem Solving', 'Leadership', 'Project Management'],
    certifications: [],
    workHistorySummary: text.slice(0, 500),
    fullWorkExperienceText: text
  };
};

/**
 * AI-Powered Structured Resume Parsing via OpenRouter
 */
export const parseResumeWithAI = async (resumeText, apiKey, model = 'z-ai/glm-5.3-flash') => {
  if (!apiKey) {
    return parseResumeTextClientSide(resumeText);
  }

  const prompt = `You are an expert HR data parsing system. Extract the candidate's core profile from the following resume text into a strict, valid JSON object.
Return ONLY the raw JSON object with NO preamble, NO markdown code fences, and NO extra commentary.

JSON Schema:
{
  "name": "Candidate Full Name",
  "title": "Current or Target Professional Job Title",
  "email": "Email address",
  "phone": "Phone number",
  "location": "City, State, Postcode (e.g. Melbourne, VIC 3000)",
  "suburb": "Primary Suburb (e.g. Richmond, Balaclava, St Kilda)",
  "workRights": "Australian Citizen or Visa status",
  "clearance": "Security clearance status if mentioned, otherwise 'Citizen / Standard'",
  "targetSalary": "Estimated market salary range (e.g. $120,000 + Super)",
  "targetTitles": ["Array of 3-5 suitable target job titles based on experience"],
  "coreSkills": ["Array of 10-16 specific technical and professional skills mentioned"],
  "certifications": ["Array of certifications mentioned"],
  "workHistorySummary": "A concise 4-6 bullet point summary of career accomplishments and verified metrics",
  "fullWorkExperienceText": "Structured text summary of their work experience history with roles, companies, dates, and accomplishments"
}

Resume Text:
${resumeText.slice(0, 6000)}`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Job Discovery Matrix Resume Parser'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: 'You extract candidate profile details into structured JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 2000
      })
    });

    if (!res.ok) {
      throw new Error(`OpenRouter parser error: ${res.statusText}`);
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
    console.warn('AI Parsing failed, falling back to client-side heuristic parser:', e);
    return parseResumeTextClientSide(resumeText);
  }
};
