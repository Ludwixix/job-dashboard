import{n as e}from"./apiConfig-CnopMYsb.js";import{a as t,f as n}from"./llmConfig-2jRRLtQr.js";import{s as r}from"./profileService-Ch8BPfb9.js";import{n as i}from"./billingService-DXGHjVeo.js";var a={RECRUITER_CRM:{key:`recruiter_crm`,label:`RECRUITER CRM`,shortDesc:`Link talent partners & manage cadence.`,category:`Relationship`,color:`purple`,badgeVariant:`purple`},EXECUTIVE_DOSSIER:{key:`executive_dossier`,label:`EXECUTIVE DOSSIER`,shortDesc:`90-day plan, leadership alignment & pain points.`,category:`Executive`,color:`teal`,badgeVariant:`teal`},INFLUENCE_DEBRIEF:{key:`influence_debrief`,label:`INFLUENCE & DEBRIEF`,shortDesc:`Objection overcoming & referee briefing.`,category:`Interview`,color:`amber`,badgeVariant:`amber`},ATS_SENTINEL:{key:`ats_sentinel`,label:`ATS SENTINEL`,shortDesc:`Workday & STAR parser simulation.`,category:`Compliance`,color:`emerald`,badgeVariant:`emerald`},LINKEDIN_INBOUND:{key:`linkedin_inbound`,label:`LINKEDIN INBOUND`,shortDesc:`Recruiter Boolean indexing & headlines.`,category:`Optimization`,color:`amber`,badgeVariant:`amber`},CL_POLARIZER:{key:`cl_polarizer`,label:`CL POLARIZER`,shortDesc:`Swappability audit & anti-template rewrites.`,category:`Application`,color:`rose`,badgeVariant:`rose`},SCREENING_SOLVER:{key:`screening_solver`,label:`SCREENING SOLVER`,shortDesc:`Auto-solve portal questionnaires & compliance.`,category:`Application`,color:`teal`,badgeVariant:`teal`},CAREER_COMPASS:{key:`career_compass`,label:`CAREER COMPASS`,shortDesc:`Strategic matrix & progression roadmap.`,category:`Strategy`,color:`amber`,badgeVariant:`amber`},KSC_GENERATOR:{key:`ksc_generator`,label:`KSC GENERATOR`,shortDesc:`APS & VPS capability criteria responses.`,category:`Public Sector`,color:`teal`,badgeVariant:`teal`},SEEK_PASS_AUDIT:{key:`seek_pass_audit`,label:`SEEK PASS AUDIT`,shortDesc:`Pre-qualification knockout radar.`,category:`Compliance`,color:`emerald`,badgeVariant:`emerald`},MASTER_CHEAT_SHEET:{key:`master_cheat_sheet`,label:`MASTER CHEAT SHEET`,shortDesc:`3-column cockpit with 90s pacing timer.`,category:`Interview`,color:`cyan`,badgeVariant:`cyan`},STAR_PREP_GUIDE:{key:`star_prep_guide`,label:`STAR PREP GUIDE`,shortDesc:`Sector-grounded question strategy & talking points.`,category:`Interview`,color:`amber`,badgeVariant:`amber`},AI_MOCK_INTERVIEW:{key:`ai_mock_interview`,label:`AI MOCK INTERVIEW`,shortDesc:`Live simulated interview with rubric scoring.`,category:`Interview`,color:`amber`,badgeVariant:`amber`},RECRUITER_OUTREACH:{key:`recruiter_outreach`,label:`RECRUITER OUTREACH`,shortDesc:`Follow-up, cold pitch, or post-interview notes.`,category:`Outreach`,color:`teal`,badgeVariant:`teal`}},o=(e,t)=>{if(!e||!t)return!1;if(e.intelligence&&e.intelligence[t]||t===`executive_dossier`&&(e.executiveDossier||e.dossier)||t===`influence_debrief`&&(e.influenceDebrief||e.influenceData)||t===`ats_sentinel`&&(e.atsDiagnostic||e.atsScoreData)||t===`linkedin_inbound`&&e.linkedinInbound||t===`cl_polarizer`&&(e.polarizedCoverLetter||e.clPolarizer)||t===`screening_solver`&&e.screeningSolver||t===`career_compass`&&e.careerCompass||t===`ksc_generator`&&(e.kscResponses||e.kscSolutions)||t===`seek_pass_audit`&&e.seekPassAudit||t===`master_cheat_sheet`&&e.masterCheatSheet||t===`star_prep_guide`&&e.starPrepGuide||t===`ai_mock_interview`&&(e.mockInterviewHistory||e.mockInterviewFeedback)||t===`recruiter_outreach`&&(e.outreachEmail||e.followUpEmail)||t===`recruiter_crm`&&e.recruiterCrm)return!0;if(typeof window<`u`){let n=`job_intel_${e.id||`${e.company}_${e.title}`}_${t}`;try{if(localStorage.getItem(n))return!0}catch{}}return!1},s=(e,t)=>{if(!e||!t)return null;if(e.intelligence&&e.intelligence[t])return e.intelligence[t];if(t===`executive_dossier`)return e.executiveDossier||e.dossier||null;if(t===`influence_debrief`)return e.influenceDebrief||e.influenceData||null;if(t===`ats_sentinel`)return e.atsDiagnostic||e.atsScoreData||null;if(t===`linkedin_inbound`)return e.linkedinInbound||null;if(t===`cl_polarizer`)return e.polarizedCoverLetter||e.clPolarizer||null;if(t===`screening_solver`)return e.screeningSolver||null;if(t===`career_compass`)return e.careerCompass||null;if(t===`ksc_generator`)return e.kscResponses||e.kscSolutions||null;if(t===`seek_pass_audit`)return e.seekPassAudit||null;if(t===`master_cheat_sheet`)return e.masterCheatSheet||null;if(t===`star_prep_guide`)return e.starPrepGuide||null;if(t===`ai_mock_interview`)return e.mockInterviewHistory||e.mockInterviewFeedback||null;if(t===`recruiter_outreach`)return e.outreachEmail||e.followUpEmail||null;if(t===`recruiter_crm`)return e.recruiterCrm||null;if(typeof window<`u`){let n=`job_intel_${e.id||`${e.company}_${e.title}`}_${t}`;try{let e=localStorage.getItem(n);if(e)return JSON.parse(e)}catch{}}return null},c=async(t,n,r,i)=>{if(!t||!n)return!1;let a=t.id||`${t.company}_${t.title}`,o=new Date().toISOString(),s={...r,savedAt:o,toolKey:n};if(t.intelligence||={},t.intelligence[n]=s,typeof window<`u`)try{localStorage.setItem(`job_intel_${a}_${n}`,JSON.stringify(s))}catch(e){console.warn(`LocalStorage save failed for job intelligence:`,e)}typeof i==`function`&&i(a,t.status||`Discovered`,{intelligence:t.intelligence,[n]:s});try{let t=e();await fetch(`${t}/api/job-intelligence`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({job_id:a,tool_key:n,data:s})})}catch(e){console.info(`Backend intelligence sync notice:`,e)}return s},l=(e,t,n=null)=>{let i=n||r()||{},a=t.title||`Specialist Role`,o=t.company||`Target Employer`,s=t.location||`Melbourne, VIC`,c=t.salary||`Competitive / Unspecified`,l=t.description||t.notes||t.snippet||``,u=`CANDIDATE PROFILE:
- Name: ${i.name||`Candidate`}
- Headline: ${i.headline||i.title||`Senior Technology Specialist`}
- Target Industry: ${i.industry||`Information Technology & Cloud`}
- Core Skills: ${(i.coreSkills||[]).join(`, `)||`Systems architecture, cloud migration, stakeholder alignment`}
- Key Strengths: ${(i.keyStrengths||[]).join(`; `)||`Reliability, high execution velocity, deep technical diagnostics`}

TARGET JOB ADVERTISEMENT:
- Title: ${a}
- Company: ${o}
- Workplace: ${s} (${t.remote?`Remote`:`On-Site / Hybrid`})
- Salary Package: ${c}
- Complete Job Ad Specification:
${l||`(Infer core deliverables from job title and company reputation)`}`;switch(e){case`executive_dossier`:return{system:`You are an elite executive strategy consultant and organizational analyst. Produce a rigorous, highly customized 90-Day Executive Strategic Dossier for this exact position. Return strictly valid JSON matching:
{
  "strategicSummary": "2-3 sentences on the company's core market pressures and why this hire is critical.",
  "first30Days": ["Concrete high-impact milestone 1", "Milestone 2", "Milestone 3"],
  "days31To60": ["Operational milestone 1", "Milestone 2", "Milestone 3"],
  "days61To90": ["Scalability & transformation milestone 1", "Milestone 2", "Milestone 3"],
  "executivePainPoints": ["Unspoken executive risk or headache 1", "Pain point 2"],
  "leadershipPosture": "Specific communication posture and management stance that will establish immediate authority."
}`,user:`Generate the Executive Strategic Dossier for ${a} at ${o}.\n\n${u}`};case`influence_debrief`:return{system:`You are a master executive interview tactician and influence strategist. Generate high-conviction objection handling, persuasion talking points, and referee debrief guides. Return strictly valid JSON matching:
{
  "coreObjectionHandling": [
    { "objection": "Anticipated skepticism from hiring panel", "reframing": "Psychologically grounded reframing", "proofPoint": "Concrete candidate achievement or metric" }
  ],
  "psychologicalAnchors": ["Cognitive anchor phrase 1", "Anchor phrase 2", "Anchor phrase 3"],
  "refereeBriefingNotes": ["Key narrative referees should emphasize to validate senior capability", "Referee talking point 2"]
}`,user:`Generate Influence & Debrief tactical matrix for ${a} at ${o}.\n\n${u}`};case`ats_sentinel`:return{system:`You are a principal enterprise ATS systems auditor (Workday, Taleo, Greenhouse). Audit the role's keyword density and provide direct ATS scoring breakdown. Return strictly valid JSON:
{
  "atsScore": 92,
  "matchLevel": "High Precision Fit",
  "criticalMissingKeywords": ["keyword 1", "keyword 2"],
  "matchedHighValueKeywords": ["keyword 1", "keyword 2", "keyword 3"],
  "workdayCompatibilityNotes": "Detailed advice on Workday & parsing parser compliance for this role.",
  "recommendedBulletRewrites": [
    { "original": "Generic duty description", "optimized": "High-impact STAR achievement bullet with quantitative metric" }
  ]
}`,user:`Perform ATS Sentinel compliance audit for ${a} at ${o}.\n\n${u}`};case`linkedin_inbound`:return{system:`You are an executive talent sourcer. Generate Boolean search strings recruiters will use to find candidates for this role, plus tailored LinkedIn headline and about snippets. Return strictly valid JSON:
{
  "booleanSearchStrings": ["Boolean string 1 (e.g. title AND skills)", "Alternative Boolean string"],
  "optimizedHeadline": "Sharp, punchy 220-char LinkedIn headline aligned to this specific vacancy",
  "aboutSectionSnippet": "3-4 sentence value proposition paragraph to paste into LinkedIn About",
  "featuredSkillTags": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5"]
}`,user:`Generate LinkedIn Inbound Optimization for ${a} at ${o}.\n\n${u}`};case`cl_polarizer`:return{system:`You are a world-class executive copywriter. Analyze and polarize the cover letter narrative: eliminate cliches, inject authentic executive conviction, and make it impossible to mistake for a generic template. Return strictly valid JSON:
{
  "swappabilityScore": 12,
  "verdict": "Hyper-Tailored / Anti-Template",
  "unforgivableClichesRemoved": ["cliche 1", "cliche 2"],
  "polarizedOpeningHook": "Electrifying 2-sentence opening hook speaking directly to the hiring manager's current operational bottleneck.",
  "coreProofParagraph": "Dense, factual narrative paragraph connecting candidate's signature methodology to this company's exact technical challenge.",
  "boldClosingCallToAction": "Confident, low-friction closing statement requesting a 15-minute operational briefing."
}`,user:`Polarize cover letter positioning for ${a} at ${o}.\n\n${u}`};case`screening_solver`:return{system:`You are an enterprise talent acquisition compliance specialist. Formulate winning, high-conviction answers to common portal screening questions (salary expectations, notice period, technical governance, sponsorship). Return strictly valid JSON:
{
  "screeningAnswers": [
    { "question": "Why are you interested in joining our company in this specific role?", "answer": "Crisp 3-sentence company-specific answer." },
    { "question": "What are your salary expectations?", "answer": "Strategically framed response anchored to market rate and value creation." },
    { "question": "What is your availability / notice period?", "answer": "Professional notice period confirmation." },
    { "question": "Describe your direct experience leading similar initiatives.", "answer": "Grounded STAR achievement answer." }
  ]
}`,user:`Generate portal screening questionnaire solutions for ${a} at ${o}.\n\n${u}`};case`ksc_generator`:return{system:`You are a certified Australian Public Sector (APS) and Victorian Public Service (VPS) executive scribe. Formulate comprehensive Key Selection Criteria (KSC) responses adhering strictly to the STAR/SAO framework. Return strictly valid JSON:
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
}`,user:`Generate public sector KSC selection responses for ${a} at ${o}.\n\n${u}`};case`career_compass`:return{system:`You are an executive career architect. Produce a strategic progression compass analyzing how this specific role accelerates long-term career capital, compensation trajectory, and executive trajectory. Return strictly valid JSON:
{
  "strategicAdvancementRating": "High Acceleration",
  "skillCapitalGained": ["Rare skill / experience 1", "Strategic asset 2"],
  "compensationTrajectory": "Expected 2-3 year market remuneration growth following this position.",
  "nextLogicalExecutiveRoles": ["Next title 1 (e.g. Head of Infrastructure)", "Next title 2"],
  "riskMitigationStrategy": "Key trap or dead-end to avoid while serving in this capacity."
}`,user:`Generate Strategic Career Compass for ${a} at ${o}.\n\n${u}`};case`seek_pass_audit`:return{system:`You are a talent intelligence auditor specializing in SEEK Pass and Australian employer pre-qualification questionnaires. Predict the knockout radar criteria and verify candidate compliance. Return strictly valid JSON:
{
  "knockoutRiskLevel": "Low Risk (Pre-Qualified)",
  "passProbability": 96,
  "verifiedCredentials": [
    { "check": "Australian Working Rights / Citizenship", "status": "Compliant", "note": "Unrestricted work authority confirmed." },
    { "check": "Commute / Workplace Proximity", "status": "Compliant", "note": "Within feasible metropolitan radius." },
    { "check": "Core Seniority & Years of Experience", "status": "Exceeds Requirement", "note": "Demonstrated 8+ years experience." }
  ],
  "radarRecommendations": ["Key advice to ensure 100% automated pass through candidate filtration."]
}`,user:`Perform SEEK Pass Knockout Radar Audit for ${a} at ${o}.\n\n${u}`};case`master_cheat_sheet`:return{system:`You are an elite executive interview coach and technical hiring director. Build a complete, bespoke 3-column Master Interview Cheat Sheet Cockpit for this exact candidate and target job ad, modeled on the benchmark KBR Cockpit architecture (3 columns, 90-second pacing, 5-second brain glances, and conversational spoken scripts with HTML highlights <span class="hl">).

Return strictly valid JSON matching this exact structure:
{
  "traps": [
    "Specific high-risk landmine 1 to avoid during this company's interview (e.g. legacy bias, security shortcut, theoretical babble)",
    "Specific landmine 2",
    "Specific landmine 3"
  ],
  "numbersToDrop": [
    { "value": "99.99%", "label": "Production Uptime" },
    { "value": "660k+", "label": "Enterprise Users" },
    { "value": "87%", "label": "Cutover Cycle Time" },
    { "value": "0", "label": "Unplanned Outages" },
    { "value": "12+", "label": "Years Track Record" },
    { "value": "100h/mo", "label": "Automation Savings" }
  ],
  "reverseQuestions": [
    {
      "category": "Strategic Alignment",
      "question": "Looking at the company roadmap for the next 6 to 12 months, what is the single biggest operational bottleneck you want the person in this role to solve first?",
      "targetAudience": "Hiring Manager / Team Lead",
      "rationale": "Shows immediate desire to create business impact and prioritize executive pain."
    },
    {
      "category": "Technical Architecture & Governance",
      "question": "Bespoke question addressing this job's specific technology stack and governance balance",
      "targetAudience": "Technical Evaluator / Lead Architect",
      "rationale": "Signals respect for both delivery speed and enterprise security guardrails."
    },
    {
      "category": "Team Velocity & Tooling",
      "question": "Bespoke question on day-to-day deployment lifecycle, CI/CD, and release friction",
      "targetAudience": "Senior Engineers / Peers",
      "rationale": "Reveals engineering maturity and real-world deployment practices."
    },
    {
      "category": "Definition of Success",
      "question": "If we look back 12 months from now, what would have to happen for you to say, 'Hiring this person was the best decision we made this year'?",
      "targetAudience": "Full Panel",
      "rationale": "Forces the panel to visualize candidate thriving and defines the scorecard."
    }
  ],
  "starStories": [
    {
      "title": "Bespoke Headline Aligned to Job Priority 1",
      "company": "Capgemini / Victorian Dept of Education",
      "color": "#7c3aed",
      "situation": "1-sentence concise enterprise context and business pain.",
      "action": "1-2 sentences detailing exact technical methodology and automation built.",
      "result": "Quantified business result with concrete metrics."
    },
    {
      "title": "Bespoke Headline Aligned to Job Priority 2",
      "company": "Knosys / GreenOrbit Intranet",
      "color": "#0284c7",
      "situation": "1-sentence situation.",
      "action": "1-2 sentences action.",
      "result": "Quantified result."
    },
    {
      "title": "Bespoke Headline Aligned to Job Priority 3",
      "company": "Australia Post via Capgemini",
      "color": "#059669",
      "situation": "1-sentence situation.",
      "action": "1-2 sentences action.",
      "result": "Quantified result."
    },
    {
      "title": "Bespoke Headline Aligned to Job Priority 4",
      "company": "Engage Squared / Cimic Group & Transurban",
      "color": "#d97706",
      "situation": "1-sentence situation.",
      "action": "1-2 sentences action.",
      "result": "Quantified result."
    },
    {
      "title": "Bespoke Headline Aligned to Job Priority 5",
      "company": "St John of God Health Care",
      "color": "#e11d48",
      "situation": "1-sentence situation.",
      "action": "1-2 sentences action.",
      "result": "Quantified result."
    }
  ],
  "qnaCards": [
    {
      "id": "pitch",
      "category": "cat-pitch",
      "categoryLabel": "🎯 Pitch",
      "title": "1. Opening Pitch: 'Tell Me About Yourself'",
      "badge": "Conversational • ~90 Seconds",
      "badgeColor": "green",
      "scanLabel": "⚡ 5-Second Brain Glances:",
      "scanBar": "Years Exp &rarr; Core Track Record &rarr; Quantified Win &rarr; Why Target Employer",
      "spokenLabel": "🗣️ What to Actually Say (Human & Conversational):",
      "spokenScript": "<p>Conversational spoken script formatted in HTML with <span class=\\"hl\\">highlighted phrases</span> and <span class=\\"hl-green\\">quantified metrics</span>.</p>"
    },
    {
      "id": "tech1",
      "category": "cat-tech",
      "categoryLabel": "⚡ Tech Deep Dive",
      "title": "2. Technical Deep Dive: Primary Technology / Core Mandate",
      "badge": "Architecture & Resilience",
      "badgeColor": "blue",
      "scanLabel": "⚡ 5-Second Brain Glances:",
      "scanBar": "Core Methodology &rarr; Security / Least Privilege &rarr; Automated Telemetry",
      "likelyQuestion": "Likely Question: 'How do you approach this core technical requirement in production?'",
      "spokenLabel": "🗣️ What to Actually Say:",
      "spokenScript": "<p>Conversational technical answer anchored to production reality.</p>"
    },
    {
      "id": "tech2",
      "category": "cat-architecture",
      "categoryLabel": "🏗️ Architecture & Scale",
      "title": "3. Architecture & Reliability: Secondary Mandate / Scale",
      "badge": "Enterprise Scale",
      "badgeColor": "purple",
      "scanLabel": "⚡ 5-Second Brain Glances:",
      "scanBar": "Zero Downtime &rarr; Idempotency &rarr; Health Gates &rarr; Automated Recovery",
      "likelyQuestion": "Likely Question: 'How do you handle zero-downtime cutovers, migration, or infrastructure scale?'",
      "spokenLabel": "🗣️ What to Actually Say:",
      "spokenScript": "<p>Conversational architectural answer.</p>"
    },
    {
      "id": "behavioral",
      "category": "cat-behavioral",
      "categoryLabel": "🤝 Leadership & Crisis",
      "title": "4. Behavioral: Incident Triage & Stakeholder Friction",
      "badge": "Executive Empathy",
      "badgeColor": "amber",
      "scanLabel": "⚡ 5-Second Brain Glances:",
      "scanBar": "Stop Bleeding &rarr; Transparent Comms &rarr; Blameless Post-Mortem &rarr; Permanent Guardrail",
      "likelyQuestion": "Likely Question: 'Tell me about a production incident or conflict with stakeholders and how you handled it.'",
      "spokenLabel": "🗣️ What to Actually Say:",
      "spokenScript": "<p>Conversational behavioral STAR answer.</p>"
    },
    {
      "id": "why_company",
      "category": "cat-company",
      "categoryLabel": "🏢 Company Fit",
      "title": "5. Why This Employer? (Strategic Alignment)",
      "badge": "High Conviction",
      "badgeColor": "green",
      "scanLabel": "⚡ 5-Second Brain Glances:",
      "scanBar": "Scale of Mission &rarr; Engineering Culture &rarr; Immediate Value Delivery &rarr; Long-Term Home",
      "likelyQuestion": "Likely Question: 'Why do you want to join us and why this role specifically?'",
      "spokenLabel": "🗣️ What to Actually Say:",
      "spokenScript": "<p>Conversational alignment answer showing deep knowledge of the employer.</p>"
    }
  ],
  "interviewers": [
    {
      "name": "Hiring Lead / Manager",
      "role": "Direct Manager",
      "focus": "Autonomy, team velocity & delivery execution",
      "dropTerms": "Key technical terms to drop"
    }
  ]
}`,user:`Generate a 100% bespoke Master Interview Cockpit for ${a} at ${o}.\n\n${u}`};case`star_prep_guide`:return{system:`You are a behavioral interview diagnostic specialist. Generate an exhaustive STAR preparation guide with high-probability questions and targeted bullet proof points. Return strictly valid JSON:
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
}`,user:`Generate STAR Behavioral Preparation Guide for ${a} at ${o}.\n\n${u}`};case`ai_mock_interview`:return{system:`You are an AI Interview Simulator Architect. Generate an initial 5-question interview script with rubric criteria for a live simulation with this candidate. Return strictly valid JSON:
{
  "interviewType": "Technical & Behavioral Executive Panel",
  "openingInterviewerRemarks": "Welcome! We are excited to discuss the role with you today.",
  "questions": [
    { "id": "q1", "text": "Walk us through how your background directly prepares you for the primary deliverables of this role.", "rubric": "Looking for clear narrative alignment without rambling." },
    { "id": "q2", "text": "Describe the most complex technical architecture or operational system you have maintained.", "rubric": "Depth of technical command and risk management." },
    { "id": "q3", "text": "How do you evaluate and prioritize conflicting requests from leadership?", "rubric": "Prioritization framework and communication clarity." }
  ]
}`,user:`Generate AI Mock Interview simulation package for ${a} at ${o}.\n\n${u}`};case`recruiter_outreach`:return{system:`You are an executive talent broker and communication strategist. Formulate 3 distinct high-impact outreach templates (Cold Direct Message, Post-Application Follow-up, Post-Interview Value Add). Return strictly valid JSON:
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
}`,user:`Generate Recruiter Outreach correspondence for ${a} at ${o}.\n\n${u}`};default:return{system:`You are a talent acquisition relationship strategist. Build a proactive talent partner management briefing for this employer. Return strictly valid JSON:
{
  "recruiterPersona": "Typical talent acquisition partner profile for this industry.",
  "communicationCadence": "Recommended contact cadence (e.g. Day 1, Day 4, Day 8).",
  "valuePitchHook": "Single sentence hook that makes recruiters immediately forward your resume to the hiring manager.",
  "differentiatorBullets": ["Differentiator 1", "Differentiator 2", "Differentiator 3"]
}`,user:`Generate Recruiter Relationship CRM Briefing for ${a} at ${o}.\n\n${u}`}}},u=async(e,r,o=null)=>{let s=t(),c=s.provider||`openrouter`,u=s.model||`meta-llama/llama-3.3-70b-instruct:free`,d=(s.apiKey||``).trim(),f=s.endpoint||`https://openrouter.ai/api/v1/chat/completions`,p=a[e.toUpperCase()]||{label:e},m=l(e,r,o),h=u,g=``,_=0,v=0;if(!d)try{let e=await i({messages:[{role:`system`,content:m.system},{role:`user`,content:m.user}],model:u&&!u.includes(`:free`)?u:`anthropic/claude-3.7-sonnet`,temperature:.2,json_mode:!0});g=e?.content||`{}`,_=e?.usage?.prompt_tokens||1200,v=e?.usage?.completion_tokens||600,h=e?.model||u||`anthropic/claude-3.7-sonnet`}catch(e){throw e.code===`PAYMENT_REQUIRED`?Error(`Platform Built-In AI trial completed. Please upgrade to Pro or configure your own OpenRouter/OpenAI API key in Settings.`):e}else if(c===`anthropic`){let e=await fetch(f,{method:`POST`,headers:{"Content-Type":`application/json`,"x-api-key":d,"anthropic-version":`2023-06-01`,"anthropic-dangerous-direct-browser-access":`true`},body:JSON.stringify({model:h,system:m.system,messages:[{role:`user`,content:m.user}],max_tokens:3e3,temperature:.2})});if(!e.ok){let t=await e.json().catch(()=>({}));throw Error(t?.error?.message||`Anthropic error HTTP ${e.status}`)}let t=await e.json();g=t?.content?.[0]?.text||`{}`,_=t?.usage?.input_tokens||1e3,v=t?.usage?.output_tokens||500}else{let e={"Content-Type":`application/json`};e.Authorization=`Bearer ${d}`,(c===`openrouter`||c===`free`)&&(e[`HTTP-Referer`]=typeof window<`u`?window.location.origin:`https://job-dashboard.app`,e[`X-Title`]=`Career.Agent Intelligence - ${p.label}`);let t=await fetch(f,{method:`POST`,headers:e,body:JSON.stringify({model:h,response_format:{type:`json_object`},messages:[{role:`system`,content:m.system},{role:`user`,content:m.user}],temperature:.2})});if(!t.ok){let e=await t.json().catch(()=>({}));throw Error(e?.error?.message||`LLM Gateway error HTTP ${t.status}`)}let n=await t.json();g=n?.choices?.[0]?.message?.content||`{}`,_=n?.usage?.prompt_tokens||1e3,v=n?.usage?.completion_tokens||500}let y=g.replace(/^```json\s*/i,``).replace(/^```\s*/i,``).replace(/```\s*$/i,``).trim(),b={};try{b=JSON.parse(y)}catch(e){console.warn(`JSON parsing notice, extracting JSON substring:`,e);let t=y.match(/\{[\s\S]*\}/);b=t?JSON.parse(t[0]):{rawResult:y}}return n(h,_,v,p.label),{...b,modelUsed:h,generatedAt:new Date().toISOString()}};export{c as i,s as n,o as r,u as t};