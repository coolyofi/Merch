/**
 * catalog.js — Build product/fixture catalog using productSizeDb + fixed items
 */
import { PRODUCT_SIZE_DB } from './productSizeDb.js'

const FIXED_ITEMS = [
  { id: 'iph-1dr', category: 'iphone', label: 'iPhone 1-Device Riser', width: 2.5, productType: 'iphone', tags: ['riser', '1-device'] },
  { id: 'iph-2dr', category: 'iphone', label: 'iPhone 2-Device Riser', width: 5.0, productType: 'iphone', tags: ['riser', '2-device'] },
  { id: 'fix-2x3-signage', category: 'fixture', label: '2×3 Product Zone Sign', width: 7.25, productType: 'accessory', tags: ['signage', '2x3'] },
  { id: 'fix-stand-small', category: 'fixture', label: 'Device Stand (small)', width: 4, productType: 'accessory', tags: ['stand'] },
  { id: 'fix-stand-large', category: 'fixture', label: 'Device Stand (large)', width: 6, productType: 'accessory', tags: ['stand'] },
]

const CATEGORY_ORDER = [
  { key: 'iphone', label: 'iPhone' },
  { key: 'ipad', label: 'iPad' },
  { key: 'macbook', label: 'MacBook' },
  { key: 'mac', label: 'Mac 桌面' },
  { key: 'avp', label: 'Vision Pro' },
  { key: 'accessory', label: '配件' },
  { key: 'fixture', label: '展具/标牌' },
]

function deriveWidths(dimensionsIn) {
  if (!dimensionsIn) return { width: null, portrait: null, landscape: null }
  const { width, height, standWidth } = dimensionsIn
  const w = width ?? standWidth ?? null
  if (width && height) {
    const longer = Math.max(width, height)
    const shorter = Math.min(width, height)
    return { width: w ?? longer, portrait: shorter, landscape: longer }
  }
  return { width: w, portrait: null, landscape: null }
}

function mapDbGroup(group) {
  const items = []
  for (const p of group) {
    if (!p.variants || !p.variants.length) continue
    for (const v of p.variants) {
      const { width, portrait, landscape } = deriveWidths(v.dimensionsIn)
      if (!width) continue
      const isIpad = (p.name || '').toLowerCase().includes('ipad')
      const isMacBook = (p.name || '').toLowerCase().includes('macbook') || (p.name || '').toLowerCase().includes('air') || (p.name || '').includes('Pro')
      const category = isIpad ? 'ipad' : isMacBook ? 'macbook' : 'mac'
      items.push({
        id: `${p.id}-${v.id}`,
        category,
        label: `${p.name} ${v.sizeClass || v.id}`,
        width: Number(width.toFixed(2)),
        productType: category,
        tags: ['device'],
        canOrient: isIpad && portrait && landscape,
        widthPortrait: portrait ? Number(portrait.toFixed(2)) : null,
        widthLandscape: landscape ? Number(landscape.toFixed(2)) : null,
      })
    }
  }
  return items
}

export function buildCatalog() {
  const macIpadItems = mapDbGroup(PRODUCT_SIZE_DB.mac || []).concat(mapDbGroup(PRODUCT_SIZE_DB.ipad || []))
  const accItems = (PRODUCT_SIZE_DB.accessories || []).map(p => {
    const { width } = deriveWidths(p.dimensionsIn)
    if (!width) return null
    return {
      id: p.id,
      category: 'accessory',
      label: p.name,
      width: Number(width.toFixed(2)),
      productType: 'accessory',
      tags: ['accessory'],
    }
  }).filter(Boolean)

  const merged = [
    ...macIpadItems,
    ...accItems,
    ...FIXED_ITEMS,
  ]

  const dedup = []
  const seen = new Set()
  merged.forEach(it => {
    if (!it || !it.width) return
    if (seen.has(it.id)) return
    seen.add(it.id)
    dedup.push(it)
  })

  return { items: dedup, cats: CATEGORY_ORDER }
}

export const CATALOG_ITEMS = buildCatalog().items
export const CATALOG_CATEGORIES = CATEGORY_ORDER
