/**
 * Splito API Client
 * Centralises all fetch calls, auth headers, and error handling.
 */

const API_BASE = 'https://splito-nghk.onrender.com/api';

// ── Token store ────────────────────────────────────────────────────────────
const Auth = {
  getToken: () => localStorage.getItem('splito_token'),
  setToken: (t) => localStorage.setItem('splito_token', t),
  clear: () => { localStorage.removeItem('splito_token'); localStorage.removeItem('splito_user'); },
  getUser: () => { try { return JSON.parse(localStorage.getItem('splito_user')); } catch { return null; } },
  setUser: (u) => localStorage.setItem('splito_user', JSON.stringify(u)),
};

// ── Core fetch helper ──────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

// ── Auth ───────────────────────────────────────────────────────────────────
const AuthAPI = {
  register: (data) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => apiFetch('/auth/me'),
};

// ── Groups ─────────────────────────────────────────────────────────────────
const GroupsAPI = {
  list: () => apiFetch('/groups'),
  create: (data) => apiFetch('/groups', { method: 'POST', body: JSON.stringify(data) }),
  get: (id) => apiFetch(`/groups/${id}`),
  join: (code) => apiFetch('/groups/join', { method: 'POST', body: JSON.stringify({ invite_code: code }) }),
  leave: (id) => apiFetch(`/groups/${id}/leave`, { method: 'DELETE' }),
  balances: (id) => apiFetch(`/groups/${id}/balances`),
};

// ── Expenses ───────────────────────────────────────────────────────────────
const ExpensesAPI = {
  list: () => apiFetch('/expenses'),
  listGroup: (gid) => apiFetch(`/expenses/group/${gid}`),
  add: (data) => apiFetch('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  get: (id) => apiFetch(`/expenses/${id}`),
  delete: (id) => apiFetch(`/expenses/${id}`, { method: 'DELETE' }),
  settle: (id) => apiFetch(`/expenses/${id}/settle`, { method: 'PATCH' }),
};

// ── Insights ───────────────────────────────────────────────────────────────
const InsightsAPI = {
  get: () => apiFetch('/insights'),
  group: (id) => apiFetch(`/insights/group/${id}`),
};

// ── Analytics ──────────────────────────────────────────────────────────────
const AnalyticsAPI = {
  overview: (days = 30) => apiFetch(`/analytics/overview?days=${days}`),
  group: (id, days) => apiFetch(`/analytics/group/${id}?days=${days}`),
  categories: (days = 30) => apiFetch(`/analytics/categories?days=${days}`),
  trends: () => apiFetch('/analytics/trends'),
};

// ── Payments ───────────────────────────────────────────────────────────────
const PaymentsAPI = {
  record: (data) => apiFetch('/payments', { method: 'POST', body: JSON.stringify(data) }),
  group: (id) => apiFetch(`/payments/group/${id}`),
};

// ── Exports ────────────────────────────────────────────────────────────────
window.Auth = Auth;
window.AuthAPI = AuthAPI;
window.GroupsAPI = GroupsAPI;
window.ExpensesAPI = ExpensesAPI;
window.InsightsAPI = InsightsAPI;
window.AnalyticsAPI = AnalyticsAPI;
window.PaymentsAPI = PaymentsAPI;
