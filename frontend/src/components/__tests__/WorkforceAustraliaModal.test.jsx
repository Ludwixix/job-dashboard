import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WorkforceAustraliaModal from '../WorkforceAustraliaModal';
import * as workforceExporter from '../../utils/workforceEvidenceExporter';

// Mock pdf export
vi.spyOn(workforceExporter, 'downloadWorkforceEvidencePdf').mockImplementation(() => {});

const mockJobs = [
  {
    id: 'job-1',
    title: 'Cloud Systems Administrator',
    company: 'Nexus Health',
    status: 'applied',
    applied_at: new Date().toISOString(),
    source: 'SEEK'
  },
  {
    id: 'job-2',
    title: 'Senior Systems Engineer',
    company: 'Pacific Tech',
    status: 'interviewing',
    applied_at: new Date().toISOString(),
    source: 'LinkedIn'
  }
];

describe('WorkforceAustraliaModal Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <WorkforceAustraliaModal isOpen={false} onClose={vi.fn()} jobs={mockJobs} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders PBAS overview, points summary, and evidence table when open', () => {
    render(
      <WorkforceAustraliaModal isOpen={true} onClose={vi.fn()} jobs={mockJobs} />
    );

    expect(screen.getByText(/Workforce Australia Hub/i)).toBeInTheDocument();
    expect(screen.getByText(/PBAS Points Streamliner/i)).toBeInTheDocument();
    expect(screen.getByText(/25/i)).toBeInTheDocument(); // 5 + 20 points
    expect(screen.getByText(/Nexus Health/i)).toBeInTheDocument();
    expect(screen.getByText(/Pacific Tech/i)).toBeInTheDocument();
  });

  it('allows switching to Fast-Entry Transcriber tab and displays quick-copy cards', () => {
    render(
      <WorkforceAustraliaModal isOpen={true} onClose={vi.fn()} jobs={mockJobs} />
    );

    const queueTab = screen.getByText(/2\. PORTAL FAST-ENTRY/i);
    fireEvent.click(queueTab);

    expect(screen.getByText(/Workforce Australia Fast-Entry Transcriber/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Copy for Portal Form/i }).length).toBe(2);
  });

  it('triggers PDF download when Download PDF Report button is clicked', () => {
    render(
      <WorkforceAustraliaModal isOpen={true} onClose={vi.fn()} jobs={mockJobs} />
    );

    const downloadBtn = screen.getByText(/Download PDF Report/i);
    fireEvent.click(downloadBtn);

    expect(workforceExporter.downloadWorkforceEvidencePdf).toHaveBeenCalled();
  });
});
