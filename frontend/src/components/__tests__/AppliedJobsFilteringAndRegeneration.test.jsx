import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { JobSeeker } from '../JobSeeker';
import { JobModal } from '../JobModal';
import * as generationService from '../../services/generationService';
import * as pdfGenerator from '../../utils/pdfGenerator';

vi.mock('../AutoApplyModal', () => ({ AutoApplyModal: () => <div data-testid="auto-apply-modal" /> }));
vi.mock('../PsychologyDecoderModal', () => ({ PsychologyDecoderModal: () => <div data-testid="psychology-modal" /> }));
vi.mock('../GeneratorModal', () => ({ GeneratorModal: () => <div data-testid="generator-modal" /> }));
vi.mock('../TopMatchesSidebar', () => ({ TopMatchesSidebar: () => <div data-testid="top-matches-sidebar" /> }));

describe('Applied Jobs Exclusion and Quick Document Regeneration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const todayDate = new Date().toISOString().split('T')[0];
  const mockJobs = [
    {
      id: 'job_open_1',
      title: 'Senior Cloud Engineer',
      company: 'Tech Innovations',
      location: 'Melbourne VIC',
      date: todayDate,
      salary: '$150,000',
      description: 'AWS Azure Kubernetes',
      isComplete: true,
      score: 95
    },
    {
      id: 'job_already_applied',
      title: 'Systems Administrator',
      company: 'DataSecure Australia',
      location: 'Melbourne VIC',
      date: todayDate,
      salary: '$130,000',
      description: 'Windows Server Entra ID',
      isComplete: true,
      score: 88
    }
  ];

  it('filters out jobs from JobSeeker search when present in tracked_applications', () => {
    // Put job_already_applied in tracked_applications
    localStorage.setItem('tracked_applications', JSON.stringify([
      {
        id: 'job_already_applied',
        company: 'DataSecure Australia',
        title: 'Systems Administrator',
        status: 'Applied'
      }
    ]));

    render(
      <JobSeeker 
        jobs={mockJobs} 
        onSelectJob={() => {}} 
        onUpdateStatus={() => {}}
      />
    );

    // Tech Innovations should be visible in search
    expect(screen.getByText('Tech Innovations')).toBeInTheDocument();

    // DataSecure Australia should NOT be visible in unsubmitted search results
    expect(screen.queryByText('DataSecure Australia')).not.toBeInTheDocument();
  });

  it('filters out jobs from JobSeeker when status is marked Applied on the job record', () => {
    const jobsWithApplied = [
      mockJobs[0],
      {
        ...mockJobs[1],
        status: 'Applied / In Review'
      }
    ];

    render(
      <JobSeeker 
        jobs={jobsWithApplied} 
        onSelectJob={() => {}} 
        onUpdateStatus={() => {}}
      />
    );

    expect(screen.getByText('Tech Innovations')).toBeInTheDocument();
    expect(screen.queryByText('DataSecure Australia')).not.toBeInTheDocument();
  });

  it('renders quick regeneration controls and triggers document re-generation in JobModal', async () => {
    const mockGenerate = vi.spyOn(generationService, 'generateApplicationDocs').mockResolvedValue({
      success: true,
      resume: 'Updated Tailored Resume Content',
      coverLetter: 'Updated Cover Letter Content',
      linkedInOptimization: 'Updated LinkedIn',
      model: 'google/gemini-2.0-flash-exp:free'
    });

    const mockDownloadResume = vi.spyOn(pdfGenerator, 'downloadResumePdf').mockImplementation(() => {});
    const mockDownloadCover = vi.spyOn(pdfGenerator, 'downloadCoverLetterPdf').mockImplementation(() => {});

    const jobWithDocs = {
      id: 'job-regenerate-test',
      company: 'Quantum Tech',
      title: 'Lead Systems Architect',
      hasCustomDocs: true,
      resumeText: 'Initial Resume Text',
      coverLetterText: 'Initial Cover Letter Text',
      docsModel: 'GLM 5.3 Flash'
    };

    const handleUpdate = vi.fn();

    render(
      <JobModal
        job={jobWithDocs}
        onClose={() => {}}
        onJobStatusUpdate={handleUpdate}
      />
    );

    // Verify model select and regeneration button exist
    const modelSelect = screen.getByDisplayValue(/GLM 5.3 Flash/i);
    expect(modelSelect).toBeInTheDocument();

    const regenerateButtons = screen.getAllByRole('button', { name: /REGENERATE/i });
    expect(regenerateButtons.length).toBeGreaterThan(0);

    // Change model to free Gemini
    fireEvent.change(modelSelect, { target: { value: 'google/gemini-2.0-flash-exp:free' } });

    // Click regenerate button
    fireEvent.click(regenerateButtons[0]);

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalled();
      expect(mockDownloadResume).toHaveBeenCalledWith('Updated Tailored Resume Content', expect.any(Object));
      expect(handleUpdate).toHaveBeenCalledWith(expect.objectContaining({
        resumeText: 'Updated Tailored Resume Content',
        coverLetterText: 'Updated Cover Letter Content'
      }));
    });
  });
});
