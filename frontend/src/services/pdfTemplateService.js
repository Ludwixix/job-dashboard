/**
 * @file pdfTemplateService.js
 * @description Provides Australian ATS-compliant resume compilation, ATS readiness scoring,
 * and high-fidelity vector PDF generation using jsPDF.
 */

import { jsPDF } from 'jspdf';

export const ATS_TEMPLATES = {
  MODERN_EXECUTIVE: 'MODERN_EXECUTIVE',
  TECHNICAL_SPECIALIST: 'TECHNICAL_SPECIALIST',
  APS_PUBLIC_SECTOR: 'APS_PUBLIC_SECTOR'
};

const ACTION_VERBS = [
  'architected', 'engineered', 'spearheaded', 'optimized', 'delivered',
  'implemented', 'accelerated', 'orchestrated', 'designed', 'mentored',
  'refactored', 'streamlined', 'automated', 'scaled', 'championed', 'transformed'
];

/**
 * Compiles a structured profile into an ATS-friendly document object with section breakdowns.
 *
 * @param {Object} params
 * @param {Object} params.profile - Candidate profile.
 * @param {string} [params.templateId='MODERN_EXECUTIVE'] - Template identifier.
 * @returns {Object} Structured document object containing sections and plain text.
 */
export function formatAtsResume({ profile = {}, templateId = ATS_TEMPLATES.MODERN_EXECUTIVE }) {
  const name = profile.name || 'Candidate Name';
  const title = profile.title || 'Technical Specialist';
  const contactParts = [
    profile.email,
    profile.phone,
    profile.location || 'Australia',
    profile.linkedin ? `linkedin.com/in/${profile.linkedin.replace(/^.*linkedin\.com\/in\//, '')}` : null
  ].filter(Boolean);

  const contactLine = contactParts.join(' | ');

  const sections = [];

  // Summary
  if (profile.summary) {
    sections.push({
      title: templateId === ATS_TEMPLATES.APS_PUBLIC_SECTOR ? 'EXECUTIVE CAPABILITY OVERVIEW' : 'PROFESSIONAL SUMMARY',
      content: profile.summary
    });
  }

  // Skills
  if (profile.skills && profile.skills.length > 0) {
    const skillsTitle = templateId === ATS_TEMPLATES.TECHNICAL_SPECIALIST 
      ? 'TECHNICAL CAPABILITY MATRIX' 
      : 'CORE COMPETENCIES & TECHNICAL PROFICIENCIES';
    sections.push({
      title: skillsTitle,
      content: profile.skills.join('  •  ')
    });
  }

  // Experience
  if (profile.experience && profile.experience.length > 0) {
    const expTitle = templateId === ATS_TEMPLATES.APS_PUBLIC_SECTOR 
      ? 'AUSTRALIAN PUBLIC SERVICE & PROFESSIONAL CAREER RECORD' 
      : 'PROFESSIONAL EXPERIENCE & OUTCOMES';
    
    const expLines = profile.experience.map(exp => {
      const header = `${exp.role || 'Role'} — ${exp.company || 'Organization'} (${exp.dates || 'Current'})`;
      const bullets = (exp.bullets || []).map(b => `  • ${b}`).join('\n');
      return `${header}\n${bullets}`;
    }).join('\n\n');

    sections.push({
      title: expTitle,
      content: expLines
    });
  }

  // Education & Credentials
  if (profile.education) {
    sections.push({
      title: 'EDUCATION & FORMAL CREDENTIALS',
      content: profile.education
    });
  }

  // Security Clearances
  if (profile.clearances) {
    sections.push({
      title: 'STATUTORY SECURITY CLEARANCES & ELIGIBILITY',
      content: profile.clearances
    });
  }

  // Plaintext compilation for ATS parsing verification
  const plainText = [
    name.toUpperCase(),
    title,
    contactLine,
    '',
    ...sections.map(s => `[${s.title}]\n${s.content}\n`)
  ].join('\n');

  return {
    name,
    title,
    contactLine,
    sections,
    plainText,
    templateId
  };
}

/**
 * Heuristically evaluates a document's plain text for Australian ATS scanner readiness.
 *
 * @param {string} text - Raw document plain text.
 * @returns {Object} Score out of 100, breakdown metrics, and prescriptive improvement suggestions.
 */
export function computeAtsReadinessScore(text = '') {
  if (!text || typeof text !== 'string') {
    return { score: 0, breakdown: {}, suggestions: ['Provide resume text to calculate ATS readiness.'] };
  }

  const lower = text.toLowerCase();
  const suggestions = [];
  let score = 30; // base floor

  // 1. Contact Information completeness (20 pts)
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text);
  const hasPhoneOrLocation = /(?:\+?61|0[2-578]|\d{4}|\bAustralia\b|\bSydney\b|\bMelbourne\b|\bBrisbane\b|\bCanberra\b)/i.test(text);
  const contactComplete = hasEmail && hasPhoneOrLocation;
  if (contactComplete) {
    score += 20;
  } else {
    if (!hasEmail) suggestions.push('Include a valid professional email address in the contact header.');
    if (!hasPhoneOrLocation) suggestions.push('Add your Australian location/state and mobile contact number.');
  }

  // 2. Standard ATS Headers (20 pts)
  const hasExperience = /experience|work history|career record/i.test(text);
  const hasSkills = /skills|competencies|capabilities|proficiencies/i.test(text);
  const hasEducation = /education|qualifications|credentials/i.test(text);
  const standardHeaders = hasExperience && (hasSkills || hasEducation);
  if (standardHeaders) {
    score += 20;
  } else {
    suggestions.push('Ensure standard ATS headings (e.g. Professional Experience, Core Competencies, Education) are present.');
  }

  // 3. Action Verbs Count (15 pts)
  let verbHits = 0;
  ACTION_VERBS.forEach(v => {
    if (lower.includes(v)) verbHits += 1;
  });
  const verbScore = Math.min(15, verbHits * 5);
  score += verbScore;
  if (verbHits < 2) {
    suggestions.push(`Integrate high-impact action verbs (e.g. ${ACTION_VERBS.slice(0, 5).join(', ')}) at the start of bullet points.`);
  }

  // 4. Quantified Metrics (15 pts)
  const metricMatches = text.match(/(\$\d+[\d,]*|\d+%(?!\w)|\b\d+x\b|\b\d+\s*(?:ms|seconds|minutes|hours|days|k|m|million|billion)\b)/gi) || [];
  const metricCount = metricMatches.length;
  const metricScore = Math.min(15, metricCount * 5);
  score += metricScore;
  if (metricCount < 2) {
    suggestions.push('Anchor achievements in quantifiable metrics (e.g. "reduced latency by 45%", "delivered $150K in savings").');
  }

  return {
    score: Math.min(100, Math.round(score)),
    breakdown: {
      contactComplete,
      standardHeaders,
      actionVerbs: verbHits,
      metrics: metricCount
    },
    suggestions
  };
}

/**
 * Generates an ATS-compliant clean vector PDF document and triggers download.
 *
 * @param {Object} doc - Document object from formatAtsResume.
 * @param {string} [filename] - Custom output filename.
 * @returns {jsPDF} The compiled jsPDF instance.
 */
export function exportVectorPdf(doc, filename = null) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const margin = 18;
  const pageWidth = 210;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  // Header: Name
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(20, 24, 33);
  pdf.text(doc.name || 'Candidate Name', margin, cursorY);
  cursorY += 7;

  // Header: Title
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(51, 65, 85);
  pdf.text(doc.title || '', margin, cursorY);
  cursorY += 5;

  // Header: Contact Info
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.text(doc.contactLine || '', margin, cursorY);
  cursorY += 6;

  // Divider line
  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.4);
  pdf.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 8;

  // Render Sections
  (doc.sections || []).forEach(section => {
    // Check page break threshold
    if (cursorY > 260) {
      pdf.addPage();
      cursorY = margin;
    }

    // Section Header
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(15, 23, 42);
    pdf.text(section.title.toUpperCase(), margin, cursorY);
    cursorY += 5;

    // Section Content
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(51, 65, 85);

    const splitText = pdf.splitTextToSize(section.content, contentWidth);
    splitText.forEach(line => {
      if (cursorY > 275) {
        pdf.addPage();
        cursorY = margin;
      }
      pdf.text(line, margin, cursorY);
      cursorY += 4.5;
    });

    cursorY += 4;
  });

  const outputName = filename || `${(doc.name || 'resume').toLowerCase().replace(/\s+/g, '_')}_ats.pdf`;
  pdf.save(outputName);
  return pdf;
}
