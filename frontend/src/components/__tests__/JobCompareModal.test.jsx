import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { JobCompareModal } from '../JobCompareModal';

describe('JobCompareModal', () => {
  const mockJobs = [
    {
      id: 'job_1',
      title: 'Cloud Architect',
      company: 'Datacom',
      location: 'Melbourne, VIC',
      score: 95,
      audit: {
        matched_terms: ['Azure', 'Terraform'],
        missing_skills: ['AWS'],
      },
      tags: ['Azure', 'Terraform'],
    },
    {
      id: 'job_2',
      title: 'Infrastructure Engineer',
      company: 'Canva',
      location: 'Remote',
      score: 91,
      audit: {
        matched_terms: ['Kubernetes', 'Docker'],
        missing_skills: ['Python'],
      },
      tags: ['Kubernetes', 'Docker'],
    },
  ];

  it('renders comparative opportunity matrix with both job details', () => {
    render(<JobCompareModal jobs={mockJobs} onClose={vi.fn()} onSelectForApply={vi.fn()} />);

    expect(screen.getByText('Comparative Opportunity Matrix')).toBeInTheDocument();
    expect(screen.getByText('Cloud Architect')).toBeInTheDocument();
    expect(screen.getByText('Infrastructure Engineer')).toBeInTheDocument();
    expect(screen.getByText('Datacom')).toBeInTheDocument();
    expect(screen.getByText('Canva')).toBeInTheDocument();
    expect(screen.getByText('95% Match')).toBeInTheDocument();
    expect(screen.getByText('91% Match')).toBeInTheDocument();
  });

  it('handles job selection for application', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<JobCompareModal jobs={mockJobs} onClose={onClose} onSelectForApply={onSelect} />);

    const selectButtons = screen.getAllByRole('button', { name: /Select for Application/i });
    expect(selectButtons.length).toBe(2);
    fireEvent.click(selectButtons[0]);

    expect(onSelect).toHaveBeenCalledWith(mockJobs[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
