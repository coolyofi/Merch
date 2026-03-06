/**
 * elements-db.js
 * Element library for the merchandising layout tool.
 * All widths and depths are in INCHES.
 *
 * Element schema:
 *   id                  string   – unique identifier
 *   name                string   – display name
 *   type                string   – product | bundle | sign | prop | spacer
 *   family              string   – product family / grouping label
 *   width               number   – width in inches (footprint along table X-axis)
 *   depth               number   – depth in inches (footprint along table Y-axis)
 *   height              number   – physical height in inches (0 = flat plate)
 *   tags                string[] – searchable labels
 *   imageUrl            string?  – optional thumbnail URL
 *   note                string?  – usage guidance
 *   allowWidthOverride  boolean  – user can override width in layout
 */

// ─── Helpers ────────────────────────────────────────────────────────────────
const mm2in = mm => Number((mm / 25.4).toFixed(3))
const cm2in = cm => Number((cm / 2.54).toFixed(3))

// ─── Master Element Library ─────────────────────────────────────────────────
export const ELEMENTS_DB = [

  // ── 2×3 Product Sign (standard fixture) ─────────────────────────────────
  {
    id:                 'sign-2x3',
    name:               '2×3 Product Sign',
    type:               'sign',
    family:             'Signage',
    width:              3,          // 3 inches
    depth:              2,          // 2 inches
    height:             0,          // flat plate — no height
    tags:               ['sign', '2x3', 'signage', 'fixture'],
    note:               '底座 3"×2" 铁制铭牌，无高度。每个 Product Zone 标配一块。',
    allowWidthOverride: false,
  },

  // ── Interval / Spacer ───────────────────────────────────────────────────
  {
    id:                 'spacer-1in',
    name:               '间距块 1"',
    type:               'spacer',
    family:             'Spacer',
    width:              1,
    depth:              4,
    height:             0,
    tags:               ['spacer', 'gap', '间距'],
    note:               '1 英寸间距块，用于拉开产品间距。',
    allowWidthOverride: true,
  },
  {
    id:                 'spacer-2in',
    name:               '间距块 2"',
    type:               'spacer',
    family:             'Spacer',
    width:              2,
    depth:              4,
    height:             0,
    tags:               ['spacer', 'gap', '间距'],
    note:               '2 英寸间距块。',
    allowWidthOverride: true,
  },
  {
    id:                 'spacer-3in',
    name:               '间距块 3"',
    type:               'spacer',
    family:             'Spacer',
    width:              3,
    depth:              4,
    height:             0,
    tags:               ['spacer', 'gap', '间距'],
    note:               '3 英寸间距块。',
    allowWidthOverride: true,
  },

  // ── iPhone Risers ──────────────────────────────────────────────────────
  {
    id:                 'iphone-riser-1dev',
    name:               'iPhone 单设备架',
    type:               'prop',
    family:             'iPhone',
    width:              2.5,
    depth:              5,
    height:             4,
    tags:               ['riser', 'iphone', '1-device'],
    note:               '1 设备展架，宽 2.5"。',
    allowWidthOverride: false,
  },
  {
    id:                 'iphone-riser-2dev',
    name:               'iPhone 双设备架',
    type:               'prop',
    family:             'iPhone',
    width:              5,
    depth:              5,
    height:             4,
    tags:               ['riser', 'iphone', '2-device'],
    note:               '2 设备展架，宽 5"。',
    allowWidthOverride: false,
  },

  // ── MacBook lineup ───────────────────────────────────────────────────
  {
    id:                 'macbook-neo-13',
    name:               'MacBook Neo 13"',
    type:               'product',
    family:             'MacBook',
    width:              11.71,
    depth:              8.12,
    height:             0.50,
    tags:               ['macbook', 'laptop', 'mac'],
    allowWidthOverride: false,
  },
  {
    id:                 'macbook-air-13',
    name:               'MacBook Air 13"',
    type:               'product',
    family:             'MacBook',
    width:              11.97,
    depth:              8.46,
    height:             0.44,
    tags:               ['macbook', 'air', 'laptop', 'mac'],
    allowWidthOverride: false,
  },
  {
    id:                 'macbook-air-15',
    name:               'MacBook Air 15"',
    type:               'product',
    family:             'MacBook',
    width:              13.40,
    depth:              9.35,
    height:             0.45,
    tags:               ['macbook', 'air', 'laptop', 'mac'],
    allowWidthOverride: false,
  },
  {
    id:                 'macbook-pro-14',
    name:               'MacBook Pro 14"',
    type:               'product',
    family:             'MacBook',
    width:              12.31,
    depth:              8.71,
    height:             0.61,
    tags:               ['macbook', 'pro', 'laptop', 'mac'],
    allowWidthOverride: false,
  },
  {
    id:                 'macbook-pro-16',
    name:               'MacBook Pro 16"',
    type:               'product',
    family:             'MacBook',
    width:              14.01,
    depth:              9.77,
    height:             0.66,
    tags:               ['macbook', 'pro', 'laptop', 'mac'],
    allowWidthOverride: false,
  },

  // ── iPad lineup ─────────────────────────────────────────────────────
  {
    id:                 'ipad-pro-11',
    name:               'iPad Pro 11"',
    type:               'product',
    family:             'iPad',
    width:              6.99,         // portrait width
    depth:              9.83,
    height:             0.21,
    tags:               ['ipad', 'pro', 'tablet'],
    note:               '竖放宽 6.99"，横放宽 9.83"',
    allowWidthOverride: true,         // orientation can change width
  },
  {
    id:                 'ipad-pro-13',
    name:               'iPad Pro 13"',
    type:               'product',
    family:             'iPad',
    width:              8.48,
    depth:              11.09,
    height:             0.20,
    tags:               ['ipad', 'pro', 'tablet'],
    note:               '竖放宽 8.48"，横放宽 11.09"',
    allowWidthOverride: true,
  },
  {
    id:                 'ipad-air-11',
    name:               'iPad Air 11"',
    type:               'product',
    family:             'iPad',
    width:              7.02,
    depth:              9.74,
    height:             0.24,
    tags:               ['ipad', 'air', 'tablet'],
    allowWidthOverride: true,
  },
  {
    id:                 'ipad-air-13',
    name:               'iPad Air 13"',
    type:               'product',
    family:             'iPad',
    width:              8.46,
    depth:              11.04,
    height:             0.24,
    tags:               ['ipad', 'air', 'tablet'],
    allowWidthOverride: true,
  },
  {
    id:                 'ipad-a16',
    name:               'iPad (A16)',
    type:               'product',
    family:             'iPad',
    width:              7.07,
    depth:              9.79,
    height:             0.28,
    tags:               ['ipad', 'standard', 'tablet'],
    allowWidthOverride: true,
  },
  {
    id:                 'ipad-mini',
    name:               'iPad mini',
    type:               'product',
    family:             'iPad',
    width:              5.30,
    depth:              7.69,
    height:             0.25,
    tags:               ['ipad', 'mini', 'tablet'],
    allowWidthOverride: true,
  },

  // ── Mac Desktop ──────────────────────────────────────────────────────
  {
    id:                 'imac-24',
    name:               'iMac 24"',
    type:               'product',
    family:             'Mac',
    width:              21.5,         // stand footprint width ≈130mm → ~5.1"
    depth:              7.2,          // stand footprint depth ≈147mm → ~5.8"
    height:             18.0,
    tags:               ['imac', 'desktop', 'mac', 'display'],
    note:               '底座占用约 5.1"×5.8"，整机宽 21.5"',
    allowWidthOverride: false,
  },
  {
    id:                 'mac-mini',
    name:               'Mac mini',
    type:               'product',
    family:             'Mac',
    width:              7.7,
    depth:              7.7,
    height:             2.0,
    tags:               ['mac-mini', 'desktop', 'mac'],
    allowWidthOverride: false,
  },
  {
    id:                 'mac-studio',
    name:               'Mac Studio',
    type:               'product',
    family:             'Mac',
    width:              7.7,
    depth:              7.7,
    height:             3.7,
    tags:               ['mac-studio', 'desktop', 'mac'],
    allowWidthOverride: false,
  },

  // ── Bundles ─────────────────────────────────────────────────────────
  {
    id:                 'bundle-ipad-keyboard-11',
    name:               'iPad Pro 11" + Magic Keyboard',
    type:               'bundle',
    family:             'iPad',
    width:              9.76,         // keyboard closed ≈ ipad width
    depth:              7.02,
    height:             0.60,
    tags:               ['ipad', 'bundle', 'keyboard'],
    note:               'iPad Pro 11" 与 Magic Keyboard（合拢状态）',
    allowWidthOverride: true,
  },
  {
    id:                 'bundle-ipad-keyboard-13',
    name:               'iPad Pro 13" + Magic Keyboard',
    type:               'bundle',
    family:             'iPad',
    width:              11.09,
    depth:              8.48,
    height:             0.60,
    tags:               ['ipad', 'bundle', 'keyboard'],
    note:               'iPad Pro 13" 与 Magic Keyboard（合拢状态）',
    allowWidthOverride: true,
  },
]

// ─── Accessors ───────────────────────────────────────────────────────────────
export function getAllElements() {
  return ELEMENTS_DB
}

export function getElementsByType(type) {
  return ELEMENTS_DB.filter(e => e.type === type)
}

export function getElementById(id) {
  return ELEMENTS_DB.find(e => e.id === id) || null
}

export function getElementFamilies() {
  const families = [...new Set(ELEMENTS_DB.map(e => e.family))]
  return families
}

export const ELEMENT_TYPES = [
  { key: 'all',     label: '全部' },
  { key: 'product', label: '产品' },
  { key: 'bundle',  label: '组合' },
  { key: 'sign',    label: '标牌' },
  { key: 'prop',    label: '展具' },
  { key: 'spacer',  label: '间距' },
]

export const ELEMENT_TYPE_COLORS = {
  product: '#3b82f6',
  bundle:  '#8b5cf6',
  sign:    '#f59e0b',
  prop:    '#10b981',
  spacer:  '#6b7280',
}
