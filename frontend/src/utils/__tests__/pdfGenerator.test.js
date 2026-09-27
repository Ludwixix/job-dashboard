import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadResumePdf, downloadCoverLetterPdf } from '../pdfGenerator';

// Mock jsPDF
const mockSave = vi.fn();
const mockText = vi.fn();
const mockLine = vi.fn();
const mockAddPage = vi.fn();
const mockSetFont = vi.fn();
const mockSetFontSize = vi.fn();
const mockSetTextColor = vi.fn();
const mockSetDrawColor = vi.fn();
const mockSetLineWidth = vi.fn();
const mockSplitTextToSize = vi.fn((text) => [text]);

vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(function() {
    this.internal = {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    };
    this.setFont = mockSetFont;
    this.setFontSize = mockSetFontSize;
    this.setTextColor = mockSetTextColor;
    this.setDrawColor = mockSetDrawColor;
    this.setLineWidth = mockSetLineWidth;
    this.text = mockText;
    this.line = mockLine;
    this.addPage = mockAddPage;
    this.splitTextToSize = mockSplitTextToSize;
    this.save = mockSave;
  }),
}));

describe('pdfGenerator Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockJob = {
    id: 'test-job-1',
    title: 'Senior Infrastructure Engineer',
    company: 'AusPost Tech',
  };

  const mockProfile = {
    name: 'Sam Ludwig',
    title: 'Senior Systems & Infrastructure Engineer',
    location: 'Melbourne, VIC',
    phone: '0405 993 245',
    email: 'sam.ludwig@gmail.com',
  };

  it('generates resume PDF successfully with complete content', () => {
    const resumeText = `# SAM LUDWIG
Senior Infrastructure Engineer
Melbourne, VIC | 0405 993 245 | sam.ludwig@gmail.com

## PROFESSIONAL SUMMARY
Senior systems specialist with 10+ years verified enterprise experience.

## WORK EXPERIENCE
### Senior Managed Services Engineer — Capgemini / Dept of Education (2021 – Present)
- Managed 660,000+ users SharePoint farm with 99.9% uptime
`;

    downloadResumePdf(resumeText, mockJob, mockProfile, 'test_resume.pdf');
    expect(mockSave).toHaveBeenCalledWith('test_resume.pdf');
    expect(mockText).toHaveBeenCalled();
  });

  it('falls back to synthesized resume if resumeText is empty or undefined', () => {
    downloadResumePdf('', mockJob, mockProfile);
    expect(mockSave).toHaveBeenCalled();
    expect(mockText).toHaveBeenCalled();
  });

  it('generates cover letter PDF successfully with complete content', () => {
    const coverLetterText = `Dear AusPost Tech Hiring Team,

Scaling reliable systems requires precision and operational discipline.

At Dept of Education, I managed Southern Hemisphere's largest SharePoint farm with 99.9% uptime.

Yours sincerely,
Sam Ludwig`;

    downloadCoverLetterPdf(coverLetterText, mockJob, mockProfile, 'test_cover.pdf');
    expect(mockSave).toHaveBeenCalledWith('test_cover.pdf');
    expect(mockText).toHaveBeenCalled();
  });

  it('falls back to synthesized cover letter if coverLetterText is empty or undefined', () => {
    downloadCoverLetterPdf(undefined, mockJob, mockProfile);
    expect(mockSave).toHaveBeenCalled();
    expect(mockText).toHaveBeenCalled();
  });
});
