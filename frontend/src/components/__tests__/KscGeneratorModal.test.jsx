import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KscGeneratorModal } from '../KscGeneratorModal';
import * as kscService from '../../services/kscService';

describe('KscGeneratorModal', () => {
  const mockJob = {
    id: 'ksc_job_1',
    title: 'Senior Policy Advisor',
    company: 'Department of Transport and Planning',
    description: 'Key Selection Criteria:\n1. Demonstrated experience in strategic transport policy development.\n2. Proven capability in stakeholder consultation and ministerial correspondence.',
  };

  const mockProfile = {
    name: 'Sam Ludwig',
    experience: [{ company: 'Victorian Public Service', title: 'Senior Policy Analyst' }],
    skills: ['Policy Development', 'Stakeholder Engagement', 'Ministerial Briefings'],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders modal header, role title, and loads criteria solutions', async () => {
    render(
      <KscGeneratorModal
        job={mockJob}
        userProfile={mockProfile}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Key Selection Criteria (KSC) Generator')).toBeInTheDocument();
    expect(screen.getByText('Department of Transport and Planning')).toBeInTheDocument();
    expect(screen.getByText('Sam Ludwig')).toBeInTheDocument();

    expect(await screen.findByText(/Merit-Based Public Sector Assessment Alignment/i)).toBeInTheDocument();
  });

  it('navigates cleanly between tabs', async () => {
    render(
      <KscGeneratorModal
        job={mockJob}
        userProfile={mockProfile}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText(/Merit-Based Public Sector Assessment Alignment/i)).toBeInTheDocument();

    // Tab: Sandbox
    fireEvent.click(screen.getByRole('button', { name: /CUSTOM CRITERIA SANDBOX/i }));
    expect(screen.getByText(/Custom Position Description Criteria Solver/i)).toBeInTheDocument();

    // Tab: Capability Matrix
    fireEvent.click(screen.getByRole('button', { name: /CAPABILITY MATRIX/i }));
    expect(screen.getByText(/APS & VPS Capability Framework Taxonomy/i)).toBeInTheDocument();

    // Tab: Master Document
    fireEvent.click(screen.getByRole('button', { name: /MASTER DOCUMENT & EXPORT/i }));
    expect(screen.getByText(/COMPLETE COMPILED KSC DOCUMENT/i)).toBeInTheDocument();
  });

  it('generates custom criteria in the sandbox', async () => {
    render(
      <KscGeneratorModal
        job={mockJob}
        userProfile={mockProfile}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText(/Merit-Based Public Sector Assessment Alignment/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /CUSTOM CRITERIA SANDBOX/i }));
    
    const textarea = screen.getByPlaceholderText(/Demonstrated experience in leading high-profile capital projects/i);
    fireEvent.change(textarea, {
      target: { value: 'Demonstrated experience in modern cyber security incident response.' },
    });

    const submitBtn = screen.getByRole('button', { name: /GENERATE TAILORED KSC RESPONSES/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Demonstrated experience in modern cyber security incident response/i)).toBeInTheDocument();
    });
  });

  it('calls onClose when Done or Close button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <KscGeneratorModal
        job={mockJob}
        userProfile={mockProfile}
        onClose={onClose}
      />
    );

    const closeBtn = screen.getByLabelText('Close modal');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();

    const doneBtn = screen.getByRole('button', { name: /DONE/i });
    fireEvent.click(doneBtn);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
