/**
 * apiConfig.js
 * Centralized API Base URL resolver for local dev, test environments, and Cloud Run production.
 */
export const getBackendApiBase = () => {
  if (typeof window === 'undefined' || !window.location || !window.location.origin) {
    return 'http://127.0.0.1:8787';
  }
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return window.location.origin;
  }
  return 'https://job-dashboard-6xrdvjlrcq-ts.a.run.app';
};
