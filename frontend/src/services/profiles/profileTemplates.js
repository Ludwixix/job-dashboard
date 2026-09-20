/**
 * profileTemplates.js
 * Default user personas, industry sector templates, and template loader.
 */

import { saveProfile } from './profileStorage';

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
