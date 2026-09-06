import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CareerMatrixModal from '../CareerMatrixModal';

describe('CareerMatrixModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, roadmap: null }),
    });
  });

  const mockProfile = {
    name: 'Sam Ludwig',
    title: 'Senior Systems Engineer',
    industry: 'technology',
    coreSkills: ['Linux', 'Kubernetes', 'Terraform', 'Python'],
    yearsOfExperience: 6,
  };

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <CareerMatrixModal isOpen={false} onClose={() => {}} profile={mockProfile} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders header, salary projection card, and default roadmap tab', () => {
    render(
      <CareerMatrixModal isOpen={true} onClose={() => {}} profile={mockProfile} />
    );

    expect(screen.getByText(/Career Vector Matrix/i)).toBeInTheDocument();
    expect(screen.getByText(/Trajectory Studio/i)).toBeInTheDocument();
    expect(screen.getByText(/Projected Salary Lift/i)).toBeInTheDocument();
    expect(screen.getByText(/Next Seniority Target/i)).toBeInTheDocument();
  });

  it('switches tabs cleanly to skills deltas, 12m milestones, and salary pivots', () => {
    render(
      <CareerMatrixModal isOpen={true} onClose={() => {}} profile={mockProfile} />
    );

    // Switch to Skills Delta
    fireEvent.click(screen.getByRole('tab', { name: /Skills Delta & Certs/i }));
    expect(screen.getByText(/Critical Capability Gaps/i)).toBeInTheDocument();
    expect(screen.getByText(/Recommended Australian Certifications/i)).toBeInTheDocument();

    // Switch to 12M Blueprint
    fireEvent.click(screen.getByRole('tab', { name: /12-Month Blueprint/i }));
    expect(screen.getByText(/Months 1–3 \(Q1\)/i)).toBeInTheDocument();

    // Switch to Salary & Pivots
    fireEvent.click(screen.getByRole('tab', { name: /Salary & Pivots/i }));
    expect(screen.getByText(/High-Overlap Career Pivots/i)).toBeInTheDocument();
  });

  it('closes when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <CareerMatrixModal isOpen={true} onClose={onClose} profile={mockProfile} />
    );

    const closeBtn = screen.getByRole('button', { name: /close modal/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
