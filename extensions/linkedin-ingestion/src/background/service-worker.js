/**
 * Background Service Worker (Manifest V3)
 * Module-type worker handling top-level synchronous listeners,
 * CORS-exempt dual-target backend routing, and persistent storage synchronization.
 */

import { getResolvedBackend, handleJobIngest } from './api-bridge.js';
import {
  getSettings,
  saveSettings,
  getImportHistory,
  flushPendingQueue
} from './storage.js';

// Top-level synchronous listener for extension lifecycle events
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[Job Dashboard Ingestion] Extension installed / updated: ${details.reason}`);
  const settings = await getSettings();
  if (!settings.overrideMode) {
    await saveSettings({ overrideMode: 'auto', customBackendUrl: '' });
  }
});

// Top-level synchronous message listener registration
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) {
    return false;
  }

  // 1. Connection Health / Target Probe
  if (message.action === 'CHECK_BACKEND') {
    getResolvedBackend()
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ target: 'offline', healthy: false, error: err.message }));
    return true; // Keep channel open
  }

  // 2. Ingest Single Job
  if (message.action === 'INGEST_JOB') {
    handleJobIngest(message.payload)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open
  }

  // 3. Retrieve Import History
  if (message.action === 'GET_IMPORT_HISTORY') {
    getImportHistory()
      .then(history => sendResponse({ success: true, history }))
      .catch(err => sendResponse({ success: false, history: [], error: err.message }));
    return true; // Keep channel open
  }

  // 4. Retrieve User Settings
  if (message.action === 'GET_SETTINGS') {
    getSettings()
      .then(settings => sendResponse({ success: true, settings }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open
  }

  // 5. Save User Settings
  if (message.action === 'SAVE_SETTINGS') {
    saveSettings(message.settings)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open
  }

  // 6. Flush / Retry Pending Queue
  if (message.action === 'FLUSH_PENDING_QUEUE') {
    (async () => {
      try {
        const queue = await flushPendingQueue();
        const results = [];
        for (const item of queue) {
          const res = await handleJobIngest(item.job);
          results.push({ id: item.job?.id, success: res.success });
        }
        sendResponse({ success: true, processed: results.length, results });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep channel open
  }

  return false;
});
