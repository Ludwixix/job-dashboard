import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PdfPreviewModal from '../PdfPreviewModal';

describe('PdfPreviewModal Component', () => {
  const mockProfile = {
    name: 'Jane Doe',
    title: 'Senior Site Reliability Engineer',
    email: 'jane.doe@example.com',
    phone: '+61 400 111 222',
    location: 'Melbourne, VIC',
    summary: 'Experienced SRE with expertise in distributed Kubernetes clusters and observability.',
    skills: ['Kubernetes', 'Go', 'Prometheus', 'Terraform', 'GCP'],
    experience: [
      {
        role: 'Lead SRE',
        company: 'FinTech Australia',
        dates: '2022 - Present',
        bullets: ['Architected 99.999% uptime trading infrastructure.', 'Reduced incident MTTR by 60%.']
      }
    ]
  };

  it('renders studio modal with candidate information and template choices', () => {
    render(<PdfPreviewModal isOpen={true} onClose={vi.fn()} initialProfile={mockProfile} />);

    expect(screen.getByText(/Real-Time Visual ATS PDF Studio/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText(/Modern Executive/i)).toBeInTheDocument();
    expect(screen.getByText(/ATS Readiness/i)).toBeInTheDocument();
  });

  it('allows switching between ATS templates', () => {
    render(<PdfPreviewModal isOpen={true} onClose={vi.fn()} initialProfile={mockProfile} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'TECHNICAL_SPECIALIST' } });

    expect(screen.getByText(/TECHNICAL CAPABILITY MATRIX/i)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<PdfPreviewModal isOpen={true} onClose={onClose} initialProfile={mockProfile} />);

    const closeBtn = screen.getByRole('button', { name: /Close Studio/i });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });
});

