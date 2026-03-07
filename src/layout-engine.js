/**
 * layout-engine.js
 * Pure calculation functions for the merchandising layout tool.
 * All units are INCHES.
 */

import { getElementById } from './elements-db.js'
import {
  calcIpadTable, calcIpadSignageTable, calcIpadGrouped, calcGeneral,
  IPAD_Y_GAP, IPAD_Z_GAP,
  getIpadGaps, nearestKey,
} from './calc.js'

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

// ── Rail modes ────────────────────────────────────────────────────────────
export const LAYOUT_MODES = [
  { key: 'single', label: '单排', desc: '一条前沿，从左到右排列产品。' },
  { key: 'double', label: '双排', desc: '前沿主展区 + 后沿备选区，各自独立校验宽度。' },
]

// ── Product families ──────────────────────────────────────────────────────
export const PRODUCT_FAMILIES = [
  { key: 'ipad',   label: 'iPad',   available: true  },
  { key: 'iphone', label: 'iPhone', available: false },
  { key: 'mac',    label: 'Mac',    available: false },
]

// ── iPad table modes ──────────────────────────────────────────────────────
// Each mode maps to a calc scene and a human label.
export const IPAD_MODES = [
  {
    key:         'no-sign',
    label:       '无 2×3 展架标牌',
    calcScene:   'ipadTable',
    desc:        '通用间距原则 X=(A-B)÷C，两端各 X÷2。组内多设备用 Y 间距 7ft:3" · 8ft:4" · 10ft+:5"',
    tag:         'Riser · Smart Folio · 横屏陈列',
  },
  {
    key:         'with-sign',
    label:       '含 2×3 展架标牌',
    calcScene:   'ipadSignage',
    desc:        '端距 X 固定（7/8ft:7" · 10ft+:8"），内部间距均分 (A_inner-B)÷(C-1)。',
    tag:         '标牌 + 设备 = 一个 Solution',
  },
  {
    key:         'keyboard',
    label:       'Magic Keyboard 套装',
    calcScene:   'ipadTable',
    desc:        'iPad + Keyboard 为一个 Solution，通用间距原则居中排布。屏幕 65°。',
    tag:         '前沿置 Line 1',
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

// ── Sign constants ────────────────────────────────────────────────────────
export const SIGN_WIDTH = 3   // 2×3 Sign footprint width in inches
export const SIGN_GAP   = 1   // Fixed gap between sign and device (always 1")

// ── Placed item ────────────────────────────────────────────────────────────
// { instanceId, elementId, widthOverride?, hasSign?, isLandscape?, solutionId? }
// solutionId: items sharing the same solutionId form one solution (group).
//   - hasSign on items[0] of a group = lead sign (2×3 to the LEFT/RIGHT of solution).
//   - hasSign on items[i>0] of a group = sign between this and prev device → Z gap.
let _idCounter = 1
export function makeInstanceId() { return `inst-${_idCounter++}` }

/** Can this element be rotated to landscape? (iPad products only) */
export function canLandscape(el) {
  return el && el.family === 'iPad' && el.type === 'product' && el.depth > 0
}

// ── Solution / Group helpers ───────────────────────────────────────────────
/**
 * Group a flat array of placed items into solutions.
 * Items with the same solutionId are in the same group (must be consecutive).
 * Items without solutionId each form their own single-item group.
 */
export function groupBySolution(items) {
  const groups = []
  const indexMap = new Map() // solutionId → groups index
  items.forEach(item => {
    const sid = item.solutionId || item.instanceId
    if (!indexMap.has(sid)) {
      indexMap.set(sid, groups.length)
      groups.push({ solutionId: sid, items: [] })
    }
    groups[indexMap.get(sid)].items.push(item)
  })
  return groups
}

/**
 * Compute total footprint width of one solution group.
 *  - items[0].hasSign = lead sign, adds SIGN_WIDTH + SIGN_GAP before the device.
 *  - items[i>0].hasSign = sign-between: Z gap used before that device (sign within the Z gap).
 *  - items without hasSign use Y gap (between consecutive devices within the group).
 */
export function solutionGroupWidth(group, tableWidth) {
  const { Y, Z } = getIpadGaps(tableWidth)
  const { items } = group
  if (!items || items.length === 0) return 0
  let w = 0
  items.forEach((item, i) => {
    const dw = deviceWidth(item)
    if (i === 0) {
      if (item.hasSign) w += SIGN_WIDTH + SIGN_GAP   // lead sign
      w += dw
    } else {
      // hasSign on non-first = sign between this and prev → Z gap
      w += (item.hasSign ? Z : Y) + dw
    }
  })
  return w
}

/** Can this element carry a 2×3 sign? (real products/bundles/props — not signs/spacers) */
export function canSign(el) {
  return el && (el.type === 'product' || el.type === 'bundle' || el.type === 'prop')
}

/**
 * Effective width of a placed item.
 * Respects: isLandscape (swap width↔depth for iPad products),
 *           widthOverride, hasSign (prepend 3" sign + 1" gap).
 */
export function effectiveWidth(placedItem) {
  const el = getElementById(placedItem.elementId)
  if (!el) return 0

  let base
  if (placedItem.isLandscape && canLandscape(el)) {
    // landscape = rotate: width becomes depth
    base = el.depth
  } else if (el.allowWidthOverride && placedItem.widthOverride != null) {
    base = placedItem.widthOverride
  } else {
    base = el.width
  }

  // 2×3 sign is left of device, 1" gap — adds to solution width
  return placedItem.hasSign ? base + SIGN_WIDTH + SIGN_GAP : base
}

/** Device-only width (excludes the sign portion, used for display) */
export function deviceWidth(placedItem) {
  const el = getElementById(placedItem.elementId)
  if (!el) return 0
  if (placedItem.isLandscape && canLandscape(el)) return el.depth
  if (el.allowWidthOverride && placedItem.widthOverride != null) return placedItem.widthOverride
  return el.width
}

// ── Spaced layout (real calc) ─────────────────────────────────────────────
/**
 * Compute a spaced layout using the Apple Merchandising Principles calc functions.
 * Respects solutionId grouping: items sharing a solutionId are one solution.
 *   - items[0] in group with hasSign = lead sign (adds 4" to solution, on the
 *     customer-facing left side of the solution)
 *   - items[i>0] in group with hasSign = sign-between → uses Z gap before that device
 * Returns enriched items with correct xStart positions.
 *
 * @param {object[]} items      - placed items (may have solutionId)
 * @param {number}   tableWidth - table width in inches
 * @param {string}   calcScene  - 'ipadTable' | 'ipadSignage' | 'general'
 * @param {string}   [rail]     - 'front' | 'back' (affects sign-side on items)
 * @returns {{ items, spacing, fits, used, remaining }}
 */
export function computeSpacedLayout(items, tableWidth, calcScene, rail = 'front') {
  if (!tableWidth || items.length === 0) {
    return { items: [], spacing: null, fits: true, used: 0, remaining: tableWidth || 0 }
  }

  const A = tableWidth
  const groups = groupBySolution(items)
  const { Y, Z } = getIpadGaps(A)

  // Compute solution-level widths (respecting lead sign + Y/Z internal gaps)
  const solutionWidths = groups.map(g => solutionGroupWidth(g, A))

  let calcResult = null
  if (calcScene === 'ipadTable' || calcScene === 'ipadSignage') {
    calcResult = calcScene === 'ipadSignage'
      ? calcIpadSignageTable(A, solutionWidths)
      : calcIpadTable(A, solutionWidths)
  }
  if (!calcResult) {
    calcResult = calcGeneral(A, solutionWidths)
  }

  const used = Number(solutionWidths.reduce((s, w) => s + w, 0).toFixed(3))
  const signSide = rail === 'back' ? 'right' : 'left'

  // Can't fit — return sequential positions
  if (!calcResult) {
    let x = 0
    const enriched = groups.flatMap(g => {
      const lastDi = g.items.length - 1
      const sw = solutionGroupWidth(g, A)
      return g.items.map((item, di) => {
        const dw = deviceWidth(item)
        const start = x
        if (di === lastDi) x = Number((x + sw).toFixed(3))
        const xOffset = di === 0 && item.hasSign && signSide === 'left'
          ? SIGN_WIDTH + SIGN_GAP
          : 0
        const devXStart = start + xOffset
        // signXStart: physical X (inches) where the lead sign block starts.
        // Front rail: left of device  [sign | gap | device]
        // Back rail:  right of solution end  [device ... | gap | sign]
        const signXStart = di === 0 && item.hasSign
          ? (signSide === 'right'
              ? start + sw - SIGN_WIDTH          // solutionEnd − 3"
              : devXStart - SIGN_WIDTH - SIGN_GAP)  // left of device
          : undefined
        return {
          ...item,
          element:       getElementById(item.elementId),
          width:         dw,
          xStart:        devXStart,
          center:        devXStart + dw / 2,
          signSide,
          signXStart,
          hasSignBefore: di > 0 && !!item.hasSign,
        }
      })
    })
    return {
      items:     enriched,
      spacing:   null,
      fits:      false,
      used,
      remaining: Number((A - used).toFixed(3)),
    }
  }

  // Expand solution positions to item-level positions
  const enriched = []
  groups.forEach((g, gi) => {
    const solStart = calcResult.layout[gi].start
    let cursor = solStart

    // For back rail: sign goes on the RIGHT of the solution.
    // Solution occupies [solStart … solStart + solutionWidth].
    // Front: [sign(3") | gap(1") | dev1 | Y/Z | dev2 ...]
    // Back:  [dev1 | Y/Z | dev2 ... | gap(1") | sign(3")]
    // We compute device xStart positions left-to-right for both rails.
    // The render layer (rail UI + canvas) uses signSide to draw sign on correct side.

    g.items.forEach((item, di) => {
      const dw = deviceWidth(item)

      let devXStart
      if (di === 0) {
        if (item.hasSign && signSide === 'left') {
          // Lead sign on left: device starts after sign footprint
          devXStart = cursor + SIGN_WIDTH + SIGN_GAP
          cursor = devXStart + dw
        } else if (item.hasSign && signSide === 'right') {
          // Lead sign on right: device starts at solution start (sign is at END)
          devXStart = cursor
          cursor = devXStart + dw
        } else {
          devXStart = cursor
          cursor = devXStart + dw
        }
      } else {
        const gap = item.hasSign ? Z : Y
        cursor += gap
        devXStart = cursor
        cursor += dw
      }

      // signXStart: physical X (inches) where the lead sign block starts.
      // Computed once on items[0]; undefined for all other items.
      // Front: [sign | gap | device]  → signXStart = devXStart − SIGN_W − SIGN_G
      // Back:  [device ... | gap | sign] → signXStart = solutionEnd − SIGN_W
      const solEnd = solStart + solutionWidths[gi]
      const signXStart = di === 0 && item.hasSign
        ? (signSide === 'right'
            ? Number((solEnd - SIGN_WIDTH).toFixed(3))
            : Number((devXStart - SIGN_WIDTH - SIGN_GAP).toFixed(3)))
        : undefined

      enriched.push({
        ...item,
        element:        getElementById(item.elementId),
        width:          Number(dw.toFixed(3)),
        xStart:         Number(devXStart.toFixed(3)),
        center:         Number((devXStart + dw / 2).toFixed(3)),
        solutionStart:  Number(solStart.toFixed(3)),
        solutionWidth:  Number(solutionWidths[gi].toFixed(3)),
        signSide,
        signXStart,
        hasSignBefore:  di > 0 && !!item.hasSign,
        signGapWidth:   di > 0 && !!item.hasSign ? Z : 0,
      })
    })
  })

  return {
    items:     enriched,
    spacing:   calcResult,
    fits:      true,
    used,
    remaining: Number((A - used).toFixed(3)),
  }
}

// ── Rail calculation (simple — for usage bars & summary width checks) ─────
/**
 * @param {object[]} items     - placed items array
 * @param {number}   tableWidth - table width in inches
 * @returns {{ used: number, remaining: number, overBy: number, items: object[] }}
 */
export function calcRail(items, tableWidth) {
  // Use solution-group widths so sign-between-devices (Z gap) isn't double-counted
  const groups = groupBySolution(items)
  let used = 0
  const enriched = items.map(item => {
    const el = getElementById(item.elementId)
    const w  = deviceWidth(item)
    return { ...item, element: el, width: w, xStart: used }
  })
  groups.forEach(g => { used += solutionGroupWidth(g, tableWidth) })
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
  const { table, mode, frontRail, backRail, calcScene } = state
  const errors   = []
  const warnings = []
  const W = table.width

  if (!W || W <= 0) { errors.push('请先设置桌子宽度。'); return { errors, warnings } }

  const front = calcRail(frontRail, W)
  if (front.overBy > 0) {
    errors.push(`前沿超宽 ${front.overBy.toFixed(2)}"，请移除部分元素。`)
  }

  // Spacing feasibility via real calc engine
  if (frontRail.length > 0 && calcScene) {
    const frontSpaced = computeSpacedLayout(frontRail, W, calcScene, 'front')
    if (!frontSpaced.fits) {
      errors.push('按陈列间距规则排不下，请减少设备数量或增大桌宽。')
    }
  }

  if (front.items.length === 0 && mode !== 'single') {
    warnings.push('前沿没有放置任何元素。')
  }

  if (mode === 'double' || mode === 'double-sign') {
    const back = calcRail(backRail, W)
    if (back.overBy > 0) {
      errors.push(`后沿超宽 ${back.overBy.toFixed(2)}"，请移除部分元素。`)
    }
    if (backRail.length > 0 && calcScene) {
      const backSpaced = computeSpacedLayout(backRail, W, calcScene, 'back')
      if (!backSpaced.fits) {
        errors.push('后沿按陈列间距规则排不下，请减少设备数量或增大桌宽。')
      }
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
 * Re-place items in a spaced result by centering each solution on the
 * corresponding slot in `primaryLayout`.  Returns new items array and a
 * "center-aligned" spacing object suitable for dimension annotations.
 *
 * @param {{ items, spacing }} secondarySpaced – independently computed secondary rail
 * @param {object[]}           primaryLayout   – solution-level layout from primary rail
 * @param {number}             W               – table width
 */
function applyCenterAlignment(secondarySpaced, primaryLayout, W) {
  const groups  = groupBySolution(secondarySpaced.items)
  const { Y, Z } = getIpadGaps(W)
  const newItems = []

  groups.forEach((g, gi) => {
    if (gi >= primaryLayout.length) return
    const primaryCenter = primaryLayout[gi].center
    const solutionW     = solutionGroupWidth(g, W)
    const newSolStart   = primaryCenter - solutionW / 2
    let   cursor        = newSolStart
    const signSide      = secondarySpaced.items.find(i => i.signSide)?.signSide || 'right'

    g.items.forEach((item, di) => {
      const dw = deviceWidth(item)
      let devXStart
      if (di === 0) {
        if (item.hasSign && signSide === 'left') {
          devXStart = cursor + SIGN_WIDTH + SIGN_GAP
          cursor    = devXStart + dw
        } else {
          devXStart = cursor
          cursor    = devXStart + dw
        }
      } else {
        cursor   += item.hasSign ? Z : Y
        devXStart = cursor
        cursor   += dw
      }
      // Recompute signXStart for the lead item after center-alignment shift.
      const solEnd = newSolStart + solutionW
      const signXStart = di === 0 && item.hasSign
        ? (signSide === 'right'
            ? Number((solEnd - SIGN_WIDTH).toFixed(3))
            : Number((devXStart - SIGN_WIDTH - SIGN_GAP).toFixed(3)))
        : undefined
      newItems.push({
        ...item,
        xStart:        Number(devXStart.toFixed(3)),
        center:        Number((devXStart + dw / 2).toFixed(3)),
        solutionStart: Number(newSolStart.toFixed(3)),
        solutionWidth: Number(solutionW.toFixed(3)),
        signXStart,
      })
    })
  })

  // Build per-solution layout for dimension annotations
  const secWidths = groups.map(g => solutionGroupWidth(g, W))
  const alignedLayout = primaryLayout.map((pl, i) => {
    const sw    = secWidths[i] ?? 0
    const start = pl.center - sw / 2
    return { index: i, width: sw, start, center: pl.center, end: start + sw }
  })
  const centerAlignedSpacing = {
    ...secondarySpaced.spacing,
    layout:        alignedLayout,
    X:             null,          // non-uniform — don't label "X"
    edgeLeft:      alignedLayout[0]?.start ?? 0,
    edgeRight:     W - (alignedLayout[alignedLayout.length - 1]?.end ?? W),
    centerAligned: true,
  }
  return { items: newItems, spacing: centerAlignedSpacing }
}

/**
 * Generate full blueprint data for canvas drawing.
 *
 * When both sides have the same solution count (double mode):
 *   – Primary side   = larger total footprint → laid out with General Spacing.
 *   – Secondary side = each solution center-aligned to the opposite primary center.
 *
 * @param {object} state
 * @returns {object}  Blueprint data
 */
export function generateBlueprintData(state) {
  const { table, mode, frontRail, backRail, calcScene } = state
  const W = table.width
  const D = table.depth || TABLE_DEPTH_DEFAULT
  const scene = calcScene || 'general'

  const frontSpaced = computeSpacedLayout(frontRail, W, scene, 'front')
  const backSpaced  = (mode === 'double' || mode === 'double-sign')
    ? computeSpacedLayout(backRail, W, scene, 'back')
    : null

  // ── Apply primary/secondary center-alignment when both sides fit & counts match ──
  if (backSpaced && frontSpaced.fits && backSpaced.fits &&
      frontSpaced.spacing && backSpaced.spacing) {
    const frontCount = frontSpaced.spacing.layout.length
    const backCount  = backSpaced.spacing.layout.length
    if (frontCount === backCount) {
      const frontIsPrimary = frontSpaced.spacing.B >= backSpaced.spacing.B
      const primaryLayout  = frontIsPrimary
        ? frontSpaced.spacing.layout
        : backSpaced.spacing.layout
      if (frontIsPrimary) {
        const aligned = applyCenterAlignment(backSpaced, primaryLayout, W)
        backSpaced.items   = aligned.items
        backSpaced.spacing = aligned.spacing
      } else {
        const aligned = applyCenterAlignment(frontSpaced, primaryLayout, W)
        frontSpaced.items   = aligned.items
        frontSpaced.spacing = aligned.spacing
      }
    }
  }

  const front = {
    items:     frontSpaced.items,
    used:      frontSpaced.used,
    remaining: frontSpaced.remaining,
    overBy:    frontSpaced.remaining < 0 ? Number((-frontSpaced.remaining).toFixed(3)) : 0,
    spacing:   frontSpaced.spacing,
    fits:      frontSpaced.fits,
  }

  const back = backSpaced ? {
    items:     backSpaced.items,
    used:      backSpaced.used,
    remaining: backSpaced.remaining,
    overBy:    backSpaced.remaining < 0 ? Number((-backSpaced.remaining).toFixed(3)) : 0,
    spacing:   backSpaced.spacing,
    fits:      backSpaced.fits,
  } : null

  const validation = validateLayout(state)

  return {
    table:       { width: W, depth: D, name: table.name },
    mode,
    calcScene:   scene,
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
    version:       '1.2',
    exportedAt:    new Date().toISOString(),
    table:         state.table,
    mode:          state.mode,
    productFamily: state.productFamily || null,
    ipadMode:      state.ipadMode      || null,
    calcScene:     state.calcScene     || 'general',
    frontRail:  state.frontRail.map(i => ({
      elementId:     i.elementId,
      widthOverride: i.widthOverride ?? null,
      hasSign:       !!i.hasSign,
      isLandscape:   !!i.isLandscape,
      solutionId:    i.solutionId ?? null,
    })),
    backRail:   state.backRail.map(i => ({
      elementId:     i.elementId,
      widthOverride: i.widthOverride ?? null,
      hasSign:       !!i.hasSign,
      isLandscape:   !!i.isLandscape,
      solutionId:    i.solutionId ?? null,
    })),
  }
  return JSON.stringify(data, null, 2)
}
