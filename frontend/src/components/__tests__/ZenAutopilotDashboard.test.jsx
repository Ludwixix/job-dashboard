import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ZenAutopilotDashboard from '../ZenAutopilotDashboard';

vi.mock('../../services/autopilotAgent', () => ({
  subscribeAutopilot: vi.fn((cb) => {
    cb({
      isRunning: true,
      activeTask: 'monitoring',
      activeJobTitle: '',
      stats: {
        screenedJobs: 15,
        resumesSynthesized: 6,
        coverLettersSynthesized: 6,
        psychProfilesBaked: 4,
        applicationsTallied: 3,
        recruiterUpdatesDetected: 1
      },
      activityLog: [
        { id: '1', timestamp: '2026-08-31T10:00:00Z', type: 'info', message: 'Synthesized resume for Thales' }
      ],
      readyActionDeck: [
        { id: 'job_1', title: 'Senior Cloud Engineer', company: 'Thales', location: 'Melbourne, VIC', score: 95 }
      ]
    });
    return () => {};
  }),
  triggerAutonomousGmailScan: vi.fn().mockResolvedValue({ updates_count: 1 })
}));

vi.mock('../../services/generationService', () => ({
  fetchDocumentFromBackend: vi.fn().mockResolvedValue({
    content_text: 'PRE_GENERATED RESUME BULLETS'
  })
}));

vi.mock('../../services/psychologyService', () => ({
  fetchPsychologyFromBackend: vi.fn().mockResolvedValue({
    insights: { companyCulture: 'Engineering-first culture' }
  })
}));

vi.mock('../../services/trackerService', () => ({
  saveUserApplicationToBackend: vi.fn().mockResolvedValue({ id: 1 })
}));

describe('ZenAutopilotDashboard Component', () => {
  const sampleJobs = [
    { id: 'job_1', title: 'Senior Cloud Engineer', company: 'Thales', location: 'Melbourne, VIC', score: 95 }
  ];

  const sampleApps = [
    { id: 'app_1', title: 'Senior Infrastructure Engineer', company: 'Capgemini', status: 'Applied', appliedDate: '2026-08-30' }
  ];

  it('renders Zen mode header, stats, and high-conviction opportunities', () => {
    const onSwitch = vi.fn();
    render(
      <ZenAutopilotDashboard
        jobs={sampleJobs}
        profile={{ name: 'Sam Ludwig' }}
        applications={sampleApps}
        onSwitchToStudio={onSwitch}
      />
    );

    expect(screen.getByText('AUTOPILOT')).toBeDefined();
    expect(screen.getByText('Open Studio')).toBeDefined();
    expect(screen.getByText(/Thales/)).toBeDefined();
    expect(screen.getByText('95% Match')).toBeDefined();
  });

  it('allows user to switch back to Studio Mode when button clicked', () => {
    const onSwitch = vi.fn();
    render(
      <ZenAutopilotDashboard
        jobs={sampleJobs}
        profile={{ name: 'Sam Ludwig' }}
        applications={sampleApps}
        onSwitchToStudio={onSwitch}
      />
    );

    const studioBtn = screen.getByText('Open Studio');
    fireEvent.click(studioBtn);
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  it('opens quick preview modal for pre-synthesized pitch documents', async () => {
    render(
      <ZenAutopilotDashboard
        jobs={sampleJobs}
        profile={{ name: 'Sam Ludwig' }}
        applications={sampleApps}
      />
    );

    const pitchBtn = screen.getByText('Pitch Docs');
    fireEvent.click(pitchBtn);

    expect(await screen.findByText('✨ Pre-Synthesized Tailored Application')).toBeDefined();
  });
});
