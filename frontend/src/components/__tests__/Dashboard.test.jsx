import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Dashboard } from '../Dashboard';

// Mock Web Audio and Canvas
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    clearRect: vi.fn()
  });
});

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

  it('renders single unified dashboard by default with integrated Prime Target & Telemetry', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/CAREER\.AGENT/i)).toBeInTheDocument();
    });

    // Integrated Prime Target & Autopilot Telemetry is present
    expect(screen.getByText(/PRIME TARGET & AUTOPILOT TELEMETRY/i)).toBeInTheDocument();
  });

  it('switches into Cyberpunk Ambient mode when AMBIENT FLOW button is clicked and returns to dashboard', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/CAREER\.AGENT/i)).toBeInTheDocument();
    });

    // Click Ambient Flow button
    const ambientBtn = screen.getByRole('button', { name: /AMBIENT FLOW/i });
    fireEvent.click(ambientBtn);

    // Verify Cyberpunk Ambient Mode is active
    await waitFor(() => {
      expect(screen.getByText(/CYBERPUNK AMBIENT \/\/ REALTIME FLOWS/i)).toBeInTheDocument();
    });

    // Return to main dashboard
    const returnBtn = screen.getByTitle(/Return to Main Dashboard/i);
    fireEvent.click(returnBtn);

    await waitFor(() => {
      expect(screen.getByText(/CAREER\.AGENT/i)).toBeInTheDocument();
    });
  });

  it('navigates sections in Dashboard mode and handles modal triggers cleanly', async () => {
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
});
