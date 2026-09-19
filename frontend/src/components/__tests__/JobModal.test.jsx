import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobModal } from '../JobModal';

describe('JobModal Component', () => {
  const mockJob = {
    id: '123',
    title: 'Senior Cloud Engineer',
    company: 'Acme Corp',
    location: 'Melbourne VIC',
    status: 'Ready to Apply',
    matchScore: 92,
    scoreBreakdown: {
      titleMatch: 95,
      skillsMatch: 90,
      recency: 90,
      clearance: 90,
      overall: 92
    },
    skills: ['AWS', 'Terraform', 'Kubernetes'],
    description: 'Great role for a senior engineer.'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('renders job details correctly', () => {
    render(<JobModal job={mockJob} onClose={vi.fn()} />);

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Senior Cloud Engineer')).toBeInTheDocument();
    expect(screen.getByText(/Ready to Apply/i)).toBeInTheDocument();
  });

  it('opens Psychological Decoder modal when button is clicked in assets tab', async () => {
    render(<JobModal job={mockJob} onClose={vi.fn()} />);

    const assetsTab = screen.getByRole('button', { name: /ASSETS & ACTIONS/i });
    fireEvent.click(assetsTab);

    const psychButton = screen.getByRole('button', { name: /DECRYPT EMPLOYER PSYCHOLOGY/i });
    fireEvent.click(psychButton);

    expect(await screen.findByText(/Employer Psychology Decoder/i, {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('toggles Intelligence Tools dropdown and calls respective tool callbacks', () => {
    const onOpenFunnelIntel = vi.fn();
    const onOpenRecruiterCrm = vi.fn();
    const onOpenExecutiveDossier = vi.fn();
    const onOpenOfferHub = vi.fn();

    const onOpenCoverLetterPolarizer = vi.fn();
    const onOpenScreeningSolver = vi.fn();
    const onOpenCareerCompass = vi.fn();
    const onOpenKscGenerator = vi.fn();

    render(
      <JobModal
        job={mockJob}
        onClose={vi.fn()}
        onOpenFunnelIntel={onOpenFunnelIntel}
        onOpenRecruiterCrm={onOpenRecruiterCrm}
        onOpenExecutiveDossier={onOpenExecutiveDossier}
        onOpenOfferHub={onOpenOfferHub}
        onOpenCoverLetterPolarizer={onOpenCoverLetterPolarizer}
        onOpenScreeningSolver={onOpenScreeningSolver}
        onOpenCareerCompass={onOpenCareerCompass}
        onOpenKscGenerator={onOpenKscGenerator}
      />
    );

    // Initial state: menu closed
    expect(screen.queryByText('Funnel Intelligence')).not.toBeInTheDocument();

    // Click Intelligence Tools button
    const intelBtn = screen.getByRole('button', { name: /INTELLIGENCE TOOLS/i });
    fireEvent.click(intelBtn);

    // Dropdown open: items visible
    expect(screen.getByText('Funnel Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Recruiter CRM')).toBeInTheDocument();
    expect(screen.getByText('Executive Dossier')).toBeInTheDocument();
    expect(screen.getByText('Offer Action Hub')).toBeInTheDocument();
    expect(screen.getByText('Cover Letter Polarizer')).toBeInTheDocument();
    expect(screen.getByText('Screening Questionnaire Solver')).toBeInTheDocument();
    expect(screen.getByText('Career Compass & Matrix')).toBeInTheDocument();
    expect(screen.getByText('Key Selection Criteria (KSC)')).toBeInTheDocument();

    // Click KSC & Capability Generator
    fireEvent.click(screen.getByText('Key Selection Criteria (KSC)'));
    expect(onOpenKscGenerator).toHaveBeenCalledWith(mockJob);

    // Menu should be closed after selection
    expect(screen.queryByText('Key Selection Criteria (KSC)')).not.toBeInTheDocument();
  });

  it('closes Intelligence Tools dropdown on outside click and Escape key', () => {
    render(
      <JobModal
        job={mockJob}
        onClose={vi.fn()}
        onOpenFunnelIntel={vi.fn()}
      />
    );

    const intelBtn = screen.getByRole('button', { name: /INTELLIGENCE TOOLS/i });
    fireEvent.click(intelBtn);
    expect(screen.getByText('Funnel Intelligence')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Funnel Intelligence')).not.toBeInTheDocument();

    // Open again and click outside
    fireEvent.click(intelBtn);
    expect(screen.getByText('Funnel Intelligence')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Funnel Intelligence')).not.toBeInTheDocument();
  });

  it('renders Candidate Notes tab and allows saving notes', async () => {
    const onJobStatusUpdate = vi.fn();
    render(
      <JobModal
        job={mockJob}
        onClose={vi.fn()}
        onJobStatusUpdate={onJobStatusUpdate}
      />
    );

    // Click MY NOTES tab
    const notesTab = screen.getByRole('button', { name: /MY NOTES/i });
    fireEvent.click(notesTab);

    expect(screen.getByText(/CANDIDATE NOTES & FOLLOW-UP SCRATCHPAD/i)).toBeInTheDocument();
    const textarea = screen.getByPlaceholderText(/Type private notes/i);
    expect(textarea).toBeInTheDocument();

    // Type notes and click SAVE NOTES
    fireEvent.change(textarea, { target: { value: 'Spoke with hiring manager John - 2nd round scheduled' } });
    const saveBtn = screen.getByRole('button', { name: /SAVE NOTES/i });
    fireEvent.click(saveBtn);

    expect(onJobStatusUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '123',
        notes: 'Spoke with hiring manager John - 2nd round scheduled'
      })
    );
  });
});
