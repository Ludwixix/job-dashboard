import { API_BASE } from './apiConfig';

const authHeaders = () => {
  const token = localStorage.getItem('job_dashboard_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), 'Content-Type': 'application/json', ...options.headers },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Career operations request failed');
  return payload;
};

export const getSavedSearches = () => request('/api/saved-searches');
export const saveSearch = (name, query) => request('/api/saved-searches', { method: 'POST', body: JSON.stringify({ name, query }) });
export const getReminders = () => request('/api/reminders?include_future=true');
export const createReminder = (jobId, reminderType, remindAt, details = {}) => request('/api/reminders', { method: 'POST', body: JSON.stringify({ job_id: jobId, reminder_type: reminderType, remind_at: remindAt, details }) });
export const dismissReminder = (id) => request('/api/reminders/dismiss', { method: 'POST', body: JSON.stringify({ id }) });
export const getSourceHealth = () => request('/api/source-health');
export const getJobExplanation = (jobId) => request(`/api/job-explanation?job_id=${encodeURIComponent(jobId)}`);