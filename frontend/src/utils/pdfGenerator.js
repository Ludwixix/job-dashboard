import { jsPDF } from 'jspdf';
import { getActiveProfile } from '../services/profileService';

/**
 * Format string safely for filenames
 */
const sanitizeFilename = (str) => {
  return (str || 'Document').replace(/[^a-zA-Z0-9_-]/g, '_');
};

/**
 * Executive Resume PDF Generator
 */
export const downloadResumePdf = (resumeText, job, candidateProfile, filename) => {
  if (!resumeText) return;
  const profile = candidateProfile || getActiveProfile();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const company = job?.company || 'Target_Employer';
  const candNameSafe = sanitizeFilename(profile?.name || 'Candidate');
  const defaultFilename = filename || `${candNameSafe}_${sanitizeFilename(company)}_Resume.pdf`;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const maxLineWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPageBreak = (neededHeight = 6) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const lines = resumeText.split('\n');

  lines.forEach((rawLine) => {
    let line = rawLine.trim();
    if (!line) {
      y += 2.2;
      return;
    }

    // Clean markdown bold/italic artifacts if needed for detection
    const cleanHeaderTest = line.replace(/[*#_]/g, '').trim().toUpperCase();
    const candidateNameUpper = (profile?.name || 'Candidate').toUpperCase();

    // 1. Top Candidate Name (H1: # Candidate Name or Candidate Name)
    if (line.startsWith('# ') || cleanHeaderTest === candidateNameUpper || (cleanHeaderTest.startsWith(candidateNameUpper) && cleanHeaderTest.length < 40) || cleanHeaderTest === 'SAM LUDWIG') {
      checkPageBreak(14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42); // slate-900
      const title = line.replace(/^#\s*/, '').replace(/\*\*/g, '');
      doc.text(title, margin, y);
      y += 6.5;
      return;
    }

    // 2. Major Section Header (e.g. ## PROFESSIONAL SUMMARY, *PROFESSIONAL EXPERIENCE*, **CORE SKILLS**, etc.)
    const isSectionHeader = 
      line.startsWith('## ') ||
      cleanHeaderTest === 'PROFESSIONAL SUMMARY' ||
      cleanHeaderTest === 'EXECUTIVE SUMMARY' ||
      cleanHeaderTest === 'CORE SKILLS' ||
      cleanHeaderTest === 'SKILLS' ||
      cleanHeaderTest === 'TECHNICAL COMPETENCIES' ||
      cleanHeaderTest === 'CORE TECHNICAL COMPETENCIES' ||
      cleanHeaderTest === 'CORE TECHNICAL EXPERTISE' ||
      cleanHeaderTest === 'PROFESSIONAL EXPERIENCE' ||
      cleanHeaderTest === 'EMPLOYMENT HISTORY' ||
      cleanHeaderTest === 'WORK EXPERIENCE' ||
      cleanHeaderTest === 'EDUCATION' ||
      cleanHeaderTest === 'EDUCATION & CERTIFICATIONS' ||
      cleanHeaderTest === 'EDUCATION AND CERTIFICATIONS' ||
      cleanHeaderTest === 'KEY CERTIFICATIONS & EDUCATION' ||
      cleanHeaderTest === 'CERTIFICATIONS & EDUCATION' ||
      cleanHeaderTest === 'REFEREES' ||
      cleanHeaderTest === 'REFERENCES' ||
      cleanHeaderTest === 'NOTABLE TECHNICAL PROJECTS' ||
      cleanHeaderTest === 'KEY HIGHLIGHTS & METRICS' ||
      cleanHeaderTest === 'ADDITIONAL INFORMATION';

    if (isSectionHeader) {
      y += 2.5;
      checkPageBreak(11);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(30, 27, 75); // navy #1e1b4b
      const secTitle = cleanHeaderTest;
      doc.text(secTitle, margin, y);
      y += 1.8;
      doc.setDrawColor(30, 27, 75);
      doc.setLineWidth(0.45);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4.5;
      return;
    }

    // 3. Role / Position Heading (H3: ### Role Title | Company or Role — Company)
    if (line.startsWith('### ') || (line.includes('—') && line.length < 80) || (line.includes('|') && (line.includes('20') || line.includes('Capgemini') || line.includes('Post') || line.includes('Knosys') || line.includes('Engage') || line.includes('Health') || line.includes('Education')))) {
      checkPageBreak(8);
      const roleText = line.replace(/^###\s*/, '').replace(/\*\*/g, '');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      
      const splitRole = doc.splitTextToSize(roleText, maxLineWidth);
      splitRole.forEach(t => {
        checkPageBreak(4.5);
        doc.text(t, margin, y);
        y += 4.5;
      });
      return;
    }

    // 4. Date & Location Subtitle (*Date | Location*)
    if ((line.startsWith('*') && line.endsWith('*') && line.length < 60) || (line.includes('Melbourne') && line.length < 60 && !line.includes('SAM LUDWIG'))) {
      checkPageBreak(5);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // slate-600
      const sub = line.replace(/^\*|\*$/g, '').replace(/\*\*/g, '');
      doc.text(sub, margin, y);
      y += 4;
      return;
    }

    // 5. Bullet Points (- Bullet or • Bullet or * Bullet)
    if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ') || line.startsWith('| ')) {
      checkPageBreak(6);
      const bulletText = line.replace(/^[-•*|]\s*/, '').replace(/\*\*/g, '');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59); // slate-800

      // Bullet symbol
      doc.text('•', margin + 1, y);

      const splitText = doc.splitTextToSize(bulletText, maxLineWidth - 6);
      splitText.forEach((t) => {
        checkPageBreak(4);
        doc.text(t, margin + 5, y);
        y += 3.8;
      });
      y += 0.8;
      return;
    }

    // 6. Contact Header Line (Melbourne, VIC | 0405 993 245 | ...)
    if ((profile?.phone && line.includes(profile.phone)) || (profile?.email && line.includes(profile.email)) || line.includes('0405 993 245') || line.includes('sam.ludwig@gmail.com') || (line.includes('|') && line.length < 130 && (line.includes('Citizen') || line.includes('Clearance') || line.includes('Work Rights')))) {
      checkPageBreak(6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      const cleanContact = line.replace(/[*#_]/g, '');
      doc.text(cleanContact, margin, y);
      y += 4.5;
      return;
    }

    // 7. Standard Body Text (Summary, Skills Matrix, etc.)
    checkPageBreak(5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    const splitBody = doc.splitTextToSize(line.replace(/\*\*/g, ''), maxLineWidth);
    splitBody.forEach((t) => {
      checkPageBreak(4);
      doc.text(t, margin, y);
      y += 4;
    });
    y += 1;
  });

  doc.save(defaultFilename);
};

/**
 * Executive Cover Letter PDF Generator
 */
export const downloadCoverLetterPdf = (coverLetterText, job, candidateProfile, filename) => {
  if (!coverLetterText) return;
  const profile = candidateProfile || getActiveProfile();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const company = job?.company || 'Target_Employer';
  const roleTitle = job?.title || 'Target Role';
  const candNameSafe = sanitizeFilename(profile?.name || 'Candidate');
  const defaultFilename = filename || `${candNameSafe}_${sanitizeFilename(company)}_CoverLetter.pdf`;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const maxLineWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPageBreak = (neededHeight = 6) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // ── Executive Header Letterhead ─────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text((profile?.name || 'CANDIDATE NAME').toUpperCase(), margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const contactLine = `${profile?.location || 'Melbourne, VIC'} | ${profile?.phone || ''} | ${profile?.email || ''} | ${profile?.workRights || 'Australian Citizen'}`;
  doc.text(contactLine, margin, y);
  y += 3;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Date & Recipient
  const dateStr = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(dateStr, margin, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`Hiring Team / Talent Acquisition`, margin, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.text(`${company}`, margin, y);
  y += 6;

  // Subject line
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 27, 75);
  doc.text(`RE: Application for ${roleTitle} — ${company}`, margin, y);
  y += 6;

  // ── Body Paragraphs ────────────────────────────────────────────────────────
  const paragraphs = coverLetterText.split(/\n\s*\n/).filter(Boolean);

  paragraphs.forEach((para) => {
    let text = para.trim().replace(/\*\*/g, '');
    checkPageBreak(6);

    // Skip if already rendered in header
    if (text.startsWith('RE:') || text.startsWith('Re:') || text.startsWith('Dear ') && text.length < 50) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(text, margin, y);
      y += 5.5;
      return;
    }

    // Sign off block
    if (text.includes('Sincerely') || text.includes('Warm regards') || text.includes('Yours sincerely')) {
      y += 3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('Yours sincerely,', margin, y);
      y += 5.5;
      doc.setFont('helvetica', 'bold');
      doc.text(profile?.name || 'Candidate', margin, y);
      y += 4;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(profile?.title || 'Senior Systems & Infrastructure Specialist', margin, y);
      return;
    }

    // Main narrative paragraph
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    const splitPara = doc.splitTextToSize(text.replace(/\n/g, ' '), maxLineWidth);
    splitPara.forEach(t => {
      checkPageBreak(4.5);
      doc.text(t, margin, y);
      y += 4.5;
    });
    y += 3.5;
  });

  doc.save(defaultFilename);
};

