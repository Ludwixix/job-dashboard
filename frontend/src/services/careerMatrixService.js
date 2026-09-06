/**
 * Strategic Career Roadmap & Skills Gap Forecasting Engine Service
 * Provides multi-sector seniority level progression, certification mapping,
 * salary modeling, and 6-12 month execution milestones.
 */

import { getApiBase } from './dataService';

export const SENIORITY_LEVELS = [
  { id: 'entry_mid', label: 'Entry / Mid-Level Specialist', badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  { id: 'senior_lead', label: 'Senior Specialist / Lead', badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  { id: 'staff_principal', label: 'Staff / Principal / Consultant', badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  { id: 'executive', label: 'Director / Executive / Partner', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
];

export const SECTOR_CAREER_TRACKS = {
  technology: {
    sector_label: 'Technology & Engineering',
    entry_mid: {
      title: 'Systems / DevOps Engineer',
      salary_range: [95000, 135000, 115000],
      skills: ['Linux Administration', 'Python/Bash Scripting', 'CI/CD Pipelines', 'Containerization (Docker)', 'Cloud Fundamentals (AWS/Azure)'],
    },
    senior_lead: {
      title: 'Senior Cloud & Platform Engineer',
      salary_range: [145000, 185000, 165000],
      skills: ['Kubernetes & EKS/AKS Orchestration', 'Infrastructure as Code (Terraform)', 'Cloud Architecture & High Availability', 'Observability (Prometheus/Grafana)', 'FinOps & Cost Optimization'],
    },
    staff_principal: {
      title: 'Staff Platform Architect / Principal Engineer',
      salary_range: [190000, 240000, 215000],
      skills: ['Multi-Region Distributed Systems Architecture', 'Enterprise Security Governance (ASD Essential 8)', 'FinOps & Cloud Unit Economics', 'Cross-Engineering Strategy', 'Executive Technical Influence'],
    },
    executive: {
      title: 'Head of Infrastructure / VP of Engineering',
      salary_range: [250000, 340000, 290000],
      skills: ['Department P&L Ownership & Budgeting', 'Multi-Year Technology Vision', 'Enterprise Vendor Negotiation', 'Executive & Board Strategy', 'Talent Architecture & Org Design'],
    },
    adjacent_pivots: [
      { title: 'Site Reliability Engineering (SRE) Lead', overlap_pct: 85, reason: 'High crossover in Linux, automation, and distributed reliability telemetry.' },
      { title: 'Cloud Security Architect (SecOps)', overlap_pct: 80, reason: 'Strong alignment with IaC, identity access management, and ASD Essential 8 compliance.' },
      { title: 'Enterprise Solutions Architect', overlap_pct: 75, reason: 'Leverages broad cloud infrastructure architecture and enterprise stakeholder alignment.' },
    ],
  },
  healthcare: {
    sector_label: 'Healthcare & Clinical',
    entry_mid: {
      title: 'Registered Nurse (Acute / Community)',
      salary_range: [78000, 95000, 86000],
      skills: ['Direct Patient Care', 'Medication Administration', 'Aseptic Technique & Wound Care', 'Clinical Handover (ISBAR)', 'EMR Documentation'],
    },
    senior_lead: {
      title: 'Clinical Nurse Specialist (CNS)',
      salary_range: [105000, 125000, 115000],
      skills: ['Specialized Clinical Diagnostics', 'Clinical Preceptorship & Mentoring', 'Quality Auditing & Infection Control', 'Complex Case Management', 'Morbidity & Mortality Clinical Review'],
    },
    staff_principal: {
      title: 'Nurse Unit Manager (NUM) / Clinical Nurse Consultant',
      salary_range: [130000, 155000, 142000],
      skills: ['Ward Rostering & Ratio Compliance', 'Clinical Governance & NSQHS Standards', 'Staff Dispute Resolution', 'Accreditation Preparedness', 'Multidisciplinary Care Coordination'],
    },
    executive: {
      title: 'Director of Nursing / Executive Director of Clinical Services',
      salary_range: [175000, 235000, 200000],
      skills: ['Hospital Clinical Governance Strategy', 'Workforce Planning & Enterprise Agreements', 'Board of Health Quality Reporting', 'Capital Health Budget Allocation'],
    },
    adjacent_pivots: [
      { title: 'Clinical Research Coordinator', overlap_pct: 80, reason: 'Leverages patient trial protocols, ethics governance, and clinical documentation.' },
      { title: 'Health Informatics Specialist', overlap_pct: 75, reason: 'Combines acute clinical domain expertise with EMR systems and workflow design.' },
      { title: 'Aged Care Facility Operations Manager', overlap_pct: 70, reason: 'High demand for AHPRA-registered clinical leadership and compliance oversight.' },
    ],
  },
  finance: {
    sector_label: 'Banking, Finance & Accounting',
    entry_mid: {
      title: 'Financial Analyst / Assistant Accountant',
      salary_range: [80000, 105000, 92000],
      skills: ['Month-End Ledger Reconciliations', 'Variance Analysis & Budgeting', 'Advanced Financial Modeling', 'AP/AR Oversight', 'ERP General Ledger Posting'],
    },
    senior_lead: {
      title: 'Senior Management Accountant / Finance Business Partner',
      salary_range: [120000, 155000, 138000],
      skills: ['Statutory Financial Reporting (AASB/IFRS)', 'FP&A Commercial Modeling', 'Divisional Business Partnering', 'Australian Tax Compliance (GST/FBT)', 'Internal Controls & Audit Defense'],
    },
    staff_principal: {
      title: 'Financial Controller / Head of FP&A',
      salary_range: [165000, 210000, 185000],
      skills: ['Corporate Treasury & Cash Flow Optimization', 'Audit Committee Presentations', 'ERP Transformation & PowerBI Architecture', 'M&A Financial Due Diligence', 'Debt Facility & Covenant Governance'],
    },
    executive: {
      title: 'Chief Financial Officer (CFO)',
      salary_range: [240000, 360000, 295000],
      skills: ['Boardroom Financial Governance & Investor Relations', 'Capital Raising & Debt Syndication', 'Enterprise Risk & Capital Allocation', 'ASX Corporate Governance'],
    },
    adjacent_pivots: [
      { title: 'Commercial Strategy & Operations Director', overlap_pct: 80, reason: 'Draws on unit economics, commercial contracts, and margin analysis.' },
      { title: 'Internal Audit & Risk Advisory Lead', overlap_pct: 80, reason: 'Direct overlap with AASB controls, fraud governance, and risk matrices.' },
      { title: 'M&A Transaction Advisory Specialist', overlap_pct: 75, reason: 'Leverages advanced valuation modeling and working capital due diligence.' },
    ],
  },
  trades: {
    sector_label: 'Trades, Construction & Logistics',
    entry_mid: {
      title: 'Licensed Tradesperson / Electrical Specialist',
      salary_range: [80000, 105000, 92000],
      skills: ['Trade Craftsmanship & Technical Blueprint Reading', 'WHS Safety Protocols & SWMS Compliance', 'Power Equipment Operation', 'Fault Diagnosis & Testing', 'Material Quantification'],
    },
    senior_lead: {
      title: 'Leading Hand / Construction Foreperson',
      salary_range: [115000, 140000, 128000],
      skills: ['Crew Supervision & Daily Tool-Box Pre-Starts', 'Subcontractor Coordination & Site Scheduling', 'Critical Path Milestone Execution', 'Quality Assurance & Defect Rectification', 'Safety Hazard Investigation'],
    },
    staff_principal: {
      title: 'Site Superintendent / Construction Project Manager',
      salary_range: [150000, 195000, 172000],
      skills: ['Contract Administration (AS 4000)', 'Progress Claims & Commercial Variations', 'SafeWork Compliance & Auditing', 'Head Contractor Management', 'Trade Tender Packaging'],
    },
    executive: {
      title: 'General Manager of Construction / Operations Director',
      salary_range: [220000, 310000, 260000],
      skills: ['Multi-Project Operations & P&L Oversight', 'Enterprise WHS Safety Management Systems', 'Client Contract Governance & Tenders', 'Annual Capital Works Procurement'],
    },
    adjacent_pivots: [
      { title: 'WHS & Safety Auditor', overlap_pct: 85, reason: 'Deep practical grounding in high-risk Australian site safety and SWMS.' },
      { title: 'Construction Cost Estimator', overlap_pct: 75, reason: 'Direct understanding of trade labour rates, plant hire, and takeoff quantities.' },
      { title: 'Commercial Facilities Superintendent', overlap_pct: 70, reason: 'Expertise in building mechanical, electrical, and structural maintenance.' },
    ],
  },
  legal: {
    sector_label: 'Legal & Professional Services',
    entry_mid: {
      title: 'Associate Solicitor / In-House Legal Counsel',
      salary_range: [90000, 125000, 108000],
      skills: ['Legal Research & Advice Memos', 'Commercial Contract Review & Redlines', 'Discovery & Evidentiary Collation', 'Court Rules & Practice Notes', 'Client Matter Administration'],
    },
    senior_lead: {
      title: 'Senior Associate / Senior Legal Counsel',
      salary_range: [140000, 185000, 162000],
      skills: ['High-Value Transaction Structuring', 'Dispute Negotiation & ADR', 'Regulatory Response (ASIC / ACCC)', 'Junior Solicitor Supervision', 'Client Commercial Management'],
    },
    staff_principal: {
      title: 'Special Counsel / Legal Practice Director',
      salary_range: [195000, 260000, 225000],
      skills: ['Strategic Legal Risk Advisory & Board Briefings', 'Practice Group Authority', 'Complex Litigation Strategy', 'Fee Realization & Matter Profitability', 'Commercial Policy Formulation'],
    },
    executive: {
      title: 'Equity Partner / General Counsel & Company Secretary',
      salary_range: [280000, 450000, 350000],
      skills: ['Partnership Capital & Profit Allocation', 'Corporate Governance & Board Advisory', 'Enterprise Legal Risk Management', 'External Panel Spend Optimization'],
    },
    adjacent_pivots: [
      { title: 'Head of Regulatory & Compliance', overlap_pct: 85, reason: 'Extensive overlap in statutory interpretation, ASIC compliance, and enforcement response.' },
      { title: 'Corporate Governance & Company Secretary', overlap_pct: 80, reason: 'Deep grounding in Corporations Act 2001 and board governance.' },
      { title: 'Commercial Contracts Director', overlap_pct: 75, reason: 'Strong focus on procurement, vendor negotiation, and commercial risk transfer.' },
    ],
  },
};

export const AU_CERTIFICATION_REGISTRY = {
  technology: [
    { name: 'AWS Certified Solutions Architect - Professional', level: 'senior_lead', issuing_body: 'Amazon Web Services', estimated_hours: 90, impact: 'Unlocks Staff Architect roles; validates enterprise multi-tier designs.' },
    { name: 'Certified Kubernetes Administrator (CKA)', level: 'senior_lead', issuing_body: 'CNCF / Linux Foundation', estimated_hours: 60, impact: 'Industry benchmark for container orchestration and platform engineering.' },
    { name: 'CISM (Certified Information Security Manager)', level: 'staff_principal', issuing_body: 'ISACA', estimated_hours: 100, impact: 'Essential for cybersecurity governance and ASD Essential 8 alignment.' },
  ],
  healthcare: [
    { name: 'AHPRA Specialty Endorsement & Postgrad Cert', level: 'senior_lead', issuing_body: 'AHPRA / Nursing Board of Australia', estimated_hours: 150, impact: 'Mandatory clinical prerequisite to be classified as Clinical Nurse Specialist.' },
    { name: 'Advanced Life Support 2 (ALS2)', level: 'senior_lead', issuing_body: 'Australian Resuscitation Council', estimated_hours: 24, impact: 'Core requirement for acute, critical care, and emergency clinical leadership.' },
    { name: 'Lead Auditor in Healthcare Quality Management (NSQHS)', level: 'staff_principal', issuing_body: 'ACSQHC', estimated_hours: 40, impact: 'Required for Nurse Unit Manager clinical governance and hospital accreditation.' },
  ],
  finance: [
    { name: 'CA ANZ / CPA Australia Full Membership', level: 'senior_lead', issuing_body: 'Chartered Accountants ANZ / CPA', estimated_hours: 250, impact: 'Mandatory Australian qualification for Senior Accountant & Controller roles.' },
    { name: 'Financial Modeling & Valuation Analyst (FMVA)', level: 'entry_mid', issuing_body: 'Corporate Finance Institute', estimated_hours: 60, impact: 'Validates advanced 3-statement forecasting and commercial modeling.' },
    { name: 'GAICD (Company Directors Course)', level: 'staff_principal', issuing_body: 'AICD', estimated_hours: 80, impact: 'Hallmark credential for CFOs and Board Audit Committee appointments.' },
  ],
  trades: [
    { name: 'CPC40120 Certificate IV in Building & Construction', level: 'senior_lead', issuing_body: 'Australian TAFE / RTO', estimated_hours: 180, impact: 'Prerequisite for Builder License and Site Superintendent roles.' },
    { name: 'BSB41419 Certificate IV in Work Health & Safety', level: 'senior_lead', issuing_body: 'SafeWork Accredited RTO', estimated_hours: 80, impact: 'Crucial for Foreperson, Site Supervisor, and Safety Officer positions.' },
    { name: 'Electrical Contractor License', level: 'staff_principal', issuing_body: 'State SafeWork / Fair Trading', estimated_hours: 60, impact: 'Authorizes signing off trade compliance and leading commercial electrical crews.' },
  ],
  legal: [
    { name: 'Legal Practice Management Course (LPMC)', level: 'senior_lead', issuing_body: 'Law Society of NSW / Victoria', estimated_hours: 40, impact: 'Mandatory to lift the supervised condition on an AU Practising Certificate.' },
    { name: 'Certified In-House Counsel (ACC Credential)', level: 'senior_lead', issuing_body: 'ACC Australia', estimated_hours: 50, impact: 'Accelerates advancement to Senior Corporate Counsel.' },
    { name: 'Graduate Diploma of Applied Corporate Governance', level: 'staff_principal', issuing_body: 'Governance Institute of Australia', estimated_hours: 120, impact: 'Standard credential for ASX Company Secretary and General Counsel.' },
  ],
};

export function formatAudSalary(val) {
  if (!val || isNaN(val)) return '—';
  return `$${Math.round(val / 1000)}k`;
}

export function formatGrowthPct(val) {
  if (val === null || val === undefined || isNaN(val)) return '—';
  const prefix = val >= 0 ? '+' : '';
  return `${prefix}${Number(val).toFixed(1)}%`;
}

export function detectSeniorityLevel(title = '', years = 0) {
  const t = String(title).toLowerCase();
  if (/(director|vp|head\s+of|chief|partner|cfo|cto|general\s+manager)/.test(t)) return 'executive';
  if (/(staff|principal|superintendent|special\s+counsel|num|consultant)/.test(t)) return 'staff_principal';
  if (/(senior|lead|specialist|foreperson|foreman|associate\s+director)/.test(t) || years >= 5) return 'senior_lead';
  return 'entry_mid';
}

/**
 * Pure client-side computation fallback for offline resilience.
 */
export function computeClientCareerRoadmap(profile = {}, targetLevel = null, sector = 'technology') {
  const sectorKey = (sector || profile.industry || 'technology').toLowerCase();
  const track = SECTOR_CAREER_TRACKS[sectorKey] || SECTOR_CAREER_TRACKS.technology;

  const title = profile.title || profile.headline || 'Professional';
  const years = Number(profile.yearsOfExperience || 3);
  const currentLevel = detectSeniorityLevel(title, years);

  let resolvedTarget = targetLevel;
  if (!resolvedTarget) {
    const idx = SENIORITY_LEVELS.findIndex(l => l.id === currentLevel);
    resolvedTarget = idx < SENIORITY_LEVELS.length - 1 ? SENIORITY_LEVELS[idx + 1].id : 'senior_lead';
  }

  const currentConfig = track[currentLevel] || track.entry_mid;
  const targetConfig = track[resolvedTarget] || track.senior_lead;

  const existingSkills = new Set(
    (profile.coreSkills || profile.skills || []).map(s => String(s).toLowerCase().trim())
  );

  const skillGaps = [];
  for (const skill of targetConfig.skills) {
    const sLower = skill.toLowerCase();
    const matched = Array.from(existingSkills).some(ex => sLower.includes(ex) || ex.includes(sLower));
    if (!matched) {
      const isLead = ['leadership', 'strategy', 'governance', 'stakeholder', 'budget', 'mentorship'].some(w => sLower.includes(w));
      skillGaps.push({
        skill,
        category: isLead ? 'Leadership & Strategy' : 'Technical Mastery',
        priority: 'high',
        acquisition_path: `Dedicate structured project execution toward ${skill}.`,
      });
    }
  }

  if (skillGaps.length === 0) {
    skillGaps.push({
      skill: `Advanced ${targetConfig.title} Mastery`,
      category: 'Strategic Impact',
      priority: 'medium',
      acquisition_path: 'Lead high-visibility cross-functional initiatives demonstrating executive business impact.',
    });
  }

  const certs = AU_CERTIFICATION_REGISTRY[sectorKey] || AU_CERTIFICATION_REGISTRY.technology;
  const relevantCerts = certs.filter(c => c.level === resolvedTarget || c.level === 'senior_lead');

  const milestones = [
    {
      timeframe: 'Months 1–3 (Q1)',
      focus: 'Core Capability Hardening',
      deliverables: [
        `Address foundational skill delta: ${skillGaps[0]?.skill || 'Target competency'}.`,
        'Initiate coursework for target industry certification.',
        'Conduct internal stakeholder discovery to identify acute operational bottlenecks.',
      ],
    },
    {
      timeframe: 'Months 4–6 (Q2)',
      focus: 'Credentialing & Measurable Business Impact',
      deliverables: [
        `Complete examination: ${relevantCerts[0]?.name || 'Industry credential'}.`,
        'Ship high-visibility project delivering verified efficiency or revenue impact.',
        'Establish mentorship cadence with junior team members.',
      ],
    },
    {
      timeframe: 'Months 7–12 (Q3-Q4)',
      focus: 'Strategic Scope & Promotion Positioning',
      deliverables: [
        `Transition into target ${targetConfig.title} governance.`,
        'Present multi-quarter business case to senior leadership.',
        'Negotiate formal title adjustment and compensation realignment to target market band.',
      ],
    },
  ];

  const [currMin, currMax, currMed] = currentConfig.salary_range;
  const [tgtMin, tgtMax, tgtMed] = targetConfig.salary_range;
  const salaryDelta = tgtMed - currMed;
  const growthPct = Number(((salaryDelta / currMed) * 100).toFixed(1));

  return {
    sector: sectorKey,
    sector_label: track.sector_label,
    current_level: currentLevel,
    current_level_label: SENIORITY_LEVELS.find(l => l.id === currentLevel)?.label || currentLevel,
    current_title: title,
    target_level: resolvedTarget,
    target_level_label: SENIORITY_LEVELS.find(l => l.id === resolvedTarget)?.label || resolvedTarget,
    target_title: targetConfig.title,
    skill_gaps: skillGaps,
    certifications: relevantCerts.length > 0 ? relevantCerts : certs.slice(0, 2),
    milestones_12m: milestones,
    salary_projection: {
      currency: 'AUD',
      current_min: currMin,
      current_max: currMax,
      current_median: currMed,
      target_min: tgtMin,
      target_max: tgtMax,
      target_median: tgtMed,
      projected_lift_aud: salaryDelta,
      projected_growth_pct: growthPct,
    },
    adjacent_pivots: track.adjacent_pivots || [],
  };
}

/**
 * Fetches strategic career roadmap from backend with seamless client fallback.
 */
export async function fetchCareerRoadmap(profile = {}, targetLevel = null, sector = 'technology') {
  try {
    const base = getApiBase ? getApiBase() : '';
    const res = await fetch(`${base}/api/career/roadmap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, target_level: targetLevel, sector }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.roadmap) {
        return data.roadmap;
      }
    }
  } catch (err) {
    console.warn('[CareerMatrix] Backend roadmap failed, using client fallback:', err);
  }
  return computeClientCareerRoadmap(profile, targetLevel, sector);
}
