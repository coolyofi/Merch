/**
 * blueprint-canvas.js
 * Draws a blueprint-style plan-view table diagram.
 *
 * Coordinate system:
 *   X →  table width  (left = 0, right = table.width in inches)
 *   Y ↓  table depth  (top = back edge, bottom = front edge)
 *
 * Colours are inspired by engineering blueprints:
 *   background:  deep navy  #071020
 *   table fill:  dark blue  #0d1e3a
 *   grid lines:  dim cyan
 *   elements:    coloured by type
 */

// ── Blueprint palette ─────────────────────────────────────────────────────
const PALETTE = {
  bg:          '#071020',
  tableFill:   '#0d1e3a',
  tableBorder: '#1d4ed8',
  gridMajor:   'rgba(59,130,246,0.35)',   // 10" lines
  gridMinor:   'rgba(59,130,246,0.15)',   // 5" lines
  tick:        'rgba(96,165,250,0.7)',
  labelDim:    'rgba(147,197,253,0.55)',
  labelBright: 'rgba(191,219,254,0.9)',
  white:       '#e2e8f0',
  remaining:   'rgba(255,255,255,0.06)',
  remainBorder:'rgba(255,255,255,0.18)',
  frontLabel:  'rgba(251,191,36,0.85)',
  backLabel:   'rgba(167,243,208,0.85)',
}

const TYPE_COLORS = {
  product: '#2563eb',
  bundle:  '#7c3aed',
  sign:    '#d97706',
  prop:    '#059669',
  spacer:  '#4b5563',
}

const RAIL_DEPTH_IN = 10  // each rail visually represents 10 inches of depth

// ─── Utility ─────────────────────────────────────────────────────────────────
function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)
  if (w < 0) { x += w; w = -w }
  if (h < 0) { y += h; h = -h }
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function truncate(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text
  while (text.length > 1 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1)
  return text + '…'
}

function inToFt(inches) {
  const ft = Math.floor(inches / 12)
  const rem = Math.round(inches % 12)
  return rem === 0 ? `${ft}'` : ft === 0 ? `${rem}"` : `${ft}'${rem}"`
}

// ─── Main draw function ───────────────────────────────────────────────────────
/**
 * @param {HTMLCanvasElement} canvas
 * @param {object}            blueprintData   output of generateBlueprintData()
 */
export function drawBlueprint(canvas, blueprintData) {
  const { table, mode, front, back } = blueprintData

  // ── Container size ──────────────────────────────────────────────────────
  const container = canvas.parentElement
  const cssW      = Math.max(container.clientWidth, 400)
  const dpr       = Math.min(window.devicePixelRatio || 1, 2)

  // ── Margins ─────────────────────────────────────────────────────────────
  const ML = 58   // left  — depth labels
  const MR = 20   // right
  const MT = 56   // top   — widths/ft labels
  const MB = 48   // bottom

  const availW  = cssW - ML - MR
  const scale   = availW / table.width   // px per inch

  // Cap depth scale so table height ≤ 60% of width
  const maxTableH   = Math.max(availW * 0.65, 260)
  const rawTableH   = table.depth * scale
  const tableH      = Math.min(rawTableH, maxTableH)
  const cssH        = tableH + MT + MB

  canvas.width        = cssW * dpr
  canvas.height       = cssH * dpr
  canvas.style.width  = cssW + 'px'
  canvas.style.height = cssH + 'px'

  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  const TX = ML         // table left edge (canvas coords)
  const TY = MT         // table top edge  (canvas coords)
  const TW = availW     // table width in px
  const TH = tableH     // table height in px

  // depth scale (px per inch), may differ from width scale if capped
  const DS = tableH / table.depth

  // Rail height in px (based on RAIL_DEPTH_IN inches of actual depth)
  const RAIL_H = Math.max(DS * RAIL_DEPTH_IN, 28)
  const frontRailY = TY + TH - RAIL_H
  const backRailY  = TY

  // ── Background ──────────────────────────────────────────────────────────
  ctx.fillStyle = PALETTE.bg
  ctx.fillRect(0, 0, cssW, cssH)

  // ── Table body ──────────────────────────────────────────────────────────
  ctx.fillStyle = PALETTE.tableFill
  rrect(ctx, TX, TY, TW, TH, 4)
  ctx.fill()

  // ── Depth grid lines every 5" ────────────────────────────────────────────
  ctx.save()
  ctx.beginPath()
  rrect(ctx, TX, TY, TW, TH, 4)
  ctx.clip()

  for (let d = 5; d < table.depth; d += 5) {
    const y = TY + d * DS
    const isMajor = d % 10 === 0
    ctx.strokeStyle = isMajor ? PALETTE.gridMajor : PALETTE.gridMinor
    ctx.lineWidth   = isMajor ? 0.8 : 0.5
    ctx.setLineDash(isMajor ? [] : [3, 3])
    ctx.beginPath()
    ctx.moveTo(TX, y)
    ctx.lineTo(TX + TW, y)
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.restore()

  // Depth axis labels (left side)
  ctx.font        = '9px "SF Mono", monospace'
  ctx.fillStyle   = PALETTE.labelDim
  ctx.textAlign   = 'right'
  ctx.textBaseline = 'middle'
  for (let d = 0; d <= table.depth; d += 5) {
    const y = TY + d * DS
    ctx.fillText(`${d}"`, TX - 6, y)
  }
  ctx.textBaseline = 'alphabetic'

  // ── Width tick marks every 12" (1 ft) ────────────────────────────────────
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  for (let w = 0; w <= table.width; w += 12) {
    const x = TX + w * scale
    // tick line
    ctx.strokeStyle = PALETTE.tick
    ctx.lineWidth   = w % 60 === 0 ? 1 : 0.5
    ctx.beginPath()
    ctx.moveTo(x, TY - 6)
    ctx.lineTo(x, TY + 14)
    ctx.stroke()
    // foot label
    ctx.fillStyle = PALETTE.labelBright
    ctx.font      = `${w % 60 === 0 ? 'bold ' : ''}10px "SF Mono", monospace`
    ctx.fillText(inToFt(w), x, TY - 9)
  }
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign    = 'left'

  // ── Table border ──────────────────────────────────────────────────────────
  ctx.strokeStyle = PALETTE.tableBorder
  ctx.lineWidth   = 2
  rrect(ctx, TX, TY, TW, TH, 4)
  ctx.stroke()

  // Front / back edge lines
  ctx.strokeStyle = 'rgba(96,165,250,0.5)'
  ctx.lineWidth   = 1
  // Front edge (bottom)
  ctx.beginPath(); ctx.moveTo(TX, TY + TH); ctx.lineTo(TX + TW, TY + TH); ctx.stroke()
  // Back edge (top)
  ctx.beginPath(); ctx.moveTo(TX, TY); ctx.lineTo(TX + TW, TY); ctx.stroke()

  // ── Rail zones ─────────────────────────────────────────────────────────
  // Front rail fill
  ctx.fillStyle = 'rgba(251,191,36,0.05)'
  ctx.fillRect(TX, frontRailY, TW, RAIL_H)
  ctx.strokeStyle = 'rgba(251,191,36,0.3)'
  ctx.lineWidth = 0.5
  ctx.strokeRect(TX, frontRailY, TW, RAIL_H)

  // Back rail fill
  if (back) {
    ctx.fillStyle = 'rgba(52,211,153,0.05)'
    ctx.fillRect(TX, backRailY, TW, RAIL_H)
    ctx.strokeStyle = 'rgba(52,211,153,0.3)'
    ctx.lineWidth = 0.5
    ctx.strokeRect(TX, backRailY, TW, RAIL_H)
  }

  // ── Element blocks ────────────────────────────────────────────────────────
  drawRailBlocks(ctx, front.items, TX, frontRailY, RAIL_H, scale, table.width, front.remaining, 'front')
  if (back) {
    drawRailBlocks(ctx, back.items, TX, backRailY, RAIL_H, scale, table.width, back.remaining, 'back')
  }

  // ── Rail labels ──────────────────────────────────────────────────────────
  ctx.font      = 'bold 9px sans-serif'
  ctx.fillStyle = PALETTE.frontLabel
  ctx.fillText('FRONT ›', TX + 4, frontRailY + RAIL_H - 5)

  if (back) {
    ctx.fillStyle = PALETTE.backLabel
    ctx.fillText('BACK ›', TX + 4, backRailY + 13)
  }

  // ── Table width label (centered top) ─────────────────────────────────────
  ctx.font      = 'bold 13px sans-serif'
  ctx.fillStyle = PALETTE.white
  ctx.textAlign = 'center'
  const widthLabel = `${table.name || 'Table'} — ${inToFt(table.width)} wide × ${table.depth}" deep`
  ctx.fillText(widthLabel, TX + TW / 2, TY - 32)

  // front usage summary
  const frontPct   = ((front.used / table.width) * 100).toFixed(1)
  const usageLine  = `Front: ${front.used.toFixed(1)}" used  |  ${front.remaining >= 0 ? front.remaining.toFixed(1) + '" free' : 'OVER by ' + Math.abs(front.remaining).toFixed(1) + '"'}`
  ctx.font      = '10px sans-serif'
  ctx.fillStyle = front.remaining < 0 ? '#f87171' : PALETTE.labelDim
  ctx.fillText(usageLine, TX + TW / 2, cssH - 16)

  ctx.textAlign = 'left'

  // ── Scale bar ─────────────────────────────────────────────────────────────
  drawScaleBar(ctx, TX + TW - 100, cssH - 20, scale)
}

// ─── Draw rail blocks ────────────────────────────────────────────────────────
function drawRailBlocks(ctx, items, railX, railY, railH, scale, tableWidth, remaining, side) {
  const PADDING = 3

  items.forEach(item => {
    if (!item.element) return
    const px     = railX + item.xStart * scale
    const pw     = item.width * scale
    const type   = item.element.type || 'product'
    const color  = TYPE_COLORS[type] || '#2563eb'

    // Block fill
    ctx.save()
    ctx.beginPath()
    rrect(ctx, px + 1, railY + 1, pw - 2, railH - 2, 3)
    ctx.fillStyle = color + 'cc'
    ctx.fill()
    // Block border
    ctx.strokeStyle = color
    ctx.lineWidth   = 1.2
    ctx.stroke()
    ctx.restore()

    // Label (if block is wide enough)
    if (pw > 22) {
      const label = item.element.name
      ctx.save()
      // Clip to block area
      ctx.beginPath()
      rrect(ctx, px + 1, railY + 1, pw - 2, railH - 2, 3)
      ctx.clip()

      ctx.font         = `${pw > 60 ? 10 : 8}px sans-serif`
      ctx.fillStyle    = 'rgba(255,255,255,0.95)'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      const truncated = truncate(ctx, label, pw - 8)
      ctx.fillText(truncated, px + pw / 2, railY + railH / 2)

      // Width label below name
      if (railH > 26 && pw > 35) {
        ctx.font      = '8px "SF Mono", monospace'
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.fillText(`${item.width}"`, px + pw / 2, railY + railH / 2 + 10)
      }

      ctx.restore()
    }
  })

  // Remaining space block
  if (remaining > 0.01) {
    const startPx = railX + (tableWidth - remaining) * scale
    const remPx   = remaining * scale

    ctx.save()
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = PALETTE.remainBorder
    ctx.lineWidth   = 1
    ctx.beginPath()
    rrect(ctx, startPx + 1, railY + 1, remPx - 2, railH - 2, 3)
    ctx.stroke()
    ctx.setLineDash([])

    if (remPx > 30) {
      ctx.font         = '9px "SF Mono", monospace'
      ctx.fillStyle    = 'rgba(255,255,255,0.35)'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${remaining.toFixed(1)}" free`, startPx + remPx / 2, railY + railH / 2)
    }
    ctx.restore()
  }
}

// ─── Scale bar ───────────────────────────────────────────────────────────────
function drawScaleBar(ctx, x, y, scale) {
  // Find a nice scale bar length: try 12", 24", 36"...
  const candidates = [6, 12, 24, 36, 60]
  const targetPx   = 80
  const chosen     = candidates.reduce((best, c) =>
    Math.abs(c * scale - targetPx) < Math.abs(best * scale - targetPx) ? c : best
  )
  const barW = chosen * scale

  ctx.strokeStyle = 'rgba(148,163,184,0.6)'
  ctx.lineWidth   = 1
  ctx.beginPath()
  ctx.moveTo(x, y); ctx.lineTo(x + barW, y)
  ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4)
  ctx.moveTo(x + barW, y - 4); ctx.lineTo(x + barW, y + 4)
  ctx.stroke()

  ctx.font         = '9px "SF Mono", monospace'
  ctx.fillStyle    = 'rgba(148,163,184,0.6)'
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(inToFt(chosen), x + barW / 2, y + 6)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign    = 'left'
}

// ─── Export as PNG ─────────────────────────────────────────────────────────
export function exportBlueprintPNG(canvas, filename = 'blueprint.png') {
  const a = document.createElement('a')
  a.href     = canvas.toDataURL('image/png')
  a.download = filename
  a.click()
}
