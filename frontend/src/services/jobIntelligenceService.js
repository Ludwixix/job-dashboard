/**
 * jobIntelligenceService.js
 * Unified Dynamic AI Intelligence Hub for Job Cards
 * Supports on-demand LLM generation and permanent persistence for the 14 Action Grid tools.
 */

import { getLlmConfig } from './llmConfig';
import { recordLlmUsage, estimateActionCost } from './llmCostService';
import { getActiveProfile } from './profileService';
import { getBackendApiBase } from './apiConfig';

export const ACTION_TOOLS = {
  RECRUITER_CRM: {
    key: 'recruiter_crm',
    label: 'RECRUITER CRM',
    shortDesc: 'Link talent partners & manage cadence.',
    category: 'Relationship',
    color: 'purple',
    badgeVariant: 'purple'
  },
  EXECUTIVE_DOSSIER: {
    key: 'executive_dossier',
    label: 'EXECUTIVE DOSSIER',
    shortDesc: '90-day plan, leadership alignment & pain points.',
    category: 'Executive',
    color: 'teal',
    badgeVariant: 'teal'
  },
  INFLUENCE_DEBRIEF: {
    key: 'influence_debrief',
    label: 'INFLUENCE & DEBRIEF',
    shortDesc: 'Objection overcoming & referee briefing.',
    category: 'Interview',
    color: 'amber',
    badgeVariant: 'amber'
  },
  ATS_SENTINEL: {
    key: 'ats_sentinel',
    label: 'ATS SENTINEL',
    shortDesc: 'Workday & STAR parser simulation.',
    category: 'Compliance',
    color: 'emerald',
    badgeVariant: 'emerald'
  },
  LINKEDIN_INBOUND: {
    key: 'linkedin_inbound',
    label: 'LINKEDIN INBOUND',
    shortDesc: 'Recruiter Boolean indexing & headlines.',
    category: 'Optimization',
    color: 'amber',
    badgeVariant: 'amber'
  },
  CL_POLARIZER: {
    key: 'cl_polarizer',
    label: 'CL POLARIZER',
    shortDesc: 'Swappability audit & anti-template rewrites.',
    category: 'Application',
    color: 'rose',
    badgeVariant: 'rose'
  },
  SCREENING_SOLVER: {
    key: 'screening_solver',
    label: 'SCREENING SOLVER',
    shortDesc: 'Auto-solve portal questionnaires & compliance.',
    category: 'Application',
    color: 'teal',
    badgeVariant: 'teal'
  },
  CAREER_COMPASS: {
    key: 'career_compass',
    label: 'CAREER COMPASS',
    shortDesc: 'Strategic matrix & progression roadmap.',
    category: 'Strategy',
    color: 'amber',
    badgeVariant: 'amber'
  },
  KSC_GENERATOR: {
    key: 'ksc_generator',
    label: 'KSC GENERATOR',
    shortDesc: 'APS & VPS capability criteria responses.',
    category: 'Public Sector',
    color: 'teal',
    badgeVariant: 'teal'
  },
  SEEK_PASS_AUDIT: {
    key: 'seek_pass_audit',
    label: 'SEEK PASS AUDIT',
    shortDesc: 'Pre-qualification knockout radar.',
    category: 'Compliance',
    color: 'emerald',
    badgeVariant: 'emerald'
  },
  MASTER_CHEAT_SHEET: {
    key: 'master_cheat_sheet',
    label: 'MASTER CHEAT SHEET',
    shortDesc: '3-column cockpit with 90s pacing timer.',
    category: 'Interview',
    color: 'cyan',
    badgeVariant: 'cyan'
  },
  STAR_PREP_GUIDE: {
    key: 'star_prep_guide',
    label: 'STAR PREP GUIDE',
    shortDesc: 'Sector-grounded question strategy & talking points.',
    category: 'Interview',
    color: 'amber',
    badgeVariant: 'amber'
  },
  AI_MOCK_INTERVIEW: {
    key: 'ai_mock_interview',
    label: 'AI MOCK INTERVIEW',
    shortDesc: 'Live simulated interview with rubric scoring.',
    category: 'Interview',
    color: 'amber',
    badgeVariant: 'amber'
  },
  RECRUITER_OUTREACH: {
    key: 'recruiter_outreach',
    label: 'RECRUITER OUTREACH',
    shortDesc: 'Follow-up, cold pitch, or post-interview notes.',
    category: 'Outreach',
    color: 'teal',
    badgeVariant: 'teal'
  }
};

/**
 * Check if a specific intelligence artifact has already been generated and saved for this job
 */
export const hasJobIntelligence = (job, toolKey) => {
  if (!job || !toolKey) return false;
  
  // 1. Check in job.intelligence map
  if (job.intelligence && job.intelligence[toolKey]) {
    return true;
  }

  // 2. Check direct legacy keys on job object
  if (toolKey === 'executive_dossier' && (job.executiveDossier || job.dossier)) return true;
  if (toolKey === 'influence_debrief' && (job.influenceDebrief || job.influenceData)) return true;
  if (toolKey === 'ats_sentinel' && (job.atsDiagnostic || job.atsScoreData)) return true;
  if (toolKey === 'linkedin_inbound' && job.linkedinInbound) return true;
  if (toolKey === 'cl_polarizer' && (job.polarizedCoverLetter || job.clPolarizer)) return true;
  if (toolKey === 'screening_solver' && job.screeningSolver) return true;
  if (toolKey === 'career_compass' && job.careerCompass) return true;
  if (toolKey === 'ksc_generator' && (job.kscResponses || job.kscSolutions)) return true;
  if (toolKey === 'seek_pass_audit' && job.seekPassAudit) return true;
  if (toolKey === 'master_cheat_sheet' && job.masterCheatSheet) return true;
  if (toolKey === 'star_prep_guide' && job.starPrepGuide) return true;
  if (toolKey === 'ai_mock_interview' && (job.mockInterviewHistory || job.mockInterviewFeedback)) return true;
  if (toolKey === 'recruiter_outreach' && (job.outreachEmail || job.followUpEmail)) return true;
  if (toolKey === 'recruiter_crm' && job.recruiterCrm) return true;

  // 3. Check browser localStorage fallback
  if (typeof window !== 'undefined') {
    const jId = job.id || `${job.company}_${job.title}`;
    const localKey = `job_intel_${jId}_${toolKey}`;
    try {
      if (localStorage.getItem(localKey)) return true;
    } catch {}
  }

  return false;
};

/**
 * Retrieve saved intelligence artifact
 */
export const getJobIntelligence = (job, toolKey) => {
  if (!job || !toolKey) return null;

  if (job.intelligence && job.intelligence[toolKey]) {
    return job.intelligence[toolKey];
  }

  // Legacy direct property lookups
  if (toolKey === 'executive_dossier') return job.executiveDossier || job.dossier || null;
  if (toolKey === 'influence_debrief') return job.influenceDebrief || job.influenceData || null;
  if (toolKey === 'ats_sentinel') return job.atsDiagnostic || job.atsScoreData || null;
  if (toolKey === 'linkedin_inbound') return job.linkedinInbound || null;
  if (toolKey === 'cl_polarizer') return job.polarizedCoverLetter || job.clPolarizer || null;
  if (toolKey === 'screening_solver') return job.screeningSolver || null;
  if (toolKey === 'career_compass') return job.careerCompass || null;
  if (toolKey === 'ksc_generator') return job.kscResponses || job.kscSolutions || null;
  if (toolKey === 'seek_pass_audit') return job.seekPassAudit || null;
  if (toolKey === 'master_cheat_sheet') return job.masterCheatSheet || null;
  if (toolKey === 'star_prep_guide') return job.starPrepGuide || null;
  if (toolKey === 'ai_mock_interview') return job.mockInterviewHistory || job.mockInterviewFeedback || null;
  if (toolKey === 'recruiter_outreach') return job.outreachEmail || job.followUpEmail || null;
  if (toolKey === 'recruiter_crm') return job.recruiterCrm || null;

  if (typeof window !== 'undefined') {
    const jId = job.id || `${job.company}_${job.title}`;
    const localKey = `job_intel_${jId}_${toolKey}`;
    try {
      const raw = localStorage.getItem(localKey);
      if (raw) return JSON.parse(raw);
    } catch {}
  }

  return null;
};

/**
 * Permanently save an intelligence artifact to the job card (Memory + LocalStorage + Backend SQLite)
 */
export const saveJobIntelligence = async (job, toolKey, data, onUpdateJob) => {
  if (!job || !toolKey) return false;

  const jobId = job.id || `${job.company}_${job.title}`;
  const timestamp = new Date().toISOString();
  const enrichedData = {
    ...data,
    savedAt: timestamp,
    toolKey
  };

  // 1. Update in-memory job object
  if (!job.intelligence) {
    job.intelligence = {};
  }
  job.intelligence[toolKey] = enrichedData;

  // 2. Persist to browser LocalStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`job_intel_${jobId}_${toolKey}`, JSON.stringify(enrichedData));
    } catch (e) {
      console.warn('LocalStorage save failed for job intelligence:', e);
    }
  }

  // 3. Notify parent app state handler
  if (typeof onUpdateJob === 'function') {
    onUpdateJob(jobId, job.status || 'Discovered', {
      intelligence: job.intelligence,
      [toolKey]: enrichedData
    });
  }

  // 4. Sync with Backend SQLite WAL database
  try {
    const apiBase = getBackendApiBase();
    await fetch(`${apiBase}/api/job-intelligence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: jobId,
        tool_key: toolKey,
        data: enrichedData
      })
    });
  } catch (err) {
    console.info('Backend intelligence sync notice:', err);
  }

  return enrichedData;
};

/**
 * Build dynamic, context-dense LLM system & user prompt for each tool
 */
export const buildToolPrompt = (toolKey, job, profile = null) => {
  const p = profile || getActiveProfile() || {};
  const jobTitle = job.title || 'Specialist Role';
  const company = job.company || 'Target Employer';
  const location = job.location || 'Melbourne, VIC';
  const salary = job.salary || 'Competitive / Unspecified';
  const desc = job.description || job.notes || job.snippet || '';

  const commonContext = `CANDIDATE PROFILE:
- Name: ${p.name || 'Candidate'}
- Headline: ${p.headline || p.title || 'Senior Technology Specialist'}
- Target Industry: ${p.industry || 'Information Technology & Cloud'}
- Core Skills: ${(p.coreSkills || []).join(', ') || 'Systems architecture, cloud migration, stakeholder alignment'}
- Key Strengths: ${(p.keyStrengths || []).join('; ') || 'Reliability, high execution velocity, deep technical diagnostics'}

TARGET JOB ADVERTISEMENT:
- Title: ${jobTitle}
- Company: ${company}
- Workplace: ${location} (${job.remote ? 'Remote' : 'On-Site / Hybrid'})
- Salary Package: ${salary}
- Complete Job Ad Specification:
${desc || '(Infer core deliverables from job title and company reputation)'}`;

  switch (toolKey) {
    case 'executive_dossier':
      return {
        system: `You are an elite executive strategy consultant and organizational analyst. Produce a rigorous, highly customized 90-Day Executive Strategic Dossier for this exact position. Return strictly valid JSON matching:
{
  "strategicSummary": "2-3 sentences on the company's core market pressures and why this hire is critical.",
  "first30Days": ["Concrete high-impact milestone 1", "Milestone 2", "Milestone 3"],
  "days31To60": ["Operational milestone 1", "Milestone 2", "Milestone 3"],
  "days61To90": ["Scalability & transformation milestone 1", "Milestone 2", "Milestone 3"],
  "executivePainPoints": ["Unspoken executive risk or headache 1", "Pain point 2"],
  "leadershipPosture": "Specific communication posture and management stance that will establish immediate authority."
}`,
        user: `Generate the Executive Strategic Dossier for ${jobTitle} at ${company}.\n\n${commonContext}`
      };

    case 'influence_debrief':
      return {
        system: `You are a master executive interview tactician and influence strategist. Generate high-conviction objection handling, persuasion talking points, and referee debrief guides. Return strictly valid JSON matching:
{
  "coreObjectionHandling": [
    { "objection": "Anticipated skepticism from hiring panel", "reframing": "Psychologically grounded reframing", "proofPoint": "Concrete candidate achievement or metric" }
  ],
  "psychologicalAnchors": ["Cognitive anchor phrase 1", "Anchor phrase 2", "Anchor phrase 3"],
  "refereeBriefingNotes": ["Key narrative referees should emphasize to validate senior capability", "Referee talking point 2"]
}`,
        user: `Generate Influence & Debrief tactical matrix for ${jobTitle} at ${company}.\n\n${commonContext}`
      };

    case 'ats_sentinel':
      return {
        system: `You are a principal enterprise ATS systems auditor (Workday, Taleo, Greenhouse). Audit the role's keyword density and provide direct ATS scoring breakdown. Return strictly valid JSON:
{
  "atsScore": 92,
  "matchLevel": "High Precision Fit",
  "criticalMissingKeywords": ["keyword 1", "keyword 2"],
  "matchedHighValueKeywords": ["keyword 1", "keyword 2", "keyword 3"],
  "workdayCompatibilityNotes": "Detailed advice on Workday & parsing parser compliance for this role.",
  "recommendedBulletRewrites": [
    { "original": "Generic duty description", "optimized": "High-impact STAR achievement bullet with quantitative metric" }
  ]
}`,
        user: `Perform ATS Sentinel compliance audit for ${jobTitle} at ${company}.\n\n${commonContext}`
      };

    case 'linkedin_inbound':
      return {
        system: `You are an executive talent sourcer. Generate Boolean search strings recruiters will use to find candidates for this role, plus tailored LinkedIn headline and about snippets. Return strictly valid JSON:
{
  "booleanSearchStrings": ["Boolean string 1 (e.g. title AND skills)", "Alternative Boolean string"],
  "optimizedHeadline": "Sharp, punchy 220-char LinkedIn headline aligned to this specific vacancy",
  "aboutSectionSnippet": "3-4 sentence value proposition paragraph to paste into LinkedIn About",
  "featuredSkillTags": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5"]
}`,
        user: `Generate LinkedIn Inbound Optimization for ${jobTitle} at ${company}.\n\n${commonContext}`
      };

    case 'cl_polarizer':
      return {
        system: `You are a world-class executive copywriter. Analyze and polarize the cover letter narrative: eliminate cliches, inject authentic executive conviction, and make it impossible to mistake for a generic template. Return strictly valid JSON:
{
  "swappabilityScore": 12,
  "verdict": "Hyper-Tailored / Anti-Template",
  "unforgivableClichesRemoved": ["cliche 1", "cliche 2"],
  "polarizedOpeningHook": "Electrifying 2-sentence opening hook speaking directly to the hiring manager's current operational bottleneck.",
  "coreProofParagraph": "Dense, factual narrative paragraph connecting candidate's signature methodology to this company's exact technical challenge.",
  "boldClosingCallToAction": "Confident, low-friction closing statement requesting a 15-minute operational briefing."
}`,
        user: `Polarize cover letter positioning for ${jobTitle} at ${company}.\n\n${commonContext}`
      };

    case 'screening_solver':
      return {
        system: `You are an enterprise talent acquisition compliance specialist. Formulate winning, high-conviction answers to common portal screening questions (salary expectations, notice period, technical governance, sponsorship). Return strictly valid JSON:
{
  "screeningAnswers": [
    { "question": "Why are you interested in joining our company in this specific role?", "answer": "Crisp 3-sentence company-specific answer." },
    { "question": "What are your salary expectations?", "answer": "Strategically framed response anchored to market rate and value creation." },
    { "question": "What is your availability / notice period?", "answer": "Professional notice period confirmation." },
    { "question": "Describe your direct experience leading similar initiatives.", "answer": "Grounded STAR achievement answer." }
  ]
}`,
        user: `Generate portal screening questionnaire solutions for ${jobTitle} at ${company}.\n\n${commonContext}`
      };

    case 'ksc_generator':
      return {
        system: `You are a certified Australian Public Sector (APS) and Victorian Public Service (VPS) executive scribe. Formulate comprehensive Key Selection Criteria (KSC) responses adhering strictly to the STAR/SAO framework. Return strictly valid JSON:
{
  "criteriaResponses": [
    {
      "criterion": "Demonstrated capability in technical leadership, operational integrity, and stakeholder communication.",
      "situation": "Specific high-stakes organizational context.",
      "task": "Target outcome and accountability mandated.",
      "action": "Structured methodical actions executed by the candidate.",
      "result": "Measurable, verifiable outcome achieved."
    },
    {
      "criterion": "Ability to lead complex systems migration, governance, and policy compliance.",
      "situation": "High-complexity project scenario.",
      "task": "Mandated governance deliverable.",
      "action": "Multi-tier execution and risk mitigation applied.",
      "result": "On-time delivery and zero-downtime metric."
    }
  ]
}`,
        user: `Generate public sector KSC selection responses for ${jobTitle} at ${company}.\n\n${commonContext}`
      };

    case 'career_compass':
      return {
        system: `You are an executive career architect. Produce a strategic progression compass analyzing how this specific role accelerates long-term career capital, compensation trajectory, and executive trajectory. Return strictly valid JSON:
{
  "strategicAdvancementRating": "High Acceleration",
  "skillCapitalGained": ["Rare skill / experience 1", "Strategic asset 2"],
  "compensationTrajectory": "Expected 2-3 year market remuneration growth following this position.",
  "nextLogicalExecutiveRoles": ["Next title 1 (e.g. Head of Infrastructure)", "Next title 2"],
  "riskMitigationStrategy": "Key trap or dead-end to avoid while serving in this capacity."
}`,
        user: `Generate Strategic Career Compass for ${jobTitle} at ${company}.\n\n${commonContext}`
      };

    case 'seek_pass_audit':
      return {
        system: `You are a talent intelligence auditor specializing in SEEK Pass and Australian employer pre-qualification questionnaires. Predict the knockout radar criteria and verify candidate compliance. Return strictly valid JSON:
{
  "knockoutRiskLevel": "Low Risk (Pre-Qualified)",
  "passProbability": 96,
  "verifiedCredentials": [
    { "check": "Australian Working Rights / Citizenship", "status": "Compliant", "note": "Unrestricted work authority confirmed." },
    { "check": "Commute / Workplace Proximity", "status": "Compliant", "note": "Within feasible metropolitan radius." },
    { "check": "Core Seniority & Years of Experience", "status": "Exceeds Requirement", "note": "Demonstrated 8+ years experience." }
  ],
  "radarRecommendations": ["Key advice to ensure 100% automated pass through candidate filtration."]
}`,
        user: `Perform SEEK Pass Knockout Radar Audit for ${jobTitle} at ${company}.\n\n${commonContext}`
      };

    case 'master_cheat_sheet':
      return {
        system: `You are a high-performance executive interview coach. Build a 3-column Master Interview Cheat Sheet Cockpit designed for real-time reference during technical and executive panel interviews. Return strictly valid JSON:
{
  "col1CompanyIntelligence": {
    "missionAndPressures": "Core operational priority of the company right now.",
    "keyMetricsToQuote": ["Metric / tech stack fact 1", "Fact 2"],
    "insiderQuestionsForPanel": ["Disarming strategic question to ask the interviewer 1", "Question 2"]
  },
  "col2PacingAndKeyAccomplishments": [
    { "theme": "Technical Mastery", "talkingPoint": "90-second structured answer summary with metric" },
    { "theme": "Crisis / Incident Resolution", "talkingPoint": "90-second structured answer summary" },
    { "theme": "Executive Influence", "talkingPoint": "90-second structured answer summary" }
  ],
  "col3EmergencyRedirection": [
    { "toughScenario": "If asked about unfamiliar legacy tool", "pivotScript": "Graceful executive pivot script" },
    { "toughScenario": "If asked about conflicting priorities", "pivotScript": "Calm governance-first pivot script" }
  ]
}`,
        user: `Generate Master Interview Cockpit for ${jobTitle} at ${company}.\n\n${commonContext}`
      };

    case 'star_prep_guide':
      return {
        system: `You are a behavioral interview diagnostic specialist. Generate an exhaustive STAR preparation guide with high-probability questions and targeted bullet proof points. Return strictly valid JSON:
{
  "targetedQuestions": [
    {
      "question": "Tell us about a time you led a critical operational turnaround under high ambiguity.",
      "starFraming": {
        "situation": "Context summary",
        "action": "Actions taken",
        "result": "Quantified result"
      },
      "interviewerChecklist": ["What they are grading you on 1", "Grading criteria 2"]
    },
    {
      "question": "How do you handle severe pushback from non-technical stakeholders?",
      "starFraming": {
        "situation": "Stakeholder friction scenario",
        "action": "Collaborative de-escalation actions",
        "result": "Consensus outcome"
      },
      "interviewerChecklist": ["Empathy test", "Decisiveness test"]
    }
  ]
}`,
        user: `Generate STAR Behavioral Preparation Guide for ${jobTitle} at ${company}.\n\n${commonContext}`
      };

    case 'ai_mock_interview':
      return {
        system: `You are an AI Interview Simulator Architect. Generate an initial 5-question interview script with rubric criteria for a live simulation with this candidate. Return strictly valid JSON:
{
  "interviewType": "Technical & Behavioral Executive Panel",
  "openingInterviewerRemarks": "Welcome! We are excited to discuss the role with you today.",
  "questions": [
    { "id": "q1", "text": "Walk us through how your background directly prepares you for the primary deliverables of this role.", "rubric": "Looking for clear narrative alignment without rambling." },
    { "id": "q2", "text": "Describe the most complex technical architecture or operational system you have maintained.", "rubric": "Depth of technical command and risk management." },
    { "id": "q3", "text": "How do you evaluate and prioritize conflicting requests from leadership?", "rubric": "Prioritization framework and communication clarity." }
  ]
}`,
        user: `Generate AI Mock Interview simulation package for ${jobTitle} at ${company}.\n\n${commonContext}`
      };

    case 'recruiter_outreach':
      return {
        system: `You are an executive talent broker and communication strategist. Formulate 3 distinct high-impact outreach templates (Cold Direct Message, Post-Application Follow-up, Post-Interview Value Add). Return strictly valid JSON:
{
  "coldInMail": {
    "subject": "Compelling subject line",
    "body": "3-sentence high-value message to hiring manager or internal recruiter."
  },
  "followUpNote": {
    "subject": "Application follow-up subject",
    "body": "Graceful, high-conviction follow-up message 3 days post-submission."
  },
  "postInterviewBriefing": {
    "subject": "Thank you & Strategic Clarification",
    "body": "Thoughtful thank-you note referencing an insight discussed during the interview."
  }
}`,
        user: `Generate Recruiter Outreach correspondence for ${jobTitle} at ${company}.\n\n${commonContext}`
      };

    case 'recruiter_crm':
    default:
      return {
        system: `You are a talent acquisition relationship strategist. Build a proactive talent partner management briefing for this employer. Return strictly valid JSON:
{
  "recruiterPersona": "Typical talent acquisition partner profile for this industry.",
  "communicationCadence": "Recommended contact cadence (e.g. Day 1, Day 4, Day 8).",
  "valuePitchHook": "Single sentence hook that makes recruiters immediately forward your resume to the hiring manager.",
  "differentiatorBullets": ["Differentiator 1", "Differentiator 2", "Differentiator 3"]
}`,
        user: `Generate Recruiter Relationship CRM Briefing for ${jobTitle} at ${company}.\n\n${commonContext}`
      };
  }
};

/**
 * Execute on-demand LLM generation for any of the 14 tools
 */
export const generateIntelligenceArtifact = async (toolKey, job, candidateProfile = null) => {
  const llmConfig = getLlmConfig();
  const provider = llmConfig.provider || 'openrouter';
  const model = llmConfig.model || 'meta-llama/llama-3.3-70b-instruct:free';
  const apiKey = (llmConfig.apiKey || '').trim();
  const endpoint = llmConfig.endpoint || 'https://openrouter.ai/api/v1/chat/completions';
  
  const toolMeta = ACTION_TOOLS[toolKey.toUpperCase()] || { label: toolKey };
  const prompts = buildToolPrompt(toolKey, job, candidateProfile);

  // If no API key and model is not free, auto-route to free tier model
  let targetModel = model;
  if (!apiKey && !targetModel.includes(':free') && provider !== 'free') {
    targetModel = 'meta-llama/llama-3.3-70b-instruct:free';
  }

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  if (provider === 'openrouter' || provider === 'free') {
    headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'https://job-dashboard.app';
    headers['X-Title'] = `Career.Agent Intelligence - ${toolMeta.label}`;
  }

  let rawContent = '';
  let promptTokens = 0;
  let completionTokens = 0;

  if (provider === 'anthropic' && apiKey) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: targetModel,
        system: prompts.system,
        messages: [{ role: 'user', content: prompts.user }],
        max_tokens: 3000,
        temperature: 0.2
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Anthropic error HTTP ${res.status}`);
    }

    const data = await res.json();
    rawContent = data?.content?.[0]?.text || '{}';
    promptTokens = data?.usage?.input_tokens || 1000;
    completionTokens = data?.usage?.output_tokens || 500;
  } else {
    // OpenAI-compatible format (OpenRouter, OpenAI, Gemini, DeepSeek, Free Tier)
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: targetModel,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompts.system },
          { role: 'user', content: prompts.user }
        ],
        temperature: 0.2
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `LLM Gateway error HTTP ${res.status}`);
    }

    const data = await res.json();
    rawContent = data?.choices?.[0]?.message?.content || '{}';
    promptTokens = data?.usage?.prompt_tokens || 1000;
    completionTokens = data?.usage?.completion_tokens || 500;
  }

  // Clean JSON wrapping
  const cleaned = rawContent
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed = {};
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.warn('JSON parsing notice, extracting JSON substring:', err);
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      parsed = { rawResult: cleaned };
    }
  }

  // Record spend in ledger
  recordLlmUsage(targetModel, promptTokens, completionTokens, toolMeta.label);

  return {
    ...parsed,
    modelUsed: targetModel,
    generatedAt: new Date().toISOString()
  };
};

