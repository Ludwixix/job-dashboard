import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SeekPassModal } from '../SeekPassModal';

describe('SeekPassModal', () => {
  const mockJob = {
    id: 'seek_job_01',
    title: 'Senior Systems Administrator',
    company: 'KBR',
    description: 'Must be an Australian Citizen. NV1 Security Clearance required. National Police Check mandatory.',
  };

  const mockProfile = {
    name: 'Sam Ludwig',
    work_rights: 'Australian Citizen',
    clearances: ['Baseline Security Clearance'],
    credentials: ['National Police Certificate (2025)'],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders modal header, title, company, and loads credential audit', async () => {
    render(
      <SeekPassModal
        job={mockJob}
        userProfile={mockProfile}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/SEEK Pass & Verified Credentials Pre-Qualification/i)).toBeInTheDocument();
    expect(screen.getByText(/KBR/i)).toBeInTheDocument();

    expect(await screen.findByText(/Diagnostic Assessment/i)).toBeInTheDocument();
    expect(screen.getByText(/Australian Work Rights & Citizenship/i)).toBeInTheDocument();
  });

  it('navigates cleanly between tabs', async () => {
    render(
      <SeekPassModal
        job={mockJob}
        userProfile={mockProfile}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText(/Diagnostic Assessment/i)).toBeInTheDocument();

    // Tab 2: Action Plan
    fireEvent.click(screen.getByRole('button', { name: /Verification Action Plan/i }));
    expect(screen.getByText(/Step-by-step pre-qualification checklist/i)).toBeInTheDocument();

    // Tab 3: SEEK Pass Responses
    fireEvent.click(screen.getByRole('button', { name: /SEEK Pass Responses/i }));
    expect(screen.getByText(/Pre-formulated, legally compliant responses/i)).toBeInTheDocument();

    // Tab 4: Master Dossier
    fireEvent.click(screen.getByRole('button', { name: /Master Dossier & Export/i }));
    expect(screen.getByText(/Compliance & Readiness Dossier/i)).toBeInTheDocument();
  });

  it('copies response to clipboard on copy click', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue();
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextSpy,
      },
    });

    render(
      <SeekPassModal
        job={mockJob}
        userProfile={mockProfile}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /SEEK Pass Responses/i }));
    const copyBtns = screen.getAllByRole('button', { name: /Copy Answer/i });
    expect(copyBtns.length).toBeGreaterThan(0);

    fireEvent.click(copyBtns[0]);
    expect(writeTextSpy).toHaveBeenCalled();
  });

  it('calls onClose when close button, done button, or escape is pressed', async () => {
    const handleClose = vi.fn();
    render(
      <SeekPassModal
        job={mockJob}
        userProfile={mockProfile}
        onClose={handleClose}
      />
    );

    // Click close icon button
    fireEvent.click(screen.getByLabelText('Close modal'));
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(2);

    // Click Done button
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(handleClose).toHaveBeenCalledTimes(3);
  });
});

