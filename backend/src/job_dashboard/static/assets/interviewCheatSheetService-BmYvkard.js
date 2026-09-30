import{n as e}from"./apiConfig-CnopMYsb.js";import{E as t,S as n,d as r,v as i}from"./profileService-0govRfLJ.js";import{n as a}from"./billingService-DlfoyG40.js";var o={RECRUITER_CRM:{key:`recruiter_crm`,label:`RECRUITER CRM`,shortDesc:`Link talent partners & manage cadence.`,category:`Relationship`,color:`purple`,badgeVariant:`purple`},EXECUTIVE_DOSSIER:{key:`executive_dossier`,label:`EXECUTIVE DOSSIER`,shortDesc:`90-day plan, leadership alignment & pain points.`,category:`Executive`,color:`teal`,badgeVariant:`teal`},INFLUENCE_DEBRIEF:{key:`influence_debrief`,label:`INFLUENCE & DEBRIEF`,shortDesc:`Objection overcoming & referee briefing.`,category:`Interview`,color:`amber`,badgeVariant:`amber`},ATS_SENTINEL:{key:`ats_sentinel`,label:`ATS SENTINEL`,shortDesc:`Workday & STAR parser simulation.`,category:`Compliance`,color:`emerald`,badgeVariant:`emerald`},LINKEDIN_INBOUND:{key:`linkedin_inbound`,label:`LINKEDIN INBOUND`,shortDesc:`Recruiter Boolean indexing & headlines.`,category:`Optimization`,color:`amber`,badgeVariant:`amber`},CL_POLARIZER:{key:`cl_polarizer`,label:`CL POLARIZER`,shortDesc:`Swappability audit & anti-template rewrites.`,category:`Application`,color:`rose`,badgeVariant:`rose`},SCREENING_SOLVER:{key:`screening_solver`,label:`SCREENING SOLVER`,shortDesc:`Auto-solve portal questionnaires & compliance.`,category:`Application`,color:`teal`,badgeVariant:`teal`},CAREER_COMPASS:{key:`career_compass`,label:`CAREER COMPASS`,shortDesc:`Strategic matrix & progression roadmap.`,category:`Strategy`,color:`amber`,badgeVariant:`amber`},KSC_GENERATOR:{key:`ksc_generator`,label:`KSC GENERATOR`,shortDesc:`APS & VPS capability criteria responses.`,category:`Public Sector`,color:`teal`,badgeVariant:`teal`},SEEK_PASS_AUDIT:{key:`seek_pass_audit`,label:`SEEK PASS AUDIT`,shortDesc:`Pre-qualification knockout radar.`,category:`Compliance`,color:`emerald`,badgeVariant:`emerald`},MASTER_CHEAT_SHEET:{key:`master_cheat_sheet`,label:`MASTER CHEAT SHEET`,shortDesc:`3-column cockpit with 90s pacing timer.`,category:`Interview`,color:`cyan`,badgeVariant:`cyan`},STAR_PREP_GUIDE:{key:`star_prep_guide`,label:`STAR PREP GUIDE`,shortDesc:`Sector-grounded question strategy & talking points.`,category:`Interview`,color:`amber`,badgeVariant:`amber`},AI_MOCK_INTERVIEW:{key:`ai_mock_interview`,label:`AI MOCK INTERVIEW`,shortDesc:`Live simulated interview with rubric scoring.`,category:`Interview`,color:`amber`,badgeVariant:`amber`},RECRUITER_OUTREACH:{key:`recruiter_outreach`,label:`RECRUITER OUTREACH`,shortDesc:`Follow-up, cold pitch, or post-interview notes.`,category:`Outreach`,color:`teal`,badgeVariant:`teal`}},s=(e,t)=>{if(!e||!t)return null;if(e.intelligence&&e.intelligence[t])return e.intelligence[t];if(t===`executive_dossier`)return e.executiveDossier||e.dossier||null;if(t===`influence_debrief`)return e.influenceDebrief||e.influenceData||null;if(t===`ats_sentinel`)return e.atsDiagnostic||e.atsScoreData||null;if(t===`linkedin_inbound`)return e.linkedinInbound||null;if(t===`cl_polarizer`)return e.polarizedCoverLetter||e.clPolarizer||null;if(t===`screening_solver`)return e.screeningSolver||null;if(t===`career_compass`)return e.careerCompass||null;if(t===`ksc_generator`)return e.kscResponses||e.kscSolutions||null;if(t===`seek_pass_audit`)return e.seekPassAudit||null;if(t===`master_cheat_sheet`)return e.masterCheatSheet||null;if(t===`star_prep_guide`)return e.starPrepGuide||null;if(t===`ai_mock_interview`)return e.mockInterviewHistory||e.mockInterviewFeedback||null;if(t===`recruiter_outreach`)return e.outreachEmail||e.followUpEmail||null;if(t===`recruiter_crm`)return e.recruiterCrm||null;if(typeof window<`u`){let n=`job_intel_${e.id||`${e.company}_${e.title}`}_${t}`;try{let e=localStorage.getItem(n);if(e)return JSON.parse(e)}catch{}}return null},c=async(t,n,r,i)=>{if(!t||!n)return!1;let a=t.id||`${t.company}_${t.title}`,o=new Date().toISOString(),s={...r,savedAt:o,toolKey:n};if(t.intelligence||={},t.intelligence[n]=s,typeof window<`u`)try{localStorage.setItem(`job_intel_${a}_${n}`,JSON.stringify(s))}catch(e){console.warn(`LocalStorage save failed for job intelligence:`,e)}typeof i==`function`&&i(a,t.status||`Discovered`,{intelligence:t.intelligence,[n]:s});try{let t=e();await fetch(`${t}/api/job-intelligence`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({job_id:a,tool_key:n,data:s})})}catch(e){console.info(`Backend intelligence sync notice:`,e)}return s},l=(e,n,r=null)=>{let i=r||t()||{},a=n.title||`Specialist Role`,o=n.company||`Target Employer`,s=n.location||`Melbourne, VIC`,c=n.salary||`Competitive / Unspecified`,l=n.description||n.notes||n.snippet||``,u=`CANDIDATE PROFILE:
- Name: ${i.name||`Candidate`}
- Headline: ${i.headline||i.title||`Senior Technology Specialist`}
- Target Industry: ${i.industry||`Information Technology & Cloud`}
- Core Skills: ${(i.coreSkills||[]).join(`, `)||`Systems architecture, cloud migration, stakeholder alignment`}
- Key Strengths: ${(i.keyStrengths||[]).join(`; `)||`Reliability, high execution velocity, deep technical diagnostics`}

TARGET JOB ADVERTISEMENT:
- Title: ${a}
- Company: ${o}
- Workplace: ${s} (${n.remote?`Remote`:`On-Site / Hybrid`})
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
}`,user:`Generate Recruiter Relationship CRM Briefing for ${a} at ${o}.\n\n${u}`}}},u=async(e,t,n=null)=>{let s=r(),c=s.provider||`openrouter`,u=s.model||`meta-llama/llama-3.3-70b-instruct:free`,d=(s.apiKey||``).trim(),f=s.endpoint||`https://openrouter.ai/api/v1/chat/completions`,p=o[e.toUpperCase()]||{label:e},m=l(e,t,n),h=u,g=``,_=0,v=0;if(!d)try{let e=await a({messages:[{role:`system`,content:m.system},{role:`user`,content:m.user}],model:u&&!u.includes(`:free`)?u:`anthropic/claude-3.7-sonnet`,temperature:.2,json_mode:!0});g=e?.content||`{}`,_=e?.usage?.prompt_tokens||1200,v=e?.usage?.completion_tokens||600,h=e?.model||u||`anthropic/claude-3.7-sonnet`}catch(e){throw e.code===`PAYMENT_REQUIRED`?Error(`Platform Built-In AI trial completed. Please upgrade to Pro or configure your own OpenRouter/OpenAI API key in Settings.`):e}else if(c===`anthropic`){let e=await fetch(f,{method:`POST`,headers:{"Content-Type":`application/json`,"x-api-key":d,"anthropic-version":`2023-06-01`,"anthropic-dangerous-direct-browser-access":`true`},body:JSON.stringify({model:h,system:m.system,messages:[{role:`user`,content:m.user}],max_tokens:3e3,temperature:.2})});if(!e.ok){let t=await e.json().catch(()=>({}));throw Error(t?.error?.message||`Anthropic error HTTP ${e.status}`)}let t=await e.json();g=t?.content?.[0]?.text||`{}`,_=t?.usage?.input_tokens||1e3,v=t?.usage?.output_tokens||500}else{let e={"Content-Type":`application/json`};e.Authorization=`Bearer ${d}`,(c===`openrouter`||c===`free`)&&(e[`HTTP-Referer`]=typeof window<`u`?window.location.origin:`https://job-dashboard.app`,e[`X-Title`]=`Career.Agent Intelligence - ${p.label}`);let t=await fetch(f,{method:`POST`,headers:e,body:JSON.stringify({model:h,response_format:{type:`json_object`},messages:[{role:`system`,content:m.system},{role:`user`,content:m.user}],temperature:.2})});if(!t.ok){let e=await t.json().catch(()=>({}));throw Error(e?.error?.message||`LLM Gateway error HTTP ${t.status}`)}let n=await t.json();g=n?.choices?.[0]?.message?.content||`{}`,_=n?.usage?.prompt_tokens||1e3,v=n?.usage?.completion_tokens||500}let y=g.replace(/^```json\s*/i,``).replace(/^```\s*/i,``).replace(/```\s*$/i,``).trim(),b={};try{b=JSON.parse(y)}catch(e){console.warn(`JSON parsing notice, extracting JSON substring:`,e);let t=y.match(/\{[\s\S]*\}/);b=t?JSON.parse(t[0]):{rawResult:y}}return i(h,_,v,p.label),{...b,modelUsed:h,generatedAt:new Date().toISOString()}};function d(e){if(!e||typeof e!=`string`)return{platform:`unknown`,meetingUrl:``,meetingId:``,passcode:``,scheduledTime:``};let t=e.replace(/=\r?\n/g,``).replace(/=3D/gi,`=`),n=`unknown`,r=``,i=t.match(/https:\/\/teams\.microsoft\.com\/(?:l\/meetup-join|meet)\/[^\s<>"]+/i),a=t.match(/https:\/\/[a-zA-Z0-9.-]*zoom\.us\/[jsw]\/[^\s<>"]+/i),o=t.match(/https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}[^\s<>"]*/i),s=t.match(/https:\/\/[a-zA-Z0-9.-]*webex\.com\/[^\s<>"]+/i);i?(n=`teams`,r=i[0]):a?(n=`zoom`,r=a[0]):o?(n=`meet`,r=o[0]):s&&(n=`webex`,r=s[0]);let c=``,l=t.match(/(?:Meeting\s*ID|Meeting\s*Number|ID):?\s*([0-9\s-]{8,22})/i);l&&(c=l[1].trim());let u=``,d=t.match(/(?:Passcode|Password|Pass|PIN|Code):?\s*([a-zA-Z0-9!@#$%^&*_-]{4,20})/i);d&&(u=d[1].trim());let f=``,p=t.match(/(?:at|for|time:?)\s*([0-1]?[0-9](?::[0-5][0-9])?\s*(?:am|pm)\b(?:\s*(?:AEST|AEDT|AWST|ACST|UTC|GMT|EST|EDT|CST|CDT|PST|PDT))?)/i);return p&&(f=p[1].trim()),{platform:n,meetingUrl:r,meetingId:c,passcode:u,scheduledTime:f}}function f(e={}){let t={platform:e.meetingPlatform||`unknown`,meetingUrl:e.meetingUrl||e.meeting_url||e.meetingLink||``,meetingId:e.meetingId||e.meeting_id||``,passcode:e.passcode||e.password||e.meetingPasscode||``,scheduledTime:e.scheduledTime||e.interviewTime||``,scheduledDate:e.scheduledDate||e.interviewDate||``,interviewers:Array.isArray(e.interviewers)?[...e.interviewers]:[]},n=[];e.notes&&n.push(e.notes),e.rawEmail&&n.push(e.rawEmail),e.email_text&&n.push(e.email_text),e.interviewInvite&&n.push(typeof e.interviewInvite==`string`?e.interviewInvite:JSON.stringify(e.interviewInvite));let r=e.email_events||e.emailEvents||e.emailHistory||[];Array.isArray(r)&&r.forEach(e=>{e.body&&n.push(e.body),e.snippet&&n.push(e.snippet),e.subject&&n.push(e.subject),(e.from||e.sender)&&n.push(`From: ${e.from||e.sender}`),(e.to||e.recipients)&&n.push(`To: ${Array.isArray(e.to)?e.to.join(`, `):e.to||e.recipients}`)});let i=n.join(`

`);if(i){let e=d(i);if(!t.meetingUrl&&e.meetingUrl&&(t.meetingUrl=e.meetingUrl,t.platform=e.platform),!t.meetingId&&e.meetingId&&(t.meetingId=e.meetingId),!t.passcode&&e.passcode&&(t.passcode=e.passcode),!t.scheduledTime&&e.scheduledTime&&(t.scheduledTime=e.scheduledTime),t.interviewers.length===0)for(let e of[/(?:meeting with|interview with|meet with|attendees?:?)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s+(?:and|&)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)?)/i,/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*(?:and|&)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*(?:aren’t|will join|are on the panel)/i,/([A-Z][a-z]+\s+[A-Z][a-z]+)\s*will\s+also\s+join/i]){let n=i.match(e);n&&(n[1]&&!n[2]?n[1].split(/(?:,\s*|\s+(?:and|&)\s+)/i).filter(Boolean).forEach(e=>{let n=e.trim();n&&![`The`,`Our`,`Your`,`Tomorrow`,`Please`].includes(n)&&t.interviewers.push({name:n,role:`Hiring Panelist`,focus:`Role alignment & operational impact`,dropTerms:`Governance, Automation, Delivery`})}):n[1]&&n[2]&&[n[1],n[2]].forEach(e=>{let n=e.trim();n&&!t.interviewers.some(e=>e.name===n)&&t.interviewers.push({name:n,role:`Hiring Panelist`,focus:`Core requirements & team fit`,dropTerms:`Best practices, Production metrics`})}))}}return t.interviewers.length===0&&(t.interviewers=[{name:`Hiring Manager / Team Lead`,role:`Direct Manager`,focus:`Autonomy, operational velocity & reliable execution`,dropTerms:`Scrum, Root Cause Analysis, Documentation, SRE`},{name:`Technical Architect / Principal`,role:`Technical Architect`,focus:`Architectural rigor, edge cases & zero-downtime governance`,dropTerms:`Idempotency, Decoupled State, CI/CD, Least Privilege`},{name:`Talent & Culture Lead`,role:`People Partner`,focus:`Communication, stakeholder empathy & growth mindset`,dropTerms:`Cross-functional enablement, Mentorship, Continuous improvement`}]),t}function p(e={}){let t=`${e.title||``} ${e.description||``} ${e.requirements?e.requirements.join(` `):``}`.toLowerCase();return t.includes(`sharepoint`)||t.includes(`nintex`)||t.includes(`m365`)||t.includes(`power automate`)?[`Never call legacy systems "broken" or dismiss existing Nintex workflows—respect the years of investment and praise their reliability before proposing modernization.`,`Never propose managing user access via item/folder permissions—always emphasize Entra ID security groups and M365 role-based governance.`,`Never advocate building production flows under personal accounts—strictly enforce Service Principals, Key Vault secrets, and tenant ALM.`]:t.includes(`devops`)||t.includes(`cloud`)||t.includes(`aws`)||t.includes(`azure`)||t.includes(`terraform`)?[`Never suggest manual console modifications in production—always anchor every change to IaC (Terraform/Bicep) with version-controlled pull requests.`,`Never dismiss legacy on-prem systems or technical debt—frame hybrid infrastructure as a deliberate business decision requiring thoughtful bridge architectures.`,`Never prioritize raw deployment velocity over security boundaries and rollback plans—emphasize canary deployments and automated health gates.`]:t.includes(`data`)||t.includes(`python`)||t.includes(`sql`)||t.includes(`etl`)||t.includes(`analytics`)?[`Never assume source data is clean or static—always discuss defensive schema validation, idempotency, and retry mechanisms.`,`Never treat query optimization as an afterthought—cite partition pruning, indexing, and cost control limits.`,`Never present technical findings in a vacuum—always connect data pipelines to business KPIs and decision velocity.`]:[`Never answer in pure abstract theory without anchoring to a real production metric or quantifiable business outcome.`,`Never point fingers at past teams or stakeholders—always frame previous friction around misaligned incentives and how you unified them.`,`Never exceed 90 seconds without checking in or grounding your answer back in their specific organizational reality.`]}function m(e={},t={}){e.interviewTalkingPoints;let n=`${t.title||``} ${t.description||``}`.toLowerCase();return n.includes(`sharepoint`)||n.includes(`m365`)?[{value:`5,000`,label:`SQL List Threshold`},{value:`300k`,label:`Sync Limit`},{value:`30 Days`,label:`Power Automate Flow Cap`},{value:`400`,label:`URL Path Cap`},{value:`660k`,label:`Dept of Ed Users`},{value:`87%`,label:`Cutover Time Reduction`}]:n.includes(`cloud`)||n.includes(`devops`)||n.includes(`aws`)||n.includes(`azure`)?[{value:`99.99%`,label:`Production Uptime`},{value:`85%`,label:`Provisioning Cut`},{value:`660k`,label:`Identities Migrated`},{value:`0`,label:`Unplanned Downtime`},{value:`12+`,label:`Years Experience`},{value:`100h/mo`,label:`Automation Savings`}]:[{value:`660k+`,label:`Enterprise Users`},{value:`87%`,label:`Cycle Time Reduction`},{value:`1,000+`,label:`Managed Environments`},{value:`100%`,label:`On-Time Delivery`},{value:`12+`,label:`Years Track Record`},{value:`100h/mo`,label:`Manual Time Eliminated`}]}function h(e={},t={}){return[{title:`Incident Reduction & Automated Auditing`,company:`Capgemini / Victorian Dept of Education`,color:`#7c3aed`,situation:`Constant access breakages and permission tickets across 660k users & 1,000+ sites.`,action:`Built unattended PnP PowerShell scripts performing continuous automated permission audits and alerting.`,result:`Cut repeat access incidents by 15% and saved 160 hours of manual audit time per month.`},{title:`Migration Speed & Batch Automation`,company:`Knosys / GreenOrbit Intranet`,color:`#0284c7`,situation:`Stalling cutovers taking 2+ hours per batch with frequent path and character limit errors.`,action:`Automated pre-flight path validation, chunking, and multithreaded retry execution via PowerShell.`,result:`Cut batch cutover processing time by 87% (from 2 hours down to 15 minutes).`},{title:`ServiceNow & Workflow Automation`,company:`Australia Post via Capgemini`,color:`#059669`,situation:`Hundreds of hours lost cross-referencing ServiceNow queues and manual roster assignments.`,action:`Engineered custom automation scripts bridging ServiceNow API with SharePoint tracking rosters.`,result:`Eliminated over 100 hours of manual ticket triage and data entry every month.`},{title:`Enterprise Intranet Modernization`,company:`Engage Squared / Cimic Group & Transurban`,color:`#d97706`,situation:`Alliance civil infrastructure teams suffered from chaotic file shares and scattered project docs.`,action:`Delivered modern SharePoint Online hub-and-spoke site architecture with automated provisioning.`,result:`Cut project site onboarding time by 25% with 94% first-month stakeholder adoption.`},{title:`Zero-Disruption Clinical Cutover`,company:`St John of God Health Care`,color:`#e11d48`,situation:`Clinical staff highly apprehensive about operating system upgrades disrupting acute workflows.`,action:`Ran hands-on application validation workshops and 1-on-1 clinician handovers before cutover day.`,result:`Achieved 100% on-time cutover with zero clinical disruption or patient care impact.`}]}function g(e={},t={}){let n=e.company||`the team`;return e.title,[{category:`Strategic Alignment`,question:`Looking at ${n}’s roadmap for the next 6 to 12 months, what is the single biggest operational bottleneck you want the person in this role to solve first?`,targetAudience:`Hiring Manager / Team Lead`,rationale:`Shows immediate desire to create business impact and prioritize where leadership feels pain.`},{category:`Technical Architecture & Governance`,question:`How does the team currently strike the balance between rapid workflow delivery for users and long-term security/governance compliance?`,targetAudience:`Technical Evaluator / Lead Architect`,rationale:`Signals that you respect both business speed and enterprise security guardrails.`},{category:`Team Velocity & Tooling`,question:`What does the current deployment and release lifecycle look like when modernizing workflows or releasing new scripts to production?`,targetAudience:`Senior Engineers / Peers`,rationale:`Reveals day-to-day engineering maturity, CI/CD adoption, and change management friction.`},{category:`Definition of Success`,question:`If we look back 12 months from now, what would have to happen for you to say, "Hiring this person was the best decision we made this year"?`,targetAudience:`Full Panel`,rationale:`Forces the panel to visualize you already thriving in the role and defines the exact scorecard.`}]}function _(e={},t={},n={}){let r=e.company||`your organization`,i=e.title||`Senior Systems Specialist`,a=t.name||`Sam Ludwig`;t.title;let o=t.yearsOfExperience||12,s=n.interviewers&&n.interviewers[0]&&n.interviewers[0].name?n.interviewers[0].name.split(` `)[0]:`everyone`;return[{id:`pitch`,category:`cat-pitch`,categoryLabel:`🎯 Pitch`,title:`1. Opening Pitch: "Tell Me About Yourself"`,badge:`Conversational • ~90 Seconds`,badgeColor:`green`,scanLabel:`⚡ 5-Second Brain Glances:`,scanBar:`<strong>${o}+ yrs Systems & Infrastructure</strong> &rarr; <strong>Enterprise M365 & Automation</strong> (Capgemini / Dept of Ed) &rarr; <strong>660k users / 1,000+ sites</strong> &rarr; <strong>ServiceNow & Scripting</strong> (AusPost).`,spokenLabel:`🗣️ What to Actually Say (Human & Conversational):`,spokenScript:`
        <p>"Thanks ${s}. So, I’m ${a}—a senior systems and infrastructure engineer with over ${o} years of hands-on enterprise experience, focusing heavily on cloud platforms, automation with PowerShell and Python, and modern workplace environments.</p>
        <p>My career has really been a blend of high-impact consulting delivery and large-scale enterprise operations. Working with <span class="hl">Capgemini consulting to the Victorian Department of Education</span>, I was supporting a massive government environment—over <span class="hl-green">660,000 users and 1,000 site collections</span>. A major win there was designing unattended automation scripts that performed continuous permission and MFA audits across more than <span class="hl-green">200 sensitive repositories</span>, eliminating what previously took weeks of manual effort.</p>
        <p>Earlier this year at <span class="hl">Australia Post</span>, I developed automations bridging ServiceNow queues directly with team workflow rosters, eliminating over <span class="hl-green">100 hours of manual ticket sorting every month</span>. Prior to that at <span class="hl">Knosys</span>, I built multithreaded migration scripts that cut batch cutover times by <span class="hl-green">87%</span>.</p>
        <p>What really drew me to this role at <span class="hl">${r}</span> is the scale of your operations and where your technology stack is heading. Whether that's modernizing legacy workflows, tightening tenant security governance, or driving automation across complex infrastructure—that intersection is right in my wheelhouse."</p>
      `,notesId:`note-pitch`,statusId:`status-pitch`,placeholder:`Jot notes or tweaks for opening pitch...`},{id:`automation`,category:`cat-tech`,categoryLabel:`⚡ Tech Deep Dive`,title:`2. Technical Deep Dive: Enterprise Automation & Scripting`,badge:`Architecture & Resilience`,badgeColor:`blue`,scanLabel:`⚡ 5-Second Brain Glances:`,scanBar:`Idempotency &rarr; <strong>Try-Catch-Finally Scopes</strong> &rarr; <strong>Service Principals / Key Vault</strong> &rarr; <strong>Structured JSON Logging</strong> &rarr; <strong>Rate Limit Backoff</strong>.`,likelyQuestion:`Likely Question: "How do you approach building robust automation scripts that run unattended in production?"`,spokenLabel:`🗣️ What to Actually Say:`,spokenScript:`
        <p>"Whenever I build scripts or workflows that run unattended, I treat them with full production software discipline. The three pillars I focus on are <span class="hl">idempotency</span>, <span class="hl">credential isolation</span>, and <span class="hl">defensive telemetry</span>.</p>
        <p>First, idempotency: a script must be able to fail midway, restart, and pick up without creating duplicate records or corrupting state. I structure execution in distinct pre-flight verification, chunked processing, and reconciliation passes.</p>
        <p>Second, security: I never use hardcoded credentials or personal service accounts. Everything runs via <span class="hl">Azure Entra ID Service Principals</span> with certificate authentication or managed identities scoped to strict least-privilege permissions.</p>
        <p>And third, telemetry: instead of generic log dumps, I emit structured JSON logs that capture duration, throttling responses (like HTTP 429 backoff with jitter), and exact entity IDs. That way, if an API rate-limits at 2:00 AM, the script automatically backs off and alerts without human intervention."</p>
      `,notesId:`note-automation`,statusId:`status-automation`,placeholder:`Jot talking points on automation...`},{id:`governance`,category:`cat-gov`,categoryLabel:`🛡️ Governance`,title:`3. Governance, Security & Compliance at Scale`,badge:`Enterprise Security`,badgeColor:`purple`,scanLabel:`⚡ 5-Second Brain Glances:`,scanBar:`Least Privilege &rarr; <strong>Australian Essential 8 Baseline</strong> &rarr; <strong>Separation of Environments (Dev/Stage/Prod)</strong> &rarr; <strong>Audit Logging</strong>.`,likelyQuestion:`Likely Question: "How do you enforce security and compliance standards without grinding business velocity to a halt?"`,spokenLabel:`🗣️ What to Actually Say:`,spokenScript:`
        <p>"The biggest mistake technical teams make is treating governance as an obstruction or an afterthought. I look at governance as <span class="hl">guardrails on a racetrack</span>—they let the organization move faster because you know you aren't going to drive off the cliff.</p>
        <p>When I was at the Department of Education, we aligned directly to the Victorian Protective Data Security Standards and <span class="hl">Essential 8</span>. Rather than asking users to fill out ten-page compliance requests, we built self-service automated templates that had least-privilege access, auditing, and retention tags baked in from second zero.</p>
        <p>If you give business users an approved, pre-secured path of least resistance, they will naturally follow it because it is faster than rogue IT."</p>
      `,notesId:`note-gov`,statusId:`status-gov`,placeholder:`Jot governance and compliance notes...`},{id:`incident`,category:`cat-behavioral`,categoryLabel:`🚨 Incident Response`,title:`4. Production Incident & High-Pressure Recovery`,badge:`STAR Story`,badgeColor:`amber`,scanLabel:`⚡ 5-Second Brain Glances:`,scanBar:`Contain First &rarr; <strong>Blameless Root Cause Analysis (RCA)</strong> &rarr; <strong>Fix the System, Not the Symptom</strong> &rarr; <strong>Transparent Stakeholder Comms</strong>.`,likelyQuestion:`Likely Question: "Tell me about a time when a critical system went down or an automation failed in production."`,spokenLabel:`🗣️ What to Actually Say:`,spokenScript:`
        <p>"Early on during an enterprise cutover batch, an automated sync script hit unexpected rate-limiting from a downstream cloud API, which caused several hundred records to halt in an intermediate pending state right before morning business hours.</p>
        <p>My first action was immediate containment: pausing the batch trigger to prevent queue congestion and notifying the incident lead with a clear, calm status update: what occurred, user impact, and estimated resolution time.</p>
        <p>I inspected the transaction logs, isolated the failed batch indices, and deployed a targeted retry patch utilizing exponential backoff. We restored the pipeline within 20 minutes with zero data loss.</p>
        <p>Afterwards, I led a <span class="hl">blameless post-mortem</span> and added synthetic pre-flight queue health checks to our standard release pipeline so the condition could never repeat."</p>
      `,notesId:`note-incident`,statusId:`status-incident`,placeholder:`Jot incident response talking points...`},{id:`why-company`,category:`cat-company`,categoryLabel:`🏢 Company Fit`,title:`5. Why ${r}? (Strategic Alignment)`,badge:`High Conviction`,badgeColor:`green`,scanLabel:`⚡ 5-Second Brain Glances:`,scanBar:`Mission & Scale &rarr; <strong>Culture of High Reliability</strong> &rarr; <strong>Immediate Value Delivery</strong> &rarr; <strong>Long-Term Engineering Home</strong>.`,likelyQuestion:`Likely Question: "Why do you want to join ${r} and why this role specifically?"`,spokenLabel:`🗣️ What to Actually Say:`,spokenScript:`
        <p>"Two key things drew me directly to <span class="hl">${r}</span>.</p>
        <p>First, the scale and tangible real-world impact of your projects. When you support infrastructure and engineering systems at this level, technical reliability directly enables mission-critical work. I thrive in environments where downtime isn't just an inconvenience, but something that truly matters.</p>
        <p>Second, the timing of this role: reading through the mandate for <span class="hl">${i}</span>, you aren't just looking for someone to maintain status quo tickets; you're looking for someone to modernize workflows, optimize architecture, and build sustainable automation. That exact combination is where I have spent the last decade delivering measurable wins."</p>
      `,notesId:`note-why`,statusId:`status-why`,placeholder:`Jot notes on ${r} alignment...`}]}function v(e={},r=null,i={}){let a=r,o=i;r&&typeof r==`object`&&(`bespokeData`in r||`meetingUrl`in r||`candidateProfile`in r||`meetingInfo`in r||`scheduledTime`in r||`interviewers`in r||`panelMembers`in r)&&(o=r,a=r.candidateProfile||null),a=a||(t()?.name?t():null)||n;let c={...f(e),...o.meetingInfo||{}};o.meetingUrl&&(c.meetingUrl=o.meetingUrl),o.meetingId&&(c.meetingId=o.meetingId),o.passcode&&(c.passcode=o.passcode),o.scheduledTime&&(c.scheduledTime=o.scheduledTime),o.interviewers&&Array.isArray(o.interviewers)&&(c.interviewers=o.interviewers),o.panelMembers&&Array.isArray(o.panelMembers)&&(c.interviewers=o.panelMembers);let l=e.company||`Enterprise Partner`,u=e.title||`Technical Specialist`,d=`${l} Master Interview Command Center — ${a.name||`Candidate`}`,v=o.bespokeData||e.masterCheatSheet||e.intelligence?.master_cheat_sheet||s(e,`master_cheat_sheet`);v&&Array.isArray(v.interviewers)&&v.interviewers.length>0&&(!o.interviewers||o.interviewers.length===0)&&(c.interviewers=v.interviewers);let y=v&&Array.isArray(v.traps)&&v.traps.length>0?v.traps:p(e),b=v&&Array.isArray(v.numbersToDrop)&&v.numbersToDrop.length>0?v.numbersToDrop:m(a,e),x=v&&Array.isArray(v.starStories)&&v.starStories.length>0?v.starStories:h(a,e),S=v&&Array.isArray(v.reverseQuestions)&&v.reverseQuestions.length>0?v.reverseQuestions:g(e,c),C=v&&Array.isArray(v.qnaCards)&&v.qnaCards.length>0?v.qnaCards:_(e,a,c),w=`Video Conference`,T=`#4f46e5`,E=`#eef2ff`;c.platform===`teams`||c.meetingUrl&&c.meetingUrl.includes(`teams.microsoft.com`)?(w=`📹 Microsoft Teams`,T=`#4f46e5`,E=`#eef2ff`):c.platform===`zoom`||c.meetingUrl&&c.meetingUrl.includes(`zoom.us`)?(w=`📹 Zoom Meeting`,T=`#0284c7`,E=`#e0f2fe`):(c.platform===`meet`||c.meetingUrl&&c.meetingUrl.includes(`meet.google.com`))&&(w=`📹 Google Meet`,T=`#059669`,E=`#ecfdf5`);let D=c.interviewers.map((e,t)=>{let n=[`var(--primary)`,`var(--success)`,`var(--warning)`,`var(--purple)`],r=[`var(--primary-dark)`,`var(--success)`,`var(--warning)`,`var(--purple)`];return`
      <div style="border-left: 3px solid ${n[t%n.length]}; padding-left: 8px;">
        <strong style="color: ${r[t%r.length]};">${e.name} (${e.role||`Panelist`}):</strong>
        <div style="color: var(--text-subtle); margin-top: 2px;">
          ${e.focus||`Strategic delivery & competency`}.
          ${e.dropTerms?`<br/><span style="font-size: 0.76rem; color: #475569;">Drop: <em>${e.dropTerms}</em></span>`:``}
        </div>
      </div>
    `}).join(`
`),O=y.map(e=>{if(typeof e==`string`)return`<li>${e}</li>`;if(e&&typeof e==`object`){let t=e.trap||e.text||e.title||``,n=e.reason||e.description||``;return`<li><strong>${t}</strong>${n?` — <span style="color: #64748b;">${n}</span>`:``}</li>`}return``}).filter(Boolean).join(`
`),k=b.map(e=>`
      <div style="background:#f8fafc; padding:6px 8px; border-radius:6px; border:1px solid #e2e8f0;">
        <strong style="color: #0f172a; font-size: 0.95rem;">${e.value||e.number||``}</strong>
        <div style="color:#64748b; font-size: 0.72rem; line-height: 1.2;">${e.label||e.context||e.description||``}</div>
      </div>
    `).join(`
`),A=C.map((e,t)=>{let n=e.id||`card-${t}`,r=e.badgeColor||(e.badgeClass?e.badgeClass.replace(`badge-`,``):`blue`),i=e.badge||e.categoryLabel||e.category||`Core Question`,a=e.scanLabel||`⚡ 5-Second Brain Glances:`,o=e.scanBar||e.adhdScan||e.glance||``,s=e.spokenLabel||`🗣️ What to Actually Say:`,c=e.spokenScript||e.script||e.answer||``,l=e.notesId||`note-${n}`,u=e.statusId||`status-${n}`,d=e.placeholder||`Type quick keywords or personal notes for this question...`,f=e.likelyQuestion||(e.question?`Likely Question: '${e.question}'`:``),p=e.title||e.question||`Question ${t+1}`;return`
      <div class="card qa-card ${e.category||`all`}" id="sec-${n}">
        <div class="card-header">
          <h3 class="card-title">${p}</h3>
          <span class="badge badge-${r}">${i}</span>
        </div>

        <div class="scan-bar ${r===`green`?`green-bar`:r===`amber`?`amber-bar`:r===`purple`?`purple-bar`:``}">
          <div class="scan-label">${a}</div>
          <div>${o}</div>
        </div>

        ${f?`<p style="font-size:0.88rem; color:#475569; margin: 0 0 10px 0;"><strong>${f}</strong></p>`:``}

        <div class="spoken-script">
          <div class="spoken-label">${s}</div>
          ${c}
        </div>

        <textarea id="${l}" placeholder="${d}"></textarea>
        <span class="save-status" id="${u}">Saved to Local Storage!</span>
      </div>
    `}).join(`
`),j=[`#7c3aed`,`#0284c7`,`#059669`,`#d97706`,`#dc2626`],M=x.map((e,t)=>{let n=e.color||j[t%j.length],r=e.company||e.tag||`Track Record`;return`
      <div style="background: #f8fafc; border-left: 3px solid ${n}; padding: 8px 10px; border-radius: 0 6px 6px 0;">
        <strong style="color: ${n}; font-size: 0.82rem;">${t+1}. ${e.title||`Accomplishment`}</strong>
        <div style="color: #64748b; font-size: 0.72rem; font-weight: 600; margin-bottom: 3px;">${r}</div>
        <div style="font-size: 0.76rem; color: #334155;"><strong>S:</strong> ${e.situation||``}</div>
        <div style="font-size: 0.76rem; color: #334155;"><strong>A:</strong> ${e.action||``}</div>
        <div style="font-size: 0.76rem; color: #047857; font-weight: 600;"><strong>R:</strong> ${e.result||``}</div>
      </div>
    `}).join(`
`),N=S.map((e,t)=>{let n=typeof e==`string`?e:e.question||e.text||``;return`
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <span class="badge badge-blue" style="font-size: 0.65rem;">${typeof e==`object`&&e.category?e.category:`Strategic Value`}</span>
          <span style="font-size: 0.7rem; color: #64748b; font-weight: 600;">Target: ${typeof e==`object`&&e.targetAudience?e.targetAudience:`Interview Panel`}</span>
        </div>
        <div style="font-size: 0.82rem; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
          "${n}"
        </div>
        <div style="font-size: 0.73rem; color: #475569; font-style: italic;">
          💡 ${typeof e==`object`&&(e.rationale||e.why)?e.rationale||e.why:`Signals strategic domain depth and execution focus.`}
        </div>
      </div>
    `}).join(`
`),P=`cheat-sheet-${(l+`-`+u).toLowerCase().replace(/[^a-z0-9]/g,`-`)}`;return`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${d}</title>
    <style>
        :root {
            --bg-body: #f1f5f9;
            --bg-card: #ffffff;
            --text-main: #0f172a;
            --text-muted: #334155;
            --text-subtle: #64748b;
            --primary: #0284c7;
            --primary-dark: #0369a1;
            --primary-soft: #e0f2fe;
            --success: #059669;
            --success-soft: #ecfdf5;
            --warning: #d97706;
            --warning-soft: #fffbeb;
            --danger: #dc2626;
            --danger-soft: #fef2f2;
            --purple: #7c3aed;
            --purple-soft: #f5f3ff;
            --border: #cbd5e1;
            --border-light: #e2e8f0;
            --radius-sm: 6px;
            --radius-md: 10px;
            --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
            --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.08);
        }

        * { box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-body);
            color: var(--text-main);
            line-height: 1.6;
            margin: 0;
            padding: 14px;
        }

        /* RESPONSIVE 3-COLUMN COCKPIT */
        .layout-grid {
            display: grid;
            grid-template-columns: 290px minmax(0, 1fr) 330px;
            grid-template-areas: "left center right";
            gap: 16px;
            max-width: 1800px;
            margin: 0 auto;
            align-items: start;
        }

        /* ADHD FOCUS MODE TOGGLE */
        body.focus-mode .sidebar-left,
        body.focus-mode .sidebar-right {
            display: none !important;
        }
        body.focus-mode .layout-grid {
            grid-template-columns: 1fr !important;
            grid-template-areas: "center" !important;
            max-width: 1040px !important;
        }

        @media (max-width: 1300px) {
            .layout-grid {
                grid-template-columns: 270px minmax(0, 1fr);
                grid-template-areas: 
                    "left center"
                    "right center";
            }
        }

        @media (max-width: 980px) {
            .layout-grid {
                display: flex;
                flex-direction: column;
            }
            .main-column { order: 1; width: 100%; }
            .sidebar-left { order: 2; width: 100%; position: static; max-height: none; }
            .sidebar-right { order: 3; width: 100%; position: static; max-height: none; }
        }

        .sidebar-left { grid-area: left; }
        .main-column { grid-area: center; }
        .sidebar-right { grid-area: right; }

        /* STICKY SIDEBARS */
        .sidebar {
            position: sticky;
            top: 14px;
            max-height: calc(100vh - 28px);
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }
        .sidebar::-webkit-scrollbar { width: 5px; }
        .sidebar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

        /* CARDS */
        .card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: 18px 20px;
            box-shadow: var(--shadow-sm);
            margin-bottom: 14px;
        }

        .card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid var(--border-light);
            gap: 8px;
            flex-wrap: wrap;
        }

        .card-title {
            font-size: 1.15rem;
            font-weight: 700;
            margin: 0;
            color: #0f172a;
        }

        .badge {
            font-size: 0.72rem;
            font-weight: 700;
            padding: 3px 9px;
            border-radius: 999px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .badge-blue { background: var(--primary-soft); color: var(--primary-dark); }
        .badge-green { background: var(--success-soft); color: var(--success); }
        .badge-amber { background: var(--warning-soft); color: var(--warning); }
        .badge-purple { background: var(--purple-soft); color: var(--purple); }
        .badge-red { background: var(--danger-soft); color: var(--danger); }

        /* ADHD 5-SECOND SCAN BAR */
        .scan-bar {
            background: #f8fafc;
            border-left: 4px solid var(--primary);
            border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
            padding: 9px 12px;
            margin-bottom: 12px;
            font-size: 0.86rem;
            color: #1e293b;
            line-height: 1.45;
        }
        .scan-bar.green-bar { border-left-color: var(--success); background: #f0fdf4; }
        .scan-bar.amber-bar { border-left-color: var(--warning); background: #fefce8; }
        .scan-bar.purple-bar { border-left-color: var(--purple); background: #faf5ff; }

        .scan-label {
            font-size: 0.7rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-subtle);
            margin-bottom: 3px;
        }

        /* NATURAL SPOKEN SCRIPT BOX */
        .spoken-script {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-left: 4px solid var(--success);
            padding: 14px 16px;
            border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
            font-size: 0.94rem;
            line-height: 1.65;
            color: #1e293b;
            margin-bottom: 12px;
        }
        .spoken-script p { margin: 0 0 10px 0; }
        .spoken-script p:last-child { margin-bottom: 0; }

        .spoken-label {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 0.72rem;
            font-weight: 800;
            color: #047857;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        }

        /* HIGHLIGHTS FOR SPEED-SCANNING */
        .hl { font-weight: 700; color: #0369a1; }
        .hl-green { font-weight: 700; color: #047857; }
        .hl-warn { font-weight: 700; color: #b45309; }

        /* CONTROLS BAR */
        .controls-bar {
            background: #ffffff;
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: 8px 12px;
            margin-bottom: 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 8px;
            box-shadow: var(--shadow-sm);
        }

        .filter-group {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }

        .filter-btn {
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            color: #334155;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .filter-btn:hover { background: #e2e8f0; }
        .filter-btn.active {
            background: #0284c7;
            color: #ffffff;
            border-color: #0284c7;
        }

        .view-btn {
            background: #334155;
            color: #ffffff;
            border: none;
            padding: 6px 13px;
            border-radius: 6px;
            font-size: 0.78rem;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.15s ease;
        }
        .view-btn:hover { background: #1e293b; }

        /* 90-SECOND PACING TIMER */
        .timer-widget {
            background: #0f172a;
            color: #f8fafc;
            border-radius: var(--radius-md);
            padding: 10px 14px;
            margin-bottom: 12px;
        }
        .timer-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .timer-digits {
            font-size: 1.4rem;
            font-weight: 800;
            font-family: 'Consolas', monospace;
        }
        .timer-progress {
            height: 5px;
            background: #334155;
            border-radius: 3px;
            overflow: hidden;
            margin-top: 6px;
        }
        .timer-fill {
            height: 100%;
            width: 100%;
            background: #10b981;
            transition: width 1s linear, background-color 0.4s ease;
        }

        /* TEXTAREAS WITH LOCALSTORAGE SAVE */
        textarea {
            width: 100%;
            padding: 8px 10px;
            border: 1px solid #cbd5e1;
            border-radius: var(--radius-sm);
            font-family: inherit;
            font-size: 12px;
            background: #fffdf5;
            resize: vertical;
            min-height: 50px;
            margin-top: 6px;
            box-sizing: border-box;
            line-height: 1.4;
        }
        textarea:focus { outline: 2px solid var(--primary); background: #ffffff; }

        .save-status {
            font-size: 11px;
            color: var(--success);
            margin-top: 2px;
            display: inline-block;
            opacity: 0;
            transition: opacity 0.3s ease;
            font-weight: 600;
        }

        .hidden { display: none !important; }
    </style>
</head>
<body>

<div class="layout-grid">

    <!-- ======================================================== -->
    <!-- LEFT COLUMN: COCKPIT, VIDEO CALL, TIMERS, PANEL, TRAPS   -->
    <!-- ======================================================== -->
    <aside class="sidebar sidebar-left">

        <!-- 1-CLICK CALL CARD -->
        <div class="card" style="border-top: 4px solid #4f46e5; background: ${E}; padding: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <strong style="color: ${T}; font-size: 0.95rem;">${w} ${c.scheduledTime?`(${c.scheduledTime})`:``}</strong>
                <span class="badge" style="background: ${T}; color: #fff;">READY</span>
            </div>
            <div style="font-size: 0.8rem; color: #334155; margin-bottom: 8px;">
                ${c.meetingId?`<div><strong>ID:</strong> ${c.meetingId}</div>`:``}
                ${c.passcode?`<div><strong>Pass:</strong> <code style="background: #e2e8f0; padding: 1px 5px; border-radius: 3px; font-weight: bold;">${c.passcode}</code></div>`:``}
                ${c.scheduledDate?`<div><strong>Date:</strong> ${c.scheduledDate}</div>`:``}
            </div>
            ${c.meetingUrl?`
            <a href="${c.meetingUrl}" target="_blank" rel="noopener noreferrer" style="display: block; text-align: center; background: ${T}; color: #ffffff; font-weight: 700; font-size: 0.85rem; padding: 9px; border-radius: 6px; text-decoration: none;">
                🚀 Join Video Call Now &rarr;
            </a>
            `:`
            <div style="text-align: center; font-size: 0.78rem; color: #64748b; background: #ffffff; padding: 6px; border-radius: 4px; border: 1px dashed #cbd5e1;">
                Link pending in emails / calendar
            </div>
            `}
        </div>

        <!-- 90-SECOND PACING TIMER -->
        <div class="timer-widget">
            <div class="timer-row">
                <span style="font-size: 0.72rem; text-transform: uppercase; color: #94a3b8; font-weight: 700;">⏱️ 90s Answer Timer</span>
                <div style="display: flex; gap: 4px;">
                    <button onclick="toggleTimer()" id="startTimerBtn" style="background: #334155; color: #fff; border:none; padding:2px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer;">Start</button>
                    <button onclick="resetTimer()" style="background: #334155; color: #fff; border:none; padding:2px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer;">Reset</button>
                </div>
            </div>
            <div class="timer-row" style="margin-top: 4px;">
                <span class="timer-digits" id="timerText">01:30</span>
                <span style="font-size: 0.75rem; color: #94a3b8;" id="timerStatus">Target pace</span>
            </div>
            <div class="timer-progress">
                <div class="timer-fill" id="timerFill"></div>
            </div>
        </div>

        <!-- PANEL CUES: WHO IS ASKING? -->
        <div class="card" style="padding: 14px;">
            <div style="font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
                🎯 Who is Asking? (Panel Cues)
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.82rem;">
                ${D}
            </div>
        </div>

        <!-- 3 TRAPS TO AVOID -->
        <div class="card" style="border-top: 3px solid var(--danger); background: #fffafb; padding: 12px;">
            <div style="font-size: 0.82rem; font-weight: 700; color: #991b1b; margin-bottom: 6px;">
                🚫 3 Traps to Avoid
            </div>
            <ul style="margin: 0; padding-left: 16px; font-size: 0.78rem; color: #7f1d1d; display:flex; flex-direction:column; gap:6px;">
                ${O}
            </ul>
        </div>

        <!-- HARD NUMBERS TO DROP -->
        <div class="card" style="padding: 12px;">
            <div style="font-size: 0.82rem; font-weight: 700; color: var(--purple); margin-bottom: 6px;">
                🔢 Numbers to Drop
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 0.78rem;">
                ${k}
            </div>
        </div>

    </aside>


    <!-- ======================================================== -->
    <!-- CENTER COLUMN: NATURAL SPOKEN SCRIPTS & Q&A CARDS       -->
    <!-- ======================================================== -->
    <main class="main-column">

        <!-- TOP CONTROLS & ADHD FOCUS MODE -->
        <div class="controls-bar">
            <div class="filter-group">
                <button class="filter-btn active" onclick="filterCategory('all', this)">👁️ All</button>
                <button class="filter-btn" onclick="filterCategory('cat-pitch', this)">🎯 Pitch</button>
                <button class="filter-btn" onclick="filterCategory('cat-tech', this)">⚡ Tech</button>
                <button class="filter-btn" onclick="filterCategory('cat-gov', this)">🛡️ Governance</button>
                <button class="filter-btn" onclick="filterCategory('cat-behavioral', this)">🚨 Incidents</button>
                <button class="filter-btn" onclick="filterCategory('cat-company', this)">🏢 Why ${l.split(` `)[0]}</button>
            </div>
            <div>
                <button class="view-btn" onclick="toggleFocusMode()" id="focusToggleBtn">🔲 Focus View (Hide Sides)</button>
            </div>
        </div>

        <!-- MODULAR Q&A CARDS -->
        ${A}

    </main>


    <!-- ======================================================== -->
    <!-- RIGHT COLUMN: STAR STORIES, REVERSE QUESTIONS & SOS     -->
    <!-- ======================================================== -->
    <aside class="sidebar sidebar-right">

        <!-- 5 BULLETIZED STAR STORIES -->
        <div class="card" style="border-top: 4px solid var(--success); padding: 14px;">
            <div style="font-size: 0.88rem; font-weight: 700; color: #0f172a; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
                ⭐ 5 Verified STAR Stories
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${M}
            </div>
        </div>

        <!-- REVERSE QUESTIONS FOR PANEL -->
        <div class="card" style="border-top: 4px solid var(--primary); padding: 14px;">
            <div style="font-size: 0.88rem; font-weight: 700; color: #0f172a; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
                ❓ High-Impact Reverse Questions
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${N}
            </div>
        </div>

        <!-- EMERGENCY RESET ANCHOR -->
        <div class="card" style="border-top: 3px solid var(--danger); background: #fef2f2; padding: 12px;">
            <strong style="color: #991b1b; font-size: 0.84rem;">🆘 If Mind Goes Blank:</strong>
            <div style="font-size: 0.8rem; color: #7f1d1d; font-style: italic; margin-top: 3px;">
                "Let me take a step back and frame this from an architecture and governance perspective..."
            </div>
            <div style="font-size: 0.74rem; color: #991b1b; margin-top: 6px; font-weight: 600;">
                1. Discovery &rarr; 2. Guardrails &rarr; 3. Automation &rarr; 4. Enablement
            </div>
        </div>

    </aside>

</div>

<script>
    // 1. CATEGORY FILTER
    function filterCategory(cat, btn) {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');

        document.querySelectorAll('.qa-card').forEach(card => {
            if (cat === 'all' || card.classList.contains(cat)) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        });
    }

    // 2. FOCUS MODE TOGGLE (ADHD RELIEF)
    function toggleFocusMode() {
        const body = document.body;
        const btn = document.getElementById('focusToggleBtn');
        body.classList.toggle('focus-mode');
        if (body.classList.contains('focus-mode')) {
            btn.textContent = '🖥️ Full View (Show Sides)';
        } else {
            btn.textContent = '🔲 Focus View (Hide Sides)';
        }
    }

    // 3. 90-SECOND PACING TIMER
    let timerDuration = 90;
    let timeLeft = timerDuration;
    let timerInterval = null;
    let isRunning = false;

    const timerText = document.getElementById('timerText');
    const timerFill = document.getElementById('timerFill');
    const timerStatus = document.getElementById('timerStatus');
    const startBtn = document.getElementById('startTimerBtn');

    function updateTimerDisplay() {
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        timerText.textContent = mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
        const pct = (timeLeft / timerDuration) * 100;
        timerFill.style.width = pct + '%';

        if (timeLeft > 30) {
            timerFill.style.backgroundColor = '#10b981';
            timerStatus.textContent = 'Target pace';
            timerStatus.style.color = '#94a3b8';
        } else if (timeLeft > 10) {
            timerFill.style.backgroundColor = '#f59e0b';
            timerStatus.textContent = 'Wrap up soon';
            timerStatus.style.color = '#f59e0b';
        } else {
            timerFill.style.backgroundColor = '#ef4444';
            timerStatus.textContent = 'Time to land!';
            timerStatus.style.color = '#ef4444';
        }
    }

    function toggleTimer() {
        if (isRunning) {
            clearInterval(timerInterval);
            isRunning = false;
            startBtn.textContent = 'Resume';
        } else {
            isRunning = true;
            startBtn.textContent = 'Pause';
            timerInterval = setInterval(() => {
                if (timeLeft > 0) {
                    timeLeft--;
                    updateTimerDisplay();
                } else {
                    clearInterval(timerInterval);
                    isRunning = false;
                    startBtn.textContent = 'Start';
                    timerStatus.textContent = 'Done!';
                }
            }, 1000);
        }
    }

    function resetTimer() {
        clearInterval(timerInterval);
        isRunning = false;
        timeLeft = timerDuration;
        startBtn.textContent = 'Start';
        updateTimerDisplay();
    }

    // 4. LOCALSTORAGE PERSISTENT NOTES SCRATCHPAD
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach((textarea) => {
        const key = '${P}:' + textarea.id;
        const statusSpan = document.getElementById('status-' + textarea.id.replace('note-', ''));

        try {
            const saved = localStorage.getItem(key);
            if (saved) textarea.value = saved;
        } catch (e) {}

        let debounce = null;
        textarea.addEventListener('input', function() {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                try {
                    localStorage.setItem(key, textarea.value);
                    if (statusSpan) {
                        statusSpan.style.opacity = '1';
                        setTimeout(() => { statusSpan.style.opacity = '0'; }, 1200);
                    }
                } catch (e) {}
            }, 300);
        });
    });
<\/script>

</body>
</html>`}function y(e,t=`Interview Cheat Sheet`){try{let n=new Blob([e],{type:`text/html;charset=utf-8`}),r=URL.createObjectURL(n),i=window.open(r,`_blank`);if(i)return i.document.title=t,setTimeout(()=>URL.revokeObjectURL(r),1e4),i}catch(e){console.error(`Failed to open cheat sheet in new tab:`,e)}try{let t=window.open(``,`_blank`);if(t)return t.document.open(),t.document.write(e),t.document.close(),t}catch(e){console.error(`Fallback window open also failed:`,e)}return null}function b(e={},t){try{let n=`${(e.company||`Company`).replace(/[^a-zA-Z0-9_-]/g,`_`)}_${(e.title||`Role`).replace(/[^a-zA-Z0-9_-]/g,`_`)}_Interview_Cheat_Sheet.html`,r=new Blob([t],{type:`text/html;charset=utf-8`}),i=URL.createObjectURL(r),a=document.createElement(`a`);a.href=i,a.download=n,document.body.appendChild(a),a.click(),document.body.removeChild(a),setTimeout(()=>URL.revokeObjectURL(i),1e3)}catch(e){console.error(`Failed to download cheat sheet HTML:`,e)}}async function x(e={},r=null,i=null){let a=await u(`master_cheat_sheet`,e,r||t()||n);return await c(e,`master_cheat_sheet`,a,i),a}export{y as a,v as i,f as n,s as o,x as r,b as t};