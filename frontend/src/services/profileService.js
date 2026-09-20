/**
 * profileService.js
 * Single-User Logged-In Persona & Resume Intelligence Architecture
 * Guarantees that only the authenticated user's profile is active,
 * persisting personalization across all dashboard facets and events.
 */

import { getBackendApiBase } from './apiConfig';
import { getLlmConfig } from './llmConfig';

export const STORAGE_KEY_PROFILES = 'job_dashboard_profiles';
export const STORAGE_KEY_ACTIVE_PROFILE_ID = 'job_dashboard_active_profile_id';
export const STORAGE_KEY_CANDIDATE_PROFILE = 'candidate_profile';

// Canonical Default Profile for the Logged-In User (Sam Ludwig)
export const DEFAULT_USER_PROFILE = {
  id: 'sam_ludwig',
  name: 'Sam Ludwig',
  title: 'Senior Infrastructure & M365 Engineer',
  industry: 'Technology & IT',
  seniorityLevel: 'Senior / Lead',
  yearsOfExperience: 10,
  marketArchetype: 'Hybrid Cloud, M365 Architecture & Enterprise Automation Specialist',
  email: 'sam.ludwig@gmail.com',
  phone: '0405 993 245',
  location: 'Melbourne, VIC (Balaclava 3183)',
  suburb: 'Balaclava',
  state: 'VIC',
  country: 'Australia',
  workRights: 'Australian Citizen (Unrestricted)',
  clearance: 'Australian Citizen (Baseline / NV1 Eligible)',
  targetSalary: '$140,000 - $165,000 + Super',
  salaryExpectations: {
    min: 140000,
    max: 165000,
    preferred: 150000,
    currency: 'AUD',
    period: 'annual'
  },
  linkedin: 'https://linkedin.com/in/sam-ludwig',
  portfolio: 'https://samludwig.au',
  github: 'https://github.com/Ludwixix',
  keyStrengths: [
    'Southern Hemisphere scale: Managed 660,000+ users & 1,000+ sites across SharePoint farm with 99.9% uptime at Dept. of Education VIC',
    'Enterprise automation: Engineered custom PowerShell runbooks, ServiceNow keystroke injection, and Python diagnostic GUIs reducing processing time by 87%',
    'Healthcare & clinical endpoint migrations: Directed 100+ clinical endpoint Windows 11 Autopilot migrations at St John of God Health Care with zero patient care disruption',
    'Hybrid cloud identity & compliance: Tri-platform synchronization (AD, Entra ID, Google Workspace) aligned with ACSC Essential 8 and ISO 27001'
  ],
  managementStyle: 'Player-Coach / Hands-On Technical Mentor',
  targetTitles: [
    'Senior Systems Engineer',
    'Senior Infrastructure Engineer',
    'Senior M365 Engineer',
    'Cloud Infrastructure Specialist',
    'Endpoint / EUC Engineer',
    'L3 Systems / Operations Lead',
    'SharePoint & Modern Workplace Architect',
    'Automation & DevOps Engineer'
  ],
  coreSkills: [
    'Microsoft 365', 'SharePoint Online / Server', 'Exchange Hybrid / Online', 'Microsoft Teams',
    'Entra ID (Azure AD)', 'Azure Cloud (VMs, Functions, Automation)', 'PowerShell 5.1/7 & PnP',
    'Microsoft Intune (MDM/MAM)', 'Windows Autopilot', 'Active Directory Domain Services',
    'ACSC Essential 8 & ISO 27001', 'ServiceNow (Advanced)', 'Windows Server (2012R2–2022)',
    'VMware vSphere (ESXi)', 'Python Automation', 'Azure DevOps CI/CD', 'ITIL 4 Service Management',
    'Microsoft Graph API', 'Layer 1 Infrastructure (Fibre / Copper)'
  ],
  certifications: [
    'Microsoft Certified: Azure Administrator Associate (AZ-104, 2025)',
    'ITIL 4 Foundation (AXELOS, 2025)',
    'Microsoft Certified: Azure Fundamentals (AZ-900, 2022)',
    'Certified Scrum Master (CSM)',
    'Diploma of Information Technology (Coder Academy, 2019)',
    'Web Development Fast Track Bootcamp (Coder Academy, 2018)'
  ],
  projects: [
    {
      name: 'YellowSnow (ServiceNow UI & Workload Distribution Engine)',
      description: 'Client-side browser extension suite integrating live SharePoint Online presence data with ServiceNow ticket queues to eliminate manual triage and prevent SLA breaches.',
      url: 'https://github.com/Ludwixix/YellowSnow'
    },
    {
      name: 'PySPO Tool (M365 Diagnostic GUI)',
      description: 'Python GUI application (Tkinter) empowering Tier-1 support staff to safely execute advanced PowerShell diagnostics against M365 without CLI access.',
      url: 'https://github.com/Ludwixix/pyspo-tool'
    },
    {
      name: 'JobGobblin Browser Automation',
      description: 'Python and Selenium WebDriver web scraping engine extracting requisition data with custom Boolean search parameters.',
      url: 'https://github.com/Ludwixix/JobGobblin'
    },
    {
      name: 'MFA Compliance Automation',
      description: 'Automated PnP PowerShell discovery and audit across 200+ sensitive SharePoint sites at Department of Education VIC, eliminating month-long manual audit cycles.'
    }
  ],
  interviewTalkingPoints: [
    'Maintained 99.9% uptime across the Southern Hemisphere\'s largest SharePoint farm (660,000+ users, 1,000+ sites) at Dept. of Education Victoria.',
    'Engineered dynamic PnP PowerShell MFA compliance audit across 200+ sensitive SharePoint sites, replacing a month-long manual review with automated reporting.',
    'Reduced cloud migration processing time by 87% (2 hours to 15 minutes per batch) using custom PowerShell automation at Knosys.',
    'Led Windows 11 enterprise migration across 100+ clinical endpoints at St John of God Health Care with 100% Autopilot adherence and zero patient care disruption.',
    'Developed custom keystroke injection automation within ServiceNow at Australia Post, eliminating hundreds of hours of manual ticket entry under tight system controls.',
    'Built Azure DevOps CI/CD pipelines at Engage Squared, reducing solution deployment cycles by 25% for Victoria Police and Transurban.'
  ],
  workHistorySummary: 'Senior Infrastructure & M365 Consultant with 10+ years bridging physical infrastructure, enterprise hybrid cloud, and automation. Proven authority managing 660,000+ user environments (Southern Hemisphere\'s largest SharePoint farm), leading Tier-3 M365/Entra ID escalations, orchestrating zero-downtime clinical hospital migrations (St John of God), and engineering custom PowerShell/Python automation that eliminates manual toil.',
  fullWorkExperienceText: `SENIOR MANAGED SERVICES ENGINEER — Capgemini / Dept. of Education Victoria (Dec 2021 – Present)
- Managed the largest SharePoint farm in the Southern Hemisphere (660,000+ active users, 1,000+ sites), consistently achieving 99.9% uptime under state government SLA requirements.
- Served near the top of Tier-3 escalation for M365 (SharePoint Online, Exchange Online, Teams, Google Workspace), achieving a documented 15% reduction in repeat incidents through systematic Root Cause Analysis (RCA).
- Engineered PnP PowerShell automation auditing and enforcing MFA compliance dynamically across 200+ sensitive SharePoint sites, eliminating month-long manual audits.
- Managed tri-platform identity synchronisation (On-Premises AD, Entra ID, Google Workspace) and resolved complex mail-flow and federation issues.
- Spearheaded Azure cloud adoption, migrating legacy on-premise workloads to Azure IaaS/PaaS aligned with ACSC Essential 8 maturity model.
- Built client-side workload distribution engine (YellowSnow) integrating M365 presence data into ServiceNow, eliminating manual ticket triage.
- Managed 40+ concurrent tickets in high-volume government queue, consistently maintaining >90% resolution within contractual SLA targets.

L2/L3 TECHNICAL SUPPORT ENGINEER & AUTOMATION — Australia Post via Capgemini (2023 – 2024 / Feb 2026 – Jun 2026)
- Delivered face-to-endpoint and remote support within the MyITHub service centre, managing hardware diagnostics, OS reimaging, and endpoint provisioning.
- Engineered novel keystroke injection automation in ServiceNow, programmatically managing ITSM tickets and saving hundreds of hours of manual entry per month under restrictive security controls.
- Managed full endpoint lifecycle for enterprise fleet: Windows 10/11 SOE builds, Autopilot/UEM enrolment, and NIST-compliant sanitisation.
- Supported rollout of staff self-help kiosk programme for knowledge base access, password resets, and ticket logging.

ENDPOINT MIGRATION ENGINEER — St John of God Health Care (2023 / Oct 2025 – Jan 2026)
- Led Windows 11 enterprise migration across 100+ clinical endpoints in live hospital environments with 100% Autopilot and SOE compliance.
- Delivered intensive hypercare support resolving compatibility issues with EMR systems, PACS diagnostic imaging, and patient monitoring tools with zero patient care disruption.
- Served as primary technical liaison between clinical healthcare staff and engineering teams.

APPLICATION SUPPORT ENGINEER — Knosys (Dec 2020 – Dec 2021)
- Delivered expert L3 support for GreenOrbit enterprise intranet platform, achieving a 95% SLA resolution rate for Cotton On, Harvey Norman, and Healthscope.
- Engineered PowerShell automation cutting cloud migration batch processing by 87% (2 hours to 15 minutes per batch), saving 10+ hours per month.
- Developed Python and PowerShell scripts to automate system patching procedures, reducing manual effort by 20%.

SHAREPOINT DEVELOPER & MODERN WORKPLACE CONSULTANT — Engage Squared (Mar 2018 – Dec 2020)
- Architected and delivered 5+ bespoke SharePoint Online intranet solutions for Victoria Police, Transurban, and Cimic Group using SPFx, React, and TypeScript.
- Implemented Azure DevOps CI/CD pipelines, automating build and release cycles to achieve a 25% reduction in deployment time.
- Led legacy-to-M365 migrations using Sharegate and SPMT under ISO 27001 compliance and governance frameworks.
- Facilitated client technical workshops driving a 20% increase in M365 feature adoption.

TELECOMMUNICATIONS TECHNICIAN — National Broadband Network (NBN) (Oct 2016 – Nov 2017)
- Deployed Layer 1 telecommunications infrastructure, running structured fibre optic and copper cabling across residential and commercial environments.
- Conducted physical and data-link fault-finding, installing and diagnosing NTDs and network routing equipment.

HVAC & MECHANICAL SERVICE TECHNICIAN — PolaAir (Jan 2017 – Oct 2017)
- Installed and serviced commercial HVAC systems; developed diagnostic troubleshooting methodologies and root-cause analysis in time-critical environments.`
};

export const SAM_LUDWIG_PROFILE = DEFAULT_USER_PROFILE;
export const CANDIDATE_PROFILE = DEFAULT_USER_PROFILE;

export const HEALTHCARE_PROFILE = {
  id: 'sarah_jenkins_rn',
  name: 'Sarah Jenkins',
  title: 'Registered Nurse / Clinical Care Coordinator',
  industry: 'Healthcare & Medical',
  seniorityLevel: 'Senior / Specialist',
  yearsOfExperience: 8,
  marketArchetype: 'Acute Clinical Care & Healthcare Operational Quality Specialist',
  email: 'sarah.jenkins.rn@gmail.com',
  phone: '0412 884 921',
  location: 'Melbourne VIC 3000',
  suburb: 'Parkville',
  workRights: 'Australian Citizen (Unrestricted)',
  clearance: 'AHPRA Registered (Division 1) · WWCC · National Police Check',
  targetSalary: '$95,000 - $118,000 + Super + Salary Packaging',
  keyStrengths: [
    'Comprehensive acute patient triage, clinical documentation, and emergency response',
    'AHPRA Division 1 compliance, medication administration, and infection control',
    'Cross-functional clinical leadership and multidisciplinary team collaboration'
  ],
  managementStyle: 'Compassionate, Patient-Centered Clinical Leader',
  targetTitles: [
    'Registered Nurse',
    'Clinical Nurse Specialist',
    'Nurse Unit Manager',
    'Clinical Care Coordinator',
    'Triage Nurse',
    'Healthcare Project Officer'
  ],
  coreSkills: [
    'Patient Care', 'Clinical Documentation', 'AHPRA', 'Triage Assessment',
    'Medication Administration', 'Infection Control', 'BLS / ALS Certification',
    'Wound Management', 'Electronic Medical Records (EMR)', 'Discharge Planning',
    'Palliative Care', 'Quality & Clinical Governance', 'Emergency Nursing'
  ],
  certifications: [
    'AHPRA Registered Nurse (Division 1) — Registration #NMW0001234567',
    'Working with Children Check (Victoria — Employee #1234567A)',
    'Advanced Life Support (ALS Level 2) Certification'
  ],
  interviewTalkingPoints: [
    'Coordinated clinical care for 32-bed acute medical ward maintaining 100% compliance with Australian National Safety and Quality Health Service (NSQHS) standards.',
    'Led transition to electronic medication management system across emergency ward, reducing administration discrepancies by 42%.',
    'Trained and mentored 18 graduate nurses and nursing students across complex clinical pathways.'
  ],
  workHistorySummary: 'Dedicated Registered Nurse with 8+ years of acute hospital and clinical care coordination experience across Victoria, committed to patient advocacy, NSQHS excellence, and compassionate clinical leadership.',
  fullWorkExperienceText: `CLINICAL NURSE SPECIALIST / CARE COORDINATOR — Royal Melbourne Hospital (2021 – Present)
- Supervised daily patient allocations, emergency admissions, and care plans for 32-bed acute medical unit.
- Maintained strict AHPRA, NSQHS, and infection control compliance with zero sentinel events.

REGISTERED NURSE (ACUTE CARE) — St Vincent’s Hospital Melbourne (2018 – 2021)
- Delivered high-acuity nursing care, IV medication administration, and patient advocacy in fast-paced clinical environments.
- Implemented electronic nursing triage workflows cutting patient handoff times by 35%.`
};

export const FINANCE_PROFILE = {
  id: 'marcus_wong_cpa',
  name: 'Marcus Wong',
  title: 'Senior Financial Accountant / Commercial Finance Lead',
  industry: 'Finance & Accounting',
  seniorityLevel: 'Senior / Lead',
  yearsOfExperience: 10,
  marketArchetype: 'Statutory Reporting, Financial Modelling & Commercial Governance Specialist',
  email: 'marcus.wong.cpa@gmail.com',
  phone: '0423 771 904',
  location: 'Melbourne VIC 3000',
  suburb: 'Southbank',
  workRights: 'Australian Citizen (Unrestricted)',
  clearance: 'CPA Australia Member · ASIC Approved · National Police Check',
  targetSalary: '$130,000 - $155,000 + Super',
  keyStrengths: [
    'Comprehensive statutory financial reporting under AASB and IFRS accounting standards',
    'End-to-end month-end closure, balance sheet reconciliations, and tax compliance (BAS/GST/FBT)',
    'Advanced financial modeling, budgeting, and ERP systems leadership (SAP, Xero, NetSuite)'
  ],
  managementStyle: 'Analytical, High-Integrity Financial Partner',
  targetTitles: [
    'Senior Financial Accountant',
    'Finance Manager',
    'Commercial Finance Analyst',
    'Management Accountant',
    'Financial Controller',
    'Corporate Tax Accountant'
  ],
  coreSkills: [
    'Financial Reporting', 'AASB / IFRS Standards', 'CPA Qualification',
    'General Ledger Reconciliations', 'Month-End Close', 'Tax Compliance (BAS/GST)',
    'Budgeting & Forecasting', 'Financial Modeling', 'SAP ERP', 'Xero',
    'Internal Audit & Controls', 'Variance Analysis', 'Cash Flow Management'
  ],
  certifications: [
    'CPA Australia — Certified Practising Accountant (Member #9876543)',
    'Bachelor of Commerce (Accounting & Finance) — University of Melbourne'
  ],
  interviewTalkingPoints: [
    'Streamlined statutory month-end close cycle from 9 business days to 4 business days through automated SAP reconciliation workflows.',
    'Managed audit engagements with Big 4 external auditors with zero material audit adjustments for 4 consecutive financial years.',
    'Constructed predictive multi-year cash flow model accurately forecasting $85M operating expenditure within 2.3% variance.'
  ],
  workHistorySummary: 'Accomplished Senior Financial Accountant and CPA with 10+ years driving statutory reporting integrity, corporate tax compliance, and automated financial governance across ASX-listed and commercial organizations.',
  fullWorkExperienceText: `SENIOR FINANCIAL ACCOUNTANT — Treasury Wine Estates / Commercial Group (2021 – Present)
- Led end-to-end financial reporting, monthly management accounts, and AASB/IFRS statutory compliance.
- Partnered with executive leadership on annual budget allocation ($120M+) and variance mitigation.

MANAGEMENT ACCOUNTANT — BDO Australia (2017 – 2021)
- Managed complex general ledger reconciliations, quarterly BAS filings, and external audit preparations.
- Automated client reporting dashboards in Power BI cutting manual reporting hours by 60%.`
};

export const TRADES_CONSTRUCTION_PROFILE = {
  id: 'david_miller_builder',
  name: 'David Miller',
  title: 'Site Supervisor / Construction Project Coordinator',
  industry: 'Construction & Trades',
  seniorityLevel: 'Senior / Supervisor',
  yearsOfExperience: 14,
  marketArchetype: 'Commercial Construction Delivery & SafeWork OHS Compliance Specialist',
  email: 'david.miller.build@gmail.com',
  phone: '0434 662 119',
  location: 'Melbourne VIC 3000',
  suburb: 'Richmond',
  workRights: 'Australian Citizen (Unrestricted)',
  clearance: 'CPCCWHS1001 White Card · First Aid Level 2 · Working at Heights',
  targetSalary: '$120,000 - $145,000 + Super + Vehicle',
  keyStrengths: [
    'On-site subcontractor management, trade coordination, and program scheduling',
    'SafeWork Victoria WHS compliance, SWMS verification, and zero-harm culture',
    'Quality assurance inspections, defect rectifications, and client handover'
  ],
  managementStyle: 'Direct, Safety-Obsessed Site Operations Leader',
  targetTitles: [
    'Site Supervisor',
    'Construction Site Manager',
    'Site Foreman',
    'Construction Project Coordinator',
    'Fitout Supervisor',
    'Building Inspector'
  ],
  coreSkills: [
    'Site Supervision', 'Subcontractor Management', 'SafeWork WHS / OHS',
    'White Card (CPCCWHS1001)', 'SWMS Documentation', 'Construction Scheduling',
    'Trade Coordination', 'Quality Assurance (QA/QC)', 'Defect Management',
    'Procore / Aconex', 'Cost Control', 'Building Code of Australia (BCA)'
  ],
  certifications: [
    'General Construction Induction Training (White Card — CPCCWHS1001)',
    'Certificate IV in Building and Construction (Building)',
    'Provide First Aid & CPR (HLTAID011)'
  ],
  interviewTalkingPoints: [
    'Delivered $34M commercial multi-storey building project 3 weeks ahead of schedule with zero lost-time injuries (LTI).',
    'Coordinated daily operations of 65+ multi-trade subcontractors across structural steel, concrete, and service rough-in stages.',
    'Maintained rigorous SWMS inspections resulting in 100% compliance audit score from WorkSafe Victoria.'
  ],
  workHistorySummary: 'Experienced Construction Site Supervisor with 14+ years managing high-value commercial and residential builds across Melbourne, committed to on-time handover, trade precision, and zero-compromise site safety.',
  fullWorkExperienceText: `SITE SUPERVISOR — Multiplex / Commercial Builders (2020 – Present)
- Directed day-to-day site operations, subbie sequencing, and crane logistics for $45M commercial tower.
- Enforced strict WHS site protocols, toolboxes, and weekly quality signoffs.

SITE FOREMAN — Probuild (2016 – 2020)
- Supervised structural carpentry, framing, and interior fitout teams across tier-1 developments.
- Managed Procore RFI tracking, inspection test plans (ITPs), and defect list sign-offs.`
};

export const LEGAL_PROFILE = {
  id: 'jessica_chen_counsel',
  name: 'Jessica Chen',
  title: 'Corporate Legal Counsel / Commercial Solicitor',
  industry: 'Legal',
  seniorityLevel: 'Senior / Counsel',
  yearsOfExperience: 9,
  marketArchetype: 'Corporate Governance, Commercial Contracts & Regulatory Risk Specialist',
  email: 'jessica.chen.legal@gmail.com',
  phone: '0445 339 802',
  location: 'Melbourne VIC 3000',
  suburb: 'CBD',
  workRights: 'Australian Citizen (Unrestricted)',
  clearance: 'Australian Practising Certificate · Supreme Court of Victoria Admitted',
  targetSalary: '$145,000 - $175,000 + Super',
  keyStrengths: [
    'Complex commercial contract drafting, negotiation, and risk mitigation',
    'Australian Consumer Law (ACL), Privacy Act (APPs), and regulatory compliance advisory',
    'Executive stakeholder management, IP protection, and dispute resolution'
  ],
  managementStyle: 'Pragmatic, Commercially-Minded Legal Advisor',
  targetTitles: [
    'Corporate Legal Counsel',
    'Senior Legal Counsel',
    'Commercial Solicitor',
    'In-House Legal Counsel',
    'Regulatory Compliance Manager',
    'Contracts Manager'
  ],
  coreSkills: [
    'Commercial Contracts', 'Contract Drafting & Negotiation', 'Corporate Governance',
    'Australian Practising Certificate', 'Regulatory Compliance', 'Privacy Law (APPs)',
    'Risk Management', 'IP Protection', 'Dispute Resolution', 'M&A Due Diligence',
    'Employment Law Advisory', 'Australian Consumer Law (ACL)'
  ],
  certifications: [
    'Current Australian Practising Certificate (Victorian Legal Services Board)',
    'Admitted to the Supreme Court of Victoria and High Court of Australia',
    'Bachelor of Laws (LLB Hons) / Bachelor of Arts — Monash University'
  ],
  interviewTalkingPoints: [
    'Negotiated and closed $65M multi-party enterprise vendor agreement, cutting business liability caps by 40%.',
    'Architected comprehensive corporate compliance framework ensuring 100% adherence to updated Privacy Act requirements.',
    'Advised C-suite on high-stakes commercial disputes, resolving 95% of claims pre-litigation with favorable settlements.'
  ],
  workHistorySummary: 'Strategic Corporate Legal Counsel with 9+ years providing high-impact commercial legal advice, drafting enterprise agreements, and safeguarding corporate risk across leading Australian organizations.',
  fullWorkExperienceText: `SENIOR LEGAL COUNSEL — ASX-Listed Enterprise Group (2021 – Present)
- Advised senior executive leadership on complex commercial transactions, procurement contracts, and IP licensing.
- Formulated corporate privacy, data protection, and governance policies across national operations.

COMMERCIAL SOLICITOR — Herbert Smith Freehills / Tier-1 Firm (2017 – 2021)
- Drafted, negotiated, and settled major commercial agreements, joint ventures, and tender responses.
- Conducted M&A due diligence and represented corporate clients in mediation and commercial dispute negotiations.`
};

export const SECTOR_TEMPLATES = {
  technology: DEFAULT_USER_PROFILE,
  healthcare: HEALTHCARE_PROFILE,
  finance: FINANCE_PROFILE,
  trades: TRADES_CONSTRUCTION_PROFILE,
  legal: LEGAL_PROFILE,
};

export const DEFAULT_PROFILES = [
  DEFAULT_USER_PROFILE,
  HEALTHCARE_PROFILE,
  FINANCE_PROFILE,
  TRADES_CONSTRUCTION_PROFILE,
  LEGAL_PROFILE,
];

/**
 * Applies an industry sector template and updates active profile persistence.
 */
export const loadSectorTemplate = (sectorKey = 'technology') => {
  const template = SECTOR_TEMPLATES[sectorKey] || DEFAULT_USER_PROFILE;
  saveProfile(template);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('candidate-profile-updated', { detail: template }));
  }
  return template;
};

export const CLEAN_CANDIDATE_PROFILE = {
  id: '',
  name: '',
  title: '',
  industry: '',
  seniorityLevel: '',
  yearsOfExperience: 0,
  marketArchetype: '',
  email: '',
  phone: '',
  location: '',
  suburb: '',
  state: '',
  country: 'Australia',
  workRights: '',
  clearance: '',
  targetSalary: '',
  salaryExpectations: {
    min: 0,
    max: 0,
    preferred: 0,
    currency: 'AUD',
    period: 'annual'
  },
  linkedin: '',
  portfolio: '',
  github: '',
  keyStrengths: [],
  managementStyle: '',
  targetTitles: [],
  coreSkills: [],
  certifications: [],
  projects: [],
  interviewTalkingPoints: [],
  workHistorySummary: '',
  fullWorkExperienceText: ''
};

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
        if (!matched && sessionUser && (sessionUser.name || sessionUser.email)) {
          const userProfile = {
            ...CLEAN_CANDIDATE_PROFILE,
            id: sessionUser.id || sessionUser.profileId || 'user_' + Date.now(),
            name: sessionUser.name || '',
            email: sessionUser.email || '',
            industry: sessionUser.industry || '',
            updatedAt: new Date().toISOString()
          };
          localStorage.setItem(STORAGE_KEY_CANDIDATE_PROFILE, JSON.stringify(userProfile));
          return userProfile;
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

    if (sessionUser && (sessionUser.name || sessionUser.email)) {
      const userProfile = {
        ...CLEAN_CANDIDATE_PROFILE,
        id: sessionUser.id || sessionUser.profileId || 'user_' + Date.now(),
        name: sessionUser.name || '',
        email: sessionUser.email || '',
        industry: sessionUser.industry || '',
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY_CANDIDATE_PROFILE, JSON.stringify(userProfile));
      return userProfile;
    }
  } catch (e) {
    console.warn('Error reading active profile:', e);
  }

  // Default fallback — blank candidate profile rather than personal developer profile
  const guestProfile = {
    ...CLEAN_CANDIDATE_PROFILE,
    id: 'guest',
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem(STORAGE_KEY_CANDIDATE_PROFILE, JSON.stringify(guestProfile));
  localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify([guestProfile]));
  localStorage.setItem(STORAGE_KEY_ACTIVE_PROFILE_ID, guestProfile.id);
  return guestProfile;
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
export const saveProfile = (updatedProfile, options = {}) => {
  if (!updatedProfile || typeof updatedProfile !== 'object') return DEFAULT_USER_PROFILE;

  let sessionUserId = null;
  let sessionUser = null;
  try {
    const rawSession = localStorage.getItem('job_dashboard_current_user_session') || localStorage.getItem('job_dashboard_google_auth_user');
    if (rawSession) {
      sessionUser = JSON.parse(rawSession);
      sessionUserId = sessionUser?.id;
    }
  } catch {}

  const email = (updatedProfile.email || sessionUser?.email || '').toLowerCase();
  const isSam = email.includes('sam.ludwig') || updatedProfile.id === 'sam_ludwig';
  const baseProfile = isSam ? DEFAULT_USER_PROFILE : CLEAN_CANDIDATE_PROFILE;

  const profile = {
    ...baseProfile,
    ...updatedProfile,
    id: updatedProfile.id || sessionUserId || baseProfile.id || `user_${Date.now()}`,
    updatedAt: updatedProfile.updatedAt || new Date().toISOString()
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

    // Persist to backend database asynchronously unless explicitly bypassed
    if (options.syncToBackend !== false) {
      saveProfileToBackend(profile).catch(() => {});
    }
  } catch (e) {
    console.error('Error saving profile:', e);
  }

  return profile;
};

let _saveSequence = 0;
let _latestCompletedSequence = 0;

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
  const currentSeq = ++_saveSequence;
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
      if (currentSeq < _latestCompletedSequence) {
        // A newer save request already completed; discard stale response
        return null;
      }
      _latestCompletedSequence = currentSeq;
      const data = await res.json();
      return data.profile;
    }
  } catch (e) {
    console.warn('Backend profile sync non-blocking error:', e);
  }
  return null;
};

/**
 * Fetches user profile from backend SQLite database with local storage fallback and LWW reconciliation.
 */
export const fetchProfileFromBackend = async (userId, userEmail) => {
  const resolvedUserId = userId || getActiveProfile()?.id;
  if (!resolvedUserId) {
    console.warn('fetchProfileFromBackend called without userId; using local profile');
    return getActiveProfile();
  }
  let emailParam = userEmail;
  if (!emailParam) {
    try {
      const rawSession = localStorage.getItem('job_dashboard_current_user_session') || localStorage.getItem('job_dashboard_google_auth_user');
      if (rawSession) emailParam = JSON.parse(rawSession)?.email;
    } catch {}
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

  const query = new URLSearchParams({ user_id: resolvedUserId });
  if (emailParam) query.append('email', emailParam);

  try {
    const res = await fetch(`${apiBase}/api/profile?${query.toString()}`, {
      headers
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.profile && Object.keys(data.profile).length > 0) {
        const localProfile = getActiveProfile();
        const remoteProfile = data.profile;

        // Parse timestamps for Last-Write-Wins (LWW) conflict resolution
        const remoteTimestamp = new Date(remoteProfile.updatedAt || remoteProfile.updated_at || 0).getTime();
        const localTimestamp = new Date(localProfile?.updatedAt || localProfile?.updated_at || 0).getTime();

        // If local profile has newer edits, do NOT clobber with older remote snapshot.
        // Instead, automatically heal the backend with the newer local profile!
        if (localProfile && localTimestamp > remoteTimestamp) {
          saveProfileToBackend(localProfile).catch(() => {});
          return localProfile;
        }

        // Remote is newer or equal: persist remote profile locally without an echo-sync loop
        saveProfile(remoteProfile, { syncToBackend: false });
        return remoteProfile;
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

export const MULTI_INDUSTRY_PARSER_CONFIG = {
  'Healthcare & Medical': {
    titles: [
      'Clinical Nurse Specialist', 'Registered Nurse', 'Nurse Unit Manager',
      'Associate Nurse Unit Manager', 'Clinical Care Coordinator', 'Triage Nurse',
      'Enrolled Nurse', 'Nurse Practitioner', 'Physiotherapist', 'Hospital Administrator',
      'Healthcare Coordinator', 'Aged Care Nurse'
    ],
    skills: [
      'AHPRA Registered Nurse', 'Acute Patient Assessment', 'Emergency Triage',
      'Clinical Governance', 'Medication Administration', 'EMR / Cerner',
      'Wound Care', 'Infection Control', 'Cannulation', 'BLS / ALS',
      'Care Planning', 'Patient Advocacy', 'Palliative Care', 'IV Cannulation'
    ],
    keywords: ['nurse', 'nursing', 'ahpra', 'triage', 'hospital', 'clinical', 'patient', 'medical', 'ward', 'icu', 'medication', 'allied health', 'physiotherapy', 'aged care', 'healthcare', 'health service', 'epworth', 'emergency triage']
  },
  'Finance & Accounting': {
    titles: [
      'Senior Financial Accountant', 'Management Accountant', 'Finance Manager',
      'Commercial Analyst', 'Financial Controller', 'Tax Accountant', 'FP&A Manager',
      'Bookkeeper', 'Payroll Officer', 'Credit Risk Analyst', 'Internal Auditor'
    ],
    skills: [
      'CPA / CA Qualified', 'Financial Modeling', 'FP&A & Budgeting',
      'Variance Analysis', 'SAP ERP', 'Xero', 'BAS / GST', 'Tax Compliance',
      'Balance Sheet Reconciliation', 'Statutory Reporting', 'Internal Controls',
      'General Ledger', 'Accounts Payable', 'Accounts Receivable'
    ],
    keywords: ['accountant', 'accounting', 'cpa', 'ca qualified', 'chartered accountant', 'financial', 'finance', 'ledger', 'payroll', 'tax', 'bas', 'audit', 'bookkeeper', 'cfo', 'balance sheet', 'reconciliation']
  },
  'Construction & Trades': {
    titles: [
      'Site Supervisor', 'Construction Project Manager', 'Site Manager',
      'Site Foreman', 'Contracts Administrator', 'Estimator', 'Civil Project Manager',
      'Building Inspector', 'Fitout Supervisor'
    ],
    skills: [
      'White Card (CPCCWHS1001)', 'SafeWork WHS', 'SWMS Documentation',
      'Site Supervision', 'Subcontractor Management', 'Procore', 'Trade Coordination',
      'Quality Assurance', 'Defect Management', 'First Aid', 'Contract Administration'
    ],
    keywords: ['construction', 'builder', 'site supervisor', 'foreman', 'trades', 'carpenter', 'electrician', 'plumber', 'white card', 'swms', 'whs', 'ohs', 'procore', 'estimator', 'quantity surveyor', 'building']
  },
  'Education': {
    titles: [
      'Secondary School Teacher', 'Primary School Teacher', 'Learning & Development Specialist',
      'Curriculum Lead', 'Instructional Designer', 'Academic Coordinator',
      'Early Childhood Educator', 'Education Consultant'
    ],
    skills: [
      'Curriculum Design', 'Instructional Design', 'LMS Administration',
      'Adult Learning Theory', 'Workshop Facilitation', 'VIT Registration',
      'Classroom Management', 'Student Assessment'
    ],
    keywords: ['teacher', 'teaching', 'educator', 'curriculum', 'school', 'classroom', 'student', 'instructional designer', 'tafe', 'vit', 'pedagogy']
  },
  'Legal': {
    titles: [
      'Senior Legal Counsel', 'Corporate Lawyer', 'Compliance Manager',
      'Contracts Specialist', 'Solicitor', 'Paralegal', 'Legal Operations Lead'
    ],
    skills: [
      'Contract Drafting & Negotiation', 'Regulatory Compliance', 'Commercial Law',
      'Corporate Governance', 'Privacy Act', 'Legal Risk Assessment'
    ],
    keywords: ['solicitor', 'lawyer', 'counsel', 'legal', 'paralegal', 'litigation', 'compliance', 'contracts', 'conveyancer', 'juris']
  },
  'HR & People': {
    titles: [
      'People & Culture Manager', 'HR Business Partner', 'Talent Acquisition Lead',
      'HR Operations Specialist', 'Employee Relations Lead', 'Recruitment Consultant'
    ],
    skills: [
      'Talent Acquisition', 'HR Strategy', 'Employee Relations',
      'Fair Work Act', 'HRIS (Workday/BambooHR)', 'Performance Management',
      'Culture & Engagement', 'Onboarding'
    ],
    keywords: ['human resources', 'talent acquisition', 'recruiter', 'recruitment', 'people & culture', 'hris', 'employee relations', 'fair work', 'hr business partner']
  },
  'Marketing & Sales': {
    titles: [
      'Digital Marketing Manager', 'Growth Lead', 'Account Executive',
      'Brand Strategist', 'Performance Marketing Manager', 'Campaign Manager',
      'SEO Specialist', 'Business Development Manager'
    ],
    skills: [
      'Performance Marketing', 'Google Ads / Meta Ads', 'SEO / SEM Strategy',
      'HubSpot / Marketo', 'Growth Funnel Optimization', 'Google Analytics 4',
      'Content Marketing', 'Email Marketing'
    ],
    keywords: ['marketing', 'seo', 'sem', 'campaign', 'sales', 'crm', 'hubspot', 'social media', 'growth', 'brand', 'advertising', 'copywriting']
  },
  'Technology & IT': {
    titles: [
      'Senior Systems Engineer', 'Cloud Infrastructure Engineer', 'DevOps Engineer',
      'Full Stack Developer', 'Systems Administrator', 'Solutions Architect',
      'Platform Engineer', 'Site Reliability Engineer', 'IT Operations Lead'
    ],
    skills: [
      'Microsoft 365', 'Azure', 'AWS', 'Kubernetes', 'Docker',
      'PowerShell', 'Active Directory', 'Windows Server', 'Linux',
      'Python', 'CI/CD', 'Terraform', 'PostgreSQL', 'Networking', 'Firewalls', 'Security'
    ],
    keywords: ['software', 'cloud', 'developer', 'devops', 'azure', 'aws', 'systems engineer', 'infrastructure', 'm365', 'powershell', 'active directory', 'network', 'linux', 'kubernetes', 'full stack']
  }
};

/**
 * Heuristic client-side resume parser with full multi-industry intelligence
 * Supports Healthcare & Nursing, Finance, Trades, Education, Legal, Marketing, HR, IT
 */
export const parseResumeTextClientSide = (text = '', existingProfile = {}) => {
  const lower = (text || '').toLowerCase();

  // Name extraction — prefer existing profile name if valid
  const lines = (text || '').split('\n').map(l => l.trim()).filter(Boolean);
  let name = existingProfile.name && existingProfile.name !== 'Candidate' ? existingProfile.name : '';
  if (!name) {
    if (lines.length > 0 && lines[0].length <= 40 && !/resume|curriculum|cv|summary|experience|%pdf|profile/i.test(lines[0])) {
      name = lines[0].replace(/[^a-zA-Z\s'-]/g, '').trim();
    } else if (lines.length > 1 && lines[1].length <= 40 && !/resume|curriculum|cv|summary|experience|%pdf|profile/i.test(lines[1])) {
      name = lines[1].replace(/[^a-zA-Z\s'-]/g, '').trim();
    }
  }

  // Email & Phone
  const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
  const email = emailMatch ? emailMatch[1] : (existingProfile.email || '');
  if (!name && email) {
    name = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }
  if (!name) name = 'Candidate';

  const phoneMatch = text.match(/(?:\+?61|0)[2-478](?:[ -]?[0-9]){8}/);
  const phone = phoneMatch ? phoneMatch[0] : (existingProfile.phone || '');

  // Suburb & Location — check text or preserve existing profile location
  let suburb = existingProfile.suburb || '';
  let location = existingProfile.location || '';
  if (lower.includes('richmond')) { suburb = 'Richmond'; location = 'Richmond VIC 3121'; }
  else if (lower.includes('south yarra')) { suburb = 'South Yarra'; location = 'South Yarra VIC 3141'; }
  else if (lower.includes('st kilda')) { suburb = 'St Kilda'; location = 'St Kilda VIC 3182'; }
  else if (lower.includes('docklands')) { suburb = 'Docklands'; location = 'Docklands VIC 3008'; }
  else if (lower.includes('parkville')) { suburb = 'Parkville'; location = 'Parkville VIC 3052'; }
  else if (lower.includes('melbourne')) { suburb = 'Melbourne'; location = 'Melbourne VIC 3000'; }

  // Industry Resolution: Evaluate keyword density across all industries
  let bestIndustry = existingProfile.industry && existingProfile.industry !== ''
    ? existingProfile.industry
    : 'Healthcare & Medical';

  let highestScore = -1;
  for (const [indName, indConf] of Object.entries(MULTI_INDUSTRY_PARSER_CONFIG)) {
    let score = 0;
    for (const kw of indConf.keywords) {
      if (lower.includes(kw)) score += 2;
    }
    for (const titleCandidate of indConf.titles) {
      if (lower.includes(titleCandidate.toLowerCase())) score += 5;
    }
    if (score > highestScore) {
      highestScore = score;
      bestIndustry = indName;
    }
  }

  // If existing profile had an explicit non-IT industry and score didn't massively contradict, honor existing profile
  if (existingProfile.industry && existingProfile.industry in MULTI_INDUSTRY_PARSER_CONFIG) {
    bestIndustry = existingProfile.industry;
  }

  const industryConfig = MULTI_INDUSTRY_PARSER_CONFIG[bestIndustry] || MULTI_INDUSTRY_PARSER_CONFIG['Healthcare & Medical'];

  // Seniority & Experience
  let seniorityLevel = existingProfile.seniorityLevel || 'Senior';
  let yearsOfExperience = existingProfile.yearsOfExperience || 7;

  const yearMatches = text.match(/20\d\d|19\d\d/g);
  if (yearMatches && yearMatches.length >= 2) {
    const years = yearMatches.map(Number).sort();
    const span = years[years.length - 1] - years[0];
    if (span >= 1 && span <= 35) yearsOfExperience = span;
  }

  if (lower.includes('director') || lower.includes('head of') || lower.includes('executive') || lower.includes('chief')) {
    seniorityLevel = 'Executive / Director';
  } else if (lower.includes('principal') || lower.includes('architect')) {
    seniorityLevel = 'Principal / Architect';
  } else if (yearsOfExperience >= 10 || lower.includes('lead') || lower.includes('manager') || lower.includes('unit manager')) {
    seniorityLevel = 'Senior / Lead';
  } else if (yearsOfExperience <= 2 || lower.includes('graduate') || lower.includes('entry level') || lower.includes('junior')) {
    seniorityLevel = 'Entry / Graduate';
  }

  // Exact Title Detection within the identified industry
  let matchedTitle = '';
  // Check longer titles first
  const sortedTitles = [...industryConfig.titles].sort((a, b) => b.length - a.length);
  for (const tCandidate of sortedTitles) {
    if (new RegExp(`\\b${tCandidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) {
      matchedTitle = tCandidate;
      break;
    }
  }

  // If not matched from dictionary, check lines 1–4 for professional headline
  if (!matchedTitle) {
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i];
      if (/nurse|accountant|engineer|manager|coordinator|specialist|supervisor|director|solicitor|teacher|educator|analyst/i.test(line) && line.length < 50 && !line.includes('@')) {
        matchedTitle = line.replace(/[^a-zA-Z\s/&-]/g, '').trim();
        break;
      }
    }
  }

  if (!matchedTitle) {
    matchedTitle = industryConfig.titles[0];
  }

  // Build target titles for this specific industry (Never pollute with IT engineer titles)
  const targetTitles = [
    matchedTitle,
    ...industryConfig.titles.filter(t => t.toLowerCase() !== matchedTitle.toLowerCase())
  ].slice(0, 5);

  // Skill Extraction for this specific industry
  const extractedSkills = industryConfig.skills.filter(k => {
    const cleanK = k.split('(')[0].trim();
    return new RegExp(`\\b${cleanK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
  });

  const finalSkills = [...new Set([
    ...extractedSkills,
    ...(existingProfile.coreSkills || []),
    ...industryConfig.skills.slice(0, 4)
  ])];

  return {
    id: existingProfile.id || `profile_${Date.now()}`,
    name: name,
    title: matchedTitle,
    industry: bestIndustry,
    seniorityLevel: seniorityLevel,
    yearsOfExperience: yearsOfExperience,
    marketArchetype: `${seniorityLevel} ${bestIndustry} Specialist`,
    email: email,
    phone: phone,
    location: location,
    suburb: suburb,
    workRights: existingProfile.workRights || 'Australian Citizen (Unrestricted)',
    clearance: existingProfile.clearance || '',
    targetSalary: existingProfile.targetSalary || '',
    targetTitles: targetTitles,
    coreSkills: finalSkills,
    certifications: existingProfile.certifications || [],
    keyStrengths: existingProfile.keyStrengths || [],
    managementStyle: existingProfile.managementStyle || '',
    interviewTalkingPoints: existingProfile.interviewTalkingPoints || [],
    workHistorySummary: text.slice(0, 500) || '',
    fullWorkExperienceText: text
  };
};

/**
 * AI-powered resume parser via OpenRouter or Server-Side AI Proxy
 */
export const parseResumeWithAI = async (resumeText, apiKey, model, contextIndustry = '') => {
  const config = getLlmConfig();
  const effectiveKey = (apiKey || config.apiKey || '').trim();
  const effectiveModel = model || config.model;
  const endpoint = config.endpoint || 'https://openrouter.ai/api/v1/chat/completions';
  const provider = config.provider || 'openrouter';

  // If no personal API key is provided, attempt server-side AI proxy first
  if (!effectiveKey) {
    try {
      const { callAIProxy } = await import('./billingService');
      const proxyResult = await callAIProxy({
        model: effectiveModel || 'google/gemini-2.0-flash',
        messages: [
          { role: 'system', content: 'You are a principal talent intelligence architect that outputs strictly valid JSON only.' },
          { role: 'user', content: `Analyze the following resume and return a structured JSON profile for ${contextIndustry || 'the candidate'}. Schema: {"name": "Full Name", "title": "Professional Title", "industry": "${contextIndustry || 'Industry'}", "targetTitles": ["Title 1", "Title 2", "Title 3"], "coreSkills": ["Skill 1", "Skill 2"], "location": "City, State", "workHistorySummary": "Summary"}. Resume:\n${resumeText.slice(0, 8000)}` }
        ],
        temperature: 0.2,
        max_tokens: 2500
      });
      const content = proxyResult?.choices?.[0]?.message?.content || '';
      const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed && (parsed.title || parsed.targetTitles?.length)) {
        return {
          id: parsed.id || `profile_${Date.now()}`,
          ...parsed,
          industry: contextIndustry || parsed.industry,
          fullWorkExperienceText: parsed.fullWorkExperienceText || resumeText
        };
      }
    } catch (proxyErr) {
      console.warn('Server-side AI proxy parse unavailable, using high-precision multi-industry client parser:', proxyErr);
    }
    return parseResumeTextClientSide(resumeText, { industry: contextIndustry });
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
    let res;
    if (provider === 'anthropic') {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': effectiveKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: effectiveModel,
          max_tokens: 3000,
          messages: [{ role: 'user', content: prompt }]
        })
      });
    } else {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (effectiveKey) {
        headers['Authorization'] = `Bearer ${effectiveKey}`;
      }
      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'https://job-dashboard.app';
        headers['X-Title'] = 'CAREER.AGENT - Deep Profile Engine';
      }

      res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: effectiveModel,
          messages: [
            { role: 'system', content: 'You are a precise talent intelligence parser that outputs strictly valid JSON only.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          max_tokens: 3000
        })
      });
    }

    if (!res.ok) {
      throw new Error(`Parser API error: ${res.status}`);
    }

    const data = await res.json();
    let content = '';
    if (provider === 'anthropic') {
      content = data.content?.[0]?.text || '';
    } else {
      content = data.choices?.[0]?.message?.content || '';
    }
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

/**
 * Calculates a profile completeness score (0 - 100%) and actionable improvement items.
 * Completely industry-agnostic, supporting any career path (healthcare, nursing, trades, finance, IT, etc.).
 *
 * @param {Object} profile Candidate profile object
 * @returns {{ score: number, isComplete: boolean, improvements: Array, atsDensity: string }}
 */
export function calculateProfileCompleteness(profile = {}) {
  let score = 0;
  const improvements = [];

  // 1. Identity & Name (15 pts)
  if (profile.name && profile.name.trim().length > 1) {
    score += 15;
  } else {
    improvements.push({
      id: 'name',
      category: 'Identity',
      title: 'Add your candidate name',
      description: 'Needed for personalized cover letters, outreach, and applications.',
      points: 15,
      actionLabel: 'Add Name (+15%)'
    });
  }

  // 2. Industry & Seniority (15 pts)
  if (profile.industry && profile.industry.trim().length > 1) {
    score += 15;
  } else {
    improvements.push({
      id: 'industry',
      category: 'Targeting',
      title: 'Select your target industry',
      description: 'Calibrates search scrapers and ATS matching algorithms to your domain.',
      points: 15,
      actionLabel: 'Select Industry (+15%)'
    });
  }

  // 3. Target Role Titles (15 pts)
  const titles = Array.isArray(profile.targetTitles) && profile.targetTitles.length > 0
    ? profile.targetTitles
    : profile.title ? [profile.title] : [];
  if (titles.length > 0) {
    score += 15;
  } else {
    improvements.push({
      id: 'titles',
      category: 'Role Targeting',
      title: 'Define target job titles',
      description: 'Prioritizes high-conviction job opportunities in your search feed.',
      points: 15,
      actionLabel: 'Add Target Roles (+15%)'
    });
  }

  // 4. Core Skills & Keywords (15 pts)
  const skills = Array.isArray(profile.coreSkills) ? profile.coreSkills : [];
  if (skills.length >= 6) {
    score += 15;
  } else if (skills.length > 0) {
    score += 8;
    improvements.push({
      id: 'skills',
      category: 'ATS Keywords',
      title: `Add more core skills (${skills.length}/6 added)`,
      description: 'Increases ATS match accuracy and unlocks higher fit scoring tiers.',
      points: 7,
      actionLabel: 'Expand Skills (+7%)'
    });
  } else {
    improvements.push({
      id: 'skills',
      category: 'ATS Keywords',
      title: 'Add core skills and competencies',
      description: 'Essential for matching job descriptions and keywords.',
      points: 15,
      actionLabel: 'Add Core Skills (+15%)'
    });
  }

  // 5. Location & Commute (15 pts)
  if (profile.location && profile.location.trim().length > 1) {
    score += 15;
  } else {
    improvements.push({
      id: 'location',
      category: 'Location',
      title: 'Specify preferred location or suburb',
      description: 'Calculates commute radiuses and uncovers nearby roles.',
      points: 15,
      actionLabel: 'Set Location (+15%)'
    });
  }

  // 6. Resume / Work History (15 pts)
  const hasHistory = Boolean(
    (profile.workHistorySummary && profile.workHistorySummary.trim().length > 10) ||
    (profile.fullWorkExperienceText && profile.fullWorkExperienceText.trim().length > 30) ||
    (profile.summary && profile.summary.trim().length > 20)
  );
  if (hasHistory) {
    score += 15;
  } else {
    improvements.push({
      id: 'resume',
      category: 'Experience',
      title: 'Add work experience or upload resume',
      description: 'Unlocks STAR achievement extraction and tailored application synthesis.',
      points: 15,
      actionLabel: 'Add Experience (+15%)'
    });
  }

  // 7. AI Key / Reasoning Engine (10 pts)
  let hasAiKey = false;
  try {
    const rawConfig = typeof window !== 'undefined' ? localStorage.getItem('job_dashboard_llm_config') : null;
    if (rawConfig) {
      const parsedConfig = JSON.parse(rawConfig);
      hasAiKey = Boolean(parsedConfig.apiKey && parsedConfig.apiKey.length > 3);
    }
  } catch {}
  if (hasAiKey) {
    score += 10;
  } else {
    improvements.push({
      id: 'aiEngine',
      category: 'AI Engine',
      title: 'Connect AI Reasoning Key (Optional)',
      description: 'Powers automated document tuning, bespoke cover letters, and interview coaching.',
      points: 10,
      actionLabel: 'Connect AI Key (+10%)'
    });
  }

  return {
    score: Math.min(100, score),
    isComplete: score >= 100,
    improvements,
    atsDensity: skills.length >= 8 ? 'Optimal' : skills.length >= 4 ? 'Good' : 'Low'
  };
}

