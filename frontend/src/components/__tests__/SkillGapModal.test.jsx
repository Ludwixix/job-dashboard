import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SkillGapModal } from '../SkillGapModal';

describe('SkillGapModal', () => {
  const mockJobs = [
    {
      id: 'job_1',
      title: 'Cloud Platform Architect',
      audit: {
        missing_skills: ['Kubernetes', 'Terraform'],
      },
      tags: ['Kubernetes', 'Terraform', 'Azure'],
    },
    {
      id: 'job_2',
      title: 'DevOps Specialist',
      audit: {
        missing_skills: ['Kubernetes', 'Ansible'],
      },
      tags: ['Kubernetes', 'Ansible'],
    },
  ];

  const mockProfile = {
    skills: ['Azure', 'PowerShell'],
  };

  it('renders skill gap analysis header and top missing competencies', () => {
    render(<SkillGapModal jobs={mockJobs} userProfile={mockProfile} onClose={vi.fn()} />);

    expect(screen.getByText('Market Skill Gap Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Kubernetes')).toBeInTheDocument();
    expect(screen.getByText('Terraform')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<SkillGapModal jobs={mockJobs} userProfile={mockProfile} onClose={onClose} />);

    const closeBtn = screen.getByLabelText('Close modal');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
