import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchApplyModal } from '../BatchApplyModal';
import * as generationService from '../../services/generationService';
import * as trackerService from '../../services/trackerService';

vi.mock('../../services/generationService', () => ({
  executeClientSideAutoApply: vi.fn()
}));

vi.mock('../../services/trackerService', () => ({
  syncApplicationsToBackend: vi.fn().mockResolvedValue(true)
}));

vi.mock('../../services/profileService', () => ({
  getActiveProfile: vi.fn().mockReturnValue({
    id: 'test-user',
    name: 'Sam Ludwig',
    email: 'sam@example.com',
    phone: '0400000000',
    location: 'Melbourne, Australia'
  })
}));

describe('BatchApplyModal Component', () => {
  const mockJobs = [
    { id: '1', title: 'Platform Engineer', company: 'CloudNet', score: 95, status: 'Ready to Apply' },
    { id: '2', title: 'DevOps Lead', company: 'FinTech Corp', score: 88, status: 'Ready to Apply' },
    { id: '3', title: 'Already Applied Role', company: 'OldCorp', score: 80, status: 'Applied / Confirmation Received' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('renders unsubmitted jobs and allows preset selection', () => {
    render(
      <BatchApplyModal 
        jobs={mockJobs} 
        isOpen={true} 
        onClose={vi.fn()} 
      />
    );

    expect(screen.getByText(/1-CLICK BATCH APPLICATION DISPATCHER/i)).toBeInTheDocument();
    expect(screen.getByText(/Platform Engineer/i)).toBeInTheDocument();
    expect(screen.getByText(/DevOps Lead/i)).toBeInTheDocument();
    // Already applied role should be filtered out
    expect(screen.queryByText(/Already Applied Role/i)).not.toBeInTheDocument();

    // Clear preset
    const clearBtn = screen.getByRole('button', { name: /CLEAR/i });
    fireEvent.click(clearBtn);
    expect(screen.getByText(/SELECT POSITIONS TO DISPATCH/i)).toBeInTheDocument();

    // Select all preset
    const allBtn = screen.getByRole('button', { name: /ALL/i });
    fireEvent.click(allBtn);
    expect(screen.getByText(/DISPATCH 2 AUTOMATED APPLICATIONS NOW/i)).toBeInTheDocument();
  });

  it('successfully dispatches batch applications and reports completions', async () => {
    const mockOnJobStatusUpdate = vi.fn();
    const mockOnComplete = vi.fn();

    vi.mocked(generationService.executeClientSideAutoApply).mockResolvedValue({
      success: true,
      pipeline_result: {
        dispatch_id: 'DSP-TEST01',
        quality_score: 96,
        resume_text: '# Tailored Resume',
        cover_text: 'Dear Hiring Manager,'
      }
    });

    render(
      <BatchApplyModal 
        jobs={mockJobs} 
        isOpen={true} 
        onClose={vi.fn()} 
        onJobStatusUpdate={mockOnJobStatusUpdate}
        onComplete={mockOnComplete}
      />
    );

    const dispatchBtn = screen.getByText(/DISPATCH 2 AUTOMATED APPLICATIONS NOW/i);
    fireEvent.click(dispatchBtn);

    await waitFor(() => {
      expect(screen.getByText(/BATCH DISPATCH COMPLETED/i)).toBeInTheDocument();
    });

    expect(generationService.executeClientSideAutoApply).toHaveBeenCalledTimes(2);
    expect(mockOnJobStatusUpdate).toHaveBeenCalledTimes(2);
    expect(trackerService.syncApplicationsToBackend).toHaveBeenCalledTimes(1);
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('handles application failure gracefully without breaking the batch', async () => {
    vi.mocked(generationService.executeClientSideAutoApply)
      .mockResolvedValueOnce({
        success: true,
        pipeline_result: { dispatch_id: 'DSP-01', quality_score: 95 }
      })
      .mockResolvedValueOnce({
        success: false,
        error: 'Portal timeout during submission'
      });

    render(
      <BatchApplyModal 
        jobs={mockJobs} 
        isOpen={true} 
        onClose={vi.fn()} 
      />
    );

    const dispatchBtn = screen.getByText(/DISPATCH 2 AUTOMATED APPLICATIONS NOW/i);
    fireEvent.click(dispatchBtn);

    await waitFor(() => {
      expect(screen.getByText(/BATCH DISPATCH COMPLETED/i)).toBeInTheDocument();
      expect(screen.getByText(/Portal timeout during submission/i)).toBeInTheDocument();
    });
  });
});
