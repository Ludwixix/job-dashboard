import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FunnelIntelligenceModal from '../FunnelIntelligenceModal';

describe('FunnelIntelligenceModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, analytics: null }),
    });
  });

  const mockJobs = [
    { id: '1', title: 'Senior Cloud Engineer', company: 'Atlassian', status: 'applied', applied_date: '2026-08-15T00:00:00Z' }, // Stalled (>14d)
    { id: '2', title: 'Staff Platform Architect', company: 'Canva', status: 'interviewing', applied_date: '2026-08-10T00:00:00Z', interview_date: '2026-08-20T00:00:00Z' },
    { id: '3', title: 'DevOps Lead', company: 'Macquarie', status: 'offer', applied_date: '2026-08-10T00:00:00Z', interview_date: '2026-08-20T00:00:00Z', offer_date: '2026-09-02T00:00:00Z' },
  ];

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <FunnelIntelligenceModal isOpen={false} onClose={() => {}} jobs={mockJobs} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal header, health score, and default funnel tab', () => {
    render(
      <FunnelIntelligenceModal isOpen={true} onClose={() => {}} jobs={mockJobs} />
    );

    expect(screen.getByText(/Talent Funnel Intelligence/i)).toBeInTheDocument();
    expect(screen.getByText(/Pipeline Radar/i)).toBeInTheDocument();
    expect(screen.getByText(/Pipeline Health Score/i)).toBeInTheDocument();
    expect(screen.getByText(/Stage Progression/i)).toBeInTheDocument();
  });

  it('switches between tabs cleanly', () => {
    render(
      <FunnelIntelligenceModal isOpen={true} onClose={() => {}} jobs={mockJobs} />
    );

    // Switch to Velocity tab
    fireEvent.click(screen.getByRole('tab', { name: /Velocity & Cycle/i }));
    expect(screen.getByText(/Pipeline Velocity & Cycle Times/i)).toBeInTheDocument();

    // Switch to Stalled tab
    fireEvent.click(screen.getByRole('tab', { name: /Stalled Applications/i }));
    expect(screen.getByText(/Stalled Application Radar/i)).toBeInTheDocument();

    // Switch to Benchmarks tab
    fireEvent.click(screen.getByRole('tab', { name: /Sector Benchmarks/i }));
    expect(screen.getByText(/Australian Industry Benchmarks/i)).toBeInTheDocument();
  });

  it('displays stalled application alert and triggers action callbacks', () => {
    const onSelectJob = vi.fn();
    render(
      <FunnelIntelligenceModal
        isOpen={true}
        onClose={() => {}}
        jobs={mockJobs}
        onSelectJob={onSelectJob}
      />
    );

    // Switch to Stalled tab
    fireEvent.click(screen.getByRole('tab', { name: /Stalled Applications/i }));
    expect(screen.getByText(/Senior Cloud Engineer/i)).toBeInTheDocument();
    expect(screen.getByText(/Atlassian/i)).toBeInTheDocument();

    const viewButton = screen.getByRole('button', { name: /View Job/i });
    fireEvent.click(viewButton);
    expect(onSelectJob).toHaveBeenCalled();
  });

  it('closes when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <FunnelIntelligenceModal isOpen={true} onClose={onClose} jobs={mockJobs} />
    );

    const closeBtn = screen.getByRole('button', { name: /close modal/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
