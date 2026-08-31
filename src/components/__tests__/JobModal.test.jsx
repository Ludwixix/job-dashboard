import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobModal } from '../JobModal';

describe('JobModal Component', () => {
  const mockJob = {
    id: 'test-123',
    title: 'Senior Cloud Engineer',
    company: 'Acme Corp',
    location: 'Melbourne VIC',
    salary: '$140,000 - $160,000',
    status: 'Ready to Apply',
    score: 92,
    snippet: 'Looking for a Senior Cloud Engineer with AWS & Terraform expertise.',
    description: 'Full job description text with requirements and qualifications.'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('renders job details correctly', () => {
    render(<JobModal job={mockJob} onClose={vi.fn()} />);

    expect(screen.getByText('Senior Cloud Engineer')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText(/Melbourne VIC/i)).toBeInTheDocument();
  });

  it('alerts user when 1-Click Auto Apply is clicked without an API key', async () => {
    render(<JobModal job={mockJob} onClose={vi.fn()} onJobStatusUpdate={vi.fn()} />);

    // Switch to Assets tab
    const assetsTab = screen.getByText(/ASSETS & ACTIONS/i);
    fireEvent.click(assetsTab);

    // Click the 1-Click auto apply button
    const applyButton = screen.getByText(/AUTO-APPLY/i);
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('API key')
      );
    });
  });

  it('opens Psychological Decoder modal when button is clicked in assets tab', () => {
    render(<JobModal job={mockJob} onClose={vi.fn()} />);

    // Switch to Assets tab
    const assetsTab = screen.getByText(/ASSETS & ACTIONS/i);
    fireEvent.click(assetsTab);

    const psychButton = screen.getByText(/DECRYPT EMPLOYER PSYCHOLOGY/i);
    fireEvent.click(psychButton);

    expect(screen.getByText(/Psychological Decoder/i)).toBeInTheDocument();
    expect(screen.getByText(/DECRYPTING: Senior Cloud Engineer @ Acme Corp/i)).toBeInTheDocument();
  });
});
