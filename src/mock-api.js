/**
 * mock-api.js
 * Intercepts fetch calls to /api/elements and serves an in-browser mock backed by localStorage.
 */
import { ELEMENTS_SEED } from './elements-db.js'

const STORAGE_KEY = 'merch-elements-store-v1'
let installed = false
let cache = null

function loadStore() {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) cache = JSON.parse(raw)
  } catch (e) {
    console.warn('[mock-api] load failed, using seed', e)
  }
  if (!Array.isArray(cache) || !cache.length) cache = [...ELEMENTS_SEED]
  return cache
}

function persist(items) {
  cache = items
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch (e) {
    console.warn('[mock-api] persist failed', e)
  }
  return cache
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function notFound() { return jsonResponse({ message: 'Not found' }, 404) }

async function parseBody(init = {}) {
  if (!init.body) return {}
  try { return JSON.parse(init.body) } catch { return {} }
}

function handleGet() {
  return jsonResponse(loadStore())
}

async function handlePost(init) {
  const body = await parseBody(init)
  const item = body || {}
  if (!item.id) item.id = `el-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`
  const items = loadStore()
  if (items.find(e => e.id === item.id)) return jsonResponse({ message: 'ID already exists' }, 400)
  items.push(item)
  persist(items)
  return jsonResponse(item, 201)
}

async function handlePut(pathname, init) {
  const parts = pathname.split('/').filter(Boolean) // [api, elements, :id?]
  const id = parts[2]
  const body = await parseBody(init)
  if (id) {
    // update single element
    const items = loadStore()
    const idx = items.findIndex(e => e.id === id)
    if (idx === -1) return notFound()
    items[idx] = { ...items[idx], ...body, id }
    persist(items)
    return jsonResponse(items[idx])
  }
  // replace all
  if (!Array.isArray(body)) return jsonResponse({ message: 'PUT body must be array' }, 400)
  persist(body)
  return jsonResponse({ ok: true, count: body.length })
}

async function handlePatch(pathname, init) {
  const parts = pathname.split('/').filter(Boolean)
  const id = parts[2]
  if (!id) return jsonResponse({ message: 'PATCH requires id' }, 400)
  const body = await parseBody(init)
  const items = loadStore()
  const idx = items.findIndex(e => e.id === id)
  if (idx === -1) return notFound()
  items[idx] = { ...items[idx], ...body, id }
  persist(items)
  return jsonResponse(items[idx])
}

function handleDelete(pathname) {
  const parts = pathname.split('/').filter(Boolean)
  const id = parts[2]
  if (!id) return jsonResponse({ message: 'DELETE requires id' }, 400)
  const items = loadStore()
  const next = items.filter(e => e.id !== id)
  if (next.length === items.length) return notFound()
  persist(next)
  return jsonResponse({ ok: true })
}

function isElementsApi(pathname) {
  return pathname === '/api/elements' || pathname.startsWith('/api/elements/')
}

export function installMockApi() {
  if (installed || typeof window === 'undefined') return
  installed = true
  const nativeFetch = window.fetch.bind(window)

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || ''
    const { pathname } = new URL(url, window.location.origin)
    if (!isElementsApi(pathname)) return nativeFetch(input, init)

    const method = (init.method || 'GET').toUpperCase()
    try {
      switch (method) {
        case 'GET':    return handleGet()
        case 'POST':   return handlePost(init)
        case 'PUT':    return handlePut(pathname, init)
        case 'PATCH':  return handlePatch(pathname, init)
        case 'DELETE': return handleDelete(pathname)
        default:       return jsonResponse({ message: 'Method not allowed' }, 405)
      }
    } catch (e) {
      console.error('[mock-api] error', e)
      return jsonResponse({ message: e.message || 'Unknown error' }, 500)
    }
  }
}

// Auto-install for convenience when imported
installMockApi()
