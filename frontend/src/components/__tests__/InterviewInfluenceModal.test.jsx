import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InterviewInfluenceModal from '../InterviewInfluenceModal';
import { ToastProvider } from '../ToastContext';
import * as influenceService from '../../services/interviewInfluenceService';

const mockJob = {
  id: 'job-influence-101',
  title: 'Lead Systems Architect',
  company: 'Canva Systems',
  status: 'interviewing',
};

const renderWithToast = (ui) => {
  return render(
    <ToastProvider>
      {ui}
    </ToastProvider>
  );
};

describe('InterviewInfluenceModal Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    renderWithToast(
      <InterviewInfluenceModal isOpen={false} onClose={vi.fn()} job={mockJob} />
    );
    expect(screen.queryByText(/POST-INTERVIEW INFLUENCE & DEBRIEF HUB/i)).not.toBeInTheDocument();
  });

  it('renders modal header, health status, and tactical debrief inputs when open', () => {
    renderWithToast(
      <InterviewInfluenceModal isOpen={true} onClose={vi.fn()} job={mockJob} />
    );

    expect(screen.getByText(/POST-INTERVIEW INFLUENCE & DEBRIEF HUB/i)).toBeInTheDocument();
    expect(screen.getByText(/Canva Systems/i)).toBeInTheDocument();
    expect(screen.getByText(/INFLUENCE POSTURE:/i)).toBeInTheDocument();
    expect(screen.getByText(/1\. TACTICAL DEBRIEF/i)).toBeInTheDocument();
  });

  it('allows switching to Value-Add Follow-up tab and displays surgical objection memo', () => {
    renderWithToast(
      <InterviewInfluenceModal isOpen={true} onClose={vi.fn()} job={mockJob} />
    );

    const memoTab = screen.getByText(/2\. VALUE-ADD FOLLOW-UP/i);
    fireEvent.click(memoTab);

    expect(screen.getByText(/Surgical Objection-Resolution Memo/i)).toBeInTheDocument();
    expect(screen.getByText(/Copy Memo/i)).toBeInTheDocument();
  });

  it('allows switching to Referee Alignment tab and displays briefing pack', () => {
    renderWithToast(
      <InterviewInfluenceModal isOpen={true} onClose={vi.fn()} job={mockJob} />
    );

    const refTab = screen.getByText(/3\. REFEREE ALIGNMENT PACK/i);
    fireEvent.click(refTab);

    expect(screen.getByText(/Executive Referee Alignment Pack/i)).toBeInTheDocument();
    expect(screen.getByText(/Copy Referee Briefing/i)).toBeInTheDocument();
  });

  it('saves debrief and invokes saveInterviewDebrief', async () => {
    const saveSpy = vi.spyOn(influenceService, 'saveInterviewDebrief').mockResolvedValue({ success: true });

    renderWithToast(
      <InterviewInfluenceModal isOpen={true} onClose={vi.fn()} job={mockJob} />
    );

    const saveBtn = screen.getByRole('button', { name: /Save Tactical Debrief/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalled();
    });
  });
});
