/**
 * qa_ipad_spacing.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * QA test suite: 20 iPad dual-side table spacing scenarios.
 *
 * Scenario design:
 *   ● One rail = ALL PORTRAIT devices (竖放)  → blue
 *   ● Other rail = ALL LANDSCAPE devices (横放) → orange
 *   ● ALL devices have a 2×3 product sign (lead sign, 3" + 1" gap before device)
 *   ● ASSORTMENT tables (系列产品展示桌): two sides can have different device counts
 *       → independent spacing, no alignment required
 *   ● COMPARISON tables (对比展示桌): device counts match, center-aligned across sides
 *
 * Output: QA/tc01.svg … QA/tc20.svg  +  QA/index.html
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import {
  IPAD_TABLE_TYPE,
  IPAD_Y_GAP, IPAD_Z_GAP,
  calcIpadDoubleSide,
  nearestKey,
} from '../src/calc.js'

const __dir  = dirname(fileURLToPath(import.meta.url))
const QA_DIR = join(__dir, '..', 'QA')
mkdirSync(QA_DIR, { recursive: true })

// ── Device library ────────────────────────────────────────────────────────────
// width = portrait width (in), depth = landscape width (in)
const DEVICES = {
  'iPad Pro 11"':  { pw: 6.99,  lw: 9.83  },
  'iPad Pro 13"':  { pw: 8.48,  lw: 11.09 },
  'iPad Air 11"':  { pw: 7.02,  lw: 9.74  },
  'iPad Air 13"':  { pw: 8.46,  lw: 11.04 },
  'iPad (A16)':    { pw: 7.07,  lw: 9.79  },
  'iPad mini':     { pw: 5.30,  lw: 7.69  },
}

const SIGN_W = 3   // 2×3 sign footprint width (in)
const SIGN_G = 1   // gap between sign and device (in)

/** solution footprint = sign + gap + device */
function solWidth(deviceName, isLandscape) {
  const d = DEVICES[deviceName]
  if (!d) throw new Error(`Unknown device: ${deviceName}`)
  return SIGN_W + SIGN_G + (isLandscape ? d.lw : d.pw)
}

// ── 20 test cases ─────────────────────────────────────────────────────────────
// portrait=true means that device is standing portrait; portrait=false = landscape
const TEST_CASES = [
  // ── 84" table ────────────────────────────────────────────────────────────
  {
    id: 'TC01', table: 84, type: IPAD_TABLE_TYPE.ASSORTMENT,
    top:    ['iPad Pro 11"','iPad Air 11"'],
    bottom: ['iPad Pro 13"'],
    desc:   '84" 系列 – 竖 × 2 vs 横 × 1',
    note:   '两侧设备数不同，独立间距，无需对齐',
  },
  {
    id: 'TC02', table: 84, type: IPAD_TABLE_TYPE.ASSORTMENT,
    top:    ['iPad Pro 11"','iPad Air 11"','iPad mini'],
    bottom: ['iPad Air 13"','iPad Pro 13"'],
    desc:   '84" 系列 – 竖 × 3 vs 横 × 2',
    note:   '两侧独立间距',
  },
  {
    id: 'TC03', table: 84, type: IPAD_TABLE_TYPE.COMPARISON,
    top:    ['iPad Pro 11"','iPad Air 11"'],
    bottom: ['iPad Pro 11"','iPad Air 11"'],
    desc:   '84" 对比 – 竖 × 2 vs 横 × 2',
    note:   '同款对比，中心对齐',
  },
  {
    id: 'TC04', table: 84, type: IPAD_TABLE_TYPE.COMPARISON,
    top:    ['iPad mini','iPad Air 11"','iPad Pro 11"'],
    bottom: ['iPad mini','iPad Air 11"','iPad Pro 11"'],
    desc:   '84" 对比 – 竖 × 3 vs 横 × 3',
    note:   '三款同型号对比，中心对齐',
  },
  // ── 96" table ────────────────────────────────────────────────────────────
  {
    id: 'TC05', table: 96, type: IPAD_TABLE_TYPE.ASSORTMENT,
    top:    ['iPad Pro 13"','iPad Air 13"'],
    bottom: ['iPad (A16)','iPad mini','iPad Pro 11"'],
    desc:   '96" 系列 – 竖 × 2 vs 横 × 3',
    note:   '两侧独立间距',
  },
  {
    id: 'TC06', table: 96, type: IPAD_TABLE_TYPE.ASSORTMENT,
    top:    ['iPad Pro 11"','iPad Air 11"','iPad (A16)','iPad mini'],
    bottom: ['iPad Air 13"','iPad Pro 13"'],
    desc:   '96" 系列 – 竖 × 4 vs 横 × 2',
    note:   '两侧独立间距',
  },
  {
    id: 'TC07', table: 96, type: IPAD_TABLE_TYPE.COMPARISON,
    top:    ['iPad Pro 11"','iPad Air 11"','iPad (A16)'],
    bottom: ['iPad Pro 11"','iPad Air 11"','iPad (A16)'],
    desc:   '96" 对比 – 竖 × 3 vs 横 × 3',
    note:   '三款对比，中心对齐',
  },
  {
    id: 'TC08', table: 96, type: IPAD_TABLE_TYPE.COMPARISON,
    top:    ['iPad Air 13"','iPad mini','iPad Pro 11"','iPad (A16)'],
    bottom: ['iPad Air 13"','iPad mini','iPad Pro 11"','iPad (A16)'],
    desc:   '96" 对比 – 竖 × 4 vs 横 × 4',
    note:   '四款对比，中心对齐',
  },
  // ── 120" table ───────────────────────────────────────────────────────────
  {
    id: 'TC09', table: 120, type: IPAD_TABLE_TYPE.ASSORTMENT,
    top:    ['iPad Pro 13"','iPad Air 13"','iPad (A16)'],
    bottom: ['iPad Pro 11"','iPad mini'],
    desc:   '120" 系列 – 竖 × 3 vs 横 × 2',
    note:   '两侧独立间距',
  },
  {
    id: 'TC10', table: 120, type: IPAD_TABLE_TYPE.ASSORTMENT,
    top:    ['iPad mini','iPad Pro 11"','iPad Air 11"','iPad (A16)','iPad Air 13"'],
    bottom: ['iPad Pro 13"','iPad Air 13"','iPad mini'],
    desc:   '120" 系列 – 竖 × 5 vs 横 × 3',
    note:   '两侧独立间距',
  },
  {
    id: 'TC11', table: 120, type: IPAD_TABLE_TYPE.COMPARISON,
    top:    ['iPad Pro 11"','iPad Air 11"','iPad (A16)','iPad mini'],
    bottom: ['iPad Pro 11"','iPad Air 11"','iPad (A16)','iPad mini'],
    desc:   '120" 对比 – 竖 × 4 vs 横 × 4',
    note:   '四款对比，中心对齐',
  },
  {
    id: 'TC12', table: 120, type: IPAD_TABLE_TYPE.COMPARISON,
    top:    ['iPad Pro 13"','iPad Air 13"','iPad Pro 11"'],
    bottom: ['iPad Pro 13"','iPad Air 13"','iPad Pro 11"'],
    desc:   '120" 对比 – 竖 × 3 vs 横 × 3（大尺寸）',
    note:   '大屏对比，中心对齐',
  },
  // ── 144" table ───────────────────────────────────────────────────────────
  {
    id: 'TC13', table: 144, type: IPAD_TABLE_TYPE.ASSORTMENT,
    top:    ['iPad Pro 13"','iPad Air 13"','iPad (A16)','iPad mini'],
    bottom: ['iPad Pro 11"','iPad Air 11"'],
    desc:   '144" 系列 – 竖 × 4 vs 横 × 2',
    note:   '两侧独立间距',
  },
  {
    id: 'TC14', table: 144, type: IPAD_TABLE_TYPE.ASSORTMENT,
    top:    ['iPad Air 11"','iPad mini'],
    bottom: ['iPad Pro 13"','iPad Air 13"','iPad (A16)','iPad Pro 11"'],
    desc:   '144" 系列 – 竖 × 2 vs 横 × 4',
    note:   '两侧独立间距',
  },
  {
    id: 'TC15', table: 144, type: IPAD_TABLE_TYPE.COMPARISON,
    top:    ['iPad Pro 11"','iPad Air 11"','iPad Air 13"','iPad (A16)','iPad mini'],
    bottom: ['iPad Pro 11"','iPad Air 11"','iPad Air 13"','iPad (A16)','iPad mini'],
    desc:   '144" 对比 – 竖 × 5 vs 横 × 5',
    note:   '五款对比，中心对齐',
  },
  {
    id: 'TC16', table: 144, type: IPAD_TABLE_TYPE.COMPARISON,
    top:    ['iPad Pro 13"','iPad Air 13"','iPad (A16)'],
    bottom: ['iPad Pro 13"','iPad Air 13"','iPad (A16)'],
    desc:   '144" 对比 – 竖 × 3 vs 横 × 3',
    note:   '三款大屏对比，中心对齐',
  },
  // ── 180" table ───────────────────────────────────────────────────────────
  {
    id: 'TC17', table: 180, type: IPAD_TABLE_TYPE.ASSORTMENT,
    top:    ['iPad Pro 13"','iPad Air 13"','iPad (A16)','iPad mini','iPad Pro 11"'],
    bottom: ['iPad Air 11"','iPad Air 13"','iPad Pro 11"'],
    desc:   '180" 系列 – 竖 × 5 vs 横 × 3',
    note:   '两侧独立间距',
  },
  {
    id: 'TC18', table: 180, type: IPAD_TABLE_TYPE.ASSORTMENT,
    top:    ['iPad Air 11"','iPad Pro 11"','iPad mini'],
    bottom: ['iPad Pro 13"','iPad Air 13"','iPad (A16)','iPad mini','iPad Air 11"'],
    desc:   '180" 系列 – 竖 × 3 vs 横 × 5',
    note:   '两侧独立间距',
  },
  {
    id: 'TC19', table: 180, type: IPAD_TABLE_TYPE.COMPARISON,
    top:    ['iPad Pro 11"','iPad Air 11"','iPad (A16)','iPad mini','iPad Air 13"','iPad Pro 13"'],
    bottom: ['iPad Pro 11"','iPad Air 11"','iPad (A16)','iPad mini','iPad Air 13"','iPad Pro 13"'],
    desc:   '180" 对比 – 竖 × 6 vs 横 × 6（全线产品）',
    note:   '全线六款对比，中心对齐',
  },
  {
    id: 'TC20', table: 180, type: IPAD_TABLE_TYPE.COMPARISON,
    top:    ['iPad Pro 13"','iPad Air 13"','iPad (A16)','iPad mini'],
    bottom: ['iPad Pro 13"','iPad Air 13"','iPad (A16)','iPad mini'],
    desc:   '180" 对比 – 竖 × 4 vs 横 × 4',
    note:   '四款对比（大桌宽松），中心对齐',
  },
]

// ── Drawing constants ─────────────────────────────────────────────────────────
const SVG_W        = 1200   // canvas pixels
const MARGIN_L     = 60
const MARGIN_R     = 60
const TABLE_PX     = SVG_W - MARGIN_L - MARGIN_R   // 1080 px usable
const RAIL_H       = 110    // rail height in px (device rectangle height)
const RAIL_GAP     = 44     // px vertical gap between the two rails
const TOP_RAIL_Y   = 110    // top of the top rail
const BOT_RAIL_Y   = TOP_RAIL_Y + RAIL_H + RAIL_GAP
const TABLE_DEPTH  = RAIL_H * 2 + RAIL_GAP   // total visible depth
const SVG_H        = BOT_RAIL_Y + RAIL_H + 140

const COL_PORTRAIT  = '#4A90D9'
const COL_LANDSCAPE = '#E8874A'
const COL_SIGN      = '#5CB85C'
const COL_MISMATCH  = '#E0453A'
const COL_ALIGNED   = '#5CB85C'
const COL_MINOR     = '#F0A030'

function px(inches, scale) { return scale * inches }

// ── SVG generator ─────────────────────────────────────────────────────────────
function renderRail(solutions, railY, scale, isPortraitTop, name) {
  const isPortrait = name === 'top' ? isPortraitTop : !isPortraitTop
  const color = isPortrait ? COL_PORTRAIT : COL_LANDSCAPE
  const orientation = isPortrait ? '竖放 (Portrait)' : '横放 (Landscape)'

  let out = `<text x="${MARGIN_L}" y="${railY - 6}" font-size="11" fill="#555" font-family="monospace">${orientation}</text>\n`

  solutions.forEach((sol, i) => {
    const sx = MARGIN_L + px(sol.start, scale)
    const sw = px(sol.width, scale)
    const signW = px(SIGN_W, scale)
    const signG = px(SIGN_G, scale)
    const devW  = sw - signW - signG
    const devX  = sx + signW + signG

    // sign rect
    out += `<rect x="${sx.toFixed(1)}" y="${railY}" width="${signW.toFixed(1)}" height="${RAIL_H}" rx="2" fill="${COL_SIGN}" opacity="0.85"/>\n`
    out += `<text x="${(sx + signW/2).toFixed(1)}" y="${(railY + RAIL_H/2 + 3).toFixed(1)}" text-anchor="middle" font-size="8" fill="white" font-family="monospace">S</text>\n`

    // device rect
    out += `<rect x="${devX.toFixed(1)}" y="${railY}" width="${devW.toFixed(1)}" height="${RAIL_H}" rx="3" fill="${color}" opacity="0.88"/>\n`

    // device index
    const solLabel = `#${i + 1}`
    out += `<text x="${(devX + devW/2).toFixed(1)}" y="${(railY + 18).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="bold" fill="white" font-family="monospace">${solLabel}</text>\n`

    // device name (wrapped)
    const devName = sol.deviceName || ''
    const devW_in = sol.deviceWidth_in.toFixed(2)
    const orient  = isPortrait ? 'P' : 'L'
    const label = `${devName.replace('iPad ', '')} (${devW_in}"${orient})`
    if (devW > 36) {
      out += `<text x="${(devX + devW/2).toFixed(1)}" y="${(railY + 34).toFixed(1)}" text-anchor="middle" font-size="9" fill="white" font-family="monospace" clip-path="url(#clip${name}${i})">${label}</text>\n`
    }

    // widths annotation below rect
    const solW_in = sol.width.toFixed(2)
    out += `<text x="${(sx + sw/2).toFixed(1)}" y="${(railY + RAIL_H + 13).toFixed(1)}" text-anchor="middle" font-size="9" fill="#333" font-family="monospace">${solW_in}"</text>\n`
  })

  return out
}

function generateSVG(tc, result) {
  const A     = tc.table
  const scale = TABLE_PX / A
  const typ   = tc.type === IPAD_TABLE_TYPE.ASSORTMENT ? '系列' : '对比'
  const key   = nearestKey(A, IPAD_Y_GAP)
  const Y     = IPAD_Y_GAP[key]
  const Z     = IPAD_Z_GAP[key]

  const topSols  = result.top.layout
  const botSols  = result.bottom.layout

  // annotate each solution with device info for rendering
  tc.top.forEach((name, i) => {
    if (topSols[i]) {
      topSols[i].deviceName     = name
      topSols[i].deviceWidth_in = DEVICES[name].pw
    }
  })
  tc.bottom.forEach((name, i) => {
    if (botSols[i]) {
      botSols[i].deviceName     = name
      botSols[i].deviceWidth_in = DEVICES[name].lw
    }
  })

  // gap annotations
  function gapAnnotations(layout, railY, labelY) {
    let out = ''
    for (let i = 1; i < layout.length; i++) {
      const prev   = layout[i - 1]
      const cur    = layout[i]
      const gapIn  = (cur.start - prev.end).toFixed(2)
      const gx1    = MARGIN_L + px(prev.end, scale)
      const gx2    = MARGIN_L + px(cur.start, scale)
      const mx     = (gx1 + gx2) / 2
      out += `<line x1="${gx1.toFixed(1)}" y1="${labelY}" x2="${gx2.toFixed(1)}" y2="${labelY}" stroke="#888" stroke-width="1" stroke-dasharray="3,2"/>\n`
      out += `<text x="${mx.toFixed(1)}" y="${(labelY - 2).toFixed(1)}" text-anchor="middle" font-size="9" fill="#666" font-family="monospace">${gapIn}"</text>\n`
    }
    // edge left
    const leftEdge = layout[0]?.start ?? 0
    const rightEdge = A - (layout[layout.length - 1]?.end ?? A)
    out += `<text x="${(MARGIN_L + px(leftEdge / 2, scale)).toFixed(1)}" y="${(labelY - 2).toFixed(1)}" text-anchor="middle" font-size="9" fill="#999" font-family="monospace">${leftEdge.toFixed(2)}"</text>\n`
    out += `<text x="${(MARGIN_L + px(A - rightEdge / 2, scale)).toFixed(1)}" y="${(labelY - 2).toFixed(1)}" text-anchor="middle" font-size="9" fill="#999" font-family="monospace">${rightEdge.toFixed(2)}"</text>\n`
    return out
  }

  // alignment lines between top and bottom solutions (comparison mode)
  function alignLines() {
    if (result.spacingMode !== 'center-aligned' && !result.alignmentRequired === false) return ''
    // For assortment tables draw as informational grey dashes; comparison = coloured by status
    const isInfo = !result.alignmentRequired
    let out = ''
    const pairs = result.alignment?.pairs || []
    pairs.forEach((p) => {
      const tidx = result.top.layout[p.index]
      const bidx = result.bottom.layout[p.index]
      if (!tidx || !bidx) return
      const txc = MARGIN_L + px(tidx.center, scale)
      const bxc = MARGIN_L + px(bidx.center, scale)
      const lineColor = isInfo ? '#ccc'
            : p.status === 'aligned' ? COL_ALIGNED
            : p.status === 'minor-adjust' ? COL_MINOR : COL_MISMATCH
      const dashArr = isInfo ? '2,4' : '4,3'
      out += `<line x1="${txc.toFixed(1)}" y1="${TOP_RAIL_Y + RAIL_H}" x2="${bxc.toFixed(1)}" y2="${BOT_RAIL_Y}" stroke="${lineColor}" stroke-width="1.5" stroke-dasharray="${dashArr}" opacity="0.7"/>\n`
    })
    return out
  }

  // PASS / WARN determination
  const warnings = result.warnings || []
  const hasMajor = result.alignmentRequired && result.alignment?.majorCount > 0
  const status   = hasMajor ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS'
  const statusC  = status === 'PASS' ? '#2a9d2a' : status === 'WARN' ? '#d07000' : '#cc2222'

  const topX_str  = result.top.X != null ? `X=${result.top.X.toFixed(3)}"` : `(center-aligned)`
  const botX_str  = result.bottom.X != null ? `X=${result.bottom.X.toFixed(3)}"` : `(center-aligned)`
  const topEdge   = result.top.edgeLeft.toFixed(3)
  const botEdge   = result.bottom.edgeLeft.toFixed(3)

  const tableLabel = `${A}" (${A === 84 ? '7-ft' : A === 96 ? '8-ft' : A === 120 ? '10-ft'
    : A === 144 ? '12-ft' : A === 180 ? '15-ft' : A + '"'}) 展示桌`

  // Spacing rule verification line
  const ruleY  = `查表 Y=${Y}" / Z=${Z}" (@${key}"key)`
  const topSum  = tc.top.reduce((s, n) => s + solWidth(n, false), 0)
  const botSum  = tc.bottom.reduce((s, n) => s + solWidth(n, true), 0)
  const fitTop  = topSum < A ? '✓ fits' : '✗ overflow'
  const fitBot  = botSum < A ? '✓ fits' : '✗ overflow'

  // Assemble warning lines
  const warnLines = warnings.length > 0
    ? warnings.map(w => `<tspan x="30" dy="13" fill="#c8600a">⚠ ${w.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</tspan>`).join('')
    : `<tspan x="30" dy="13" fill="${COL_ALIGNED}">✓ 无告警</tspan>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}">
  <style>
    text { font-family: 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif; }
  </style>

  <!-- Background -->
  <rect width="${SVG_W}" height="${SVG_H}" fill="#f7f8fa"/>

  <!-- Title bar -->
  <rect x="0" y="0" width="${SVG_W}" height="50" rx="0" fill="#1d1d1f"/>
  <text x="20" y="20" font-size="13" fill="white" font-weight="bold">${tc.id} — ${tc.desc}</text>
  <text x="20" y="38" font-size="11" fill="#aaa">${tableLabel} · ${typ}展示桌 · 所有设备含 2×3 产品标牌 · ${ruleY}</text>
  <!-- Status badge -->
  <rect x="${SVG_W - 80}" y="8" width="60" height="26" rx="5" fill="${statusC}"/>
  <text x="${SVG_W - 50}" y="26" text-anchor="middle" font-size="14" font-weight="bold" fill="white">${status}</text>

  <!-- Table surface -->
  <rect x="${MARGIN_L}" y="${TOP_RAIL_Y - 20}" width="${TABLE_PX}" height="${TABLE_DEPTH + 40}" rx="4"
        fill="white" stroke="#ccc" stroke-width="1.5"/>

  <!-- Rail backgrounds -->
  <rect x="${MARGIN_L}" y="${TOP_RAIL_Y}" width="${TABLE_PX}" height="${RAIL_H}" rx="2" fill="#e8f0fb" opacity="0.5"/>
  <rect x="${MARGIN_L}" y="${BOT_RAIL_Y}" width="${TABLE_PX}" height="${RAIL_H}" rx="2" fill="#fdebd8" opacity="0.5"/>

  <!-- Centre divider label -->
  <line x1="${MARGIN_L}" y1="${TOP_RAIL_Y + RAIL_H + RAIL_GAP / 2}" x2="${MARGIN_L + TABLE_PX}" y2="${TOP_RAIL_Y + RAIL_H + RAIL_GAP / 2}"
        stroke="#ddd" stroke-width="1" stroke-dasharray="6,4"/>
  <text x="${SVG_W / 2}" y="${TOP_RAIL_Y + RAIL_H + RAIL_GAP / 2 + 4}" text-anchor="middle" font-size="9" fill="#bbb">
    ← 展台中心分隔线 →</text>

  <!-- Table edge rulers -->
  <line x1="${MARGIN_L}" y1="${TOP_RAIL_Y - 30}" x2="${MARGIN_L + TABLE_PX}" y2="${TOP_RAIL_Y - 30}" stroke="#aaa" stroke-width="1"/>
  <line x1="${MARGIN_L}" y1="${TOP_RAIL_Y - 35}" x2="${MARGIN_L}" y2="${TOP_RAIL_Y - 25}" stroke="#aaa" stroke-width="1"/>
  <line x1="${MARGIN_L + TABLE_PX}" y1="${TOP_RAIL_Y - 35}" x2="${MARGIN_L + TABLE_PX}" y2="${TOP_RAIL_Y - 25}" stroke="#aaa" stroke-width="1"/>
  <text x="${MARGIN_L + TABLE_PX / 2}" y="${TOP_RAIL_Y - 14}" text-anchor="middle" font-size="11" fill="#555">${A}"</text>

  <!-- Top rail (Portrait) -->
  ${renderRail(topSols, TOP_RAIL_Y, scale, true, 'top')}
  <!-- Top gap annotations -->
  ${gapAnnotations(topSols, TOP_RAIL_Y, TOP_RAIL_Y - 40)}

  <!-- Bottom rail (Landscape) -->
  ${renderRail(botSols, BOT_RAIL_Y, scale, false, 'bottom')}
  <!-- Bottom gap annotations -->
  ${gapAnnotations(botSols, BOT_RAIL_Y, BOT_RAIL_Y + RAIL_H + 28)}

  <!-- Alignment lines (comparison only) -->
  ${alignLines()}

  <!-- Info panel -->
  <rect x="20" y="${BOT_RAIL_Y + RAIL_H + 50}" width="${SVG_W - 40}" height="68" rx="4"
        fill="white" stroke="#ddd" stroke-width="1"/>
  <text font-size="10" fill="#444" font-family="monospace">
    <tspan x="30" y="${BOT_RAIL_Y + RAIL_H + 64}">
      竖排(上)：${tc.top.length} 台 [${tc.top.join(', ')}]  |  ${topX_str}  |  边缘 ${topEdge}"  |  总宽 ${topSum.toFixed(2)}"  ${fitTop}
    </tspan>
    <tspan x="30" dy="14">
      横排(下)：${tc.bottom.length} 台 [${tc.bottom.join(', ')}]  |  ${botX_str}  |  边缘 ${botEdge}"  |  总宽 ${botSum.toFixed(2)}"  ${fitBot}
    </tspan>
    <tspan x="30" dy="14">模式：${result.spacingMode}  |  类型：${result.tableType ?? 'default'}  |  备注：${tc.note}</tspan>
  </text>

  <!-- Warnings / pass -->
  <text font-size="10" fill="#444" font-family="monospace">
    ${warnLines}
  </text>

  <!-- Legend -->
  <rect x="20" y="${SVG_H - 22}" width="12" height="12" rx="2" fill="${COL_PORTRAIT}"/>
  <text x="36" y="${SVG_H - 12}" font-size="10" fill="#555">竖放 (Portrait)</text>
  <rect x="140" y="${SVG_H - 22}" width="12" height="12" rx="2" fill="${COL_LANDSCAPE}"/>
  <text x="156" y="${SVG_H - 12}" font-size="10" fill="#555">横放 (Landscape)</text>
  <rect x="280" y="${SVG_H - 22}" width="12" height="12" rx="2" fill="${COL_SIGN}"/>
  <text x="296" y="${SVG_H - 12}" font-size="10" fill="#555">2×3 Product Sign (3"+1" gap)</text>
  <text x="${SVG_W - 20}" y="${SVG_H - 12}" text-anchor="end" font-size="9" fill="#bbb">
    Generated: ${new Date().toISOString().slice(0, 10)}
  </text>
</svg>`
}

// ── Run all 20 test cases ─────────────────────────────────────────────────────
const RESULTS = []
let passCount = 0, warnCount = 0, failCount = 0

for (const tc of TEST_CASES) {
  const A      = tc.table
  const topW   = tc.top.map(n   => solWidth(n, false))    // top = portrait
  const botW   = tc.bottom.map(n => solWidth(n, true))    // bottom = landscape

  const result = calcIpadDoubleSide(A, topW, botW, tc.type)

  let verdict = 'PASS'
  if (!result) {
    verdict = 'FAIL-NULL'
    failCount++
  } else if (result.alignmentRequired && result.alignment?.majorCount > 0) {
    // Only flag major misalignment for comparison (对比) tables where alignment is required
    verdict = 'FAIL'
    failCount++
  } else if (result.warnings?.length > 0) {
    verdict = 'WARN'
    warnCount++
  } else {
    passCount++
  }

  const topEdge  = result?.top?.edgeLeft ?? null
  const botEdge  = result?.bottom?.edgeLeft ?? null
  const topX     = result?.top?.X
  const botX     = result?.bottom?.X

  RESULTS.push({ tc, result, verdict })

  // Verify gap rules
  const key   = nearestKey(A, IPAD_Y_GAP)
  const Y_exp = IPAD_Y_GAP[key]
  const Z_exp = IPAD_Z_GAP[key]
  const alignReq = result?.alignmentRequired ?? false

  console.log(`\n${tc.id}: ${tc.desc}`)
  console.log(`  Table: ${A}" [key=${key}"]  Y=${Y_exp}"  Z=${Z_exp}"`)
  console.log(`  Type: ${tc.type}  Mode: ${result?.spacingMode ?? 'N/A'}  AlignRequired: ${alignReq}`)
  console.log(`  Top    (竖): ${tc.top.length} items · widths=[${topW.map(w => w.toFixed(2)).join(', ')}]"`)
  console.log(`           → X=${topX?.toFixed(3) ?? '-'}"  edgeL=${topEdge?.toFixed(3) ?? '-'}"`)
  console.log(`  Bottom (横): ${tc.bottom.length} items · widths=[${botW.map(w => w.toFixed(2)).join(', ')}]"`)
  console.log(`           → X=${botX?.toFixed(3) ?? '-'}"  edgeL=${botEdge?.toFixed(3) ?? '-'}"`)
  if (result?.warnings?.length) result.warnings.forEach(w => console.log(`  ⚠  ${w}`))
  if (result?.alignment?.pairs?.length) {
    result.alignment.pairs.forEach(p => {
      const mark = !alignReq ? '—' : p.status === 'aligned' ? '✓' : p.status === 'minor-adjust' ? '△' : '✗'
      const note = !alignReq ? ' (无需对齐)' : ''
      console.log(`  ${mark} 对 ${p.index + 1}: topCenter=${p.topCenter?.toFixed(3)}"  botCenter=${p.bottomCenter?.toFixed(3)}"  Δ=${p.delta?.toFixed(3)}"${note}`)
    })
  }
  console.log(`  → ${verdict}`)

  // Generate SVG
  const svg  = generateSVG(tc, result)
  const file = join(QA_DIR, `${tc.id.toLowerCase()}.svg`)
  writeFileSync(file, svg, 'utf8')
  console.log(`  💾 ${file}`)
}

// ── HTML index ────────────────────────────────────────────────────────────────
function statusBadge(v) {
  const c = v === 'PASS' ? '#2a9d2a' : v === 'WARN' ? '#d07000' : '#cc2222'
  return `<span style="background:${c};color:white;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:bold">${v}</span>`
}

const tableRows = RESULTS.map(({ tc, result, verdict }) => {
  const topX   = result?.top?.X?.toFixed(3) ?? '—'
  const botX   = result?.bottom?.X?.toFixed(3) ?? '—'
  const mode   = result?.spacingMode ?? '—'
  const typ    = tc.type === IPAD_TABLE_TYPE.ASSORTMENT ? '系列' : '对比'
  return `
    <tr>
      <td><a href="${tc.id.toLowerCase()}.svg" target="_blank">${tc.id}</a></td>
      <td>${tc.table}"</td>
      <td>${typ}</td>
      <td>${tc.top.length} × 竖放</td>
      <td>${tc.bottom.length} × 横放</td>
      <td>${topX}"</td>
      <td>${botX}"</td>
      <td>${mode}</td>
      <td>${statusBadge(verdict)}</td>
    </tr>`
}).join('')

const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<title>iPad 间距 QA — 20 Cases</title>
<style>
  body { font-family: 'PingFang SC', Arial, sans-serif; margin: 24px; background: #f7f8fa; }
  h1  { margin-bottom: 4px; }
  .summary { display:flex; gap:16px; margin: 12px 0 20px; }
  .badge { padding: 8px 20px; border-radius: 6px; font-size: 15px; font-weight: bold; color: white; }
  table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.1); }
  th { background: #1d1d1f; color: white; padding: 10px 12px; text-align: left; font-size: 13px; }
  td { padding: 9px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #f0f4ff; }
  a { color: #0066cc; text-decoration: none; font-weight: bold; }
  a:hover { text-decoration: underline; }
  .grid { display:grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 24px; }
  .card { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
  .card img { width: 100%; display: block; }
  .card p { margin: 6px 10px 10px; font-size: 12px; color: #555; }
</style>
</head>
<body>
<h1>iPad 间距验证 — QA 报告</h1>
<p style="color:#666">生成时间：${new Date().toLocaleString('zh-CN')} · 共 20 个场景 · 一排全竖放 / 一排全横放 · 所有设备含 2×3 产品标牌</p>

<div class="summary">
  <div class="badge" style="background:#2a9d2a">✓ PASS ${passCount}</div>
  <div class="badge" style="background:#d07000">△ WARN ${warnCount}</div>
  <div class="badge" style="background:#cc2222">✗ FAIL ${failCount}</div>
</div>

<table>
  <thead>
    <tr>
      <th>编号</th><th>桌宽</th><th>类型</th>
      <th>竖排（上）</th><th>横排（下）</th>
      <th>X 上</th><th>X 下</th><th>间距模式</th><th>结果</th>
    </tr>
  </thead>
  <tbody>${tableRows}</tbody>
</table>

<div class="grid">
${RESULTS.map(({ tc, verdict }) => {
  const c = verdict === 'PASS' ? '#2a9d2a' : verdict === 'WARN' ? '#d07000' : '#cc2222'
  return `  <div class="card">
    <a href="${tc.id.toLowerCase()}.svg" target="_blank">
      <img src="${tc.id.toLowerCase()}.svg" alt="${tc.id}" style="border-bottom:3px solid ${c}"/>
    </a>
    <p><strong>${tc.id}</strong> — ${tc.desc}</p>
  </div>`
}).join('\n')}
</div>

<p style="margin-top:24px;color:#aaa;font-size:11px">
  运算核心：src/calc.js · calcIpadDoubleSide / IPAD_Y_GAP / IPAD_Z_GAP / IPAD_TABLE_TYPE
</p>
</body>
</html>`

writeFileSync(join(QA_DIR, 'index.html'), html, 'utf8')
console.log(`\n${'─'.repeat(60)}`)
console.log(`QA 完成：PASS ${passCount}  /  WARN ${warnCount}  /  FAIL ${failCount}`)
console.log(`输出目录：${QA_DIR}`)
console.log(`${'─'.repeat(60)}`)
