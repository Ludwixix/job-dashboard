/**
 * Executive Job & Company Intelligence Dossier Generation Engine
 * 
 * Synthesizes deep organizational profiles, leadership hierarchies,
 * core pain points ('Why This Role Was Funded'), an actionable 'First 90 Days'
 * strategic execution blueprint, reverse interview questions, and due diligence flags
 * across all 5 career tracks (Tech, Healthcare, Finance, Trades, Legal).
 */

import { getActiveProfile, CANDIDATE_PROFILE } from './profileService';
import { getApiBase } from './dataService';

export const detectEnterpriseScale = (company = '', description = '') => {
  const text = `${company} ${description}`.toLowerCase();

  // Public Sector
  const publicTerms = [
    'department of', 'ministry', 'health service', 'alfred health', 'royal melbourne',
    'monash health', 'municipal', 'council', 'statutory', 'commission',
    'australian taxation office', 'ato', 'csiro', 'vps', 'aps', 'government',
    'public health', 'agency', 'public sector'
  ];
  if (publicTerms.some(term => new RegExp(`\\b${term}\\b`, 'i').test(text))) {
    return 'public_sector';
  }

  // ASX 200 / Large Enterprise
  const asxTerms = [
    'asx', 'asx 200', 'asx 100', 'fortune 500', 'commonwealth bank', 'bhp',
    'telstra', 'westpac', 'anz', 'nab', 'macquarie', 'rio tinto', 'woolworths',
    'wesfarmers', 'csl', 'fortescue', 'atlassian', 'canva', 'global resources',
    'multinational', '50,000 employees', '10,000+ employees', 'enterprise'
  ];
  if (asxTerms.some(term => new RegExp(`\\b${term}\\b`, 'i').test(text))) {
    return 'asx_enterprise';
  }

  // Growth Startup
  const growthTerms = [
    'startup', 'start-up', 'scaleup', 'scale-up', 'series a', 'series b',
    'series c', 'venture-backed', 'venture backed', 'seed', 'pre-seed',
    'incubator', 'fast-paced', 'scaling fast'
  ];
  if (growthTerms.some(term => new RegExp(`\\b${term}\\b`, 'i').test(text))) {
    return 'growth_startup';
  }

  return 'mid_market';
};

export const detectSector = (title = '', description = '', company = '') => {
  const text = `${title} ${company} ${description}`.toLowerCase();

  if (/\b(nurse|nursing|ahpra|clinical|health|patient|medical|doctor|hospital|allied health|physio|pharmacy|triage|nsqhs|aged care)\b/i.test(text)) {
    return 'healthcare';
  }
  if (/\b(accountant|accounting|cpa|\bca\b|audit|auditing|tax|finance|financial|payroll|ledger|bas|aasb|ifrs|apra|treasury)\b/i.test(text)) {
    return 'finance';
  }
  if (/\b(construction|builder|site supervisor|site manager|foreman|carpenter|electrician|plumber|trades|safework|whs|white card|subcontractor|scaffold)\b/i.test(text)) {
    return 'trades';
  }
  if (/\b(legal|counsel|solicitor|lawyer|barrister|paralegal|litigation|practising certificate|statutory compliance|m&a|admitted)\b/i.test(text)) {
    return 'legal';
  }
  if (/\b(software|cloud|devops|engineer|developer|data|architect|cyber|security|infrastructure|kubernetes|aws|azure|systems|network|frontend|backend)\b/i.test(text)) {
    return 'technology';
  }

  return 'general';
};

export const generateExecutiveDossier = (job = {}, profile = null) => {
  const companyName = String(job?.company || 'Target Organization').trim();
  const targetRole = String(job?.title || 'Professional Specialist').trim();
  const description = String(job?.description || job?.notes || '').trim();
  const location = String(job?.location || 'Australia').trim();

  const activeProfile = profile || getActiveProfile() || CANDIDATE_PROFILE || {};
  const candidateName = activeProfile.name || 'Candidate';
  const candidateSkills = activeProfile.coreSkills || [];

  const sector = detectSector(targetRole, description, companyName);
  const enterpriseScale = detectEnterpriseScale(companyName, description);

  const scaleMetaMap = {
    asx_enterprise: {
      label: 'ASX 200 / Multinational Enterprise',
      headcount: '5,000+ Employees',
      governance_style: 'Centralized Matrix & Enterprise Risk Committee',
      pace: 'Strategic & High Rigor'
    },
    public_sector: {
      label: 'Public Sector / Government Authority',
      headcount: '1,000–10,000+ Public Servants',
      governance_style: 'State/Federal Public Sector Standards & Ministerial Accountability',
      pace: 'Process-Governed & Transparent'
    },
    growth_startup: {
      label: 'High-Growth Scaleup / Venture-Backed',
      headcount: '50–500 Employees',
      governance_style: 'Agile Leadership & Direct Executive Access',
      pace: 'Ultra-Fast & Iterative'
    },
    mid_market: {
      label: 'Established Mid-Market Corporate',
      headcount: '200–2,000 Employees',
      governance_style: 'Pragmatic Commercial Oversight & Board Reporting',
      pace: 'Commercially Agile'
    }
  };

  const scaleMeta = scaleMetaMap[enterpriseScale] || scaleMetaMap.mid_market;

  let operatingModel = '';
  let complianceFrameworks = [];
  let competitors = [];
  let execLeadership = [];
  let whyFunded = '';
  let challenges = [];
  let reverseQ = [];
  let planP1Actions = [];
  let planP1Deliverables = [];
  let planP2Actions = [];
  let planP2Deliverables = [];
  let planP3Actions = [];
  let planP3Metrics = [];

  if (sector === 'healthcare') {
    operatingModel = enterpriseScale === 'public_sector'
      ? 'Public Health Network / Acute Inpatient & Tertiary Hospital Care'
      : 'Private Hospital Group / Specialized Clinical Health Network';
    complianceFrameworks = [
      'AHPRA Registration & Mandatory CPD Standards',
      'NSQHS (National Safety and Quality Health Service) Standards',
      'ISBAR Structured Clinical Handover Protocols',
      'Aged Care Quality Standards (if residential care)',
      'Therapeutic Goods Administration (TGA) Compliance'
    ];
    competitors = ['Ramsay Health Care', 'St Vincent\'s Health', 'Healthscope', 'Mercy Health', 'Monash Health'];
    execLeadership = [
      { role: 'Chief Executive Officer / Hospital Executive Director', focus: 'Clinical excellence, operational throughput, and board governance' },
      { role: 'Director of Clinical Services / Director of Nursing (DON)', focus: 'Staffing ratios, patient safety, and clinical credentialing' },
      { role: 'Unit Manager / Clinical Nurse Consultant', focus: 'Daily ward operations, bed management, and multidisciplinary coordination' }
    ];
    whyFunded = `Funded to elevate patient care delivery, stabilize clinical handover reliability, and uphold strict NSQHS accreditation across ${location}.`;
    challenges = [
      'Patient acuity fluctuations and nurse-to-patient staffing ratio balances.',
      'Minimizing clinical documentation fatigue and handoff error variance.',
      'Navigating strict state health department regulatory scrutiny.',
      'Balancing multidisciplinary team coordination under high bed occupancy.'
    ];
    reverseQ = [
      'What are the primary clinical quality metrics or NSQHS criteria the executive team is targeting for improvement this calendar year?',
      'How does executive leadership actively support ward culture, fatigue management, and clinical mentorship during peak acuity cycles?',
      'What investments are being made in digital health or electronic medical records (EMR) to reduce administrative load?',
      'How does the interdisciplinary clinical governance model handle rapid escalation of complex patient cases?',
      'What would successful clinical performance look like for this role by the conclusion of the initial 90 days?'
    ];
    planP1Actions = [
      'Conduct comprehensive clinical workflow audit of inpatient handovers and patient intake processes.',
      'Meet with Nurse Unit Manager, Allied Health leads, and medical consultants to align on clinical expectations.',
      'Audit medication administration records and AHPRA compliance documentation.',
      'Shadow key shift handovers to evaluate ISBAR protocol adherence.'
    ];
    planP1Deliverables = ['Baseline Clinical Workflow & Handoff Audit Report', 'Stakeholder Priority Map'];
    planP2Actions = [
      'Implement standardized documentation checkpoints to eliminate handover ambiguity.',
      'Lead structured clinical coaching sessions on patient deterioration escalation.',
      'Collaborate with quality assurance leads on NSQHS audit readiness.'
    ];
    planP2Deliverables = ['Standardized Clinical Handover Checksheet', 'Zero-Variance Documentation Trial'];
    planP3Actions = [
      'Establish unit-wide continuous quality improvement (CQI) monitoring routines.',
      'Mentor graduate and junior nursing staff to build clinical resilience.',
      'Present patient outcome improvements to the Clinical Governance Committee.'
    ];
    planP3Metrics = ['99%+ NSQHS documentation compliance', 'Measurable reduction in clinical handover variance'];

  } else if (sector === 'finance') {
    operatingModel = 'Financial Services / Corporate Treasury & Commercial Accounting';
    complianceFrameworks = [
      'AASB / IFRS Statutory Financial Reporting Standards',
      'ATO Corporate Tax Governance & Transfer Pricing',
      'APRA Prudential Standards (CPS 234 / CPS 230 if banking/insurance)',
      'ASIC Corporations Act 2001 Financial Records Compliance',
      'SOX 404 / Internal Control Testing Frameworks'
    ];
    competitors = ['Macquarie Group', 'ANZ', 'BHP Corporate Finance', 'KPMG Enterprise', 'PwC Financial Advisory'];
    execLeadership = [
      { role: 'Chief Financial Officer (CFO)', focus: 'Capital allocation, board fiscal governance, and audit sign-off' },
      { role: 'Head of Finance / Financial Controller', focus: 'Statutory ledger accuracy, ERP integrity, and month-end speed' },
      { role: 'Head of Internal Audit & Tax', focus: 'Tax defense, ATO governance, and risk mitigation' }
    ];
    whyFunded = `Approved to accelerate month-end financial reporting cycles, ensure watertight AASB/IFRS audit compliance, and deliver strategic financial clarity in ${location}.`;
    challenges = [
      'Compressing multi-entity month-end ledger close from 10+ business days down to 4 days.',
      'Resolving ERP data discrepancies across disparate billing and sub-ledger systems.',
      'Navigating tightened ATO and ASIC disclosure and transparency mandates.',
      'Providing reliable forward-looking cash flow and working capital variance modeling.'
    ];
    reverseQ = [
      'What is the single biggest bottleneck in the current month-end financial close and reporting cadence?',
      'How is the finance team balancing commercial decision support with statutory audit rigor?',
      'What ERP or financial systems automation projects are planned or underway for this fiscal year?',
      'How has recent macroeconomic volatility or regulatory shifts impacted capital management priorities?',
      'What quantifiable outcome would make the CFO consider this hire an outstanding success after 90 days?'
    ];
    planP1Actions = [
      'Review chart of accounts, sub-ledger reconciliation cadence, and month-end close schedules.',
      'Interview FP&A leads, commercial managers, and external audit partners on recurring friction points.',
      'Audit balance sheet reconciliations and high-risk accrual accounts.',
      'Map transaction flows across ERP and payment gateway integrations.'
    ];
    planP1Deliverables = ['Financial Close Friction Diagnostic', 'Chart of Accounts Reconciliation Register'];
    planP2Actions = [
      'Automate repetitive journal entries and intercompany eliminations.',
      'Redesign the month-end checklist to compress closing schedule by 2 business days.',
      'Standardize balance sheet substantiation packs for external audit review.'
    ];
    planP2Deliverables = ['Compressed Month-End Close Playbook', 'Standardized Audit Workpaper Pack'];
    planP3Actions = [
      'Institutionalize automated variance analysis models comparing actuals vs forecast.',
      'Present fiscal recommendations and internal control hardening to the Audit Committee.',
      'Deliver training to operational leads on financial governance and cost accountability.'
    ];
    planP3Metrics = ['Month-end close completed within 4 business days', '100% audit-cleared balance sheet reconciliations'];

  } else if (sector === 'trades') {
    operatingModel = 'Commercial Head Contracting / Tier-1 Civil & Structural Project Delivery';
    complianceFrameworks = [
      'SafeWork Australia WHS Act & Regulations',
      'National Construction Code (NCC) / Building Code of Australia (BCA)',
      'CPCCWHS1001 White Card & High Risk Work Licencing (HRWL)',
      'ISO 9001 (Quality) & ISO 14001 (Environmental) Management',
      'Security of Payment Act (SOPA) Statutory Claims Compliance'
    ];
    competitors = ['Multiplex', 'Lendlease', 'Probuild', 'Built', 'Hansen Yuncken', 'Mirvac'];
    execLeadership = [
      { role: 'Managing Director / Construction Director', focus: 'Project margin preservation, safety culture, and program delivery' },
      { role: 'Project Director / Operations Manager', focus: 'Subcontractor procurement, site sequencing, and client relations' },
      { role: 'Site Safety & Quality Manager', focus: 'Zero-harm safety compliance and defect elimination' }
    ];
    whyFunded = `Created to drive on-time site milestone delivery, ensure strict SafeWork WHS zero-harm compliance, and streamline subcontractor trade coordination across ${location}.`;
    challenges = [
      'Preventing critical path program slippage caused by trade sequencing delays.',
      'Enforcing zero-harm WHS compliance across multiple high-risk work subcontractors.',
      'Controlling variation costs and managing long-lead material procurement lead times.',
      'Minimizing defect rectification lists leading up to practical completion (PC).'
    ];
    reverseQ = [
      'What is the current critical path status of the primary project site, and where are the key sequencing risks?',
      'How does company leadership handle safety non-conformance when trade packages fall behind schedule?',
      'What digital site management platforms (e.g. Procore, HammerTech, Aconex) are standard on this project?',
      'How are client and superintendent relationships managed during dispute and variation assessments?',
      'What primary safety and delivery milestone must be accomplished within the first 90 days?'
    ];
    planP1Actions = [
      'Execute thorough site walk and SafeWork WHS compliance audit across all active work fronts.',
      'Review master program schedule, critical path dependencies, and trade package contracts.',
      'Meet key subcontractor foremen to assess crew resourcing and material delivery schedules.',
      'Review Safe Work Method Statements (SWMS) and site induction records.'
    ];
    planP1Deliverables = ['Site Safety & Program Readiness Audit', 'Subcontractor Coordination Matrix'];
    planP2Actions = [
      'Establish disciplined daily trade coordination standups and weekly look-ahead meetings.',
      'Implement stringent quality inspection checkpoints prior to trade handovers to eliminate defects.',
      'Tighten site logistics and delivery booking systems to eliminate crane and hoisting bottlenecks.'
    ];
    planP2Deliverables = ['Weekly 3-Week Rolling Program Format', 'Pre-Cover Quality Verification Checklists'];
    planP3Actions = [
      'Lead milestone inspection with principal consultant and superintendent with zero high-risk non-conformances.',
      'Deliver targeted productivity gains on critical path trade sequences.',
      'Document subcontractor performance ratings for future package procurement.'
    ];
    planP3Metrics = ['Zero Lost-Time Injuries (LTI)', '100% critical path milestones delivered on schedule'];

  } else if (sector === 'legal') {
    operatingModel = 'Corporate Legal Practice / In-House General Counsel & Commercial Advisory';
    complianceFrameworks = [
      'Legal Profession Uniform Law (Australian Practising Certificate)',
      'Australian Consumer Law (ACL) Competition & Deceptive Conduct',
      'Privacy Act 1988 & Australian Privacy Principles (APPs)',
      'Corporations Act 2001 & Foreign Investment Review Board (FIRB)',
      'Professional Indemnity Insurance & Conflict of Interest Rules'
    ];
    competitors = ['King & Wood Mallesons', 'Herbert Smith Freehills', 'Allens', 'Clayton Utz', 'Ashurst', 'Gilbert + Tobin'];
    execLeadership = [
      { role: 'General Counsel / Managing Partner', focus: 'Enterprise legal risk appetite, board advisory, and outside counsel spend' },
      { role: 'Special Counsel / Practice Group Leader', focus: 'Deal velocity, matter management, and negotiation defense' },
      { role: 'Head of Regulatory & Risk', focus: 'Statutory compliance, privacy governance, and litigation exposure' }
    ];
    whyFunded = `Approved to protect commercial deal velocity, remediate contract exposure, and deliver pragmatic regulatory risk mitigation across ${location}.`;
    challenges = [
      'Balancing commercial deal velocity with watertight limitation of liability and indemnity clauses.',
      'Navigating rapidly evolving regulatory reforms across privacy, cybersecurity, and consumer law.',
      'Eliminating contract review bottlenecks that slow revenue generation.',
      'Managing outside counsel spend and establishing automated precedent templates.'
    ];
    reverseQ = [
      'How does the legal function strike the balance between risk mitigation and commercial transaction velocity?',
      'What are the top three regulatory or legislative reforms currently impacting the organization\'s risk profile?',
      'What contract lifecycle management (CLM) or legal tech tools are utilized to manage workflow volume?',
      'How directly does this role interact with executive business unit leaders and the board?',
      'What would prompt the General Counsel to consider this appointment an exceptional success in the first quarter?'
    ];
    planP1Actions = [
      'Conduct comprehensive audit of active commercial contract registers, NDAs, and standard customer agreements.',
      'Interview department heads (sales, procurement, product) to map common legal friction points.',
      'Review standard terms of business, indemnities, liability caps, and insurance requirements.',
      'Audit external law firm panel arrangements and current billing rates.'
    ];
    planP1Deliverables = ['Contract Risk & Bottleneck Audit', 'Commercial Stakeholder Engagement Blueprint'];
    planP2Actions = [
      'Develop an operational Contract Playbook establishing standard fallback negotiation positions.',
      'Institute a self-service NDA and standard agreement mechanism to free up specialized legal capacity.',
      'Provide commercial training to procurement and commercial teams on key legal risk clauses.'
    ];
    planP2Deliverables = ['Negotiation Playbook & Clause Library', 'Self-Service Contract Workflow Protocol'];
    planP3Actions = [
      'Achieve a 30% reduction in average contract turnaround time for standard commercial agreements.',
      'Deliver executive briefing paper on upcoming statutory compliance changes.',
      'Conduct structured annual legal risk review for senior leadership.'
    ];
    planP3Metrics = ['30%+ faster contract review turnaround', 'Zero unapproved uncapped indemnity exposures'];

  } else {
    // Technology
    operatingModel = 'Cloud Platform Engineering / Enterprise SaaS & Infrastructure Operations';
    complianceFrameworks = [
      'ASD Essential 8 / Essential Eight Cybersecurity Mitigation Strategies',
      'ISO 27001 / ISO/IEC 27001 Information Security Management',
      'SOC 2 Type II Operational Trust Principles',
      'AWS / Azure Well-Architected Framework',
      'ITIL 4 Service Management & Incident Response'
    ];
    competitors = ['Atlassian', 'Canva', 'Amazon Web Services', 'Microsoft Australia', 'Google Cloud', 'Xero'];
    execLeadership = [
      { role: 'Chief Technology Officer (CTO) / VP of Engineering', focus: 'Platform vision, system reliability, and engineering throughput' },
      { role: 'Head of Infrastructure / Platform Engineering Director', focus: 'Cloud spend optimization, zero-trust security, and CI/CD velocity' },
      { role: 'Lead Architect / Principal Engineer', focus: 'System decoupling, tech debt reduction, and architecture governance' }
    ];
    whyFunded = `Approved to scale platform infrastructure, eradicate deployment bottlenecks, and bolster ASD Essential 8 security resiliency across ${location}.`;
    challenges = [
      'Managing architectural complexity and reducing legacy technical debt across microservices.',
      'Upholding high-availability 99.99% SLAs while increasing deployment frequency.',
      'Hardening cloud environments against evolving cyber threats without throttling developer speed.',
      'Optimizing cloud infrastructure spend (FinOps) across AWS/Azure compute and storage footprints.'
    ];
    reverseQ = [
      'What is the single biggest architectural challenge or technical debt bottleneck facing the engineering team today?',
      'How does engineering leadership balance feature delivery velocity against platform reliability and security?',
      'What are the target deployment frequency and MTTR (Mean Time to Resolution) goals for this year?',
      'How is the team navigating multi-cloud or hybrid infrastructure governance under ASD Essential 8?',
      'What specific milestone or deliverable would indicate this hire is excelling by the end of the 90-day mark?'
    ];
    planP1Actions = [
      'Audit cloud infrastructure architecture, Kubernetes manifests, and CI/CD deployment pipelines.',
      'Meet engineering managers, product leads, and security team to map operational pain points.',
      'Inspect telemetry dashboards, incident logs, and SLA breach reports from the past 6 months.',
      'Review access controls, secret management practices, and ASD Essential 8 maturity levels.'
    ];
    planP1Deliverables = ['Platform Architecture & Security Baseline Audit', 'Infrastructure Friction Map'];
    planP2Actions = [
      'Implement high-impact CI/CD pipeline optimizations to reduce build/deploy cycle latency.',
      'Remediate top 3 security vulnerability clusters in container images and cloud IAM roles.',
      'Standardize infrastructure-as-code (Terraform/Bicep) templates to enforce consistency.'
    ];
    planP2Deliverables = ['Optimized Automated Deployment Pipeline', 'Zero-Drift IaC Template Repository'];
    planP3Actions = [
      'Lead architectural review for upcoming multi-quarter platform scaling initiative.',
      'Roll out automated compliance guardrails preventing unencrypted or misconfigured resources.',
      'Deliver an executive briefing on reliability gains and cloud cost optimization achievements.'
    ];
    planP3Metrics = ['99.95%+ platform SLA availability', 'Deployment cycle time reduced by 25%+'];
  }

  const first90Days = {
    days_1_30: {
      phase: 'Days 1–30: Listen, Audit & Align',
      focus: `Immerse in ${companyName}'s operating model, audit baseline workflows, and establish high-trust stakeholder relationships.`,
      key_actions: planP1Actions,
      deliverables: planP1Deliverables,
      success_metrics: ['100% critical stakeholder interviews completed', 'Comprehensive baseline audit published']
    },
    days_31_60: {
      phase: 'Days 31–60: Optimize & Deliver Quick Wins',
      focus: 'Address acute friction points, execute measurable high-impact quick wins, and stabilize primary delivery pipelines.',
      key_actions: planP2Actions,
      deliverables: planP2Deliverables,
      success_metrics: ['First production quick win deployed', 'Standardized operational checklist adopted']
    },
    days_61_90: {
      phase: 'Days 61–90: Scale, Institutionalize & Measure ROI',
      focus: 'Transition from tactical optimization to strategic scaling, embed permanent quality controls, and present tangible ROI to executive leadership.',
      key_actions: planP3Actions,
      deliverables: ['Quarterly Strategic Performance Review', 'Long-Term Capability Roadmap'],
      success_metrics: planP3Metrics
    }
  };

  const diligenceFlags = [
    `Probe historical turnover in this position: determine if ${companyName} is replacing an outgoing specialist or creating a net-new capability.`,
    `Inspect budget and headcount stability: clarify whether this team has secured dedicated multi-year capital funding.`,
    `Clarify decision velocity: verify whether technical/operational decisions require prolonged committee consensus.`,
    `Assess process/technical debt: explore how much working time will be allocated to maintenance vs high-value innovation.`
  ];

  return {
    company_name: companyName,
    target_role: targetRole,
    sector,
    enterprise_scale: enterpriseScale,
    scale_meta: scaleMeta,
    location,
    candidate_context: {
      name: candidateName,
      skills_leveraged: candidateSkills.slice(0, 5)
    },
    organization_profile: {
      operating_model: operatingModel,
      enterprise_scale_label: scaleMeta.label,
      headcount_bracket: scaleMeta.headcount,
      compliance_frameworks: complianceFrameworks,
      competitors,
      governance_style: scaleMeta.governance_style
    },
    leadership_stakeholders: {
      key_executives: execLeadership,
      reporting_hierarchy: `Reports into ${execLeadership[1]?.role || 'Director'} with dotted-line escalation to ${execLeadership[0]?.role || 'Executive'}.`,
      hiring_manager_mandate: `Mandate: Deliver measurable stability, accelerate team output, and mitigate compliance risks across ${companyName}.`,
      stakeholder_pressures: challenges[0] || 'Operational delivery pressure'
    },
    strategic_pain_points: {
      why_role_was_funded: whyFunded,
      core_challenges: challenges,
      strategic_opportunities: [
        `Establish ${companyName} as a benchmark for operational excellence in ${sector.charAt(0).toUpperCase() + sector.slice(1)}.`,
        'Champion modern tooling and automation to minimize manual overhead.',
        'Foster cross-functional collaboration between delivery teams and executive leadership.'
      ]
    },
    first_90_days: first90Days,
    reverse_interview_questions: reverseQ,
    risk_and_cultural_audit: {
      diligence_flags: diligenceFlags,
      debt_risk_assessment: 'Moderate: Legacy workflows exist; leadership is actively funding headcount to modernize.',
      budget_stability: 'High: Critical operational function tied directly to organizational delivery.'
    }
  };
};

export const fetchExecutiveDossier = async (job, profile = null) => {
  const apiBase = getApiBase();
  try {
    const res = await fetch(`${apiBase}/api/dossier/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job,
        profile: profile || getActiveProfile()
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.dossier) return data.dossier;
    }
  } catch (err) {
    console.warn('Backend executive dossier fetch error, using client-side engine:', err);
  }
  return generateExecutiveDossier(job, profile);
};

export const exportDossierToMarkdown = (dossier) => {
  if (!dossier) return '';

  const company = dossier.company_name || 'Target Organization';
  const role = dossier.target_role || 'Target Role';
  const scaleLabel = dossier.scale_meta?.label || 'Enterprise';
  const sector = (dossier.sector || 'General').toUpperCase();
  const location = dossier.location || 'Australia';

  const org = dossier.organization_profile || {};
  const lead = dossier.leadership_stakeholders || {};
  const pain = dossier.strategic_pain_points || {};
  const plan = dossier.first_90_days || {};
  const questions = dossier.reverse_interview_questions || [];
  const audit = dossier.risk_and_cultural_audit || {};

  const lines = [
    `# Executive Briefing Dossier: ${company}`,
    `**Target Role**: ${role} | **Sector**: ${sector} | **Enterprise Scale**: ${scaleLabel}`,
    `**Location**: ${location} | **Operating Model**: ${org.operating_model || 'N/A'}`,
    '',
    '---',
    '',
    '## 1. Executive Summary & Organizational Profile',
    `- **Enterprise Footprint**: ${org.headcount_bracket || 'Enterprise'}`,
    `- **Governance Style**: ${org.governance_style || 'Formal Oversight'}`,
    `- **Key Competitors**: ${(org.competitors || []).join(', ')}`,
    '',
    '### Regulatory & Compliance Frameworks',
    ...(org.compliance_frameworks || []).map(f => `- ${f}`),
    '',
    '---',
    '',
    '## 2. Strategic Pain Points: Why This Role Was Funded',
    `> ${pain.why_role_was_funded || ''}`,
    '',
    '### Acute Core Challenges',
    ...(pain.core_challenges || []).map((ch, idx) => `${idx + 1}. ${ch}`),
    '',
    '---',
    '',
    '## 3. Leadership & Stakeholder Alignment',
    `**Target Reporting Hierarchy**: ${lead.reporting_hierarchy || ''}`,
    '',
    '### Key Executive Decision Makers',
    ...(lead.key_executives || []).map(ex => `- **${ex.role}**: ${ex.focus}`),
    '',
    '---',
    '',
    '## 4. First 90 Days Strategic Execution Blueprint'
  ];

  [
    ['days_1_30', 'Days 1–30: Listen, Audit & Align'],
    ['days_31_60', 'Days 31–60: Optimize & Deliver Quick Wins'],
    ['days_61_90', 'Days 61–90: Scale, Institutionalize & Measure ROI']
  ].forEach(([key, titlePrefix]) => {
    const phaseData = plan[key] || {};
    lines.push(
      '',
      `### ${titlePrefix}`,
      `*${phaseData.focus || ''}*`,
      '',
      '**Key Actions**:',
      ...(phaseData.key_actions || []).map(a => `- ${a}`),
      '',
      '**Deliverables & Milestones**:',
      ...(phaseData.deliverables || []).map(d => `- [x] ${d}`)
    );
  });

  lines.push(
    '',
    '---',
    '',
    '## 5. Executive Reverse Interview Questions',
    '*Ask these high-stakes strategic questions during final-round panel and C-suite interviews:*',
    '',
    ...questions.map((q, i) => `${i + 1}. "${q}"`),
    '',
    '---',
    '',
    '## 6. Due Diligence & Risk Signals',
    ...(audit.diligence_flags || []).map(f => `- ⚠️ ${f}`)
  );

  return lines.join('\n');
};

export const copyDossierToClipboard = async (dossier) => {
  const markdown = exportDossierToMarkdown(dossier);
  if (!markdown) return false;
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(markdown);
    return true;
  }
  return false;
};

