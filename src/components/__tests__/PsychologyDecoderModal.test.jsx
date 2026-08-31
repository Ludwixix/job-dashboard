import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PsychologyDecoderModal } from '../PsychologyDecoderModal';

describe('PsychologyDecoderModal Component', () => {
  const mockJob = {
    title: 'Lead Architect',
    company: 'TechFlow',
    description: 'Fast paced environment, wear many hats, high ownership.'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('displays an error if no API key is configured', async () => {
    render(<PsychologyDecoderModal job={mockJob} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText(/OpenRouter API key is required/i)
      ).toBeInTheDocument();
    });
  });

  it('renders decoded insights when API returns JSON analysis', async () => {
    window.localStorage.setItem('openrouter_api_key', 'sk-test-key-12345');

    const mockApiResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              hiddenPriorities: 'They need someone to untangle legacy tech debt without complaining.',
              managerProfile: 'Stressed VP who needs quick stability and zero drama.',
              edgeStrategy: [
                'Lead with pragmatic refactoring examples',
                'Demonstrate cross-functional calm',
                'Emphasize hands-on troubleshooting'
              ],
              cultureClues: [
                'Wear many hats means small team with under-resourced roadmap',
                'High ownership means you will be on-call'
              ]
            })
          }
        }
      ]
    };

    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })
    );

    render(<PsychologyDecoderModal job={mockJob} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/The Hidden Priorities/i)).toBeInTheDocument();
      expect(screen.getByText(/untangle legacy tech debt/i)).toBeInTheDocument();
      expect(screen.getByText(/Stressed VP who needs quick stability/i)).toBeInTheDocument();
      expect(screen.getByText(/Lead with pragmatic refactoring examples/i)).toBeInTheDocument();
    });
  });
});
