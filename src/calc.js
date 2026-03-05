/**
 * calc.js — Pure spacing calculation logic
 * Based on Apple Retail Merchandising Principles
 *
 * All public functions optionally return a `trace` array on the result —
 * an ordered list of human-readable steps explaining how the layout was computed.
 * Consumers can show this in a "How was this calculated?" panel.
 */

// ── iPhone Assortment: Y spacing between 1-device risers within a solution ──
export const IPHONE_Y_BY_TABLE = {
  84:  2,   // 7-foot  = 84"
  96:  3,   // 8-foot  = 96"
  120: 4,   // 10-foot = 120"
  240: 4,   // 20-foot = 240"
  144: 5,   // 12-foot = 144"
  180: 5,   // 15-foot = 180"
}

// 2x3 Signage: edge gap X by table size
export const SIGNAGE_EDGE_BY_TABLE = {
  84:  7,   // 7-foot
  96:  7,   // 8-foot
  120: 8,   // 10-foot+
  144: 8,
  180: 8,
  240: 8,
}

export const DEFAULT_RULE_VERSION = 'Merch v2025.11'
export const RULE_SETS = {
  [DEFAULT_RULE_VERSION]: {
    id: DEFAULT_RULE_VERSION,
    name: 'Merchandising Principles',
    publishedAt: '2025-11-13',
    iphoneYByTable: IPHONE_Y_BY_TABLE,
    signageEdgeByTable: SIGNAGE_EDGE_BY_TABLE,
    dualSide: {
      centerToleranceIn: 1.0,
      microAdjustMaxIn: 1.5,
    },
    rounding: {
      calcPrecision: 3,
      displayPrecision: 2,
      mode: 'half-up',
    },
  },
}

export function getRuleSet(version = DEFAULT_RULE_VERSION) {
  return RULE_SETS[version] || RULE_SETS[DEFAULT_RULE_VERSION]
}

/**
 * General Spacing Principle
 *   X = (A – B) ÷ C
 *   Edge on each side = X ÷ 2  (for tables/walls)
 *   Edge on each side = X      (for wall counters — then divide X by 2 only at ends)
 *
 * @param {number} A  - total table/wall length (inches)
 * @param {number[]} widths - array of solution widths (inches)
 * @returns {{ X: number, edgeLeft: number, edgeRight: number, layout: Array }}
 */
export function calcGeneral(A, widths) {
  const C = widths.length
  const B = widths.reduce((s, w) => s + w, 0)
  if (C === 0 || B >= A) return null
  const X = (A - B) / C
  const edge = X / 2
  const trace = [
    `桌子总长 A = ${A}"`,
    `Solutions 总宽 B = ${widths.map((w, i) => `S${i+1}(${w}")`).join(' + ')} = ${B.toFixed(3)}"`,
    `Solution 数量 C = ${C}`,
    `间距 X = (A − B) ÷ C = (${A} − ${B.toFixed(3)}) ÷ ${C} = ${X.toFixed(3)}"`,
    `两端各留 X÷2 = ${edge.toFixed(3)}"`,
  ]
  return { ...buildLayout(widths, edge, X, X, A, B, C), trace }
}

/**
 * 2x3 Product Signage spacing (iPad / mixed product tables)
 *   - Edge X is fixed (from table-size chart)
 *   - A_inner = A − 2·edgeX
 *   - Internal gap = (A_inner − B) ÷ (C − 1)   [gaps between C solutions = C-1]
 */
export function calcSignage(A, widths, edgeX) {
  const C = widths.length
  const B = widths.reduce((s, w) => s + w, 0)
  if (C === 0) return null
  if (C === 1) {
    const edge = (A - B) / 2
    const trace = [
      `单个 Solution，居中对齐`,
      `桌子总长 A = ${A}"，Solution 宽 B = ${B}"`,
      `边缘距离 = (A − B) ÷ 2 = ${edge.toFixed(3)}"`,
    ]
    return { ...buildLayout(widths, edge, 0, 0, A, B, C, edgeX), trace }
  }
  const A_inner = A - 2 * edgeX
  const gaps = C - 1
  if (A_inner <= B) return null
  const gapX = (A_inner - B) / gaps
  const trace = [
    `2×3 展架桌：边缘 X 由桌型查表固定 = ${edgeX}"`,
    `桌子总长 A = ${A}"，两端各 ${edgeX}" → 内部可用区 A_inner = A − 2×${edgeX} = ${A_inner.toFixed(3)}"`,
    `Solutions 总宽 B = ${B.toFixed(3)}"，Solution 数 C = ${C}`,
    `内部间距 = (A_inner − B) ÷ (C−1) = (${A_inner.toFixed(3)} − ${B.toFixed(3)}) ÷ ${gaps} = ${gapX.toFixed(3)}"`,
  ]
  return { ...buildLayout(widths, edgeX, gapX, gapX, A, B, C, edgeX), trace }
}

/**
 * iPhone Comparison Table — General Spacing Principle applied to risers as solutions
 * Same as calcGeneral; exposed separately for clarity.
 */
export function calcIphoneComparison(A, widths) {
  return calcGeneral(A, widths)
}

/**
 * iPhone Assortment Table
 *   Step 1: Y spacing between 1-device risers within each solution (from table)
 *   Step 2: General Spacing Principle across solutions
 *
 * @param {number} A  table length
 * @param {{ count: number, riserWidth: number }[]} groups  each group = one solution
 * @param {number} Y  spacing between risers within a solution
 * @returns {{ X, Y, edgeLeft, solutions[], layout[] }}
 */
export function calcIphoneAssortment(A, groups, Y) {
  // Compute each solution's total width
  const widths = groups.map(g => {
    if (g.count <= 0) return 0
    return g.count * g.riserWidth + (g.count - 1) * Y
  })
  const result = calcGeneral(A, widths)
  if (!result) return null
  const trace = [
    `iPhone 组合桌：每组 Riser 数 + Y 间距先算出各 Solution 宽度`,
    ...groups.map((g, i) =>
      `  组 ${i+1}：${g.count} × ${g.riserWidth}" + ${g.count-1} × Y(${Y}") = ${widths[i].toFixed(3)}"`),
    `再用通用原则排布 ${groups.length} 个 Solution：`,
    ...(result.trace || []),
  ]
  return { ...result, Y, groups, trace }
}

/**
 * Dual-side comparison tables:
 * - Compute top and bottom independently with General Spacing Principle.
 * - Compare center alignment pair-by-pair.
 * - If |delta| <= 1" => aligned
 * - If 1" < |delta| <= 1.5" => minor adjustment allowed
 * - If > 1.5" => major misalignment warning
 */
export function calcDoubleSide(A, topWidths, bottomWidths, opts = {}) {
  const {
    centerTolerance = 1.0,
    microAdjustMax = 1.5,
    ruleVersion = DEFAULT_RULE_VERSION,
  } = opts
  const top = calcGeneral(A, topWidths)
  const bottom = calcGeneral(A, bottomWidths)
  if (!top || !bottom) return null

  const pairCount = Math.min(top.layout.length, bottom.layout.length)
  const pairs = []
  let alignedCount = 0
  let minorAdjustCount = 0
  let majorCount = 0

  for (let i = 0; i < pairCount; i++) {
    const topCenter = top.layout[i].center
    const bottomCenter = bottom.layout[i].center
    const delta = topCenter - bottomCenter
    const absDelta = Math.abs(delta)
    let status = 'aligned'
    if (absDelta <= centerTolerance) {
      status = 'aligned'
      alignedCount += 1
    } else if (absDelta <= microAdjustMax) {
      status = 'minor-adjust'
      minorAdjustCount += 1
    } else {
      status = 'major-misalignment'
      majorCount += 1
    }
    pairs.push({
      index: i,
      topCenter,
      bottomCenter,
      delta,
      absDelta,
      status,
      suggestedAdjustment: status === 'minor-adjust' ? Number(delta.toFixed(3)) : 0,
    })
  }

  const warnings = []
  if (top.layout.length !== bottom.layout.length) {
    warnings.push(`上下侧 solution 数不一致（上侧 ${top.layout.length}，下侧 ${bottom.layout.length}），仅对齐前 ${pairCount} 组。`)
  }
  if (majorCount > 0) {
    warnings.push(`${majorCount} 组中心偏差超过 ${microAdjustMax}"，需重新排布而非微调。`)
  }
  if (minorAdjustCount > 0) {
    warnings.push(`${minorAdjustCount} 组可通过 1~${microAdjustMax}" 微调完成中心对齐。`)
  }

  const trace = [
    `双面计算：上侧与下侧分别独立计算（General Spacing Principle）。`,
    `上侧：X=${top.X.toFixed(3)}"，边缘=${top.edgeLeft.toFixed(3)}"`,
    `下侧：X=${bottom.X.toFixed(3)}"，边缘=${bottom.edgeLeft.toFixed(3)}"`,
    `中心对齐检查：容差=${centerTolerance}"，允许微调上限=${microAdjustMax}"`,
    ...pairs.map((p) => `  组 ${p.index + 1}: Δcenter=${p.delta.toFixed(3)}" -> ${p.status}`),
    ...(warnings.length ? ['告警：', ...warnings.map((w) => `  - ${w}`)] : ['全部 pair 在容差内，无需微调。']),
  ]

  return {
    mode: 'double',
    A,
    top,
    bottom,
    alignment: {
      centerTolerance,
      microAdjustMax,
      pairCount,
      alignedCount,
      minorAdjustCount,
      majorCount,
      pairs,
    },
    warnings,
    trace,
    ruleVersion,
  }
}

// ─── helpers ───────────────────────────────────────────────────────────────

function buildLayout(widths, edgeLeft, gapBetween, gapRight, A, B, C, fixedEdge = null) {
  const layout = []
  let cursor = edgeLeft
  for (let i = 0; i < widths.length; i++) {
    const w = widths[i]
    layout.push({
      index: i,
      width: w,
      start: cursor,
      center: cursor + w / 2,
      end: cursor + w,
    })
    cursor += w + gapBetween
  }
  return {
    A, B, C,
    X: gapBetween,
    edgeLeft,
    edgeRight: A - layout[layout.length - 1].end,
    fixedEdge,
    layout,
  }
}
