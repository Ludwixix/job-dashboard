import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScreeningSolverModal } from '../ScreeningSolverModal';
import * as screeningService from '../../services/screeningSolverService';

describe('ScreeningSolverModal', () => {
  const mockJob = {
    id: 'test-screening-job-1',
    company: 'Macquarie Group',
    title: 'Lead Site Reliability Engineer',
    description: 'Must have Australian working rights. Do you hold a National Police Check? Kubernetes experience essential.',
  };

  const mockProfile = {
    name: 'Taylor Swift',
    workRights: 'Australian Citizen (Unrestricted Full Working Rights)',
    clearance: 'Baseline / NV1 Eligible',
    yearsOfExperience: 7,
    coreSkills: ['Kubernetes', 'AWS', 'Python'],
    location: 'Melbourne, VIC',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders modal header, company name, and loads screening solutions', async () => {
    render(
      <ScreeningSolverModal
        job={mockJob}
        onClose={vi.fn()}
        userProfile={mockProfile}
      />
    );

    // Initial loading indicator or direct title render
    expect(screen.getByText(/PHASE 23 • SCREENING QUESTIONNAIRE SOLVER/i)).toBeInTheDocument();
    expect(screen.getByText('Macquarie Group')).toBeInTheDocument();

    // Await async report load
    const criterionTitle = await screen.findByText(/Portal Pre-Screening Criteria/i);
    expect(criterionTitle).toBeInTheDocument();
  });

  it('navigates between tabs cleanly', async () => {
    render(
      <ScreeningSolverModal
        job={mockJob}
        onClose={vi.fn()}
        userProfile={mockProfile}
      />
    );

    // Await async initial load
    await screen.findByText(/Portal Pre-Screening Criteria/i);

    // Switch to Custom Question Sandbox tab
    const sandboxTab = screen.getByRole('button', { name: /Custom Question Sandbox/i });
    fireEvent.click(sandboxTab);
    expect(screen.getByText(/Custom Portal Question Resolver/i)).toBeInTheDocument();

    // Switch to Dealbreaker Radar tab
    const radarTab = screen.getByRole('button', { name: /Dealbreaker Radar/i });
    fireEvent.click(radarTab);
    expect(screen.getByText(/Statutory Clearance Verification Map/i)).toBeInTheDocument();

    // Switch to 1-Click Full Arsenal tab
    const arsenalTab = screen.getByRole('button', { name: /1-Click Full Arsenal/i });
    fireEvent.click(arsenalTab);
    expect(screen.getByText(/Consolidated Questionnaire Arsenal/i)).toBeInTheDocument();
  });

  it('solves custom questions in the sandbox', async () => {
    render(
      <ScreeningSolverModal
        job={mockJob}
        onClose={vi.fn()}
        userProfile={mockProfile}
      />
    );

    await screen.findByText(/Portal Pre-Screening Criteria/i);

    // Navigate to Sandbox
    fireEvent.click(screen.getByRole('button', { name: /Custom Question Sandbox/i }));

    const textarea = screen.getByPlaceholderText(/e\.g\. Do you require visa sponsorship/i);
    fireEvent.change(textarea, { target: { value: 'Do you require visa sponsorship?' } });

    const submitBtn = screen.getByRole('button', { name: /Generate Bespoke Solution/i });
    fireEvent.click(submitBtn);

    const result = await screen.findByText(/No \(Australian Citizen with unrestricted full working rights/i);
    expect(result).toBeInTheDocument();
  });

  it('calls onClose when Done or Close button is clicked', async () => {
    const onCloseMock = vi.fn();
    render(
      <ScreeningSolverModal
        job={mockJob}
        onClose={onCloseMock}
        userProfile={mockProfile}
      />
    );

    await screen.findByText(/Portal Pre-Screening Criteria/i);

    const doneBtn = screen.getByRole('button', { name: /^Done$/i });
    fireEvent.click(doneBtn);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});

