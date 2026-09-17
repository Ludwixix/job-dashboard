import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ScoringTunerModal from '../ScoringTunerModal';

describe('ScoringTunerModal Component', () => {
  const mockJobs = [
    {
      id: 'job-1',
      title: 'Principal Systems Architect',
      company: 'Canva',
      score: 92,
      score_breakdown: {
        semantic_density: 95,
        title_alignment: 90,
        recency: 70,
        star_impact: 85,
        clearances: 100
      }
    },
    {
      id: 'job-2',
      title: 'Senior Infrastructure Lead',
      company: 'Atlassian',
      score: 86,
      score_breakdown: {
        semantic_density: 70,
        title_alignment: 80,
        recency: 100,
        star_impact: 95,
        clearances: 80
      }
    }
  ];

  it('renders scoring tuner modal with dimension sliders', () => {
    render(<ScoringTunerModal isOpen={true} onClose={vi.fn()} jobs={mockJobs} onApply={vi.fn()} />);

    expect(screen.getByText(/Interactive Scoring Matrix Tuner/i)).toBeInTheDocument();
    expect(screen.getByText(/Semantic Vector Density/i)).toBeInTheDocument();
    expect(screen.getByText(/Role Title Alignment/i)).toBeInTheDocument();
    expect(screen.getByText(/Recency Decay/i)).toBeInTheDocument();
    expect(screen.getByText(/STAR Impact Outcomes/i)).toBeInTheDocument();
    expect(screen.getByText(/Clearances & Work Rights/i)).toBeInTheDocument();
  });

  it('allows resetting to default weights', () => {
    render(<ScoringTunerModal isOpen={true} onClose={vi.fn()} jobs={mockJobs} onApply={vi.fn()} />);

    const resetBtn = screen.getByRole('button', { name: /Reset to Defaults/i });
    expect(resetBtn).toBeInTheDocument();
    fireEvent.click(resetBtn);
  });

  it('calls onApply with re-scored jobs when apply button is clicked', () => {
    const onApply = vi.fn();
    render(<ScoringTunerModal isOpen={true} onClose={vi.fn()} jobs={mockJobs} onApply={onApply} />);

    const applyBtn = screen.getByRole('button', { name: /Apply Custom Matrix/i });
    fireEvent.click(applyBtn);

    expect(onApply).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        semantic_density: expect.any(Number)
      })
    );
  });
});
