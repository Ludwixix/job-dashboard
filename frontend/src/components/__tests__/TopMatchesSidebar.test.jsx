import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TopMatchesSidebar } from '../TopMatchesSidebar';

describe('TopMatchesSidebar Component', () => {
  const mockJobs = [
    {
      id: 'job-1',
      title: 'Senior Systems Administrator',
      company: 'Enterprise Corp',
      location: 'Melbourne CBD',
      score: 92,
      date: new Date().toISOString(),
      salary: '$130,000',
      stream: 'Core IT'
    },
    {
      id: 'job-2',
      title: 'Autonomous Drone Flight Systems Engineer',
      company: 'AeroRobotics Labs',
      location: 'Cremorne VIC',
      score: 84,
      date: new Date().toISOString(),
      salary: '$165,000',
      stream: 'Autonomous Systems & Robotics',
      description: 'Building next-gen autonomous aerial robotics and computer vision systems.'
    },
    {
      id: 'job-3',
      title: 'Quantum Algorithm Researcher',
      company: 'Quantum Frontier Labs',
      location: 'Melbourne VIC',
      score: 79,
      date: new Date().toISOString(),
      salary: '$150,000',
      stream: 'DeepTech / Quantum',
      description: 'Developing error mitigation algorithms on superconducting qubit hardware.'
    },
    {
      id: 'job-4',
      title: 'Balaclava Help Desk Technician',
      company: 'Local IT Support',
      location: 'Balaclava VIC 3183',
      score: 88,
      date: new Date().toISOString(),
      salary: '$85,000',
      stream: 'Core IT'
    }
  ];

  it('renders without crashing and displays the Points of Interest HUD', () => {
    const onSelectJob = vi.fn();
    const onOpenGenerator = vi.fn();

    render(
      <TopMatchesSidebar 
        jobs={mockJobs}
        onSelectJob={onSelectJob}
        onOpenGenerator={onOpenGenerator}
      />
    );

    expect(screen.getByText(/LIVE POINTS OF INTEREST/i)).toBeInTheDocument();
    expect(screen.getByText(/TOP 10 BEST MATCHES/i)).toBeInTheDocument();
  });

  it('identifies cool and unusual tech roles for The Wild Card and allows re-rolling', () => {
    const onSelectJob = vi.fn();
    const onOpenGenerator = vi.fn();

    render(
      <TopMatchesSidebar 
        jobs={mockJobs}
        onSelectJob={onSelectJob}
        onOpenGenerator={onOpenGenerator}
      />
    );

    // Wild Card is rendered and shows cool discovery header
    expect(screen.getByText(/COOL & UNUSUAL DISCOVERY/i)).toBeInTheDocument();
    
    // Check for re-roll button with count indicator
    const rerollButton = screen.getByRole('button', { name: /re-roll discovery/i });
    expect(rerollButton).toBeInTheDocument();
    expect(rerollButton).toHaveTextContent(/1\/2/);

    // Click re-roll button to cycle to next cool job
    fireEvent.click(rerollButton);
    expect(rerollButton).toHaveTextContent(/2\/2/);

    // Cycling again wraps back to 1/2
    fireEvent.click(rerollButton);
    expect(rerollButton).toHaveTextContent(/1\/2/);
  });

  it('renders Most Recent and Most Likely sections with dark cyberpunk HUD styling', () => {
    const onSelectJob = vi.fn();
    const onOpenGenerator = vi.fn();

    const { container } = render(
      <TopMatchesSidebar 
        jobs={mockJobs}
        onSelectJob={onSelectJob}
        onOpenGenerator={onOpenGenerator}
      />
    );

    // Verify no jarring white containers (bg-white) exist in the sidebar widgets
    const whiteElements = container.querySelectorAll('.bg-white');
    expect(whiteElements.length).toBe(0);
  });
});
