/**
 * draw.js — Canvas drawing engine
 * Renders top-down (plan) view of a table with solutions,
 * dimension brackets (X÷2, X, B, Y, Z), product silhouettes,
 * cable management lines, and 1" depth offset marker.
 *
 * All x/y coordinates are in CSS pixels; the engine handles DPR scaling.
 */

// ── Palette ──────────────────────────────────────────────────────────────────
export const PALETTE = [
  '#34c759', '#0071e3', '#ff9f0a', '#ff375f',
  '#bf5af2', '#5e5ce6', '#64d2ff', '#30d158',
  '#ff6961', '#ffd60a',
]

// Product types supported for silhouette rendering
export const PRODUCT_TYPES = {
  ipad:     { label: 'iPad',         shape: 'rect'      },
  macbook:  { label: 'MacBook',      shape: 'trapezoid' },
  iphone:   { label: 'iPhone',       shape: 'phone'     },
  avp:      { label: 'Apple Vision Pro', shape: 'oval'  },
  mac:      { label: 'Mac',          shape: 'rect'      },
  accessory:{ label: 'Accessory',    shape: 'rect'      },
}

const WOOD        = '#cda97d'
const WOOD_GRAIN  = 'rgba(255,255,255,0.18)'
const WOOD_EDGE   = '#c49a6b'
const WOOD_DARK   = '#b07d46'   // table end-caps
const FLITCH      = 'rgba(255,255,255,0.14)'
const DIVIDER     = 'rgba(255,255,255,0.28)'   // brighter for dark theme
const BRACKET_CLR = '#1d5fbd'
const B_LABEL_CLR = '#0071e3'
const DIM_FONT    = '10px -apple-system,BlinkMacSystemFont,sans-serif'
const LABEL_FONT  = '11px -apple-system,BlinkMacSystemFont,sans-serif'
const BOLD_FONT   = 'bold 11px -apple-system,BlinkMacSystemFont,sans-serif'
const CABLE_CLR   = 'rgba(255,255,255,0.85)'  // white cable lines

// ── Public API ────────────────────────────────────────────────────────────────

function resolveTableSpan(W, PAD) {
  const rawW = W - PAD * 2
  const tableW = rawW * 0.92   // fill ~92% of available width for better visual use
  const tableX = (W - tableW) / 2
  return { tableX, tableW }
}

/**
 * Draw a single-sided table (general / signage / comparison)
 * @param {HTMLCanvasElement} canvas
 * @param {object} result  - output of calcGeneral / calcSignage
 * @param {string[]} names - solution names
 * @param {object} opts    - { showFlitch, isSignage, productTypes, showCables, dimLabels }
 *   productTypes: string[] parallel to names, e.g. ['ipad','macbook']
 *   dimLabels: string[] parallel to names — override bracket label above each solution (e.g. 'Y','Z')
 *   showCables: boolean — draw cable management loops under solutions
 */
export function drawSingleSide(canvas, result, names, opts = {}) {
  const { showFlitch = true, isSignage = false, productTypes = [], showCables = false, dimLabels = [] } = opts
  const ctx = prepare(canvas)
  if (!ctx) return

  const { W, H, dpr } = ctx._meta
  ctx.clearRect(0, 0, W, H)

  const PAD    = 32
  const { tableX, tableW } = resolveTableSpan(W, PAD)
  const tableH = 132
  const topBracketH = 36   // space above table for B + optional dim labels
  const tableY = topBracketH + 16

  const canvasH = tableY + tableH + 72
  resizeCanvas(canvas, W, canvasH, dpr)
  ctx.clearRect(0, 0, W, canvasH)

  const scale = tableW / result.A

  drawTableBody(ctx, tableX, tableY, tableW, tableH, showFlitch)
  drawLengthGrid(ctx, tableX, tableY, tableW, tableH, result.A)
  if (showCables) drawCableLines(ctx, tableX, tableY, tableH, result.layout, scale)
  drawProductSilhouettes(ctx, tableX, tableY, tableH, result.layout, productTypes, scale)
  drawSolutionOverlays(ctx, tableX, tableY, tableH, result.layout, names, scale)
  drawBBrackets(ctx, tableX, tableY, result.layout, scale, dimLabels)
  drawDimLabelsAbove(ctx, tableX, tableY, result.layout, scale, dimLabels)
  drawDepthOffset(ctx, tableX, tableY, tableW, tableH, scale, false)
  drawXBrackets(ctx, tableX, tableY + tableH + 26, result, scale, isSignage)
  drawASpan(ctx, tableX, tableY - topBracketH, tableW, result.A)

  flush(canvas, ctx, dpr)
}

/**
 * Draw a double-sided table (iPhone / Mac Comparison)
 * Top side = "front row", bottom side = "back row" (mirrored, dimmed)
 * Dashed center lines connect matching solution centers.
 * opts: { productTypes, dimLabels, showCables }
 */
export function drawDoubleSide(canvas, result, names, opts = {}) {
  const {
    productTypes = [],
    bottomProductTypes = [],
    bottomNames = [],
    dimLabels = [],
    showCables = false,
  } = opts
  const ctx = prepare(canvas)
  if (!ctx) return

  const { W, H, dpr } = ctx._meta
  ctx.clearRect(0, 0, W, H)

  const PAD    = 32
  const { tableX: PADX, tableW } = resolveTableSpan(W, PAD)
  const tableH = 112
  const gap    = 46          // gap between the two table halves
  const topBracketH = 52    // extra room for depth bracket + B/dim labels
  const topY   = topBracketH + 10
  const botY   = topY + tableH + gap
  const canvasH = topY + tableH * 2 + gap + 78

  resizeCanvas(canvas, W, canvasH, dpr)
  ctx.clearRect(0, 0, W, canvasH)

  const topResult = result.top || result
  const bottomResult = result.bottom || result
  const topNames = names || []
  const botNames = bottomNames.length ? bottomNames : topNames
  const topTypes = productTypes || []
  const botTypes = bottomProductTypes.length ? bottomProductTypes : topTypes
  const scale = tableW / result.A

  // Top table — front edge faces UP (customers approach from top)
  drawTableBody(ctx, PADX, topY, tableW, tableH, false)
  drawLengthGrid(ctx, PADX, topY, tableW, tableH, result.A)
  if (showCables) drawCableLines(ctx, PADX, topY, tableH, topResult.layout, scale)
  drawProductSilhouettes(ctx, PADX, topY, tableH, topResult.layout, topTypes, scale)
  drawSolutionOverlays(ctx, PADX, topY, tableH, topResult.layout, topNames, scale)
  drawBBrackets(ctx, PADX, topY, topResult.layout, scale, dimLabels)
  drawDimLabelsAbove(ctx, PADX, topY, topResult.layout, scale, dimLabels)
  drawDepthOffset(ctx, PADX, topY, tableW, tableH, scale, true)  // bracket ABOVE top table

  // Separator line between halves
  ctx.save()
  ctx.strokeStyle = DIVIDER
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PADX, topY + tableH + gap / 2)
  ctx.lineTo(PADX + tableW, topY + tableH + gap / 2)
  ctx.stroke()
  ctx.restore()

  // Alignment guides (pair lines from top center to bottom center)
  const pairLines = result.alignment?.pairs || []
  if (pairLines.length) {
    pairLines.forEach((pair) => {
      const topCx = PADX + pair.topCenter * scale
      const botCx = PADX + pair.bottomCenter * scale
      let lineColor = '#1a1a1a'
      if (pair.status === 'minor-adjust') lineColor = '#ff9f0a'
      if (pair.status === 'major-misalignment') lineColor = '#ff375f'
      ctx.save()
      ctx.strokeStyle = lineColor
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      ctx.moveTo(topCx, topY + tableH)
      ctx.lineTo(botCx, botY)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    })
  } else {
    topResult.layout.forEach((item) => {
      const cx = PADX + item.center * scale
      ctx.save()
      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.globalAlpha = 0.45
      ctx.beginPath()
      ctx.moveTo(cx, topY + tableH)
      ctx.lineTo(cx, botY)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    })
  }

  // Bottom table (dimmed) — front edge faces DOWN
  drawTableBody(ctx, PADX, botY, tableW, tableH, false)
  drawLengthGrid(ctx, PADX, botY, tableW, tableH, result.A)
  if (showCables) drawCableLines(ctx, PADX, botY, tableH, bottomResult.layout, scale)
  drawProductSilhouettes(ctx, PADX, botY, tableH, bottomResult.layout, botTypes, scale, true)
  drawSolutionOverlays(ctx, PADX, botY, tableH, bottomResult.layout, botNames, scale, true)
  drawDepthOffset(ctx, PADX, botY, tableW, tableH, scale, false)  // bracket BELOW bottom table

  // X brackets below bottom table
  drawXBrackets(ctx, PADX, botY + tableH + 26, bottomResult, scale, false)
  drawASpan(ctx, PADX, topY - topBracketH, tableW, result.A)

  flush(canvas, ctx, dpr)
}

/**
 * Draw iPhone Assortment diagram showing Y spacing within solutions
 * opts: { showCables }
 */
export function drawAssortment(canvas, result, names, opts = {}) {
  const { showCables = false } = opts
  const ctx = prepare(canvas)
  if (!ctx) return

  const { W, H, dpr } = ctx._meta
  ctx.clearRect(0, 0, W, H)

  const PAD    = 32
  const { tableX: PADX, tableW } = resolveTableSpan(W, PAD)
  const tableH = 112
  const gap    = 46
  const topBracketH = 56   // extra space: depth bracket + B bracket + Y bracket
  const topY   = topBracketH + 10
  const botY   = topY + tableH + gap
  const canvasH = topY + tableH * 2 + gap + 70

  resizeCanvas(canvas, W, canvasH, dpr)
  ctx.clearRect(0, 0, W, canvasH)

  const scale = tableW / result.A

  // Top table
  drawTableBody(ctx, PADX, topY, tableW, tableH, false)
  drawLengthGrid(ctx, PADX, topY, tableW, tableH, result.A)
  if (showCables) drawCableLines(ctx, PADX, topY, tableH, result.layout, scale)
  drawAssortmentRisers(ctx, PADX, topY, tableH, result, scale, false)
  drawBBrackets(ctx, PADX, topY, result.layout, scale)
  drawDepthOffset(ctx, PADX, topY, tableW, tableH, scale, true)  // bracket ABOVE top table

  // Y brackets above solutions (between B bracket and table top)
  if (result.groups && result.groups[0] && result.groups[0].count > 1 && result.Y > 0) {
    drawYBracketsAbove(ctx, PADX, topY, result, scale)
  }

  // Separator
  ctx.save()
  ctx.strokeStyle = DIVIDER
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PADX, topY + tableH + gap / 2)
  ctx.lineTo(PADX + tableW, topY + tableH + gap / 2)
  ctx.stroke()
  ctx.restore()

  // Center alignment guides (dark dashed)
  result.layout.forEach((item) => {
    const cx = PADX + item.center * scale
    ctx.save()
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    ctx.globalAlpha = 0.45
    ctx.beginPath()
    ctx.moveTo(cx, topY + tableH)
    ctx.lineTo(cx, botY)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  })

  // Bottom table (dimmed)
  drawTableBody(ctx, PADX, botY, tableW, tableH, false)
  drawLengthGrid(ctx, PADX, botY, tableW, tableH, result.A)
  if (showCables) drawCableLines(ctx, PADX, botY, tableH, result.layout, scale)
  drawAssortmentRisers(ctx, PADX, botY, tableH, result, scale, true)
  drawDepthOffset(ctx, PADX, botY, tableW, tableH, scale, false)  // bracket BELOW bottom table

  // Y brackets below bottom table on first solution
  if (result.groups && result.groups[0] && result.groups[0].count > 1 && result.Y > 0) {
    drawYBracketsBelow(ctx, PADX, botY, tableH, result, scale)
  }

  drawXBrackets(ctx, PADX, botY + tableH + 26, result, scale, false)
  drawASpan(ctx, PADX, topY - topBracketH, tableW, result.A)

  flush(canvas, ctx, dpr)
}

// ── Internal drawing helpers ──────────────────────────────────────────────────

/**
 * Draw cable management lines: straight vertical drops from beneath each device
 * to the table's bottom edge, with a small oval clip at the exit point.
 * Matches the official merchandising diagrams (Image 2 style).
 */
function drawCableLines(ctx, PAD, tableY, tableH, layout, scale) {
  const exitY = tableY + tableH
  ctx.save()
  ctx.strokeStyle = CABLE_CLR
  ctx.lineWidth = 1.5
  ctx.setLineDash([])
  layout.forEach((item) => {
    const cx = PAD + item.center * scale
    const startY = tableY + tableH * 0.78  // below device center
    // Straight vertical drop to table bottom edge
    ctx.beginPath()
    ctx.moveTo(cx, startY)
    ctx.lineTo(cx, exitY)
    ctx.stroke()
    // Small oval cable-management clip at exit
    ctx.save()
    ctx.fillStyle = CABLE_CLR
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.ellipse(cx, exitY - 1, 5, 3, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  })
  ctx.restore()
}

/**
 * Draw simplified SVG-style device symbols with explicit width text.
 * This intentionally favors legibility over product realism.
 */
function drawProductSilhouettes(ctx, PAD, tableY, tableH, layout, productTypes, scale, dimmed = false) {
  layout.forEach((item, i) => {
    const type = (productTypes[i] || 'ipad').toLowerCase()
    const sx = PAD + item.start * scale
    const sw = Math.max(item.width * scale, 14)
    const cx = sx + sw / 2
    const cardW = clamp(sw * 0.62, 20, 60)
    const cardH = clamp(tableH * 0.36, 18, 32)
    const cardX = cx - cardW / 2
    const cardY = tableY + tableH * 0.5 - cardH / 2

    ctx.save()
    ctx.globalAlpha = dimmed ? 0.4 : 1

    // Symbol card
    ctx.fillStyle = 'rgba(255,255,255,0.94)'
    ctx.strokeStyle = 'rgba(14,25,37,0.38)'
    ctx.lineWidth = 1.2
    roundRect(ctx, cardX, cardY, cardW, cardH, 5)
    ctx.fill()
    ctx.stroke()

    drawDeviceGlyph(ctx, type, cardX, cardY, cardW, cardH)

    // Width label: primary visual cue in official principles diagrams
    if (sw >= 18) {
      ctx.fillStyle = '#102138'
      ctx.font = '600 9px -apple-system,BlinkMacSystemFont,sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(`${item.width.toFixed(2)}"`, cx, cardY + cardH + 3)
    }
    ctx.restore()
  })
}

function drawDeviceGlyph(ctx, type, x, y, w, h) {
  const pad = 3
  const gx = x + pad
  const gy = y + pad
  const gw = w - pad * 2
  const gh = h - pad * 2

  ctx.save()
  ctx.strokeStyle = '#24364f'
  ctx.fillStyle = 'rgba(36,54,79,0.12)'
  ctx.lineWidth = 1

  if (type === 'iphone') {
    const pw = Math.min(gw * 0.36, gh * 0.55)
    const ph = gh * 0.88
    const px = x + (w - pw) / 2
    const py = y + (h - ph) / 2
    roundRect(ctx, px, py, pw, ph, 2.5)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(px + pw / 2, py + ph * 0.12, 0.8, 0, Math.PI * 2)
    ctx.fillStyle = '#24364f'
    ctx.fill()
  } else if (type === 'macbook') {
    const scrH = gh * 0.62
    roundRect(ctx, gx, gy, gw, scrH, 2.5)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(gx - 1, gy + scrH + 1)
    ctx.lineTo(gx + gw + 1, gy + scrH + 1)
    ctx.lineTo(gx + gw - 2, gy + gh)
    ctx.lineTo(gx + 2, gy + gh)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else if (type === 'avp') {
    ctx.beginPath()
    ctx.ellipse(x + w / 2, y + h / 2, gw * 0.45, gh * 0.28, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + w / 2 - gw * 0.14, y + h / 2)
    ctx.lineTo(x + w / 2 + gw * 0.14, y + h / 2)
    ctx.stroke()
  } else if (type === 'accessory') {
    ctx.beginPath()
    ctx.arc(x + w / 2, y + h / 2, Math.min(gw, gh) * 0.25, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else {
    roundRect(ctx, gx, gy, gw, gh, 3)
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Draw transparent solution overlays + name labels on top of silhouettes.
 * Replace old `drawSolutions` — now just draws the color bar + border + label,
 * not the white fill (since silhouette is drawn separately).
 */
function drawSolutionOverlays(ctx, PAD, tableY, tableH, layout, names, scale, dimmed = false) {
  layout.forEach((item, i) => {
    const sx = PAD + item.start * scale
    const sw = Math.max(item.width * scale, 4)
    const sy = tableY + 8
    const sh = tableH - 16
    const col = PALETTE[i % PALETTE.length]
    const label = names[i] || `S${i + 1}`

    ctx.save()
    ctx.globalAlpha = dimmed ? 0.35 : 1

    // Colored top bar
    ctx.fillStyle = col
    roundRect(ctx, sx + 1, sy, sw - 2, 5, [3, 3, 0, 0])
    ctx.fill()

    // Colored border around solution
    ctx.strokeStyle = col
    ctx.lineWidth = 1.5
    ctx.globalAlpha = dimmed ? 0.25 : 0.55
    roundRect(ctx, sx + 1, sy, sw - 2, sh, 3)
    ctx.stroke()

    // Label
    if (!dimmed && sw > 16) {
      ctx.globalAlpha = 1
      ctx.fillStyle = '#ffffff'
      ctx.font = LABEL_FONT
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      let lbl = label
      ctx.font = '10px -apple-system,sans-serif'
      while (ctx.measureText(lbl).width > sw - 6 && lbl.length > 1) lbl = lbl.slice(0, -1)
      if (lbl !== label) lbl += '…'
      ctx.fillText(lbl, sx + sw / 2, sy + 7)
    }
    ctx.restore()
  })
}

/**
 * Draw the 1" depth offset bracket.
 * Renders a VERTICAL bracket above (above=true) or below (above=false) the table
 * to indicate the 1" setback of devices from the front edge.
 * Also draws a dashed blue horizontal alignment line across the table width
 * at the 1" inset position (device front-edge reference line).
 *
 * above=true  → device front faces TOP  (top-half of double table)
 * above=false → device front faces BOTTOM (single table, bottom-half of double)
 */
function drawDepthOffset(ctx, PAD, tableY, tableW, tableH, scale, above = false) {
  const bpx   = Math.max(Math.round(scale), 12)  // bracket pixel height ≥ 12px
  const midX  = PAD + tableW / 2
  const tickW = 6

  // ── Dashed blue alignment line inside the table ───────────────────────────
  const lineY = above ? tableY + bpx : tableY + tableH - bpx
  ctx.save()
  ctx.strokeStyle = '#0071e3'
  ctx.lineWidth   = 1
  ctx.globalAlpha = 0.5
  ctx.setLineDash([8, 5])
  ctx.beginPath()
  ctx.moveTo(PAD + 12, lineY)
  ctx.lineTo(PAD + tableW - 12, lineY)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  // ── Vertical bracket outside the table ────────────────────────────────────
  const bTopY = above ? tableY - bpx - 3 : tableY + tableH + 3
  const bBotY = above ? tableY - 3        : tableY + tableH + bpx + 3

  ctx.save()
  ctx.strokeStyle = '#1d5fbd'
  ctx.fillStyle   = '#1d5fbd'
  ctx.lineWidth   = 1.5
  // top tick
  ctx.beginPath(); ctx.moveTo(midX - tickW, bTopY); ctx.lineTo(midX + tickW, bTopY); ctx.stroke()
  // bottom tick
  ctx.beginPath(); ctx.moveTo(midX - tickW, bBotY); ctx.lineTo(midX + tickW, bBotY); ctx.stroke()
  // vertical stem
  ctx.beginPath(); ctx.moveTo(midX, bTopY); ctx.lineTo(midX, bBotY); ctx.stroke()
  // label
  ctx.font = '9px -apple-system,BlinkMacSystemFont,sans-serif'
  ctx.textAlign = 'center'
  if (above) {
    ctx.textBaseline = 'bottom'
    ctx.fillText('1"', midX, bTopY - 2)
  } else {
    ctx.textBaseline = 'top'
    ctx.fillText('1"', midX, bBotY + 2)
  }
  ctx.restore()
}

/**
 * Draw dimension labels (Y, Z, B …) above each solution.
 * When a dim label is set it draws at the SAME HEIGHT as the B bracket,
 * effectively replacing it — so pass dimLabels to drawBBrackets to skip those too.
 */
function drawDimLabelsAbove(ctx, PAD, tableY, layout, scale, dimLabels) {
  if (!dimLabels || !dimLabels.length) return
  layout.forEach((item, i) => {
    const lbl = dimLabels[i]
    if (!lbl) return
    const sx = PAD + item.start * scale
    const sw = item.width * scale
    drawBracketAbove(ctx, sx, tableY - 4, sw, lbl, '#1d5fbd')
  })
}

function drawTableBody(ctx, x, y, w, h, showFlitch) {
  ctx.save()
  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.12)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3

  // Wood fill
  ctx.fillStyle = WOOD
  roundRect(ctx, x, y, w, h, 10)
  ctx.fill()

  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0

  // Grain lines (subtle horizontal)
  ctx.strokeStyle = WOOD_GRAIN
  ctx.lineWidth = 1
  for (let i = 1; i < 7; i++) {
    ctx.beginPath()
    ctx.moveTo(x + 10, y + i * h / 7)
    ctx.lineTo(x + w - 10, y + i * h / 7)
    ctx.stroke()
  }

  // End caps (slightly darker strips at left/right)
  ctx.fillStyle = WOOD_DARK
  roundRect(ctx, x, y, 10, h, [8, 0, 0, 8])
  ctx.fill()
  roundRect(ctx, x + w - 10, y, 10, h, [0, 8, 8, 0])
  ctx.fill()

  // Border
  ctx.strokeStyle = WOOD_EDGE
  ctx.lineWidth = 1.5
  roundRect(ctx, x, y, w, h, 10)
  ctx.stroke()

  // Flitch center line
  if (showFlitch) {
    ctx.strokeStyle = FLITCH
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(x + 10, y + h / 2)
    ctx.lineTo(x + w - 10, y + h / 2)
    ctx.stroke()
    ctx.setLineDash([])
  }

  ctx.restore()
}

function drawLengthGrid(ctx, x, y, w, h, A) {
  if (!A || A <= 0) return
  const stepIn = 5
  const stepPx = (w / A) * stepIn
  if (stepPx < 8) return
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 1
  for (let px = x + stepPx; px < x + w - 1; px += stepPx) {
    ctx.beginPath()
    ctx.moveTo(px, y + 8)
    ctx.lineTo(px, y + h - 8)
    ctx.stroke()
  }
  ctx.restore()
}

// Legacy: kept for backward compatibility — delegates to new system
function drawSolutions(ctx, PAD, tableY, tableH, layout, names, scale, dimmed = false) {
  drawSolutionOverlays(ctx, PAD, tableY, tableH, layout, names, scale, dimmed)
}

function drawAssortmentRisers(ctx, PAD, tableY, tableH, result, scale, dimmed) {
  if (!result.groups) {
    drawSolutionOverlays(ctx, PAD, tableY, tableH, result.layout, [], scale, dimmed)
    return
  }

  result.layout.forEach((item, si) => {
    const group = result.groups[si]
    const col = PALETTE[si % PALETTE.length]
    const count = group ? group.count : 1
    const riserW = group ? group.riserWidth : item.width
    const Y = result.Y || 0
    const sy = tableY + 8
    const sh = tableH - 16

    ctx.save()
    ctx.globalAlpha = dimmed ? 0.45 : 1

    let rx = PAD + item.start * scale
    for (let r = 0; r < count; r++) {
      const rw = Math.max(riserW * scale, 4)

      // iPhone silhouette
      ctx.globalAlpha = dimmed ? 0.3 : 0.7
      ctx.fillStyle = '#4a4a4e'
      ctx.strokeStyle = '#2a2a2e'
      ctx.lineWidth = 1
      const iw = Math.min(rw * 0.5, 8), ih = Math.min(sh * 0.7, iw * 2)
      roundRect(ctx, rx + (rw - iw) / 2, sy + (sh - ih) / 2, iw, ih, 1.5)
      ctx.fill(); ctx.stroke()

      // Riser border
      ctx.globalAlpha = dimmed ? 0.35 : 1
      ctx.fillStyle = 'transparent'
      ctx.strokeStyle = col
      ctx.lineWidth = 1.5
      roundRect(ctx, rx + 1, sy + 1, rw - 2, sh - 2, 4)
      ctx.stroke()

      // Colored top bar
      ctx.fillStyle = col
      roundRect(ctx, rx + 1, sy + 1, rw - 2, 5, [4, 4, 0, 0])
      ctx.fill()

      rx += rw + Y * scale
    }
    ctx.restore()
  })
}

/**
 * Y brackets above table (between B label and table top edge)
 * Shown on first solution only to match the official diagrams.
 */
function drawYBracketsAbove(ctx, PAD, tableY, result, scale) {
  result.layout.forEach((item, si) => {
    const group = result.groups && result.groups[si]
    if (!group || group.count < 2) return
    const riserW = group.riserWidth
    const Y = result.Y
    let rx = PAD + item.start * scale
    for (let r = 0; r < group.count - 1; r++) {
      const rw = riserW * scale
      const gapPx = Y * scale
      drawBracketAbove(ctx, rx + rw, tableY - 6, gapPx, 'Y', '#0071e3')
      rx += rw + gapPx
    }
  })
}

/**
 * Y brackets below bottom table edge
 */
function drawYBracketsBelow(ctx, PAD, tableY, tableH, result, scale) {
  result.layout.forEach((item, si) => {
    const group = result.groups && result.groups[si]
    if (!group || group.count < 2) return
    const riserW = group.riserWidth
    const Y = result.Y
    let rx = PAD + item.start * scale
    // Only label first gap per solution
    const rw = riserW * scale
    const gapPx = Y * scale
    drawBracketBelow(ctx, rx + rw, tableY + tableH + 2, gapPx, 'Y', '#0071e3', true)
  })
}

function drawBBrackets(ctx, PAD, tableY, layout, scale, dimLabels = []) {
  layout.forEach((item, i) => {
    if (dimLabels[i]) return  // dim label replaces B for this solution
    const sx = PAD + item.start * scale
    const sw = item.width * scale
    drawBracketAbove(ctx, sx, tableY - 4, sw, 'B', B_LABEL_CLR)
  })
}

function drawXBrackets(ctx, PAD, belowY, result, scale, isSignage) {
  const { layout, edgeLeft, edgeRight, X } = result

  // Left edge
  drawBracketBelow(ctx, PAD, belowY + 2, edgeLeft * scale,
    isSignage ? 'X' : 'X÷2', BRACKET_CLR)

  // Gaps between solutions
  for (let i = 0; i < layout.length - 1; i++) {
    const gapPx = (layout[i + 1].start - layout[i].end) * scale
    drawBracketBelow(ctx, PAD + layout[i].end * scale, belowY + 2, gapPx, 'X', BRACKET_CLR)
  }

  // Right edge
  const lastEnd = PAD + layout[layout.length - 1].end * scale
  const rightPx = result.A * scale - layout[layout.length - 1].end * scale
  drawBracketBelow(ctx, lastEnd, belowY + 2, rightPx * /* scale already in */ 1,
    isSignage ? 'X' : 'X÷2', BRACKET_CLR)
}

function drawASpan(ctx, PAD, y, tableW, A) {
  ctx.save()
  ctx.strokeStyle = '#1d1d1f'
  ctx.fillStyle = '#1d1d1f'
  ctx.lineWidth = 1
  // Arrow line
  ctx.beginPath()
  ctx.moveTo(PAD, y + 8); ctx.lineTo(PAD + tableW, y + 8); ctx.stroke()
  // Ticks
  ctx.beginPath()
  ctx.moveTo(PAD, y + 3); ctx.lineTo(PAD, y + 13); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(PAD + tableW, y + 3); ctx.lineTo(PAD + tableW, y + 13); ctx.stroke()
  // Label
  ctx.font = BOLD_FONT
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(`A = ${A}"`, PAD + tableW / 2, y + 5)
  ctx.restore()
}

// ── Bracket primitives ────────────────────────────────────────────────────────

function drawBracketAbove(ctx, x, y, w, label, color) {
  if (w < 2) return
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1
  const bY = y - 2
  // ticks
  ctx.beginPath(); ctx.moveTo(x + 0.5, bY); ctx.lineTo(x + 0.5, bY + 5); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x + w - 0.5, bY); ctx.lineTo(x + w - 0.5, bY + 5); ctx.stroke()
  // line
  ctx.beginPath(); ctx.moveTo(x, bY); ctx.lineTo(x + w, bY); ctx.stroke()
  // label
  ctx.font = DIM_FONT
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(label, x + w / 2, bY - 1)
  ctx.restore()
}

function drawBracketBelow(ctx, x, y, w, label, color, small = false) {
  if (w < 2) return
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1
  const bY = y + 8
  ctx.beginPath(); ctx.moveTo(x + 0.5, bY - 5); ctx.lineTo(x + 0.5, bY + 1); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x + w - 0.5, bY - 5); ctx.lineTo(x + w - 0.5, bY + 1); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x, bY); ctx.lineTo(x + w, bY); ctx.stroke()
  ctx.font = small ? '9px -apple-system,sans-serif' : DIM_FONT
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(label, x + w / 2, bY + 2)
  ctx.restore()
}

// ── Canvas setup helpers ──────────────────────────────────────────────────────

function prepare(canvas) {
  const dpr = window.devicePixelRatio || 1
  const parentW = canvas.parentElement ? canvas.parentElement.clientWidth : 0
  const parentH = canvas.parentElement ? canvas.parentElement.clientHeight : 0
  const rect = canvas.getBoundingClientRect()
  let W = rect.width || canvas.clientWidth || parentW || canvas.width / dpr
  let H = rect.height || canvas.clientHeight || parentH || canvas.height / dpr
  // fallback: if width collapsed but parent has width, use parent
  if (W < 200 && parentW > W) W = parentW
  // fallback: if height collapsed but parent has height, use parent
  if (H < 200 && parentH > H) H = parentH
  canvas.width  = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx._meta = { W, H, dpr }
  return ctx
}

function resizeCanvas(canvas, W, H, dpr) {
  canvas.width  = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)
  canvas.style.height = H + 'px'
}

function flush(canvas, ctx, dpr) {
  // no-op in direct-mode canvas; kept for possible offscreen use
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function roundRect(ctx, x, y, w, h, r) {
  if (typeof r === 'number') r = [r, r, r, r]
  const [tl, tr, br, bl] = r
  ctx.beginPath()
  ctx.moveTo(x + tl, y)
  ctx.arcTo(x + w, y,     x + w, y + h, tr)
  ctx.arcTo(x + w, y + h, x,     y + h, br)
  ctx.arcTo(x,     y + h, x,     y,     bl)
  ctx.arcTo(x,     y,     x + w, y,     tl)
  ctx.closePath()
}
