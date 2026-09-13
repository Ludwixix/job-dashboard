import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LinkedInInboundModal } from '../LinkedInInboundModal';

vi.mock('../../services/inboundSourcingService', () => ({
  auditLinkedInProfile: vi.fn().mockResolvedValue({
    audit: {
      inbound_visibility_score: 88,
      strengths: ['Headline contains literal target role title.'],
      recommendations: [],
      headline_character_count: 75,
      headline_character_limit: 220,
    },
    headlines: [
      'Senior Cloud Engineer | Azure, Terraform | DevSecOps',
      'Cloud & Infrastructure Specialist | Azure Architecture',
      'Enterprise Systems Engineer (5,000+ Endpoints)',
    ],
    aboutIndex: 'Experienced Senior Cloud Engineer...\n\n─── CORE COMPETENCIES ───',
  }),
  testBooleanQuery: vi.fn().mockResolvedValue({
    is_match: true,
    matched_terms: ['Cloud Engineer', 'Azure'],
    missing_terms: [],
    has_curly_quotes_warning: false,
    token_count: 5,
  }),
  fetchJobInboundOptimization: vi.fn().mockResolvedValue({
    targetTitle: 'Senior Cloud Engineer',
    queries: [
      {
        strategy: 'Exact Target Title & Core Stack',
        description: 'Used by corporate recruiters.',
        query: '"Senior Cloud Engineer" AND (Azure OR AWS)',
      },
    ],
    headlines: [
      'Senior Cloud Engineer | Azure, Terraform | DevSecOps',
    ],
    aboutIndex: 'Experienced Senior Cloud Engineer...',
  }),
  formatInboundScoreBadge: vi.fn().mockReturnValue({
    label: 'High Visibility',
    colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    dotClass: 'bg-emerald-400',
  }),
}));

vi.mock('../../services/profileService', () => ({
  getActiveProfile: vi.fn().mockReturnValue({
    name: 'Jane Doe',
    title: 'Senior Cloud Engineer',
    headline: 'Senior Cloud Engineer | Azure, Terraform',
    about: 'Experienced in Azure and Terraform',
    coreSkills: ['Azure', 'Terraform'],
  }),
}));

describe('LinkedInInboundModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly when open', async () => {
    render(<LinkedInInboundModal isOpen={true} onClose={vi.fn()} job={{ id: 'j1', title: 'Senior Cloud Engineer' }} />);

    expect(screen.getByText(/LinkedIn Recruiter Boolean Indexing Hub/i)).toBeInTheDocument();
    expect(screen.getByText(/Recruiter Query Sandbox/i)).toBeInTheDocument();
    expect(screen.getByText(/Headline Sourcing Synthesizer/i)).toBeInTheDocument();
  });

  it('switches tabs and displays headline synthesizer', async () => {
    render(<LinkedInInboundModal isOpen={true} onClose={vi.fn()} job={{ id: 'j1', title: 'Senior Cloud Engineer' }} />);

    const headlinesTab = screen.getByText(/Headline Sourcing Synthesizer/i);
    fireEvent.click(headlinesTab);

    await waitFor(() => {
      expect(screen.getByText(/3 High-Converting Boolean-Friendly Headlines/i)).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<LinkedInInboundModal isOpen={true} onClose={handleClose} job={{ id: 'j1', title: 'Senior Cloud Engineer' }} />);

    const closeBtn = screen.getByLabelText(/Close modal/i);
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
