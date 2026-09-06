import { jsPDF } from 'jspdf';
import { getActiveProfile } from '../services/profileService';
import { format } from 'date-fns';

const sanitizeFilename = (str) => {
  return (str || 'Document').replace(/[^a-zA-Z0-9_-]/g, '_');
};

/**
 * Generates an official Workforce Australia Mutual Obligations Evidence Report PDF
 */
export const downloadWorkforceEvidencePdf = (pbasSummary, candidateProfile, customSettings = {}) => {
  if (!pbasSummary) return;

  const profile = candidateProfile || getActiveProfile();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const maxLineWidth = pageWidth - margin * 2;
  let y = margin;

  const renderHeader = (isContinuation = false) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('WORKFORCE AUSTRALIA — MUTUAL OBLIGATIONS EVIDENCE REPORT', margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const subtitle = isContinuation 
      ? `Evidence Ledger (Continued) | Participant: ${candName}` 
      : 'Points Based Activation System (PBAS) Evidence & Activity Verification Audit';
    doc.text(subtitle, margin, y);
    y += 3;

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
  };

  const checkPageBreak = (neededHeight = 10) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
      renderHeader(true);
    }
  };

  const candName = profile?.name || 'Samuel Ludwig';
  const candNameSafe = sanitizeFilename(candName);
  const cycleLabel = pbasSummary?.cycle?.label || 'Active_Cycle';
  const filename = `Workforce_Australia_Evidence_${candNameSafe}_${sanitizeFilename(cycleLabel)}.pdf`;

  renderHeader(false);

  // Participant & Period Meta Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, maxLineWidth, 20, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, maxLineWidth, 20, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('PARTICIPANT DETAILS:', margin + 4, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${candName} (${profile?.location || 'Melbourne, VIC'})`, margin + 45, y + 5);

  const jsid = customSettings.jobseekerId || profile?.jobseekerId || 'Not Recorded';
  doc.setFont('helvetica', 'bold');
  doc.text('JOBSEEKER ID / JSID:', margin + 4, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(jsid, margin + 45, y + 10);

  // PBAS Metrics Summary Cards (3 horizontal boxes)
  const boxWidth = (maxLineWidth - 6) / 3;
  const boxHeight = 16;

  // Box 1: Total Points
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, boxWidth, boxHeight, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('PBAS POINTS ACHIEVED', margin + 3, y + 4.5);
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${pbasSummary.totalPoints} / ${pbasSummary.pointsTarget} pts (${pbasSummary.percentage}%)`, margin + 3, y + 11.5);

  // Box 2: Job Applications
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin + boxWidth + 3, y, boxWidth, boxHeight, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('APPLICATIONS (5 pts)', margin + boxWidth + 6, y + 4.5);
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${pbasSummary.applicationCount} (${pbasSummary.applicationCount * 5} pts)`, margin + boxWidth + 6, y + 11.5);

  // Box 3: Interviews
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin + (boxWidth + 3) * 2, y, boxWidth, boxHeight, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('INTERVIEWS (20 pts)', margin + (boxWidth + 3) * 2 + 3, y + 4.5);
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${pbasSummary.interviewCount} (${pbasSummary.interviewCount * 20} pts)`, margin + (boxWidth + 3) * 2 + 3, y + 11.5);

  y += 22;

  // Table Section Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('SUBMITTED EVIDENCE & ACTIVITY LOG', margin, y);
  y += 5;

  // Table Column Header
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, maxLineWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);

  const colDate = margin + 2;
  const colCompany = margin + 24;
  const colTitle = margin + 68;
  const colType = margin + 120;
  const colPoints = margin + 155;
  const colStatus = margin + 168;

  doc.text('Date', colDate, y + 4.2);
  doc.text('Employer / Business', colCompany, y + 4.2);
  doc.text('Job Title', colTitle, y + 4.2);
  doc.text('Activity Type', colType, y + 4.2);
  doc.text('Pts', colPoints, y + 4.2);
  doc.text('Status', colStatus, y + 4.2);

  y += 6;

  // Table Rows
  const items = pbasSummary.items || [];
  items.forEach((item, idx) => {
    checkPageBreak(8);

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, maxLineWidth, 6.5, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);

    const rowDate = item.dateStr || (item.eventDate ? format(item.eventDate, 'yyyy-MM-dd') : '-');
    doc.text(rowDate, colDate, y + 4.3);

    const companyText = (item.company || 'Employer').substring(0, 24);
    doc.setFont('helvetica', 'bold');
    doc.text(companyText, colCompany, y + 4.3);

    doc.setFont('helvetica', 'normal');
    const titleText = (item.title || 'Role').substring(0, 30);
    doc.text(titleText, colTitle, y + 4.3);

    const typeText = (item.type || 'Application').substring(0, 20);
    doc.text(typeText, colType, y + 4.3);

    doc.setFont('helvetica', 'bold');
    doc.text(`+${item.pointsAwarded || 5}`, colPoints, y + 4.3);

    doc.setFont('helvetica', 'normal');
    doc.text((item.status || 'Applied').substring(0, 10), colStatus, y + 4.3);

    y += 6.5;
  });

  checkPageBreak(20);
  y += 5;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Participant Declaration: I declare that the job search and interview activities recorded above were undertaken as part of meeting my mutual obligation requirements under the Workforce Australia Points Based Activation System. Generated on ${format(new Date(), 'dd MMMM yyyy HH:mm')}.`,
    margin,
    y,
    { maxWidth: maxLineWidth }
  );

  doc.save(filename);
};

