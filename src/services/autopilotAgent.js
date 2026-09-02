/**
 * autopilotAgent.js
 * Autonomous Background AI Engine
 * 
 * Takes care of business quietly behind the scenes:
 * 1. Screens and computes match scores for scraped job opportunities.
 * 2. Asynchronously synthesizes tailored resumes and bespoke cover letters for high-conviction matches.
 * 3. Asynchronously decodes employer psychology, hiring manager priorities, and hidden pain points.
 * 4. Tallies and organizes the application pipeline, tracking recruiter touchpoints and follow-up deadlines.
 * 5. Caches all generated assets to the backend SQLite database and local memory.
 */

import { generateApplicationDocs, generateClientSideTailoredDocs, saveDocumentToBackend, fetchDocumentFromBackend } from './generationService';
import { fetchJobPsychology, savePsychologyToBackend, fetchPsychologyFromBackend } from './psychologyService';
import { saveUserApplicationToBackend, fetchUserApplicationsFromBackend, scanGmailForApplicationUpdates } from './trackerService';
import { getActiveProfile } from './profileService';

const LISTENERS = new Set();

let state = {
  isRunning: false,
  activeTask: 'idle',
  activeJobTitle: '',
  stats: {
    screenedJobs: 0,
    resumesSynthesized: 0,
    coverLettersSynthesized: 0,
    psychProfilesBaked: 0,
    applicationsTallied: 0,
    recruiterUpdatesDetected: 0
  },
  activityLog: [
    {
      id: 'init',
      timestamp: new Date().toISOString(),
      type: 'info',
      message: 'Autonomous AI Auto-Pilot initialized in background.'
    }
  ],
  readyActionDeck: []
};

let workerTimer = null;
let currentQueue = [];

/**
 * Notifies all subscribed UI components of state changes.
 */
const notifyListeners = () => {
  const snapshot = { ...state, stats: { ...state.stats }, activityLog: [...state.activityLog], readyActionDeck: [...state.readyActionDeck] };
  LISTENERS.forEach(listener => {
    try {
      listener(snapshot);
    } catch (e) {
      console.warn('AutoPilot listener notification error:', e);
    }
  });
};

/**
 * Appends an activity log message and trims older entries.
 */
const addLogEntry = (type, message, metadata = {}) => {
  const entry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    type,
    message,
    metadata
  };
  state.activityLog = [entry, ...state.activityLog.slice(0, 49)];
  notifyListeners();
};

/**
 * Subscribes to reactive AutoPilot state updates.
 */
export const subscribeAutopilot = (listener) => {
  LISTENERS.add(listener);
  listener({ ...state, stats: { ...state.stats }, activityLog: [...state.activityLog], readyActionDeck: [...state.readyActionDeck] });
  return () => {
    LISTENERS.delete(listener);
  };
};

/**
 * Returns current AutoPilot snapshot.
 */
export const getAutopilotState = () => ({
  ...state,
  stats: { ...state.stats },
  activityLog: [...state.activityLog],
  readyActionDeck: [...state.readyActionDeck]
});

/**
 * Builds the prioritized queue of jobs that require background synthesis.
 */
export const buildPriorityQueue = (jobs = [], profile = null) => {
  if (!Array.isArray(jobs) || jobs.length === 0) return [];

  // Filter out corrupted jobs and sort by score descending
  const validJobs = jobs.filter(j => j && (j.title || j.company));
  const scored = validJobs.map(job => {
    const score = Number(job.score ?? job.match_score ?? 60);
    return { ...job, priorityScore: score };
  });

  scored.sort((a, b) => b.priorityScore - a.priorityScore);

  // Focus queue on top high-conviction matches (top 20)
  return scored.slice(0, 20);
};

/**
 * Executes a single task step from the autonomous queue.
 */
const processNextTask = async (profile) => {
  if (!state.isRunning || currentQueue.length === 0) {
    state.activeTask = 'monitoring';
    state.activeJobTitle = '';
    notifyListeners();
    return;
  }

  const job = currentQueue.shift();
  const jobId = job.id || `${job.company}_${job.title}`;
  const company = job.company || 'Target Employer';
  const title = job.title || 'Role';

  state.activeTask = `Synthesizing tailored pitch & psychology for ${company}`;
  state.activeJobTitle = `${title} @ ${company}`;
  notifyListeners();

  try {
    // 1. Check & pre-synthesize tailored documents
    let existingDoc = await fetchDocumentFromBackend(jobId, 'resume').catch(() => null);
    if (!existingDoc) {
      // Synthesize tailored assets asynchronously with fallback
      let assets = null;
      try {
        assets = await generateApplicationDocs(job, null, null, profile);
      } catch (genErr) {
        // Fall back gracefully to deterministic expert synthesis if API key is not yet set
        assets = generateClientSideTailoredDocs(job, profile);
      }

      if (assets && assets.resume) {
        await saveDocumentToBackend(jobId, 'resume', assets.resume, assets.model || 'expert-synthesis', { title, company });
        state.stats.resumesSynthesized += 1;
      }
      if (assets && assets.coverLetter) {
        await saveDocumentToBackend(jobId, 'cover_letter', assets.coverLetter, assets.model || 'expert-synthesis', { title, company });
        state.stats.coverLettersSynthesized += 1;
      }

      addLogEntry('generation', `Synthesized bespoke resume & cover letter for ${title} at ${company}.`, { jobId, company, title });
    }

    // 2. Check & pre-decode employer psychology
    let existingPsych = await fetchPsychologyFromBackend(jobId).catch(() => null);
    if (!existingPsych) {
      const psychData = await fetchJobPsychology({
        job,
        profile
      });
      if (psychData) {
        await savePsychologyToBackend(jobId, company, title, psychData, 'psych-decoder-v3');
        state.stats.psychProfilesBaked += 1;
        addLogEntry('psychology', `Decoded hiring manager psychology & interview angles for ${company}.`, { jobId, company });
      }
    }

    // 3. Add to ready action deck
    const deckItem = {
      ...job,
      jobId,
      isPreTailored: true,
      readyAt: new Date().toISOString()
    };
    
    // Avoid duplicate cards in ready deck
    if (!state.readyActionDeck.some(d => (d.id || d.jobId) === jobId)) {
      state.readyActionDeck = [deckItem, ...state.readyActionDeck].slice(0, 15);
    }

    state.stats.screenedJobs += 1;
  } catch (err) {
    console.warn(`AutoPilot task skipped for ${company} (${title}):`, err);
  }

  notifyListeners();

  // Schedule next item with smooth throttle (500ms delay to keep CPU calm)
  if (state.isRunning && currentQueue.length > 0) {
    workerTimer = setTimeout(() => {
      processNextTask(profile);
    }, 500);
  } else {
    state.activeTask = 'monitoring';
    state.activeJobTitle = '';
    addLogEntry('success', `All high-conviction opportunities tailored and ready for review.`);
    notifyListeners();
  }
};

/**
 * Starts the Autonomous Background Agent.
 */
export const startAutopilot = ({ jobs = [], profile = null, applications = [] } = {}) => {
  if (state.isRunning) return;

  const activeProf = profile || getActiveProfile();
  state.isRunning = true;
  state.activeTask = 'indexing';
  
  if (Array.isArray(applications)) {
    state.stats.applicationsTallied = applications.length;
  }

  currentQueue = buildPriorityQueue(jobs, activeProf);
  addLogEntry('start', `Autonomous Auto-Pilot started. Queued ${currentQueue.length} priority opportunities for automated preparation.`);
  notifyListeners();

  // Start asynchronous queue execution
  workerTimer = setTimeout(() => {
    processNextTask(activeProf);
  }, 100);
};

/**
 * Stops the Autonomous Background Agent.
 */
export const stopAutopilot = () => {
  state.isRunning = false;
  state.activeTask = 'paused';
  if (workerTimer) {
    clearTimeout(workerTimer);
    workerTimer = null;
  }
  addLogEntry('pause', 'Autonomous Auto-Pilot paused.');
  notifyListeners();
};

/**
 * Triggers an autonomous Gmail application scan in the background.
 */
export const triggerAutonomousGmailScan = async ({ username, appPassword, days = 14 } = {}) => {
  if (!username || !appPassword) return null;

  state.activeTask = 'Scanning Gmail for recruiter updates';
  notifyListeners();

  try {
    const result = await scanGmailForApplicationUpdates({ username, appPassword, days });
    if (result && result.updates_count > 0) {
      state.stats.recruiterUpdatesDetected += result.updates_count;
      addLogEntry('email_alert', `Detected ${result.updates_count} recruiter application updates via Gmail radar.`);
    } else {
      addLogEntry('info', `Gmail radar scan completed. No new recruiter status changes.`);
    }
    state.activeTask = 'monitoring';
    notifyListeners();
    return result;
  } catch (err) {
    addLogEntry('warning', `Gmail radar scan encountered an error: ${err.message || err}`);
    state.activeTask = 'monitoring';
    notifyListeners();
    return null;
  }
};
