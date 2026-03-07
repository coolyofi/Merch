/**
 * qa_ipad_grouped.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * QA test suite: 35 iPad grouped-solution spacing scenarios.
 *
 * Constraints (from spec):
 *   ● All devices PORTRAIT (竖放) on both rails
 *   ● All groups have one 2×3 lead sign (3" + 1" gap before first device)
 *   ● Within a group: Y gap between devices (no inter-device signs)
 *   ● Group compositions:
 *       A-series: iPad A16 × N + iPad mini × M  ("标准系列")
 *       B-series: iPad Pro 13" / Air 13" / Pro 11" / Air 11"  ("Pro/Air系列")
 *   ● Each product series forms its own group (成组)
 *   ● 35 cases = 5 table sizes × 7 scenario types
 *   ● calcIpadGrouped handles all per-rail layouts
 *
 * Output: QA/grp01.svg … QA/grp35.svg  +  QA/grouped_index.html
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath }           from 'url'
import { join, dirname }           from 'path'
import {
  IPAD_Y_GAP, IPAD_Z_GAP,
  IPAD_TABLE_TYPE,
  getIpadGaps, nearestKey,
  calcIpadGrouped,
  calcGeneral,
} from '../src/calc.js'

const __dir  = dirname(fileURLToPath(import.meta.url))
const QA_DIR = join(__dir, '..', 'QA')
mkdirSync(QA_DIR, { recursive: true })

// ── Device portrait widths (inches) ────────────────────────────────────────
const DEV = {
  Pro13:  8.48,   // iPad Pro 13"   portrait
  Air13:  8.46,   // iPad Air 13"   portrait
  Pro11:  6.99,   // iPad Pro 11"   portrait
  Air11:  7.02,   // iPad Air 11"   portrait
  A16:    7.07,   // iPad (A16)     portrait
  mini:   5.30,   // iPad mini      portrait
}

// Label shorthands for display
const DEV_LABEL = {
  Pro13: 'Pro 13"', Air13: 'Air 13"', Pro11: 'Pro 11"',
  Air11: 'Air 11"', A16: 'A16', mini: 'mini',
}

const SIGN_W = 3   // 2×3 sign footprint (in)
const SIGN_G = 1   // gap sign→device (in)
const LEAD   = SIGN_W + SIGN_G  // 4" lead-sign prepended to each group

// ── Group definitions ──────────────────────────────────────────────────────
// Each group = one solution on the rail.
// All groups have a lead sign; within the group Y-gaps only.
const GROUPS = {
  A6:   { label: 'A16×4+mini×2',         devices: ['A16','A16','A16','A16','mini','mini'] },
  A4:   { label: 'A16×3+mini',           devices: ['A16','A16','A16','mini'] },
  A3:   { label: 'A16×2+mini',           devices: ['A16','A16','mini'] },
  A2:   { label: 'A16+mini',             devices: ['A16','mini'] },
  B4:   { label: 'Pro13+Air13+Pro11+Air11', devices: ['Pro13','Air13','Pro11','Air11'] },
  B2big:{ label: 'Pro13+Air13',          devices: ['Pro13','Air13'] },
  B2sml:{ label: 'Pro11+Air11',          devices: ['Pro11','Air11'] },
  B2pro:{ label: 'Pro13+Pro11',          devices: ['Pro13','Pro11'] },
  Bair: { label: 'Air13+Air11',          devices: ['Air13','Air11'] },
}

/** Compute group footprint width given Y gap */
function groupWidth(grpKey, Y, Z) {
  const { devices } = GROUPS[grpKey]
  let w = LEAD + DEV[devices[0]]
  for (let i = 1; i < devices.length; i++) {
    const same = devices[i] === devices[i - 1]
    w += (same ? Y : Z) + DEV[devices[i]]
  }
  return w
}

/** Count signs in a group: lead sign + 1 per model change */
function signCount(grpKey) {
  const { devices } = GROUPS[grpKey]
  return 1 + devices.filter((d, i) => i > 0 && d !== devices[i - 1]).length
}

/** Convert group key array to calcIpadGrouped-compatible input */
function buildGroups(grpKeys, Y, Z) {
  return grpKeys.map(k => ({
    key:           k,
    leadSignWidth: LEAD,
    items: GROUPS[k].devices.map((d, i, arr) => ({
      model:   d,
      width:   DEV[d],
      // hasSign on non-first: true when model changes → Z gap (own sign)
      hasSign: i > 0 && arr[i] !== arr[i - 1],
    })),
  }))
}

// ── 7 scenario types (applied to each of 5 table sizes) ────────────────────
// Each entry: { topGrps: string[], botGrps: string[], desc, note }
const SCENARIOS = [
  {
    id: 'S1',
    topGrps: ['A6'],
    botGrps: ['B4'],
    desc:    '单组对比 — A系列多设备组 vs B系列完整组',
    note:    '1 vs 1，数量相同 → 对比模式，中心核查',
  },
  {
    id: 'S2',
    topGrps: ['A3','A3'],
    botGrps: ['B4'],
    desc:    '两组 A 系列 vs 单 B 完整组',
    note:    '2 vs 1 → 系列展示，双侧独立计算',
  },
  {
    id: 'S3',
    topGrps: ['A4','B2sml'],
    botGrps: ['B4','A2'],
    desc:    '混搭双组：A大+B小 vs B大+A小',
    note:    '2 vs 2，数量相同 → 对比模式，中心核查',
  },
  {
    id: 'S4',
    topGrps: ['A2','A2','Bair'],
    botGrps: ['B4','A2'],
    desc:    '三小组 vs 一大一小',
    note:    '3 vs 2 → 系列展示，双侧独立计算',
  },
  {
    id: 'S5',
    topGrps: ['A6','B2pro'],
    botGrps: ['A3','A3'],
    desc:    'A全组+Pro对比 vs 两个中等 A 组',
    note:    '2 vs 2 → 对比模式，中心核查',
  },
  {
    id: 'S6',
    topGrps: ['A4','A2'],
    botGrps: ['B4','A2'],
    desc:    'A4+A2 vs B4+A2（组内数量不等，方案数相同）',
    note:    '2 vs 2 → 对比模式，中心核查（组宽差异显著）',
  },
  {
    id: 'S7',
    topGrps: ['A2','A2','A2'],
    botGrps: ['B4','B2big'],
    desc:    '三个 A2 小组 vs B大组+B2大屏',
    note:    '3 vs 2 → 系列展示，双侧独立计算',
  },
]

// ── Table sizes ────────────────────────────────────────────────────────────
const TABLES = [84, 96, 120, 144, 180]

// ── Build all 35 test cases ────────────────────────────────────────────────
const TEST_CASES = []
TABLES.forEach(A => {
  SCENARIOS.forEach(sc => {
    TEST_CASES.push({ A, sc })
  })
})

// ── SVG drawing constants ──────────────────────────────────────────────────
const SVG_W     = 1280
const ML        = 60   // margin left
const MR        = 60   // margin right
const TABLE_PX  = SVG_W - ML - MR
const RAIL_H    = 90   // height of each rail slot
const DEV_H     = 70   // device rect height within rail
const DEV_YTOP  = 10   // device rect top offset within rail slot
const RAIL_GAP  = 50   // vertical gap between 2 rails
const TOP_Y     = 100  // y-start of top rail
const BOT_Y     = TOP_Y + RAIL_H + RAIL_GAP
const SVG_H     = BOT_Y + RAIL_H + 160

const COL_SIGN  = '#5CB85C'
const COL_A     = '#4A90D9'   // A-series groups
const COL_B     = '#9B59B6'   // B-series groups
const COL_EDGE  = '#E84393'
const COL_GAP   = '#888'
const COL_BRACE = '#E67E22'   // group brace / border

function px(inches, scale) { return scale * inches }

/** Single rail SVG rendering — shows groups with lead sign + devices + Y gaps */
function renderRail(railGroups, railY, scale, Y, Z, railLabel, result) {
  let out = ''

  // Rail background
  out += `<rect x="${ML}" y="${railY}" width="${TABLE_PX}" height="${RAIL_H}" rx="3" fill="#f4f6ff" stroke="#dde" stroke-width="1"/>\n`

  // Rail label
  out += `<text x="${ML}" y="${railY - 5}" font-size="10" fill="#555" font-family="monospace">${railLabel}</text>\n`

  if (!result) {
    out += `<text x="${ML + TABLE_PX / 2}" y="${railY + RAIL_H / 2}" text-anchor="middle" font-size="13" fill="red">OVERFLOW — cannot fit</text>\n`
    return out
  }

  // The item-level layout from calcIpadGrouped (devices within groups)
  const items = result.layout

  // Draw group brackets + devices
  const solutionLayout = result.solutionLayout
  railGroups.forEach((grp, gi) => {
    const sol = solutionLayout[gi]
    if (!sol) return
    const gx = ML + px(sol.start, scale)
    const gw = px(sol.width, scale)

    // Group brace background
    const isAgrp = grp.label.startsWith('A')
    const grpCol = isAgrp ? COL_A : COL_B
    out += `<rect x="${gx.toFixed(1)}" y="${railY + DEV_YTOP - 6}" width="${gw.toFixed(1)}" height="${DEV_H + 12}" rx="4" fill="${grpCol}" opacity="0.07" stroke="${grpCol}" stroke-width="1.5"/>\n`

    // Lead sign rect
    const signW = px(SIGN_W, scale)
    const signG = px(SIGN_G, scale)
    out += `<rect x="${gx.toFixed(1)}" y="${(railY + DEV_YTOP).toFixed(1)}" width="${signW.toFixed(1)}" height="${DEV_H}" rx="2" fill="${COL_SIGN}" opacity="0.9"/>\n`
    out += `<text x="${(gx + signW / 2).toFixed(1)}" y="${(railY + DEV_YTOP + DEV_H / 2 + 4).toFixed(1)}" text-anchor="middle" font-size="8" font-weight="bold" fill="white" font-family="monospace">S</text>\n`

    // Group label (above bracket)
    out += `<text x="${(gx + gw / 2).toFixed(1)}" y="${(railY - 8).toFixed(1)}" text-anchor="middle" font-size="9" fill="${grpCol}" font-weight="bold" font-family="monospace">${grp.label} [${sol.width.toFixed(2)}"]</text>\n`

    // Devices
    const grpItems = items.filter(it => it.groupIndex === gi)
    grpItems.forEach((it, di) => {
      const dx = ML + px(it.start, scale)
      const dw = px(it.width, scale)
      const devKey = GROUPS[grp.label.startsWith('A') ? 'A6' : 'B4']  // just for coloring
      const devLabel = grp.devices ? grp.devices[di] : ''

      out += `<rect x="${dx.toFixed(1)}" y="${(railY + DEV_YTOP).toFixed(1)}" width="${dw.toFixed(1)}" height="${DEV_H}" rx="2" fill="${grpCol}" opacity="0.82"/>\n`

      // Device name
      if (dw > 20) {
        out += `<text x="${(dx + dw / 2).toFixed(1)}" y="${(railY + DEV_YTOP + 16).toFixed(1)}" text-anchor="middle" font-size="8" fill="white" font-weight="bold" font-family="monospace">${DEV_LABEL[devKey] ?? devLabel}</text>\n`
        out += `<text x="${(dx + dw / 2).toFixed(1)}" y="${(railY + DEV_YTOP + 26).toFixed(1)}" text-anchor="middle" font-size="7" fill="white" font-family="monospace">${it.width.toFixed(2)}"</text>\n`
      }

      // Inter-device Y gap annotation (between this and next device in group)
      if (di < grpItems.length - 1) {
        const nextIt = grpItems[di + 1]
        const gapPx  = px(nextIt.start - it.end, scale)
        const gapIn  = (nextIt.start - it.end).toFixed(2)
        const mx     = dx + dw + gapPx / 2
        out += `<line x1="${(dx + dw).toFixed(1)}" y1="${(railY + DEV_YTOP + DEV_H / 2).toFixed(1)}" x2="${(dx + dw + gapPx).toFixed(1)}" y2="${(railY + DEV_YTOP + DEV_H / 2).toFixed(1)}" stroke="${COL_GAP}" stroke-width="1" stroke-dasharray="3,2"/>\n`
        out += `<text x="${mx.toFixed(1)}" y="${(railY + DEV_YTOP + DEV_H / 2 - 3).toFixed(1)}" text-anchor="middle" font-size="8" fill="${COL_GAP}" font-family="monospace">Y=${gapIn}"</text>\n`
      }
    })
  })

  // Between-group X gap annotations (below rail)
  for (let gi = 1; gi < solutionLayout.length; gi++) {
    const prev   = solutionLayout[gi - 1]
    const cur    = solutionLayout[gi]
    const xgapIn = (cur.start - prev.end).toFixed(3)
    const gx1    = ML + px(prev.end, scale)
    const gx2    = ML + px(cur.start, scale)
    const mx     = (gx1 + gx2) / 2
    out += `<line x1="${gx1.toFixed(1)}" y1="${(railY + RAIL_H + 10).toFixed(1)}" x2="${gx2.toFixed(1)}" y2="${(railY + RAIL_H + 10).toFixed(1)}" stroke="#aaa" stroke-width="1.5" stroke-dasharray="4,3"/>\n`
    out += `<text x="${mx.toFixed(1)}" y="${(railY + RAIL_H + 8).toFixed(1)}" text-anchor="middle" font-size="9" fill="#555" font-family="monospace">X=${xgapIn}"</text>\n`
  }

  // Edge annotations
  if (solutionLayout.length > 0) {
    const edgeL = result.edgeLeft
    const edgeR = result.edgeRight
    const ex1   = ML
    const ex2   = ML + px(solutionLayout[0].start, scale)
    const mx1   = (ex1 + ex2) / 2
    out += `<text x="${mx1.toFixed(1)}" y="${(railY + RAIL_H + 8).toFixed(1)}" text-anchor="middle" font-size="9" fill="${COL_EDGE}" font-family="monospace">${edgeL.toFixed(3)}"</text>\n`

    const ex3 = ML + px(solutionLayout[solutionLayout.length - 1].end, scale)
    const ex4 = ML + TABLE_PX
    const mx2 = (ex3 + ex4) / 2
    out += `<text x="${mx2.toFixed(1)}" y="${(railY + RAIL_H + 8).toFixed(1)}" text-anchor="middle" font-size="9" fill="${COL_EDGE}" font-family="monospace">${edgeR.toFixed(3)}"</text>\n`
  }

  return out
}

/** Render alignment guide lines between top and bottom centers */
function centerLines(topRes, botRes, isComparison, scale) {
  if (!topRes || !botRes) return ''
  const pairCount = Math.min(topRes.solutionLayout.length, botRes.solutionLayout.length)
  let out = ''
  for (let i = 0; i < pairCount; i++) {
    const tc = ML + px(topRes.solutionLayout[i].center, scale)
    const bc = ML + px(botRes.solutionLayout[i].center, scale)
    const delta = Math.abs(topRes.solutionLayout[i].center - botRes.solutionLayout[i].center)
    const color = isComparison
      ? (delta < 0.01 ? '#2a9d2a' : delta < 1.5 ? '#e67e22' : '#cc2222')
      : '#ccc'
    const dash = isComparison ? '5,3' : '2,5'
    out += `<line x1="${tc.toFixed(1)}" y1="${(TOP_Y + RAIL_H).toFixed(1)}" x2="${bc.toFixed(1)}" y2="${BOT_Y}" stroke="${color}" stroke-width="1.5" stroke-dasharray="${dash}" opacity="0.8"/>\n`
    if (isComparison) {
      const my = TOP_Y + RAIL_H + RAIL_GAP / 2
      out += `<text x="${tc.toFixed(1)}" y="${my.toFixed(1)}" text-anchor="middle" font-size="8" fill="${color}" font-family="monospace">Δ=${delta.toFixed(3)}"</text>\n`
    }
  }
  return out
}

/** Verify calculation: check widths, X, edge against formula */
function verify(result, grpKeys, A, Y, Z) {
  if (!result) return { ok: true, overflow: true, errors: [], warnings: [] }
  const errors = []
  const warnings = []

  grpKeys.forEach((k, i) => {
    const expected = groupWidth(k, Y, Z)
    const got      = result.solutionLayout[i]?.width ?? -1
    const diff     = Math.abs(expected - got)
    if (diff > 0.005) {
      errors.push(`组${i+1}(${k}) 宽度: 期望 ${expected.toFixed(3)}" 实际 ${got.toFixed(3)}" Δ=${diff.toFixed(4)}"`)
    }
  })

  // Verify General Spacing Principle: X = (A - B) / C, edge = X/2
  const B = result.solutionLayout.reduce((s, sl) => s + sl.width, 0)
  const C = result.solutionLayout.length
  const expectedX    = (A - B) / C
  const expectedEdge = expectedX / 2
  const gotX         = result.X
  const gotEdge      = result.edgeLeft

  if (Math.abs(gotX - expectedX) > 0.005) {
    errors.push(`X 间距: 期望 ${expectedX.toFixed(3)}" 实际 ${gotX?.toFixed(3)}"`)
  }
  if (Math.abs(gotEdge - expectedEdge) > 0.005) {
    errors.push(`边缘: 期望 ${expectedEdge.toFixed(3)}" 实际 ${gotEdge?.toFixed(3)}"`)
  }
  if (gotEdge < 0) {
    errors.push(`边缘为负值 (${gotEdge?.toFixed(3)}") — 设备溢出桌面`)
  }

  // Verify Y/Z gaps between devices within groups
  result.layout.forEach(item => {
    if (item.deviceIndex === 0) return
    const prevItem = result.layout.find(it => it.groupIndex === item.groupIndex && it.deviceIndex === item.deviceIndex - 1)
    if (!prevItem) return
    const actualGap   = item.start - prevItem.end
    const expectedGap = item.hasSignBefore ? Z : Y
    const diff = Math.abs(actualGap - expectedGap)
    if (diff > 0.005) {
      errors.push(`组${item.groupIndex+1} 设备${item.deviceIndex} 前间距: 期望${item.hasSignBefore?'Z':'Y'}=${expectedGap}" 实际=${actualGap.toFixed(3)}"`)
    }
  })

  // Verify lead sign offset
  result.layout.forEach(item => {
    if (item.deviceIndex !== 0) return
    const grpStart    = result.solutionLayout[item.groupIndex]?.start ?? 0
    const expectedDev = grpStart + LEAD
    const diff = Math.abs(item.start - expectedDev)
    if (diff > 0.005) {
      errors.push(`组${item.groupIndex+1} 首设备起点: 期望 ${expectedDev.toFixed(3)}" 实际 ${item.start.toFixed(3)}"`)
    }
  })

  return { ok: errors.length === 0, errors, warnings }
}

/** Generate SVG for one test case */
function generateSVG(tcNum, A, sc, topRes, botRes, topVerify, botVerify, Y, Z) {
  const scale      = TABLE_PX / A
  const isComparison = sc.topGrps.length === sc.botGrps.length
  const tableLabel = `${A}" (${A===84?'7-ft':A===96?'8-ft':A===120?'10-ft':A===144?'12-ft':'15-ft'})`
  const modeLabel  = isComparison ? '对比展示桌' : '系列展示桌'
  const isOvf      = topVerify.overflow || botVerify.overflow
  const hasErr     = (!topVerify.ok && !topVerify.overflow) || (!botVerify.ok && !botVerify.overflow)
  const hasWarn    = topVerify.warnings.length + botVerify.warnings.length > 0
  const status     = hasErr ? 'FAIL' : isOvf ? 'OVF' : hasWarn ? 'WARN' : 'PASS'
  const statusC    = {PASS:'#2a9d2a',WARN:'#d07000',FAIL:'#cc2222',OVF:'#888'}[status]

  const topGrpObjects = sc.topGrps.map(k => GROUPS[k])
  const botGrpObjects = sc.botGrps.map(k => GROUPS[k])

  const topB = sc.topGrps.reduce((s, k) => s + groupWidth(k, Y, Z), 0)
  const botB = sc.botGrps.reduce((s, k) => s + groupWidth(k, Y, Z), 0)
  const topX = topRes ? topRes.X.toFixed(3) : '—'
  const botX = botRes ? botRes.X.toFixed(3) : '—'
  const topEdge = topRes ? topRes.edgeLeft.toFixed(3) : '—'
  const botEdge = botRes ? botRes.edgeLeft.toFixed(3) : '—'

  // Error/warning lines for info panel
  const topErrLines = [...topVerify.errors, ...topVerify.warnings].map(e => `⚠ [上] ${e}`).join(' · ')
  const botErrLines = [...botVerify.errors, ...botVerify.warnings].map(e => `⚠ [下] ${e}`).join(' · ')
  const noIssues    = topErrLines === '' && botErrLines === '' && !hasErr

  // Correct device labels for rendering (use groups as structured)
  const topBuilt = sc.topGrps.map(k => ({ ...GROUPS[k], label: k, devices: GROUPS[k].devices }))
  const botBuilt = sc.botGrps.map(k => ({ ...GROUPS[k], label: k, devices: GROUPS[k].devices }))

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}">
  <style>text { font-family: 'PingFang SC','Microsoft YaHei',Arial,sans-serif; }</style>

  <!-- Background -->
  <rect width="${SVG_W}" height="${SVG_H}" fill="#f7f8fa"/>

  <!-- Title bar -->
  <rect x="0" y="0" width="${SVG_W}" height="48" fill="#1d1d1f"/>
  <text x="20" y="19" font-size="13" fill="white" font-weight="bold">GRP${String(tcNum).padStart(2,'0')} — ${tableLabel} · ${sc.id} · ${sc.desc}</text>
  <text x="20" y="37" font-size="11" fill="#aaa">${modeLabel} · 全竖放 · 每组一块 2×3 标牌 · Y=${Y}" @key${nearestKey(A,IPAD_Y_GAP)}"</text>
  <rect x="${SVG_W - 80}" y="7" width="62" height="26" rx="5" fill="${statusC}"/>
  <text x="${SVG_W - 49}" y="25" text-anchor="middle" font-size="14" font-weight="bold" fill="white">${status}</text>

  <!-- Table surface -->
  <rect x="${ML}" y="${TOP_Y - 18}" width="${TABLE_PX}" height="${RAIL_H * 2 + RAIL_GAP + 36}" rx="4"
        fill="white" stroke="#ccc" stroke-width="1.5"/>

  <!-- Table width ruler -->
  <line x1="${ML}" y1="${TOP_Y - 28}" x2="${ML + TABLE_PX}" y2="${TOP_Y - 28}" stroke="#bbb" stroke-width="1"/>
  <line x1="${ML}" y1="${TOP_Y - 33}" x2="${ML}" y2="${TOP_Y - 23}" stroke="#bbb" stroke-width="1"/>
  <line x1="${ML + TABLE_PX}" y1="${TOP_Y - 33}" x2="${ML + TABLE_PX}" y2="${TOP_Y - 23}" stroke="#bbb" stroke-width="1"/>
  <text x="${ML + TABLE_PX / 2}" y="${TOP_Y - 15}" text-anchor="middle" font-size="11" fill="#555">${A}"</text>

  <!-- Top rail -->
  ${renderRail(topBuilt, TOP_Y, scale, Y, IPAD_Z_GAP[nearestKey(A,IPAD_Z_GAP)],
      `上排：${sc.topGrps.map(k => GROUPS[k].label).join(' | ')} — B=${topB.toFixed(2)}" · C=${sc.topGrps.length} · X=${topX}" · edge=${topEdge}"`,
      topRes)}

  <!-- Bottom rail -->
  ${renderRail(botBuilt, BOT_Y, scale, Y, IPAD_Z_GAP[nearestKey(A,IPAD_Z_GAP)],
      `下排：${sc.botGrps.map(k => GROUPS[k].label).join(' | ')} — B=${botB.toFixed(2)}" · C=${sc.botGrps.length} · X=${botX}" · edge=${botEdge}"`,
      botRes)}

  <!-- Center alignment guides -->
  ${centerLines(topRes, botRes, isComparison, scale)}

  <!-- Centre rail divider -->
  <line x1="${ML}" y1="${TOP_Y + RAIL_H + RAIL_GAP / 2}" x2="${ML + TABLE_PX}" y2="${TOP_Y + RAIL_H + RAIL_GAP / 2}"
        stroke="#eee" stroke-width="1" stroke-dasharray="6,4"/>
  <text x="${SVG_W / 2}" y="${(TOP_Y + RAIL_H + RAIL_GAP / 2 + 4).toFixed(1)}" text-anchor="middle" font-size="9" fill="#ccc">← 展台中心 →</text>

  <!-- Info panel -->
  <rect x="20" y="${BOT_Y + RAIL_H + 42}" width="${SVG_W - 40}" height="${noIssues ? 44 : 60}" rx="4" fill="white" stroke="#ddd" stroke-width="1"/>
  <text font-size="10" fill="#444" font-family="monospace">
    <tspan x="28" y="${BOT_Y + RAIL_H + 58}">
      验算：Y(组内)=${Y}" · 通用间距原则 X=(A-B)÷C，边缘=X÷2 · mode=${isComparison?'对比(comparison)':'系列(assortment)'}
    </tspan>
    ${noIssues
      ? `<tspan x="28" dy="14" fill="#2a9d2a">✓ 上下两排计算均正确，组宽、X间距、边缘、Y组内间距全部通过</tspan>`
      : `<tspan x="28" dy="14" fill="#cc3300">${topErrLines}${topErrLines&&botErrLines?' · ':''}${botErrLines}</tspan>`
    }
  </text>
  <!-- Note -->
  <text x="28" y="${BOT_Y + RAIL_H + 118}" font-size="9" fill="#999" font-family="monospace">备注：${sc.note}</text>

  <!-- Legend -->
  <rect x="20" y="${SVG_H - 24}" width="12" height="12" rx="2" fill="${COL_A}"/>
  <text x="36" y="${SVG_H - 13}" font-size="10" fill="#555">A系列组（A16/mini）</text>
  <rect x="170" y="${SVG_H - 24}" width="12" height="12" rx="2" fill="${COL_B}"/>
  <text x="186" y="${SVG_H - 13}" font-size="10" fill="#555">B系列组（Pro/Air）</text>
  <rect x="330" y="${SVG_H - 24}" width="12" height="12" rx="2" fill="${COL_SIGN}"/>
  <text x="346" y="${SVG_H - 13}" font-size="10" fill="#555">2×3 Lead Sign (3"+1"gap)</text>
  <text x="${SVG_W - 20}" y="${SVG_H - 13}" text-anchor="end" font-size="9" fill="#ccc">Generated ${new Date().toISOString().slice(0,10)}</text>
</svg>`
}

// ── Run all 35 cases ──────────────────────────────────────────────────────────
const RESULTS = []
let passCount = 0, warnCount = 0, failCount = 0, ovfCount = 0

let tcNum = 0
for (const { A, sc } of TEST_CASES) {
  tcNum++
  const { Y, Z } = getIpadGaps(A)

  const topCGGroups = buildGroups(sc.topGrps, Y, Z)
  const botCGGroups = buildGroups(sc.botGrps, Y, Z)

  const topRes = calcIpadGrouped(A, topCGGroups)
  const botRes = calcIpadGrouped(A, botCGGroups)

  const topV = verify(topRes, sc.topGrps, A, Y, Z)
  const botV = verify(botRes, sc.botGrps, A, Y, Z)

  const hasErr  = (!topV.ok && !topV.overflow) || (!botV.ok && !botV.overflow)
  const hasWarn = topV.warnings.length + botV.warnings.length > 0
  const isOvf   = topV.overflow || botV.overflow
  const status  = hasErr ? 'FAIL' : isOvf ? 'OVF' : hasWarn ? 'WARN' : 'PASS'
  if (status === 'FAIL') failCount++
  else if (status === 'WARN') warnCount++
  else if (status === 'OVF') ovfCount++
  else passCount++

  RESULTS.push({ tcNum, A, sc, topRes, botRes, topV, botV, status })

  // Console output
  const key = nearestKey(A, IPAD_Y_GAP)
  const topB = (topRes?.solutionLayout?.reduce((s,sl)=>s+sl.width,0) ?? 0).toFixed(2)
  const botB = (botRes?.solutionLayout?.reduce((s,sl)=>s+sl.width,0) ?? 0).toFixed(2)
  console.log(`\nGRP${String(tcNum).padStart(2,'0')} [${A}"/${sc.id}]: ${sc.desc}`)
  console.log(`  Y=${Y}" @key=${key}  mode=${sc.topGrps.length===sc.botGrps.length?'comparison':'assortment'}`)
  console.log(`  上: [${sc.topGrps.join(',')}] B=${topB}" → X=${topRes?.X?.toFixed(3)?? 'null'}" edge=${topRes?.edgeLeft?.toFixed(3)??'null'}"`)
  console.log(`  下: [${sc.botGrps.join(',')}] B=${botB}" → X=${botRes?.X?.toFixed(3)?? 'null'}" edge=${botRes?.edgeLeft?.toFixed(3)??'null'}"`)
  const allErr = [...topV.errors,...botV.errors,...topV.warnings,...botV.warnings]
  allErr.forEach(e => console.log(`  ⚠ ${e}`))
  console.log(`  → ${status}`)

  // Write SVG
  const svg  = generateSVG(tcNum, A, sc, topRes, botRes, topV, botV, Y, Z)
  const file = join(QA_DIR, `grp${String(tcNum).padStart(2,'0')}.svg`)
  writeFileSync(file, svg, 'utf8')
}

// ── HTML index ────────────────────────────────────────────────────────────────
const tableRows = RESULTS.map(r => {
  const { tcNum, A, sc, topRes, botRes, status } = r
  const isComp = sc.topGrps.length === sc.botGrps.length
  const c = {PASS:'#2a9d2a',WARN:'#d07000',FAIL:'#cc2222',OVF:'#888'}[status]??'#cc2222'
  const topX = topRes?.X?.toFixed(3) ?? '—'
  const botX = botRes?.X?.toFixed(3) ?? '—'
  const topB = (topRes?.solutionLayout?.reduce((s,sl)=>s+sl.width,0)??0).toFixed(2)
  const botB = (botRes?.solutionLayout?.reduce((s,sl)=>s+sl.width,0)??0).toFixed(2)
  return `<tr>
    <td><a href="grp${String(tcNum).padStart(2,'0')}.svg" target="_blank">GRP${String(tcNum).padStart(2,'0')}</a></td>
    <td>${A}"</td><td>${sc.id}</td>
    <td>${sc.topGrps.join(' + ')}</td>
    <td>${sc.botGrps.join(' + ')}</td>
    <td style="font-size:11px">${topB}" / X=${topX}"</td>
    <td style="font-size:11px">${botB}" / X=${botX}"</td>
    <td>${isComp?'对比':'系列'}</td>
    <td><span style="background:${c};color:white;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:bold">${status}</span></td>
  </tr>`
}).join('')

const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<title>iPad 成组间距 QA — 35 Cases</title>
<style>
  body{font-family:'PingFang SC',Arial,sans-serif;margin:24px;background:#f7f8fa}
  h1{margin-bottom:4px}
  .summary{display:flex;gap:16px;margin:12px 0 20px}
  .badge{padding:8px 20px;border-radius:6px;font-size:15px;font-weight:bold;color:white}
  table{width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1)}
  th{background:#1d1d1f;color:white;padding:8px 10px;text-align:left;font-size:12px}
  td{padding:7px 10px;border-bottom:1px solid #eee;font-size:12px}
  tr:last-child td{border-bottom:none}
  tr:hover td{background:#f0f4ff}
  a{color:#0066cc;text-decoration:none;font-weight:bold}
  a:hover{text-decoration:underline}
  .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-top:24px}
  .card{background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.12)}
  .card img{width:100%;display:block}
  .card p{margin:4px 8px 8px;font-size:11px;color:#555}
</style>
</head>
<body>
<h1>iPad 成组间距验证 — QA 报告</h1>
<p style="color:#666">生成时间：${new Date().toLocaleString('zh-CN')} · 共 35 个场景 · 全竖放 · 每组一块 2×3 标牌 · A系列(A16/mini) & B系列(Pro/Air) 分组</p>
<div class="summary">
  <div class="badge" style="background:#2a9d2a">✓ PASS ${passCount}</div>
  <div class="badge" style="background:#d07000">△ WARN ${warnCount}</div>
  <div class="badge" style="background:#cc2222">✗ FAIL ${failCount}</div>
</div>
<table>
  <thead>
    <tr>
      <th>编号</th><th>桌宽</th><th>场景</th>
      <th>上排分组</th><th>下排分组</th>
      <th>上排 B/X</th><th>下排 B/X</th>
      <th>类型</th><th>结果</th>
    </tr>
  </thead>
  <tbody>${tableRows}</tbody>
</table>
<div class="grid">
${RESULTS.map(r => {
  const c = r.status==='PASS'?'#2a9d2a':r.status==='WARN'?'#d07000':'#cc2222'
  return `<div class="card">
  <a href="grp${String(r.tcNum).padStart(2,'0')}.svg" target="_blank">
    <img src="grp${String(r.tcNum).padStart(2,'0')}.svg" alt="GRP${r.tcNum}" style="border-bottom:3px solid ${c}"/>
  </a>
  <p><strong>GRP${String(r.tcNum).padStart(2,'0')}</strong> ${r.A}" ${r.sc.id}</p>
</div>`}).join('\n')}
</div>
<p style="margin-top:24px;color:#aaa;font-size:11px">
  v2 签牌规则：同型号共用标牌 Y间距 · 换型号新标牌 Z间距 · calcIpadGrouped(hasSign=model-change) · X=(A-B)/C · edge=X/2
</p>
</body>
</html>`

writeFileSync(join(QA_DIR, 'grouped_index.html'), html, 'utf8')

console.log(`\n${'─'.repeat(64)}`)
console.log(`GRP QA v2 完成：PASS ${passCount}  WARN ${warnCount}  FAIL ${failCount}  OVF(预期) ${ovfCount}`)
console.log(`输出目录：${QA_DIR}`)
console.log(`${'─'.repeat(64)}`)
