import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActionHighlights } from '../ActionHighlights';

describe('ActionHighlights Component', () => {
  const mockJobs = [
    { id: '1', title: 'Senior SRE', company: 'Telstra', status: 'Interview / Stage 2 Scheduled', date: '2026-08-31' },
    { id: '2', title: 'Lead Architect', company: 'ANZ', status: 'Package Prepared / To Submit', date: '2026-08-31' },
    { id: '3', title: 'Junior Dev', company: 'Startup', status: 'Scraped', date: '2026-08-31' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters only critical action jobs (Interviews, Offers, Packages to Submit)', () => {
    render(
      <ActionHighlights 
        jobs={mockJobs} 
        onOpenMockInterview={vi.fn()} 
        onOpenInterviewPrep={vi.fn()} 
        onSelectJob={vi.fn()} 
      />
    );

    expect(screen.getByText(/Immediate Action Required \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText('Senior SRE')).toBeInTheDocument();
    expect(screen.getByText('Lead Architect')).toBeInTheDocument();
    expect(screen.queryByText('Junior Dev')).not.toBeInTheDocument();
  });

  it('opens Interview Prep and Mock Interview on click', () => {
    const handleMockInterview = vi.fn();
    const handleInterviewPrep = vi.fn();

    render(
      <ActionHighlights 
        jobs={mockJobs} 
        onOpenMockInterview={handleMockInterview} 
        onOpenInterviewPrep={handleInterviewPrep} 
        onSelectJob={vi.fn()} 
      />
    );

    const prepButton = screen.getByRole('button', { name: /Prep Guide/i });
    fireEvent.click(prepButton);
    expect(handleInterviewPrep).toHaveBeenCalledWith(mockJobs[0]);

    const simButton = screen.getByRole('button', { name: /Simulator/i });
    fireEvent.click(simButton);
    expect(handleMockInterview).toHaveBeenCalledWith(mockJobs[0]);
  });
});
