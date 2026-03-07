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

// iPad grouping gaps (between hero devices)
// Y = normal device-to-device gap; Z = gap when a 2×3 product sign sits between two devices
// Source: iPad Device Assortment Spacing table
//   2.1m (7-ft / 84")  → Y=3"  Z=5"
//   2.4m (8-ft / 96")  → Y=4"  Z=6"
//   3m+  (10-ft / 120"+) → Y=5"  Z=6"
export const IPAD_Y_GAP = { 84:3, 96:4, 120:5, 144:5, 180:5, 240:5 }
export const IPAD_Z_GAP = { 84:5, 96:6, 120:6, 144:6, 180:6, 240:6 }
export const MULTI_HERO_GAP = 5

// iPad dual-side table types
// 'ipad-assortment' : each side has different device counts → independent spacing, NO alignment required
// 'ipad-comparison' : devices must be aligned across both sides
export const IPAD_TABLE_TYPE = {
  ASSORTMENT: 'ipad-assortment',
  COMPARISON:  'ipad-comparison',
}

// ── internal helper: find nearest map key >= A (or the largest key) ─────────
export function nearestKey(A, map) {
  const keys = Object.keys(map || {}).map(Number).sort((a, b) => a - b)
  for (const k of keys) if (A <= k) return k
  return keys[keys.length - 1] ?? null
}

/** Return Y and Z iPad gaps for a given table width */
export function getIpadGaps(tableWidth) {
  const Yk = nearestKey(tableWidth, IPAD_Y_GAP)
  const Zk = nearestKey(tableWidth, IPAD_Z_GAP)
  return {
    Y: Yk != null ? IPAD_Y_GAP[Yk] : 5,
    Z: Zk != null ? IPAD_Z_GAP[Zk] : 6,
  }
}

/**
 * Compute total width of a multi-device iPad solution group.
 *   - deviceWidths: array of individual device widths
 *   - signBetween:  boolean[] of length (n-1); true = sign between devices[i] and [i+1]
 *                  → uses Z gap (sign sits within that Z space, no extra width added)
 *   - tableWidth:   used to look up Y/Z from table
 * Returns the combined footprint width (devices + gaps, no lead sign).
 */
export function ipadGroupWidth(deviceWidths, signBetween, tableWidth) {
  const { Y, Z } = getIpadGaps(tableWidth)
  if (deviceWidths.length === 0) return 0
  if (deviceWidths.length === 1) return deviceWidths[0]
  let w = deviceWidths[0]
  for (let i = 1; i < deviceWidths.length; i++) {
    const useZ = Array.isArray(signBetween) ? !!signBetween[i - 1] : false
    w += (useZ ? Z : Y) + deviceWidths[i]
  }
  return w
}

export const DEFAULT_RULE_VERSION = 'Merch v2025.11'
export const RULE_SETS = {
  [DEFAULT_RULE_VERSION]: {
    id: DEFAULT_RULE_VERSION,
    name: 'Merchandising Principles',
    publishedAt: '2025-11-13',
    iphoneYByTable: IPHONE_Y_BY_TABLE,
    signageEdgeByTable: SIGNAGE_EDGE_BY_TABLE,
    ipadYGap: IPAD_Y_GAP,
    ipadZGap: IPAD_Z_GAP,
    // iPad dual-side table spacing rules:
    //   assortment (系列产品展示桌): sides have different device counts → independent
    //     spacing per side, devices do NOT need to be aligned across sides.
    //   comparison (对比展示桌): devices must be center-aligned across both sides.
    ipadTableTypes: IPAD_TABLE_TYPE,
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

export function calcFixedGap(A, widths, gap) {
  const C = widths.length
  if (C === 0) return null
  const B = widths.reduce((s,w)=>s+w,0)
  const total = B + gap * (C - 1)
  const edge = (A - total) / 2
  if (edge < 0) return null
  const trace = [
    `固定间距 = ${gap.toFixed(3)}"`,
    `总宽 B = ${B.toFixed(3)}"，Solution 数 C = ${C}`,
    `边缘 = (A − (B + gap·(C−1))) ÷ 2 = (${A} − ${total.toFixed(3)}) ÷ 2 = ${edge.toFixed(3)}"`,
  ]
  const layout = widths.map((w, i) => {
    const start = edge + i * (w + gap)
    return { index: i, width: w, start, center: start + w/2, end: start + w }
  })
  return {
    A, B, C,
    X: gap,
    edgeLeft: edge,
    edgeRight: edge,
    layout,
    trace,
    fixedGap: gap,
  }
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
 * iPad Table — no 2×3 Product Signage
 *   Uses General Spacing Principle: X = (A − B) ÷ C, edge = X ÷ 2
 *
 * NOTE: Y gap (IPAD_Y_GAP) is for spacing WITHIN a multi-device solution.
 * Between individual solutions (each a hero device or group), use general formula.
 *
 * Principles reference: General Spacing Principle → (A-B) ÷ C = X
 *   7-ft table Y=3"  (within group), 8-ft Y=4", 10-ft+ Y=5"
 *
 * @param {number}   A      – table length in inches
 * @param {number[]} widths – solution widths (each solution = 1 or more devices)
 */
export function calcIpadTable(A, widths) {
  // Apply General Spacing Principle between solutions
  const result = calcGeneral(A, widths)
  if (!result) return null
  const C = widths.length
  const trace = [
    `iPad 桌（无 2×3 展架标牌）— 通用间距原则`,
    `X = (A − B) ÷ C，两端各留 X ÷ 2`,
    `桌子总长 A = ${A}"，Solution 数 C = ${C}`,
    ...(result.trace || []),
  ]
  return { ...result, ipadTable: true, trace }
}

/**
 * iPad Table with grouped multi-device solutions.
 *   - Each group may have 1–N devices.
 *   - Within a group: Y gap between devices by default;
 *     Z gap (IPAD_Z_GAP) when a 2×3 sign sits between two consecutive devices.
 *   - Between groups: General Spacing Principle X = (A − B) ÷ C, edge = X ÷ 2.
 *
 * @param {number} A - table length in inches
 * @param {{ items: {width:number, hasSign:boolean}[], leadSignWidth?:number }[]} groups
 *   Each group = one solution.  items[0] may have a "lead sign" (already included
 *   in leadSignWidth if pre-computed).  items[i>0].hasSign = true means 2×3 sign
 *   is between items[i-1] and items[i] → Z gap is used for that slot.
 */
export function calcIpadGrouped(A, groups) {
  const { Y, Z } = getIpadGaps(A)

  // Compute each group's total footprint width
  const solutionWidths = groups.map(g => {
    if (!g.items || g.items.length === 0) return 0
    let w = (g.leadSignWidth ?? 0)
    g.items.forEach((item, i) => {
      if (i === 0) {
        w += item.width
      } else {
        // hasSign on non-first item = sign sits between this and previous → Z gap
        w += (item.hasSign ? Z : Y) + item.width
      }
    })
    return w
  })

  // Apply General Spacing Principle to the solutions
  const outer = calcGeneral(A, solutionWidths)
  if (!outer) return null

  // Build item-level layout by expanding each group
  const itemLayout = []
  groups.forEach((g, gi) => {
    let cursor = outer.layout[gi].start + (g.leadSignWidth ?? 0)
    g.items.forEach((item, di) => {
      if (di > 0) cursor += item.hasSign ? Z : Y
      itemLayout.push({
        groupIndex:   gi,
        deviceIndex:  di,
        width:        item.width,
        start:        cursor,
        center:       cursor + item.width / 2,
        end:          cursor + item.width,
        hasSignBefore: di > 0 && !!item.hasSign,
      })
      cursor += item.width
    })
  })

  const trace = [
    `iPad 分组桌：组内 Y=${Y}" / Z=${Z}"（有标牌时），组间通用原则`,
    ...groups.map((g, i) => `  组 ${i+1}：${g.items.length} 台设备，总宽 ${solutionWidths[i].toFixed(3)}"`),
    ...outer.trace,
  ]

  return {
    ...outer,
    Y, Z,
    solutionWidths,
    solutionLayout: outer.layout,
    layout:         itemLayout,
    ipadGrouped:    true,
    trace,
  }
}

/**
 * iPad Table with 2×3 Product Signage
 *   Edge X is fixed by table size (SIGNAGE_EDGE_BY_TABLE)
 *   Internal gap = (A_inner − B) ÷ (C − 1)     [C = number of solutions]
 *
 * Principles reference (2×3 Product Signage Spacing Guidance > iPad Tables):
 *   7-ft → X=7"   8-ft → X=7"   10-ft+ → X=8"
 *   A_inner = A − 2×X
 *   gap between solutions = (A_inner − B) ÷ (C − 1)
 *
 * IMPORTANT: when a solution contains two hero iPads with signage between them,
 * use Z gap (IPAD_Z_GAP) when building that solution's total width before
 * passing it in via `widths`.
 *
 * @param {number}   A      – table length in inches
 * @param {number[]} widths – pre-computed solution widths (sign + device(s))
 */
export function calcIpadSignageTable(A, widths) {
  const key   = nearestKey(A, SIGNAGE_EDGE_BY_TABLE)
  const edgeX = key != null ? SIGNAGE_EDGE_BY_TABLE[key] : 8
  const result = calcSignage(A, widths, edgeX)
  if (!result) return null
  const trace = [
    `iPad 桌（含 2×3 展架标牌）`,
    `桌子总长 A = ${A}"，查表键 = ${key}" → 两端边距 X = ${edgeX}"`,
    ...(result.trace || []),
  ]
  return { ...result, ipadSignage: true, trace }
}

/**
 * Dual-side comparison tables — Merchandising Principle:
 *
 * Step 1: Identify the PRIMARY side (more solutions; ties broken by total footprint).
 * Step 2: Calculate PRIMARY side with General Spacing Principle.
 * Step 3a: If both sides have the SAME solution count → derive secondary positions
 *          by centering each solution directly under its primary counterpart.
 *          Allow ±1–1.5" micro-adjustment when overlap/boundary issues arise.
 * Step 3b: If side counts DIFFER → calculate each side independently, then
 *          check center alignment for the overlapping pairs.
 *
 * @param {number}   A              – table length (inches)
 * @param {number[]} topWidths      – solution widths on top (back) side
 * @param {number[]} bottomWidths   – solution widths on bottom (front) side
 * @param {object}   opts
 * @param {number}   opts.centerTolerance   – max Δcenter still considered "aligned" (default 1")
 * @param {number}   opts.microAdjustMax    – max allowed micro-adjustment (default 1.5")
 * @param {string}   opts.tableType         – 'ipad-assortment' | 'ipad-comparison' | null
 *   'ipad-assortment': each side calculated independently, no alignment needed
 *   'ipad-comparison': devices must be aligned across sides
 *   null (default): alignment determined by whether side counts match
 */
export function calcDoubleSide(A, topWidths, bottomWidths, opts = {}) {
  const {
    centerTolerance = 1.0,
    microAdjustMax = 1.5,
    ruleVersion = DEFAULT_RULE_VERSION,
    tableType = null,
  } = opts

  const topCount    = topWidths.length
  const bottomCount = bottomWidths.length
  const topB        = topWidths.reduce((s, w) => s + w, 0)
  const bottomB     = bottomWidths.reduce((s, w) => s + w, 0)

  // Alignment mode:
  //  ipad-assortment → always independent (sides have different device counts, no alignment)
  //  ipad-comparison  → always center-aligned (devices must align across sides)
  //  default          → align when counts match
  let sameCount
  if (tableType === IPAD_TABLE_TYPE.ASSORTMENT) {
    sameCount = false   // force independent — no alignment for assortment tables
  } else if (tableType === IPAD_TABLE_TYPE.COMPARISON) {
    sameCount = true    // force aligned — comparison tables always align
  } else {
    sameCount = topCount === bottomCount
  }

  // ── Step 1: determine which side is primary ──────────────────────────────
  // Primary = more solutions; if tied, larger total footprint; if still tied, top.
  const topIsPrimary =
    topCount > bottomCount ||
    (topCount === bottomCount && topB >= bottomB)

  const primaryWidths   = topIsPrimary ? topWidths   : bottomWidths
  const secondaryWidths = topIsPrimary ? bottomWidths : topWidths
  const primaryLabel    = topIsPrimary ? '上侧（主）' : '下侧（主）'
  const secondaryLabel  = topIsPrimary ? '下侧（次）' : '上侧（次）'

  // ── Step 2: calculate primary with General Spacing Principle ─────────────
  const primaryResult = calcGeneral(A, primaryWidths)
  if (!primaryResult) return null

  // ── Step 3: calculate secondary ──────────────────────────────────────────
  let secondaryResult
  let spacingMode

  if (!sameCount) {
    // Different counts → measure each side independently
    secondaryResult = calcGeneral(A, secondaryWidths)
    if (!secondaryResult) return null
    spacingMode = 'independent'
  } else {
    // Same count → center-align each secondary solution onto the primary center
    const secLayout = primaryResult.layout.map((primarySlot, i) => {
      const w           = secondaryWidths[i]
      const center      = primarySlot.center   // inherit primary center
      const start       = center - w / 2
      const end         = center + w / 2
      // Check boundary / overlap issues
      const prevEnd     = i > 0 ? (primaryResult.layout[i - 1].center + secondaryWidths[i - 1] / 2) : -Infinity
      const needsAdjust = start < 0 || end > A || start < prevEnd
      return {
        index: i,
        width: w,
        start,
        center,
        end,
        needsAdjust,
      }
    })
    const secB = secondaryWidths.reduce((s, w) => s + w, 0)
    secondaryResult = {
      A,
      B:            secB,
      C:            secondaryWidths.length,
      X:            null,          // not independently gapped
      edgeLeft:     secLayout[0]?.start ?? 0,
      edgeRight:    A - (secLayout[secLayout.length - 1]?.end ?? A),
      layout:       secLayout,
      centerAligned: true,
      trace: [
        `${secondaryLabel}：solution 数与主侧相同，各 solution 中心直接对齐主侧对应中心。`,
        ...secLayout.map((s, i) =>
          `  组 ${i + 1}：中心 = ${s.center.toFixed(3)}"，宽 ${s.width.toFixed(3)}" → [${s.start.toFixed(3)}", ${s.end.toFixed(3)}"]${s.needsAdjust ? '  [!] 需微调' : ''}`
        ),
      ],
    }
    spacingMode = 'center-aligned'
  }

  // Re-map results back to top / bottom orientation
  const top    = topIsPrimary ? primaryResult   : secondaryResult
  const bottom = topIsPrimary ? secondaryResult : primaryResult

  // ── Step 4: build pair-by-pair alignment report ───────────────────────────
  const pairCount        = Math.min(top.layout.length, bottom.layout.length)
  const pairs            = []
  let alignedCount       = 0
  let minorAdjustCount   = 0
  let majorCount         = 0

  for (let i = 0; i < pairCount; i++) {
    const topCenter    = top.layout[i].center
    const bottomCenter = bottom.layout[i].center
    const delta        = topCenter - bottomCenter
    const absDelta     = Math.abs(delta)
    let status
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

  // ── Warnings ──────────────────────────────────────────────────────────────
  const warnings = []
  const isAssortment = tableType === IPAD_TABLE_TYPE.ASSORTMENT

  if (!sameCount && !isAssortment) {
    // Assortment tables explicitly allow unequal counts — no warning needed.
    warnings.push(
      `两侧 solution 数不同（${primaryLabel} ${primaryWidths.length} 个，${secondaryLabel} ${secondaryWidths.length} 个）→ 两侧分别独立计算间距，仅对齐前 ${pairCount} 组。`
    )
  }
  if (!isAssortment) {
    // Alignment warnings only apply to comparison (or default) tables.
    if (majorCount > 0) {
      warnings.push(`${majorCount} 组中心偏差超过 ${microAdjustMax}"，需重新排布而非微调。`)
    }
    if (minorAdjustCount > 0) {
      warnings.push(`${minorAdjustCount} 组可左右微调 1–${microAdjustMax}" 完成中心对齐（优先遵循陈列原则）。`)
    }
    if (spacingMode === 'center-aligned') {
      const needsAdjustList = secondaryResult.layout.filter(s => s.needsAdjust)
      if (needsAdjustList.length > 0) {
        warnings.push(
          `${secondaryLabel}有 ${needsAdjustList.length} 个 solution 位置越界或重叠，建议左右微调 ≤ ${microAdjustMax}" 修正。`
        )
      }
    }
  }

  // ── Trace ─────────────────────────────────────────────────────────────────
  const trace = [
    `双面展台计算 — 陈列原则：先布置${primaryLabel}，再中心对齐${secondaryLabel}。`,
    `桌型：${ tableType === IPAD_TABLE_TYPE.ASSORTMENT ? 'iPad 系列产品展示桌（两侧分别独立计算，无需对齐）'
           : tableType === IPAD_TABLE_TYPE.COMPARISON  ? 'iPad 对比展示桌（设备对齐摆放）'
           : '通用（以两侧 Solution 数量决定对齐模式）' }`,
    `间距模式：${spacingMode === 'center-aligned' ? '主侧 General Spacing + 次侧中心对齐' : '两侧独立 General Spacing'}`,
    ``,
    `${primaryLabel}（先布置）：`,
    ...(primaryResult.trace || []).map(l => `  ${l}`),
    ``,
    `${secondaryLabel}（后对齐）：`,
    ...(secondaryResult.trace || []).map(l => `  ${l}`),
    ``,
    `中心对齐核查（容差 ${centerTolerance}"，允许微调上限 ${microAdjustMax}"）：`,
    ...(isAssortment
      ? ['', '[OK] 系列展示桌：两侧各自独立计算，无需中心对齐，对齐核查仅供参考。',
         ...pairs.map(p => `  (参考) 组 ${p.index + 1}：Δ = ${p.delta.toFixed(3)}"`)]
      : [
          ...pairs.map(p => `  组 ${p.index + 1}：Δ = ${p.delta.toFixed(3)}" → ${p.status}`),
          ...(warnings.length
            ? ['', '告警：', ...warnings.map(w => `  [!] ${w}`)]
            : ['', '[OK] 全部 pair 在容差内，无需微调。']),
        ]),
  ]

  return {
    mode:        'double',
    spacingMode,
    tableType:   tableType ?? null,
    // For assortment tables, alignment is explicitly NOT required; data is informational only.
    alignmentRequired: !isAssortment,
    primarySide: topIsPrimary ? 'top' : 'bottom',
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

/**
 * iPad Dual-Side Table — convenience wrapper around calcDoubleSide.
 *
 * Merchandising Principle (iPad):
 *   • Assortment table (系列产品展示桌):
 *       Each side has a different number of devices → each side is spaced
 *       independently using the General Spacing Principle.
 *       Devices do NOT need to be aligned across the two sides.
 *   • Comparison table (对比展示桌):
 *       Devices must be aligned across both sides.
 *
 * Within-group Y / Z gaps are determined from the table-width lookup
 * (IPAD_Y_GAP / IPAD_Z_GAP) and should be pre-applied to the solution widths
 * passed into this function.
 *
 * @param {number}   A          – table length in inches
 * @param {number[]} topWidths  – solution widths on the top / back side
 * @param {number[]} botWidths  – solution widths on the bottom / front side
 * @param {'ipad-assortment'|'ipad-comparison'} tableType
 * @param {object}   opts       – forwarded to calcDoubleSide
 */
export function calcIpadDoubleSide(A, topWidths, botWidths, tableType, opts = {}) {
  return calcDoubleSide(A, topWidths, botWidths, { ...opts, tableType })
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
