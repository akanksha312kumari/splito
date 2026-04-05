// Central API client — attaches JWT automatically and handles 401 auto-logout
const BASE = import.meta.env.VITE_API_URL || '/api';

let _onUnauthorized = null;
export function setUnauthorizedHandler(fn) { _onUnauthorized = fn; }

function getToken() {
  return localStorage.getItem('splito_token');
}

async function request(method, path, body, isFormData = false) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  // Auto-logout on 401
  if (res.status === 401) {
    localStorage.removeItem('splito_token');
    _onUnauthorized?.();
    throw new Error('Session expired. Please sign in again.');
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  delete: (path)        => request('DELETE', path),
  upload: (path, form)  => request('POST',   path, form, true),
};
