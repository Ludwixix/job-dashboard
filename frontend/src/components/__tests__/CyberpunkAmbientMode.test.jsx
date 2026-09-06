import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CyberpunkAmbientMode from '../CyberpunkAmbientMode';
import { ambientEngine } from '../../services/ambientAudioEngine';

// Mock Web Audio and Canvas
beforeEach(() => {
  vi.clearAllMocks();
  // Mock HTMLCanvasElement getContext
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

describe('CyberpunkAmbientMode Component', () => {
  const mockJobs = [
    {
      id: 'job-1',
      title: 'Staff Platform Reliability Architect',
      company: 'NeoTokyo Cybernetics',
      location: 'Melbourne VIC',
      score: 96,
      date: new Date().toISOString()
    },
    {
      id: 'job-2',
      title: 'Lead Distributed Systems Engineer',
      company: 'Aetherial Cloud',
      location: 'Sydney NSW',
      score: 91,
      date: new Date().toISOString()
    }
  ];

  it('renders cyberpunk HUD, metrics, and real-time opportunity flows', () => {
    render(
      <CyberpunkAmbientMode
        jobs={mockJobs}
        profile={{ title: 'Principal Infrastructure Engineer' }}
        onReturnToDashboard={vi.fn()}
      />
    );

    expect(screen.getByText(/CYBERPUNK AMBIENT \/\/ REALTIME FLOWS/i)).toBeInTheDocument();
    expect(screen.getByText(/INDEXED STREAM/i)).toBeInTheDocument();
    expect(screen.getByText(/HIGH FIT DENSITY/i)).toBeInTheDocument();
    expect(screen.getByText(/PIPELINE FLOW/i)).toBeInTheDocument();
    expect(screen.getByText(/REAL-TIME OPPORTUNITY FLOW/i)).toBeInTheDocument();

    // Check that top opportunity appears in flow
    expect(screen.getByText('Staff Platform Reliability Architect')).toBeInTheDocument();
    expect(screen.getByText('NeoTokyo Cybernetics')).toBeInTheDocument();
  });

  it('toggles audio engine when start soundscape button is clicked', async () => {
    const startSpy = vi.spyOn(ambientEngine, 'start').mockResolvedValue();
    const stopSpy = vi.spyOn(ambientEngine, 'stop').mockImplementation(() => {});

    render(
      <CyberpunkAmbientMode
        jobs={mockJobs}
        onReturnToDashboard={vi.fn()}
      />
    );

    const soundBtn = screen.getByTitle(/Toggle Dystopian Ambient Pads & Pulses/i);
    fireEvent.click(soundBtn);
    expect(startSpy).toHaveBeenCalled();
  });

  it('navigates back to dashboard when RETURN button or Escape is triggered', () => {
    const onReturn = vi.fn();
    render(
      <CyberpunkAmbientMode
        jobs={mockJobs}
        onReturnToDashboard={onReturn}
      />
    );

    const returnBtn = screen.getByTitle(/Return to Main Dashboard/i);
    fireEvent.click(returnBtn);
    expect(onReturn).toHaveBeenCalledTimes(1);

    // Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onReturn).toHaveBeenCalledTimes(2);
  });
});
