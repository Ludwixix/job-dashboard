import { getBackendApiBase } from './apiConfig';
import { getActiveProfile } from './profileService';

export const INTERVIEW_STAGES = [
  'Initial Screening & HR',
  'Hiring Manager Deep Dive',
  'Technical & Architecture',
  'Panel Interview',
  'Stakeholder & Cross-Functional',
  'Final Executive & Board',
];

export const PANEL_SENTIMENTS = [
  'Strong Positive',
  'Leaning Positive',
  'Neutral / Ambiguous',
  'High Friction',
];

const LOCAL_STORAGE_KEY = 'job_dashboard_interview_debriefs';

export function getLocalDebriefs() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('Failed to parse interview debriefs from local storage:', e);
    return {};
  }
}

export function saveLocalDebrief(jobId, debrief) {
  try {
    const map = getLocalDebriefs();
    map[jobId] = debrief;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Failed to save interview debrief to local storage:', e);
  }
}

export function calculateInfluenceHealth(debrief = {}) {
  const sentimentWeights = {
    'Strong Positive': 90,
    'Leaning Positive': 75,
    'Neutral / Ambiguous': 55,
    'High Friction': 35,
  };
  const sentiment = debrief.panelSentiment || 'Leaning Positive';
  const baseScore = sentimentWeights[sentiment] ?? 65;
  const objections = debrief.perceivedObjections || [];
  const penalty = objections.length * 10;
  const score = Math.max(20, Math.min(100, baseScore - penalty));

  let status = 'Cautious / Balanced';
  let recommendedAction = 'Clarify scope, address ambiguities, and prepare referee alignment';

  if (score >= 75) {
    status = 'High Conviction';
    recommendedAction = 'Send brief value-add reinforcement memo';
  } else if (score < 55) {
    status = 'Objection Overcoming Required';
    recommendedAction = 'Execute targeted objection mitigation memo with tangible proof artifacts';
  }

  const actionItems = [];
  if (objections.length > 0) {
    objections.forEach(obj => {
      actionItems.push(`Address objection: "${obj}" with concrete project proof.`);
    });
  } else {
    actionItems.push('Reinforce core discussion takeaways and signal reference readiness.');
  }

  if (debrief.promisedDecisionDate) {
    actionItems.push(`Monitor promised decision milestone: ${debrief.promisedDecisionDate}`);
  }
  actionItems.push('Align professional referees with customized STAR talking points.');

  return {
    score,
    status,
    recommendedAction,
    actionItems,
    objectionCount: objections.length,
  };
}

export function buildObjectionResolutionMemo(job = {}, debrief = {}, profile = null) {
  const activeProf = profile || getActiveProfile() || {};
  const company = job.company || 'Target Organization';
  const title = job.title || 'Role';
  const candidateName = activeProf.name || 'Samuel Ludwig';
  const firstPanel = (debrief.panelNames || '').split(',')[0].split('(')[0].trim() || 'Hiring Panel';

  const subject = `RE: Technical Debrief & Value Add — ${title} (${company})`;

  const objections = debrief.perceivedObjections || [];
  const objectionParagraphs = [];

  if (objections.length > 0) {
    objections.forEach(obj => {
      const cleanObj = obj.replace(/\.+$/, '');
      objectionParagraphs.push(
        `Reflecting on our discussion around ${cleanObj}, I wanted to share a concrete precedent from my recent systems delivery. In a parallel project, we resolved this by implementing strict automated rollback routines and pre-validating changes across isolated staging tiers prior to production cutover. This approach eliminated downtime variance and gave stakeholders immediate assurance.`
      );
    });
  } else {
    objectionParagraphs.push(
      `Our discussion regarding the strategic priorities for ${title} reinforced my conviction that my experience standardizing operating procedures, accelerating delivery velocity, and establishing resilient cross-functional workflows aligns directly with ${company}'s immediate milestones.`
    );
  }

  const topicsSummary = (debrief.topicsCovered && debrief.topicsCovered.length > 0)
    ? debrief.topicsCovered.join(', ')
    : 'operational scalability and resilient platform delivery';

  const body = `Hi ${firstPanel},

Thank you for the thoughtful discussion regarding the ${title} opportunity at ${company}. I appreciated digging into your focus on ${topicsSummary}.

${objectionParagraphs.join('\n\n')}

As discussed, I am fully prepared to commence without ramp-up latency and would welcome the opportunity to partner with the team. Please let me know if any additional technical context or portfolio artifacts would be helpful as you evaluate next steps.

Sincerely,
${candidateName}
${activeProf.title || ''}
${[activeProf.phone, activeProf.email].filter(Boolean).join(' | ')}`;

  return {
    subject,
    body,
    recipient: debrief.panelNames || '',
  };
}


export function buildRefereeBriefingDoc(
  job = {},
  debrief = {},
  refereeName = 'Referee',
  refereeTitle = 'Operations Lead',
  refereeRelationship = 'Former Manager',
  profile = null
) {
  const activeProf = profile || getActiveProfile() || {};
  const candName = activeProf.name || 'Samuel Ludwig';
  const company = job.company || 'Target Company';
  const title = job.title || 'Target Role';

  const topics = debrief.topicsCovered || ['Operational Reliability', 'System Governance'];
  const objections = debrief.perceivedObjections || ['Autonomous problem solving under pressure'];

  const starPoints = [];
  topics.slice(0, 3).forEach(t => {
    starPoints.push({
      dimension: t,
      talkingPoint: `Speak to ${candName}'s high-ownership execution, technical pragmatism, and meticulous documentation standard around ${t}.`,
    });
  });

  objections.slice(0, 2).forEach(o => {
    starPoints.push({
      dimension: `Panel Alignment: ${o}`,
      talkingPoint: `Emphasize that ${candName} consistently operates with proactive risk management, clear escalation protocols, and zero complacency when addressing ${o}.`,
    });
  });

  return `# EXECUTIVE REFEREE ALIGNMENT BRIEFING

**Candidate:** ${candName}  
**Referee:** ${refereeName} (${refereeTitle} — ${refereeRelationship})  
**Target Organization:** ${company}  
**Target Role:** ${title}  
**Interview Stage Completed:** ${debrief.stage || 'Panel Interview'}  
**Panel Contact(s):** ${debrief.panelNames || 'Hiring Panel'}  
**Expected Contact Window:** Approx. 24–48 hours prior to ${debrief.promisedDecisionDate || 'decision date'}

---

## 1. Role Context & Core Focus
${company} is looking for a reliable, high-trust practitioner for the ${title} role. During the interview, key priorities discussed included:
${topics.map(t => `- **${t}**`).join('\n')}

---

## 2. Recommended STAR Talking Points & Precedents
When the hiring manager or talent team reaches out, highlighting the following competencies will provide decisive proof:

${starPoints.map(p => `### • ${p.dimension}\n**Talking Point:** ${p.talkingPoint}`).join('\n\n')}

---

## 3. Candidate Operating Posture
- **Execution Style:** Pragmatic, proactive, structured, and documentation-first.
- **Team Dynamic:** Low-ego collaborator who communicates with clarity and protects system reliability.

*Thank you for supporting this reference! Please let ${candName} know if the hiring team makes contact.*`;
}

export async function fetchInterviewDebrief(jobId) {
  if (!jobId) return null;
  const base = getBackendApiBase();
  try {
    const res = await fetch(`${base}/api/interview-debrief?job_id=${encodeURIComponent(jobId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.debrief) {
        saveLocalDebrief(jobId, data.debrief);
        return { debrief: data.debrief, health: data.health };
      }
    }
  } catch (e) {
    console.warn('Backend debrief fetch fallback to local:', e);
  }
  const local = getLocalDebriefs()[jobId];
  if (local) {
    return { debrief: local, health: calculateInfluenceHealth(local) };
  }
  return null;
}

export async function saveInterviewDebrief(jobId, debriefData) {
  if (!jobId) return null;
  saveLocalDebrief(jobId, debriefData);
  const base = getBackendApiBase();
  try {
    const res = await fetch(`${base}/api/interview-debrief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId, ...debriefData }),
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (e) {
    console.warn('Backend debrief save error (cached locally):', e);
  }
  return { success: true, debrief: debriefData, health: calculateInfluenceHealth(debriefData) };
}
