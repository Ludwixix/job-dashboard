/**
 * apiConfig.js
 * Centralized API Base URL resolver for local dev, test environments, and Cloud Run production.
 * Respects VITE_API_BASE_URL environment variable when available.
 */
export const getBackendApiBase = () => {
  // Check if env var is set during build (Vite will replace __API_BASE_URL__)
  const envUrl = typeof __API_BASE_URL__ !== 'undefined' ? __API_BASE_URL__ : '';
  if (envUrl) return envUrl;
  
  if (typeof window === 'undefined' || !window.location || !window.location.origin) {
    return 'http://127.0.0.1:8787';
  }
  
  // In the browser, prefer window.location.origin so all requests are same-origin
  if (window.location.origin && window.location.origin !== 'null') {
    return window.location.origin;
  }
  
  // Production fallback: use Cloud Run endpoint
  return 'https://job-dashboard-6xrdvjlrcq-ts.a.run.app';
};

export const API_BASE = getBackendApiBase();
