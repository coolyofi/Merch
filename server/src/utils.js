export function buildVersionName(base = 'Layout') {
  return `${base} ${new Date().toISOString().slice(0, 10)}`
}

export function toInt(v, fallback = 0) {
  const n = Number(v)
  return Number.isInteger(n) ? n : fallback
}
