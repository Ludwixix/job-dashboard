import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CareerModeCockpit } from '../CareerModeCockpit';
import * as careerCockpitService from '../../services/careerCockpitService';

describe('CareerModeCockpit', () => {
  const mockOverview = {
    success: true,
    profile: {
      id: 'sam_ludwig',
      name: 'Sam Ludwig',
      title: 'Senior Infrastructure & M365 Engineer',
      seniorityLevel: 'Senior / Lead',
      yearsOfExperience: 10,
      workRights: 'Australian Citizen (Unrestricted)',
      clearance: 'Australian Citizen (Baseline / NV1 Eligible)',
      targetSalary: '$140,000 - $165,000 + Super',
      salaryFloor: 120000,
      location: 'Melbourne, VIC (Balaclava 3183)',
      targetTitles: [
        'Senior Systems Engineer',
        'Senior Infrastructure Engineer',
        'Senior M365 Specialist'
      ]
    },
    telemetry: {
      last_scraped_at: '2026-09-24T09:30:00Z',
      new_vacancies_today: 14,
      active_queue_depth: 0,
      feed_health: 'healthy',
      total_matching_jobs: 84,
      high_alignment_jobs: 29
    }
  };

  const mockMatches = {
    success: true,
    total: 2,
    jobs: [
      {
        id: 'sam_job_1',
        title: 'Lead Systems Specialist (M365 & Cloud)',
        company: 'Victorian Enterprise Solutions',
        location: 'Melbourne, VIC',
        salary: '$150,000 - $165,000',
        samScore: 96,
        justificationScore: 94,
        archetype: 'Senior Systems Engineer',
        matchExplanationChips: ['M365 & Entra ID: 100%', 'Salary: In Range', 'Clearance: Ready'],
        proofPoints: ['Matches 660,000+ user M365 enterprise administration at Dept of Education VIC']
      },
      {
        id: 'sam_job_2',
        title: 'Senior Infrastructure Engineer',
        company: 'St Health Care Group',
        location: 'Clayton, VIC',
        salary: '$145k + super',
        samScore: 91,
        justificationScore: 89,
        archetype: 'Senior Infrastructure Engineer',
        matchExplanationChips: ['Autopilot/Intune: Match', 'Systems & Infra: 95%'],
        proofPoints: ['Matches 100+ clinical endpoint Windows 11 Autopilot migration at St John of God Health Care']
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(careerCockpitService, 'fetchCareerOverview').mockResolvedValue(mockOverview);
    vi.spyOn(careerCockpitService, 'fetchCareerMatches').mockResolvedValue(mockMatches);
  });

  it('renders telemetry HUD cards for salary, clearance, location, and sentinel', async () => {
    render(<CareerModeCockpit jobs={[]} />);

    await waitFor(() => {
      expect(screen.getByText('Sam Mode: Personal Career Cockpit')).toBeInTheDocument();
    });

    // Check Telemetry HUD
    expect(screen.getByText('$140k – $165k')).toBeInTheDocument();
    expect(screen.getByText('Australian Citizen')).toBeInTheDocument();
    expect(screen.getByText('Balaclava 3183 & Melb SE')).toBeInTheDocument();
  });

  it('displays scored job opportunities with match chips and proof points', async () => {
    render(<CareerModeCockpit jobs={[]} />);

    await waitFor(() => {
      expect(screen.getByText('Lead Systems Specialist (M365 & Cloud)')).toBeInTheDocument();
    });

    expect(screen.getByText('Victorian Enterprise Solutions')).toBeInTheDocument();
    expect(screen.getByText('M365 & Entra ID: 100%')).toBeInTheDocument();
    expect(screen.getByText(/Matches 660,000\+ user M365 enterprise administration/i)).toBeInTheDocument();
    expect(screen.getByText('96%')).toBeInTheDocument();
  });

  it('filters job feed when selecting an archetype toggle', async () => {
    render(<CareerModeCockpit jobs={[]} />);

    await waitFor(() => {
      expect(screen.getByText('Lead Systems Specialist (M365 & Cloud)')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Senior Infrastructure Engineer' })).toBeInTheDocument();
    });

    // Click on "Senior Infrastructure Engineer" archetype button
    const archetypeBtn = screen.getByRole('button', { name: /Senior Infrastructure Engineer/i });
    fireEvent.click(archetypeBtn);

    expect(screen.queryByText('Lead Systems Specialist (M365 & Cloud)')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Senior Infrastructure Engineer' })).toBeInTheDocument();
  });

  it('opens 1-click Application Studio modal when clicking button', async () => {
    render(<CareerModeCockpit jobs={[]} />);

    await waitFor(() => {
      expect(screen.getByText('Lead Systems Specialist (M365 & Cloud)')).toBeInTheDocument();
    });

    const studioBtns = screen.getAllByRole('button', { name: /1-Click Application Studio/i });
    fireEvent.click(studioBtns[0]);

    await waitFor(() => {
      expect(screen.getByText('STAR Selection Criteria')).toBeInTheDocument();
    });
  });
});
