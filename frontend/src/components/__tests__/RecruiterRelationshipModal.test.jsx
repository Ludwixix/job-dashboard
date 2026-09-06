import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RecruiterRelationshipModal from '../RecruiterRelationshipModal';
import * as recruiterCrmService from '../../services/recruiterCrmService';

const mockContacts = [
  {
    id: 'rec-1',
    name: 'Sarah Jenkins',
    role: 'Principal Consultant - Cloud',
    organization: 'Hays Australia',
    contact_type: 'agency_recruiter',
    sector: 'technology',
    email: 'sarah.jenkins@hays.com.au',
    phone: '+61 2 8226 9600',
    linkedin_url: 'https://linkedin.com/in/sarah-jenkins-hays',
    notes: 'Handles Tier-1 Enterprise cloud mandates.',
    relationship_health: 'active',
    cadence_frequency_days: 14,
    last_interaction_date: '2026-08-28',
    next_follow_up_date: '2026-09-11',
    associated_job_ids: ['job-123'],
    interactions: [
      {
        id: 'int-1',
        date: '2026-08-28',
        type: 'email_outreach',
        summary: 'Introduced cloud portfolio and discussed Macquarie cloud lead role.',
        outcome: 'Shared job description; requested tailored CV.',
      },
    ],
  },
  {
    id: 'rec-2',
    name: 'David Alverez',
    role: 'Director - Executive Search',
    organization: 'Michael Page',
    contact_type: 'executive_search',
    sector: 'legal',
    email: 'david.alverez@michaelpage.com.au',
    phone: '+61 3 9607 5600',
    notes: 'Corporate legal and compliance search.',
    relationship_health: 'warm',
    cadence_frequency_days: 21,
    last_interaction_date: '2026-08-10',
    next_follow_up_date: '2026-08-31', // Overdue
    associated_job_ids: [],
    interactions: [],
  },
];

describe('RecruiterRelationshipModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(recruiterCrmService, 'fetchContacts').mockResolvedValue(mockContacts);
    vi.spyOn(recruiterCrmService, 'fetchCadenceRadar').mockResolvedValue(null);
    vi.spyOn(recruiterCrmService, 'saveContact').mockImplementation(async (c) => ({
      ...c,
      id: c.id || 'rec-new',
    }));
    vi.spyOn(recruiterCrmService, 'logInteraction').mockImplementation(async (cid, intData) => {
      const found = mockContacts.find((c) => c.id === cid) || mockContacts[0];
      return {
        ...found,
        interactions: [...found.interactions, { ...intData, id: 'int-new' }],
        last_interaction_date: intData.date,
      };
    });
  });

  it('renders correctly when open', async () => {
    render(<RecruiterRelationshipModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/Recruiter & Talent CRM/i)).toBeInTheDocument();
    expect(screen.getByText(/Directory/i)).toBeInTheDocument();
    expect(screen.getByText(/Cadence Radar/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Sarah Jenkins')).toBeInTheDocument();
      expect(screen.getByText('David Alverez')).toBeInTheDocument();
    });
  });

  it('switches to Cadence Radar tab and shows overdue contacts', async () => {
    render(<RecruiterRelationshipModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Jenkins')).toBeInTheDocument();
    });

    const radarTab = screen.getByRole('button', { name: /Cadence Radar/i });
    fireEvent.click(radarTab);

    expect(screen.getByText(/Follow-Up Radar/i)).toBeInTheDocument();
    expect(screen.getByText(/David Alverez/i)).toBeInTheDocument();
  });

  it('filters contacts by search term', async () => {
    render(<RecruiterRelationshipModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Jenkins')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search name, company/i);
    fireEvent.change(searchInput, { target: { value: 'Michael Page' } });

    expect(screen.getByText('David Alverez')).toBeInTheDocument();
    expect(screen.queryByText('Sarah Jenkins')).not.toBeInTheDocument();
  });

  it('opens contact details and displays interaction timeline', async () => {
    render(<RecruiterRelationshipModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Jenkins')).toBeInTheDocument();
    });

    const viewButton = screen.getAllByRole('button', { name: /Timeline|View/i })[0];
    fireEvent.click(viewButton);

    expect(screen.getByText(/Contact Timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/Introduced cloud portfolio/i)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<RecruiterRelationshipModal isOpen={true} onClose={onClose} />);

    const closeBtn = screen.getByLabelText(/Close modal/i);
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });
});

