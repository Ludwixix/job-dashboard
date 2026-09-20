/**
 * interviewGuidePrompt.js
 * Domain prompts, STAR interview questions, sector-specific talking points,
 * and high-impact counter-questions for employer interviews.
 */

export const INTERVIEW_SECTOR_DATA = {
  healthcare: {
    questions: [
      {
        type: 'Clinical Acuity & Rapid Response',
        question: 'Describe a clinical situation where a patient deteriorated rapidly under your care. How did you assess, escalate, and stabilize them?',
        answerStrategy: 'Use the STAR format detailing rapid MET call activation, structured ISBAR clinical handover to the medical registrar, and immediate airway/breathing/circulation stabilization per AHPRA & NSQHS protocols.',
        keyMetric: 'Immediate MET activation / 100% vital stabilization'
      },
      {
        type: 'Medication Safety & Clinical Governance',
        question: 'How do you ensure zero medication administration errors and strict NSQHS compliance during high-turnover shift handovers?',
        answerStrategy: 'Detail independent 5-rights double verification, meticulous clinical documentation in electronic medical records (EMR), and adherence to NSQHS Standard 4 (Medication Safety).',
        keyMetric: 'Zero dispensing errors / 100% NSQHS compliance'
      },
      {
        type: 'Patient & Family Advocacy',
        question: 'How do you handle difficult de-escalation with an anxious patient or distressed family members regarding care planning?',
        answerStrategy: 'Highlight compassionate active listening, clear plain-language clinical explanation, de-escalation techniques, and collaborative coordination with senior medical staff.',
        keyMetric: 'Proven patient advocacy & compassionate resolution'
      },
      {
        type: 'Multidisciplinary Coordination',
        question: 'Give an example of collaborating with allied health, medical officers, and discharge coordinators to navigate a complex patient discharge.',
        answerStrategy: 'Discuss liaising across multidisciplinary specialists to ensure post-acute community support, comprehensive discharge summaries, and minimizing readmission risk.',
        keyMetric: 'On-schedule discharge / zero preventable readmission'
      }
    ],
    defaultTalkingPoints: [
      'AHPRA Registered Nurse with comprehensive clinical experience across acute and community settings',
      'Rigorous adherence to NSQHS National Safety and Quality Health Service Standards',
      'Proficient in electronic health record (EMR/eMR) clinical documentation and ISBAR handover',
      'Advanced clinical assessment, patient advocacy, and emergency MET call escalation protocols',
      'Unrestricted Australian work rights, complete immunisation compliance, and valid WWCC/police check'
    ],
    recommendedQuestionsToAsk: [
      'What is the standard nurse-to-patient staffing ratio across shifts on this ward?',
      'Which electronic medical record (EMR) platform and clinical handover workflow does the unit currently utilise?',
      'What continuing professional development and clinical specialization pathways does the organization support?'
    ]
  },
  finance: {
    questions: [
      {
        type: 'Statutory Close & AASB / IFRS Compliance',
        question: 'Walk through your methodology for managing a high-pressure month-end or year-end financial close while ensuring strict AASB / IFRS compliance.',
        answerStrategy: 'Detail balance sheet reconciliations, variance analysis, accruals, and internal audit compliance under Australian Accounting Standards Board (AASB) frameworks.',
        keyMetric: '100% on-time month-end close / clean audit opinion'
      },
      {
        type: 'Variance Analysis & Operational Margin',
        question: 'Describe a situation where you identified a significant budget-to-actual expenditure variance and partnered with department heads to resolve it.',
        answerStrategy: 'Explain conducting deep-dive ledger variance analysis, isolating root causes in operational spend, and establishing corrective forecast models that preserved departmental margins.',
        keyMetric: 'Identified 12%+ budget variance / protected margin'
      },
      {
        type: 'ERP Systems & Process Automation',
        question: 'How have you utilized ERP platforms (SAP, Xero, MYOB) or spreadsheet automation to eliminate manual reconciliation errors?',
        answerStrategy: 'Discuss authoring automated reconciliations, streamlining general ledger postings, and integrating sub-ledger data to cut reporting turnaround cycles.',
        keyMetric: 'Cut reconciliation cycle time by 40%+'
      },
      {
        type: 'Executive Financial Communication',
        question: 'How do you present complex financial models and P&L results to non-financial executives to guide commercial strategy?',
        answerStrategy: 'Highlight converting complex financial statements into high-level dashboard summaries with clear commercial risk-benefit trade-offs.',
        keyMetric: 'Executive consensus on strategic annual budget'
      }
    ],
    defaultTalkingPoints: [
      'CPA / CA qualified financial specialist with proven track record in end-to-end statutory reporting',
      'Deep expertise in AASB / IFRS standards, ATO compliance, and Australian Business Activity Statements (BAS)',
      'Proficient across enterprise ERP systems (SAP, Xero, MYOB) and advanced financial modeling',
      'Demonstrated capability managing multi-million-dollar ledger reconciliations and clean internal audits'
    ],
    recommendedQuestionsToAsk: [
      "What does the company's financial systems and automation roadmap look like over the next 12 months?",
      'How are budget variance reviews structured between finance and operational business units?',
      'What are the primary strategic objectives for the finance team heading into the upcoming fiscal year?'
    ]
  },
  trades: {
    questions: [
      {
        type: 'WHS Safety & SWMS Hazard Intervention',
        question: 'Describe a situation on an active worksite where you identified a high-risk safety violation or SWMS non-compliance. How did you intervene?',
        answerStrategy: "Detail issuing an immediate stop-work directive, reviewing the subcontractor's Safe Work Method Statement (SWMS), and conducting a mandatory pre-start safety briefing.",
        keyMetric: 'Zero lost-time injuries (LTI) across project lifecycle'
      },
      {
        type: 'Critical Path & Weather Delay Recovery',
        question: 'How do you manage critical path delays caused by inclement weather or material supply chain bottlenecks to maintain handover milestones?',
        answerStrategy: 'Discuss resequencing concurrent trade packages, adjusting site working hours safely, and communicating milestone adjustments with client project managers.',
        keyMetric: 'Recovered 2-week weather delay to achieve on-time handover'
      },
      {
        type: 'Pre-Handover QA & Defect Rectification',
        question: 'Walk through your process for conducting pre-handover quality inspections and enforcing subcontractor defect rectification.',
        answerStrategy: 'Explain utilizing digital defect tracking platforms (Procore / PlanGrid) to enforce sign-offs and ensure zero outstanding defect notices at Practical Completion.',
        keyMetric: '100% defect-free handover at Practical Completion'
      },
      {
        type: 'Cost Tracking & Variation Control',
        question: 'How do you track site expenditure against bill of quantities and verify progress claims to prevent margin erosion?',
        answerStrategy: 'Describe assessing subcontractor progress claims on-site against actual physical completion and enforcing formal variation approvals before work commences.',
        keyMetric: 'Prevented unauthorized variation scope creep'
      }
    ],
    defaultTalkingPoints: [
      'Licensed site leader with valid CPCCWHS1001 White Card and comprehensive SafeWork WHS governance',
      'Proven track record delivering commercial and residential building packages on time and on budget',
      'Expertise in subcontractor trade sequencing, SWMS reviews, and digital site management platforms',
      'Zero-harm safety culture with exemplary incident-free track record'
    ],
    recommendedQuestionsToAsk: [
      'What digital project and safety management tools (e.g. Procore, HammerTech) are standardized across your sites?',
      'How does the company manage subcontractor pre-qualification and quality assurance benchmarks?',
      'What is the upcoming project pipeline across the next 12 to 24 months?'
    ]
  },
  legal: {
    questions: [
      {
        type: 'Contractual Risk & Indemnity Negotiation',
        question: 'When negotiating high-stakes commercial agreements, how do you handle aggressive indemnity and liability cap pushback from counterparties?',
        answerStrategy: 'Explain risk-based negotiation, structuring mutual liability caps aligned with contract value, and carving out gross negligence and confidentiality breaches.',
        keyMetric: 'Mitigated enterprise liability while closing multi-million contract'
      },
      {
        type: 'Regulatory Compliance & Australian Consumer Law',
        question: 'How do you advise commercial marketing and product teams to ensure new offerings strictly comply with Australian Consumer Law (ACL)?',
        answerStrategy: 'Detail reviewing promotional claims against misleading or deceptive conduct standards (Section 18 ACL) and establishing compliant customer terms.',
        keyMetric: '100% compliance record with zero regulatory notices'
      },
      {
        type: 'Commercial Dispute Resolution',
        question: 'Describe a contentious supplier or customer dispute you resolved without resorting to formal litigation.',
        answerStrategy: 'Detail pre-litigation correspondence, objective contract interpretation, and leading commercial negotiation that preserved business relationships.',
        keyMetric: 'Resolved commercial dispute saving $150k+ in legal costs'
      },
      {
        type: 'Executive Risk Advisory',
        question: 'How do you balance legal risk mitigation with commercial imperatives when business leaders are pressing for rapid deal execution?',
        answerStrategy: 'Discuss presenting executive summaries with red-amber-green risk matrices and commercial alternatives rather than simply saying "no".',
        keyMetric: 'Maintained 48-hour contract review SLA for priority deals'
      }
    ],
    defaultTalkingPoints: [
      'Admitted Legal Practitioner with current Australian Practising Certificate',
      'Extensive experience drafting, negotiating, and risk-profiling complex commercial contracts',
      'Deep knowledge of Australian Consumer Law, Corporations Act, privacy, and regulatory frameworks',
      'Commercially pragmatic legal partner trusted by executive and commercial leadership'
    ],
    recommendedQuestionsToAsk: [
      'How is the legal function integrated into commercial contract workflows and sales approval gates?',
      'What contract lifecycle management (CLM) or legal ops software does the in-house team use?',
      'What is the balance between in-house legal handling versus external counsel panel engagement?'
    ]
  },
  technology: {
    questions: [
      {
        type: 'Technical Challenge & Infrastructure',
        question: 'How would you architect and automate endpoint compliance for distributed or hybrid cloud infrastructure?',
        answerStrategy: 'Highlight multi-cloud migration and automation experience, emphasizing zero downtime, SOE compliance, and security baseline adherence.',
        keyMetric: 'Zero downtime / 100% SOE compliance'
      },
      {
        type: 'Incident / SLA Management',
        question: 'Describe a situation where you had to manage a critical production outage under strict SLA pressure.',
        answerStrategy: 'Use the STAR format detailing root cause analysis (RCA) and preventative automation that permanently eliminated repeat incidents.',
        keyMetric: '99.9% uptime / fast SLA restoration'
      },
      {
        type: 'Process Automation & Optimization',
        question: 'Give an example of how you used scripting or Infrastructure-as-Code to eliminate repetitive operational toil.',
        answerStrategy: 'Reference authoring modular automation scripts cutting processing times and removing human error from provisioning pipelines.',
        keyMetric: '80%+ reduction in manual processing time'
      },
      {
        type: 'Stakeholder & Communication',
        question: 'How do you bridge technical engineering requirements with non-technical business or executive stakeholders?',
        answerStrategy: 'Discuss translating engineering trade-offs into commercial business impact, ensuring business operations run without disruption.',
        keyMetric: 'Seamless stakeholder alignment'
      }
    ],
    defaultTalkingPoints: [
      'Enterprise infrastructure specialist with proven experience in hybrid cloud and automated systems',
      'ACSC Essential 8 & ISO 27001 security compliance operationalization',
      'Extensive automation track record eliminating repetitive toil through scripting and IaC',
      'Australian Citizen with security clearance readiness',
      'Proven ability to maintain 99.9%+ system availability in SLA environments'
    ],
    recommendedQuestionsToAsk: [
      'What does the current IT automation and cloud roadmap look like over the next 12 months?',
      'How does the team currently measure and enforce security maturity and SLA reliability?',
      'What are the primary friction points in your current incident response and L3 escalation workflows?'
    ]
  }
};

/**
 * Detects the sector of a job based on its text and candidate profile text.
 *
 * @param {string} jobText
 * @param {string} profileText
 * @returns {string} sector ('healthcare' | 'trades' | 'finance' | 'legal' | 'technology')
 */
export const detectJobSector = (jobText = '', profileText = '') => {
  const jt = (jobText || '').toLowerCase();
  const pt = (profileText || '').toLowerCase();

  if (/nurs|health|medic|clinic|patient|aged care|hospital|doctor|allied health|physio/i.test(jt)) {
    return 'healthcare';
  } else if (/construct|builder|site supervisor|site manager|carpenter|trade|whs|foreman|estimator|civil/i.test(jt)) {
    return 'trades';
  } else if (/account|cpa|\bca\b|tax|financ|bookkeep|payroll|ledger|audit|treasury/i.test(jt)) {
    return 'finance';
  } else if (/legal|lawyer|counsel|paralegal|solicitor|barrister|litigat/i.test(jt)) {
    return 'legal';
  } else if (/nurs|health|medic|clinic|patient|aged care|hospital|doctor|allied health|physio/i.test(pt)) {
    return 'healthcare';
  } else if (/construct|builder|site supervisor|site manager|carpenter|trade|whs|foreman|estimator|civil/i.test(pt)) {
    return 'trades';
  } else if (/account|cpa|\bca\b|tax|financ|bookkeep|payroll|ledger|audit|treasury/i.test(pt)) {
    return 'finance';
  } else if (/legal|lawyer|counsel|paralegal|solicitor|barrister|litigat/i.test(pt)) {
    return 'legal';
  }
  return 'technology';
};

/**
 * Retrieves sector-specific interview preparation package.
 *
 * @param {string} sector
 * @param {Object} candidateProfile
 * @returns {{questions: Array, talkingPoints: Array, recommendedQuestionsToAsk: Array}}
 */
export const getSectorInterviewPrep = (sector, candidateProfile = {}) => {
  const data = INTERVIEW_SECTOR_DATA[sector] || INTERVIEW_SECTOR_DATA.technology;

  const isSectorMatch = candidateProfile?.industry && (
    (sector === 'healthcare' && /health|nurs|medic/i.test(candidateProfile.industry)) ||
    (sector === 'finance' && /financ|account/i.test(candidateProfile.industry)) ||
    (sector === 'trades' && /trade|construct/i.test(candidateProfile.industry)) ||
    (sector === 'legal' && /legal|law/i.test(candidateProfile.industry)) ||
    (sector === 'technology' && /tech|it|engineer/i.test(candidateProfile.industry))
  );

  const talkingPoints = (isSectorMatch && candidateProfile?.interviewTalkingPoints?.length)
    ? candidateProfile.interviewTalkingPoints
    : data.defaultTalkingPoints;

  return {
    questions: data.questions,
    talkingPoints,
    recommendedQuestionsToAsk: data.recommendedQuestionsToAsk
  };
};

/**
 * Constructs prompt payload for AI interview prep synthesis.
 *
 * @param {Object} job - Target job entity.
 * @param {Object} profile - Candidate profile record.
 * @returns {{systemPrompt: string, userPrompt: string}}
 */
export const buildInterviewGuidePrompts = (job, profile = {}) => {
  const jobTitle = job?.title || 'Target Role';
  const company = job?.company || 'Target Employer';
  const sector = detectJobSector(
    `${job?.title || ''} ${job?.description || ''} ${job?.notes || ''}`,
    `${profile?.industry || ''} ${profile?.title || ''}`
  );
  const prep = getSectorInterviewPrep(sector, profile);

  const systemPrompt = `You are an Executive Interview Coach and Behavioral Assessment Lead.
Generate a structured STAR interview preparation briefing for ${profile?.name || 'the candidate'} targeting ${jobTitle} at ${company}.
Focus on evidence-backed storytelling, quantified metrics, addressing technical friction points, and posing strategic counter-questions.`;

  const userPrompt = `ROLE: ${jobTitle} at ${company}
SECTOR: ${sector}
CANDIDATE: ${profile?.name || 'Candidate'} (${profile?.title || 'Professional'})
VERIFIED TALKING POINTS:
${prep.talkingPoints.map(tp => `- ${tp}`).join('\n')}

Generate:
1. 4 tailored STAR behavioural interview questions with answer strategies and key metrics.
2. Verified talking points aligned with this vacancy.
3. 3 incisive counter-questions to ask the hiring committee.`;

  return { systemPrompt, userPrompt, sector, prep };
};
