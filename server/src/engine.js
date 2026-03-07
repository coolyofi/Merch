import {
  calcGeneral,
  calcSignage,
  calcIphoneAssortment,
  calcDoubleSide,
  calcIpadTable,
  calcIpadSignageTable,
  IPAD_Z_GAP,
} from '../../src/calc.js'

function nearestKey(A, map) {
  const keys = Object.keys(map || {}).map(Number).sort((a, b) => a - b)
  for (const k of keys) if (A <= k) return k
  return keys[keys.length - 1]
}

function toNum(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function extractWidths(list) {
  return (Array.isArray(list) ? list : []).map(x => toNum(x.width)).filter(w => w > 0)
}

export function recomputeLayoutFromInput(inputPayload, rulePayload = {}) {
  const payload = inputPayload || {}
  const scene = payload.scene || 'general'
  const A = toNum(payload.tableLength)
  if (!(A > 0)) throw new Error('Invalid tableLength in input payload')

  const signageEdgeByTable = rulePayload.signageEdgeByTable || {}
  const iphoneYByTable = rulePayload.iphoneYByTable || {}
  const dual = rulePayload.dualSide || {}

  if (scene === 'iphoneAssortment') {
    const groups = (Array.isArray(payload.assortGroups) ? payload.assortGroups : [])
      .map(g => ({ count: toNum(g.count), riserWidth: toNum(g.riserWidth) }))
      .filter(g => g.count > 0 && g.riserWidth > 0)
    const nearest = nearestKey(A, iphoneYByTable)
    const Y = toNum(payload.iphoneY, nearest ? toNum(iphoneYByTable[nearest]) : 0)
    return calcIphoneAssortment(A, groups, Y)
  }

  if (scene === 'iphoneComparison' || scene === 'macComparison') {
    const top = extractWidths(payload.queueLeft)
    const bottomRaw = extractWidths(payload.queueRight)
    const bottom = bottomRaw.length ? bottomRaw : top
    return calcDoubleSide(A, top, bottom, {
      centerTolerance: toNum(dual.centerToleranceIn, 1),
      microAdjustMax: toNum(dual.microAdjustMaxIn, 1.5),
      ruleVersion: payload.ruleVersion,
    })
  }

  const widths = extractWidths(payload.queueLeft)
  if (scene === 'signage') {
    const nearest = nearestKey(A, signageEdgeByTable)
    const edgeX = toNum(payload.edgeX, nearest ? toNum(signageEdgeByTable[nearest]) : 7)
    return calcSignage(A, widths, edgeX)
  }

  // ── iPad Table: fixed Y gap (no 2×3 signage) ──────────────────────────────
  if (scene === 'ipadTable') {
    return calcIpadTable(A, widths)
  }

  // ── iPad Table: 2×3 signage variant ─────────────────────────────────────
  // Pass solution widths already computed (sign + device(s) with Z gap applied).
  // To override the edge X or let it auto-detect from table size.
  if (scene === 'ipadSignage') {
    return calcIpadSignageTable(A, widths)
  }

  // ── iPad Table: 2×3 signage with Z-gap grouping built inline ─────────────
  // payload.ipadGroups = [{ deviceWidths: number[], hasSignBetween?: boolean }]
  if (scene === 'ipadSignageGroups') {
    const nearest = nearestKey(A, { 84:5, 96:6, 120:6, 144:6, 180:6, 240:6 })
    const Z = toNum(payload.zGap, nearest ? toNum(IPAD_Z_GAP[nearest]) : 6)
    const signWidth = toNum(payload.signWidth, 3)    // 2×3 sign default 3"
    const signGap   = toNum(payload.signGap, 1)      // 1" between sign and device
    const groups    = Array.isArray(payload.ipadGroups) ? payload.ipadGroups : []
    const solutionWidths = groups.map(g => {
      const devs = (Array.isArray(g.deviceWidths) ? g.deviceWidths : []).map(toNum).filter(w => w > 0)
      if (devs.length === 0) return 0
      // device widths joined by Z gap
      const devTotal = devs.reduce((s, w) => s + w, 0) + (devs.length - 1) * Z
      // sign is always 1" to the left of the hero device/grouping
      return signWidth + signGap + devTotal
    }).filter(w => w > 0)
    return calcIpadSignageTable(A, solutionWidths)
  }

  return calcGeneral(A, widths)
}
