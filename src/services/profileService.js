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
SAM LUDWIG — Senior IT Infrastructure & M365 Systems Specialist
Location: Melbourne, VIC | Phone: 0405 993 245 | Email: sam.ludwig@gmail.com
Australian Citizen | Clearance: Baseline / NV1 Eligible | LinkedIn: linkedin.com/in/sam-ludwig

PROFESSIONAL EXPERIENCE:
1. Capgemini (Department of Education Victoria) — Senior Managed Services Engineer (Dec 2021 – Present)
- Managed the Southern Hemisphere's largest SharePoint farm (660,000+ active users, 1,000+ sites) with 99.9% uptime under stringent Victorian Government SLAs.
- Acted as Tier-3 escalation authority across Microsoft 365, SharePoint Online, Exchange Hybrid, and Google Workspace.
- Engineered automated PnP PowerShell compliance frameworks to audit and enforce MFA policies across 200+ enterprise workspaces.
- Achieved a 15% reduction in recurring incidents through systematic Root Cause Analysis (RCA) and preventive engineering.
- Enforced ACSC Essential 8 endpoint and cloud security controls across all regional education hubs.

2. Australia Post (via Capgemini) — L2/L3 Technical Support Specialist (2023 – 2024)
- Provided expert L1/L2/L3 support at MyITHub, overseeing hardware repair, OS reimaging, Autopilot provisioning, and loan device management.
- Engineered automated keystroke injection tools in ServiceNow, eliminating manual ticket handling overhead.
- Managed endpoint lifecycle operations including Windows Autopilot enrolments, Intune policy compliance, and secure asset disposal.

3. St John of God Health Care — Endpoint Migration Engineer (2023)
- Led Windows 11 enterprise migration across 100+ clinical endpoints with 100% Autopilot adherence in live hospital environments with zero patient care disruption.
- Served as primary technical liaison between clinical healthcare staff and engineering teams, resolving EMR and diagnostic software compatibility issues.

4. Knosys — Application Support Engineer / Systems Automation (Dec 2020 – Dec 2021)
- Delivered tier-3 application support and systems engineering for GreenOrbit intranet SaaS platforms with 95% SLA first-contact resolution (Cotton On, Harvey Norman, Healthscope).
- Rebuilt manual batch processing operations with custom multi-threaded PowerShell 7 automation, reducing processing time by 87% (from 2 hours to 15 minutes).
- Authored comprehensive RCA runbooks resolving complex multi-tenant versioning and migration bottlenecks.

5. Engage Squared — SharePoint Developer & Cloud Deployment Consultant (Mar 2018 – Dec 2020)
- Architected and delivered 5+ enterprise SharePoint Online intranet platforms for Victoria Police, Transurban, and Cimic Group using SPFx, React, and TypeScript.
- Implemented Azure DevOps CI/CD pipelines, accelerating release cycles by 25% under ISO 27001 compliance standards.
- Led technical client discovery workshops driving a 20% increase in Microsoft 365 enterprise feature adoption.

6. NBN — Telecommunications Technician (Oct 2016 – Nov 2017)
- Delivered Layer 1 physical telecommunications infrastructure deployments, structured cabling, and network fault diagnosis across Melbourne.
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
    const profileMap = new Map();
    DEFAULT_PROFILES.forEach(p => profileMap.set(p.id, p));
    customProfiles.forEach(p => profileMap.set(p.id, p));
    return Array.from(profileMap.values());
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
