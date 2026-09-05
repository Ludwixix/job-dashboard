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

  it('renders Monolith mode by default and allows switching to Studio', async () => {
    render(<Dashboard />);

    // Check Monolith mode branding
    await waitFor(() => {
      expect(screen.getByText(/THE MONOLITH/i)).toBeInTheDocument();
    });

    // Switch to Studio mode
    const studioBtn = screen.getByRole('button', { name: /STUDIO/i });
    fireEvent.click(studioBtn);

    await waitFor(() => {
      expect(screen.getByText(/CAREER\.AGENT/i)).toBeInTheDocument();
    });
  });

  it('navigates sections in Studio mode and handles modal triggers cleanly', async () => {
    window.localStorage.setItem('job_dashboard_view_mode', 'studio');
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/CAREER\.AGENT/i)).toBeInTheDocument();
    });

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

  it('renders Monolith mode when configured and allows switching to Studio', async () => {
    window.localStorage.setItem('job_dashboard_view_mode', 'monolith');
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/THE MONOLITH/i)).toBeInTheDocument();
    });

    // Switch to Studio
    const studioBtn = screen.getByRole('button', { name: /STUDIO/i });
    fireEvent.click(studioBtn);

    await waitFor(() => {
      expect(screen.getByText(/CAREER\.AGENT/i)).toBeInTheDocument();
    });
  });
});
