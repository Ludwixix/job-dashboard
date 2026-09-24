/**
 * Storage & Cache Management for Extension
 * Handles persistent cache of imported jobs, user preferences, custom backend URLs, and telemetry
 * using chrome.storage.local.
 */

const STORAGE_KEYS = {
  IMPORT_HISTORY: 'importHistory',
  IMPORTED_IDS: 'importedIds',
  CUSTOM_BACKEND_URL: 'customBackendUrl',
  OVERRIDE_MODE: 'overrideMode',
  AUTH_TOKEN: 'authToken',
  USER_ID: 'userId',
  PENDING_QUEUE: 'pendingQueue',
  LAST_TARGET: 'lastTarget'
};

/**
 * Retrieves user settings from local storage.
 * @returns {Promise<Object>}
 */
export async function getSettings() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return {
      customBackendUrl: '',
      overrideMode: 'auto',
      authToken: '',
      userId: ''
    };
  }

  const data = await chrome.storage.local.get([
    STORAGE_KEYS.CUSTOM_BACKEND_URL,
    STORAGE_KEYS.OVERRIDE_MODE,
    STORAGE_KEYS.AUTH_TOKEN,
    STORAGE_KEYS.USER_ID
  ]);

  return {
    customBackendUrl: data[STORAGE_KEYS.CUSTOM_BACKEND_URL] || '',
    overrideMode: data[STORAGE_KEYS.OVERRIDE_MODE] || 'auto',
    authToken: data[STORAGE_KEYS.AUTH_TOKEN] || '',
    userId: data[STORAGE_KEYS.USER_ID] || ''
  };
}

/**
 * Saves user settings to local storage.
 * @param {Object} settings
 * @returns {Promise<void>}
 */
export async function saveSettings(settings = {}) {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;

  const toSave = {};
  if (settings.customBackendUrl !== undefined) toSave[STORAGE_KEYS.CUSTOM_BACKEND_URL] = settings.customBackendUrl;
  if (settings.overrideMode !== undefined) toSave[STORAGE_KEYS.OVERRIDE_MODE] = settings.overrideMode;
  if (settings.authToken !== undefined) toSave[STORAGE_KEYS.AUTH_TOKEN] = settings.authToken;
  if (settings.userId !== undefined) toSave[STORAGE_KEYS.USER_ID] = settings.userId;

  await chrome.storage.local.set(toSave);
}

/**
 * Records a successful job import in storage.
 * @param {Object} job
 * @param {string} target
 * @returns {Promise<void>}
 */
export async function recordImport(job, target) {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;

  const data = await chrome.storage.local.get([
    STORAGE_KEYS.IMPORT_HISTORY,
    STORAGE_KEYS.IMPORTED_IDS
  ]);

  const history = data[STORAGE_KEYS.IMPORT_HISTORY] || [];
  const importedIds = data[STORAGE_KEYS.IMPORTED_IDS] || {};

  const record = {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    target,
    url: job.url,
    timestamp: new Date().toISOString()
  };

  importedIds[job.id] = record;
  const updatedHistory = [record, ...history.filter(h => h.id !== job.id)].slice(0, 50);

  await chrome.storage.local.set({
    [STORAGE_KEYS.IMPORT_HISTORY]: updatedHistory,
    [STORAGE_KEYS.IMPORTED_IDS]: importedIds,
    [STORAGE_KEYS.LAST_TARGET]: target
  });
}

/**
 * Checks whether a job has already been imported.
 * @param {string} jobId
 * @returns {Promise<boolean>}
 */
export async function isJobImported(jobId) {
  if (!jobId || typeof chrome === 'undefined' || !chrome.storage?.local) return false;
  const data = await chrome.storage.local.get([STORAGE_KEYS.IMPORTED_IDS]);
  const importedIds = data[STORAGE_KEYS.IMPORTED_IDS] || {};
  return Boolean(importedIds[jobId]);
}

/**
 * Retrieves the full import history list.
 * @returns {Promise<Array<Object>>}
 */
export async function getImportHistory() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return [];
  const data = await chrome.storage.local.get([STORAGE_KEYS.IMPORT_HISTORY]);
  return data[STORAGE_KEYS.IMPORT_HISTORY] || [];
}

/**
 * Queues a job for pending retry when backends are offline.
 * @param {Object} job
 * @returns {Promise<void>}
 */
export async function addToPendingQueue(job) {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  const data = await chrome.storage.local.get([STORAGE_KEYS.PENDING_QUEUE]);
  const queue = data[STORAGE_KEYS.PENDING_QUEUE] || [];
  if (!queue.some(item => (item.job?.id || item.id) === job.id)) {
    queue.push({ job, addedAt: new Date().toISOString() });
    await chrome.storage.local.set({ [STORAGE_KEYS.PENDING_QUEUE]: queue });
  }
}

/**
 * Retrieves and clears the pending retry queue.
 * @returns {Promise<Array<Object>>}
 */
export async function flushPendingQueue() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return [];
  const data = await chrome.storage.local.get([STORAGE_KEYS.PENDING_QUEUE]);
  const queue = data[STORAGE_KEYS.PENDING_QUEUE] || [];
  await chrome.storage.local.remove([STORAGE_KEYS.PENDING_QUEUE]);
  return queue;
}
