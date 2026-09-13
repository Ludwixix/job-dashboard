import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoverLetterPolarizerModal } from '../CoverLetterPolarizerModal';

describe('CoverLetterPolarizerModal Component', () => {
  const mockJob = {
    id: 'test-job-456',
    title: 'Senior DevOps Architect',
    company: 'Canva',
    coverLetterText: 'I am writing to apply for the Senior DevOps Architect position at Canva.\n\nI have 5 years of experience with Terraform and Kubernetes.\n\nLet me know when we can interview.',
    description: 'Scale our cloud infrastructure.',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal header, title, and initial audit verdict', async () => {
    render(<CoverLetterPolarizerModal job={mockJob} onClose={vi.fn()} />);

    expect(await screen.findByText(/Cover Letter Swappability & Polarizer Hub/i)).toBeInTheDocument();
    expect(screen.getByText('Canva')).toBeInTheDocument();
    expect(screen.getByText(/Senior DevOps Architect/i)).toBeInTheDocument();
  });

  it('switches tabs and displays 3-paragraph blueprint', async () => {
    render(<CoverLetterPolarizerModal job={mockJob} onClose={vi.fn()} />);

    // Wait for async load to finish
    expect(await screen.findByText(/Executive Swappability Verdict/i)).toBeInTheDocument();

    const blueprintTab = screen.getByRole('button', { name: /3-PARAGRAPH BLUEPRINT/i });
    fireEvent.click(blueprintTab);

    expect(await screen.findByText(/The 3-Paragraph Rule/i)).toBeInTheDocument();
    expect(screen.getByText(/Company Trajectory & Context/i)).toBeInTheDocument();
  });

  it('navigates to polarizing variants and applies variant to editor', async () => {
    const onSaveCoverLetter = vi.fn();
    render(
      <CoverLetterPolarizerModal
        job={mockJob}
        onClose={vi.fn()}
        onSaveCoverLetter={onSaveCoverLetter}
      />
    );

    // Wait for async load to finish
    expect(await screen.findByText(/Executive Swappability Verdict/i)).toBeInTheDocument();

    const variantsTab = screen.getByRole('button', { name: /POLARIZING REWRITES/i });
    fireEvent.click(variantsTab);

    expect(await screen.findByText(/The High-Conviction Angle/i)).toBeInTheDocument();
    expect(screen.getByText(/The Direct Systems Architect/i)).toBeInTheDocument();

    const applyButtons = screen.getAllByRole('button', { name: /APPLY TO EDITOR/i });
    fireEvent.click(applyButtons[0]);

    // Should switch to editor tab
    expect(await screen.findByText(/Live Swappability Scorer/i)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(<CoverLetterPolarizerModal job={mockJob} onClose={onClose} />);

    const closeBtn = await screen.findByRole('button', { name: /CLOSE/i });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
