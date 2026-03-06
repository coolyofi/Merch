/**
 * layout-engine.js
 * Pure calculation functions for the merchandising layout tool.
 * All units are INCHES.
 */

import { getElementById } from './elements-db.js'

// ── Table presets ─────────────────────────────────────────────────────────
export const TABLE_WIDTH_PRESETS = [
  { label: '7 ft (84")',  value: 84  },
  { label: '8 ft (96")',  value: 96  },
  { label: '10 ft (120")', value: 120 },
  { label: '12 ft (144")', value: 144 },
  { label: '15 ft (180")', value: 180 },
  { label: '20 ft (240")', value: 240 },
]

export const TABLE_DEPTH_DEFAULT = 60   // 60 inches standard depth

// ── Layout modes ──────────────────────────────────────────────────────────
export const LAYOUT_MODES = [
  {
    key:   'single',
    label: '单排',
    desc:  '一条前沿，从左到右排列产品。',
  },
  {
    key:   'double',
    label: '双排',
    desc:  '前沿主展区 + 后沿备选区，各自独立校验宽度。',
  },
  {
    key:   'double-sign',
    label: '双排含标识',
    desc:  '双排布局，前沿两侧自动保留 2×3 Product Sign 空间。',
  },
]

// 2×3 Sign edge reserve in inches by table width
const SIGN_EDGE_RESERVE = {
  84:  7,
  96:  7,
  120: 8,
  144: 8,
  180: 8,
  240: 8,
}

// ── Placed item ────────────────────────────────────────────────────────────
// { instanceId: string, elementId: string, widthOverride?: number }
let _idCounter = 1
export function makeInstanceId() { return `inst-${_idCounter++}` }

export function effectiveWidth(placedItem) {
  const el = getElementById(placedItem.elementId)
  if (!el) return 0
  if (el.allowWidthOverride && placedItem.widthOverride != null) {
    return placedItem.widthOverride
  }
  return el.width
}

// ── Rail calculation ───────────────────────────────────────────────────────
/**
 * @param {object[]} items     - placed items array
 * @param {number}   tableWidth - table width in inches
 * @returns {{ used: number, remaining: number, overBy: number, items: object[] }}
 */
export function calcRail(items, tableWidth) {
  let used = 0
  const enriched = items.map(item => {
    const el   = getElementById(item.elementId)
    const w    = effectiveWidth(item)
    used      += w
    return { ...item, element: el, width: w, xStart: used - w }
  })
  const remaining = tableWidth - used
  return {
    used:      Number(used.toFixed(3)),
    remaining: Number(remaining.toFixed(3)),
    overBy:    remaining < 0 ? Number((-remaining).toFixed(3)) : 0,
    items:     enriched,
  }
}

/**
 * Sign edge reserve for double-sign mode.
 * @param {number} tableWidth
 */
export function signEdgeReserve(tableWidth) {
  const key = Object.keys(SIGN_EDGE_RESERVE)
    .map(Number)
    .sort((a, b) => a - b)
    .find(k => k >= tableWidth) || 240
  return SIGN_EDGE_RESERVE[key] ?? 8
}

/**
 * Validate a complete layout state.
 * @param {object} state - { table, mode, frontRail, backRail }
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateLayout(state) {
  const { table, mode, frontRail, backRail } = state
  const errors   = []
  const warnings = []
  const W = table.width

  if (!W || W <= 0) { errors.push('请先设置桌子宽度。'); return { errors, warnings } }

  const front = calcRail(frontRail, W)
  if (front.overBy > 0) {
    errors.push(`前沿超宽 ${front.overBy.toFixed(2)}"，请移除部分元素。`)
  }
  if (front.items.length === 0 && mode !== 'single') {
    warnings.push('前沿没有放置任何元素。')
  }

  if (mode === 'double' || mode === 'double-sign') {
    const back = calcRail(backRail, W)
    if (back.overBy > 0) {
      errors.push(`后沿超宽 ${back.overBy.toFixed(2)}"，请移除部分元素。`)
    }
  }

  if (mode === 'double-sign') {
    const reserve = signEdgeReserve(W) * 2
    if (front.used > W - reserve) {
      warnings.push(`双排含标识模式下，前沿建议保留两侧各 ${(reserve/2).toFixed(0)}" 给 Product Sign。`)
    }
  }

  if (front.remaining > W * 0.5 && front.items.length > 0) {
    warnings.push(`前沿剩余空间较大（${front.remaining.toFixed(1)}"），可考虑增加元素或使用间距块。`)
  }

  return { errors, warnings }
}

/**
 * Generate full blueprint data for canvas drawing.
 * @param {object} state
 * @returns {object}  Blueprint data
 */
export function generateBlueprintData(state) {
  const { table, mode, frontRail, backRail } = state
  const W = table.width
  const D = table.depth || TABLE_DEPTH_DEFAULT

  const front = calcRail(frontRail, W)
  const back  = (mode === 'double' || mode === 'double-sign')
    ? calcRail(backRail, W)
    : null

  const validation = validateLayout(state)

  return {
    table:      { width: W, depth: D, name: table.name },
    mode,
    front,
    back,
    validation,
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Export state as JSON.
 */
export function exportStateJSON(state) {
  const data = {
    version:     '1.0',
    exportedAt:  new Date().toISOString(),
    table:       state.table,
    mode:        state.mode,
    frontRail:   state.frontRail.map(i => ({ elementId: i.elementId, widthOverride: i.widthOverride })),
    backRail:    state.backRail.map(i => ({ elementId: i.elementId, widthOverride: i.widthOverride })),
  }
  return JSON.stringify(data, null, 2)
}
