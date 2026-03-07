import { installMockApi } from './mock-api.js'

installMockApi()

const BASE = '/api/elements'

async function handle(res) {
  if (!res.ok) {
    let msg = `请求失败 (${res.status})`
    try {
      const err = await res.json()
      if (err?.message) msg = err.message
    } catch {}
    throw new Error(msg)
  }
  return res.json()
}

export async function fetchElementsApi() {
  const res = await fetch(BASE)
  return handle(res)
}

export async function createElementApi(payload) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handle(res)
}

export async function updateElementApi(id, payload) {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handle(res)
}

export async function deleteElementApi(id) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  return handle(res)
}

export async function replaceElementsApi(list) {
  const res = await fetch(BASE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(list),
  })
  return handle(res)
}
