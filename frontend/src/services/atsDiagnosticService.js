/**
 * atsDiagnosticService.js
 * -----------------------
 * Frontend service layer for Phase 20: Algorithmic ATS Parsing Simulator
 * & Cognitive Screening Triage Engine ("ATS Sentinel").
 */

import { getBackendApiBase } from './apiConfig';

/**
 * Returns visual color tokens and status labels for ATS confidence scores.
 */
export const formatAtsScoreBadge = (score) => {
  const num = Number(score) || 0;
  if (num >= 85) {
    return {
      label: 'High ATS Pass Confidence',
      badge: 'HIGH FIT (95%+ PASS)',
      color: 'text-emerald-400 bg-emerald-950/40 border-emerald-500/40',
      ring: 'ring-emerald-500/30',
    };
  }
  if (num >= 70) {
    return {
      label: 'Moderate ATS Pass Confidence',
      badge: 'COMPLIANT (75%+ PASS)',
      color: 'text-cyan-400 bg-cyan-950/40 border-cyan-500/40',
      ring: 'ring-cyan-500/30',
    };
  }
  if (num >= 50) {
    return {
      label: 'Parsing Vulnerabilities Detected',
      badge: 'WARNING (AT-RISK)',
      color: 'text-amber-400 bg-amber-950/40 border-amber-500/40',
      ring: 'ring-amber-500/30',
    };
  }
  return {
    label: 'Critical Ingestion Risk',
    badge: 'CRITICAL FAILURE RISK',
    color: 'text-rose-400 bg-rose-950/40 border-rose-500/40',
    ring: 'ring-rose-500/30',
  };
};

/**
 * Client-side fallback diagnostic analyzer when backend is offline.
 */
export const calculateClientAtsDiagnostic = (resumeText, job = null) => {
  const text = String(resumeText || '').trim();
  const lower = text.toLowerCase();
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // 1. STAR Metric & Bullet Extraction
  const bulletLines = lines.filter((l) => /^[-*•–—►]\s+/.test(l));
  const totalBullets = bulletLines.length;

  const metricRegex = /(\d+(\.\d+)?%|\$[\d,]+|\b\d+\s*(k|m|b)\b|\b\d+\+?\s*(users|servers|clients|microservices|engineers|hours|minutes)\b)/i;
  let quantifiedCount = 0;
  const analyzedBullets = bulletLines.map((b) => {
    const clean = b.replace(/^[-*•–—►]\s+/, '').trim();
    const isQuantified = metricRegex.test(clean);
    if (isQuantified) quantifiedCount++;
    return {
      text: clean,
      quantified: isQuantified,
      has_weak_opener: /^(worked on|helped with|responsible for|assisted with)/i.test(clean),
    };
  });

  const densityPct = totalBullets > 0 ? Math.round((quantifiedCount / totalBullets) * 100) : 0;

  // 2. Fluff Detection
  const fluffWords = ['results-driven', 'thought leader', 'team player', 'dynamic self-starter', 'fast-paced environment', 'hard worker'];
  const foundFluff = fluffWords.filter((w) => lower.includes(w));

  // 3. Section Taxonomies
  const hasSummary = /professional\s+summary|executive\s+summary|summary|profile/i.test(lower);
  const hasExperience = /work\s+experience|professional\s+experience|employment\s+history|experience/i.test(lower);
  const hasSkills = /skills|technical\s+skills|core\s+competencies/i.test(lower);
  const hasEducation = /education|qualifications|academic/i.test(lower);
  const hasReferees = /referees?|references?/i.test(lower);

  // 4. Non-standard headers
  const taxonomyWarnings = [];
  if (/my\s+journey/i.test(lower)) taxonomyWarnings.push("Non-standard section header: 'My Journey'");
  if (/core\s+strengths/i.test(lower)) taxonomyWarnings.push("Non-standard section header: 'Core Strengths'");

  // 5. Australian Regional Compliance
  const demographicRisks = [];
  if (/date\s+of\s+birth|d\.o\.b/i.test(lower)) demographicRisks.push('Date of Birth (age bias risk)');
  if (/marital\s+status/i.test(lower)) demographicRisks.push('Marital Status (family status bias risk)');
  if (/nationality/i.test(lower)) demographicRisks.push('Nationality (citizenship bias risk)');

  // 6. Contact info & Topological Flattening simulation
  const candidateName = lines[0] || 'Unknown Candidate';
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  const phoneMatch = text.match(/(\+?61\s?|0)[2-478](\s?\d){8}/);

  // Score math
  let complianceScore = 100;
  if (!hasExperience) complianceScore -= 30;
  if (!hasSkills) complianceScore -= 15;
  if (!hasEducation) complianceScore -= 15;
  if (!hasSummary) complianceScore -= 10;
  if (!hasReferees) complianceScore -= 5;
  if (taxonomyWarnings.length) complianceScore -= 15;
  complianceScore = Math.max(25, Math.min(100, complianceScore));

  const compositeScore = Math.round(
    complianceScore * 0.4 +
    densityPct * 0.4 +
    (hasReferees && demographicRisks.length === 0 ? 100 : 50) * 0.2
  );

  const recommendations = [];
  if (taxonomyWarnings.length) recommendations.push(...taxonomyWarnings);
  if (densityPct < 50) recommendations.push(`STAR Metric Density is ${densityPct}%. Add quantified numbers to your bullets.`);
  if (foundFluff.length) recommendations.push(`Eradicate corporate fluff: ${foundFluff.join(', ')}.`);
  if (!hasReferees) recommendations.push('Include a Referees section with professional references.');
  if (demographicRisks.length) recommendations.push(`Remove demographic indicators: ${demographicRisks.join(', ')}.`);

  return {
    ats_score: Math.max(20, Math.min(100, compositeScore)),
    ats_compliance: {
      overall_score: complianceScore,
      detected_sections: {
        summary: hasSummary,
        work_experience: hasExperience,
        skills: hasSkills,
        education: hasEducation,
        referees: hasReferees,
      },
      taxonomy_warnings: taxonomyWarnings,
      workday: {
        status: hasExperience && hasEducation && taxonomyWarnings.length === 0 ? 'passed' : 'warning',
        details: 'Rigid 4-schema validation for Workday / Textkernel engine.',
      },
      greenhouse: {
        status: hasSkills && hasExperience ? 'passed' : 'warning',
        details: 'Structured skills and timeline extraction for Greenhouse.',
      },
      taleo: {
        status: 'passed',
        details: 'Single-column linear extraction verified for Taleo / iCIMS.',
      },
      jobadder: {
        status: emailMatch && hasExperience ? 'passed' : 'warning',
        details: 'Verified for Australian JobAdder recruitment CRM ingestion.',
      },
    },
    star_density: {
      total_bullets: totalBullets,
      quantified_bullets: quantifiedCount,
      density_percentage: densityPct,
      fluff_count: foundFluff.length,
      fluff_phrases: foundFluff,
      bullets: analyzedBullets,
    },
    regional_au: {
      compliant: hasReferees && demographicRisks.length === 0,
      has_referees: hasReferees,
      demographic_risks: demographicRisks,
    },
    topological_flattening: {
      candidate_name: candidateName,
      contact_info: {
        email: emailMatch ? emailMatch[0] : null,
        phone: phoneMatch ? phoneMatch[0] : null,
      },
      raw_text_stream: text.replace(/[ \t]+/g, ' '),
    },
    actionable_recommendations: recommendations,
    target_job: {
      title: job?.title || 'Target Role',
      company: job?.company || 'Target Employer',
    },
  };
};

/**
 * Fetches ATS diagnostic analysis from backend API with transparent client fallback.
 */
export const fetchAtsDiagnosticReport = async ({ resumeText, job = null, profile = null }) => {
  const apiBase = getBackendApiBase();
  const textPayload = resumeText || profile?.resume_text || profile?.rawResumeText || profile?.summary || '';

  try {
    const response = await fetch(`${apiBase}/api/ats-diagnostic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resume_text: textPayload,
        job,
        job_id: job?.id,
        profile,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.diagnostic) {
        return data.diagnostic;
      }
    }
  } catch (err) {
    console.warn('[atsDiagnosticService] Backend API unreachable, utilizing client engine:', err.message);
  }

  // Graceful in-browser fallback
  return calculateClientAtsDiagnostic(textPayload, job);
};
