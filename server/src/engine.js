import {
  calcGeneral,
  calcSignage,
  calcIphoneAssortment,
  calcDoubleSide,
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

  return calcGeneral(A, widths)
}
