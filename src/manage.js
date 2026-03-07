import { installMockApi } from './mock-api.js'
import {
  fetchElementsApi,
  createElementApi,
  updateElementApi,
  deleteElementApi,
  replaceElementsApi,
} from './elements-service.js'

installMockApi()

let elements = []
let editingId = null
let unlocked = false
const AUTH_CODE = '4ppleDemo810'
let searchTerm = ''
let showHidden = false

document.addEventListener('DOMContentLoaded', () => {
  bindEvents()
  loadElements()
})

function bindEvents() {
  document.getElementById('element-form')?.addEventListener('submit', onSubmit)
  document.getElementById('btn-refresh')?.addEventListener('click', loadElements)
  document.getElementById('btn-reset-form')?.addEventListener('click', resetForm)
  document.getElementById('btn-export')?.addEventListener('click', exportJson)
  document.getElementById('btn-import')?.addEventListener('click', importJson)
  document.getElementById('btn-fill-current')?.addEventListener('click', fillImportBox)
  document.getElementById('form-delete-btn')?.addEventListener('click', onDelete)
  document.getElementById('auth-btn')?.addEventListener('click', unlock)
  document.getElementById('manage-search')?.addEventListener('input', e => {
    searchTerm = e.target.value.trim().toLowerCase()
    renderList()
  })
  document.getElementById('toggle-hidden')?.addEventListener('change', e => {
    showHidden = e.target.checked
    renderList()
  })
}

function unlock() {
  const input = document.getElementById('auth-code')
  const status = document.getElementById('auth-status')
  const val = (input?.value || '').trim()
  if (val === AUTH_CODE) {
    unlocked = true
    status.textContent = '已解锁'
    status.style.background = 'rgba(16,185,129,0.16)'
  } else {
    unlocked = false
    status.textContent = '授权码错误'
    status.style.background = 'rgba(248,113,113,0.16)'
  }
}

function guardWrite() {
  if (unlocked) return true
  alert('请输入正确的授权码后再编辑。')
  return false
}

async function loadElements() {
  setLoading(true)
  try {
    elements = await fetchElementsApi()
    renderList()
  } catch (e) {
    alert(`加载元素失败：${e.message}`)
  } finally {
    setLoading(false)
  }
}

function renderList() {
  const listEl = document.getElementById('manage-list')
  if (!listEl) return
  if (!elements.length) {
    listEl.innerHTML = '<p class="summary-empty">暂无元素。</p>'
    return
  }

  const filtered = elements.filter(el => {
    const text = `${el.name || ''} ${el.id || ''} ${el.family || ''} ${el.sku || ''} ${(el.tags || []).join(' ')}`.toLowerCase()
    const match = !searchTerm || text.includes(searchTerm)
    const hiddenOk = showHidden ? true : !el.hidden
    return match && hiddenOk
  })

  if (!filtered.length) {
    listEl.innerHTML = '<p class="summary-empty">未找到匹配的元素。</p>'
    return
  }

  listEl.innerHTML = filtered.map(el => `
    <div class="manage-card ${el.hidden ? 'hidden' : ''}" data-id="${el.id}">
      <div class="manage-card-head">
        <div class="manage-card-name">${el.name || '(未命名)'}</div>
        <span class="pill pill-${el.type || 'product'}">${el.type || 'product'}</span>
      </div>
      <div class="manage-meta">ID: ${el.id}</div>
      <div class="manage-meta">Family: ${el.family || '—'} · SKU: ${el.sku || '—'}</div>
      <div class="manage-meta">${el.width}" × ${el.depth}" × ${el.height || 0}"</div>
      <div class="manage-meta">允许改宽度：${el.allowWidthOverride ? '是' : '否'}</div>
      <div class="manage-tags">${(el.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}</div>
      ${el.imageUrl ? `<div class="manage-thumb"><img src="${el.imageUrl}" alt="${el.name}"/></div>` : ''}
      <div class="manage-card-actions">
        <button class="btn-ghost sm" data-action="edit" data-id="${el.id}">编辑</button>
        <button class="btn-ghost sm" data-action="toggle-hide" data-id="${el.id}">${el.hidden ? '取消隐藏' : '隐藏'}</button>
        <button class="btn-ghost sm danger" data-action="delete" data-id="${el.id}">删除</button>
      </div>
    </div>`).join('')

  listEl.querySelectorAll('button[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => startEdit(btn.dataset.id))
  })
  listEl.querySelectorAll('button[data-action="toggle-hide"]').forEach(btn => {
    btn.addEventListener('click', () => toggleHidden(btn.dataset.id))
  })
  listEl.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => confirmDelete(btn.dataset.id))
  })
}

function setLoading(isLoading) {
  const btn = document.getElementById('btn-refresh')
  if (btn) btn.disabled = isLoading
}

function readForm() {
  const tagsRaw = document.getElementById('el-tags').value.trim()
  const tags = tagsRaw ? tagsRaw.split(/[\s,]+/).filter(Boolean) : []
  return {
    id: document.getElementById('el-id').value.trim() || undefined,
    name: document.getElementById('el-name').value.trim(),
    type: document.getElementById('el-type').value,
    family: document.getElementById('el-family').value.trim(),
    sku: document.getElementById('el-sku').value.trim(),
    width: Number(document.getElementById('el-width').value),
    depth: Number(document.getElementById('el-depth').value),
    height: Number(document.getElementById('el-height').value || 0),
    tags,
    imageUrl: document.getElementById('el-image').value.trim(),
    note: document.getElementById('el-note').value.trim(),
    allowWidthOverride: document.getElementById('el-allow-width').checked,
  }
}

function fillForm(el) {
  document.getElementById('form-title').textContent = el ? '编辑元素' : '新增元素'
  document.getElementById('el-id').value = el?.id || ''
  document.getElementById('el-name').value = el?.name || ''
  document.getElementById('el-type').value = el?.type || 'product'
  document.getElementById('el-family').value = el?.family || ''
  document.getElementById('el-sku').value = el?.sku || ''
  document.getElementById('el-width').value = el?.width ?? ''
  document.getElementById('el-depth').value = el?.depth ?? ''
  document.getElementById('el-height').value = el?.height ?? 0
  document.getElementById('el-tags').value = (el?.tags || []).join(', ')
  document.getElementById('el-image').value = el?.imageUrl || ''
  document.getElementById('el-note').value = el?.note || ''
  document.getElementById('el-allow-width').checked = Boolean(el?.allowWidthOverride)
  document.getElementById('form-delete-btn').style.display = editingId ? 'inline-flex' : 'none'
}

function resetForm() {
  editingId = null
  fillForm(null)
}

async function onSubmit(e) {
  e.preventDefault()
  const payload = readForm()
  if (!payload.name) { alert('名称必填'); return }
  if (!payload.width || !payload.depth) { alert('宽度和深度必填'); return }
  if (!guardWrite()) return

  try {
    if (editingId) {
      await updateElementApi(editingId, payload)
    } else {
      await createElementApi(payload)
    }
    await loadElements()
    resetForm()
  } catch (err) {
    alert(err.message)
  }
}

function startEdit(id) {
  const el = elements.find(e => e.id === id)
  if (!el) return
  editingId = id
  fillForm(el)
}

async function confirmDelete(id) {
  if (!guardWrite()) return
  if (!window.confirm('确定删除该元素吗？')) return
  try {
    await deleteElementApi(id)
    await loadElements()
    if (editingId === id) resetForm()
  } catch (err) {
    alert(err.message)
  }
}

async function onDelete() {
  if (!editingId) return
  await confirmDelete(editingId)
}

function exportJson() {
  const blob = new Blob([JSON.stringify(elements, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: 'elements.json' })
  a.click(); URL.revokeObjectURL(url)
}

function fillImportBox() {
  document.getElementById('import-text').value = JSON.stringify(elements, null, 2)
}

async function importJson() {
  if (!guardWrite()) return
  const raw = document.getElementById('import-text').value.trim()
  if (!raw) { alert('请输入 JSON'); return }
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('JSON 必须是元素数组')
    await replaceElementsApi(parsed)
    await loadElements()
    alert('已覆盖当前元素库')
  } catch (e) {
    alert(e.message)
  }
}

async function toggleHidden(id) {
  if (!guardWrite()) return
  const el = elements.find(e => e.id === id)
  if (!el) return
  try {
    await updateElementApi(id, { hidden: !el.hidden })
    await loadElements()
  } catch (e) {
    alert(e.message)
  }
}
