import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfileModal } from '../ProfileModal';
import { parseResumeTextClientSide } from '../../services/profileService';

describe('Profile Intelligence & Deduction Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  it('correctly deduces seniority, industry, market salary, and clearance from raw resume text', () => {
    const sampleResume = `
    Alex Mercer
    alex.mercer@cloudcorp.com.au | 0411 222 333 | Sydney NSW 2000 | Australian Citizen | NV1 Clearance
    
    PRINCIPAL CLOUD ARCHITECT & SYSTEMS LEAD
    Over 11 years leading AWS and Azure cloud transformation programs for tier-1 financial institutions.
    
    EXPERIENCE:
    Principal Architect — Macquarie Bank (2019 - Present)
    - Architected Kubernetes microservices on AWS EKS reducing latency by 45%.
    - Managed multi-cloud Terraform pipelines and automated disaster recovery.
    
    SKILLS:
    Azure, AWS, Kubernetes, Docker, Terraform, PowerShell, Python, CI/CD, ITIL, PostgreSQL
    `;

    const parsed = parseResumeTextClientSide(sampleResume);

    expect(parsed.name).toBe('Alex Mercer');
    expect(parsed.email).toBe('alex.mercer@cloudcorp.com.au');
    expect(parsed.phone).toBe('0411 222 333');
    expect(parsed.seniorityLevel).toBe('Principal / Architect');
    expect(parsed.industry).toBe('Technology & IT');
    expect(parsed.clearance).toContain('Baseline / NV1');
    expect(parsed.coreSkills).toContain('AWS');
    expect(parsed.coreSkills).toContain('Terraform');
    expect(parsed.coreSkills).toContain('Kubernetes');
    expect(parsed.targetTitles.length).toBeGreaterThanOrEqual(3);
  });

  it('renders ProfileModal and allows user to paste resume and trigger deduction', async () => {
    render(<ProfileModal isOpen={true} onClose={vi.fn()} onProfileSaved={vi.fn()} />);

    expect(screen.getByText(/Candidate Intelligence Profile/i)).toBeInTheDocument();
    expect(screen.getByText(/AI RESUME INGEST & DEDUCTIONS/i)).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Paste complete resume text here/i);
    fireEvent.change(textarea, {
      target: {
        value: `Jane Doe\njane@healthcare.org.au\n0412 999 888\nMelbourne VIC\nRegistered Nurse with 8 years clinical acute care experience across emergency wards.\nSkills: Acute Care, Emergency Triage, Medication Administration`
      }
    });

    const extractButton = screen.getByRole('button', { name: /EXTRACT, DEDUCE & POPULATE PROFILE/i });
    fireEvent.click(extractButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('jane@healthcare.org.au')).toBeInTheDocument();
    });
  });

  it('allows 1-click loading of industry starter templates', async () => {
    const onProfileSaved = vi.fn();
    render(<ProfileModal isOpen={true} onClose={vi.fn()} onProfileSaved={onProfileSaved} />);

    const nurseButton = screen.getByRole('button', { name: /Healthcare \(Nurse\)/i });
    expect(nurseButton).toBeInTheDocument();

    fireEvent.click(nurseButton);

    expect(onProfileSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Sarah Jenkins',
        industry: 'Healthcare & Medical',
      })
    );
  });
});
