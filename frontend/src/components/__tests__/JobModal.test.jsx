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
});
