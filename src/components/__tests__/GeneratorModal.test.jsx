import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeneratorModal } from '../GeneratorModal';

describe('GeneratorModal Component', () => {
  const mockJob = {
    id: 'job-999',
    title: 'Full Stack Developer',
    company: 'NextGen Systems',
    description: 'React, Node, Cloud architecture.',
    resumeText: 'Original Resume Content',
    coverLetterText: 'Original Cover Letter Content'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows user to edit resume in Studio and triggers onSaveCustomDocs on download or save', () => {
    const handleSaveCustomDocs = vi.fn();
    render(
      <GeneratorModal 
        job={mockJob} 
        onClose={vi.fn()} 
        onSaveCustomDocs={handleSaveCustomDocs} 
      />
    );

    // Switch to RESUME tab
    const resumeTab = screen.getByRole('button', { name: /RESUME/i });
    fireEvent.click(resumeTab);

    // Find textarea and change text
    const textareas = screen.getAllByRole('textbox');
    const resumeTextarea = textareas[0];
    
    fireEvent.change(resumeTextarea, {
      target: { value: 'Updated Custom Resume Content with Key Achievements' }
    });

    // Click download resume button
    const downloadButton = screen.getByRole('button', { name: /DOWNLOAD RESUME \(PDF\)/i });
    fireEvent.click(downloadButton);

    expect(handleSaveCustomDocs).toHaveBeenCalledWith(
      'job-999',
      expect.objectContaining({
        resumeText: 'Updated Custom Resume Content with Key Achievements'
      })
    );
  });
});
