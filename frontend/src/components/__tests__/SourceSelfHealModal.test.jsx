import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SourceSelfHealModal } from '../SourceSelfHealModal';
import * as healingService from '../../services/sourceHealingService';

describe('SourceSelfHealModal', () => {
  const mockSummary = {
    SEEK: { status: 'healthy', queries: 45, latency_ms: 110 },
    Indeed: { status: 'degraded', queries: 20, last_error: 'HTTP 429 Too Many Requests' },
    Adzuna: { status: 'healthy', queries: 12, latency_ms: 220 },
    RemoteOK: { status: 'healthy', queries: 5, latency_ms: 180 },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(healingService, 'fetchSourcesHealth').mockResolvedValue({
      status: 'ok',
      overall_status: 'degraded',
      summary: mockSummary,
    });
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <SourceSelfHealModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with sources grid, active model indicator, and health badges when open', async () => {
    render(<SourceSelfHealModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/SCRAPER HEALTH & AUTONOMOUS SELF-HEALING/i)).toBeInTheDocument();
    expect(screen.getByText(/Diagnostic Probe/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Runtime Tier Escalation/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/User LLM Code Repair/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/SEEK Australia/i)).toBeInTheDocument();
      expect(screen.getByText(/Indeed AU & Global/i)).toBeInTheDocument();
      expect(screen.getByText(/Adzuna Australia API/i)).toBeInTheDocument();
      expect(screen.getByText(/RemoteOK Global Feed/i)).toBeInTheDocument();
    });
  });

  it('executes probe when Probe button is clicked', async () => {
    vi.spyOn(healingService, 'diagnoseSource').mockResolvedValue({
      source: 'SEEK',
      status: 'healthy',
      latency_ms: 95,
      jobs_found: 8,
      error_details: null,
      suggested_action: 'Nominal',
    });

    render(<SourceSelfHealModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/SEEK Australia/i)).toBeInTheDocument();
    });

    const probeButtons = screen.getAllByRole('button', { name: /probe/i });
    fireEvent.click(probeButtons[0]);

    await waitFor(() => {
      expect(healingService.diagnoseSource).toHaveBeenCalledWith('SEEK');
      expect(screen.getByText(/AUTONOMOUS EXECUTION LOG: SEEK/i)).toBeInTheDocument();
    });
  });

  it('calls 1-Click Self-Heal and triggers runAutomatedSelfHealing', async () => {
    vi.spyOn(healingService, 'runAutomatedSelfHealing').mockResolvedValue({
      source: 'Indeed',
      success: true,
      stage: 'completed',
      diagnosis: { status: 'healthy' },
    });

    render(<SourceSelfHealModal isOpen={true} onClose={vi.fn()} initialSource="Indeed" />);

    await waitFor(() => {
      expect(screen.getByText(/Indeed AU & Global/i)).toBeInTheDocument();
    });

    const healButtons = screen.getAllByRole('button', { name: /1-click self-heal/i });
    fireEvent.click(healButtons[1]); // Indeed

    await waitFor(() => {
      expect(healingService.runAutomatedSelfHealing).toHaveBeenCalledWith(
        'Indeed',
        expect.objectContaining({ allowLlmRepair: true })
      );
    });
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<SourceSelfHealModal isOpen={true} onClose={handleClose} />);

    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
