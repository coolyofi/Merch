/**
 * api.js — real backend client (no mock fallback)
 */
const BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8787').replace(/\/$/, '')

function headers(token) {
  const h = { 'Content-Type': 'application/json' }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

async function request(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(token),
    body: body ? JSON.stringify(body) : undefined,
  })
  const isJson = (res.headers.get('content-type') || '').includes('application/json')
  const payload = isJson ? await res.json() : await res.text()
  if (!res.ok) {
    const msg = typeof payload === 'object' && payload?.message ? payload.message : `${method} ${path} failed`
    throw new Error(msg)
  }
  return payload
}

export function getApiBase() {
  return BASE
}

export async function login(email, password) {
  return request('/auth/login', { method: 'POST', body: { email, password } })
}

export async function register({ email, password, name, storeName }) {
  return request('/auth/register', { method: 'POST', body: { email, password, name, storeName } })
}

export async function fetchMe(token) {
  return request('/auth/me', { token })
}

export async function fetchLayouts(token, storeId) {
  const q = storeId ? `?storeId=${encodeURIComponent(storeId)}` : ''
  return request(`/layouts${q}`, { token })
}

export async function createLayout(token, payload) {
  return request('/layouts', { method: 'POST', token, body: payload })
}

export async function fetchLayoutVersions(token, layoutId) {
  return request(`/layouts/${layoutId}/versions`, { token })
}

export async function fetchLayoutVersion(token, layoutId, versionId) {
  return request(`/layouts/${layoutId}/versions/${versionId}`, { token })
}

export async function createLayoutVersion(token, layoutId, payload) {
  return request(`/layouts/${layoutId}/versions`, { method: 'POST', token, body: payload })
}

export async function replayLayoutVersion(token, layoutId, payload) {
  return request(`/layouts/${layoutId}/replay`, { method: 'POST', token, body: payload })
}

export async function fetchRules(token) {
  return request('/rules', { token })
}

export async function createRule(token, payload) {
  return request('/rules', { method: 'POST', token, body: payload })
}

export async function updateRuleStatus(token, ruleId, status) {
  return request(`/rules/${ruleId}/status`, { method: 'POST', token, body: { status } })
}
