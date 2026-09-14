import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InterviewCheatSheetModal from '../InterviewCheatSheetModal';
import { ToastProvider } from '../ToastContext';
import * as cheatSheetService from '../../services/interviewCheatSheetService';

const mockJob = {
  id: 'job-kbr-101',
  title: 'SharePoint and Automation Analyst',
  company: 'KBR',
  status: 'interviewing',
  meetingUrl: 'https://teams.microsoft.com/meet/123456789',
  meetingId: '269 079 741 559 951',
  passcode: 'ZB69tr3u',
  scheduledTime: '7:30am',
  interviewers: [
    { name: 'Mace Tennison', role: 'Team Lead' },
    { name: 'Lisle Weber', role: 'Apps Manager' },
  ],
};

const renderWithToast = (ui) => {
  return render(
    <ToastProvider>
      {ui}
    </ToastProvider>
  );
};

describe('InterviewCheatSheetModal Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    renderWithToast(
      <InterviewCheatSheetModal isOpen={false} onClose={vi.fn()} job={mockJob} />
    );
    expect(screen.queryByText(/Interview Master Command Center/i)).not.toBeInTheDocument();
  });

  it('renders modal header, company, and preview iframe when open', () => {
    renderWithToast(
      <InterviewCheatSheetModal isOpen={true} onClose={vi.fn()} job={mockJob} />
    );

    expect(screen.getByText(/Interview Master Command Center/i)).toBeInTheDocument();
    expect(screen.getByText(/KBR/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Interview Master Command Center Live Preview/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Launch Fullscreen Cockpit/i })).toBeInTheDocument();
  });

  it('allows switching to Meeting & Panel Details tab to edit parameters', () => {
    renderWithToast(
      <InterviewCheatSheetModal isOpen={true} onClose={vi.fn()} job={mockJob} />
    );

    const tuneTabBtn = screen.getByRole('button', { name: /Meeting & Panel Details/i });
    fireEvent.click(tuneTabBtn);

    expect(screen.getByLabelText(/Video Call \/ Meeting URL/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://teams.microsoft.com/meet/123456789')).toBeInTheDocument();
    expect(screen.getByDisplayValue('269 079 741 559 951')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ZB69tr3u')).toBeInTheDocument();
  });

  it('calls openCheatSheetInNewTab when Launch Fullscreen Cockpit is clicked', () => {
    const launchSpy = vi.spyOn(cheatSheetService, 'openCheatSheetInNewTab').mockImplementation(() => {});

    renderWithToast(
      <InterviewCheatSheetModal isOpen={true} onClose={vi.fn()} job={mockJob} />
    );

    const launchBtn = screen.getByRole('button', { name: /Launch Fullscreen Cockpit/i });
    fireEvent.click(launchBtn);

    expect(launchSpy).toHaveBeenCalled();
  });

  it('calls downloadCheatSheetHtml when Download HTML is clicked', () => {
    const downloadSpy = vi.spyOn(cheatSheetService, 'downloadCheatSheetHtml').mockImplementation(() => {});

    renderWithToast(
      <InterviewCheatSheetModal isOpen={true} onClose={vi.fn()} job={mockJob} />
    );

    const downloadBtn = screen.getByRole('button', { name: /Download HTML/i });
    fireEvent.click(downloadBtn);

    expect(downloadSpy).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', () => {
    const onCloseMock = vi.fn();

    renderWithToast(
      <InterviewCheatSheetModal isOpen={true} onClose={onCloseMock} job={mockJob} />
    );

    const closeBtn = screen.getByLabelText(/Close modal/i);
    fireEvent.click(closeBtn);

    expect(onCloseMock).toHaveBeenCalled();
  });
});
