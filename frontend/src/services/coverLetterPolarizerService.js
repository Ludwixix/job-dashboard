/**
 * Phase 22: Cover Letter Swappability Analyzer & Anti-Template Polarizer Service
 * Communicates with backend endpoints (/api/cover-letter/audit, /api/jobs/:id/cover-letter-audit, /api/cover-letter/polarize)
 * with transparent client-side fallback engine for zero offline crash.
 */

import { getBackendApiBase } from './apiConfig';

export const CLICHE_OPENERS = [
  { pattern: /\bi\s+am\s+writing\s+to\s+apply\b/i, label: 'I am writing to apply' },
  { pattern: /\bi\s+am\s+writing\s+to\s+express\b/i, label: 'I am writing to express' },
  { pattern: /\bi\s+am\s+excited\s+to\s+apply\b/i, label: 'I am excited to apply' },
  { pattern: /\bi\s+was\s+thrilled\s+to\s+see\b/i, label: 'I was thrilled to see' },
  { pattern: /\bwith\s+a\s+proven\s+track\s+record\b/i, label: 'With a proven track record' },
  { pattern: /\bplease\s+accept\s+my\s+resume\b/i, label: 'Please accept my resume' },
  { pattern: /\bi\s+am\s+submitting\s+my\s+application\b/i, label: 'I am submitting my application' },
  { pattern: /\bi\s+wish\s+to\s+apply\b/i, label: 'I wish to apply' },
  { pattern: /\bas\s+a\s+seasoned\b/i, label: 'As a seasoned' },
  { pattern: /\ballow\s+me\s+to\s+introduce\s+myself\b/i, label: 'Allow me to introduce myself' },
  { pattern: /\bi\s+am\s+delighted\s+to\s+submit\b/i, label: 'I am delighted to submit' },
  { pattern: /\bi\s+believe\s+i\s+would\s+be\s+a\s+great\s+fit\b/i, label: 'I believe I would be a great fit' },
];

export const CORPORATE_FLUFF_MAP = {
  'results-driven': "State exact metrics (e.g., 'reduced latency 40%', 'grew revenue $2M')",
  'team player': "Detail squad scale (e.g., 'co-led 8-engineer platform pod')",
  'think outside the box': "Specify the unconventional engineering solution you designed",
  'synergy': "Describe concrete cross-functional handoffs or API integrations",
  'hit the ground running': "Cite immediate 30-day deliverables or early production commits",
  'passionate professional': "Focus on technical domain depth or open-source stewardship",
  'hardworking': "Show output velocity or system reliability under pressure",
  'detail-oriented': "Show automated QA testing, static analysis, or zero-defect releases",
  'dynamic professional': "Replace with your explicit job title and core tech stack",
  'fast-paced environment': "Specify deployment frequency (e.g., '15 CI/CD deploys/day')",
  'go the extra mile': "Demonstrate operational ownership or on-call incident resolution",
  'wear multiple hats': "Enumerate discrete responsibilities (e.g., 'IaC + DB tuning + security')",
  'proven track record': "Give 2 concrete verifiable business milestones",
  'customer-centric': "Name user impact (e.g., 'resolved top friction point for 50k users')",
  'thought leader': "Reference specific RFCs, technical architecture specs, or mentoring",
};

/**
 * Pure client-side mirror algorithm for instant typing feedback and offline fallback.
 */
export const clientAuditCoverLetter = (text = '', company = '', jobTitle = '', jobDescription = '') => {
  const trimmed = text.trim();
  const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean) : [];
  const words = trimmed ? trimmed.match(/\b\w+\b/g) || [] : [];
  const totalWords = words.length;

  if (!trimmed) {
    return {
      swappability_score: 100,
      swappability_level: 'Critical Risk (Completely Swappable)',
      company_mention_count: 0,
      detected_company_entities: [],
      opener_check: {
        has_cliche_opener: false,
        detected_opener: null,
        suggestion: "Draft a sharp hook paragraph referencing the employer's current technical trajectory.",
      },
      cliches_found: [],
      paragraph_analysis: [],
      voice_profile: { tone: 'Empty / Missing', confidence_score: 0, fluff_ratio: 0.0, total_words: 0 },
      overall_verdict: 'Fail - Terminal Genericism',
      recommendations: [
        'Provide cover letter text to evaluate swappability against target employer.',
        'Ensure letter includes the target company name and specific technical context.',
      ],
    };
  }

  // 1. Opener Check
  const firstPara = paragraphs[0] || '';
  const firstTwoSentences = firstPara.split('.').slice(0, 2).join('. ');
  let hasClicheOpener = false;
  let detectedOpener = null;
  let openerSuggestion = "Lead directly with an insightful observation about the company's core challenge or architecture.";

  for (const { pattern, label } of CLICHE_OPENERS) {
    if (pattern.test(firstTwoSentences)) {
      hasClicheOpener = true;
      detectedOpener = label;
      openerSuggestion = `Replace canned opener '${label}' with an opinionated hook addressing ${company || 'the employer'}'s product or scaling challenges.`;
      break;
    }
  }

  // 2. Company Mentions and Entity Specificity
  const detectedEntities = [];
  let companyMentionCount = 0;
  if (company) {
    const escaped = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = trimmed.match(new RegExp(`\\b${escaped}\\b`, 'gi')) || [];
    companyMentionCount = matches.length;
    if (companyMentionCount > 0) {
      detectedEntities.push(`Company: ${company} (${companyMentionCount}x)`);
    }
  }

  if (jobDescription) {
    const techTokens = [
      'Kubernetes', 'AWS', 'GCP', 'Azure', 'Terraform', 'Python', 'Go', 'Rust',
      'Kafka', 'PostgreSQL', 'Redis', 'Distributed', 'Microservices', 'GraphQL',
      'CI/CD', 'DevOps', 'FinTech', 'SaaS', 'Security', 'SOC2', 'Observability'
    ];
    for (const t of techTokens) {
      const rx = new RegExp(`\\b${t}\\b`, 'i');
      if (rx.test(jobDescription) && rx.test(trimmed)) {
        detectedEntities.push(t);
        if (detectedEntities.length >= 6) break;
      }
    }
  }

  // 3. Corporate Fluff Detection
  const clichesFound = [];
  for (const [fluff, fix] of Object.entries(CORPORATE_FLUFF_MAP)) {
    const rx = new RegExp(`\\b${fluff.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (rx.test(trimmed)) {
      clichesFound.push({ phrase: fluff, category: 'Corporate Fluff', fix });
    }
  }

  // 4. 3-Paragraph Structural Analysis
  const paragraphRoles = [
    'The Hook (Company Trajectory & Context)',
    'The Proof Narrative (Quantified Impact)',
    'The Low-Friction Close (Confident Call to Action)',
  ];
  const paragraphAnalysis = paragraphs.map((p, i) => {
    const pWords = (p.match(/\b\w+\b/g) || []).length;
    const role = paragraphRoles[i] || `Additional Paragraph ${i + 1}`;
    let compliant = true;
    let feedback = 'Balanced length and density.';

    if (i === 0) {
      if (pWords < 20) { compliant = false; feedback = 'Too short for an impactful hook. Expand with context about the company.'; }
      else if (pWords > 110) { compliant = false; feedback = 'Too verbose for an opener hook. Keep it concise (< 90 words).'; }
    } else if (i === 1) {
      if (pWords < 40) { compliant = false; feedback = 'Proof narrative lacks depth. Include specific metrics and scale.'; }
      else if (pWords > 180) { compliant = false; feedback = 'Proof narrative is running long. Focus on a single decisive win.'; }
    } else if (i === 2) {
      if (pWords < 15) { compliant = false; feedback = 'Closing is too abrupt.'; }
      else if (pWords > 80) { compliant = false; feedback = 'Closing call-to-action should be crisp and low-friction (< 60 words).'; }
    } else {
      compliant = false;
      feedback = 'Exceeds the 3-paragraph structural blueprint. Consolidate into 3 focused sections.';
    }

    return {
      index: i + 1,
      role,
      word_count: pWords,
      compliant,
      feedback,
      preview: p.length > 90 ? p.slice(0, 90) + '…' : p,
    };
  });

  // 5. Swappability Risk Index Calculation
  let score = 45;
  if (hasClicheOpener) score += 25; else score -= 10;
  if (companyMentionCount === 0) score += 35; else score -= Math.min(25, companyMentionCount * 10);
  const domainTechCount = detectedEntities.length - (companyMentionCount > 0 ? 1 : 0);
  score -= Math.min(20, domainTechCount * 5);
  score += Math.min(20, clichesFound.length * 5);
  if (paragraphs.length !== 3) score += 10; else score -= 5;
  score = Math.max(5, Math.min(95, score));

  let swappabilityLevel = 'Moderate Risk';
  if (score <= 35) swappabilityLevel = 'Low Risk (Highly Specific)';
  else if (score >= 66) swappabilityLevel = 'Critical Risk (Completely Swappable)';

  const fluffRatio = Number((clichesFound.length / Math.max(1, totalWords / 50)).toFixed(2));
  let tone = 'Safe / Corporate Standard';
  let confidenceScore = 70;
  if (hasClicheOpener || fluffRatio > 1.5) {
    tone = 'Sterile / Generic AI';
    confidenceScore = 42;
  } else if (score <= 35 && clichesFound.length === 0) {
    tone = 'Opinionated & Distinct';
    confidenceScore = 92;
  }

  let overallVerdict = 'Fail - Terminal Genericism';
  if (score <= 35 && !hasClicheOpener && paragraphs.length === 3) {
    overallVerdict = 'Pass - Polarizing & Specific';
  } else if (score <= 65) {
    overallVerdict = 'Review - Moderately Generic';
  }

  const recommendations = [];
  if (hasClicheOpener) recommendations.push(openerSuggestion);
  if (companyMentionCount === 0) {
    recommendations.push(`Explicitly reference '${company || 'the target company'}' and its current product or engineering initiatives.`);
  }
  if (paragraphs.length !== 3) {
    recommendations.push(`Expected 3 paragraphs (Hook, Proof Narrative, Close), found ${paragraphs.length}. Refactor for maximum brevity.`);
  }
  clichesFound.slice(0, 3).forEach(c => recommendations.push(`Purge cliché '${c.phrase}': ${c.fix}`));
  if (score > 50) {
    recommendations.push("Execute the Swappability Test: ensure swapping in a competitor's name would make the letter nonsensical.");
  }

  return {
    swappability_score: score,
    swappability_level: swappabilityLevel,
    company_mention_count: companyMentionCount,
    detected_company_entities: detectedEntities,
    opener_check: {
      has_cliche_opener: hasClicheOpener,
      detected_opener: detectedOpener,
      suggestion: openerSuggestion,
    },
    cliches_found: clichesFound,
    paragraph_analysis: paragraphAnalysis,
    voice_profile: {
      tone,
      confidence_score: confidenceScore,
      fluff_ratio: fluffRatio,
      total_words: totalWords,
    },
    overall_verdict: overallVerdict,
    recommendations,
  };
};

/**
 * Pure client-side mirror generator for 3 polarizing variants.
 */
export const clientGeneratePolarizedVariants = (job = {}, profile = {}) => {
  const company = job.company || 'the engineering team';
  const title = job.title || 'Engineering Role';
  const skills = profile.skills || ['Distributed Systems', 'Cloud Architecture', 'CI/CD', 'Observability'];
  const topSkill = skills[0] || 'Distributed Systems';
  const secondSkill = skills[1] || 'Cloud Infrastructure';

  const p1Conviction = `Scaling ${company}'s platform while maintaining sub-second latency is fundamentally a distributed state problem. Watching your team navigate rapid user adoption convinced me this ${title} position needs someone who treats infrastructure as an active product moat.`;
  const p2Conviction = `Over the past four years, I spearheaded the core migration to an event-driven ${topSkill} framework at scale. By re-architecting asynchronous broker pipelines and automating failover policies, my squad eliminated $350k in compute waste and maintained 99.995% uptime across 1.4M daily transactions.`;
  const p3Conviction = `If ${company} is ready to cut through operational complexity and accelerate release velocity without downtime, let's connect for 15 minutes this week.`;

  const p1Systems = `Most software architectures break down not at the algorithm layer, but at the observability and deployment boundaries. ${company}'s roadmap for ${title} caught my attention because it directly targets production-grade reliability.`;
  const p2Systems = `At my previous company, I owned our enterprise ${secondSkill} pipeline. I designed containerized runtime environments from scratch, drove automated regression suites down to under four minutes, and cut incident triage times by 60% through structured telemetry.`;
  const p3Systems = `I would welcome the opportunity to review your current deployment bottlenecks and discuss how my tooling philosophy aligns with ${company}'s goals.`;

  const p1Rebel = `Bureaucracy kills developer velocity faster than technical debt ever will. I respect ${company}'s bias toward autonomous, high-ownership engineering, and this ${title} vacancy is exactly the high-stakes environment I thrive in.`;
  const p2Rebel = `I don't write defensive specifications; I ship resilient code. When our legacy queueing system failed under Black Friday load, I rewrote the critical ingestion pathway in 72 hours, scaling throughput by 3.8x with zero data loss using ${topSkill} and automated reconciliation.`;
  const p3Rebel = `If you need an engineer who takes full ownership from architectural RFC to production telemetry, let's schedule an introductory discussion.`;

  return [
    {
      id: 'high_conviction',
      title: 'The High-Conviction Angle',
      subtitle: 'Bold Hypothesis & Competitive Moat',
      tone: 'Opinionated, Strategic & Visionary',
      hook_explanation: "Hooks the hiring manager with an expert hypothesis on the company's real scaling friction.",
      paragraphs: [p1Conviction, p2Conviction, p3Conviction],
      full_text: `${p1Conviction}\n\n${p2Conviction}\n\n${p3Conviction}`,
    },
    {
      id: 'systems_architect',
      title: 'The Direct Systems Architect',
      subtitle: 'Zero-Fluff Technical Proof & Quantified Scale',
      tone: 'Pragmatic, Metrics-Driven & Precise',
      hook_explanation: 'Skips generic corporate pleasantries and proves immediate operational mastery.',
      paragraphs: [p1Systems, p2Systems, p3Systems],
      full_text: `${p1Systems}\n\n${p2Systems}\n\n${p3Systems}`,
    },
    {
      id: 'cultural_outlier',
      title: 'The Cultural Rebel',
      subtitle: 'High-Velocity, Low-Bureaucracy Execution',
      tone: 'Direct, Confident & High-Energy',
      hook_explanation: 'Actively screens out slow-moving corporate red tape to hook agile engineering leaders.',
      paragraphs: [p1Rebel, p2Rebel, p3Rebel],
      full_text: `${p1Rebel}\n\n${p2Rebel}\n\n${p3Rebel}`,
    },
  ];
};

/**
 * Audits cover letter text via backend or client fallback.
 */
export const auditCoverLetter = async (coverLetterText, company = '', jobTitle = '', jobDescription = '') => {
  const base = getBackendApiBase();
  try {
    const res = await fetch(`${base}/api/cover-letter/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cover_letter: coverLetterText,
        company,
        job_title: jobTitle,
        job_description: jobDescription,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.audit) {
        return data.audit;
      }
    }
  } catch (err) {
    console.warn('[coverLetterPolarizerService] Backend audit unreachable, using client engine:', err.message);
  }
  return clientAuditCoverLetter(coverLetterText, company, jobTitle, jobDescription);
};

/**
 * Retrieves audit and polarized variants for a specific job.
 */
export const fetchJobCoverLetterAudit = async (jobId, jobFallback = {}, profile = {}) => {
  const base = getBackendApiBase();
  try {
    const res = await fetch(`${base}/api/jobs/${encodeURIComponent(jobId)}/cover-letter-audit`);
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[coverLetterPolarizerService] Backend job audit unreachable, using client engine:', err.message);
  }

  const audit = clientAuditCoverLetter(
    jobFallback.coverLetterText || '',
    jobFallback.company || '',
    jobFallback.title || '',
    jobFallback.description || jobFallback.notes || ''
  );
  const variants = clientGeneratePolarizedVariants(jobFallback, profile);
  return {
    success: true,
    audit,
    variants,
    company: jobFallback.company || 'Target Employer',
    title: jobFallback.title || 'Engineering Role',
  };
};

/**
 * Generates polarized variants for a job and profile.
 */
export const fetchPolarizedVariants = async (job = {}, profile = {}) => {
  const base = getBackendApiBase();
  try {
    const res = await fetch(`${base}/api/cover-letter/polarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job, profile }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.variants) {
        return data.variants;
      }
    }
  } catch (err) {
    console.warn('[coverLetterPolarizerService] Backend polarize unreachable, using client engine:', err.message);
  }
  return clientGeneratePolarizedVariants(job, profile);
};
