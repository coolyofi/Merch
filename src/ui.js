/**
 * ui.js — Liquid-glass merchandising layout tool with dual queues + catalog
 * Features: left/right queues, inline width edit/duplicate, localStorage draft
 */
import {
  calcGeneral, calcSignage, calcIphoneAssortment, calcDoubleSide,
  IPHONE_Y_BY_TABLE, SIGNAGE_EDGE_BY_TABLE,
  RULE_SETS, DEFAULT_RULE_VERSION, getRuleSet,
} from './calc.js'
import { drawSingleSide, drawDoubleSide, drawAssortment, PALETTE } from './draw.js'
import { buildCatalog } from './catalog.js'
import {
  login, register, fetchMe,
  fetchLayouts, createLayout, fetchLayoutVersions, fetchLayoutVersion, createLayoutVersion, replayLayoutVersion,
  fetchRules, createRule, updateRuleStatus,
} from './api.js'

// ── Scenarios ───────────────────────────────────────────────────────────────
const SCENES = {
  general: { label: '通用', icon: '', solMode: 'named', showSignageEdge: false, showIphoneY: false, drawFn: 'single', showFlitch: true },
  wall:    { label: '墙面', icon: '', solMode: 'named', showSignageEdge: false, showIphoneY: false, drawFn: 'single', showFlitch: false },
  signage: { label: '2×3', icon: '', solMode: 'named', showSignageEdge: true,  showIphoneY: false, drawFn: 'single', showFlitch: false },
  iphoneComparison: { label: 'iPhone 比较', icon: '', solMode: 'named', showSignageEdge: false, showIphoneY: false, drawFn: 'double', defaultProductType: 'iphone', showFlitch: false },
  iphoneAssortment: { label: 'iPhone 组合', icon: '', solMode: 'assortment', showSignageEdge: false, showIphoneY: true, drawFn: 'assortment', defaultProductType: 'iphone', showFlitch: false },
  macComparison: { label: 'Mac 比较', icon: '', solMode: 'named', showSignageEdge: false, showIphoneY: false, drawFn: 'double', defaultProductType: 'macbook', showFlitch: false },
}

const TABLE_PRESETS = [
  { label: '— 自定义 —', value: '' },
  { label: '7 英尺 (84")',  value: 84 },
  { label: '8 英尺 (96")',  value: 96 },
  { label: '10 英尺 (120")', value: 120 },
  { label: '12 英尺 (144")', value: 144 },
  { label: '15 英尺 (180")', value: 180 },
  { label: '20 英尺 (240")', value: 240 },
]

const STORAGE_KEY = 'merch-draft-v1'
const AUTH_TOKEN_KEY = 'merch-auth-token'
let catalog = []
let categories = []

// ── State ───────────────────────────────────────────────────────────────────
let currentScene = 'general'
let queueLeft = []   // [{id,label,width,productType}]
let queueRight = []
let assortGroups = []
let showCables = false
let lastResult = null
let lastNames = []
let lastCfg = null
let lastDrawOpts = null
let dragIndex = null
let activeCategory = 'all'
let auth = { token: null, user: null }
let currentLayoutId = null
let serverRules = []

// ── Init ────────────────────────────────────────────────────────────────────
export function initUI() {  // Auth guard: redirect to login page if no token
  if (!localStorage.getItem(AUTH_TOKEN_KEY)) {
    window.location.href = '/app/account/'
    return
  }  const { items, cats } = buildCatalog()
  catalog = items; categories = cats
  renderSceneTabs()
  renderPresets()
  renderRuleVersions()
  renderLibCats()
  renderLibItems()
  bindEvents()
  restoreDraft()
  setScene(currentScene || 'general')
  renderQueue('left'); renderQueue('right')
  renderAuth()
  restoreSession()
}

// ── Scene tabs ──────────────────────────────────────────────────────────────
function renderSceneTabs() {
  const c = document.getElementById('scene-tabs')
  c.innerHTML = ''
  Object.entries(SCENES).forEach(([key, cfg]) => {
    const btn = document.createElement('button')
    btn.className = 'scene-tab'
    btn.dataset.key = key
    btn.innerHTML = `<span class="tab-dot"></span><span class="tab-label">${cfg.label}</span>`
    btn.onclick = () => setScene(key)
    c.appendChild(btn)
  })
}

function setScene(key) {
  currentScene = key
  const cfg = SCENES[key]
  document.querySelectorAll('.scene-tab').forEach(b => b.classList.toggle('active', b.dataset.key === key))
  document.getElementById('signage-edge-section').style.display = cfg.showSignageEdge ? 'block' : 'none'
  document.getElementById('iphone-y-section').style.display = cfg.showIphoneY ? 'block' : 'none'
  document.getElementById('assortment-section').style.display = cfg.solMode === 'assortment' ? 'block' : 'none'
  document.getElementById('cables-section').style.display = cfg.drawFn !== 'assortment' ? 'inline-flex' : 'none'
  autoFillEdgeX(); autoFillY();
  renderQueue('left'); renderQueue('right')
  saveDraft()
}

// ── Presets ─────────────────────────────────────────────────────────────────
function renderPresets() {
  const sel = document.getElementById('table-preset')
  sel.innerHTML = TABLE_PRESETS.map(p => `<option value="${p.value}">${p.label}</option>`).join('')
}
function autoFillEdgeX() {
  const A = parseFloat(document.getElementById('table-length').value)
  if (!A) return
  const rv = document.getElementById('rule-version')?.value || DEFAULT_RULE_VERSION
  const rule = getRuleSet(rv)
  const edgeMap = rule.signageEdgeByTable || SIGNAGE_EDGE_BY_TABLE
  const nearest = nearestKey(A, edgeMap)
  if (nearest) document.getElementById('edge-x').value = edgeMap[nearest]
}
function autoFillY() {
  const A = parseFloat(document.getElementById('table-length').value)
  if (!A) return
  const rv = document.getElementById('rule-version')?.value || DEFAULT_RULE_VERSION
  const rule = getRuleSet(rv)
  const yMap = rule.iphoneYByTable || IPHONE_Y_BY_TABLE
  const nearest = nearestKey(A, yMap)
  if (nearest) document.getElementById('iphone-y').value = yMap[nearest]
}
function nearestKey(A, map) {
  const keys = Object.keys(map).map(Number).sort((a,b)=>a-b)
  for (const k of keys) if (A <= k) return k
  return keys[keys.length-1]
}

function renderRuleVersions() {
  const sel = document.getElementById('rule-version')
  if (!sel) return
  const versions = Array.from(new Set([
    ...Object.keys(RULE_SETS),
    ...serverRules.map(r => r.version),
  ]))
  sel.innerHTML = versions.map(v => `<option value="${v}">${v}</option>`).join('')
  if (!sel.value) sel.value = DEFAULT_RULE_VERSION
}

// ── Queue rendering & DnD ───────────────────────────────────────────────────
function renderQueue(side) {
  const zone = document.getElementById(side === 'left' ? 'queue-left' : 'queue-right')
  const data = side === 'left' ? queueLeft : queueRight
  zone.innerHTML = ''
  if (!data.length) {
    const hint = side === 'left' ? '拖入元素到上侧' : '可选：拖入下侧元素'
    zone.innerHTML = `<div class="queue-empty-hint">${hint}</div>`
    return
  }
  data.forEach((item, idx) => {
    const card = document.createElement('div')
    card.className = 'queue-item'
    card.draggable = true
    card.dataset.index = idx
    card.dataset.side = side

    const handle = document.createElement('span')
    handle.className = 'queue-handle'
    handle.textContent = '::'

    const title = document.createElement('div')
    title.className = 'queue-title'
    title.textContent = item.label || `S${idx+1}`

    const widthIn = document.createElement('input')
    widthIn.type = 'number'
    widthIn.className = 'queue-width'
    widthIn.value = item.width || ''
    widthIn.step = '0.5'
    widthIn.min = '0.1'
    widthIn.oninput = e => {
      const v = parseFloat(e.target.value)
      data[idx].width = Number.isFinite(v) ? v : 0
      saveDraft()
    }

    const meta = document.createElement('div')
    meta.className = 'queue-meta'
    meta.innerHTML = `<span class="queue-chip">${item.productType}${item.orientation ? ' · ' + item.orientation : ''}</span>`

    let orient
    if (item.canOrient) {
      orient = document.createElement('div')
      orient.className = 'orient-toggle'
      const btnP = document.createElement('button')
      btnP.textContent = '竖'
      btnP.className = item.orientation === 'portrait' ? 'active' : ''
      btnP.onclick = () => {
        data[idx].orientation = 'portrait'
        if (item.widthPortrait) data[idx].width = item.widthPortrait
        renderQueue(side); saveDraft()
      }
      const btnL = document.createElement('button')
      btnL.textContent = '横'
      btnL.className = item.orientation !== 'portrait' ? 'active' : ''
      btnL.onclick = () => {
        data[idx].orientation = 'landscape'
        if (item.widthLandscape) data[idx].width = item.widthLandscape
        renderQueue(side); saveDraft()
      }
      orient.append(btnP, btnL)
    }

    const dup = document.createElement('button')
    dup.className = 'btn-ghost queue-dup'
    dup.textContent = 'dup'
    dup.title = '复制'
    dup.onclick = () => {
      data.splice(idx+1, 0, { ...item, id: `${item.id}-copy-${Date.now()}` })
      renderQueue(side); saveDraft()
    }

    const del = document.createElement('button')
    del.className = 'btn-ghost queue-del'
    del.textContent = 'x'
    del.onclick = () => {
      data.splice(idx,1)
      renderQueue(side); saveDraft()
    }

    card.append(handle, title, widthIn, meta)
    if (orient) card.appendChild(orient)
    card.append(dup, del)
    attachDrag(card)
    zone.appendChild(card)
  })
}

function attachDrag(el) {
  el.addEventListener('dragstart', e => {
    dragIndex = { idx: Number(e.currentTarget.dataset.index), side: e.currentTarget.dataset.side }
    e.dataTransfer.effectAllowed = 'move'
    e.currentTarget.classList.add('dragging')
  })
  el.addEventListener('dragend', e => {
    e.currentTarget.classList.remove('dragging')
    dragIndex = null
  })
}

['dragover','drop'].forEach(ev => {
  ['queue-left','queue-right'].forEach(id => {
    document.getElementById(id).addEventListener(ev, e => {
      e.preventDefault()
      if (ev === 'dragover') { e.dataTransfer.dropEffect='move'; return }
      const zone = e.currentTarget
      const side = id === 'queue-left' ? 'left' : 'right'
      const data = side === 'left' ? queueLeft : queueRight
      const targetCard = e.target.closest('.queue-item')
      if (dragIndex && dragIndex.side === side && targetCard) {
        const dropIndex = Number(targetCard.dataset.index)
        const { idx } = dragIndex
        if (dropIndex !== idx) {
          const [moved] = data.splice(idx,1)
          data.splice(dropIndex,0,moved)
          renderQueue(side); saveDraft()
        }
      }
      // handle drop from library
      const payload = e.dataTransfer.getData('application/json')
      if (payload) {
        try { addToQueue(JSON.parse(payload), side) } catch(_) {}
      }
    })
  })
})

// ── Library ────────────────────────────────────────────────────────────────
function renderLibCats() {
  const wrap = document.getElementById('lib-cats')
  wrap.innerHTML = ''
  makeCatBtn('all','全部', wrap)
  categories.forEach(cat => makeCatBtn(cat.key, cat.label, wrap))
  highlightCat()
}
function makeCatBtn(key,label,wrap){
  const btn = document.createElement('button')
  btn.className = 'cat-btn'
  btn.dataset.key = key
  btn.textContent = label
  btn.onclick = ()=>{activeCategory=key; highlightCat(); renderLibItems()}
  wrap.appendChild(btn)
}
function highlightCat(){
  document.querySelectorAll('.cat-btn').forEach(b=>b.classList.toggle('active', b.dataset.key===activeCategory))
}

function renderLibItems() {
  const list = document.getElementById('lib-items')
  const query = (document.getElementById('lib-search').value||'').trim().toLowerCase()
  list.innerHTML = ''
  const filtered = catalog.filter(it =>
    (activeCategory==='all' || it.category===activeCategory) &&
    (!query || it.label.toLowerCase().includes(query) || (it.tags||[]).some(t=>t.includes(query)))
  )
  filtered.forEach(it => {
    const card = document.createElement('div')
    card.className = 'lib-card'
    card.innerHTML = `
      <div class="lib-name">${it.label}</div>
      <div class="lib-meta">${it.width}" · ${it.category}</div>
      <div class="lib-actions">
        <button class="btn-ghost add-btn" data-side="left">上侧</button>
        <button class="btn-ghost add-btn" data-side="right">下侧</button>
      </div>
    `
    card.querySelectorAll('.add-btn').forEach(btn=>{
      btn.onclick = () => addToQueue(it, btn.dataset.side)
    })
    card.draggable = true
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('application/json', JSON.stringify(it))
      e.dataTransfer.effectAllowed = 'copy'
    })
    list.appendChild(card)
  })
}

function addToQueue(item, side='left') {
  const target = side === 'right' ? queueRight : queueLeft
  target.push({
    id: `${item.id}-${Date.now()}`,
    label: item.label,
    width: Number(item.width) || 0,
    productType: item.productType || item.category || 'accessory',
    canOrient: item.canOrient || false,
    orientation: item.canOrient ? 'landscape' : undefined,
    widthPortrait: item.widthPortrait || null,
    widthLandscape: item.widthLandscape || item.width || null,
  })
  renderQueue(side); saveDraft()
}

// Custom element
function addCustomFromForm() {
  const name = document.getElementById('custom-name').value.trim()
  const width = parseFloat(document.getElementById('custom-width').value)
  if (!name || !Number.isFinite(width) || width <= 0) return
  addToQueue({ id: `custom-${Date.now()}`, label: name, width, productType: 'accessory', category: 'accessory' }, 'left')
  document.getElementById('custom-name').value = ''
  document.getElementById('custom-width').value = ''
}

// ── Calculation ─────────────────────────────────────────────────────────────
function calculate() {
  clearError()
  const A = parseFloat(document.getElementById('table-length').value)
  if (!A || A <= 0) { showError('请输入有效的长度 A'); return }
  const cfg = SCENES[currentScene]
  const canvas = document.getElementById('diagram-canvas')
  const ruleVersion = document.getElementById('rule-version')?.value || DEFAULT_RULE_VERSION
  const rule = getRuleSet(ruleVersion)
  let result=null, names=[], productTypes=[], dimLabels=[], bottomNames=[], bottomProductTypes=[]

  if (cfg.solMode === 'assortment') {
    const Y = parseFloat(document.getElementById('iphone-y').value)
    if (!Number.isFinite(Y) || Y <= 0) { showError('请填写有效 Y'); return }
    if (!assortGroups.length) { showError('请添加 Solution 组'); return }
    const groups = assortGroups.filter(g=>g.count>0 && g.riserWidth>0)
    if (!groups.length) { showError('请填写组的数量和宽度'); return }
    result = calcIphoneAssortment(A, groups, Y)
    if (!result) { showError('总宽度超过桌长'); return }
    result.ruleVersion = ruleVersion
    names = groups.map((_,i)=>`组 ${i+1}`)
    productTypes = groups.map(()=>cfg.defaultProductType||'iphone')
  } else {
    const primary = queueLeft
    if (!primary.length) { showError('上侧至少需要一个元素'); return }
    const valid = primary.filter(q=>q.width>0)
    if (!valid.length) { showError('元素宽度需大于0'); return }
    names = valid.map((s,i)=>s.label || `S${i+1}`)
    productTypes = valid.map(s=> s.productType || cfg.defaultProductType || 'ipad')
    dimLabels = valid.map(()=> '')

    if (cfg.drawFn === 'double') {
      const secondary = queueRight.filter(q => q.width > 0)
      const mirror = secondary.length === 0
      const bottomValid = mirror ? valid.map(v => ({ ...v })) : secondary
      bottomNames = bottomValid.map((s, i) => s.label || `B${i+1}`)
      bottomProductTypes = bottomValid.map(s=> s.productType || cfg.defaultProductType || 'ipad')
      result = calcDoubleSide(
        A,
        valid.map(s => s.width),
        bottomValid.map(s => s.width),
        {
          centerTolerance: rule.dualSide?.centerToleranceIn ?? 1.0,
          microAdjustMax: rule.dualSide?.microAdjustMaxIn ?? 1.5,
          ruleVersion,
        },
      )
      if (mirror && result) {
        result.trace.push('下侧未输入元素：已按上侧镜像进行双面计算。')
      }
    } else {
      const widths = valid.map(s=>s.width)
      if (cfg.showSignageEdge) {
        const edgeX = parseFloat(document.getElementById('edge-x').value) || 7
        result = calcSignage(A, widths, edgeX)
      } else {
        result = calcGeneral(A, widths)
      }
      if (result) result.ruleVersion = ruleVersion
    }
    if (!result) { showError('总宽度超过桌长'); return }
  }

  lastResult = result; lastNames = names; lastCfg = cfg
  lastDrawOpts = {
    productTypes,
    bottomProductTypes,
    bottomNames,
    dimLabels,
  }
  renderResultSummary(result, cfg)
  renderTrace(result)
  renderResultTable(result, names)
  redraw(canvas, result, names, cfg, lastDrawOpts)
  document.getElementById('canvas-empty-hint').style.display = 'none'
  saveDraft()
}

function redraw(canvas, result, names, cfg, drawOpts = {}) {
  const opts = {
    showFlitch: cfg.showFlitch,
    isSignage: cfg.showSignageEdge,
    productTypes: drawOpts.productTypes || [],
    bottomProductTypes: drawOpts.bottomProductTypes || [],
    bottomNames: drawOpts.bottomNames || [],
    dimLabels: drawOpts.dimLabels || [],
    showCables,
  }
  if (cfg.drawFn === 'assortment') {
    canvas.style.height = '320px'; drawAssortment(canvas, result, names, opts)
  } else if (cfg.drawFn === 'double') {
    canvas.style.height = '320px'; drawDoubleSide(canvas, result, names, opts)
  } else {
    canvas.style.height = '220px'; drawSingleSide(canvas, result, names, opts)
  }
}

// ── Result render ─────────────────────────────────────────────────────────--
function renderResultSummary(result, cfg) {
  const box = document.getElementById('result-summary')
  if (result?.mode === 'double') {
    const pairs = result.alignment?.pairs || []
    const warnHtml = (result.warnings || []).length
      ? `<div class="res-warnings">${result.warnings.map(w => `<div>• ${w}</div>`).join('')}</div>`
      : ''
    box.innerHTML = `
      <div class="res-formula">
        上侧：X = <strong>${result.top.X.toFixed(2)}"</strong>，边缘 = <strong>${result.top.edgeLeft.toFixed(2)}"</strong><br>
        下侧：X = <strong>${result.bottom.X.toFixed(2)}"</strong>，边缘 = <strong>${result.bottom.edgeLeft.toFixed(2)}"</strong><br>
        中心偏差规则：容差 <strong>${result.alignment.centerTolerance.toFixed(1)}"</strong>，
        微调上限 <strong>${result.alignment.microAdjustMax.toFixed(1)}"</strong>
      </div>
      <div class="res-chips">
        <span class="chip">规则版本 = ${result.ruleVersion || DEFAULT_RULE_VERSION}</span>
        <span class="chip">对齐组数 = ${result.alignment.pairCount}</span>
        <span class="chip chip-y">已对齐 = ${result.alignment.alignedCount}</span>
        <span class="chip">可微调 = ${result.alignment.minorAdjustCount}</span>
        <span class="chip chip-x">超限 = ${result.alignment.majorCount}</span>
      </div>
      ${pairs.length ? `<div class="res-pair-grid">${pairs.map(p => `<span class="chip">#${p.index+1} Δ=${p.delta.toFixed(2)}"</span>`).join('')}</div>` : ''}
      ${warnHtml}
    `
    box.style.display = 'block'
    return
  }
  const isSignage = cfg.showSignageEdge
  box.innerHTML = `
    <div class="res-formula">
      ${isSignage
        ? `边缘 X = <strong>${result.edgeLeft.toFixed(2)}"</strong><br>内部间距 = (A − B) ÷ (C−1) = <strong>${result.X.toFixed(2)}"</strong>`
        : `X = (A − B) ÷ C = (${result.A} − ${result.B.toFixed(2)}) ÷ ${result.C} = <strong>${result.X.toFixed(2)}"</strong><br>两端各留 X÷2 = <strong>${(result.X/2).toFixed(2)}"</strong>`}
    </div>
    <div class="res-chips">
      <span class="chip">A = ${result.A}"</span>
      <span class="chip">B = ${result.B.toFixed(2)}"</span>
      <span class="chip">C = ${result.C}</span>
      <span class="chip chip-x">X = ${result.X.toFixed(2)}"</span>
      ${'Y' in result ? `<span class="chip chip-y">Y = ${result.Y}"</span>` : ''}
    </div>
  `
  box.style.display = 'block'
}

function renderResultTable(result, names) {
  const card = document.getElementById('result-table-card')
  const tbl = document.getElementById('result-table')
  if (result?.mode === 'double') {
    const pairMap = new Map((result.alignment?.pairs || []).map(p => [p.index, p]))
    tbl.innerHTML = `<thead><tr><th>侧</th><th>#</th><th>宽度</th><th>起始</th><th>中心</th><th>结束</th><th>Δcenter</th><th>状态</th></tr></thead>`
    const body = document.createElement('tbody')
    result.top.layout.forEach((item, i) => {
      const pair = pairMap.get(i)
      const tr = document.createElement('tr')
      tr.innerHTML = `<td>上</td><td>${i+1}</td><td>${item.width.toFixed(2)}"</td><td>${item.start.toFixed(2)}"</td><td>${item.center.toFixed(2)}"</td><td>${item.end.toFixed(2)}"</td><td>${pair ? pair.delta.toFixed(2) + '"' : '—'}</td><td>${pair ? pair.status : '—'}</td>`
      body.appendChild(tr)
    })
    result.bottom.layout.forEach((item, i) => {
      const pair = pairMap.get(i)
      const tr = document.createElement('tr')
      tr.innerHTML = `<td>下</td><td>${i+1}</td><td>${item.width.toFixed(2)}"</td><td>${item.start.toFixed(2)}"</td><td>${item.center.toFixed(2)}"</td><td>${item.end.toFixed(2)}"</td><td>${pair ? pair.delta.toFixed(2) + '"' : '—'}</td><td>${pair ? pair.status : '—'}</td>`
      body.appendChild(tr)
    })
    tbl.appendChild(body)
    card.style.display = 'block'
    return
  }
  tbl.innerHTML = `<thead><tr><th>#</th><th>名称</th><th>宽度</th><th>起始</th><th>中心</th><th>结束</th></tr></thead>`
  const body = document.createElement('tbody')
  result.layout.forEach((item,i)=>{
    const tr = document.createElement('tr')
    const dot = `<span class="dot" style="background:${PALETTE[i%PALETTE.length]}"></span>`
    tr.innerHTML = `<td>${dot}${i+1}</td><td>${names[i]||'—'}</td><td>${item.width.toFixed(2)}"</td><td>${item.start.toFixed(2)}"</td><td>${item.center.toFixed(2)}"</td><td>${item.end.toFixed(2)}"</td>`
    body.appendChild(tr)
  })
  tbl.appendChild(body)
  card.style.display = 'block'
}

function renderTrace(result) {
  const panel = document.getElementById('trace-panel')
  const list = document.getElementById('trace-list')
  if (!panel || !list) return
  const trace = Array.isArray(result?.trace) ? result.trace : []
  if (!trace.length) {
    panel.style.display = 'none'
    list.innerHTML = ''
    return
  }
  list.innerHTML = trace.map(step => `<li>${step}</li>`).join('')
  panel.style.display = 'block'
  list.style.display = 'none'
  const chev = document.querySelector('#trace-toggle .trace-chevron')
  if (chev) chev.textContent = '▸'
}

function showError(msg){
  const el = document.getElementById('error-msg')
  el.textContent = msg
  el.style.display = 'block'
}
function clearError(){
  const el = document.getElementById('error-msg')
  el.textContent = ''
  el.style.display = 'none'
  document.getElementById('result-summary').style.display = 'none'
  document.getElementById('result-table-card').style.display = 'none'
  document.getElementById('trace-panel').style.display = 'none'
  document.getElementById('trace-list').style.display = 'none'
}

// ── Local storage drafts ───────────────────────────────────────────────────
function saveDraft() {
  const draft = {
    scene: currentScene,
    tableLength: document.getElementById('table-length').value,
    edgeX: document.getElementById('edge-x').value,
    iphoneY: document.getElementById('iphone-y').value,
    ruleVersion: document.getElementById('rule-version')?.value || DEFAULT_RULE_VERSION,
    queueLeft, queueRight,
    assortGroups,
    showCables,
  }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)) } catch(_) {}
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) { seedDefaults(); return }
    const d = JSON.parse(raw)
    currentScene = d.scene || 'general'
    document.getElementById('table-length').value = d.tableLength || ''
    document.getElementById('edge-x').value = d.edgeX || ''
    document.getElementById('iphone-y').value = d.iphoneY || ''
    if (document.getElementById('rule-version')) {
      document.getElementById('rule-version').value = d.ruleVersion || DEFAULT_RULE_VERSION
    }
    queueLeft = Array.isArray(d.queueLeft) ? d.queueLeft : []
    queueRight = Array.isArray(d.queueRight) ? d.queueRight : []
    assortGroups = Array.isArray(d.assortGroups) ? d.assortGroups : []
    showCables = !!d.showCables
    document.getElementById('cables-toggle').checked = showCables
  } catch(_) {
    seedDefaults()
  }
  if (!queueLeft.length) seedDefaults()
}

function seedDefaults(){
  const seed = catalog.slice(0,3)
  seed.forEach(it => addToQueue(it, 'left'))
  // default assortment groups
  if (!assortGroups.length) {
    assortGroups.push({ id: Date.now(), count: 4, riserWidth: 2.5 })
    assortGroups.push({ id: Date.now()+1, count: 4, riserWidth: 2.5 })
  }
}

// ── Events ─────────────────────────────────────────────────────────────────-
function bindEvents() {
  document.getElementById('table-preset').addEventListener('change', e=>{
    if (e.target.value) {
      document.getElementById('table-length').value = e.target.value
      autoFillEdgeX(); autoFillY(); saveDraft()
    }
  })
  document.getElementById('table-length').addEventListener('input', ()=>{autoFillEdgeX(); autoFillY(); saveDraft()})
  document.getElementById('edge-x').addEventListener('input', saveDraft)
  document.getElementById('iphone-y').addEventListener('input', saveDraft)
  document.getElementById('rule-version').addEventListener('change', ()=>{autoFillEdgeX(); autoFillY(); saveDraft()})

  document.getElementById('lib-search').addEventListener('input', renderLibItems)
  document.getElementById('custom-add-btn').addEventListener('click', addCustomFromForm)
  document.getElementById('calc-btn').addEventListener('click', calculate)
  document.getElementById('cables-toggle').addEventListener('change', e=>{showCables = e.target.checked; saveDraft(); if(lastResult&&lastCfg){redraw(document.getElementById('diagram-canvas'), lastResult, lastNames, lastCfg, lastDrawOpts || {})}})
  const traceToggle = document.getElementById('trace-toggle')
  if (traceToggle) {
    traceToggle.addEventListener('click', () => {
      const list = document.getElementById('trace-list')
      const chev = traceToggle.querySelector('.trace-chevron')
      const open = list.style.display !== 'none'
      list.style.display = open ? 'none' : 'block'
      if (chev) chev.textContent = open ? '▸' : '▾'
    })
  }

  // clear queues
  document.querySelectorAll('.btn-clear-queue').forEach(btn=>{
    btn.onclick = ()=>{
      if (btn.dataset.side === 'left') queueLeft = []
      else queueRight = []
      renderQueue(btn.dataset.side); saveDraft()
    }
  })

  const logoutBtn = document.getElementById('logout-btn')
  const saveBtn = document.getElementById('save-layout-btn')
  const loadBtn = document.getElementById('load-layout-btn')
  const replayBtn = document.getElementById('replay-layout-btn')
  const ruleCreateBtn = document.getElementById('rule-create-btn')
  const ruleReviewBtn = document.getElementById('rule-review-btn')
  const rulePublishBtn = document.getElementById('rule-publish-btn')
  if (logoutBtn) logoutBtn.onclick = doLogout
  if (saveBtn) saveBtn.onclick = saveLayout
  if (loadBtn) loadBtn.onclick = loadLayouts
  if (replayBtn) replayBtn.onclick = replayCurrentLayout
  if (ruleCreateBtn) ruleCreateBtn.onclick = createRuleDraftFromCurrent
  if (ruleReviewBtn) ruleReviewBtn.onclick = submitRuleToReview
  if (rulePublishBtn) rulePublishBtn.onclick = publishRuleFromReview

  // drop from library handled in queue listeners
}

// expose for debugging
window.__queues = { queueLeft, queueRight }
window.__assortGroups = assortGroups

function renderAuth() {
  const status = document.getElementById('auth-status')
  if (!status) return
  if (!auth.user) {
    status.textContent = '未登录'
    return
  }
  status.textContent = `已登录 · ${auth.user.email}`
}

async function restoreSession() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (!token) { window.location.href = '/app/account/'; return }
  try {
    const me = await fetchMe(token)
    auth.token = token
    auth.user = { id: me.id, email: me.email, name: me.name }
    renderAuth()
    await syncRulesFromCloud()
  } catch (e) {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    window.location.href = '/app/account/'
  }
}

async function syncRulesFromCloud() {
  if (!auth.token) return
  try {
    serverRules = await fetchRules(auth.token)
    const current = document.getElementById('rule-version')?.value
    renderRuleVersions()
    if (current) document.getElementById('rule-version').value = current
  } catch (_) {}
}

function doLogout() {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  auth = { token: null, user: null }
  window.location.href = '/app/account/'
}

function buildInputPayload() {
  return {
    scene: currentScene,
    tableLength: document.getElementById('table-length').value,
    edgeX: document.getElementById('edge-x').value,
    iphoneY: document.getElementById('iphone-y').value,
    ruleVersion: document.getElementById('rule-version')?.value || DEFAULT_RULE_VERSION,
    queueLeft, queueRight, assortGroups,
    timestamp: new Date().toISOString(),
  }
}

async function saveLayout() {
  const inputPayload = buildInputPayload()
  saveDraft()
  if (!auth.token) { window.location.href = '/app/account/'; return }
  const name = prompt('布局名称（可留空）') || undefined
  try {
    if (currentLayoutId) {
      await createLayoutVersion(auth.token, currentLayoutId, {
        ruleVersion: inputPayload.ruleVersion,
        payload: { ...inputPayload, computedResult: lastResult },
      })
    } else {
      const created = await createLayout(auth.token, {
        scene: currentScene,
        name,
        ruleVersion: inputPayload.ruleVersion,
        payload: { ...inputPayload, computedResult: lastResult },
      })
      currentLayoutId = created.id
    }
    alert('云端保存成功')
  } catch (e) {
    alert(e.message || '云端保存失败')
  }
}

async function loadLayouts() {
  if (!auth.token) { window.location.href = '/app/account/'; return }
  try {
    const list = await fetchLayouts(auth.token, null)
    if (!list.length) { alert('暂无云端布局'); return }
    const names = list.map((l, i) => `${i+1}. ${l.name || l.id}`).join('\\n')
    const pick = prompt(`选择布局序号:\\n${names}`)
    const idx = Number(pick) - 1
    if (idx < 0 || idx >= list.length) return
    const chosen = list[idx]
    const versions = await fetchLayoutVersions(auth.token, chosen.id)
    if (!versions.length) { alert('该布局暂无版本数据'); return }
    const versionNames = versions.map((v, i) => `${i+1}. v${v.versionNo} (${v.ruleVersion})`).join('\\n')
    const vPick = prompt(`选择版本序号:\\n${versionNames}`) || '1'
    const vIdx = Number(vPick) - 1
    if (vIdx < 0 || vIdx >= versions.length) return
    const full = await fetchLayoutVersion(auth.token, chosen.id, versions[vIdx].id)
    currentLayoutId = chosen.id
    applyPayload(full.inputPayload || chosen)
    alert(`已加载 v${full.versionNo}`)
  } catch (e) {
    alert(e.message || '加载失败')
  }
}

async function replayCurrentLayout() {
  if (!auth.token) { alert('请先登录'); return }
  if (!currentLayoutId) { alert('请先加载或保存一个布局'); return }
  try {
    const versions = await fetchLayoutVersions(auth.token, currentLayoutId)
    if (!versions.length) { alert('暂无版本可回放'); return }
    const versionNames = versions.map((v, i) => `${i+1}. v${v.versionNo} (${v.ruleVersion})`).join('\\n')
    const pick = prompt(`选择回放版本:\\n${versionNames}`) || '1'
    const idx = Number(pick) - 1
    if (idx < 0 || idx >= versions.length) return
    const targetRuleVersion = document.getElementById('rule-version')?.value || DEFAULT_RULE_VERSION
    const replayed = await replayLayoutVersion(auth.token, currentLayoutId, {
      versionId: versions[idx].id,
      targetRuleVersion,
      saveAsNewVersion: true,
    })
    if (replayed?.newVersion?.inputPayload) {
      applyPayload(replayed.newVersion.inputPayload)
    }
    alert(`回放完成，生成新版本 v${replayed.newVersion?.versionNo ?? 'N/A'}`)
  } catch (e) {
    alert(e.message || '回放失败')
  }
}

async function createRuleDraftFromCurrent() {
  if (!auth.token) { alert('请先登录'); return }
  const version = prompt('新规则版本号（例如 Merch v2026.03）')
  if (!version) return
  const base = getRuleSet(document.getElementById('rule-version')?.value || DEFAULT_RULE_VERSION)
  try {
    await createRule(auth.token, {
      version,
      description: 'Draft from current working rule',
      payload: base,
      status: 'DRAFT',
    })
    await syncRulesFromCloud()
    alert('规则草稿已创建')
  } catch (e) {
    alert(e.message || '创建规则失败')
  }
}

async function submitRuleToReview() {
  if (!auth.token) { alert('请先登录'); return }
  const picked = await pickRuleByStatus('DRAFT', '选择要提审的规则草稿序号')
  if (!picked) return
  try {
    await updateRuleStatus(auth.token, picked.id, 'REVIEW')
    await syncRulesFromCloud()
    alert('规则已提交审核')
  } catch (e) {
    alert(e.message || '提审失败')
  }
}

async function publishRuleFromReview() {
  if (!auth.token) { alert('请先登录'); return }
  const picked = await pickRuleByStatus('REVIEW', '选择要发布的规则序号')
  if (!picked) return
  try {
    await updateRuleStatus(auth.token, picked.id, 'PUBLISHED')
    await syncRulesFromCloud()
    document.getElementById('rule-version').value = picked.version
    alert('规则已发布')
  } catch (e) {
    alert(e.message || '发布失败')
  }
}

async function pickRuleByStatus(status, tip) {
  if (!serverRules.length) await syncRulesFromCloud()
  const list = serverRules.filter(r => r.status === status)
  if (!list.length) {
    alert(`没有状态为 ${status} 的规则`)
    return null
  }
  const names = list.map((r, i) => `${i+1}. ${r.version}`).join('\\n')
  const pick = prompt(`${tip}:\\n${names}`)
  const idx = Number(pick) - 1
  if (idx < 0 || idx >= list.length) return null
  return list[idx]
}

function applyPayload(raw) {
  const d = raw?.payload || raw?.inputPayload || raw
  currentScene = d.scene || 'general'
  document.getElementById('table-length').value = d.tableLength || ''
  document.getElementById('edge-x').value = d.edgeX || ''
  document.getElementById('iphone-y').value = d.iphoneY || ''
  if (document.getElementById('rule-version')) {
    document.getElementById('rule-version').value = d.ruleVersion || DEFAULT_RULE_VERSION
  }
  queueLeft = Array.isArray(d.queueLeft) ? d.queueLeft : []
  queueRight = Array.isArray(d.queueRight) ? d.queueRight : []
  assortGroups = Array.isArray(d.assortGroups) ? d.assortGroups : []
  setScene(currentScene)
  renderQueue('left'); renderQueue('right')
  saveDraft()
}
