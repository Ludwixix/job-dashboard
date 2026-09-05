import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OfferActionHubModal } from '../OfferActionHubModal';

describe('OfferActionHubModal Component', () => {
  const mockJob = {
    id: 'job-canva-123',
    title: 'Senior Software Engineer',
    company: 'Canva',
    location: 'Sydney NSW',
    salary: '$165,000'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with job details and initial compensation benchmark tab', () => {
    render(<OfferActionHubModal isOpen={true} onClose={vi.fn()} job={mockJob} />);

    expect(screen.getByText(/OFFER ACTION HUB/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Senior Software Engineer/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Gross Annual Base/i)).toBeInTheDocument();
    expect(screen.getByText(/Net Take-Home \(Monthly\)/i)).toBeInTheDocument();
  });

  it('allows switching to Counter-Offer Playbook and toggling postures', async () => {
    render(<OfferActionHubModal isOpen={true} onClose={vi.fn()} job={mockJob} />);

    // Click tab: 2. COUNTER-OFFER ENGINE
    const counterTabBtn = screen.getByRole('button', { name: /COUNTER-OFFER ENGINE/i });
    fireEvent.click(counterTabBtn);

    expect(screen.getByText(/Negotiation Posture/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Assertive/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Collaborative/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Perks & WFH/i })).toBeInTheDocument();

    // Click Perks & WFH posture
    const benefitsBtn = screen.getByRole('button', { name: /Perks & WFH/i });
    fireEvent.click(benefitsBtn);

    expect(screen.getAllByText(/CPD/i).length).toBeGreaterThan(0);
  });

  it('allows switching to Contract Risk Scanner and scanning contract clauses', async () => {
    render(<OfferActionHubModal isOpen={true} onClose={vi.fn()} job={mockJob} />);

    // Click tab: 3. CONTRACT RISK SCANNER
    const contractTabBtn = screen.getByRole('button', { name: /CONTRACT RISK SCANNER/i });
    fireEvent.click(contractTabBtn);

    expect(screen.getByRole('button', { name: /Load Sample Restrictive Contract/i })).toBeInTheDocument();
    
    // Load sample contract text (which automatically triggers scan)
    const sampleBtn = screen.getByRole('button', { name: /Load Sample Restrictive Contract/i });
    fireEvent.click(sampleBtn);

    await waitFor(() => {
      expect(screen.getByText(/Contract Safety Score/i)).toBeInTheDocument();
      expect(screen.getByText(/Post-Employment Restraint Clause Detected/i)).toBeInTheDocument();
    });
  });

  it('invokes onClose when clicking close icon or DONE button', () => {
    const handleClose = vi.fn();
    render(<OfferActionHubModal isOpen={true} onClose={handleClose} job={mockJob} />);

    const doneBtn = screen.getByRole('button', { name: /DONE/i });
    fireEvent.click(doneBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
