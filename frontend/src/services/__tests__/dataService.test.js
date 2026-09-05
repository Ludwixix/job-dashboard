import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadAtsDocxResume } from '../dataService';

describe('downloadAtsDocxResume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends correct payload to export-ats-resume and triggers docx download', async () => {
    const mockBlob = new Blob(['fake docx content'], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(mockBlob),
    });

    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:http://localhost/fake-url');
    const mockRevokeObjectURL = vi.fn();
    window.URL.createObjectURL = mockCreateObjectURL;
    window.URL.revokeObjectURL = mockRevokeObjectURL;

    const mockJob = { id: 'job-123', company: 'St Vincent Hospital', title: 'Registered Nurse' };
    const mockProfile = { name: 'Sarah Connor', email: 'sarah@example.com' };

    const result = await downloadAtsDocxResume(mockJob, mockProfile, 'Sample tailored resume markdown');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/export-ats-resume'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: expect.stringContaining('"format":"docx"'),
      })
    );

    expect(result.success).toBe(true);
    expect(result.filename).toContain('ATS_Resume_Sarah_Connor_St_Vincent_Hospital.docx');
    expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/fake-url');
  });

  it('throws error when server responds with non-ok status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const mockJob = { company: 'FailCorp' };
    await expect(downloadAtsDocxResume(mockJob, null)).rejects.toThrow('Export failed with status: 500');
  });
});
