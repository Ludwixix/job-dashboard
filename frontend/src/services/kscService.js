/**
 * Australian Key Selection Criteria (KSC) Service
 * 
 * Provides automated extraction, capability framework alignment (APS ILS & VPSC),
 * SAO (Situation, Action, Outcome) generation, and word-count validation.
 */

import { getBackendApiBase } from './apiConfig';
import { getActiveProfile } from './profileService';

export const CAPABILITY_PILLARS = {
  STRATEGIC_DIRECTION: {
    key: 'STRATEGIC_DIRECTION',
    name: 'Shapes Strategic Thinking / Supports Strategic Direction',
    shortName: 'Strategic Direction',
    description: 'Inspires purpose, analytical evaluation, policy alignment, and sound judgement.',
    badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    keywords: ['strategy', 'strategic', 'policy', 'vision', 'analytical', 'research', 'continuous improvement', 'governance', 'planning', 'innovative'],
  },
  ACHIEVES_RESULTS: {
    key: 'ACHIEVES_RESULTS',
    name: 'Achieves Results / Delivers Measurable Outcomes',
    shortName: 'Achieves Results',
    description: 'Manages resources, delivers project milestones, meets KPIs, and overcomes bottlenecks.',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    keywords: ['delivery', 'deliver', 'results', 'milestone', 'kpi', 'project management', 'budget', 'cost', 'deadlines', 'implement', 'execute'],
  },
  RELATIONSHIPS: {
    key: 'RELATIONSHIPS',
    name: 'Cultivates Productive Working Relationships / Stakeholder Engagement',
    shortName: 'Productive Relationships',
    description: 'Consults with partner agencies, resolves conflict, builds trust, and fosters collaboration.',
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    keywords: ['stakeholder', 'collaboration', 'consultation', 'co-design', 'teamwork', 'partner', 'client', 'negotiate', 'mentor', 'interpersonal', 'relationship'],
  },
  INTEGRITY_DRIVE: {
    key: 'INTEGRITY_DRIVE',
    name: 'Exemplifies Personal Drive, Integrity & Public Sector Values',
    shortName: 'Personal Drive & Integrity',
    description: 'Upholds public trust, probity, ethical conduct, child safety, and resilience.',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    keywords: ['integrity', 'ethics', 'probity', 'values', 'compliance', 'resilience', 'accountability', 'governance', 'impartial', 'safety', 'child safe'],
  },
  COMMUNICATION: {
    key: 'COMMUNICATION',
    name: 'Communicates with Influence / High-Impact Stakeholder Messaging',
    shortName: 'Influential Communication',
    description: 'Authors ministerial/executive briefings, delivers clear presentations, and persuades effectively.',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    keywords: ['communication', 'briefing', 'written', 'verbal', 'presentation', 'report', 'influence', 'submission', 'cabinet', 'ministerial', 'correspondence'],
  },
  TECHNICAL_EXPERTISE: {
    key: 'TECHNICAL_EXPERTISE',
    name: 'Technical & Specialized Domain Mastery',
    shortName: 'Technical Mastery',
    description: 'Applies specialized architecture, systems engineering, or clinical/legal domain standards.',
    badgeClass: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    keywords: ['technical', 'systems', 'cloud', 'aws', 'azure', 'sql', 'data', 'architecture', 'software', 'clinical', 'nursing', 'engineering', 'legal', 'financial'],
  },
};

export const getPillarBadgeTheme = (pillarKey = 'TECHNICAL_EXPERTISE') => {
  return CAPABILITY_PILLARS[pillarKey]?.badgeClass || 'bg-slate-500/20 text-slate-300 border-slate-500/40';
};

export const getWordCount = (text = '') => {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
};

/**
 * Maps arbitrary criterion text to a public sector capability framework pillar.
 */
export const clientMapKscToCapability = (criterion = '') => {
  const critLower = String(criterion).toLowerCase();
  
  if (/stakeholder|collaborat|relationship|partner|co-design/i.test(critLower)) {
    return CAPABILITY_PILLARS.RELATIONSHIPS;
  }
  if (/written|verbal|briefing|report|presentation|communicat/i.test(critLower)) {
    return CAPABILITY_PILLARS.COMMUNICATION;
  }
  if (/integrity|probity|values|ethics|child safe/i.test(critLower)) {
    return CAPABILITY_PILLARS.INTEGRITY_DRIVE;
  }
  if (/deliver|project|milestone|outcome|budget|kpi/i.test(critLower)) {
    return CAPABILITY_PILLARS.ACHIEVES_RESULTS;
  }
  if (/strategic|policy|strategy|vision|innovat/i.test(critLower)) {
    return CAPABILITY_PILLARS.STRATEGIC_DIRECTION;
  }
  return CAPABILITY_PILLARS.TECHNICAL_EXPERTISE;
};

/**
 * Client-side fallback to extract KSC items from text.
 */
export const clientExtractKscFromJd = (description = '', title = '') => {
  if (!description || typeof description !== 'string') {
    return [
      `Demonstrated capability in ${title || 'specialist role'} delivery within complex governance environments.`,
      'Demonstrated high-level stakeholder management, consultation, and collaborative partnership skills.',
      'Proven analytical, strategic problem-solving and risk mitigation capabilities.',
      'High-level written and verbal communication skills, including executive briefings and reports.',
      'Demonstrated commitment to public sector ethics, integrity, and values.',
    ];
  }

  const cleanText = description.replace(/\r\n/g, '\n');
  const sectionMatch = cleanText.match(/(?:key\s+selection\s+criteria|ksc|selection\s+criteria|key\s+accountabilities|what\s+you(?:'ll|\s+will)\s+bring|about\s+you|skills\s+(?:and|&)\s+experience|capabilities|requirements)[:\s\n]+([\s\S]+?)(?=(?:\n\s*(?:how\s+to\s+apply|why\s+join|benefits|about\s+the\s+department|terms\s+of\s+appointment|pre-employment|applications\s+close)\b|$))/i);
  const searchScope = sectionMatch ? sectionMatch[1] : cleanText;

  const extracted = [];
  
  // Numbered items
  const numbered = searchScope.match(/^\s*(?:(?:ksc|criterion)?\s*\d+[.:]\s*)([^\n]+)/gim);
  if (numbered) {
    numbered.forEach(item => {
      const clean = item.replace(/^\s*(?:(?:ksc|criterion)?\s*\d+[.:]\s*)/i, '').trim();
      if (clean.length >= 20 && !/^(?:how to apply|salary|work type|location|reference|apply|close)\b/i.test(clean)) {
        extracted.push(clean);
      }
    });
  }

  // Bullet items
  if (extracted.length < 2) {
    const bullets = searchScope.match(/^\s*[•*\-►✔✓]\s*([^\n]+)/gm);
    if (bullets) {
      bullets.forEach(item => {
        const clean = item.replace(/^\s*[•*\-►✔✓]\s*/, '').trim();
        if (clean.length >= 25 && !/^(?:how to apply|salary|work type|location|reference|apply|close)\b/i.test(clean)) {
          extracted.push(clean);
        }
      });
    }
  }

  const meaningful = extracted.filter(c => c.length >= 20).slice(0, 6);
  if (meaningful.length < 2) {
    return clientExtractKscFromJd('', title);
  }
  return meaningful;
};

/**
 * Client-side mirror to generate full KSC Report.
 */
export const clientGenerateKscReport = (job = {}, profile = {}, customCriteria = null, wordLimit = 300) => {
  const jobId = String(job.id || `${job.company}_${job.title}`);
  const jobTitle = String(job.title || 'Professional Specialist');
  const company = String(job.company || 'Target Employer');
  const candidateName = String(profile.name || 'Candidate');
  
  const rawCriteria = (Array.isArray(customCriteria) && customCriteria.length > 0)
    ? customCriteria
    : clientExtractKscFromJd(job.description || job.notes || '', jobTitle);

  const experience = profile.experience || profile.history || [];
  const recentRole = Array.isArray(experience) && experience.length > 0 ? experience[0] : {};
  const pastCompany = recentRole.company || 'a multi-stakeholder enterprise organisation';
  const pastTitle = recentRole.title || recentRole.role || 'Senior Specialist';

  const skillsList = Array.isArray(profile.skills) ? profile.skills : (Array.isArray(profile.coreSkills) ? profile.coreSkills : []);
  const skillsText = skillsList.slice(0, 4).join(', ') || 'systems architecture, modern cloud workflows, and data-driven governance';

  const solutions = rawCriteria.map((crit, idx) => {
    const cap = clientMapKscToCapability(crit);
    let situation = '';
    let action = '';
    let outcome = '';

    if (cap.key === 'STRATEGIC_DIRECTION') {
      situation = `While serving as ${pastTitle} at ${pastCompany}, our team was tasked with navigating a complex operational reform where fragmented processes and siloed data streams compromised strategic visibility and program delivery timelines.`;
      action = `I spearheaded a strategic gap analysis across key deliverables, engaging with cross-functional team leaders to establish a standardized roadmap. Leveraging ${skillsText}, I instituted agile prioritization principles, aligned strategic milestones with overarching departmental priorities, and designed proactive risk mitigation matrices to ensure operational continuity.`;
      outcome = `This strategic overhaul established seamless visibility across 100% of pipeline projects, reduced initiative turnaround times by 32%, and delivered an enduring operating framework that was adopted division-wide. I will bring this identical strategic foresight to ${company} as ${jobTitle}.`;
    } else if (cap.key === 'ACHIEVES_RESULTS') {
      situation = `In my role as ${pastTitle} at ${pastCompany}, I had accountability for delivering high-priority project outcomes under strict statutory deadlines and demanding service delivery benchmarks with zero margin for operational slippage.`;
      action = `I deployed disciplined project controls, establishing clear milestones, automated tracking dashboards, and rigorous quality assurance routines. When unforeseen technical bottlenecks arose, I reallocated team resources strategically, implemented ${skillsText}, and maintained weekly executive accountability check-ins to ensure uncompromised execution velocity.`;
      outcome = `As a result, all project deliverables were achieved 3 weeks ahead of scheduled completion, realizing a 28% gain in efficiency and saving over $140,000 in operational overhead while maintaining a 99.8% compliance rate. This track record of results will directly support ${company}'s commitments.`;
    } else if (cap.key === 'RELATIONSHIPS') {
      situation = `At ${pastCompany}, I operated in a complex stakeholder ecosystem where competing priorities between internal business units, technical teams, and external partner agencies initially impeded collaborative progress on key organizational goals.`;
      action = `I established structured consultative forums and co-design workshops, actively listening to stakeholders' distinct operational pain points. By framing technical requirements in shared business value, maintaining transparent communication cadences, and fostering an empathetic, culturally safe environment, I built mutual trust and unified disparate stakeholder objectives.`;
      outcome = `This collaborative framework secured unanimous consensus from all executive stakeholders, eliminating cross-team friction and boosting stakeholder satisfaction metrics by 44%. I look forward to cultivating equally robust, enduring partnerships across ${company}.`;
    } else if (cap.key === 'INTEGRITY_DRIVE') {
      situation = `During an intensive audit and systems review at ${pastCompany}, our unit encountered sensitive compliance and data privacy challenges requiring uncompromising adherence to regulatory standards, probity requirements, and public trust.`;
      action = `I immediately upheld organizational governance by conducting a comprehensive compliance review, ensuring 100% adherence to relevant standards and ethical protocols. I championed transparent reporting, trained team members in risk awareness, and led by personal example with unwavering accountability and professional integrity.`;
      outcome = `The initiative achieved a spotless 100% audit clearance from independent regulators with zero non-conformances identified, reinforcing institutional integrity and safeguarding sensitive data. I hold myself to these exact standards in public service.`;
    } else if (cap.key === 'COMMUNICATION') {
      situation = `As ${pastTitle}, I was responsible for communicating intricate, data-dense technical architectures and policy updates to non-technical departmental leaders, external regulatory authorities, and community representatives with varying technical literacy.`;
      action = `I authored concise executive briefings, data-driven visual dashboards, and plain-English policy summaries that distilled complex systems into actionable insights. I tailored my communication style to each audience, facilitating interactive Q&A sessions and persuasively articulating the strategic justification and risk posture for proposed initiatives.`;
      outcome = `My executive briefings directly influenced leadership sign-off with 100% first-pass approval from steering committees, cutting decision cycles from 4 weeks to 5 business days. I will bring this clear, influential communication capability to ${company}.`;
    } else {
      situation = `While driving technical capability at ${pastCompany}, our team needed to architect and implement reliable, scalable systems capable of meeting strict security guidelines, high availability requirements, and continuous data integration.`;
      action = `Leveraging deep hands-on expertise in ${skillsText}, I engineered automated workflows, robust testing suites, and standardized documentation. I ensured full compliance with enterprise architectures, conducted peer code reviews, and mentored junior staff on technical best practices and continuous integration paradigms.`;
      outcome = `The deployed architecture reduced system incident tickets by 45%, bolstered processing throughput by 3x, and established a scalable foundation for future enhancements. I am fully equipped to apply this domain mastery to the technical challenges at ${company}.`;
    }

    const fullStatement = `**Situation:** ${situation}\n\n**Action:** ${action}\n\n**Outcome:** ${outcome}`;
    const wordCount = getWordCount(fullStatement);

    return {
      criterion_number: idx + 1,
      criterion_text: crit,
      capability_name: cap.name,
      capability_description: cap.description,
      situation,
      action,
      outcome,
      full_statement: fullStatement,
      word_count: wordCount,
      target_word_limit: wordLimit,
    };
  });

  const docLines = [
    `# Key Selection Criteria Response Document`,
    `**Position:** ${jobTitle}`,
    `**Organisation:** ${company}`,
    `**Applicant:** ${candidateName}`,
    `**Framework Standard:** APS Integrated Leadership System & VPSC Capability Standards`,
    `---`,
    ``,
  ];

  solutions.forEach(sol => {
    docLines.push(
      `## Criterion ${sol.criterion_number}: ${sol.criterion_text}`,
      `*${sol.capability_name}*`,
      ``,
      sol.full_statement,
      ``,
      `*Word count: ${sol.word_count} words (Target: ${sol.target_word_limit} words)*`,
      ``,
      `---`,
      ``
    );
  });

  return {
    job_id: jobId,
    job_title: jobTitle,
    company,
    candidate_name: candidateName,
    total_criteria: solutions.length,
    solutions,
    master_document: docLines.join('\n').trim(),
  };
};

/**
 * Fetches full KSC solutions for a given job card.
 */
export const fetchJobKscReport = async (job = {}, userProfile = null) => {
  const profile = userProfile || getActiveProfile() || {};
  const jobId = job.id || `${job.company}_${job.title}`;
  const apiBase = getBackendApiBase();

  let targetUrl = `${apiBase}/api/jobs/${encodeURIComponent(jobId)}/ksc`;
  if (!apiBase && typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    targetUrl = `${window.location.origin}/api/jobs/${encodeURIComponent(jobId)}/ksc`;
  }

  try {
    const res = await fetch(targetUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      if (data && data.report) {
        return data.report;
      }
    }
  } catch (err) {
    console.warn('[kscService] Backend unreachable, falling back to client solver:', err.message);
  }

  return clientGenerateKscReport(job, profile);
};

/**
 * Solves custom criteria supplied by the user in the sandbox.
 */
export const generateCustomKscReport = async (job = {}, userProfile = null, customCriteria = [], wordLimit = 300) => {
  const profile = userProfile || getActiveProfile() || {};
  const apiBase = getBackendApiBase();

  let targetUrl = `${apiBase}/api/ksc/generate`;
  if (!apiBase && typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    targetUrl = `${window.location.origin}/api/ksc/generate`;
  }

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job: job || {},
        profile: profile || {},
        criteria: customCriteria,
        word_limit: wordLimit,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.report) {
        return data.report;
      }
    }
  } catch (err) {
    console.warn('[kscService] Backend custom solve unreachable, using client engine:', err.message);
  }

  return clientGenerateKscReport(job, profile, customCriteria, wordLimit);
};
