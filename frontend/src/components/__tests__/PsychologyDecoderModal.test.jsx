import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PsychologyDecoderModal } from '../PsychologyDecoderModal';

describe('PsychologyDecoderModal Component', () => {
  const mockJob = {
    id: 'job-123',
    title: 'Senior Cloud Engineer',
    company: 'Acme Corp',
    description: 'We are seeking an experienced engineer to overhaul our legacy infrastructure.'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('renders and fetches psychology insights asynchronously from OpenRouter', async () => {
    window.localStorage.setItem('openrouter_api_key', 'test-key');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                hiddenPriorities: 'They are desperately firefighting cloud outages.',
                managerProfile: 'Stressed engineering director seeking reliability.',
                edgeStrategy: ['Emphasize zero-downtime migrations.'],
                cultureClues: ['Urgent hiring indicates understaffing.']
              })
            }
          }
        ]
      })
    });

    const onSave = vi.fn();
    render(<PsychologyDecoderModal job={mockJob} onClose={vi.fn()} onSaveInsights={onSave} />);

    expect(screen.getByText(/DECODING COVERT SUBTEXT/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/They are desperately firefighting cloud outages/i)).toBeInTheDocument();
      expect(screen.getByText(/Stressed engineering director seeking reliability/i)).toBeInTheDocument();
      expect(screen.getByText(/Emphasize zero-downtime migrations/i)).toBeInTheDocument();
    });

    expect(onSave).toHaveBeenCalledWith('job-123', expect.objectContaining({
      hiddenPriorities: 'They are desperately firefighting cloud outages.'
    }));
  });

  it('immediately renders retained cached insights without making a new network request', async () => {
    const cachedJob = {
      ...mockJob,
      psychologyInsights: {
        hiddenPriorities: 'Retained from previous session.',
        managerProfile: 'Cached manager profile.',
        edgeStrategy: ['Use cached edge.'],
        cultureClues: ['Cached culture clue.'],
        decodedAt: '2026-08-31T00:00:00.000Z'
      }
    };

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    render(<PsychologyDecoderModal job={cachedJob} onClose={vi.fn()} onSaveInsights={vi.fn()} />);

    expect(screen.getByText(/Retained from previous session/i)).toBeInTheDocument();
    expect(screen.getByText(/RETAINED ON CARD/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
