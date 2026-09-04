import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  startAutopilot, 
  stopAutopilot, 
  getAutopilotState, 
  subscribeAutopilot, 
  buildPriorityQueue, 
  triggerAutonomousGmailScan 
} from '../autopilotAgent';

vi.mock('../generationService', () => ({
  generateApplicationDocs: vi.fn().mockResolvedValue({
    success: true,
    resume: 'TAILORED RESUME CONTENT',
    coverLetter: 'TAILORED COVER LETTER CONTENT',
    model: 'deepseek-r1'
  }),
  saveDocumentToBackend: vi.fn().mockResolvedValue({ id: 1, doc_type: 'resume' }),
  fetchDocumentFromBackend: vi.fn().mockResolvedValue(null)
}));

vi.mock('../psychologyService', () => ({
  fetchJobPsychology: vi.fn().mockResolvedValue({
    companyCulture: 'High-trust, engineering-led',
    recruiterHotButtons: ['M365', 'Azure', 'PowerShell']
  }),
  savePsychologyToBackend: vi.fn().mockResolvedValue({ id: 1 }),
  fetchPsychologyFromBackend: vi.fn().mockResolvedValue(null)
}));

vi.mock('../trackerService', () => ({
  saveUserApplicationToBackend: vi.fn().mockResolvedValue({ id: 1 }),
  fetchUserApplicationsFromBackend: vi.fn().mockResolvedValue([]),
  scanGmailForApplicationUpdates: vi.fn().mockResolvedValue({ updates_count: 2, updates: [] })
}));

describe('autopilotAgent background service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopAutopilot();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('builds prioritized queue correctly sorted by score', () => {
    const jobs = [
      { id: '1', title: 'IT Support', company: 'A', score: 65 },
      { id: '2', title: 'Senior Cloud Engineer', company: 'B', score: 95 },
      { id: '3', title: 'Systems Admin', company: 'C', score: 82 }
    ];

    const queue = buildPriorityQueue(jobs);
    expect(queue).toHaveLength(3);
    expect(queue[0].id).toBe('2');
    expect(queue[1].id).toBe('3');
    expect(queue[2].id).toBe('1');
  });

  it('subscribes and receives state updates', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAutopilot(listener);

    expect(listener).toHaveBeenCalled();
    const initialState = getAutopilotState();
    expect(initialState).toBeDefined();

    unsubscribe();
  });

  it('processes background queue and synthesizes assets for priority jobs', async () => {
    const jobs = [
      { id: 'job_thales', title: 'Senior Systems Engineer', company: 'Thales', score: 92 }
    ];

    startAutopilot({ jobs, profile: { name: 'Sam Ludwig' }, applications: [] });
    
    // Fast-forward initial worker timer
    await vi.advanceTimersByTimeAsync(200);

    const state = getAutopilotState();
    expect(state.stats.resumesSynthesized).toBeGreaterThanOrEqual(1);
    expect(state.readyActionDeck.length).toBeGreaterThanOrEqual(1);
    expect(state.readyActionDeck[0].company).toBe('Thales');
  });

  it('triggers autonomous Gmail scan and records recruiter status alerts', async () => {
    const result = await triggerAutonomousGmailScan({
      username: 'sam@example.com',
      appPassword: 'fake-password'
    });

    expect(result).toBeDefined();
    expect(result.updates_count).toBe(2);
    const state = getAutopilotState();
    expect(state.stats.recruiterUpdatesDetected).toBe(2);
  });
});
