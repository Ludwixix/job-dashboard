import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import VoiceMockInterviewModal from '../VoiceMockInterviewModal';

describe('VoiceMockInterviewModal Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <VoiceMockInterviewModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with tracks, questions, and STAR breakdown', () => {
    render(<VoiceMockInterviewModal isOpen={true} onClose={vi.fn()} />);

    expect(
      screen.getByText(/Interactive Voice Mock Interview Studio/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/STAR AI Evaluator/i)).toBeInTheDocument();
    expect(screen.getByText(/Cloud & Systems Engineering/i)).toBeInTheDocument();
    expect(screen.getByText(/Australian Public Service/i)).toBeInTheDocument();
    expect(screen.getByText(/STAR Pillar Breakdown/i)).toBeInTheDocument();
    expect(screen.getByText(/STAR Mastery Score/i)).toBeInTheDocument();
  });

  it('allows switching tracks and displays corresponding questions', () => {
    render(<VoiceMockInterviewModal isOpen={true} onClose={vi.fn()} />);

    const apsTrackButton = screen.getByText(/Australian Public Service/i);
    fireEvent.click(apsTrackButton);

    expect(screen.getByText(/APS Values & Code of Conduct/i)).toBeInTheDocument();
  });

  it('updates evaluation when typing into transcript input', () => {
    render(<VoiceMockInterviewModal isOpen={true} onClose={vi.fn()} />);

    const textarea = screen.getByPlaceholderText(
      /Speak clearly using the microphone button above/i
    );
    fireEvent.change(textarea, {
      target: {
        value:
          'When I was at my previous enterprise organization facing a legacy infrastructure challenge, our distributed systems experienced severe latency spikes during peak load. My role was to lead the platform stability initiative and eliminate bottlenecks across engineering teams. I architected a modern microservices platform using event streaming, I migrated our primary relational databases to a globally distributed cloud data store with zero downtime, and I automated the deployment testing suite. As a result of these strategic actions, we reduced p99 latency by 65%, cut infrastructure spend by $250,000 annually, and delivered 99.99% uptime across 1,000,000 active users.',
      },
    });

    expect(screen.getByText(/Panel Ready/i)).toBeInTheDocument();
    expect(screen.getByText(/Optimal interview pacing/i)).toBeInTheDocument();
  });
});
