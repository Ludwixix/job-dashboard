/**
 * Centralized API client for the frontend application.
 * Manages base URL resolution, authorization headers, and unified error handling.
 */
import { getBackendApiBase } from '../services/apiConfig';

export const getAuthToken = () => {
  try {
    return localStorage.getItem('job_dashboard_auth_token') || '';
  } catch {
    return '';
  }
};

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Standard request wrapper
 */
export async function apiRequest(path, options = {}) {
  const baseUrl = options.baseUrl !== undefined ? options.baseUrl : getBackendApiBase();
  const url = path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  
  const headers = {
    'Accept': 'application/json',
    ...(options.body && typeof options.body === 'object' && !(options.body instanceof FormData) 
      ? { 'Content-Type': 'application/json' } 
      : {}),
    ...options.headers,
  };

  const token = getAuthToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = {
    ...options,
    headers,
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    let errorData = null;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text().catch(() => null);
    }
    const message = (errorData && (errorData.message || errorData.error)) || `API request failed with status ${response.status}`;
    throw new ApiError(message, response.status, errorData);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }
  return await response.text();
}
