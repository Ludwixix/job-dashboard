import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JobSeeker } from '../JobSeeker';

// Mock child modals and non-critical sub-components
vi.mock('../AutoApplyModal', () => ({ AutoApplyModal: () => <div data-testid="auto-apply-modal" /> }));
vi.mock('../PsychologyDecoderModal', () => ({ PsychologyDecoderModal: () => <div data-testid="psychology-modal" /> }));
vi.mock('../GeneratorModal', () => ({ GeneratorModal: () => <div data-testid="generator-modal" /> }));
vi.mock('../TopMatchesSidebar', () => ({ TopMatchesSidebar: () => <div data-testid="top-matches-sidebar" /> }));

describe('JobSeeker Default Role Targeting', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const mockJobs = [
    {
      id: 'job_it_1',
      title: 'Senior Cloud Systems Engineer',
      company: 'Tech Corp',
      location: 'Sydney NSW',
      date: '2026-09-05',
      salary: '$140,000 - $160,000',
      description: 'AWS Azure Infrastructure',
      isComplete: true,
      score: 90,
      portalLink: 'https://example.com/jobs/cloud-engineer'
    },
    {
      id: 'job_nurse_2',
      title: 'Registered Nurse - Acute Care',
      company: 'Health Care Inc',
      location: 'Sydney NSW',
      date: '2026-09-05',
      salary: '$95,000',
      description: 'Clinical nursing care in hospital',
      isComplete: true,
      score: 60
    },
    {
      id: 'job_accountant_3',
      title: 'Corporate Tax Accountant CPA',
      company: 'Finance Ltd',
      location: 'Sydney NSW',
      date: '2026-09-05',
      salary: '$110,000',
      description: 'Tax and financial reporting',
      isComplete: true,
      score: 55
    }
  ];

  const itProfile = {
    id: 'prof_it_alex',
    name: 'Alex IT',
    industry: 'Technology & IT',
    targetTitles: ['Cloud Engineer', 'Systems Engineer'],
    coreSkills: ['AWS', 'Azure', 'Linux']
  };

  it('defaults to showing ONLY profile targeted jobs instead of dumping all jobs', () => {
    render(
      <JobSeeker
        jobs={mockJobs}
        onUpdateJob={vi.fn()}
        onGenerateDocs={vi.fn()}
        currentProfile={itProfile}
      />
    );

    // IT Cloud Job should be visible
    expect(screen.getByText('Senior Cloud Systems Engineer')).toBeDefined();

    // Nurse and Accountant jobs should NOT be visible by default
    expect(screen.queryByText('Registered Nurse - Acute Care')).toBeNull();
    expect(screen.queryByText('Corporate Tax Accountant CPA')).toBeNull();
  });

  it('shows all jobs when SHOW ALL is clicked', () => {
    render(
      <JobSeeker
        jobs={mockJobs}
        onUpdateJob={vi.fn()}
        onGenerateDocs={vi.fn()}
        currentProfile={itProfile}
      />
    );

    // Find and click SHOW ALL button
    const showAllBtn = screen.getByRole('button', { name: /SHOW ALL/i });
    fireEvent.click(showAllBtn);

    // Now all jobs should be visible
    expect(screen.getByText('Senior Cloud Systems Engineer')).toBeDefined();
    expect(screen.getByText('Registered Nurse - Acute Care')).toBeDefined();
    expect(screen.getByText('Corporate Tax Accountant CPA')).toBeDefined();
  });

  it('renders streamlined action ribbon and toggles kebab dropdown menu for auxiliary actions', () => {
    render(
      <JobSeeker
        jobs={mockJobs}
        onUpdateJob={vi.fn()}
        onGenerateDocs={vi.fn()}
        currentProfile={itProfile}
      />
    );

    // Primary action ribbon buttons exist
    expect(screen.getByText('PREP DOCS')).toBeDefined();
    expect(screen.getByText('DETAILS')).toBeDefined();

    // Kebab trigger button exists
    const kebabBtn = screen.getByTitle('More Actions');
    expect(kebabBtn).toBeDefined();

    // Popover options should not be visible initially
    expect(screen.queryByText('Launch Auto-Apply')).toBeNull();
    expect(screen.queryByText('More Like This')).toBeNull();

    // Click kebab button to open popover
    fireEvent.click(kebabBtn);

    // Now auxiliary actions in the popover are revealed
    expect(screen.getByText('Launch Auto-Apply')).toBeDefined();
    expect(screen.getByText('More Like This')).toBeDefined();
    expect(screen.getByText('Less Like This')).toBeDefined();
    expect(screen.getByText('Open Original Listing')).toBeDefined();

    // Clicking anywhere outside closes the popover
    fireEvent.click(document.body);
    expect(screen.queryByText('Launch Auto-Apply')).toBeNull();
  });
});

