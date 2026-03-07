/**
 * main.js — Merchandising Layout Tool
 * Completely rewritten: no auth, focused on table layout + blueprint generation
 */
import {
  getAllElements, ELEMENT_TYPES,
  getElementById, setElements, ELEMENTS_SEED,
} from './elements-db.js'

import { fetchElementsApi } from './elements-service.js'
import { installMockApi } from './mock-api.js'

import {
  TABLE_WIDTH_PRESETS, TABLE_DEPTH_DEFAULT,
  IPAD_MODES,
  makeInstanceId, effectiveWidth, deviceWidth, canLandscape, canSign,
  SIGN_WIDTH, SIGN_GAP,
  calcRail, validateLayout,
  computeSpacedLayout, groupBySolution,
  generateBlueprintData, exportStateJSON,
} from './layout-engine.js'

import { drawBlueprint, exportBlueprintPNG } from './blueprint-canvas.js'

// ── App State ──────────────────────────────────────────────────────────────
const state = {
  table:         { name: '我的桌子', width: 120, depth: 60 },
  mode:          'single',    // 'single' | 'double'
  productFamily: null,        // 'ipad' | null
  ipadMode:      'no-sign',   // 'no-sign' | 'with-sign' | 'keyboard'
  calcScene:     'ipadTable', // passed to engine
  frontRail:     [],
  backRail:      [],
}

let libSearch     = ''
let libTypeFilter = 'all'
let libFamilyFilter = 'all'
let elementsReady = false
const ELEMENT_STORE_KEY = 'merch-elements-store-v1'

// ── Multi-select state ─────────────────────────────────────────────────────
const railSelections = {
  front: new Set(),
  back:  new Set(),
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  bootstrap()
})

async function bootstrap() {
  installMockApi()
  await ensureElementsLoaded()
  initSetupWizard()
  initLibrary()
  bindEvents()
  renderSummary()
  updateUsageBars()
  // 跨标签页同步：管理页更新 localStorage 时自动刷新元素库
  window.addEventListener('storage', async (e) => {
    if (e.key === ELEMENT_STORE_KEY) {
      await reloadElements()
    }
  })
}

// ═══════════════════════════════════════════════
//  SETUP WIZARD
// ═══════════════════════════════════════════════
async function ensureElementsLoaded(force = false) {
  if (elementsReady && !force) return
  try {
    const data = await fetchElementsApi()
    setElements(data)
  } catch (e) {
    console.warn('[elements] 加载失败，使用内置示例', e)
    setElements(ELEMENTS_SEED)
  } finally {
    elementsReady = true
  }
}

async function reloadElements() {
  await ensureElementsLoaded(true)
  pruneRails()
  renderLibrary()
  renderRail('front'); renderRail('back')
  renderSummary(); updateUsageBars(); updateValidation(); updateSpacingResult(); updateGenerateBtn()
}

function initSetupWizard() {
  // ── Width preset chips
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

  // ── Rail cards: 单排 / 双排
  document.querySelectorAll('.rail-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.rail-card').forEach(c => c.classList.remove('active'))
      card.classList.add('active')
      // Q4 (product family) shown for both single and double
      document.getElementById('wizard-step-2').classList.remove('hidden')
      // Auto-fill depth: 30" for single, 60" for double
      document.getElementById('setup-depth').value = card.dataset.rail === 'double' ? 60 : 30
    })
  })

  // ── Product family cards
  document.querySelectorAll('.family-card:not(.coming-soon)').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.family-card').forEach(c => c.classList.remove('active'))
      card.classList.add('active')
      // Show iPad sub-modes only when iPad is selected
      const ipadModes = document.getElementById('wizard-ipad-modes')
      ipadModes.classList.toggle('hidden', card.dataset.family !== 'ipad')
    })
  })

  // ── iPad mode cards
  document.querySelectorAll('.ipad-mode-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.ipad-mode-card').forEach(c => c.classList.remove('active'))
      card.classList.add('active')
    })
  })
}

function setupConfirm() {
  const nameEl  = document.getElementById('setup-name')
  const widthEl = document.getElementById('setup-width-custom')
  const depthEl = document.getElementById('setup-depth')

  const name  = nameEl.value.trim() || '我的桌子'
  const width = parseFloat(widthEl.value)
  const depth = parseFloat(depthEl.value) || TABLE_DEPTH_DEFAULT

  if (!width || width < 24) {
    widthEl.focus()
    widthEl.style.borderColor = '#f87171'
    setTimeout(() => { widthEl.style.borderColor = '' }, 1500)
    return
  }

  // Rail: single / double
  const railCardEl = document.querySelector('.rail-card.active')
  const mode = railCardEl?.dataset.rail || 'single'

  // Product family (always visible now)
  const familyCardEl = document.querySelector('.family-card.active')
  const productFamily = familyCardEl?.dataset.family || null

  // iPad mode
  const ipadModeCardEl = document.querySelector('.ipad-mode-card.active')
  const ipadModeKey = ipadModeCardEl?.dataset.ipadMode || 'no-sign'
  const ipadModeDef = IPAD_MODES.find(m => m.key === ipadModeKey) || IPAD_MODES[0]

  const isIpad = productFamily === 'ipad'

  state.table         = { name, width, depth }
  state.mode          = mode
  state.productFamily = productFamily
  state.ipadMode      = isIpad ? ipadModeKey : null
  state.calcScene     = isIpad ? ipadModeDef.calcScene : 'general'

  document.getElementById('back-zone').style.display =
    mode !== 'single' ? 'flex' : 'none'

  document.getElementById('table-pill').textContent =
    `${name} · ${inToFt(width)} · ${depthLabel()}`

  document.getElementById('setup-overlay').classList.add('hidden')
  document.getElementById('app-shell').classList.remove('hidden')

  renderLibrary()
  updateUsageBars()
  updateGenerateBtn()
}

// ═══════════════════════════════════════════════
//  IMPORT JSON
// ═══════════════════════════════════════════════
/**
 * Load a previously-exported JSON file back into the builder.
 * Generates fresh instanceIds for all items but preserves solutionId groupings.
 */
function loadStateFromJSON(jsonText) {
  let data
  try { data = JSON.parse(jsonText) } catch (e) {
    alert('JSON 格式错误，无法导入。')
    return
  }

  // ── Table ──────────────────────────────────────────
  if (data.table)         state.table         = data.table
  if (data.mode)          state.mode          = data.mode
  if (data.productFamily !== undefined) state.productFamily = data.productFamily
  if (data.ipadMode      !== undefined) state.ipadMode      = data.ipadMode
  if (data.calcScene     !== undefined) state.calcScene     = data.calcScene

  // ── Rails: fresh instanceIds, keep solutionId groupings ──
  // For v1.1 exports (no solutionId at all), auto-group consecutive same-model items
  // so that groups are restored as closely as possible to the original intent.
  const mapItems = arr => {
    if (!arr || arr.length === 0) return []
    // Build per-item solutionId: each consecutive run of same elementId shares one
    const runSids = []
    let runStart = 0
    arr.forEach((item, idx) => {
      if (idx === 0 || item.elementId !== arr[idx - 1].elementId) runStart = idx
      runSids.push(`auto-grp-${runStart}`)
    })

    return arr.map((i, idx) => {
      const item = {
        instanceId:  makeInstanceId(),
        elementId:   i.elementId,
        hasSign:     !!i.hasSign,
        isLandscape: !!i.isLandscape,
      }
      if (i.widthOverride != null) item.widthOverride = i.widthOverride
      // Use explicit solutionId if present; otherwise auto-group by consecutive same model
      item.solutionId = i.solutionId || runSids[idx]
      return item
    })
  }

  state.frontRail = mapItems(data.frontRail)
  state.backRail  = mapItems(data.backRail)

  railSelections.front.clear()
  railSelections.back.clear()

  // ── Update UI ──────────────────────────────────────
  document.getElementById('back-zone').style.display =
    state.mode !== 'single' ? 'flex' : 'none'

  if (state.table) {
    document.getElementById('table-pill').textContent =
      `${state.table.name} · ${inToFt(state.table.width)} · ${depthLabel()}`
  }

  // Ensure builder view is visible (may be on blueprint view)
  document.getElementById('blueprint-view').classList.add('hidden')
  document.getElementById('builder-view').classList.remove('hidden')
  document.getElementById('setup-overlay').classList.add('hidden')
  document.getElementById('app-shell').classList.remove('hidden')
  document.getElementById('nav-builder').classList.add('active')
  document.getElementById('nav-blueprint').classList.remove('active')

  renderLibrary()
  renderRail('front')
  renderRail('back')
  renderSummary()
  updateUsageBars()
  updateValidation()
  updateSpacingResult()
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
      renderFamilyChips()
      renderLibrary()
    })
  })
  renderFamilyChips()
  renderLibrary()
}

function renderFamilyChips() {
  const famEl = document.getElementById('lib-families')
  if (!famEl) return
  const families = [
    { key: 'all', label: '全部' },
    { key: 'MacBook', label: 'MacBook' },
    { key: 'Mac', label: 'Mac' },
    { key: 'iPad', label: 'iPad' },
  ]
  famEl.innerHTML = families.map(f =>
    `<button class="type-chip ${f.key === libFamilyFilter ? 'active' : ''}"
       data-family="${f.key}">${f.label}</button>`
  ).join('')
  famEl.querySelectorAll('.type-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      famEl.querySelectorAll('.type-chip').forEach(c => c.classList.remove('active'))
      chip.classList.add('active')
      libFamilyFilter = chip.dataset.family
      renderLibrary()
    })
  })
  famEl.style.display = libTypeFilter === 'product' ? 'flex' : 'none'
}

function renderLibrary() {
  const all      = getAllElements()
  const search   = libSearch.toLowerCase()
  const type     = libTypeFilter
  const hasDouble= state.mode !== 'single'

  const filtered = all.filter(el => {
    const typeMatch = type === 'all' || el.type === type
    const familyMatch = libTypeFilter === 'product'
      ? (libFamilyFilter === 'all' || (el.family || '').toLowerCase() === libFamilyFilter.toLowerCase())
      : true
    const textMatch = !search
      || el.name.toLowerCase().includes(search)
      || el.family.toLowerCase().includes(search)
      || el.tags.some(t => t.toLowerCase().includes(search))
    return typeMatch && familyMatch && textMatch
  })
  const sorted = filtered.slice().sort(compareElementsForDisplay)

  const listEl = document.getElementById('lib-list')
  if (sorted.length === 0) {
    listEl.innerHTML = `<p class="summary-empty">没有匹配的元素。</p>`
    return
  }

  const byFamily = {}
  sorted.forEach(item => {
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
          ? `<button class="el-add-btn back vertical" data-id="${item.id}" data-rail="back" title="加入后沿">
               <span>＋</span><span class="add-label">后</span>
             </button>`
          : ''
        const thumb = item.imageUrl
          ? `<div class="el-thumb"><img src="${item.imageUrl}" alt="${item.name}" loading="lazy" /></div>`
          : `<div class="el-thumb placeholder">${(item.name || '?').slice(0,1)}</div>`
        return `
          <div class="el-card">
            ${thumb}
            <div class="el-info">
              <div class="el-name">${item.name}</div>
              <div class="el-meta">${wLabel}</div>
            </div>
            <div class="el-add-btns">
              ${backBtn}
              <button class="el-add-btn front vertical" data-id="${item.id}" data-rail="front" title="加入前沿">
                <span>＋</span><span class="add-label">${hasDouble ? '前' : ''}</span>
              </button>
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
  if (!isElementUsable(el)) return
  const item = {
    instanceId:  makeInstanceId(),
    elementId,
    hasSign:     false,
    isLandscape: false,
  }
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
  updateSpacingResult()
  updateGenerateBtn()
}

// ─ Remove element ───────────────────────────────
function removeElement(instanceId, rail) {
  railSelections[rail]?.delete(instanceId)
  if (rail === 'front') {
    state.frontRail = state.frontRail.filter(i => i.instanceId !== instanceId)
  } else {
    state.backRail  = state.backRail.filter(i => i.instanceId !== instanceId)
  }
  renderRail(rail)
  renderSummary()
  updateUsageBars()
  updateValidation()
  updateSpacingResult()
  updateGenerateBtn()
}

// ─ Toggle 2×3 sign ─────────────────────────────
function toggleSign(instanceId, rail) {
  const arr = rail === 'front' ? state.frontRail : state.backRail
  const idx = arr.findIndex(i => i.instanceId === instanceId)
  if (idx === -1) return
  arr[idx] = { ...arr[idx], hasSign: !arr[idx].hasSign }
  if (rail === 'front') state.frontRail = [...arr]; else state.backRail = [...arr]
  renderRail(rail)
  renderSummary(); updateUsageBars(); updateValidation(); updateSpacingResult(); updateGenerateBtn()
}

// ─ Toggle landscape ────────────────────────────
function toggleLandscape(instanceId, rail) {
  const arr = rail === 'front' ? state.frontRail : state.backRail
  const idx = arr.findIndex(i => i.instanceId === instanceId)
  if (idx === -1) return
  arr[idx] = { ...arr[idx], isLandscape: !arr[idx].isLandscape }
  if (rail === 'front') state.frontRail = [...arr]; else state.backRail = [...arr]
  renderRail(rail)
  renderSummary(); updateUsageBars(); updateValidation(); updateSpacingResult(); updateGenerateBtn()
}

// ─ Group consecutive items into one Solution ────
function groupWithNext(instanceId, rail) {
  const arr = rail === 'front' ? state.frontRail : state.backRail
  const idx = arr.findIndex(i => i.instanceId === instanceId)
  if (idx === -1 || idx >= arr.length - 1) return

  // Find or create a shared solutionId for item[idx] and item[idx+1]
  const sidA = arr[idx].solutionId || arr[idx].instanceId
  const sidB = arr[idx + 1].solutionId || arr[idx + 1].instanceId
  const newSid = sidA  // use the first item's id as the group id

  // Extend the group: all items currently in either group join the same solutionId
  const updated = arr.map((item, i) => {
    const sid = item.solutionId || item.instanceId
    if (sid === sidA || sid === sidB || i === idx || i === idx + 1) {
      return { ...item, solutionId: newSid }
    }
    return item
  })

  if (rail === 'front') state.frontRail = updated; else state.backRail = updated
  renderRail(rail)
  renderSummary(); updateUsageBars(); updateValidation(); updateSpacingResult(); updateGenerateBtn()
}

// ─ Remove an item from its Solution group ────────
function ungroupItem(instanceId, rail) {
  const arr = rail === 'front' ? state.frontRail : state.backRail
  const idx = arr.findIndex(i => i.instanceId === instanceId)
  if (idx === -1) return
  // Give this item its own unique solutionId (= its instanceId, i.e. no group)
  const updated = [...arr]
  updated[idx] = { ...updated[idx], solutionId: updated[idx].instanceId }
  if (rail === 'front') state.frontRail = updated; else state.backRail = updated
  renderRail(rail)
  renderSummary(); updateUsageBars(); updateValidation(); updateSpacingResult(); updateGenerateBtn()
}

function isElementUsable(el) {
  if (!el) return false
  const landscape = (el.tags || []).includes('landscape')
  return !el.hidden && el.type !== 'bundle' && !landscape
}

function compareElementsForDisplay(a, b) {
  const famOrder = ['iPad', 'MacBook', 'Mac', 'Signage', 'Spacer', 'Prop']
  const famRank = (f) => {
    const idx = famOrder.indexOf(f)
    return idx === -1 ? famOrder.length : idx
  }
  const ar = famRank(a.family), br = famRank(b.family)
  if (ar !== br) return ar - br

  // Custom iPad sorting: Pro13 > Pro11 > Air13 > Air11 > A16 > mini
  if (a.family === 'iPad' && b.family === 'iPad') {
    const modelRank = (name) => {
      const n = name.toLowerCase()
      if (n.includes('pro')) return 1
      if (n.includes('air')) return 2
      if (n.includes('a16')) return 3
      if (n.includes('mini')) return 4
      return 9
    }
    const sizeRank = (name) => {
      const m = name.match(/(\\d+(?:\\.\\d+)?)/)
      const val = m ? parseFloat(m[1]) : 0
      return -val   // larger inch first
    }
    const mrA = modelRank(a.name), mrB = modelRank(b.name)
    if (mrA !== mrB) return mrA - mrB
    const srA = sizeRank(a.name), srB = sizeRank(b.name)
    if (srA !== srB) return srA - srB
  }

  return (a.name || '').localeCompare(b.name || '')
}

// ─ Multi-select helpers ─────────────────────────────────────────
function toggleItemSelection(instanceId, rail) {
  const sel = railSelections[rail]
  if (sel.has(instanceId)) sel.delete(instanceId)
  else sel.add(instanceId)
  renderRail(rail)
}

function clearSelection(rail) {
  railSelections[rail].clear()
  renderRail(rail)
}

/**
 * Group all currently selected items in a rail into one Solution.
 * Assigns the solutionId of the first selected item (by rail order) to all.
 */
function groupSelected(rail) {
  const sel = railSelections[rail]
  if (sel.size < 2) return
  const arr = rail === 'front' ? state.frontRail : state.backRail
  const selectedItems = arr.filter(item => sel.has(item.instanceId))
  if (selectedItems.length < 2) return
  const newSid = selectedItems[0].solutionId || selectedItems[0].instanceId
  const updated = arr.map(item =>
    sel.has(item.instanceId) ? { ...item, solutionId: newSid } : item
  )
  if (rail === 'front') state.frontRail = updated; else state.backRail = updated
  railSelections[rail].clear()
  renderRail(rail)
  renderSummary(); updateUsageBars(); updateValidation(); updateSpacingResult(); updateGenerateBtn()
}

function updateSelectionToolbar(rail) {
  const sel     = railSelections[rail]
  const toolbar = document.getElementById(`${rail}-select-toolbar`)
  if (!toolbar) return
  if (sel.size >= 2) {
    toolbar.classList.remove('hidden')
    const countEl = toolbar.querySelector('.sel-count')
    if (countEl) countEl.textContent = `已选 ${sel.size} 项`
  } else {
    toolbar.classList.add('hidden')
  }
}

// ─ Set all landscape on a rail ─────────────────────
function setAllLandscape(rail) {
  const arr = rail === 'front' ? state.frontRail : state.backRail
  if (arr.length === 0) return
  // If all landscape-capable items are already on → turn all off; otherwise turn all on
  const capable = arr.filter(i => canLandscape(getElementById(i.elementId)))
  const allOn   = capable.length > 0 && capable.every(i => i.isLandscape)
  const updated = arr.map(item => {
    const el = getElementById(item.elementId)
    if (!canLandscape(el)) return item
    return { ...item, isLandscape: !allOn }
  })
  if (rail === 'front') state.frontRail = updated; else state.backRail = updated
  renderRail(rail)
  renderSummary(); updateUsageBars(); updateValidation(); updateSpacingResult(); updateGenerateBtn()
}

// ─ Set all 2×3 sign on a rail ──────────────────────
function setAllSign(rail) {
  const arr = rail === 'front' ? state.frontRail : state.backRail
  if (arr.length === 0) return
  // Toggle-all: if every sign-capable item already has a sign → remove; otherwise add
  const capable = arr.filter(i => canSign(getElementById(i.elementId)))
  const allOn   = capable.length > 0 && capable.every(i => i.hasSign)
  const updated = arr.map(item => {
    const el = getElementById(item.elementId)
    if (!canSign(el)) return item
    return { ...item, hasSign: !allOn }
  })
  if (rail === 'front') state.frontRail = updated; else state.backRail = updated
  renderRail(rail)
  renderSummary(); updateUsageBars(); updateValidation(); updateSpacingResult(); updateGenerateBtn()
}

function updateWidthOverride(instanceId, rail, width) {
  const arr = rail === 'front' ? state.frontRail : state.backRail
  const idx = arr.findIndex(i => i.instanceId === instanceId)
  if (idx === -1) return
  arr[idx] = { ...arr[idx], widthOverride: width }
  if (rail === 'front') state.frontRail = [...arr]; else state.backRail = [...arr]
  renderRail('front'); renderRail('back')
  renderSummary(); updateUsageBars(); updateValidation(); updateSpacingResult(); updateGenerateBtn()
}

function pruneRails() {
  const ok = id => isElementUsable(getElementById(id))
  state.frontRail = state.frontRail.filter(i => ok(i.elementId))
  state.backRail  = state.backRail.filter(i => ok(i.elementId))
}

// ═══════════════════════════════════════════════
//  RAIL RENDERING
// ═══════════════════════════════════════════════
const PX_PER_IN = 6    // px scale for visual blocks (approximate only)

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
    railSelections[rail].clear()
    updateSelectionToolbar(rail)
    return
  }

  // Sign is to the customer's LEFT: left side for front rail, right side for back rail
  const signSide = rail === 'back' ? 'right' : 'left'
  const sel     = railSelections[rail]
  const groups  = groupBySolution(items)

  // Build a map: instanceId → { groupIdx, posInGroup, groupSize }
  const itemGroupInfo = new Map()
  groups.forEach((g, gi) => {
    g.items.forEach((item, di) => {
      itemGroupInfo.set(item.instanceId, {
        groupIdx: gi, posInGroup: di, groupSize: g.items.length, solutionId: g.solutionId,
      })
    })
  })

  railEl.innerHTML = items.map((item, itemIdx) => {
    const el    = getElementById(item.elementId)
    if (!isElementUsable(el)) return ''
    const devW  = deviceWidth(item)
    const devPx = Math.max(60, devW * PX_PER_IN)
    const sigPx = Math.round((SIGN_WIDTH + SIGN_GAP) * PX_PER_IN)

    const lsOk      = canLandscape(el)
    const signOk    = canSign(el)
    const hasSign   = !!item.hasSign
    const isLs      = !!item.isLandscape
    const isSelected = sel.has(item.instanceId)

    const info   = itemGroupInfo.get(item.instanceId) || {}
    const inGroup      = info.groupSize > 1
    const isFirstInGrp = info.posInGroup === 0
    const isLastInGrp  = info.posInGroup === info.groupSize - 1

    // Is hasSign a lead sign (first in group) or a between-device sign?
    const isLeadSign    = hasSign && isFirstInGrp
    const isBetweenSign = hasSign && !isFirstInGrp

    // Back rail: the lead sign is stored on items[0] but must display after the LAST device.
    // Determine whether to render the sign capsule on THIS item.
    const groupFirstHasLeadSign = !!groups[info.groupIdx]?.items[0]?.hasSign

    const showSignCapsule = signSide === 'right'
      ? (isLastInGrp && groupFirstHasLeadSign)   // back rail: capsule on last item
      : isLeadSign                                 // front rail: capsule on first item

    // ── Sign button state for back rail multi-item groups ─────────────────────
    // The lead sign is stored on items[0] but VISUALLY belongs to items[last].
    // So the sign toggle button for the lead sign lives on items[last] and
    // its data-instance points to items[0] so toggleSign reaches the right item.
    //
    // items[0] (back rail, non-last): suppress lead-sign button ONLY when items[last]
    //   does NOT have its own between-device sign (so items[last] can host the toggle).
    //   If items[last] has its own sign (isBetweenSign situation), don't suppress so
    //   the user can still control the lead sign through items[0].
    // items[last] (back rail): button ON = groupFirstHasLeadSign, targets items[0].instanceId.
    //   Exception: if items[last] itself has isBetweenSign, keep normal own-sign behavior.
    const lastGroupItem = groups[info.groupIdx]?.items[groups[info.groupIdx].items.length - 1]
    const lastItemHasBetweenSign = !!(inGroup && lastGroupItem?.hasSign &&
      groups[info.groupIdx].items.length > 1)
    // Suppress items[0] sign button only when items[last] is available as proxy
    const isBackMultiFirst = signSide === 'right' && inGroup && isFirstInGrp && !isLastInGrp
      && !lastItemHasBetweenSign

    let signBtnOn       = hasSign
    let signBtnInstance = item.instanceId
    let signBtnTitle    = isLeadSign
      ? '移除前置标牌'
      : isBetweenSign ? '移除设备间标牌（Z间距）' : '添加 2×3 标牌'

    if (signSide === 'right' && inGroup && isLastInGrp && !isBetweenSign) {
      // items[last] of a back rail multi-item group (and not itself a between-device sign):
      // repurpose button to control the group's lead sign stored on items[0].
      const firstItem = groups[info.groupIdx]?.items[0]
      signBtnOn       = groupFirstHasLeadSign
      signBtnInstance = firstItem?.instanceId ?? item.instanceId
      signBtnTitle    = groupFirstHasLeadSign ? '移除前置标牌' : '添加 2×3 标牌'
    }

    // Build sign capsule for LEAD sign
    const leadSignCapsule = showSignCapsule ? `
      <div class="rail-sign-capsule" style="width:${sigPx}px" title="前置 2×3 标牌（${signSide === 'right' ? '右侧' : '左侧'}）">
        <div class="rail-sign-icon"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg></div>
        <div class="rail-sign-label">${SIGN_WIDTH}"+${SIGN_GAP}"</div>
      </div>` : ''

    // Between-device sign badge
    const betweenSignBadge = isBetweenSign
      ? `<span class="si-badge sign" title="设备间 2×3 标牌（Z 间距）"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="vertical-align:-0.125em"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg><svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="vertical-align:-0.125em"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg></span>`
      : ''

    // Group boundary indicators
    const groupStartBracket = inGroup && isFirstInGrp
      ? `<div class="group-bracket-start" title="Solution 组开始">【</div>` : ''
    const groupEndBracket  = inGroup && isLastInGrp
      ? `<div class="group-bracket-end" title="Solution 组结束">】</div>` : ''

    // Width label
    // For back rail multi-item groups, the "total including sign" label belongs on
    // items[last] (where the sign physically is), not on items[0] where hasSign is stored.
    let widthLabel
    const showSignWidth = isLeadSign && !isBackMultiFirst  // items[last] OR single-item OR front rail
    const showSignWidthOnLast = signSide === 'right' && inGroup && isLastInGrp && groupFirstHasLeadSign
    if (showSignWidthOnLast) {
      const total = devW + SIGN_WIDTH + SIGN_GAP
      widthLabel = `<span class="sol-w">${total.toFixed(2)}"</span> <span class="dev-w">(设备 ${devW.toFixed(2)}")</span>`
    } else if (showSignWidth) {
      const total = devW + SIGN_WIDTH + SIGN_GAP
      widthLabel = `<span class="sol-w">${total.toFixed(2)}"</span> <span class="dev-w">(设备 ${devW.toFixed(2)}")</span>`
    } else if (isBetweenSign) {
      widthLabel = `${devW.toFixed(2)}" <span class="dev-w">(Z间距)</span>`
    } else {
      widthLabel = `${devW.toFixed(2)}"`
    }

    // Can group with next item?
    const canGroupNext = itemIdx < items.length - 1
    const canUngroup   = inGroup
    const groupBtn = canGroupNext
      ? `<button class="rail-toggle group-toggle ${inGroup && !isLastInGrp ? 'on' : ''}"
            data-instance="${item.instanceId}" data-rail="${rail}" data-action="group-next"
            title="与下一台设备组成一个 Solution"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="vertical-align:-0.125em"><path d="M3 18v-2h18v2H3zm0-5v-2h18v2H3zm0-5V6h18v2H3z"/></svg> 组合</button>`
      : ''
    const ungroupBtn = canUngroup
      ? `<button class="rail-toggle ungroup-toggle"
            data-instance="${item.instanceId}" data-rail="${rail}" data-action="ungroup"
            title="从 Solution 中独立"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="vertical-align:-0.125em"><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-1.38-1.12-2.5-2.5-2.5S5 4.62 5 6s1.12 2.5 2.5 2.5c.59 0 1.14-.13 1.64-.36L11 10l-1.86 1.86c-.5-.23-1.05-.36-1.64-.36C6.12 11.5 5 12.62 5 14s1.12 2.5 2.5 2.5S10 15.38 10 14c0-.59-.13-1.14-.36-1.64L12 10.25l6.68 6.68 1.41-1.41L12 7.58l-1.41 1.41-1.41-1.41.46-.94zM7.5 6.5C6.67 6.5 6 5.83 6 5s.67-1.5 1.5-1.5S9 4.17 9 5s-.67 1.5-1.5 1.5zm0 9c-.83 0-1.5-.67-1.5-1.5S6.67 12.5 7.5 12.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg> 拆分</button>`
      : ''

    // Build the solution wrapper
    // For back rail with lead sign: sign capsule goes AFTER the device block
    const blockHtml = `
      <div class="rail-block ${el.type}${inGroup ? ' in-group' : ''}${isSelected ? ' selected' : ''}" style="min-width:${devPx}px"
           data-instance="${item.instanceId}" data-rail="${rail}">
        <div class="rail-block-top">
          <button class="rail-select-cb ${isSelected ? 'on' : ''}"
              data-instance="${item.instanceId}" data-rail="${rail}" data-action="select"
              title="${isSelected ? '取消选择' : '选择（多选后可组成 Solution）'}">${isSelected ? '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="vertical-align:-0.125em"><path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>' : '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="vertical-align:-0.125em"><path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>'}</button>
          <span class="rail-block-name">${el.name}${isLs ? ' <span class="ls-badge">横</span>' : ''}${betweenSignBadge}</span>
          <button class="rail-block-remove" data-instance="${item.instanceId}" data-rail="${rail}" title="移除"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="vertical-align:-0.125em"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
        </div>
        <div class="rail-block-mid">
          <span class="rail-block-width">${widthLabel}</span>
        </div>
        <div class="rail-block-toggles">
          ${signOk && !isBackMultiFirst ? `<button class="rail-toggle sign-toggle ${signBtnOn ? 'on' : ''}" data-instance="${signBtnInstance}" data-rail="${rail}" data-action="sign"
            title="${signBtnTitle}"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="vertical-align:-0.125em"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg> 标牌</button>` : ''}
          ${lsOk ? `<button class="rail-toggle ls-toggle ${isLs ? 'on' : ''}" data-instance="${item.instanceId}" data-rail="${rail}" data-action="landscape"
            title="${isLs ? '切换回竖屏' : '切换横屏'}">↔ 横屏</button>` : ''}
          ${groupBtn}${ungroupBtn}
        </div>
      </div>`

    if (signSide === 'right') {
      // Back rail: sign capsule goes after the LAST device of the group.
      // has-sign-right class activates the CSS flex layout for sign-on-right.
      const hasSignRight = isLastInGrp && groupFirstHasLeadSign
      return `<div class="rail-solution${hasSignRight ? ' has-sign-right' : ''}" data-instance="${item.instanceId}" data-rail="${rail}">
        ${groupStartBracket}${blockHtml}${leadSignCapsule}${groupEndBracket}
      </div>`
    } else {
      // Front rail: [groupStart][signCapsule][device][groupEnd]
      return `<div class="rail-solution${isLeadSign ? ' has-sign' : ''}" data-instance="${item.instanceId}" data-rail="${rail}">
        ${groupStartBracket}${leadSignCapsule}${blockHtml}${groupEndBracket}
      </div>`
    }
  }).join('')

  // Events
  railEl.querySelectorAll('.rail-block-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      removeElement(btn.dataset.instance, btn.dataset.rail)
    })
  })
  railEl.querySelectorAll('.rail-toggle, .rail-select-cb').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      const { action, instance: id, rail: r } = btn.dataset
      if (action === 'sign')       toggleSign(id, r)
      if (action === 'landscape')  toggleLandscape(id, r)
      if (action === 'group-next') groupWithNext(id, r)
      if (action === 'ungroup')    ungroupItem(id, r)
      if (action === 'select')     toggleItemSelection(id, r)
    })
  })
  updateSelectionToolbar(rail)
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
//  SPACING RESULT
// ═══════════════════════════════════════════════
function updateSpacingResult() {
  const panelEl  = document.getElementById('spacing-result')
  const chipsEl  = document.getElementById('spacing-chips')
  const traceEl  = document.getElementById('spacing-trace')
  if (!panelEl || !chipsEl || !traceEl) return

  // Only show when there are items in front rail
  if (state.frontRail.length === 0) {
    panelEl.classList.add('hidden')
    return
  }

  const W = state.table.width
  const scene = state.calcScene || 'general'
  const result = computeSpacedLayout(state.frontRail, W, scene, 'front')
  const s = result.spacing

  panelEl.classList.remove('hidden')

  if (!s || !result.fits) {
    chipsEl.innerHTML = `<span class="sc-chip sc-danger"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="vertical-align:-0.125em"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg> 按规则排不下，请减少设备或换更大的桌子</span>`
    traceEl.innerHTML = ''
    return
  }

  // Build chips
  const chips = []
  const isSignage = s.ipadSignage === true
  const groups = groupBySolution(state.frontRail)
  const multiDevice = groups.some(g => g.items.length > 1)

  chips.push({ label: isSignage ? '端距 X' : '两端边距', val: `${s.edgeLeft.toFixed(2)}"` })
  chips.push({ label: isSignage ? '内部间距' : '间距 X', val: `${s.X.toFixed(2)}"` })
  chips.push({ label: 'Solution 总宽 B', val: `${result.used.toFixed(2)}"` })
  chips.push({ label: 'Solution 数 C', val: `${groups.length}` })
  if (scene === 'ipadTable' || scene === 'ipadSignage') {
    if (multiDevice) {
      chips.push({ label: '组内 Y 间距', val: `${s.Y ?? '—'}"`})
      chips.push({ label: '组内 Z 间距(含标)', val: `${s.Z ?? '—'}"`})
    }
  }

  chipsEl.innerHTML = chips.map(c =>
    `<div class="sc-chip"><span class="sc-label">${c.label}</span><span class="sc-val">${c.val}</span></div>`
  ).join('')

  // Trace steps
  if (s.trace && s.trace.length > 0) {
    traceEl.innerHTML = `<ol class="sc-trace-list">${s.trace.map(t => `<li>${t}</li>`).join('')}</ol>`
  } else {
    traceEl.innerHTML = ''
  }
}

// ═══════════════════════════════════════════════
//  VALIDATION
// ═══════════════════════════════════════════════
function updateValidation() {
  const { errors, warnings } = validateLayout(state)
  const el   = document.getElementById('validation-msgs')
  const msgs = [
    ...errors.map(e   => ({ type: 'error',   icon: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>', text: e })),
    ...warnings.map(w => ({ type: 'warning', icon: '●', text: w })),
  ]
  if (!errors.length && !warnings.length &&
      (state.frontRail.length > 0 || state.backRail.length > 0)) {
    msgs.push({ type: 'ok', icon: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>', text: '布局正常，可以生成图纸了。' })
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
    const w    = effectiveWidth(item)
    const col  = TYPE_CLR[elem.type] || '#3b82f6'
    const badges = [
      item.hasSign     ? '<span class="si-badge sign"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="vertical-align:-0.125em"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>\u6807\u724c</span>' : '',
      item.isLandscape ? '<span class="si-badge ls">\u6a2a\u5c4f</span>' : '',
    ].join('')
    const overrideInput = elem.allowWidthOverride && !item.isLandscape
      ? `<input class="summary-width-input" type="number" step="0.1" min="0.1"
                data-instance="${item.instanceId}" data-rail="${item.rail}" data-default="${elem.width}"
                value="${item.widthOverride ?? elem.width}" />`
      : `<div class="summary-item-w">${w.toFixed(2)}"</div>`
    return `
      <div class="summary-item">
        <div class="summary-item-color" style="background:${col}"></div>
        <div class="summary-item-name">${elem.name}${badges}</div>
        <div class="summary-item-rail ${item.rail}">${item.rail === 'front' ? '前' : '后'}</div>
        ${overrideInput}
        <button class="summary-item-del"
                data-instance="${item.instanceId}" data-rail="${item.rail}"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="vertical-align:-0.125em"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
      </div>`
  }).join('')

  listEl.querySelectorAll('.summary-item-del').forEach(btn => {
    btn.addEventListener('click', () => removeElement(btn.dataset.instance, btn.dataset.rail))
  })
  listEl.querySelectorAll('.summary-width-input').forEach(input => {
    input.addEventListener('change', e => {
      const v = parseFloat(e.target.value)
      if (!v || v <= 0) {
        e.target.value = e.target.dataset.default || ''
        return
      }
      updateWidthOverride(e.target.dataset.instance, e.target.dataset.rail, v)
    })
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
    `${state.table.name} · ${inToFt(state.table.width)} · ${depthLabel()}`

  const canvas = document.getElementById('blueprint-canvas')
  drawBlueprint(canvas, bpData)

  const { errors, warnings } = bpData.validation
  document.getElementById('bp-validation-msgs').innerHTML = [
    ...errors.map(e   => `<div class="val-msg error"><span class="val-icon"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg></span><span>${e}</span></div>`),
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
  document.getElementById('refresh-elements-btn')?.addEventListener('click', reloadElements)

  document.getElementById('lib-search').addEventListener('input', e => {
    libSearch = e.target.value
    renderLibrary()
  })

  document.getElementById('front-clear-btn').addEventListener('click', () => {
    state.frontRail = []
    railSelections.front.clear()
    renderRail('front'); renderSummary(); updateUsageBars(); updateValidation(); updateSpacingResult(); updateGenerateBtn()
  })
  const backClearBtn = document.getElementById('back-clear-btn')
  if (backClearBtn) backClearBtn.addEventListener('click', () => {
    state.backRail = []
    railSelections.back.clear()
    renderRail('back'); renderSummary(); updateUsageBars(); updateValidation(); updateSpacingResult(); updateGenerateBtn()
  })

  // Selection toolbar (group selected / clear selection)
  document.getElementById('front-group-sel-btn')?.addEventListener('click', () => groupSelected('front'))
  document.getElementById('back-group-sel-btn')?.addEventListener('click',  () => groupSelected('back'))
  document.getElementById('front-clear-sel-btn')?.addEventListener('click', () => clearSelection('front'))
  document.getElementById('back-clear-sel-btn')?.addEventListener('click',  () => clearSelection('back'))

  // One-click rail quick-set buttons
  document.getElementById('front-all-ls-btn').addEventListener('click',   () => setAllLandscape('front'))
  document.getElementById('front-all-sign-btn').addEventListener('click', () => setAllSign('front'))
  const backAllLsBtn   = document.getElementById('back-all-ls-btn')
  const backAllSignBtn = document.getElementById('back-all-sign-btn')
  if (backAllLsBtn)   backAllLsBtn.addEventListener('click',   () => setAllLandscape('back'))
  if (backAllSignBtn) backAllSignBtn.addEventListener('click', () => setAllSign('back'))

  document.getElementById('reset-all-btn').addEventListener('click', () => {
    state.frontRail = []; state.backRail = []
    renderRail('front'); renderRail('back')
    renderSummary(); updateUsageBars(); updateValidation(); updateSpacingResult(); updateGenerateBtn()
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

  // ── Import JSON ──────────────────────────────────────────────────────────
  const importInput = document.getElementById('import-json-input')
  document.getElementById('import-json-btn').addEventListener('click', () => importInput.click())
  importInput.addEventListener('change', () => {
    const file = importInput.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => { loadStateFromJSON(e.target.result); importInput.value = '' }
    reader.readAsText(file)
  })

  document.getElementById('export-png-btn').addEventListener('click', () => {
    exportBlueprintPNG(document.getElementById('blueprint-canvas'), `${state.table.name}.png`)
  })

  window.addEventListener('resize', () => {
    if (!document.getElementById('blueprint-view').classList.contains('hidden')) {
      drawBlueprint(document.getElementById('blueprint-canvas'), generateBlueprintData(state))
    }
  })

  document.getElementById('spacing-trace-toggle').addEventListener('click', () => {
    const traceEl  = document.getElementById('spacing-trace')
    const toggleEl = document.getElementById('spacing-trace-toggle')
    const hidden   = traceEl.classList.toggle('hidden')
    toggleEl.textContent = hidden ? '步骤 ▾' : '步骤 ▴'
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

function depthLabel() {
  if (state.mode === 'single') {
    if (state.productFamily === 'ipad') {
      const def = IPAD_MODES.find(m => m.key === state.ipadMode)
      return `单排 · iPad · ${def?.label || ''}`
    }
    return '单排'
  }
  if (state.productFamily === 'ipad') {
    const def = IPAD_MODES.find(m => m.key === state.ipadMode)
    return `双排 · iPad · ${def?.label || ''}`
  }
  return '双排'
}
