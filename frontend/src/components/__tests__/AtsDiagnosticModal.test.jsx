import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AtsDiagnosticModal } from '../AtsDiagnosticModal';
import * as atsService from '../../services/atsDiagnosticService';

const MOCK_JOB = {
  id: 'job-123',
  title: 'Senior DevOps Specialist',
  company: 'Atlassian',
  location: 'Sydney NSW',
};

const MOCK_PROFILE = {
  fullName: 'Jane Doe',
  email: 'jane@example.com',
  phone: '0400 123 456',
  summary: 'Senior Cloud Engineer with AWS experience and 99.9% uptime.',
  coreSkills: ['AWS', 'Docker', 'Kubernetes'],
};

const MOCK_REPORT = {
  ats_score: 88,
  ats_compliance: {
    overall_score: 90,
    detected_sections: { summary: true, work_experience: true, skills: true, education: true, referees: true },
    taxonomy_warnings: [],
    workday: { status: 'passed', details: 'Rigid 4-schema validation passed.' },
    greenhouse: { status: 'passed', details: 'Structured skills mapping verified.' },
    taleo: { status: 'passed', details: 'Linear single-column format confirmed.' },
    jobadder: { status: 'passed', details: 'Australian CRM contact mapping confirmed.' },
  },
  star_density: {
    total_bullets: 5,
    quantified_bullets: 4,
    density_percentage: 80,
    fluff_count: 0,
    fluff_phrases: [],
    bullets: [
      { text: 'Architected cloud landing zone reducing latency by 38%', quantified: true, has_weak_opener: false },
      { text: 'Helped with tickets', quantified: false, has_weak_opener: true },
    ],
  },
  regional_au: {
    compliant: true,
    has_referees: true,
    demographic_risks: [],
  },
  topological_flattening: {
    candidate_name: 'Jane Doe',
    contact_info: { email: 'jane@example.com', phone: '0400 123 456' },
    raw_text_stream: 'Jane Doe\nSenior Cloud Engineer with AWS experience and 99.9% uptime.',
  },
  actionable_recommendations: ['Maintain current high-density achievement anchors.'],
  target_job: { title: 'Senior DevOps Specialist', company: 'Atlassian' },
};

describe('AtsDiagnosticModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(atsService, 'fetchAtsDiagnosticReport').mockResolvedValue(MOCK_REPORT);
  });

  it('renders correctly when open with initial compatibility tab', async () => {
    render(
      <AtsDiagnosticModal
        isOpen={true}
        onClose={vi.fn()}
        job={MOCK_JOB}
        profile={MOCK_PROFILE}
      />
    );

    expect(screen.getByText(/ATS SENTINEL/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Atlassian/i)).toBeInTheDocument();
      expect(screen.getByText(/Workday/i)).toBeInTheDocument();
      expect(screen.getByText(/Greenhouse/i)).toBeInTheDocument();
    });
  });

  it('allows switching between tabs cleanly', async () => {
    render(
      <AtsDiagnosticModal
        isOpen={true}
        onClose={vi.fn()}
        job={MOCK_JOB}
        profile={MOCK_PROFILE}
      />
    );

    await waitFor(() => expect(screen.getByText(/Workday/i)).toBeInTheDocument());

    // Switch to Topological Flattening tab
    const flatteningTab = screen.getByRole('button', { name: /Topological Flattening/i });
    fireEvent.click(flatteningTab);
    expect(screen.getByText(/What the ATS Recruiter Database Sees/i)).toBeInTheDocument();

    // Switch to STAR Metric tab
    const starTab = screen.getByRole('button', { name: /STAR Density & Fluff/i });
    fireEvent.click(starTab);
    expect(screen.getByText(/STAR Metric Density/i)).toBeInTheDocument();

    // Switch to Regional AU tab
    const auTab = screen.getByRole('button', { name: /AU Regional Standards/i });
    fireEvent.click(auTab);
    expect(screen.getByText(/Australian Fair Work Standards/i)).toBeInTheDocument();
  });

  it('triggers onClose callback when close button is clicked', async () => {
    const handleClose = vi.fn();
    render(
      <AtsDiagnosticModal
        isOpen={true}
        onClose={handleClose}
        job={MOCK_JOB}
        profile={MOCK_PROFILE}
      />
    );

    const closeBtn = screen.getByLabelText(/Close ATS Diagnostic/i);
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});
