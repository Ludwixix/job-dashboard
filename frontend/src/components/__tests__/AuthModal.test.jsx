import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthModal } from '../AuthModal';

describe('AuthModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders live system health and profile sync status', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          status: 'healthy',
          database: 'SQLite WAL (Pooled)'
        }),
      })
    );

    const mockProfile = { name: 'Sam Ludwig', email: 'sam@example.com' };
    const mockJobs = [{ id: '1' }, { id: '2' }, { id: '3' }];

    render(
      <AuthModal 
        isOpen={true} 
        onClose={vi.fn()} 
        activeProfile={mockProfile} 
        jobs={mockJobs} 
      />
    );

    expect(screen.getByText(/LIVE SYSTEM & PROFILE HEALTH/i)).toBeInTheDocument();
    expect(screen.getByText(/3 Live Positions/i)).toBeInTheDocument();
    expect(screen.getByText('Sam Ludwig')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Healthy/i)).toBeInTheDocument();
    });
  });
});
