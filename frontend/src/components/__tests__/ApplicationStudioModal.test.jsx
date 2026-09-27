import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApplicationStudioModal } from '../ApplicationStudioModal';
import * as careerCockpitService from '../../services/careerCockpitService';

describe('ApplicationStudioModal', () => {
  const mockJob = {
    id: 'test_job_101',
    title: 'Senior Infrastructure & M365 Specialist',
    company: 'Enterprise Melbourne',
    location: 'Melbourne, VIC'
  };

  const mockPackage = {
    success: true,
    job_id: 'test_job_101',
    job_title: 'Senior Infrastructure & M365 Specialist',
    company: 'Enterprise Melbourne',
    justification_score: 95,
    proof_points: [
      'Matches 660,000+ user M365 enterprise administration at Dept of Education VIC',
      'Matches 100+ clinical endpoint Windows 11 Autopilot migration at St John of God Health Care'
    ],
    ksc: {
      criteria_responses: [
        {
          criterion: 'Demonstrated experience managing high-scale enterprise M365 platforms',
          star_narrative: {
            situation: 'At Department of Education VIC managing 660,000+ active users...',
            task: 'Remediate multi-tenant MFA gaps and maintain 99.9% uptime...',
            action: 'Engineered automated PowerShell audit runbooks across 1,000+ school sites...',
            result: 'Achieved 100% compliance with zero downtime and resolved 150+ Tier-3 escalations.'
          }
        }
      ]
    },
    cover_letter: {
      variant: 'The Direct Systems Architect',
      content: 'Dear Hiring Team,\n\nHaving engineered infrastructure for 660,000+ users across Victoria...'
    },
    ats_resume: {
      match_score: 94,
      matched_keywords: ['M365', 'PowerShell', 'Intune', 'Entra ID'],
      missing_keywords: [],
      tailored_summary: 'Senior Infrastructure & M365 Engineer with 10 years of verified enterprise experience...'
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(careerCockpitService, 'generateApplicationStudioPackage').mockResolvedValue(mockPackage);
  });

  it('renders loading state then displays STAR KSC responses and proof points', async () => {
    const handleClose = vi.fn();
    render(<ApplicationStudioModal job={mockJob} onClose={handleClose} />);

    await waitFor(() => {
      expect(screen.getByText('95% Justification Fit')).toBeInTheDocument();
    });

    expect(screen.getByText('Senior Infrastructure & M365 Specialist')).toBeInTheDocument();
    expect(screen.getByText(/Matches 660,000\+ user M365 enterprise administration/i)).toBeInTheDocument();
    expect(screen.getByText(/Demonstrated experience managing high-scale enterprise M365 platforms/i)).toBeInTheDocument();
    expect(screen.getByText(/At Department of Education VIC/i)).toBeInTheDocument();
  });

  it('switches tabs to Executive Cover Letter and ATS Resume', async () => {
    const handleClose = vi.fn();
    render(<ApplicationStudioModal job={mockJob} onClose={handleClose} />);

    await waitFor(() => {
      expect(screen.getByText('95% Justification Fit')).toBeInTheDocument();
    });

    // Switch to Cover Letter tab
    const coverLetterTab = screen.getByText('Executive Cover Letter');
    fireEvent.click(coverLetterTab);

    expect(screen.getByText(/Having engineered infrastructure for 660,000\+ users/i)).toBeInTheDocument();

    // Switch to ATS Resume tab
    const atsResumeTab = screen.getByText('ATS Resume Diagnostic');
    fireEvent.click(atsResumeTab);

    expect(screen.getByText('ATS Compatibility Score:')).toBeInTheDocument();
    expect(screen.getByText('✓ M365')).toBeInTheDocument();
  });
});
