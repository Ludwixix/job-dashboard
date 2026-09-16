/**
 * interviewCheatSheetService.js
 * Synthesizes target job specifications, candidate profile achievements, and
 * received email communications into a standalone, interactive 3-column Master
 * Interview Command Center cheat sheet modeled directly on the benchmark KBR Cockpit.
 */

import { getActiveProfile, DEFAULT_USER_PROFILE } from './profileService';
import { generateIntelligenceArtifact, saveJobIntelligence, getJobIntelligence } from './jobIntelligenceService';

/**
 * Parses raw text or email bodies to extract meeting links (Teams, Zoom, Meet, Webex),
 * meeting IDs, passcodes, and scheduled interview timings.
 *
 * @param {string} text - Raw email content, notes, or message body.
 * @returns {Object} Extracted conference metadata.
 */
export function parseMeetingDetailsFromText(text) {
  if (!text || typeof text !== 'string') {
    return {
      platform: 'unknown',
      meetingUrl: '',
      meetingId: '',
      passcode: '',
      scheduledTime: '',
    };
  }

  // Clean quoted-printable formatting if present (e.g., =3D -> =, =\n -> '')
  const cleaned = text
    .replace(/=\r?\n/g, '')
    .replace(/=3D/gi, '=');

  // Meeting URLs
  let platform = 'unknown';
  let meetingUrl = '';

  const teamsMatch = cleaned.match(/https:\/\/teams\.microsoft\.com\/(?:l\/meetup-join|meet)\/[^\s<>"]+/i);
  const zoomMatch = cleaned.match(/https:\/\/[a-zA-Z0-9.-]*zoom\.us\/[jsw]\/[^\s<>"]+/i);
  const meetMatch = cleaned.match(/https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}[^\s<>"]*/i);
  const webexMatch = cleaned.match(/https:\/\/[a-zA-Z0-9.-]*webex\.com\/[^\s<>"]+/i);

  if (teamsMatch) {
    platform = 'teams';
    meetingUrl = teamsMatch[0];
  } else if (zoomMatch) {
    platform = 'zoom';
    meetingUrl = zoomMatch[0];
  } else if (meetMatch) {
    platform = 'meet';
    meetingUrl = meetMatch[0];
  } else if (webexMatch) {
    platform = 'webex';
    meetingUrl = webexMatch[0];
  }

  // Meeting ID
  let meetingId = '';
  const idMatch = cleaned.match(/(?:Meeting\s*ID|Meeting\s*Number|ID):?\s*([0-9\s-]{8,22})/i);
  if (idMatch) {
    meetingId = idMatch[1].trim();
  }

  // Passcode / Password / PIN
  let passcode = '';
  const passMatch = cleaned.match(/(?:Passcode|Password|Pass|PIN|Code):?\s*([a-zA-Z0-9!@#$%^&*_-]{4,20})/i);
  if (passMatch) {
    passcode = passMatch[1].trim();
  }

  // Scheduled Time / Date
  let scheduledTime = '';
  const timeMatch = cleaned.match(/(?:at|for|time:?)\s*([0-1]?[0-9](?::[0-5][0-9])?\s*(?:am|pm)\b(?:\s*(?:AEST|AEDT|AWST|ACST|UTC|GMT|EST|EDT|CST|CDT|PST|PDT))?)/i);
  if (timeMatch) {
    scheduledTime = timeMatch[1].trim();
  }

  return {
    platform,
    meetingUrl,
    meetingId,
    passcode,
    scheduledTime,
  };
}

/**
 * Extracts all interview communication metadata from a dashboard job object.
 * Inspects job.email_events, job.emailHistory, job.notes, job.meetingDetails, and raw job fields.
 *
 * @param {Object} job - Dashboard job object.
 * @returns {Object} Consolidated meeting details and extracted panel members.
 */
export function extractInterviewMeetingInfo(job = {}) {
  const result = {
    platform: job.meetingPlatform || 'unknown',
    meetingUrl: job.meetingUrl || job.meeting_url || job.meetingLink || '',
    meetingId: job.meetingId || job.meeting_id || '',
    passcode: job.passcode || job.password || job.meetingPasscode || '',
    scheduledTime: job.scheduledTime || job.interviewTime || '',
    scheduledDate: job.scheduledDate || job.interviewDate || '',
    interviewers: Array.isArray(job.interviewers) ? [...job.interviewers] : [],
  };

  // Build corpus of all associated email communications and notes
  const textCorpus = [];

  if (job.notes) textCorpus.push(job.notes);
  if (job.rawEmail) textCorpus.push(job.rawEmail);
  if (job.email_text) textCorpus.push(job.email_text);
  if (job.interviewInvite) textCorpus.push(typeof job.interviewInvite === 'string' ? job.interviewInvite : JSON.stringify(job.interviewInvite));

  // Check email events
  const emailEvents = job.email_events || job.emailEvents || job.emailHistory || [];
  if (Array.isArray(emailEvents)) {
    emailEvents.forEach(evt => {
      if (evt.body) textCorpus.push(evt.body);
      if (evt.snippet) textCorpus.push(evt.snippet);
      if (evt.subject) textCorpus.push(evt.subject);
      if (evt.from || evt.sender) textCorpus.push(`From: ${evt.from || evt.sender}`);
      if (evt.to || evt.recipients) textCorpus.push(`To: ${Array.isArray(evt.to) ? evt.to.join(', ') : evt.to || evt.recipients}`);
    });
  }

  const combinedText = textCorpus.join('\n\n');

  if (combinedText) {
    const parsed = parseMeetingDetailsFromText(combinedText);
    if (!result.meetingUrl && parsed.meetingUrl) {
      result.meetingUrl = parsed.meetingUrl;
      result.platform = parsed.platform;
    }
    if (!result.meetingId && parsed.meetingId) {
      result.meetingId = parsed.meetingId;
    }
    if (!result.passcode && parsed.passcode) {
      result.passcode = parsed.passcode;
    }
    if (!result.scheduledTime && parsed.scheduledTime) {
      result.scheduledTime = parsed.scheduledTime;
    }

    // Try extracting interviewer names if none provided
    if (result.interviewers.length === 0) {
      // Look for patterns like "meeting with Mace and Lisle", "Andrew will also join"
      const namePatterns = [
        /(?:meeting with|interview with|meet with|attendees?:?)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s+(?:and|&)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)?)/i,
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*(?:and|&)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*(?:aren’t|will join|are on the panel)/i,
        /([A-Z][a-z]+\s+[A-Z][a-z]+)\s*will\s+also\s+join/i,
      ];

      for (const pattern of namePatterns) {
        const match = combinedText.match(pattern);
        if (match) {
          if (match[1] && !match[2]) {
            const names = match[1].split(/(?:,\s*|\s+(?:and|&)\s+)/i).filter(Boolean);
            names.forEach(name => {
              const trimmed = name.trim();
              if (trimmed && !['The', 'Our', 'Your', 'Tomorrow', 'Please'].includes(trimmed)) {
                result.interviewers.push({
                  name: trimmed,
                  role: 'Hiring Panelist',
                  focus: 'Role alignment & operational impact',
                  dropTerms: 'Governance, Automation, Delivery',
                });
              }
            });
          } else if (match[1] && match[2]) {
            [match[1], match[2]].forEach(name => {
              const trimmed = name.trim();
              if (trimmed && !result.interviewers.some(p => p.name === trimmed)) {
                result.interviewers.push({
                  name: trimmed,
                  role: 'Hiring Panelist',
                  focus: 'Core requirements & team fit',
                  dropTerms: 'Best practices, Production metrics',
                });
              }
            });
          }
        }
      }
    }
  }

  // Fallback default interviewers if none identified from emails
  if (result.interviewers.length === 0) {
    result.interviewers = [
      {
        name: 'Hiring Manager / Team Lead',
        role: 'Direct Manager',
        focus: 'Autonomy, operational velocity & reliable execution',
        dropTerms: 'Scrum, Root Cause Analysis, Documentation, SRE',
      },
      {
        name: 'Technical Architect / Principal',
        role: 'Technical Architect',
        focus: 'Architectural rigor, edge cases & zero-downtime governance',
        dropTerms: 'Idempotency, Decoupled State, CI/CD, Least Privilege',
      },
      {
        name: 'Talent & Culture Lead',
        role: 'People Partner',
        focus: 'Communication, stakeholder empathy & growth mindset',
        dropTerms: 'Cross-functional enablement, Mentorship, Continuous improvement',
      },
    ];
  }

  return result;
}

/**
 * Formulates the 3 critical traps / landmines to avoid based on the role and company context.
 *
 * @param {Object} job - Dashboard job ad.
 * @returns {string[]} 3 high-risk traps.
 */
export function deriveTrapsToAvoid(job = {}) {
  const text = `${job.title || ''} ${job.description || ''} ${job.requirements ? job.requirements.join(' ') : ''}`.toLowerCase();

  if (text.includes('sharepoint') || text.includes('nintex') || text.includes('m365') || text.includes('power automate')) {
    return [
      'Never call legacy systems "broken" or dismiss existing Nintex workflows—respect the years of investment and praise their reliability before proposing modernization.',
      'Never propose managing user access via item/folder permissions—always emphasize Entra ID security groups and M365 role-based governance.',
      'Never advocate building production flows under personal accounts—strictly enforce Service Principals, Key Vault secrets, and tenant ALM.',
    ];
  }

  if (text.includes('devops') || text.includes('cloud') || text.includes('aws') || text.includes('azure') || text.includes('terraform')) {
    return [
      'Never suggest manual console modifications in production—always anchor every change to IaC (Terraform/Bicep) with version-controlled pull requests.',
      'Never dismiss legacy on-prem systems or technical debt—frame hybrid infrastructure as a deliberate business decision requiring thoughtful bridge architectures.',
      'Never prioritize raw deployment velocity over security boundaries and rollback plans—emphasize canary deployments and automated health gates.',
    ];
  }

  if (text.includes('data') || text.includes('python') || text.includes('sql') || text.includes('etl') || text.includes('analytics')) {
    return [
      'Never assume source data is clean or static—always discuss defensive schema validation, idempotency, and retry mechanisms.',
      'Never treat query optimization as an afterthought—cite partition pruning, indexing, and cost control limits.',
      'Never present technical findings in a vacuum—always connect data pipelines to business KPIs and decision velocity.',
    ];
  }

  // General Senior Engineering / IT
  return [
    'Never answer in pure abstract theory without anchoring to a real production metric or quantifiable business outcome.',
    'Never point fingers at past teams or stakeholders—always frame previous friction around misaligned incentives and how you unified them.',
    'Never exceed 90 seconds without checking in or grounding your answer back in their specific organizational reality.',
  ];
}

/**
 * Returns 6 high-impact numbers and metrics for the candidate to drop during answers.
 *
 * @param {Object} profile - User profile.
 * @param {Object} job - Target job.
 * @returns {Array<{ value: string, label: string }>} Metric pills.
 */
export function deriveNumbersToDrop(profile = {}, job = {}) {
  const customPoints = profile.interviewTalkingPoints || [];
  const text = `${job.title || ''} ${job.description || ''}`.toLowerCase();

  if (text.includes('sharepoint') || text.includes('m365')) {
    return [
      { value: '5,000', label: 'SQL List Threshold' },
      { value: '300k', label: 'Sync Limit' },
      { value: '30 Days', label: 'Power Automate Flow Cap' },
      { value: '400', label: 'URL Path Cap' },
      { value: '660k', label: 'Dept of Ed Users' },
      { value: '87%', label: 'Cutover Time Reduction' },
    ];
  }

  if (text.includes('cloud') || text.includes('devops') || text.includes('aws') || text.includes('azure')) {
    return [
      { value: '99.99%', label: 'Production Uptime' },
      { value: '85%', label: 'Provisioning Cut' },
      { value: '660k', label: 'Identities Migrated' },
      { value: '0', label: 'Unplanned Downtime' },
      { value: '12+', label: 'Years Experience' },
      { value: '100h/mo', label: 'Automation Savings' },
    ];
  }

  return [
    { value: '660k+', label: 'Enterprise Users' },
    { value: '87%', label: 'Cycle Time Reduction' },
    { value: '1,000+', label: 'Managed Environments' },
    { value: '100%', label: 'On-Time Delivery' },
    { value: '12+', label: 'Years Track Record' },
    { value: '100h/mo', label: 'Manual Time Eliminated' },
  ];
}

/**
 * Synthesizes the core STAR stories based on the candidate's verified track record.
 *
 * @param {Object} profile - Candidate profile.
 * @param {Object} job - Target job.
 * @returns {Array<Object>} 5 STAR stories.
 */
export function deriveStarStories(profile = {}, job = {}) {
  return [
    {
      title: 'Incident Reduction & Automated Auditing',
      company: 'Capgemini / Victorian Dept of Education',
      color: '#7c3aed',
      situation: 'Constant access breakages and permission tickets across 660k users & 1,000+ sites.',
      action: 'Built unattended PnP PowerShell scripts performing continuous automated permission audits and alerting.',
      result: 'Cut repeat access incidents by 15% and saved 160 hours of manual audit time per month.',
    },
    {
      title: 'Migration Speed & Batch Automation',
      company: 'Knosys / GreenOrbit Intranet',
      color: '#0284c7',
      situation: 'Stalling cutovers taking 2+ hours per batch with frequent path and character limit errors.',
      action: 'Automated pre-flight path validation, chunking, and multithreaded retry execution via PowerShell.',
      result: 'Cut batch cutover processing time by 87% (from 2 hours down to 15 minutes).',
    },
    {
      title: 'ServiceNow & Workflow Automation',
      company: 'Australia Post via Capgemini',
      color: '#059669',
      situation: 'Hundreds of hours lost cross-referencing ServiceNow queues and manual roster assignments.',
      action: 'Engineered custom automation scripts bridging ServiceNow API with SharePoint tracking rosters.',
      result: 'Eliminated over 100 hours of manual ticket triage and data entry every month.',
    },
    {
      title: 'Enterprise Intranet Modernization',
      company: 'Engage Squared / Cimic Group & Transurban',
      color: '#d97706',
      situation: 'Alliance civil infrastructure teams suffered from chaotic file shares and scattered project docs.',
      action: 'Delivered modern SharePoint Online hub-and-spoke site architecture with automated provisioning.',
      result: 'Cut project site onboarding time by 25% with 94% first-month stakeholder adoption.',
    },
    {
      title: 'Zero-Disruption Clinical Cutover',
      company: 'St John of God Health Care',
      color: '#e11d48',
      situation: 'Clinical staff highly apprehensive about operating system upgrades disrupting acute workflows.',
      action: 'Ran hands-on application validation workshops and 1-on-1 clinician handovers before cutover day.',
      result: 'Achieved 100% on-time cutover with zero clinical disruption or patient care impact.',
    },
  ];
}

/**
 * Synthesizes 4-5 high-impact reverse questions for the candidate to ask the interview panel.
 *
 * @param {Object} job - Target job.
 * @param {Object} meetingInfo - Meeting metadata including interviewers.
 * @returns {Array<Object>} Reverse questions.
 */
export function deriveReverseQuestions(job = {}, meetingInfo = {}) {
  const company = job.company || 'the team';
  const role = job.title || 'this role';

  return [
    {
      category: 'Strategic Alignment',
      question: `Looking at ${company}’s roadmap for the next 6 to 12 months, what is the single biggest operational bottleneck you want the person in this role to solve first?`,
      targetAudience: 'Hiring Manager / Team Lead',
      rationale: 'Shows immediate desire to create business impact and prioritize where leadership feels pain.',
    },
    {
      category: 'Technical Architecture & Governance',
      question: `How does the team currently strike the balance between rapid workflow delivery for users and long-term security/governance compliance?`,
      targetAudience: 'Technical Evaluator / Lead Architect',
      rationale: 'Signals that you respect both business speed and enterprise security guardrails.',
    },
    {
      category: 'Team Velocity & Tooling',
      question: `What does the current deployment and release lifecycle look like when modernizing workflows or releasing new scripts to production?`,
      targetAudience: 'Senior Engineers / Peers',
      rationale: 'Reveals day-to-day engineering maturity, CI/CD adoption, and change management friction.',
    },
    {
      category: 'Definition of Success',
      question: `If we look back 12 months from now, what would have to happen for you to say, "Hiring this person was the best decision we made this year"?`,
      targetAudience: 'Full Panel',
      rationale: 'Forces the panel to visualize you already thriving in the role and defines the exact scorecard.',
    },
  ];
}

/**
 * Synthesizes the Q&A cards (Opening pitch, technical deep-dives, behavioral, company alignment).
 *
 * @param {Object} job - Target job.
 * @param {Object} profile - Candidate profile.
 * @param {Object} meetingInfo - Meeting metadata.
 * @returns {Array<Object>} Q&A cards with spoken scripts, highlights, and scan-bars.
 */
export function deriveQnACards(job = {}, profile = {}, meetingInfo = {}) {
  const company = job.company || 'your organization';
  const role = job.title || 'Senior Systems Specialist';
  const candidateName = profile.name || 'Sam Ludwig';
  const candidateTitle = profile.title || 'Senior Systems & Infrastructure Engineer';
  const yearsExp = profile.yearsOfExperience || 12;

  // Primary interviewer name for personal greeting
  const primaryInterviewer = (meetingInfo.interviewers && meetingInfo.interviewers[0] && meetingInfo.interviewers[0].name)
    ? meetingInfo.interviewers[0].name.split(' ')[0]
    : 'everyone';

  const cards = [
    // 1. OPENING PITCH
    {
      id: 'pitch',
      category: 'cat-pitch',
      categoryLabel: '🎯 Pitch',
      title: '1. Opening Pitch: "Tell Me About Yourself"',
      badge: 'Conversational • ~90 Seconds',
      badgeColor: 'green',
      scanLabel: '⚡ 5-Second Brain Glances:',
      scanBar: `<strong>${yearsExp}+ yrs Systems & Infrastructure</strong> &rarr; <strong>Enterprise M365 & Automation</strong> (Capgemini / Dept of Ed) &rarr; <strong>660k users / 1,000+ sites</strong> &rarr; <strong>ServiceNow & Scripting</strong> (AusPost).`,
      spokenLabel: '🗣️ What to Actually Say (Human & Conversational):',
      spokenScript: `
        <p>"Thanks ${primaryInterviewer}. So, I’m ${candidateName}—a senior systems and infrastructure engineer with over ${yearsExp} years of hands-on enterprise experience, focusing heavily on cloud platforms, automation with PowerShell and Python, and modern workplace environments.</p>
        <p>My career has really been a blend of high-impact consulting delivery and large-scale enterprise operations. Working with <span class="hl">Capgemini consulting to the Victorian Department of Education</span>, I was supporting a massive government environment—over <span class="hl-green">660,000 users and 1,000 site collections</span>. A major win there was designing unattended automation scripts that performed continuous permission and MFA audits across more than <span class="hl-green">200 sensitive repositories</span>, eliminating what previously took weeks of manual effort.</p>
        <p>Earlier this year at <span class="hl">Australia Post</span>, I developed automations bridging ServiceNow queues directly with team workflow rosters, eliminating over <span class="hl-green">100 hours of manual ticket sorting every month</span>. Prior to that at <span class="hl">Knosys</span>, I built multithreaded migration scripts that cut batch cutover times by <span class="hl-green">87%</span>.</p>
        <p>What really drew me to this role at <span class="hl">${company}</span> is the scale of your operations and where your technology stack is heading. Whether that's modernizing legacy workflows, tightening tenant security governance, or driving automation across complex infrastructure—that intersection is right in my wheelhouse."</p>
      `,
      notesId: 'note-pitch',
      statusId: 'status-pitch',
      placeholder: 'Jot notes or tweaks for opening pitch...',
    },

    // 2. TECHNICAL DEEP DIVE #1: AUTOMATION & SCRIPTING
    {
      id: 'automation',
      category: 'cat-tech',
      categoryLabel: '⚡ Tech Deep Dive',
      title: '2. Technical Deep Dive: Enterprise Automation & Scripting',
      badge: 'Architecture & Resilience',
      badgeColor: 'blue',
      scanLabel: '⚡ 5-Second Brain Glances:',
      scanBar: `Idempotency &rarr; <strong>Try-Catch-Finally Scopes</strong> &rarr; <strong>Service Principals / Key Vault</strong> &rarr; <strong>Structured JSON Logging</strong> &rarr; <strong>Rate Limit Backoff</strong>.`,
      likelyQuestion: `Likely Question: "How do you approach building robust automation scripts that run unattended in production?"`,
      spokenLabel: '🗣️ What to Actually Say:',
      spokenScript: `
        <p>"Whenever I build scripts or workflows that run unattended, I treat them with full production software discipline. The three pillars I focus on are <span class="hl">idempotency</span>, <span class="hl">credential isolation</span>, and <span class="hl">defensive telemetry</span>.</p>
        <p>First, idempotency: a script must be able to fail midway, restart, and pick up without creating duplicate records or corrupting state. I structure execution in distinct pre-flight verification, chunked processing, and reconciliation passes.</p>
        <p>Second, security: I never use hardcoded credentials or personal service accounts. Everything runs via <span class="hl">Azure Entra ID Service Principals</span> with certificate authentication or managed identities scoped to strict least-privilege permissions.</p>
        <p>And third, telemetry: instead of generic log dumps, I emit structured JSON logs that capture duration, throttling responses (like HTTP 429 backoff with jitter), and exact entity IDs. That way, if an API rate-limits at 2:00 AM, the script automatically backs off and alerts without human intervention."</p>
      `,
      notesId: 'note-automation',
      statusId: 'status-automation',
      placeholder: 'Jot talking points on automation...',
    },

    // 3. ARCHITECTURE & GOVERNANCE
    {
      id: 'governance',
      category: 'cat-gov',
      categoryLabel: '🛡️ Governance',
      title: '3. Governance, Security & Compliance at Scale',
      badge: 'Enterprise Security',
      badgeColor: 'purple',
      scanLabel: '⚡ 5-Second Brain Glances:',
      scanBar: `Least Privilege &rarr; <strong>Australian Essential 8 Baseline</strong> &rarr; <strong>Separation of Environments (Dev/Stage/Prod)</strong> &rarr; <strong>Audit Logging</strong>.`,
      likelyQuestion: `Likely Question: "How do you enforce security and compliance standards without grinding business velocity to a halt?"`,
      spokenLabel: '🗣️ What to Actually Say:',
      spokenScript: `
        <p>"The biggest mistake technical teams make is treating governance as an obstruction or an afterthought. I look at governance as <span class="hl">guardrails on a racetrack</span>—they let the organization move faster because you know you aren't going to drive off the cliff.</p>
        <p>When I was at the Department of Education, we aligned directly to the Victorian Protective Data Security Standards and <span class="hl">Essential 8</span>. Rather than asking users to fill out ten-page compliance requests, we built self-service automated templates that had least-privilege access, auditing, and retention tags baked in from second zero.</p>
        <p>If you give business users an approved, pre-secured path of least resistance, they will naturally follow it because it is faster than rogue IT."</p>
      `,
      notesId: 'note-gov',
      statusId: 'status-gov',
      placeholder: 'Jot governance and compliance notes...',
    },

    // 4. BEHAVIORAL: INCIDENT RECOVERY
    {
      id: 'incident',
      category: 'cat-behavioral',
      categoryLabel: '🚨 Incident Response',
      title: '4. Production Incident & High-Pressure Recovery',
      badge: 'STAR Story',
      badgeColor: 'amber',
      scanLabel: '⚡ 5-Second Brain Glances:',
      scanBar: `Contain First &rarr; <strong>Blameless Root Cause Analysis (RCA)</strong> &rarr; <strong>Fix the System, Not the Symptom</strong> &rarr; <strong>Transparent Stakeholder Comms</strong>.`,
      likelyQuestion: `Likely Question: "Tell me about a time when a critical system went down or an automation failed in production."`,
      spokenLabel: '🗣️ What to Actually Say:',
      spokenScript: `
        <p>"Early on during an enterprise cutover batch, an automated sync script hit unexpected rate-limiting from a downstream cloud API, which caused several hundred records to halt in an intermediate pending state right before morning business hours.</p>
        <p>My first action was immediate containment: pausing the batch trigger to prevent queue congestion and notifying the incident lead with a clear, calm status update: what occurred, user impact, and estimated resolution time.</p>
        <p>I inspected the transaction logs, isolated the failed batch indices, and deployed a targeted retry patch utilizing exponential backoff. We restored the pipeline within 20 minutes with zero data loss.</p>
        <p>Afterwards, I led a <span class="hl">blameless post-mortem</span> and added synthetic pre-flight queue health checks to our standard release pipeline so the condition could never repeat."</p>
      `,
      notesId: 'note-incident',
      statusId: 'status-incident',
      placeholder: 'Jot incident response talking points...',
    },

    // 5. WHY THIS COMPANY / WHY NOW
    {
      id: 'why-company',
      category: 'cat-company',
      categoryLabel: '🏢 Company Fit',
      title: `5. Why ${company}? (Strategic Alignment)`,
      badge: 'High Conviction',
      badgeColor: 'green',
      scanLabel: '⚡ 5-Second Brain Glances:',
      scanBar: `Mission & Scale &rarr; <strong>Culture of High Reliability</strong> &rarr; <strong>Immediate Value Delivery</strong> &rarr; <strong>Long-Term Engineering Home</strong>.`,
      likelyQuestion: `Likely Question: "Why do you want to join ${company} and why this role specifically?"`,
      spokenLabel: '🗣️ What to Actually Say:',
      spokenScript: `
        <p>"Two key things drew me directly to <span class="hl">${company}</span>.</p>
        <p>First, the scale and tangible real-world impact of your projects. When you support infrastructure and engineering systems at this level, technical reliability directly enables mission-critical work. I thrive in environments where downtime isn't just an inconvenience, but something that truly matters.</p>
        <p>Second, the timing of this role: reading through the mandate for <span class="hl">${role}</span>, you aren't just looking for someone to maintain status quo tickets; you're looking for someone to modernize workflows, optimize architecture, and build sustainable automation. That exact combination is where I have spent the last decade delivering measurable wins."</p>
      `,
      notesId: 'note-why',
      statusId: 'status-why',
      placeholder: `Jot notes on ${company} alignment...`,
    },
  ];

  return cards;
}

/**
 * Generates the complete, standalone, self-contained HTML document for the Master Interview Cheat Sheet.
 * Directly recreates the 3-column architecture, ADHD focus view, 90-second pacing timer,
 * panel cues, spoken scripts, and localStorage scratchpad from the gold standard KBR benchmark.
 *
 * @param {Object} job - Dashboard job details.
 * @param {Object} [profileOverride] - Candidate profile override (defaults to active user profile).
 * @param {Object} [options] - Optional overrides for meeting info or styling.
 * @returns {string} Fully rendered HTML document string.
 */
export function generateInterviewCheatSheetHtml(job = {}, profileOverride = null, options = {}) {
  let profile = profileOverride;
  let opts = options;
  if (profileOverride && typeof profileOverride === 'object' && (
    'bespokeData' in profileOverride ||
    'meetingUrl' in profileOverride ||
    'candidateProfile' in profileOverride ||
    'meetingInfo' in profileOverride ||
    'scheduledTime' in profileOverride ||
    'interviewers' in profileOverride ||
    'panelMembers' in profileOverride
  )) {
    opts = profileOverride;
    profile = profileOverride.candidateProfile || null;
  }
  profile = profile || getActiveProfile() || DEFAULT_USER_PROFILE;

  const meetingInfo = {
    ...extractInterviewMeetingInfo(job),
    ...(opts.meetingInfo || {}),
  };

  if (opts.meetingUrl) meetingInfo.meetingUrl = opts.meetingUrl;
  if (opts.meetingId) meetingInfo.meetingId = opts.meetingId;
  if (opts.passcode) meetingInfo.passcode = opts.passcode;
  if (opts.scheduledTime) meetingInfo.scheduledTime = opts.scheduledTime;
  if (opts.interviewers && Array.isArray(opts.interviewers)) meetingInfo.interviewers = opts.interviewers;
  if (opts.panelMembers && Array.isArray(opts.panelMembers)) meetingInfo.interviewers = opts.panelMembers;

  const company = job.company || 'Enterprise Partner';
  const role = job.title || 'Technical Specialist';
  const candidateName = profile.name || 'Candidate';
  const pageTitle = `${company} Master Interview Command Center — ${candidateName}`;

  // Resolve bespoke AI data if available
  const bespoke = opts.bespokeData ||
                  job.masterCheatSheet ||
                  job.intelligence?.master_cheat_sheet ||
                  getJobIntelligence(job, 'master_cheat_sheet');

  if (bespoke && Array.isArray(bespoke.interviewers) && bespoke.interviewers.length > 0 && (!opts.interviewers || opts.interviewers.length === 0)) {
    meetingInfo.interviewers = bespoke.interviewers;
  }

  const traps = (bespoke && Array.isArray(bespoke.traps) && bespoke.traps.length > 0)
    ? bespoke.traps
    : deriveTrapsToAvoid(job);

  const numbersToDrop = (bespoke && Array.isArray(bespoke.numbersToDrop) && bespoke.numbersToDrop.length > 0)
    ? bespoke.numbersToDrop
    : deriveNumbersToDrop(profile, job);

  const starStories = (bespoke && Array.isArray(bespoke.starStories) && bespoke.starStories.length > 0)
    ? bespoke.starStories
    : deriveStarStories(profile, job);

  const reverseQuestions = (bespoke && Array.isArray(bespoke.reverseQuestions) && bespoke.reverseQuestions.length > 0)
    ? bespoke.reverseQuestions
    : deriveReverseQuestions(job, meetingInfo);

  const qnaCards = (bespoke && Array.isArray(bespoke.qnaCards) && bespoke.qnaCards.length > 0)
    ? bespoke.qnaCards
    : deriveQnACards(job, profile, meetingInfo);

  // Determine conference branding
  let platformLabel = 'Video Conference';
  let platformColor = '#4f46e5';
  let platformBg = '#eef2ff';
  let platformBorder = '#4f46e5';

  if (meetingInfo.platform === 'teams' || (meetingInfo.meetingUrl && meetingInfo.meetingUrl.includes('teams.microsoft.com'))) {
    platformLabel = '📹 Microsoft Teams';
    platformColor = '#4f46e5';
    platformBg = '#eef2ff';
  } else if (meetingInfo.platform === 'zoom' || (meetingInfo.meetingUrl && meetingInfo.meetingUrl.includes('zoom.us'))) {
    platformLabel = '📹 Zoom Meeting';
    platformColor = '#0284c7';
    platformBg = '#e0f2fe';
  } else if (meetingInfo.platform === 'meet' || (meetingInfo.meetingUrl && meetingInfo.meetingUrl.includes('meet.google.com'))) {
    platformLabel = '📹 Google Meet';
    platformColor = '#059669';
    platformBg = '#ecfdf5';
  }

  // Render interviewers markup
  const interviewersHtml = meetingInfo.interviewers.map((p, idx) => {
    const borders = ['var(--primary)', 'var(--success)', 'var(--warning)', 'var(--purple)'];
    const colors = ['var(--primary-dark)', 'var(--success)', 'var(--warning)', 'var(--purple)'];
    const bColor = borders[idx % borders.length];
    const cColor = colors[idx % colors.length];

    return `
      <div style="border-left: 3px solid ${bColor}; padding-left: 8px;">
        <strong style="color: ${cColor};">${p.name} (${p.role || 'Panelist'}):</strong>
        <div style="color: var(--text-subtle); margin-top: 2px;">
          ${p.focus || 'Strategic delivery & competency'}.
          ${p.dropTerms ? `<br/><span style="font-size: 0.76rem; color: #475569;">Drop: <em>${p.dropTerms}</em></span>` : ''}
        </div>
      </div>
    `;
  }).join('\n');

  // Render traps markup
  const trapsHtml = traps.map(trap => {
    if (typeof trap === 'string') return `<li>${trap}</li>`;
    if (trap && typeof trap === 'object') {
      const text = trap.trap || trap.text || trap.title || '';
      const reason = trap.reason || trap.description || '';
      return `<li><strong>${text}</strong>${reason ? ` — <span style="color: #64748b;">${reason}</span>` : ''}</li>`;
    }
    return '';
  }).filter(Boolean).join('\n');

  // Render numbers to drop markup
  const numbersHtml = numbersToDrop.map(num => {
    const value = num.value || num.number || '';
    const label = num.label || num.context || num.description || '';
    return `
      <div style="background:#f8fafc; padding:6px 8px; border-radius:6px; border:1px solid #e2e8f0;">
        <strong style="color: #0f172a; font-size: 0.95rem;">${value}</strong>
        <div style="color:#64748b; font-size: 0.72rem; line-height: 1.2;">${label}</div>
      </div>
    `;
  }).join('\n');

  // Render Q&A cards markup
  const qnaHtml = qnaCards.map((card, idx) => {
    const cardId = card.id || `card-${idx}`;
    const badgeColor = card.badgeColor || (card.badgeClass ? card.badgeClass.replace('badge-', '') : 'blue');
    const badge = card.badge || card.categoryLabel || card.category || 'Core Question';
    const scanLabel = card.scanLabel || '⚡ 5-Second Brain Glances:';
    const scanBar = card.scanBar || card.adhdScan || card.glance || '';
    const spokenLabel = card.spokenLabel || '🗣️ What to Actually Say:';
    const spokenScript = card.spokenScript || card.script || card.answer || '';
    const notesId = card.notesId || `note-${cardId}`;
    const statusId = card.statusId || `status-${cardId}`;
    const placeholder = card.placeholder || 'Type quick keywords or personal notes for this question...';
    const likelyQuestion = card.likelyQuestion || (card.question ? `Likely Question: '${card.question}'` : '');
    const title = card.title || card.question || `Question ${idx + 1}`;
    const categoryClass = card.category || 'all';

    return `
      <div class="card qa-card ${categoryClass}" id="sec-${cardId}">
        <div class="card-header">
          <h3 class="card-title">${title}</h3>
          <span class="badge badge-${badgeColor}">${badge}</span>
        </div>

        <div class="scan-bar ${badgeColor === 'green' ? 'green-bar' : badgeColor === 'amber' ? 'amber-bar' : badgeColor === 'purple' ? 'purple-bar' : ''}">
          <div class="scan-label">${scanLabel}</div>
          <div>${scanBar}</div>
        </div>

        ${likelyQuestion ? `<p style="font-size:0.88rem; color:#475569; margin: 0 0 10px 0;"><strong>${likelyQuestion}</strong></p>` : ''}

        <div class="spoken-script">
          <div class="spoken-label">${spokenLabel}</div>
          ${spokenScript}
        </div>

        <textarea id="${notesId}" placeholder="${placeholder}"></textarea>
        <span class="save-status" id="${statusId}">Saved to Local Storage!</span>
      </div>
    `;
  }).join('\n');

  // Render STAR stories markup
  const storyColors = ['#7c3aed', '#0284c7', '#059669', '#d97706', '#dc2626'];
  const starStoriesHtml = starStories.map((s, idx) => {
    const color = s.color || storyColors[idx % storyColors.length];
    const companyTag = s.company || s.tag || 'Track Record';
    return `
      <div style="background: #f8fafc; border-left: 3px solid ${color}; padding: 8px 10px; border-radius: 0 6px 6px 0;">
        <strong style="color: ${color}; font-size: 0.82rem;">${idx + 1}. ${s.title || 'Accomplishment'}</strong>
        <div style="color: #64748b; font-size: 0.72rem; font-weight: 600; margin-bottom: 3px;">${companyTag}</div>
        <div style="font-size: 0.76rem; color: #334155;"><strong>S:</strong> ${s.situation || ''}</div>
        <div style="font-size: 0.76rem; color: #334155;"><strong>A:</strong> ${s.action || ''}</div>
        <div style="font-size: 0.76rem; color: #047857; font-weight: 600;"><strong>R:</strong> ${s.result || ''}</div>
      </div>
    `;
  }).join('\n');

  // Render reverse questions markup
  const reverseQuestionsHtml = reverseQuestions.map((q, idx) => {
    const questionText = typeof q === 'string' ? q : (q.question || q.text || '');
    const category = typeof q === 'object' && q.category ? q.category : 'Strategic Value';
    const targetAudience = typeof q === 'object' && q.targetAudience ? q.targetAudience : 'Interview Panel';
    const rationale = typeof q === 'object' && (q.rationale || q.why) ? (q.rationale || q.why) : 'Signals strategic domain depth and execution focus.';

    return `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <span class="badge badge-blue" style="font-size: 0.65rem;">${category}</span>
          <span style="font-size: 0.7rem; color: #64748b; font-weight: 600;">Target: ${targetAudience}</span>
        </div>
        <div style="font-size: 0.82rem; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
          "${questionText}"
        </div>
        <div style="font-size: 0.73rem; color: #475569; font-style: italic;">
          💡 ${rationale}
        </div>
      </div>
    `;
  }).join('\n');

  // Build storage prefix unique to this company and job
  const storagePrefix = `cheat-sheet-${(company + '-' + role).toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle}</title>
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
        <div class="card" style="border-top: 4px solid ${platformBorder}; background: ${platformBg}; padding: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <strong style="color: ${platformColor}; font-size: 0.95rem;">${platformLabel} ${meetingInfo.scheduledTime ? `(${meetingInfo.scheduledTime})` : ''}</strong>
                <span class="badge" style="background: ${platformColor}; color: #fff;">READY</span>
            </div>
            <div style="font-size: 0.8rem; color: #334155; margin-bottom: 8px;">
                ${meetingInfo.meetingId ? `<div><strong>ID:</strong> ${meetingInfo.meetingId}</div>` : ''}
                ${meetingInfo.passcode ? `<div><strong>Pass:</strong> <code style="background: #e2e8f0; padding: 1px 5px; border-radius: 3px; font-weight: bold;">${meetingInfo.passcode}</code></div>` : ''}
                ${meetingInfo.scheduledDate ? `<div><strong>Date:</strong> ${meetingInfo.scheduledDate}</div>` : ''}
            </div>
            ${meetingInfo.meetingUrl ? `
            <a href="${meetingInfo.meetingUrl}" target="_blank" rel="noopener noreferrer" style="display: block; text-align: center; background: ${platformColor}; color: #ffffff; font-weight: 700; font-size: 0.85rem; padding: 9px; border-radius: 6px; text-decoration: none;">
                🚀 Join Video Call Now &rarr;
            </a>
            ` : `
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
                ${interviewersHtml}
            </div>
        </div>

        <!-- 3 TRAPS TO AVOID -->
        <div class="card" style="border-top: 3px solid var(--danger); background: #fffafb; padding: 12px;">
            <div style="font-size: 0.82rem; font-weight: 700; color: #991b1b; margin-bottom: 6px;">
                🚫 3 Traps to Avoid
            </div>
            <ul style="margin: 0; padding-left: 16px; font-size: 0.78rem; color: #7f1d1d; display:flex; flex-direction:column; gap:6px;">
                ${trapsHtml}
            </ul>
        </div>

        <!-- HARD NUMBERS TO DROP -->
        <div class="card" style="padding: 12px;">
            <div style="font-size: 0.82rem; font-weight: 700; color: var(--purple); margin-bottom: 6px;">
                🔢 Numbers to Drop
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 0.78rem;">
                ${numbersHtml}
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
                <button class="filter-btn" onclick="filterCategory('cat-company', this)">🏢 Why ${company.split(' ')[0]}</button>
            </div>
            <div>
                <button class="view-btn" onclick="toggleFocusMode()" id="focusToggleBtn">🔲 Focus View (Hide Sides)</button>
            </div>
        </div>

        <!-- MODULAR Q&A CARDS -->
        ${qnaHtml}

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
                ${starStoriesHtml}
            </div>
        </div>

        <!-- REVERSE QUESTIONS FOR PANEL -->
        <div class="card" style="border-top: 4px solid var(--primary); padding: 14px;">
            <div style="font-size: 0.88rem; font-weight: 700; color: #0f172a; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
                ❓ High-Impact Reverse Questions
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${reverseQuestionsHtml}
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
        const key = '${storagePrefix}:' + textarea.id;
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
</script>

</body>
</html>`;
}

/**
 * Opens the generated Master Cheat Sheet HTML in a new browser tab or pop-up.
 *
 * @param {string} htmlContent - Full HTML document string.
 * @param {string} [title] - Optional window title.
 * @returns {Window|null} The opened window instance.
 */
export function openCheatSheetInNewTab(htmlContent, title = 'Interview Cheat Sheet') {
  try {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank');

    if (newWindow) {
      newWindow.document.title = title;
      // Release object URL after window loads
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return newWindow;
    }
  } catch (err) {
    console.error('Failed to open cheat sheet in new tab:', err);
  }

  // Fallback if popup blocked: document.write in opened window or data URL
  try {
    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(htmlContent);
      win.document.close();
      return win;
    }
  } catch (fallbackErr) {
    console.error('Fallback window open also failed:', fallbackErr);
  }

  return null;
}

/**
 * Triggers a browser download of the standalone HTML cheat sheet file.
 *
 * @param {Object} job - Dashboard job.
 * @param {string} htmlContent - Full HTML document string.
 */
export function downloadCheatSheetHtml(job = {}, htmlContent) {
  try {
    const company = (job.company || 'Company').replace(/[^a-zA-Z0-9_-]/g, '_');
    const title = (job.title || 'Role').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${company}_${title}_Interview_Cheat_Sheet.html`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error('Failed to download cheat sheet HTML:', err);
  }
}

/**
 * Asynchronously generates a 100% bespoke Master Interview Cheat Sheet using the active LLM.
 * Saves the artifact across localStorage and the backend SQLite WAL database.
 *
 * @param {Object} job - Target job.
 * @param {Object} [profileOverride] - Candidate profile override.
 * @param {Function} [onUpdateJob] - Optional state update callback.
 * @returns {Promise<Object>} The bespoke cheat sheet data object.
 */
export async function generateBespokeCheatSheet(job = {}, profileOverride = null, onUpdateJob = null) {
  const profile = profileOverride || getActiveProfile() || DEFAULT_USER_PROFILE;
  const artifact = await generateIntelligenceArtifact('master_cheat_sheet', job, profile);
  await saveJobIntelligence(job, 'master_cheat_sheet', artifact, onUpdateJob);
  return artifact;
}

