import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MonolithMode from '../MonolithMode';

describe('MonolithMode Component (Dune Minimalist Brutalism)', () => {
  const mockJobs = [
    {
      id: 'job-1',
      title: 'Lead Systems Architect',
      company: 'Spice Industries',
      location: 'Melbourne CBD',
      score: 95,
      date: new Date().toISOString(),
      salary: '$180,000 - $210,000',
      stream: 'Core IT / Cloud Infrastructure',
      description: 'Architecting high-scale distributed sovereign infrastructure.'
    },
    {
      id: 'job-2',
      title: 'Autonomous Robotics Specialist',
      company: 'Guild Tech',
      location: 'Cremorne VIC',
      score: 89,
      date: new Date().toISOString(),
      salary: '$160,000',
      stream: 'Autonomous Systems & Robotics'
    },
    {
      id: 'job-3',
      title: 'Senior Cloud Security Engineer',
      company: 'Arrakis Cyber',
      location: 'Southbank VIC',
      score: 87,
      date: new Date().toISOString(),
      salary: '$150,000',
      stream: 'Cybersecurity'
    }
  ];

  const mockProfile = {
    id: 'user-123',
    name: 'Paul Atreides',
    title: 'Lead Systems Architect',
    industry: 'Technology & IT'
  };

  it('renders with grand monolithic typography and Dune brutalist elements', () => {
    const onSwitchMode = vi.fn();
    const onOpenJobModal = vi.fn();
    const onOpenGenerator = vi.fn();

    render(
      <MonolithMode
        jobs={mockJobs}
        profile={mockProfile}
        applications={[]}
        onSwitchMode={onSwitchMode}
        onOpenJobModal={onOpenJobModal}
        onOpenGenerator={onOpenGenerator}
      />
    );

    // Verify monolithic brand and prime target
    expect(screen.getByText(/THE MONOLITH/i)).toBeInTheDocument();
    expect(screen.getByText(/Spice Industries/i)).toBeInTheDocument();
    expect(screen.getByText(/Lead Systems Architect/i)).toBeInTheDocument();

    // Verify silent telemetry pulse
    expect(screen.getAllByText(/SIGNALS ASSIMILATED/i)[0]).toBeInTheDocument();
  });

  it('allows 1-click execution for the Prime Monolith target', () => {
    const onSwitchMode = vi.fn();
    const onOpenJobModal = vi.fn();
    const onOpenGenerator = vi.fn();

    render(
      <MonolithMode
        jobs={mockJobs}
        profile={mockProfile}
        applications={[]}
        onSwitchMode={onSwitchMode}
        onOpenJobModal={onOpenJobModal}
        onOpenGenerator={onOpenGenerator}
      />
    );

    // Click on primary application generation button
    const prepButton = screen.getByRole('button', { name: /EXECUTE APPLICATION|PREPARE APPLICATION/i });
    expect(prepButton).toBeInTheDocument();
    fireEvent.click(prepButton);

    expect(onOpenGenerator).toHaveBeenCalledWith(expect.objectContaining({
      company: 'Spice Industries'
    }));
  });

  it('triggers mode switching between Monolith, Zen, and Studio', () => {
    const onSwitchMode = vi.fn();
    const onOpenJobModal = vi.fn();
    const onOpenGenerator = vi.fn();

    render(
      <MonolithMode
        jobs={mockJobs}
        profile={mockProfile}
        applications={[]}
        onSwitchMode={onSwitchMode}
        onOpenJobModal={onOpenJobModal}
        onOpenGenerator={onOpenGenerator}
      />
    );

    // Click on Zen mode button
    const zenButton = screen.getByRole('button', { name: /ZEN/i });
    expect(zenButton).toBeInTheDocument();
    fireEvent.click(zenButton);
    expect(onSwitchMode).toHaveBeenCalledWith('zen');

    // Click on Studio mode button
    const studioButton = screen.getByRole('button', { name: /STUDIO/i });
    expect(studioButton).toBeInTheDocument();
    fireEvent.click(studioButton);
    expect(onSwitchMode).toHaveBeenCalledWith('studio');
  });
});
