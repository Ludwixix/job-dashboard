import{o as e,r as t}from"./profileService-DRbhHy3c.js";function n(e){if(!e||typeof e!=`string`)return{platform:`unknown`,meetingUrl:``,meetingId:``,passcode:``,scheduledTime:``};let t=e.replace(/=\r?\n/g,``).replace(/=3D/gi,`=`),n=`unknown`,r=``,i=t.match(/https:\/\/teams\.microsoft\.com\/(?:l\/meetup-join|meet)\/[^\s<>"]+/i),a=t.match(/https:\/\/[a-zA-Z0-9.-]*zoom\.us\/[jsw]\/[^\s<>"]+/i),o=t.match(/https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}[^\s<>"]*/i),s=t.match(/https:\/\/[a-zA-Z0-9.-]*webex\.com\/[^\s<>"]+/i);i?(n=`teams`,r=i[0]):a?(n=`zoom`,r=a[0]):o?(n=`meet`,r=o[0]):s&&(n=`webex`,r=s[0]);let c=``,l=t.match(/(?:Meeting\s*ID|Meeting\s*Number|ID):?\s*([0-9\s-]{8,22})/i);l&&(c=l[1].trim());let u=``,d=t.match(/(?:Passcode|Password|Pass|PIN|Code):?\s*([a-zA-Z0-9!@#$%^&*_-]{4,20})/i);d&&(u=d[1].trim());let f=``,p=t.match(/(?:at|for|time:?)\s*([0-1]?[0-9](?::[0-5][0-9])?\s*(?:am|pm)\b(?:\s*(?:AEST|AEDT|AWST|ACST|UTC|GMT|EST|EDT|CST|CDT|PST|PDT))?)/i);return p&&(f=p[1].trim()),{platform:n,meetingUrl:r,meetingId:c,passcode:u,scheduledTime:f}}function r(e={}){let t={platform:e.meetingPlatform||`unknown`,meetingUrl:e.meetingUrl||e.meeting_url||e.meetingLink||``,meetingId:e.meetingId||e.meeting_id||``,passcode:e.passcode||e.password||e.meetingPasscode||``,scheduledTime:e.scheduledTime||e.interviewTime||``,scheduledDate:e.scheduledDate||e.interviewDate||``,interviewers:Array.isArray(e.interviewers)?[...e.interviewers]:[]},r=[];e.notes&&r.push(e.notes),e.rawEmail&&r.push(e.rawEmail),e.email_text&&r.push(e.email_text),e.interviewInvite&&r.push(typeof e.interviewInvite==`string`?e.interviewInvite:JSON.stringify(e.interviewInvite));let i=e.email_events||e.emailEvents||e.emailHistory||[];Array.isArray(i)&&i.forEach(e=>{e.body&&r.push(e.body),e.snippet&&r.push(e.snippet),e.subject&&r.push(e.subject),(e.from||e.sender)&&r.push(`From: ${e.from||e.sender}`),(e.to||e.recipients)&&r.push(`To: ${Array.isArray(e.to)?e.to.join(`, `):e.to||e.recipients}`)});let a=r.join(`

`);if(a){let e=n(a);if(!t.meetingUrl&&e.meetingUrl&&(t.meetingUrl=e.meetingUrl,t.platform=e.platform),!t.meetingId&&e.meetingId&&(t.meetingId=e.meetingId),!t.passcode&&e.passcode&&(t.passcode=e.passcode),!t.scheduledTime&&e.scheduledTime&&(t.scheduledTime=e.scheduledTime),t.interviewers.length===0)for(let e of[/(?:meeting with|interview with|meet with|attendees?:?)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s+(?:and|&)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)?)/i,/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*(?:and|&)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*(?:aren’t|will join|are on the panel)/i,/([A-Z][a-z]+\s+[A-Z][a-z]+)\s*will\s+also\s+join/i]){let n=a.match(e);n&&(n[1]&&!n[2]?n[1].split(/(?:,\s*|\s+(?:and|&)\s+)/i).filter(Boolean).forEach(e=>{let n=e.trim();n&&![`The`,`Our`,`Your`,`Tomorrow`,`Please`].includes(n)&&t.interviewers.push({name:n,role:`Hiring Panelist`,focus:`Role alignment & operational impact`,dropTerms:`Governance, Automation, Delivery`})}):n[1]&&n[2]&&[n[1],n[2]].forEach(e=>{let n=e.trim();n&&!t.interviewers.some(e=>e.name===n)&&t.interviewers.push({name:n,role:`Hiring Panelist`,focus:`Core requirements & team fit`,dropTerms:`Best practices, Production metrics`})}))}}return t.interviewers.length===0&&(t.interviewers=[{name:`Hiring Manager / Team Lead`,role:`Direct Manager`,focus:`Autonomy, operational velocity & reliable execution`,dropTerms:`Scrum, Root Cause Analysis, Documentation, SRE`},{name:`Technical Architect / Principal`,role:`Technical Architect`,focus:`Architectural rigor, edge cases & zero-downtime governance`,dropTerms:`Idempotency, Decoupled State, CI/CD, Least Privilege`},{name:`Talent & Culture Lead`,role:`People Partner`,focus:`Communication, stakeholder empathy & growth mindset`,dropTerms:`Cross-functional enablement, Mentorship, Continuous improvement`}]),t}function i(e={}){let t=`${e.title||``} ${e.description||``} ${e.requirements?e.requirements.join(` `):``}`.toLowerCase();return t.includes(`sharepoint`)||t.includes(`nintex`)||t.includes(`m365`)||t.includes(`power automate`)?[`Never call legacy systems "broken" or dismiss existing Nintex workflows—respect the years of investment and praise their reliability before proposing modernization.`,`Never propose managing user access via item/folder permissions—always emphasize Entra ID security groups and M365 role-based governance.`,`Never advocate building production flows under personal accounts—strictly enforce Service Principals, Key Vault secrets, and tenant ALM.`]:t.includes(`devops`)||t.includes(`cloud`)||t.includes(`aws`)||t.includes(`azure`)||t.includes(`terraform`)?[`Never suggest manual console modifications in production—always anchor every change to IaC (Terraform/Bicep) with version-controlled pull requests.`,`Never dismiss legacy on-prem systems or technical debt—frame hybrid infrastructure as a deliberate business decision requiring thoughtful bridge architectures.`,`Never prioritize raw deployment velocity over security boundaries and rollback plans—emphasize canary deployments and automated health gates.`]:t.includes(`data`)||t.includes(`python`)||t.includes(`sql`)||t.includes(`etl`)||t.includes(`analytics`)?[`Never assume source data is clean or static—always discuss defensive schema validation, idempotency, and retry mechanisms.`,`Never treat query optimization as an afterthought—cite partition pruning, indexing, and cost control limits.`,`Never present technical findings in a vacuum—always connect data pipelines to business KPIs and decision velocity.`]:[`Never answer in pure abstract theory without anchoring to a real production metric or quantifiable business outcome.`,`Never point fingers at past teams or stakeholders—always frame previous friction around misaligned incentives and how you unified them.`,`Never exceed 90 seconds without checking in or grounding your answer back in their specific organizational reality.`]}function a(e={},t={}){e.interviewTalkingPoints;let n=`${t.title||``} ${t.description||``}`.toLowerCase();return n.includes(`sharepoint`)||n.includes(`m365`)?[{value:`5,000`,label:`SQL List Threshold`},{value:`300k`,label:`Sync Limit`},{value:`30 Days`,label:`Power Automate Flow Cap`},{value:`400`,label:`URL Path Cap`},{value:`660k`,label:`Dept of Ed Users`},{value:`87%`,label:`Cutover Time Reduction`}]:n.includes(`cloud`)||n.includes(`devops`)||n.includes(`aws`)||n.includes(`azure`)?[{value:`99.99%`,label:`Production Uptime`},{value:`85%`,label:`Provisioning Cut`},{value:`660k`,label:`Identities Migrated`},{value:`0`,label:`Unplanned Downtime`},{value:`12+`,label:`Years Experience`},{value:`100h/mo`,label:`Automation Savings`}]:[{value:`660k+`,label:`Enterprise Users`},{value:`87%`,label:`Cycle Time Reduction`},{value:`1,000+`,label:`Managed Environments`},{value:`100%`,label:`On-Time Delivery`},{value:`12+`,label:`Years Track Record`},{value:`100h/mo`,label:`Manual Time Eliminated`}]}function o(e={},t={}){return[{title:`Incident Reduction & Automated Auditing`,company:`Capgemini / Victorian Dept of Education`,color:`#7c3aed`,situation:`Constant access breakages and permission tickets across 660k users & 1,000+ sites.`,action:`Built unattended PnP PowerShell scripts performing continuous automated permission audits and alerting.`,result:`Cut repeat access incidents by 15% and saved 160 hours of manual audit time per month.`},{title:`Migration Speed & Batch Automation`,company:`Knosys / GreenOrbit Intranet`,color:`#0284c7`,situation:`Stalling cutovers taking 2+ hours per batch with frequent path and character limit errors.`,action:`Automated pre-flight path validation, chunking, and multithreaded retry execution via PowerShell.`,result:`Cut batch cutover processing time by 87% (from 2 hours down to 15 minutes).`},{title:`ServiceNow & Workflow Automation`,company:`Australia Post via Capgemini`,color:`#059669`,situation:`Hundreds of hours lost cross-referencing ServiceNow queues and manual roster assignments.`,action:`Engineered custom automation scripts bridging ServiceNow API with SharePoint tracking rosters.`,result:`Eliminated over 100 hours of manual ticket triage and data entry every month.`},{title:`Enterprise Intranet Modernization`,company:`Engage Squared / Cimic Group & Transurban`,color:`#d97706`,situation:`Alliance civil infrastructure teams suffered from chaotic file shares and scattered project docs.`,action:`Delivered modern SharePoint Online hub-and-spoke site architecture with automated provisioning.`,result:`Cut project site onboarding time by 25% with 94% first-month stakeholder adoption.`},{title:`Zero-Disruption Clinical Cutover`,company:`St John of God Health Care`,color:`#e11d48`,situation:`Clinical staff highly apprehensive about operating system upgrades disrupting acute workflows.`,action:`Ran hands-on application validation workshops and 1-on-1 clinician handovers before cutover day.`,result:`Achieved 100% on-time cutover with zero clinical disruption or patient care impact.`}]}function s(e={},t={}){let n=e.company||`the team`;return e.title,[{category:`Strategic Alignment`,question:`Looking at ${n}’s roadmap for the next 6 to 12 months, what is the single biggest operational bottleneck you want the person in this role to solve first?`,targetAudience:`Hiring Manager / Team Lead`,rationale:`Shows immediate desire to create business impact and prioritize where leadership feels pain.`},{category:`Technical Architecture & Governance`,question:`How does the team currently strike the balance between rapid workflow delivery for users and long-term security/governance compliance?`,targetAudience:`Technical Evaluator / Lead Architect`,rationale:`Signals that you respect both business speed and enterprise security guardrails.`},{category:`Team Velocity & Tooling`,question:`What does the current deployment and release lifecycle look like when modernizing workflows or releasing new scripts to production?`,targetAudience:`Senior Engineers / Peers`,rationale:`Reveals day-to-day engineering maturity, CI/CD adoption, and change management friction.`},{category:`Definition of Success`,question:`If we look back 12 months from now, what would have to happen for you to say, "Hiring this person was the best decision we made this year"?`,targetAudience:`Full Panel`,rationale:`Forces the panel to visualize you already thriving in the role and defines the exact scorecard.`}]}function c(e={},t={},n={}){let r=e.company||`your organization`,i=e.title||`Senior Systems Specialist`,a=t.name||`Sam Ludwig`;t.title;let o=t.yearsOfExperience||12,s=n.interviewers&&n.interviewers[0]&&n.interviewers[0].name?n.interviewers[0].name.split(` `)[0]:`everyone`;return[{id:`pitch`,category:`cat-pitch`,categoryLabel:`🎯 Pitch`,title:`1. Opening Pitch: "Tell Me About Yourself"`,badge:`Conversational • ~90 Seconds`,badgeColor:`green`,scanLabel:`⚡ 5-Second Brain Glances:`,scanBar:`<strong>${o}+ yrs Systems & Infrastructure</strong> &rarr; <strong>Enterprise M365 & Automation</strong> (Capgemini / Dept of Ed) &rarr; <strong>660k users / 1,000+ sites</strong> &rarr; <strong>ServiceNow & Scripting</strong> (AusPost).`,spokenLabel:`🗣️ What to Actually Say (Human & Conversational):`,spokenScript:`
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
      `,notesId:`note-why`,statusId:`status-why`,placeholder:`Jot notes on ${r} alignment...`}]}function l(n={},l=null,u={}){let d=l||e()||t,f={...r(n),...u.meetingInfo||{}};u.meetingUrl&&(f.meetingUrl=u.meetingUrl),u.meetingId&&(f.meetingId=u.meetingId),u.passcode&&(f.passcode=u.passcode),u.scheduledTime&&(f.scheduledTime=u.scheduledTime),u.interviewers&&Array.isArray(u.interviewers)&&(f.interviewers=u.interviewers);let p=n.company||`Enterprise Partner`,m=n.title||`Technical Specialist`,h=`${p} Master Interview Command Center — ${d.name||`Candidate`}`,g=i(n),_=a(d,n),v=o(d,n),y=s(n,f),b=c(n,d,f),x=`Video Conference`,S=`#4f46e5`,C=`#eef2ff`;f.platform===`teams`||f.meetingUrl&&f.meetingUrl.includes(`teams.microsoft.com`)?(x=`📹 Microsoft Teams`,S=`#4f46e5`,C=`#eef2ff`):f.platform===`zoom`||f.meetingUrl&&f.meetingUrl.includes(`zoom.us`)?(x=`📹 Zoom Meeting`,S=`#0284c7`,C=`#e0f2fe`):(f.platform===`meet`||f.meetingUrl&&f.meetingUrl.includes(`meet.google.com`))&&(x=`📹 Google Meet`,S=`#059669`,C=`#ecfdf5`);let w=f.interviewers.map((e,t)=>{let n=[`var(--primary)`,`var(--success)`,`var(--warning)`,`var(--purple)`],r=[`var(--primary-dark)`,`var(--success)`,`var(--warning)`,`var(--purple)`];return`
      <div style="border-left: 3px solid ${n[t%n.length]}; padding-left: 8px;">
        <strong style="color: ${r[t%r.length]};">${e.name} (${e.role||`Panelist`}):</strong>
        <div style="color: var(--text-subtle); margin-top: 2px;">
          ${e.focus||`Strategic delivery & competency`}.
          ${e.dropTerms?`<br/><span style="font-size: 0.76rem; color: #475569;">Drop: <em>${e.dropTerms}</em></span>`:``}
        </div>
      </div>
    `}).join(`
`),T=_.map(e=>`
    <div style="background:#f8fafc; padding:6px 8px; border-radius:6px; border:1px solid #e2e8f0;">
      <strong style="color: #0f172a; font-size: 0.95rem;">${e.value}</strong>
      <div style="color:#64748b; font-size: 0.72rem; line-height: 1.2;">${e.label}</div>
    </div>
  `).join(`
`),E=b.map(e=>`
    <div class="card qa-card ${e.category}" id="sec-${e.id}">
      <div class="card-header">
        <h3 class="card-title">${e.title}</h3>
        <span class="badge badge-${e.badgeColor}">${e.badge}</span>
      </div>

      <div class="scan-bar ${e.badgeColor===`green`?`green-bar`:e.badgeColor===`amber`?`amber-bar`:e.badgeColor===`purple`?`purple-bar`:``}">
        <div class="scan-label">${e.scanLabel}</div>
        <div>${e.scanBar}</div>
      </div>

      ${e.likelyQuestion?`<p style="font-size:0.88rem; color:#475569; margin: 0 0 10px 0;"><strong>${e.likelyQuestion}</strong></p>`:``}

      <div class="spoken-script">
        <div class="spoken-label">${e.spokenLabel}</div>
        ${e.spokenScript}
      </div>

      <textarea id="${e.notesId}" placeholder="${e.placeholder}"></textarea>
      <span class="save-status" id="${e.statusId}">Saved to Local Storage!</span>
    </div>
  `).join(`
`),D=v.map((e,t)=>`
    <div style="background: #f8fafc; border-left: 3px solid ${e.color}; padding: 8px 10px; border-radius: 0 6px 6px 0;">
      <strong style="color: ${e.color}; font-size: 0.82rem;">${t+1}. ${e.title}</strong>
      <div style="color: #64748b; font-size: 0.72rem; font-weight: 600; margin-bottom: 3px;">${e.company}</div>
      <div style="font-size: 0.76rem; color: #334155;"><strong>S:</strong> ${e.situation}</div>
      <div style="font-size: 0.76rem; color: #334155;"><strong>A:</strong> ${e.action}</div>
      <div style="font-size: 0.76rem; color: #047857; font-weight: 600;"><strong>R:</strong> ${e.result}</div>
    </div>
  `).join(`
`),O=y.map((e,t)=>`
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
        <span class="badge badge-blue" style="font-size: 0.65rem;">${e.category}</span>
        <span style="font-size: 0.7rem; color: #64748b; font-weight: 600;">Target: ${e.targetAudience}</span>
      </div>
      <div style="font-size: 0.82rem; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
        "${e.question}"
      </div>
      <div style="font-size: 0.73rem; color: #475569; font-style: italic;">
        💡 ${e.rationale}
      </div>
    </div>
  `).join(`
`),k=`cheat-sheet-${(p+`-`+m).toLowerCase().replace(/[^a-z0-9]/g,`-`)}`;return`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${h}</title>
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
        <div class="card" style="border-top: 4px solid #4f46e5; background: ${C}; padding: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <strong style="color: ${S}; font-size: 0.95rem;">${x} ${f.scheduledTime?`(${f.scheduledTime})`:``}</strong>
                <span class="badge" style="background: ${S}; color: #fff;">READY</span>
            </div>
            <div style="font-size: 0.8rem; color: #334155; margin-bottom: 8px;">
                ${f.meetingId?`<div><strong>ID:</strong> ${f.meetingId}</div>`:``}
                ${f.passcode?`<div><strong>Pass:</strong> <code style="background: #e2e8f0; padding: 1px 5px; border-radius: 3px; font-weight: bold;">${f.passcode}</code></div>`:``}
                ${f.scheduledDate?`<div><strong>Date:</strong> ${f.scheduledDate}</div>`:``}
            </div>
            ${f.meetingUrl?`
            <a href="${f.meetingUrl}" target="_blank" rel="noopener noreferrer" style="display: block; text-align: center; background: ${S}; color: #ffffff; font-weight: 700; font-size: 0.85rem; padding: 9px; border-radius: 6px; text-decoration: none;">
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
                ${w}
            </div>
        </div>

        <!-- 3 TRAPS TO AVOID -->
        <div class="card" style="border-top: 3px solid var(--danger); background: #fffafb; padding: 12px;">
            <div style="font-size: 0.82rem; font-weight: 700; color: #991b1b; margin-bottom: 6px;">
                🚫 3 Traps to Avoid
            </div>
            <ul style="margin: 0; padding-left: 16px; font-size: 0.78rem; color: #7f1d1d; display:flex; flex-direction:column; gap:6px;">
                ${g.map(e=>`<li>${e}</li>`).join(`
`)}
            </ul>
        </div>

        <!-- HARD NUMBERS TO DROP -->
        <div class="card" style="padding: 12px;">
            <div style="font-size: 0.82rem; font-weight: 700; color: var(--purple); margin-bottom: 6px;">
                🔢 Numbers to Drop
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 0.78rem;">
                ${T}
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
                <button class="filter-btn" onclick="filterCategory('cat-company', this)">🏢 Why ${p.split(` `)[0]}</button>
            </div>
            <div>
                <button class="view-btn" onclick="toggleFocusMode()" id="focusToggleBtn">🔲 Focus View (Hide Sides)</button>
            </div>
        </div>

        <!-- MODULAR Q&A CARDS -->
        ${E}

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
                ${D}
            </div>
        </div>

        <!-- REVERSE QUESTIONS FOR PANEL -->
        <div class="card" style="border-top: 4px solid var(--primary); padding: 14px;">
            <div style="font-size: 0.88rem; font-weight: 700; color: #0f172a; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
                ❓ High-Impact Reverse Questions
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${O}
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
        const key = '${k}:' + textarea.id;
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
</html>`}function u(e,t=`Interview Cheat Sheet`){try{let n=new Blob([e],{type:`text/html;charset=utf-8`}),r=URL.createObjectURL(n),i=window.open(r,`_blank`);if(i)return i.document.title=t,setTimeout(()=>URL.revokeObjectURL(r),1e4),i}catch(e){console.error(`Failed to open cheat sheet in new tab:`,e)}try{let t=window.open(``,`_blank`);if(t)return t.document.open(),t.document.write(e),t.document.close(),t}catch(e){console.error(`Fallback window open also failed:`,e)}return null}function d(e={},t){try{let n=`${(e.company||`Company`).replace(/[^a-zA-Z0-9_-]/g,`_`)}_${(e.title||`Role`).replace(/[^a-zA-Z0-9_-]/g,`_`)}_Interview_Cheat_Sheet.html`,r=new Blob([t],{type:`text/html;charset=utf-8`}),i=URL.createObjectURL(r),a=document.createElement(`a`);a.href=i,a.download=n,document.body.appendChild(a),a.click(),document.body.removeChild(a),setTimeout(()=>URL.revokeObjectURL(i),1e3)}catch(e){console.error(`Failed to download cheat sheet HTML:`,e)}}export{u as i,r as n,l as r,d as t};