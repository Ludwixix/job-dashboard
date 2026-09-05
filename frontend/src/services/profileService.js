/**
 * profileService.js
 * Single-User Logged-In Persona & Resume Intelligence Architecture
 * Guarantees that only the authenticated user's profile is active,
 * persisting personalization across all dashboard facets and events.
 */

import { getBackendApiBase } from './apiConfig';

export const STORAGE_KEY_PROFILES = 'job_dashboard_profiles';
export const STORAGE_KEY_ACTIVE_PROFILE_ID = 'job_dashboard_active_profile_id';
export const STORAGE_KEY_CANDIDATE_PROFILE = 'candidate_profile';

// Canonical Default Profile for the Logged-In User
export const DEFAULT_USER_PROFILE = {
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
};

export const DEFAULT_PROFILES = [DEFAULT_USER_PROFILE];

/**
 * Returns the single active user profile.
 */
export const getActiveProfile = () => {
  try {
    let sessionUser = null;
    try {
      const rawSession = localStorage.getItem('job_dashboard_current_user_session') || localStorage.getItem('job_dashboard_google_auth_user');
      if (rawSession) sessionUser = JSON.parse(rawSession);
    } catch {}

    const rawCandidate = localStorage.getItem(STORAGE_KEY_CANDIDATE_PROFILE);
    if (rawCandidate) {
      const parsed = JSON.parse(rawCandidate);
      if (parsed && typeof parsed === 'object' && parsed.name) {
        // If an authenticated session user exists, verify cached candidate matches
        if (!sessionUser || parsed.id === sessionUser.id || parsed.id === sessionUser.profileId || (parsed.email && sessionUser.email && parsed.email.toLowerCase() === sessionUser.email.toLowerCase())) {
          return parsed;
        }
      }
    }

    const rawProfiles = localStorage.getItem(STORAGE_KEY_PROFILES);
    if (rawProfiles) {
      const parsedList = JSON.parse(rawProfiles);
      if (Array.isArray(parsedList) && parsedList.length > 0) {
        let matched = null;
        if (sessionUser) {
          matched = parsedList.find(p => p.id === sessionUser.id || p.id === sessionUser.profileId || (p.email && sessionUser.email && p.email.toLowerCase() === sessionUser.email.toLowerCase()));
        }
        if (!matched) {
          matched = parsedList.find(p => p.name?.toLowerCase().includes('sam') || p.id === 'sam_ludwig') || parsedList[0];
        }
        if (matched) {
          localStorage.setItem(STORAGE_KEY_CANDIDATE_PROFILE, JSON.stringify(matched));
          return matched;
        }
      }
    }
  } catch (e) {
    console.warn('Error reading active profile:', e);
  }

  // Default fallback
  localStorage.setItem(STORAGE_KEY_CANDIDATE_PROFILE, JSON.stringify(DEFAULT_USER_PROFILE));
  localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify([DEFAULT_USER_PROFILE]));
  localStorage.setItem(STORAGE_KEY_ACTIVE_PROFILE_ID, DEFAULT_USER_PROFILE.id);
  return DEFAULT_USER_PROFILE;
};

/**
 * Returns an array containing solely the single logged-in user profile.
 */
export const getProfiles = () => {
  const active = getActiveProfile();
  return [active];
};

export const getAllProfiles = getProfiles;

/**
 * Saves and updates the single logged-in user profile, synchronizing all storage keys.
 */
export const saveProfile = (updatedProfile) => {
  if (!updatedProfile || typeof updatedProfile !== 'object') return DEFAULT_USER_PROFILE;

  let sessionUserId = null;
  try {
    const rawSession = localStorage.getItem('job_dashboard_current_user_session') || localStorage.getItem('job_dashboard_google_auth_user');
    if (rawSession) sessionUserId = JSON.parse(rawSession)?.id;
  } catch {}

  const profile = {
    ...DEFAULT_USER_PROFILE,
    ...updatedProfile,
    id: updatedProfile.id || sessionUserId || DEFAULT_USER_PROFILE.id
  };

  try {
    // Single profile persistence
    localStorage.setItem(STORAGE_KEY_CANDIDATE_PROFILE, JSON.stringify(profile));
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify([profile]));
    localStorage.setItem(STORAGE_KEY_ACTIVE_PROFILE_ID, profile.id);

    // Sync individual profile metadata for fast indexing
    if (profile.location) localStorage.setItem('userBaseLocation', profile.location);
    if (profile.name) localStorage.setItem('userName', profile.name);
    if (profile.email) localStorage.setItem('userEmail', profile.email);
    if (profile.phone) localStorage.setItem('userPhone', profile.phone);
    if (profile.targetSalary) localStorage.setItem('userTargetSalary', profile.targetSalary);
    if (Array.isArray(profile.targetTitles)) localStorage.setItem('userTargetTitles', JSON.stringify(profile.targetTitles));

    // Dispatch global event for instant re-scoring and UI synchronization
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: profile }));
    }

    // Persist to backend database asynchronously
    saveProfileToBackend(profile).catch(() => {});
  } catch (e) {
    console.error('Error saving profile:', e);
  }

  return profile;
};

/**
 * Persists user profile to backend SQLite database.
 */
export const saveProfileToBackend = async (profile) => {
  if (!profile || typeof profile !== 'object') return null;
  const userId = profile.id;
  if (!userId) {
    console.warn('saveProfileToBackend called without valid profile.id; aborting backend sync');
    return null;
  }
  const apiBase = getBackendApiBase();
  const token = typeof localStorage !== 'undefined'
    ? (localStorage.getItem('job_dashboard_auth_token') || localStorage.getItem('job_dashboard_token'))
    : null;

  const headers = {
    'Content-Type': 'application/json',
    'X-User-Id': userId
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${apiBase}/api/profile`, {
      method: 'POST',
      headers,
      body: JSON.stringify(profile)
    });
    if (res.ok) {
      const data = await res.json();
      return data.profile;
    }
  } catch (e) {
    console.warn('Backend profile sync non-blocking error:', e);
  }
  return null;
};

/**
 * Fetches user profile from backend SQLite database with local storage fallback.
 */
export const fetchProfileFromBackend = async (userId) => {
  const resolvedUserId = userId || getActiveProfile()?.id;
  if (!resolvedUserId) {
    console.warn('fetchProfileFromBackend called without userId; using local profile');
    return getActiveProfile();
  }
  const apiBase = getBackendApiBase();
  const token = typeof localStorage !== 'undefined'
    ? (localStorage.getItem('job_dashboard_auth_token') || localStorage.getItem('job_dashboard_token'))
    : null;

  const headers = {
    'X-User-Id': resolvedUserId
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${apiBase}/api/profile?user_id=${encodeURIComponent(resolvedUserId)}`, {
      headers
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.profile && Object.keys(data.profile).length > 0) {
        saveProfile(data.profile);
        return data.profile;
      }
    }
  } catch (e) {
    console.warn('Backend profile fetch error, using local cached profile:', e);
  }
  return getActiveProfile();
};

export const setActiveProfile = (profileId) => {
  const active = getActiveProfile();
  return active;
};

export const setActiveProfileId = setActiveProfile;

export const getActiveProfileId = () => {
  return getActiveProfile()?.id || null;
};

export const deleteProfile = () => {
  // Reset to clean default user profile
  saveProfile(DEFAULT_USER_PROFILE);
  return [DEFAULT_USER_PROFILE];
};

/**
 * Heuristic client-side resume parser
 */
export const parseResumeTextClientSide = (text = '') => {
  const lower = text.toLowerCase();

  // Name extraction
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let name = lines[0] || 'Sam Ludwig';
  if (name.length > 35 || /resume|curriculum|cv|summary|experience/i.test(name)) {
    name = lines[1] && lines[1].length <= 35 ? lines[1] : 'Sam Ludwig';
  }

  // Email & Phone
  const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
  const email = emailMatch ? emailMatch[1] : 'sam.ludwig@gmail.com';

  const phoneMatch = text.match(/(?:\+?61|0)[2-478](?:[ -]?[0-9]){8}/);
  const phone = phoneMatch ? phoneMatch[0] : '0405 993 245';

  // Suburb & Location
  let suburb = 'Balaclava';
  let location = 'Balaclava VIC 3183';
  if (lower.includes('richmond')) { suburb = 'Richmond'; location = 'Richmond VIC 3121'; }
  else if (lower.includes('south yarra')) { suburb = 'South Yarra'; location = 'South Yarra VIC 3141'; }
  else if (lower.includes('st kilda')) { suburb = 'St Kilda'; location = 'St Kilda VIC 3182'; }
  else if (lower.includes('docklands')) { suburb = 'Docklands'; location = 'Docklands VIC 3008'; }
  else if (lower.includes('melbourne')) { suburb = 'Melbourne'; location = 'Melbourne VIC 3000'; }

  // Industry & Seniority
  let industry = 'Technology & IT';
  let seniorityLevel = 'Senior';
  let yearsOfExperience = 8;

  const yearMatches = text.match(/20\d\d|19\d\d/g);
  if (yearMatches && yearMatches.length >= 2) {
    const years = yearMatches.map(Number).sort();
    const span = years[years.length - 1] - years[0];
    if (span >= 1 && span <= 30) yearsOfExperience = span;
  }

  if (lower.includes('principal') || lower.includes('architect') || lower.includes('director') || lower.includes('head of')) {
    seniorityLevel = 'Principal / Architect';
  } else if (yearsOfExperience >= 10 || lower.includes('lead') || lower.includes('manager')) {
    seniorityLevel = 'Senior / Lead';
  }

  const technicalKeywords = [
    'Microsoft 365', 'Azure', 'AWS', 'Kubernetes', 'Docker', 'Terraform', 'PowerShell',
    'Active Directory', 'Entra ID', 'VMware', 'Intune', 'Windows Server', 'Linux',
    'Python', 'CI/CD', 'PostgreSQL', 'Exchange Online', 'SharePoint', 'Networking',
    'Firewalls', 'Security', 'ITIL'
  ];

  const extractedSkills = technicalKeywords.filter(k => new RegExp(`\\b${k}\\b`, 'i').test(text));

  let title = 'Senior Systems & Infrastructure Engineer';
  for (const tk of ['Systems Engineer', 'Cloud Engineer', 'DevOps Engineer', 'Infrastructure Engineer', 'IT Administrator', 'Solutions Architect']) {
    if (new RegExp(`\\b${tk}\\b`, 'i').test(text)) {
      title = `${seniorityLevel === 'Senior / Lead' ? 'Senior ' : ''}${tk}`;
      break;
    }
  }

  const targetTitles = [
    title,
    `Lead ${title.replace(/Senior |Lead |Principal /gi, '')}`,
    `Senior ${title.replace(/Senior |Lead |Principal /gi, '')}`,
    'Cloud & Infrastructure Specialist',
    'Systems Administrator'
  ].filter((v, i, a) => a.indexOf(v) === i);

  return {
    id: 'sam_ludwig',
    name: name,
    title: title,
    industry: industry,
    seniorityLevel: seniorityLevel,
    yearsOfExperience: yearsOfExperience,
    marketArchetype: `${seniorityLevel} ${industry} Specialist`,
    email: email,
    phone: phone,
    location: location,
    suburb: suburb,
    workRights: 'Australian Citizen (Unrestricted)',
    clearance: 'Australian Citizen (Baseline / NV1 Eligible)',
    targetSalary: '$135,000 - $160,000 + Super',
    targetTitles: targetTitles,
    coreSkills: extractedSkills.length > 0 ? extractedSkills : ['Microsoft 365', 'Azure', 'PowerShell', 'Active Directory'],
    certifications: ['Microsoft Certified Associate', 'ITIL Foundation'],
    keyStrengths: [
      'Zero-downtime cloud and endpoint migrations',
      'PowerShell scripting and workflow automation',
      'Reliable systems engineering and incident resolution'
    ],
    managementStyle: 'Collaborative / Hands-On Technical Mentor',
    interviewTalkingPoints: [
      'Executed large-scale tenant migrations with zero disruption to core operations.',
      'Streamlined endpoint provisioning via Intune Autopilot, cutting setup times by 80%.',
      'Authored automated PowerShell health-check scripts to proactively monitor enterprise servers.'
    ],
    workHistorySummary: text.slice(0, 500) || 'Experienced Infrastructure & Systems Engineer with strong background across enterprise hybrid environments.',
    fullWorkExperienceText: text
  };
};

/**
 * AI-powered resume parser via OpenRouter
 */
export const parseResumeWithAI = async (resumeText, apiKey, model = 'z-ai/glm-5.3-flash') => {
  if (!apiKey) {
    return parseResumeTextClientSide(resumeText);
  }

  const prompt = `You are a Principal Executive Recruiter and Behavioral Talent Architect.
Analyze the following resume text and synthesize an exhaustive, highly structured single user profile JSON.

Schema:
{
  "name": "Full Name",
  "title": "Most marketable current professional title",
  "industry": "Industry Category (e.g. Technology & IT)",
  "seniorityLevel": "Junior / Graduate | Mid-Level | Senior | Lead / Principal | Executive / Director",
  "yearsOfExperience": 10,
  "marketArchetype": "5-8 word executive positioning statement",
  "email": "Email Address",
  "phone": "Phone Number",
  "location": "City, State Postcode",
  "suburb": "Suburb Name",
  "workRights": "Australian Citizen (Unrestricted)",
  "clearance": "Security Clearance Eligibility",
  "targetSalary": "$140,000 - $165,000 + Super",
  "targetTitles": ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5", "Title 6"],
  "coreSkills": ["Skill 1", "Skill 2", "Skill 3"],
  "certifications": ["Cert 1", "Cert 2"],
  "keyStrengths": ["Strength 1", "Strength 2", "Strength 3"],
  "managementStyle": "Leadership & Working Style",
  "interviewTalkingPoints": ["STAR Story 1", "STAR Story 2", "STAR Story 3"],
  "workHistorySummary": "Executive career summary narrative",
  "fullWorkExperienceText": "Clean structured chronological resume text"
}

Return ONLY valid JSON matching this schema with NO markdown and NO conversational text.

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
      throw new Error(`OpenRouter parser API error: ${res.status}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      id: parsed.id || `profile_${Date.now()}`,
      ...parsed,
      fullWorkExperienceText: parsed.fullWorkExperienceText || resumeText
    };
  } catch (e) {
    console.warn('AI Parsing failed, falling back to heuristic parser:', e);
    return parseResumeTextClientSide(resumeText);
  }
};
