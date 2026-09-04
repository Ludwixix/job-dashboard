import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchApplyModal } from '../BatchApplyModal';

describe('BatchApplyModal Component', () => {
  const mockJobs = [
    { id: '1', title: 'Platform Engineer', company: 'CloudNet', score: 95, status: 'Ready to Apply' },
    { id: '2', title: 'DevOps Lead', company: 'FinTech Corp', score: 88, status: 'Ready to Apply' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('renders batch apply jobs checklist and handles missing API key with clear error', async () => {
    render(
      <BatchApplyModal 
        jobs={mockJobs} 
        isOpen={true} 
        onClose={vi.fn()} 
        onComplete={vi.fn()} 
      />
    );

    expect(screen.getByText(/1-CLICK BATCH APPLICATION DISPATCHER/i)).toBeInTheDocument();
    expect(screen.getByText(/Platform Engineer/i)).toBeInTheDocument();
    expect(screen.getByText(/DevOps Lead/i)).toBeInTheDocument();

    // Trigger batch run
    const dispatchButton = screen.getByText(/DISPATCH 2 AUTOMATED APPLICATIONS NOW/i);
    fireEvent.click(dispatchButton);

    // Assert that errors are surfaced explicitly in red
    await waitFor(() => {
      expect(screen.getByText(/BATCH DISPATCH COMPLETED/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Action requires an API key or failed/i).length).toBeGreaterThan(0);
    });
  });
});
