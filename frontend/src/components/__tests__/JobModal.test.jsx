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

  it('opens Psychological Decoder modal when button is clicked in assets tab', () => {
    render(<JobModal job={mockJob} onClose={vi.fn()} />);

    const assetsTab = screen.getByRole('button', { name: /ASSETS & ACTIONS/i });
    fireEvent.click(assetsTab);

    const psychButton = screen.getByRole('button', { name: /DECRYPT EMPLOYER PSYCHOLOGY/i });
    fireEvent.click(psychButton);

    expect(screen.getByText(/Employer Psychology Decoder/i)).toBeInTheDocument();
  });

  it('toggles Intelligence Tools dropdown and calls respective tool callbacks', () => {
    const onOpenFunnelIntel = vi.fn();
    const onOpenRecruiterCrm = vi.fn();
    const onOpenExecutiveDossier = vi.fn();
    const onOpenOfferHub = vi.fn();

    render(
      <JobModal
        job={mockJob}
        onClose={vi.fn()}
        onOpenFunnelIntel={onOpenFunnelIntel}
        onOpenRecruiterCrm={onOpenRecruiterCrm}
        onOpenExecutiveDossier={onOpenExecutiveDossier}
        onOpenOfferHub={onOpenOfferHub}
      />
    );

    // Initial state: menu closed
    expect(screen.queryByText('Funnel Intelligence')).not.toBeInTheDocument();

    // Click Intelligence Tools button
    const intelBtn = screen.getByRole('button', { name: /INTELLIGENCE TOOLS/i });
    fireEvent.click(intelBtn);

    // Dropdown open: all 4 items visible
    expect(screen.getByText('Funnel Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Recruiter CRM')).toBeInTheDocument();
    expect(screen.getByText('Executive Dossier')).toBeInTheDocument();
    expect(screen.getByText('Offer Action Hub')).toBeInTheDocument();

    // Click Funnel Intelligence
    fireEvent.click(screen.getByText('Funnel Intelligence'));
    expect(onOpenFunnelIntel).toHaveBeenCalledWith(mockJob);

    // Menu should be closed after selection
    expect(screen.queryByText('Funnel Intelligence')).not.toBeInTheDocument();
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
});
