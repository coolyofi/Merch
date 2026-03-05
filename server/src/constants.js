export const APP_RULE_VERSION = 'Merch v2025.11'

export const DEFAULT_RULE_SET_PAYLOAD = {
  id: APP_RULE_VERSION,
  publishedAt: '2025-11-13',
  dualSide: {
    centerToleranceIn: 1.0,
    microAdjustMaxIn: 1.5,
  },
  iphoneYByTable: {
    84: 2,
    96: 3,
    120: 4,
    240: 4,
    144: 5,
    180: 5,
  },
  signageEdgeByTable: {
    84: 7,
    96: 7,
    120: 8,
    144: 8,
    180: 8,
    240: 8,
  },
}
