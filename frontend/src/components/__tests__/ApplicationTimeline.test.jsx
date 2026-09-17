import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ApplicationTimeline } from '../ApplicationTimeline';

describe('ApplicationTimeline Component', () => {
  const mockEvents = [
    {
      id: 'evt_1',
      event_type: 'applied',
      timestamp: '2026-09-01T10:00:00Z',
      note: 'Applied through company portal with tailored cover letter.',
    },
    {
      id: 'evt_2',
      event_type: 'interview',
      timestamp: '2026-09-05T14:30:00Z',
      note: 'Technical screen scheduled with hiring engineering manager.',
    },
  ];

  it('renders list of events and labels properly', () => {
    render(<ApplicationTimeline jobId="job-123" events={mockEvents} />);

    expect(screen.getByText(/Audit Trail & Activity Log/i)).toBeInTheDocument();
    expect(screen.getByText(/2 Events/i)).toBeInTheDocument();
    expect(screen.getByText(/Applied through company portal/i)).toBeInTheDocument();
    expect(screen.getByText(/Technical screen scheduled/i)).toBeInTheDocument();
  });

  it('allows logging a new activity note', () => {
    const onAddEvent = vi.fn();
    render(<ApplicationTimeline jobId="job-123" events={mockEvents} onAddEvent={onAddEvent} />);

    const logBtn = screen.getByRole('button', { name: /Log Activity/i });
    fireEvent.click(logBtn);

    const textarea = screen.getByPlaceholderText(/Record recruiter touchpoint/i);
    fireEvent.change(textarea, { target: { value: 'Follow-up email sent to recruiter.' } });

    const saveBtn = screen.getByRole('button', { name: /Save Event/i });
    fireEvent.click(saveBtn);

    expect(onAddEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'note',
        note: 'Follow-up email sent to recruiter.',
      })
    );
    expect(screen.getByText(/Follow-up email sent to recruiter/i)).toBeInTheDocument();
  });

  it('renders default fallback event when event list is empty', () => {
    render(
      <ApplicationTimeline 
        jobId="job-456" 
        application={{ company: 'Canva', status: 'Submitted', applied_at: '2026-09-10T12:00:00Z' }} 
      />
    );
    expect(screen.getByText(/Application tracking initiated for Canva/i)).toBeInTheDocument();
  });

  it('renders Google Calendar and ICS download buttons for interview events', () => {
    render(
      <ApplicationTimeline
        jobId="job-123"
        application={{ company: 'Atlassian', title: 'Senior Engineer' }}
        events={mockEvents}
      />
    );

    const gcalLink = screen.getByRole('link', { name: /Add to Google Calendar/i });
    expect(gcalLink).toBeInTheDocument();
    expect(gcalLink).toHaveAttribute('href', expect.stringContaining('calendar.google.com/calendar/render'));

    const icsBtn = screen.getByRole('button', { name: /Download \.ics/i });
    expect(icsBtn).toBeInTheDocument();
  });
});

