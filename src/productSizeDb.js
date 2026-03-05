/**
 * productSizeDb.js
 * Apple product size database collected from official Apple web pages.
 * Last verified: 2026-03-05
 *
 * Notes:
 * - Units are inches/mm unless otherwise noted.
 * - Some keyboard accessories do not publish size/weight on current official tech-spec pages.
 */

export const PRODUCT_SIZE_DB_META = {
  source: 'apple.com + support.apple.com',
  lastVerified: '2026-03-05',
  defaultUnit: 'inch',
}

export const PRODUCT_SIZE_DB = {
  mac: [
    {
      id: 'macbook-neo',
      name: 'MacBook Neo',
      onSale: true,
      variants: [
        {
          id: '13-inch',
          sizeClass: '13-inch',
          dimensionsIn: { height: 0.50, width: 11.71, depth: 8.12 },
          dimensionsMm: { height: 12.7, width: 297.5, depth: 206.4 },
          weightLb: 2.7,
          weightKg: 1.23,
        },
      ],
      source: 'https://www.apple.com/macbook-neo/specs/',
    },
    {
      id: 'macbook-air',
      name: 'MacBook Air',
      onSale: true,
      variants: [
        {
          id: '13-inch',
          sizeClass: '13-inch',
          dimensionsIn: { height: 0.44, width: 11.97, depth: 8.46 },
          dimensionsMm: { height: 1.13, width: 30.41, depth: 21.50 },
          weightLb: 2.7,
          weightKg: 1.24,
        },
        {
          id: '15-inch',
          sizeClass: '15-inch',
          dimensionsIn: { height: 0.45, width: 13.40, depth: 9.35 },
          dimensionsMm: { height: 1.15, width: 34.04, depth: 23.76 },
          weightLb: 3.3,
          weightKg: 1.51,
        },
      ],
      source: 'https://www.apple.com/macbook-air/specs/',
    },
    {
      id: 'macbook-pro',
      name: 'MacBook Pro',
      onSale: true,
      variants: [
        {
          id: '14-inch',
          sizeClass: '14-inch',
          dimensionsIn: { height: 0.61, width: 12.31, depth: 8.71 },
          dimensionsMm: { height: 1.55, width: 31.26, depth: 22.12 },
          weightLb: 3.4,
          weightKg: 1.55,
        },
        {
          id: '16-inch',
          sizeClass: '16-inch',
          dimensionsIn: { height: 0.66, width: 14.01, depth: 9.77 },
          dimensionsMm: { height: 1.68, width: 35.57, depth: 24.81 },
          weightLb: 4.7,
          weightKg: 2.14,
        },
      ],
      source: 'https://www.apple.com/macbook-pro/specs/',
    },
    {
      id: 'imac',
      name: 'iMac',
      onSale: true,
      variants: [
        {
          id: '24-inch',
          sizeClass: '24-inch',
          dimensionsIn: {
            height: 18.1,
            width: 21.5,
            standDepth: 5.8,
            standWidth: 5.1,
          },
          dimensionsMm: {
            height: 461.0,
            width: 547.0,
            standDepth: 147.0,
            standWidth: 130.0,
          },
          weightLb: 9.83,
          weightKg: 4.46,
          note: 'Apple publishes stand footprint fields for depth/width on the spec page.',
        },
      ],
      source: 'https://www.apple.com/imac/specs/',
    },
    {
      id: 'mac-mini',
      name: 'Mac mini',
      onSale: true,
      variants: [
        {
          id: 'standard',
          dimensionsIn: { height: 2.0, width: 7.7, depth: 7.7 },
          dimensionsMm: { height: 50.0, width: 197.0, depth: 197.0 },
          weightLb: 3.3,
          weightKg: 1.5,
        },
      ],
      source: 'https://www.apple.com/mac-mini/specs/',
    },
    {
      id: 'mac-studio',
      name: 'Mac Studio',
      onSale: true,
      variants: [
        {
          id: 'm4-max',
          dimensionsIn: { height: 3.7, width: 7.7, depth: 7.7 },
          dimensionsMm: { height: 95.0, width: 197.0, depth: 197.0 },
          weightLb: 6.0,
          weightKg: 2.7,
        },
        {
          id: 'm3-ultra',
          dimensionsIn: { height: 3.7, width: 7.7, depth: 7.7 },
          dimensionsMm: { height: 95.0, width: 197.0, depth: 197.0 },
          weightLb: 7.9,
          weightKg: 3.6,
        },
      ],
      source: 'https://www.apple.com/mac-studio/specs/',
    },
    {
      id: 'mac-pro',
      name: 'Mac Pro',
      onSale: true,
      variants: [
        {
          id: 'tower',
          dimensionsIn: { height: 20.8, width: 8.58, depth: 17.7 },
          dimensionsMm: { height: 529.0, width: 218.0, depth: 450.0 },
          weightLb: 37.2,
          weightKg: 16.86,
        },
        {
          id: 'rack',
          dimensionsIn: { height: 8.58, width: 19.0, depth: 21.9 },
          dimensionsMm: { height: 218.0, width: 483.0, depth: 557.0 },
          weightLb: 61.4,
          weightKg: 27.85,
        },
      ],
      source: 'https://www.apple.com/mac-pro/specs/',
    },
  ],

  ipad: [
    {
      id: 'ipad-pro',
      name: 'iPad Pro',
      onSale: true,
      variants: [
        {
          id: '11-inch',
          sizeClass: '11-inch',
          dimensionsIn: { height: 9.83, width: 6.99, depth: 0.21 },
          dimensionsMm: { height: 249.7, width: 177.5, depth: 5.3 },
          weightLb: 0.98,
          weightG: 444,
        },
        {
          id: '13-inch',
          sizeClass: '13-inch',
          dimensionsIn: { height: 11.09, width: 8.48, depth: 0.20 },
          dimensionsMm: { height: 281.6, width: 215.5, depth: 5.1 },
          weightLb: 1.28,
          weightG: 579,
        },
      ],
      source: 'https://www.apple.com/ipad-pro/specs/',
    },
    {
      id: 'ipad-air',
      name: 'iPad Air',
      onSale: true,
      variants: [
        {
          id: '11-inch',
          sizeClass: '11-inch',
          dimensionsIn: { height: 9.74, width: 7.02, depth: 0.24 },
          dimensionsMm: { height: 247.6, width: 178.5, depth: 6.1 },
          weightLb: 1.02,
          weightG: 462,
        },
        {
          id: '13-inch',
          sizeClass: '13-inch',
          dimensionsIn: { height: 11.04, width: 8.46, depth: 0.24 },
          dimensionsMm: { height: 280.6, width: 214.9, depth: 6.1 },
          weightLb: 1.36,
          weightG: 617,
        },
      ],
      source: 'https://www.apple.com/ipad-air/specs/',
    },
    {
      id: 'ipad-a16',
      name: 'iPad (A16)',
      onSale: true,
      variants: [
        {
          id: '10.86-inch-display',
          sizeClass: '11-class',
          dimensionsIn: { height: 9.79, width: 7.07, depth: 0.28 },
          dimensionsMm: { height: 248.6, width: 179.5, depth: 7.0 },
          weightLb: 1.05,
          weightG: 477,
        },
      ],
      source: 'https://support.apple.com/en-us/122240',
    },
    {
      id: 'ipad-mini',
      name: 'iPad mini',
      onSale: true,
      variants: [
        {
          id: '8.3-inch',
          sizeClass: '8.3-inch',
          dimensionsIn: { height: 7.69, width: 5.30, depth: 0.25 },
          dimensionsMm: { height: 195.4, width: 134.8, depth: 6.3 },
          weightLb: 0.65,
          weightG: 293,
        },
      ],
      source: 'https://www.apple.com/ipad-mini/specs/',
    },
    {
      id: 'ipad-compare-tool',
      name: 'iPad Compare',
      onSale: true,
      kind: 'compare-tool',
      dimensionsIn: null,
      note: 'This is a comparison tool page, not a physical product.',
      source: 'https://www.apple.com/ipad/compare/',
    },
  ],

  accessories: [
    {
      id: 'apple-pencil-pro',
      name: 'Apple Pencil Pro',
      onSale: true,
      dimensionsIn: { length: 6.53, diameter: 0.35 },
      dimensionsMm: { length: 166.0, diameter: 8.9 },
      weightOz: 0.68,
      weightG: 19.15,
      source: 'https://www.apple.com/shop/product/MX2D3AM/A/apple-pencil-pro',
    },
    {
      id: 'apple-pencil-usb-c',
      name: 'Apple Pencil (USB-C)',
      onSale: true,
      dimensionsIn: { length: 6.10, diameter: 0.35 },
      dimensionsMm: { length: 155.0, diameter: 8.9 },
      weightOz: 0.72,
      weightG: 20.5,
      source: 'https://www.apple.com/shop/product/MUWA3AM/A/apple-pencil-usb-c',
    },
    {
      id: 'apple-pencil-2nd-gen',
      name: 'Apple Pencil (2nd generation)',
      onSale: true,
      dimensionsIn: { length: 6.53, diameter: 0.35 },
      dimensionsMm: { length: 166.0, diameter: 8.9 },
      weightOz: 0.73,
      weightG: 20.7,
      source: 'https://www.apple.com/shop/product/MU8F2AM/A/apple-pencil-2nd-generation',
    },
    {
      id: 'apple-pencil-1st-gen',
      name: 'Apple Pencil (1st generation)',
      onSale: true,
      dimensionsIn: { length: 6.92, diameter: 0.35 },
      dimensionsMm: { length: 175.7, diameter: 8.9 },
      weightOz: 0.73,
      weightG: 20.7,
      source: 'https://www.apple.com/shop/product/MQLY3AM/A/apple-pencil-1st-generation',
    },
    {
      id: 'magic-keyboard-for-ipad-pro-11',
      name: 'Magic Keyboard for iPad Pro 11-inch',
      onSale: true,
      dimensionsIn: null,
      note: 'Current official tech-spec page does not publish size/weight fields.',
      source: 'https://support.apple.com/en-us/120125',
    },
    {
      id: 'magic-keyboard-for-ipad-pro-13',
      name: 'Magic Keyboard for iPad Pro 13-inch',
      onSale: true,
      dimensionsIn: null,
      note: 'Current official tech-spec page does not publish size/weight fields.',
      source: 'https://support.apple.com/en-my/120136',
    },
    {
      id: 'magic-keyboard-for-ipad-air-11',
      name: 'Magic Keyboard for iPad Air 11-inch',
      onSale: true,
      dimensionsIn: null,
      note: 'Current official tech-spec page does not publish size/weight fields.',
      source: 'https://support.apple.com/en-mo/122272',
    },
    {
      id: 'magic-keyboard-for-ipad-air-13',
      name: 'Magic Keyboard for iPad Air 13-inch',
      onSale: true,
      dimensionsIn: null,
      note: 'Current official tech-spec page does not publish size/weight fields.',
      source: 'https://support.apple.com/en-afri/122273',
    },
    {
      id: 'magic-keyboard-folio-ipad',
      name: 'Magic Keyboard Folio for iPad',
      onSale: true,
      dimensionsIn: null,
      note: 'Current official tech-spec page does not publish size/weight fields.',
      source: 'https://support.apple.com/en-euro/111845',
    },
  ],
}

export function findProductSize(productId) {
  const groups = [PRODUCT_SIZE_DB.mac, PRODUCT_SIZE_DB.ipad, PRODUCT_SIZE_DB.accessories]
  for (const list of groups) {
    const item = list.find((p) => p.id === productId)
    if (item) return item
  }
  return null
}

