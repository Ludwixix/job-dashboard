import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FollowUpEmailModal } from '../FollowUpEmailModal';

describe('FollowUpEmailModal Component', () => {
  const mockJob = {
    title: 'Registered Nurse',
    company: 'Monash Health',
    location: 'Melbourne, VIC',
    contactEmail: 'talent@monashhealth.org'
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });
  });

  it('renders modal header, recipient, and default application follow-up content', () => {
    render(<FollowUpEmailModal job={mockJob} onClose={vi.fn()} />);

    expect(screen.getByText('OUTREACH & COMMUNICATION SUITE')).toBeInTheDocument();
    expect(screen.getByText('Registered Nurse')).toBeInTheDocument();
    expect(screen.getByText('Monash Health')).toBeInTheDocument();
    expect(screen.getByDisplayValue('talent@monashhealth.org')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Application Follow-up/i)).toBeInTheDocument();
  });

  it('switches between Follow-up, Recruiter Cold Pitch, and Thank You modes', () => {
    render(<FollowUpEmailModal job={mockJob} onClose={vi.fn()} />);

    // Switch to Recruiter Cold Pitch
    const pitchBtn = screen.getByText('RECRUITER COLD PITCH');
    fireEvent.click(pitchBtn);

    expect(screen.getByDisplayValue(/Introduction:/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/10-minute introductory discussion/i)).toBeInTheDocument();

    // Switch to Thank You
    const thankYouBtn = screen.getByText('POST-INTERVIEW THANK YOU');
    fireEvent.click(thankYouBtn);

    expect(screen.getByDisplayValue(/Thank You: Interview Discussion/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/insightful discussion today/i)).toBeInTheDocument();
  });

  it('copies full outreach message to clipboard', () => {
    render(<FollowUpEmailModal job={mockJob} onClose={vi.fn()} />);

    const copyBtn = screen.getByText(/COPY FULL OUTREACH/i);
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
});
