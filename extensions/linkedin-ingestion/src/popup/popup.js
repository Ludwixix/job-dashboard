/**
 * Antigravity Glassmorphism Popup Controller
 * Manages dual-target connection health status, active job extraction gestures,
 * recommended feed batch scanning, settings configuration, and telemetry display.
 */

// DOM Elements
const connectionPill = document.getElementById('connection-pill');
const connectionLabel = document.getElementById('connection-label');
const pageNotice = document.getElementById('page-notice');
const pageNoticeText = document.getElementById('page-notice-text');

const btnImportCurrent = document.getElementById('btn-import-current');
const btnScanFeed = document.getElementById('btn-scan-feed');
const currentJobPreview = document.getElementById('current-job-preview');
const feedStatusPreview = document.getElementById('feed-status-preview');

const batchPanel = document.getElementById('batch-panel');
const batchCountBadge = document.getElementById('batch-count-badge');
const batchBtnCount = document.getElementById('batch-btn-count');
const btnImportBatch = document.getElementById('btn-import-batch');
const batchCardList = document.getElementById('batch-card-list');
const batchProgress = document.getElementById('batch-progress');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressText = document.getElementById('progress-text');

const toastContainer = document.getElementById('toast-container');
const toastMessage = document.getElementById('toast-message');

const btnToggleSettings = document.getElementById('btn-toggle-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const settingsDrawer = document.getElementById('settings-drawer');
const settingOverrideMode = document.getElementById('setting-override-mode');
const customUrlGroup = document.getElementById('custom-url-group');
const settingCustomUrl = document.getElementById('setting-custom-url');
const settingAuthToken = document.getElementById('setting-auth-token');
const settingUserId = document.getElementById('setting-user-id');
const btnSaveSettings = document.getElementById('btn-save-settings');
const telemetryList = document.getElementById('telemetry-list');
const linkDashboard = document.getElementById('link-dashboard');

let activeTab = null;
let currentDetectedCards = [];
let toastTimeout = null;

// Initialize Popup
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await checkActiveTab();
  await refreshBackendStatus();
  await loadRecentTelemetry();
});

function setupEventListeners() {
  btnImportCurrent.addEventListener('click', handleImportCurrent);
  btnScanFeed.addEventListener('click', handleScanFeed);
  btnImportBatch.addEventListener('click', handleImportBatch);

  btnToggleSettings.addEventListener('click', openSettings);
  btnCloseSettings.addEventListener('click', closeSettings);
  btnSaveSettings.addEventListener('click', handleSaveSettings);

  settingOverrideMode.addEventListener('change', () => {
    if (settingOverrideMode.value === 'custom') {
      customUrlGroup.classList.remove('hidden');
    } else {
      customUrlGroup.classList.add('hidden');
    }
  });

  // Listen for batch progress messages from content script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'BATCH_PROGRESS' && msg.progress) {
      updateBatchProgress(msg.progress.completed, msg.progress.total);
    }
  });
}

/**
 * Checks whether active tab is an authenticated LinkedIn Jobs page.
 */
async function checkActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) return;
    activeTab = tabs[0];

    const isLinkedInJobs = activeTab.url && activeTab.url.includes('linkedin.com/jobs');
    if (!isLinkedInJobs) {
      pageNotice.classList.remove('hidden');
      pageNoticeText.textContent = 'Please navigate to a LinkedIn job view or feed (e.g. linkedin.com/jobs/) to import.';
      btnImportCurrent.disabled = true;
      btnScanFeed.disabled = true;
    } else {
      pageNotice.classList.add('hidden');
      btnImportCurrent.disabled = false;
      btnScanFeed.disabled = false;
      updateJobPreviewFromTab(activeTab);
    }
  } catch (err) {
    console.error('Error querying active tab:', err);
  }
}

function updateJobPreviewFromTab(tab) {
  if (!tab || !tab.url) return;
  const match = tab.url.match(/(?:jobs\/view\/|currentJobId=)(\d+)/);
  if (match) {
    currentJobPreview.textContent = `Job #${match[1]} detected in active tab`;
  } else if (tab.url.includes('/collections/')) {
    currentJobPreview.textContent = 'Collection feed open';
    feedStatusPreview.textContent = 'Ready to scan collection cards';
  } else {
    currentJobPreview.textContent = 'Ready to parse active opportunity';
  }
}

/**
 * Probes backend target connectivity and updates UI badge.
 */
async function refreshBackendStatus() {
  connectionPill.className = 'status-pill status-checking';
  connectionLabel.textContent = 'Probing...';

  try {
    const res = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'CHECK_BACKEND' }, resolve);
    });

    if (!res) {
      setConnectionStatus('offline', 'Offline');
      return;
    }

    if (res.target === 'localhost') {
      setConnectionStatus('localhost', 'Localhost (8000)');
      linkDashboard.href = 'http://localhost:8000';
    } else if (res.target === 'production') {
      setConnectionStatus('production', 'Cloud Run');
      linkDashboard.href = 'https://job-dashboard-6xrdvjlrcq-ts.a.run.app';
    } else if (res.target === 'custom') {
      setConnectionStatus('production', 'Custom Backend');
      linkDashboard.href = res.url.replace(/\/api\/jobs$/, '');
    } else {
      setConnectionStatus('offline', 'Offline');
      linkDashboard.href = 'https://job-dashboard-6xrdvjlrcq-ts.a.run.app';
    }
  } catch (err) {
    setConnectionStatus('offline', 'Offline');
  }
}

function setConnectionStatus(type, label) {
  connectionPill.className = `status-pill status-${type}`;
  connectionLabel.textContent = label;
}

/**
 * Handles "Import Current Job" action.
 */
async function handleImportCurrent() {
  if (!activeTab || !activeTab.id) return;

  setButtonLoading(btnImportCurrent, true, 'Parsing...');

  try {
    // 1. Ask content script to extract current job details
    let response = await sendTabMessage(activeTab.id, { action: 'EXTRACT_CURRENT_JOB' });

    // Fallback injection if content script was not already present
    if (!response || !response.success) {
      if (!response || (response.error && response.error.includes('Receiving end does not exist'))) {
        await injectContentScript(activeTab.id);
        response = await sendTabMessage(activeTab.id, { action: 'EXTRACT_CURRENT_JOB' });
      }
    }

    if (!response || !response.success || !response.job) {
      showToast(response?.error || 'Failed to extract job details from active tab.', 'error');
      setButtonLoading(btnImportCurrent, false, 'Import Current Job');
      return;
    }

    setButtonLoading(btnImportCurrent, true, 'Ingesting...');

    // 2. Transmit job payload to service worker
    const ingestRes = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'INGEST_JOB', payload: response.job },
        resolve
      );
    });

    if (ingestRes && ingestRes.success) {
      const dupNotice = ingestRes.isDuplicate ? ' (Updated in Dashboard)' : ' (New Job Ingested)';
      showToast(`✓ ${response.job.title} at ${response.job.company}${dupNotice}`, 'success');
      currentJobPreview.textContent = `✓ Imported: ${response.job.title}`;
      await loadRecentTelemetry();
    } else {
      showToast(ingestRes?.error || 'Ingestion failed. Check backend connection.', 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    setButtonLoading(btnImportCurrent, false, 'Import Current Job');
  }
}

/**
 * Handles "Scan Recommended Feed" action.
 */
async function handleScanFeed() {
  if (!activeTab || !activeTab.id) return;

  setButtonLoading(btnScanFeed, true, 'Scanning...');

  try {
    let response = await sendTabMessage(activeTab.id, { action: 'SCAN_RECOMMENDED_FEED' });

    if (!response || !response.success) {
      if (!response || (response.error && response.error.includes('Receiving end does not exist'))) {
        await injectContentScript(activeTab.id);
        response = await sendTabMessage(activeTab.id, { action: 'SCAN_RECOMMENDED_FEED' });
      }
    }

    if (!response || !response.success || !Array.isArray(response.cards)) {
      showToast(response?.error || 'No recommendation cards found on this page.', 'error');
      return;
    }

    currentDetectedCards = response.cards;
    renderBatchPanel(currentDetectedCards);
    feedStatusPreview.textContent = `${currentDetectedCards.length} opportunities detected`;

    if (currentDetectedCards.length > 0) {
      showToast(`Found ${currentDetectedCards.length} job cards ready for import.`, 'info');
    } else {
      showToast('No job cards currently visible. Try scrolling down.', 'info');
    }
  } catch (err) {
    showToast(`Scan error: ${err.message}`, 'error');
  } finally {
    setButtonLoading(btnScanFeed, false, 'Scan Feed');
  }
}

/**
 * Renders detected feed cards in batch drawer.
 */
function renderBatchPanel(cards) {
  if (!cards || cards.length === 0) {
    batchPanel.classList.add('hidden');
    return;
  }

  batchPanel.classList.remove('hidden');
  batchCountBadge.textContent = String(cards.length);
  batchBtnCount.textContent = String(cards.length);
  batchProgress.classList.add('hidden');

  batchCardList.innerHTML = '';
  cards.forEach((card, idx) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'batch-card-item';
    itemEl.id = `batch-card-${idx}`;
    itemEl.innerHTML = `
      <div class="batch-card-info">
        <span class="batch-card-title">${escapeHtml(card.title)}</span>
        <span class="batch-card-company">${escapeHtml(card.company)} • ${escapeHtml(card.location)}</span>
      </div>
      <span class="batch-card-status pending" id="batch-status-${idx}">Ready</span>
    `;
    batchCardList.appendChild(itemEl);
  });
}

/**
 * Handles "Import All Batch" action with polite pacing.
 */
async function handleImportBatch() {
  if (!activeTab || !activeTab.id || currentDetectedCards.length === 0) return;

  btnImportBatch.disabled = true;
  batchProgress.classList.remove('hidden');
  updateBatchProgress(0, currentDetectedCards.length);

  try {
    const res = await sendTabMessage(activeTab.id, {
      action: 'INGEST_BATCH_CARDS',
      cards: currentDetectedCards
    });

    if (res && res.success) {
      showToast(`✓ Batch import finished: ${res.imported} / ${res.total} jobs synchronized.`, 'success');
      await loadRecentTelemetry();
    } else {
      showToast(res?.error || 'Batch import failed.', 'error');
    }
  } catch (err) {
    showToast(`Batch error: ${err.message}`, 'error');
  } finally {
    btnImportBatch.disabled = false;
  }
}

function updateBatchProgress(completed, total) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  progressBarFill.style.width = `${pct}%`;
  progressText.textContent = `Pacing ${completed} / ${total} (${pct}%)...`;

  // Update card item status in list
  for (let i = 0; i < completed; i++) {
    const statusEl = document.getElementById(`batch-status-${i}`);
    if (statusEl && !statusEl.classList.contains('success')) {
      statusEl.className = 'batch-card-status success';
      statusEl.textContent = 'Imported';
    }
  }
}

/**
 * Settings Drawer management
 */
async function openSettings() {
  settingsDrawer.classList.remove('hidden');
  try {
    const res = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'GET_SETTINGS' }, resolve);
    });
    if (res && res.settings) {
      settingOverrideMode.value = res.settings.overrideMode || 'auto';
      settingCustomUrl.value = res.settings.customBackendUrl || '';
      settingAuthToken.value = res.settings.authToken || '';
      settingUserId.value = res.settings.userId || '';

      if (res.settings.overrideMode === 'custom') {
        customUrlGroup.classList.remove('hidden');
      } else {
        customUrlGroup.classList.add('hidden');
      }
    }
    await loadRecentTelemetry();
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

function closeSettings() {
  settingsDrawer.classList.add('hidden');
}

async function handleSaveSettings() {
  const newSettings = {
    overrideMode: settingOverrideMode.value,
    customBackendUrl: settingCustomUrl.value.trim(),
    authToken: settingAuthToken.value.trim(),
    userId: settingUserId.value.trim()
  };

  try {
    await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'SAVE_SETTINGS', settings: newSettings }, resolve);
    });
    showToast('Settings saved successfully.', 'success');
    closeSettings();
    await refreshBackendStatus();
  } catch (err) {
    showToast(`Error saving settings: ${err.message}`, 'error');
  }
}

/**
 * Loads recent telemetry records into settings drawer.
 */
async function loadRecentTelemetry() {
  try {
    const res = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'GET_IMPORT_HISTORY' }, resolve);
    });

    if (res && Array.isArray(res.history) && res.history.length > 0) {
      telemetryList.innerHTML = '';
      res.history.slice(0, 8).forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'telemetry-item';
        itemEl.innerHTML = `
          <span class="telemetry-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</span>
          <span class="telemetry-badge">${escapeHtml(item.target || 'backend')}</span>
        `;
        telemetryList.appendChild(itemEl);
      });
    } else {
      telemetryList.innerHTML = '<div class="telemetry-empty">No recent imports recorded.</div>';
    }
  } catch (err) {
    console.error('Failed to load telemetry:', err);
  }
}

/**
 * Toast notification banner helper
 */
function showToast(message, type = 'info') {
  if (toastTimeout) clearTimeout(toastTimeout);

  toastMessage.textContent = message;
  toastMessage.className = `toast toast-${type}`;
  toastContainer.classList.remove('hidden');

  toastTimeout = setTimeout(() => {
    toastContainer.classList.add('hidden');
  }, 4000);
}

function setButtonLoading(btn, isLoading, defaultText) {
  const spinner = btn.querySelector('.btn-spinner');
  const text = btn.querySelector('.btn-text');
  if (isLoading) {
    btn.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (text) text.textContent = defaultText;
  } else {
    btn.disabled = false;
    if (spinner) spinner.classList.add('hidden');
    if (text) text.textContent = defaultText;
  }
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response);
      }
    });
  });
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content/content-script.js']
    });
  } catch (err) {
    console.warn('Script injection failed:', err);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
