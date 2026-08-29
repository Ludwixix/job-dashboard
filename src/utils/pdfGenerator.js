import { jsPDF } from 'jspdf';

/**
 * Format string safely for filenames
 */
const sanitizeFilename = (str) => {
  return (str || 'Document').replace(/[^a-zA-Z0-9_-]/g, '_');
};

/**
 * Direct Client-Side Resume PDF Generator
 */
export const downloadResumePdf = (resumeText, job, filename) => {
  if (!resumeText) return;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const company = job?.company || 'Target_Employer';
  const defaultFilename = filename || `Sam_Ludwig_${sanitizeFilename(company)}_Resume.pdf`;

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
    const line = rawLine.trim();

    if (!line) {
      y += 2.5;
      return;
    }

    // Main Header (H1: # Candidate Name)
    if (line.startsWith('# ')) {
      checkPageBreak(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42); // slate-900
      const title = line.replace(/^#\s*/, '');
      doc.text(title, margin, y);
      y += 6;
      return;
    }

    // Section Header (H2: ## SECTION NAME)
    if (line.startsWith('## ')) {
      y += 3;
      checkPageBreak(10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(30, 27, 75); // indigo-950
      const secTitle = line.replace(/^##\s*/, '').toUpperCase();
      doc.text(secTitle, margin, y);
      y += 1.5;
      doc.setDrawColor(30, 27, 75);
      doc.setLineWidth(0.4);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4.5;
      return;
    }

    // Role / Job Heading (H3: ### Role Title | Company)
    if (line.startsWith('### ')) {
      checkPageBreak(8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      const roleHeading = line.replace(/^###\s*/, '');
      doc.text(roleHeading, margin, y);
      y += 4.5;
      return;
    }

    // Date / Subtitle (*Date | Location*)
    if (line.startsWith('*') && line.endsWith('*')) {
      checkPageBreak(6);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // slate-600
      const sub = line.replace(/^\*|\*$/g, '');
      doc.text(sub, margin, y);
      y += 4;
      return;
    }

    // Bullet Points (- Bullet or • Bullet)
    if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
      checkPageBreak(6);
      const bulletText = line.replace(/^[-•*]\s*/, '');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59); // slate-800

      // Bullet dot
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

    // Standard Body Text or Contact info
    checkPageBreak(5);
    doc.setFont('helvetica', line.includes('|') ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    const splitBody = doc.splitTextToSize(line.replace(/\*\*/g, ''), maxLineWidth);
    splitBody.forEach((t) => {
      checkPageBreak(4);
      doc.text(t, margin, y);
      y += 4;
    });
  });

  doc.save(defaultFilename);
};

/**
 * Direct Client-Side Cover Letter PDF Generator
 */
export const downloadCoverLetterPdf = (coverLetterText, job, filename) => {
  if (!coverLetterText) return;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const company = job?.company || 'Target_Employer';
  const defaultFilename = filename || `Sam_Ludwig_${sanitizeFilename(company)}_CoverLetter.pdf`;

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

  const paragraphs = coverLetterText.split(/\n\s*\n/).filter(Boolean);

  paragraphs.forEach((para) => {
    const text = para.trim().replace(/\*\*/g, '');
    checkPageBreak(6);

    // Subject/RE line
    if (text.startsWith('RE:') || text.startsWith('Re:')) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      const split = doc.splitTextToSize(text, maxLineWidth);
      split.forEach(t => {
        checkPageBreak(5);
        doc.text(t, margin, y);
        y += 5;
      });
      y += 2;
      return;
    }

    // Salutation
    if (text.startsWith('Dear ')) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(text, margin, y);
      y += 6;
      return;
    }

    // Sign off
    if (text.startsWith('Sincerely,') || text.startsWith('Warm regards,')) {
      y += 2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      const lines = text.split('\n');
      lines.forEach(l => {
        checkPageBreak(5);
        doc.text(l.trim(), margin, y);
        y += 4.5;
      });
      return;
    }

    // Normal Paragraph
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59); // slate-800
    const splitPara = doc.splitTextToSize(text.replace(/\n/g, ' '), maxLineWidth);
    splitPara.forEach(t => {
      checkPageBreak(5);
      doc.text(t, margin, y);
      y += 4.6;
    });
    y += 3.5;
  });

  doc.save(defaultFilename);
};
