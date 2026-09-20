/**
 * linkedInOptimizationPrompt.js
 * Domain prompts and template generators for LinkedIn inbound sourcing,
 * Boolean-friendly headlines, recruiter search indexes, and About section keywords.
 */

/**
 * Builds system and user prompts for synthesizing Boolean-optimized LinkedIn assets.
 *
 * @param {Object} job - Target job entity.
 * @param {Object} profile - Candidate profile record.
 * @returns {{systemPrompt: string, userPrompt: string}}
 */
export const buildLinkedInOptimizationPrompt = (job, profile = {}) => {
  const role = job?.title || 'Senior Systems & Infrastructure Engineer';
  const company = job?.company || 'Target Employer';
  const location = profile?.location || 'Melbourne, VIC';

  const systemPrompt = `You are a Principal Executive Recruiter and Inbound Sourcing Architect.
Your task is to craft high-conversion LinkedIn profile optimization assets for ${profile?.name || 'the candidate'}.
Assets must be formatted specifically for LinkedIn Recruiter / Sales Navigator algorithms (Boolean syntax and keyword indexing).
Output JSON conforming to the schema:
{
  "job_title": "${role}",
  "headlines": [
    "Headline 1 (Keyword-Dense Title | Certifications | Key Capability)",
    "Headline 2",
    "Headline 3"
  ],
  "about_index": "Markdown formatted About section search index",
  "boolean_search_strings": {
    "title_and_cloud": "Boolean search string for recruiters"
  }
}`;

  const userPrompt = `TARGET POSITION:
Role: ${role}
Company: ${company}
Location: ${location}

CANDIDATE:
Name: ${profile?.name || 'Candidate'}
Title: ${profile?.title || role}
Core Skills: ${(profile?.coreSkills || []).join(', ')}
Certifications: ${(profile?.certifications || []).join(', ')}
Clearance: ${profile?.clearance || 'Clearance Eligible'}

Generate 3 Boolean-friendly headlines, a recruiter-indexed About section, and recruiter boolean search strings.`;

  return { systemPrompt, userPrompt };
};

/**
 * Generates client-side formatted LinkedIn optimization markdown package.
 *
 * @param {string} title
 * @param {string} company
 * @returns {string} Markdown text with headlines and About section index
 */
export const buildClientSideLinkedInPackage = (title = 'Senior Systems & Infrastructure Engineer', company = 'Target Employer') => {
  return `### BOOLEAN-OPTIMIZED LINKEDIN HEADLINES
1. ${title} | Microsoft 365 & Azure Cloud Specialist | ACSC Essential 8 & Intune Engineer
2. Senior Systems Engineer | Enterprise Infrastructure Architect | PowerShell Automation & SOE
3. Cloud & Workplace Specialist | Entra ID & M365 Security | 99.9% Uptime Production Lead

### RECRUITER SEARCH INDEX (ABOUT SECTION)
Senior Systems Engineer and Enterprise Cloud Specialist with over a decade of experience architecting resilient workplace, identity, and automation solutions across Australian enterprise and government sectors. Specialized in Microsoft 365 (M365, Office 365), Azure Cloud, Microsoft Entra ID (Azure AD), Intune MDM, Windows Server, VMware, and advanced PowerShell automation.

Core Competencies & Boolean Recruiter Keywords:
- Systems Engineering, Cloud Architecture, Modern Workplace Administration
- Microsoft 365, Azure, Entra ID, Intune, Autopilot, Active Directory, Exchange Hybrid
- PowerShell 7, PnP PowerShell, REST APIs, Graph API, Python Scripting
- ACSC Essential 8, Cyber Security Maturity, SOE Packaging, GPO Hardening
- ITSM, ITIL 4, ServiceNow, L3 Incident Management, Root Cause Analysis (RCA)
- High-Availability Operations: 660k+ users, 99.9% uptime, 87% process acceleration
`;
};

/**
 * Builds structured fallback LinkedIn optimization data object.
 *
 * @param {Object} job
 * @param {Object} profile
 * @returns {Object} Structured headlines and boolean search index
 */
export const buildFallbackLinkedInOptimization = (job, profile = {}) => {
  const role = job?.title || 'Systems Engineer';
  const location = profile?.location?.split(',')[0] || 'Melbourne';

  return {
    job_title: role,
    headlines: [
      `${role} | Microsoft 365 & Azure Cloud Infrastructure | Baseline Eligible`,
      `Infrastructure Engineer | PowerShell Automation & Entra ID | 99.9% SLA`,
      `Senior IT Systems Engineer | ACSC Essential 8 & Modern Workplace`
    ],
    about_index: `Senior Systems Engineer specializing in Microsoft 365, Azure Cloud, and automation.\n• Core Titles: ${role} | Systems Administrator | Cloud Engineer\n• Cloud: Azure, Entra ID, Intune, M365\n• Automation: PowerShell, CI/CD, Scripting`,
    boolean_search_strings: {
      title_and_cloud: `("${role}" OR "Systems Engineer") AND (Azure OR "Microsoft 365") AND ${location}`
    }
  };
};
