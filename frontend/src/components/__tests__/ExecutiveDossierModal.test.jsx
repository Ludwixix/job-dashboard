import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutiveDossierModal } from '../ExecutiveDossierModal';

describe('ExecutiveDossierModal Component', () => {
  const mockJob = {
    id: 'job-atlassian-101',
    title: 'Principal Cloud Platform Architect',
    company: 'Atlassian',
    location: 'Sydney, NSW',
    description: 'Lead multi-cloud AWS and Kubernetes architecture, ASD Essential 8 resilience, and mentor engineering leads.'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with executive header and default Strategic Overview tab', () => {
    render(<ExecutiveDossierModal isOpen={true} onClose={vi.fn()} job={mockJob} />);

    expect(screen.getByText(/EXECUTIVE BRIEFING SUITE/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Atlassian/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Principal Cloud Platform Architect/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Why This Role Was Funded/i)).toBeInTheDocument();
    expect(screen.getByText(/Regulatory & Compliance Frameworks/i)).toBeInTheDocument();
  });

  it('allows switching to Leadership & Stakeholders tab', () => {
    render(<ExecutiveDossierModal isOpen={true} onClose={vi.fn()} job={mockJob} />);

    const tabBtn = screen.getByRole('button', { name: /LEADERSHIP & STAKEHOLDERS/i });
    fireEvent.click(tabBtn);

    expect(screen.getByText(/Target Reporting Hierarchy/i)).toBeInTheDocument();
    expect(screen.getByText(/Key Executive Decision Makers/i)).toBeInTheDocument();
  });

  it('allows switching to First 90 Days Execution Blueprint tab', () => {
    render(<ExecutiveDossierModal isOpen={true} onClose={vi.fn()} job={mockJob} />);

    const tabBtn = screen.getByRole('button', { name: /FIRST 90 DAYS BLUEPRINT/i });
    fireEvent.click(tabBtn);

    expect(screen.getByText(/Days 1–30: Listen, Audit & Align/i)).toBeInTheDocument();
    expect(screen.getByText(/Days 31–60: Optimize & Deliver Quick Wins/i)).toBeInTheDocument();
    expect(screen.getByText(/Days 61–90: Scale, Institutionalize & Measure ROI/i)).toBeInTheDocument();
  });

  it('allows switching to Reverse Questions & Due Diligence tab', () => {
    render(<ExecutiveDossierModal isOpen={true} onClose={vi.fn()} job={mockJob} />);

    const tabBtn = screen.getByRole('button', { name: /REVERSE QUESTIONS & DILIGENCE/i });
    fireEvent.click(tabBtn);

    expect(screen.getByText(/High-Stakes C-Suite Reverse Questions/i)).toBeInTheDocument();
    expect(screen.getByText(/Due Diligence & Risk Signals/i)).toBeInTheDocument();
  });

  it('provides copy markdown briefing action', () => {
    // Mock navigator.clipboard
    const writeTextMock = vi.fn().mockResolvedValue();
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    render(<ExecutiveDossierModal isOpen={true} onClose={vi.fn()} job={mockJob} />);

    const copyBtn = screen.getByRole('button', { name: /COPY BRIEFING/i });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalled();
  });
});
