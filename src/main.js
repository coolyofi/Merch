/**
 * main.js — Merchandising Layout Tool
 * Completely rewritten: no auth, focused on table layout + blueprint generation
 */
import {
  getAllElements, ELEMENT_TYPES,
  getElementById,
} from './elements-db.js'

import {
  TABLE_WIDTH_PRESETS, TABLE_DEPTH_DEFAULT, LAYOUT_MODES,
  makeInstanceId, effectiveWidth, calcRail, validateLayout,
  generateBlueprintData, exportStateJSON,
} from './layout-engine.js'

import { drawBlueprint, exportBlueprintPNG } from './blueprint-canvas.js'

// ── App State ──────────────────────────────────────────────────────────────
const state = {
  table:     { name: '我的桌子', width: 120, depth: 60 },
  mode:      'single',
  frontRail: [],
  backRail:  [],
}

let libSearch     = ''
let libTypeFilter = 'all'

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSetupWizard()
  initLibrary()
  bindEvents()
  renderSummary()
  updateUsageBars()
})

// ═══════════════════════════════════════════════
//  SETUP WIZARD
// ═══════════════════════════════════════════════
function initSetupWizard() {
  // Width preset chips
  const chipsEl = document.getElementById('setup-width-chips')
  chipsEl.innerHTML = TABLE_WIDTH_PRESETS.map(p =>
    `<button class="preset-chip ${p.value === 120 ? 'active' : ''}"
       data-value="${p.value}">${p.label}</button>`
  ).join('')
  document.getElementById('setup-width-custom').value = 120

  chipsEl.querySelectorAll('.preset-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      chipsEl.querySelectorAll('.preset-chip').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      document.getElementById('setup-width-custom').value = btn.dataset.value
    })
  })
  document.getElementById('setup-width-custom').addEventListener('input', () => {
    chipsEl.querySelectorAll('.preset-chip').forEach(b => b.classList.remove('active'))
  })

  // Mode cards
  const modesEl = document.getElementById('setup-mode-cards')
  modesEl.innerHTML = LAYOUT_MODES.map(m =>
    `<div class="mode-card ${m.key === 'single' ? 'active' : ''}" data-mode="${m.key}">
       <div class="mode-card-label">${m.label}</div>
       <div class="mode-card-desc">${m.desc}</div>
     </div>`
  ).join('')
  modesEl.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      modesEl.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'))
      card.classList.add('active')
    })
  })
}

function setupConfirm() {
  const nameEl  = document.getElementById('setup-name')
  const widthEl = document.getElementById('setup-width-custom')
  const depthEl = document.getElementById('setup-depth')
  const modeEl  = document.querySelector('#setup-mode-cards .mode-card.active')

  const name  = nameEl.value.trim() || '我的桌子'
  const width = parseFloat(widthEl.value)
  const depth = parseFloat(depthEl.value) || TABLE_DEPTH_DEFAULT
  const mode  = modeEl ? modeEl.dataset.mode : 'single'

  if (!width || width < 24) {
    widthEl.focus()
    widthEl.style.borderColor = '#f87171'
    setTimeout(() => { widthEl.style.borderColor = '' }, 1500)
    return
  }

  state.table = { name, width, depth }
  state.mode  = mode

  document.getElementById('back-zone').style.display =
    mode !== 'single' ? 'flex' : 'none'

  document.getElementById('table-pill').textContent =
    `${name} · ${inToFt(width)} · ${depthLabel(mode)}`

  document.getElementById('setup-overlay').classList.add('hidden')
  document.getElementById('app-shell').classList.remove('hidden')

  // Re-render library now that we know if double mode
  renderLibrary()
  updateUsageBars()
  updateGenerateBtn()
}

// ═══════════════════════════════════════════════
//  ELEMENT LIBRARY
// ═══════════════════════════════════════════════
function initLibrary() {
  const typesEl = document.getElementById('lib-types')
  typesEl.innerHTML = ELEMENT_TYPES.map(t =>
    `<button class="type-chip ${t.key === 'all' ? 'active' : ''}"
       data-type="${t.key}">${t.label}</button>`
  ).join('')
  typesEl.querySelectorAll('.type-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      typesEl.querySelectorAll('.type-chip').forEach(c => c.classList.remove('active'))
      chip.classList.add('active')
      libTypeFilter = chip.dataset.type
      renderLibrary()
    })
  })
  renderLibrary()
}

function renderLibrary() {
  const all      = getAllElements()
  const search   = libSearch.toLowerCase()
  const type     = libTypeFilter
  const hasDouble= state.mode !== 'single'

  const filtered = all.filter(el => {
    const typeMatch = type === 'all' || el.type === type
    const textMatch = !search
      || el.name.toLowerCase().includes(search)
      || el.family.toLowerCase().includes(search)
      || el.tags.some(t => t.toLowerCase().includes(search))
    return typeMatch && textMatch
  })

  const listEl = document.getElementById('lib-list')
  if (filtered.length === 0) {
    listEl.innerHTML = `<p class="summary-empty">没有匹配的元素。</p>`
    return
  }

  const byFamily = {}
  filtered.forEach(item => {
    if (!byFamily[item.family]) byFamily[item.family] = []
    byFamily[item.family].push(item)
  })

  listEl.innerHTML = Object.entries(byFamily).map(([family, items]) => `
    <div class="lib-family-group">
      <div class="lib-family-label">${family}</div>
      ${items.map(item => {
        const wLabel = item.height === 0
          ? `${item.width}" × ${item.depth}"`
          : `${item.width}" × ${item.depth}"`
        const backBtn = hasDouble
          ? `<button class="el-add-btn back" data-id="${item.id}" data-rail="back" title="加入后沿">
               <span>＋</span><span class="add-label">后</span>
             </button>`
          : ''
        return `
          <div class="el-card">
            <div class="el-type-dot ${item.type}"></div>
            <div class="el-info">
              <div class="el-name">${item.name}</div>
              <div class="el-meta">${wLabel}</div>
            </div>
            <div class="el-add-btns">
              <button class="el-add-btn front" data-id="${item.id}" data-rail="front" title="加入前沿">
                <span>＋</span><span class="add-label">${hasDouble ? '前' : ''}</span>
              </button>
              ${backBtn}
            </div>
          </div>`
      }).join('')}
    </div>
  `).join('')

  listEl.querySelectorAll('.el-add-btn').forEach(btn => {
    btn.addEventListener('click', () => addElement(btn.dataset.id, btn.dataset.rail))
  })
}

// ─ Add element ─────────────────────────────────
function addElement(elementId, rail = 'front') {
  const el = getElementById(elementId)
  if (!el) return
  const item = { instanceId: makeInstanceId(), elementId }
  if (rail === 'back' && state.mode !== 'single') {
    state.backRail.push(item)
  } else {
    state.frontRail.push(item)
  }
  renderRail('front')
  renderRail('back')
  renderSummary()
  updateUsageBars()
  updateValidation()
  updateGenerateBtn()
}

// ─ Remove element ───────────────────────────────
function removeElement(instanceId, rail) {
  if (rail === 'front') {
    state.frontRail = state.frontRail.filter(i => i.instanceId !== instanceId)
  } else {
    state.backRail  = state.backRail.filter(i => i.instanceId !== instanceId)
  }
  renderRail(rail)
  renderSummary()
  updateUsageBars()
  updateValidation()
  updateGenerateBtn()
}

// ═══════════════════════════════════════════════
//  RAIL RENDERING
// ═══════════════════════════════════════════════
const PX_PER_IN = 7

function renderRail(rail) {
  const items  = rail === 'front' ? state.frontRail : state.backRail
  const railEl = document.getElementById(rail === 'front' ? 'front-rail' : 'back-rail')
  if (!railEl) return

  if (items.length === 0) {
    railEl.innerHTML = `<div class="rail-empty-hint">${
      rail === 'front'
        ? '点击元素库中的 <strong>＋</strong> 加入前沿'
        : '点击元素库中的 <strong>＋</strong> 加入后沿'
    }</div>`
    return
  }

  railEl.innerHTML = items.map(item => {
    const el  = getElementById(item.elementId)
    if (!el) return ''
    const w   = effectiveWidth(item)
    const wpx = Math.max(44, Math.min(w * PX_PER_IN, 200))
    return `
      <div class="rail-block ${el.type}" style="width:${wpx}px"
           data-instance="${item.instanceId}" data-rail="${rail}">
        <div class="rail-block-name">${el.name}</div>
        <div class="rail-block-width">${w}"</div>
        <button class="rail-block-remove"
                data-instance="${item.instanceId}" data-rail="${rail}">✕</button>
      </div>`
  }).join('')

  railEl.querySelectorAll('.rail-block-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      removeElement(btn.dataset.instance, btn.dataset.rail)
    })
  })
}

// ═══════════════════════════════════════════════
//  USAGE BARS
// ═══════════════════════════════════════════════
function updateUsageBars() {
  const W = state.table.width || 1
  updateBar('front', state.frontRail, W)
  if (state.mode !== 'single') updateBar('back', state.backRail, W)
}

function updateBar(rail, items, tableWidth) {
  const result = calcRail(items, tableWidth)
  const pct    = Math.min((result.used / tableWidth) * 100, 100)
  const fill   = document.getElementById(`${rail}-usage-fill`)
  const label  = document.getElementById(`${rail}-usage-label`)
  const stats  = document.getElementById(`${rail}-stats`)

  if (!fill) return
  fill.style.width = pct + '%'
  fill.className   = 'usage-fill' + (result.overBy > 0 ? ' over' : pct > 85 ? ' warn' : '')
  if (label) label.textContent = `${result.used.toFixed(1)}" / ${tableWidth}"`
  if (stats) {
    stats.textContent = result.overBy > 0
      ? `超出 ${result.overBy.toFixed(1)}"`
      : `剩余 ${result.remaining.toFixed(1)}"`
    stats.style.color = result.overBy > 0 ? 'var(--danger)' : 'var(--text-2)'
  }
}

// ═══════════════════════════════════════════════
//  VALIDATION
// ═══════════════════════════════════════════════
function updateValidation() {
  const { errors, warnings } = validateLayout(state)
  const el   = document.getElementById('validation-msgs')
  const msgs = [
    ...errors.map(e   => ({ type: 'error',   icon: '⚠', text: e })),
    ...warnings.map(w => ({ type: 'warning', icon: '●', text: w })),
  ]
  if (!errors.length && !warnings.length &&
      (state.frontRail.length > 0 || state.backRail.length > 0)) {
    msgs.push({ type: 'ok', icon: '✓', text: '布局正常，可以生成图纸了。' })
  }
  el.innerHTML = msgs.map(m =>
    `<div class="val-msg ${m.type}">
       <span class="val-icon">${m.icon}</span>
       <span>${m.text}</span>
     </div>`
  ).join('')
}

// ═══════════════════════════════════════════════
//  SUMMARY PANEL
// ═══════════════════════════════════════════════
function renderSummary() {
  const allItems = [
    ...state.frontRail.map(i => ({ ...i, rail: 'front' })),
    ...state.backRail.map(i  => ({ ...i, rail: 'back'  })),
  ]
  const listEl  = document.getElementById('summary-list')
  const statsEl = document.getElementById('summary-stats')

  if (allItems.length === 0) {
    listEl.innerHTML  = `<p class="summary-empty">还没有放置任何元素。</p>`
    statsEl.innerHTML = ''
    return
  }

  const TYPE_CLR = { product:'#3b82f6', bundle:'#7c3aed', sign:'#d97706', prop:'#059669', spacer:'#475569' }

  listEl.innerHTML = allItems.map(item => {
    const elem = getElementById(item.elementId)
    if (!elem) return ''
    const w   = effectiveWidth(item)
    const col = TYPE_CLR[elem.type] || '#3b82f6'
    return `
      <div class="summary-item">
        <div class="summary-item-color" style="background:${col}"></div>
        <div class="summary-item-name">${elem.name}</div>
        <div class="summary-item-rail ${item.rail}">${item.rail === 'front' ? '前' : '后'}</div>
        <div class="summary-item-w">${w}"</div>
        <button class="summary-item-del"
                data-instance="${item.instanceId}" data-rail="${item.rail}">✕</button>
      </div>`
  }).join('')

  listEl.querySelectorAll('.summary-item-del').forEach(btn => {
    btn.addEventListener('click', () => removeElement(btn.dataset.instance, btn.dataset.rail))
  })

  const W     = state.table.width
  const front = calcRail(state.frontRail, W)
  const back  = calcRail(state.backRail, W)
  const rows  = [
    { label: '桌宽', val: `${W}"` },
    { label: '前沿用量', val: `${front.used.toFixed(1)}"`, ok: front.overBy === 0 },
    { label: '前沿剩余', val: front.remaining >= 0 ? `${front.remaining.toFixed(1)}"` : `超出 ${front.overBy.toFixed(1)}"`, ok: front.overBy === 0 },
  ]
  if (state.mode !== 'single') {
    rows.push(
      { label: '后沿用量', val: `${back.used.toFixed(1)}"`, ok: back.overBy === 0 },
      { label: '后沿剩余', val: back.remaining >= 0 ? `${back.remaining.toFixed(1)}"` : `超出 ${back.overBy.toFixed(1)}"`, ok: back.overBy === 0 },
    )
  }
  statsEl.innerHTML = rows.map(r =>
    `<div class="stat-row">
       <span class="stat-label">${r.label}</span>
       <span class="stat-value ${r.ok === false ? 'over' : ''}">${r.val}</span>
     </div>`
  ).join('')
}

// ═══════════════════════════════════════════════
//  BLUEPRINT
// ═══════════════════════════════════════════════
function showBlueprint() {
  const bpData = generateBlueprintData(state)
  document.getElementById('builder-view').classList.add('hidden')
  document.getElementById('blueprint-view').classList.remove('hidden')
  document.getElementById('nav-builder').classList.remove('active')
  document.getElementById('nav-blueprint').classList.add('active')
  document.getElementById('nav-blueprint').disabled = false

  document.getElementById('bp-info').textContent =
    `${state.table.name} · ${inToFt(state.table.width)} · ${depthLabel(state.mode)}`

  const canvas = document.getElementById('blueprint-canvas')
  drawBlueprint(canvas, bpData)

  const { errors, warnings } = bpData.validation
  document.getElementById('bp-validation-msgs').innerHTML = [
    ...errors.map(e   => `<div class="val-msg error"><span class="val-icon">⚠</span><span>${e}</span></div>`),
    ...warnings.map(w => `<div class="val-msg warning"><span class="val-icon">●</span><span>${w}</span></div>`),
  ].join('')
}

function showBuilder() {
  document.getElementById('blueprint-view').classList.add('hidden')
  document.getElementById('builder-view').classList.remove('hidden')
  document.getElementById('nav-blueprint').classList.remove('active')
  document.getElementById('nav-builder').classList.add('active')
}

function updateGenerateBtn() {
  const hasItems = state.frontRail.length > 0 || state.backRail.length > 0
  document.getElementById('generate-btn').disabled = !hasItems || !state.table.width
  document.getElementById('nav-blueprint').disabled = !hasItems
}

// ═══════════════════════════════════════════════
//  EVENTS
// ═══════════════════════════════════════════════
function bindEvents() {
  document.getElementById('setup-confirm-btn').addEventListener('click', setupConfirm)
  document.getElementById('change-setup-btn').addEventListener('click', () => {
    document.getElementById('app-shell').classList.add('hidden')
    document.getElementById('setup-overlay').classList.remove('hidden')
  })

  document.getElementById('nav-builder').addEventListener('click', showBuilder)
  document.getElementById('nav-blueprint').addEventListener('click', () => {
    if (state.frontRail.length > 0 || state.backRail.length > 0) showBlueprint()
  })

  document.getElementById('lib-search').addEventListener('input', e => {
    libSearch = e.target.value
    renderLibrary()
  })

  document.getElementById('front-clear-btn').addEventListener('click', () => {
    state.frontRail = []
    renderRail('front'); renderSummary(); updateUsageBars(); updateValidation(); updateGenerateBtn()
  })
  const backClearBtn = document.getElementById('back-clear-btn')
  if (backClearBtn) backClearBtn.addEventListener('click', () => {
    state.backRail = []
    renderRail('back'); renderSummary(); updateUsageBars(); updateValidation(); updateGenerateBtn()
  })

  document.getElementById('reset-all-btn').addEventListener('click', () => {
    state.frontRail = []; state.backRail = []
    renderRail('front'); renderRail('back')
    renderSummary(); updateUsageBars(); updateValidation(); updateGenerateBtn()
  })

  document.getElementById('generate-btn').addEventListener('click', showBlueprint)
  document.getElementById('back-to-builder-btn').addEventListener('click', showBuilder)

  document.getElementById('export-json-btn').addEventListener('click', () => {
    const json = exportStateJSON(state)
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: `${state.table.name}.json` })
    a.click(); URL.revokeObjectURL(url)
  })

  document.getElementById('export-png-btn').addEventListener('click', () => {
    exportBlueprintPNG(document.getElementById('blueprint-canvas'), `${state.table.name}.png`)
  })

  window.addEventListener('resize', () => {
    if (!document.getElementById('blueprint-view').classList.contains('hidden')) {
      drawBlueprint(document.getElementById('blueprint-canvas'), generateBlueprintData(state))
    }
  })
}

// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════
function inToFt(inches) {
  if (!inches) return '—'
  const ft  = Math.floor(inches / 12)
  const rem = Math.round(inches % 12)
  if (ft === 0) return `${rem}"`
  if (rem === 0) return `${ft} ft (${inches}")`
  return `${ft}'${rem}" (${inches}")`
}

function depthLabel(mode) {
  return mode === 'single' ? '单排' : mode === 'double' ? '双排' : '双排含标识'
}
