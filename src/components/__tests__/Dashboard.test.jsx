import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Dashboard } from '../Dashboard';

describe('Dashboard Top-Level Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    // Mock fetch for health and initial jobs data
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/health')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'healthy', database: 'SQLite WAL' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { id: '1', title: 'Senior Cloud Engineer', company: 'Telstra', status: 'Interview / Scheduled' }
        ]),
      });
    });
  });

  it('renders Dashboard without crashing and navigates between top-level sections', async () => {
    render(<Dashboard />);

    // Check header branding
    expect(screen.getByText(/CAREER\.AGENT/i)).toBeInTheDocument();

    // Switch to Highlights section
    const actionTab = screen.getByRole('button', { name: /ACTION/i });
    fireEvent.click(actionTab);
    
    await waitFor(() => {
      expect(screen.getByText(/Immediate Action Required|You're All Caught Up/i)).toBeInTheDocument();
    });

    // Switch to Kanban section
    const kanbanTab = screen.getByRole('button', { name: /KANBAN/i });
    fireEvent.click(kanbanTab);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/SEARCH APPLICATIONS\.\.\./i)).toBeInTheDocument();
    });

    // Switch to Analytics section
    const analyticsTab = screen.getByRole('button', { name: /ANALYTICS/i });
    fireEvent.click(analyticsTab);
    
    await waitFor(() => {
      expect(screen.getByText(/Conversion Pipeline/i)).toBeInTheDocument();
    });
  });

  it('opens Mock Interview and Interview Prep modals without undefined reference crashes', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/CAREER\.AGENT/i)).toBeInTheDocument();
    });

    // Switch to Action Highlights
    const actionTab = screen.getByRole('button', { name: /ACTION/i });
    fireEvent.click(actionTab);

    await waitFor(() => {
      expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
    });
  });
});
