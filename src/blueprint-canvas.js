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

const LINE1_DIST = 5   // Apple Principles: products begin at Line 1 = 5" from edge
const SIGN_DEPTH_IN = 2  // 2×3 sign footprint depth on table (2 inches)

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

  // Line 1: 5" from front/back edge (Apple Principles — products land on Line 1)
  const frontLine1Y = TY + (table.depth - LINE1_DIST) * DS
  const backLine1Y  = TY + LINE1_DIST * DS

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

  // Depth axis labels (left side) — distance from FRONT edge (customer-facing)
  ctx.font        = '9px "SF Mono", monospace'
  ctx.fillStyle   = PALETTE.labelDim
  ctx.textAlign   = 'right'
  ctx.textBaseline = 'middle'
  for (let d = 0; d <= table.depth; d += 5) {
    const y       = TY + d * DS
    const fromFront = table.depth - d    // 0 at bottom/front, depth at top/back
    ctx.fillText(`${fromFront}"`, TX - 6, y)
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

  // ── Line 1 guide (front) — 5" from front edge ──────────────────────────
  ctx.save()
  ctx.strokeStyle = 'rgba(251,191,36,0.55)'
  ctx.lineWidth   = 1
  ctx.setLineDash([5, 4])
  ctx.beginPath()
  ctx.moveTo(TX, frontLine1Y)
  ctx.lineTo(TX + TW, frontLine1Y)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.font         = 'bold 8px "SF Mono", monospace'
  ctx.fillStyle    = 'rgba(251,191,36,0.7)'
  ctx.textAlign    = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillText('Line 1 — 5"', TX - 2, frontLine1Y - 1)
  ctx.textBaseline = 'alphabetic'
  ctx.restore()

  // ── Line 1 guide (back) — 5" from back edge ────────────────────────────
  if (back) {
    ctx.save()
    ctx.strokeStyle = 'rgba(52,211,153,0.55)'
    ctx.lineWidth   = 1
    ctx.setLineDash([5, 4])
    ctx.beginPath()
    ctx.moveTo(TX, backLine1Y)
    ctx.lineTo(TX + TW, backLine1Y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.font         = 'bold 8px "SF Mono", monospace'
    ctx.fillStyle    = 'rgba(52,211,153,0.7)'
    ctx.textAlign    = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText('Line 1 — 5"', TX - 2, backLine1Y + 1)
    ctx.textBaseline = 'alphabetic'
    ctx.restore()
  }

  // ── Element blocks (drawn at actual physical size, anchored at Line 1) ───
  drawRailBlocks(ctx, front.items, TX, TY, table.width, table.depth, scale, DS, 'front', front.spacing)
  if (back) {
    drawRailBlocks(ctx, back.items, TX, TY, table.width, table.depth, scale, DS, 'back', back.spacing)
  }

  // ── Center-alignment connectors ───────────────────────────────────────────
  // When one side uses center-alignment, draw a vertical dashed line through
  // each solution center, connecting back-row Line 1 to front-row Line 1.
  if (back && front.spacing && back.spacing) {
    const frontLayout = front.spacing.layout || []
    const backLayout  = back.spacing.layout  || []
    const isFrontCentered  = front.spacing.centerAligned
    const isBackCentered   = back.spacing.centerAligned
    const hasCenterAlign   = isFrontCentered || isBackCentered
    if (hasCenterAlign && frontLayout.length === backLayout.length) {
      ctx.save()
      ctx.setLineDash([4, 4])
      ctx.lineWidth   = 1
      ctx.strokeStyle = 'rgba(52,211,153,0.45)'
      frontLayout.forEach((fs, i) => {
        const bk   = backLayout[i]
        if (!bk) return
        // Use whichever center is the "reference" (primary side)
        const cx   = isFrontCentered ? bk.center : fs.center
        const lineX = TX + cx * scale
        ctx.beginPath()
        ctx.moveTo(lineX, backLine1Y)
        ctx.lineTo(lineX, frontLine1Y)
        ctx.stroke()
        // small diamond at the midpoint
        const midY = (backLine1Y + frontLine1Y) / 2
        ctx.save()
        ctx.setLineDash([])
        ctx.fillStyle = 'rgba(52,211,153,0.6)'
        ctx.beginPath()
        ctx.moveTo(lineX,     midY - 4)
        ctx.lineTo(lineX + 3, midY)
        ctx.lineTo(lineX,     midY + 4)
        ctx.lineTo(lineX - 3, midY)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      })
      ctx.setLineDash([])
      ctx.restore()
    }
  }

  // ── Edge labels ───────────────────────────────────────────────────────────
  ctx.font      = 'bold 9px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillStyle = PALETTE.frontLabel
  ctx.textBaseline = 'bottom'
  ctx.fillText('FRONT ›', TX + TW - 4, TY + TH - 2)
  if (back) {
    ctx.fillStyle = PALETTE.backLabel
    ctx.textBaseline = 'top'
    ctx.fillText('BACK ›', TX + TW - 4, TY + 2)
  }
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign    = 'left'

  // ── Table width label (centered top) ─────────────────────────────────────
  ctx.font      = 'bold 13px sans-serif'
  ctx.fillStyle = PALETTE.white
  ctx.textAlign = 'center'
  const widthLabel = `${table.name || 'Table'} — ${inToFt(table.width)} wide × ${table.depth}" deep`
  ctx.fillText(widthLabel, TX + TW / 2, TY - 32)

  // front usage summary
  const usageLine  = `Front: ${front.used.toFixed(1)}" used  |  ${front.remaining >= 0 ? front.remaining.toFixed(1) + '" free' : 'OVER by ' + Math.abs(front.remaining).toFixed(1) + '"'}`
  ctx.font      = '10px sans-serif'
  ctx.fillStyle = front.remaining < 0 ? '#f87171' : PALETTE.labelDim
  ctx.fillText(usageLine, TX + TW / 2, cssH - 16)

  ctx.textAlign = 'left'

  // ── Scale bar ─────────────────────────────────────────────────────────────
  drawScaleBar(ctx, TX + TW - 100, cssH - 20, scale)
}

// ─── Draw rail blocks at actual physical size ────────────────────────────────
// Items are anchored at Line 1 (5" from edge) and drawn at real width × depth.
// item.xStart is always the DEVICE start position.
// item.hasSign   + item.signSide: lead sign to the left (front) or right (back) of device.
// item.hasSignBefore + item.signGapWidth: 2×3 sign between this device and the previous one.
function drawRailBlocks(ctx, items, TX, TY, tableWidth, tableDepth, scale, DS, side, spacing) {
  const SIGN_W = 3    // sign footprint width (inches)
  const SIGN_G = 1    // gap between sign and device (inch)

  // Canvas Y of Line 1 — front face of items touches this line
  const line1Y = side === 'front'
    ? TY + (tableDepth - LINE1_DIST) * DS
    : TY + LINE1_DIST * DS

  items.forEach(item => {
    if (!item.element) return
    const el    = item.element
    const type  = el.type || 'product'
    const color = TYPE_COLORS[type] || '#2563eb'

    const isLsIpad  = item.isLandscape && el.family === 'iPad'
    const dispDepth = isLsIpad ? el.width : (el.depth || 4)

    // Device dimensions
    const devW   = item.width    // already device-only width
    const devPw  = devW * scale
    const devPh  = dispDepth * DS
    const devPy  = side === 'front' ? line1Y - devPh : line1Y
    const devX   = TX + item.xStart * scale

    // ── Between-device sign (hasSignBefore) ────────────────────────────────
    // Sign is centered in the Z gap before this device.
    if (item.hasSignBefore && item.signGapWidth > 0) {
      const gapStartX = devX - item.signGapWidth * scale
      const sigPx     = SIGN_W * scale
      const sigX      = gapStartX + (item.signGapWidth * scale - sigPx) / 2  // centered in gap
      const sigH      = SIGN_DEPTH_IN * DS
      const sigY      = side === 'front' ? line1Y - sigH : line1Y

      ctx.save()
      ctx.beginPath()
      rrect(ctx, sigX + 0.5, sigY + 0.5, sigPx - 1, sigH - 1, 2)
      ctx.fillStyle   = 'rgba(217,119,6,0.50)'
      ctx.fill()
      ctx.strokeStyle = '#d97706'
      ctx.lineWidth   = 1
      ctx.stroke()
      if (sigPx > 14) {
        ctx.font         = 'bold 8px sans-serif'
        ctx.fillStyle    = 'rgba(255,255,255,0.9)'
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('2×3', sigX + sigPx / 2, sigY + sigH / 2)
      }
      ctx.restore()
    }

    // ── Lead sign (hasSign) — position depends on signSide ─────────────────
    // signSide='left'  (front rail): sign is LEFT  of device [sign][gap][device]
    // signSide='right' (back rail):  sign is RIGHT of solution end [devices...][gap][sign]
    // item.signXStart (inches) encodes the exact position; fall back to geometry if absent.
    // Guard: skip if this item is already a between-device sign (hasSignBefore),
    // otherwise both the hasSignBefore path above AND this path would draw a sign.
    if (item.hasSign && !item.hasSignBefore) {
      const sigPx = SIGN_W * scale
      const sigH  = SIGN_DEPTH_IN * DS
      const sigY  = side === 'front' ? line1Y - sigH : line1Y

      const signSide = item.signSide || (side === 'back' ? 'right' : 'left')
      let sigX
      if (item.signXStart != null) {
        sigX = TX + item.signXStart * scale
      } else if (signSide === 'right') {
        sigX = devX + devPw + SIGN_G * scale          // after device (fallback)
      } else {
        sigX = devX - (SIGN_W + SIGN_G) * scale       // before device (fallback)
      }

      ctx.save()
      ctx.beginPath()
      rrect(ctx, sigX + 0.5, sigY + 0.5, sigPx - 1, sigH - 1, 2)
      ctx.fillStyle   = 'rgba(217,119,6,0.50)'
      ctx.fill()
      ctx.strokeStyle = '#d97706'
      ctx.lineWidth   = 1
      ctx.stroke()
      if (sigPx > 14) {
        ctx.font         = 'bold 8px sans-serif'
        ctx.fillStyle    = 'rgba(255,255,255,0.9)'
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('2×3', sigX + sigPx / 2, sigY + sigH / 2)
      }
      ctx.restore()
    }

    // ── Device block ─────────────────────────────────────────────────────────
    ctx.save()
    ctx.beginPath()
    rrect(ctx, devX + 0.5, devPy + 0.5, devPw - 1, devPh - 1, 3)
    ctx.fillStyle   = color + 'cc'
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth   = 1.2
    ctx.stroke()
    ctx.restore()

    // Device label
    if (devPw > 22) {
      ctx.save()
      ctx.beginPath()
      rrect(ctx, devX + 0.5, devPy + 0.5, devPw - 1, devPh - 1, 3)
      ctx.clip()
      ctx.font         = `${devPw > 60 ? 10 : 8}px sans-serif`
      ctx.fillStyle    = 'rgba(255,255,255,0.95)'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      const midY = devPy + devPh / 2
      ctx.fillText(truncate(ctx, el.name, devPw - 8), devX + devPw / 2, midY)
      if (devPh > 24 && devPw > 44) {
        ctx.font      = '8px "SF Mono", monospace'
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.fillText(
          `${devW.toFixed(2)}"W × ${dispDepth.toFixed(2)}"D`,
          devX + devPw / 2,
          midY + 12
        )
      }
      ctx.restore()
    }
  })

  // ── Dimension annotations along both front and back edges ────────────────
  if (spacing && spacing.layout && spacing.layout.length > 0) {
    const isBack  = side === 'back'
    const DIM_Y   = isBack
      ? TY - 8                                    // above the table for back rail
      : TY + tableDepth * DS + 12                 // below for front
    const DIM_CLR = isBack ? 'rgba(52,211,153,0.8)' : 'rgba(129,140,248,0.9)'
    const DIM_TXT = isBack ? 'rgba(110,231,183,0.9)' : 'rgba(199,210,254,0.95)'
    const dimSide = isBack ? 'back' : 'front'

    ctx.save()
    ctx.strokeStyle = DIM_CLR
    ctx.fillStyle   = DIM_TXT
    ctx.lineWidth   = 1
    ctx.font        = '8px "SF Mono", monospace'

    if (spacing.edgeLeft > 0.2) {
      drawDimLine(ctx, TX, TX + spacing.edgeLeft * scale, DIM_Y, `${spacing.edgeLeft.toFixed(1)}"`, dimSide)
    }
    for (let i = 0; i < spacing.layout.length - 1; i++) {
      const gapStart = spacing.layout[i].end
      const gapEnd   = spacing.layout[i + 1].start
      const gapW     = gapEnd - gapStart
      if (gapW > 0.1) {
        drawDimLine(ctx, TX + gapStart * scale, TX + gapEnd * scale, DIM_Y, `${gapW.toFixed(1)}"`, dimSide)
      }
    }
    const last = spacing.layout[spacing.layout.length - 1]
    if (spacing.edgeRight > 0.2) {
      drawDimLine(ctx, TX + last.end * scale, TX + tableWidth * scale, DIM_Y, `${spacing.edgeRight.toFixed(1)}"`, dimSide)
    }
    ctx.restore()
  }
}

// ─── Dimension line helper ────────────────────────────────────────────────────
function drawDimLine(ctx, x0, x1, y, label, side = 'front') {
  const mid = (x0 + x1) / 2
  const H   = 5   // tick height

  if (x1 - x0 < 4) return

  ctx.beginPath()
  ctx.moveTo(x0, y)
  ctx.lineTo(x1, y)
  ctx.moveTo(x0, y - H)
  ctx.lineTo(x0, y + H)
  ctx.moveTo(x1, y - H)
  ctx.lineTo(x1, y + H)
  ctx.stroke()

  if (x1 - x0 > 20) {
    ctx.textAlign    = 'center'
    // Back rail dims: text above the dim line; front: below
    ctx.textBaseline = side === 'back' ? 'bottom' : 'top'
    ctx.fillText(label, mid, side === 'back' ? y - H - 1 : y + H + 1)
    ctx.textBaseline = 'alphabetic'
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
