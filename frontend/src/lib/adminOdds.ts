/** House margin baked into kurs from implied probability (%). */
export const SPORT_CATEGORY_EDGE = 0.1
export const OTHER_CATEGORY_EDGE = 0.2

/** Minimum decimal kurs (multiplier) allowed in admin and API. */
export const MIN_KURS_MULTIPLIER = 1.01

export function clampMinKurs(m: number): number {
  return Math.max(m, MIN_KURS_MULTIPLIER)
}

export function isSportCategory(category: string): boolean {
  const s = category.trim().toLowerCase()
  return s === 'sport' || s === 'sports'
}

export function edgeForCategory(category: string): number {
  return isSportCategory(category) ? SPORT_CATEGORY_EDGE : OTHER_CATEGORY_EDGE
}

function parseNumLoose(raw: string): number | undefined {
  const t = raw.replace(',', '.').replace(/x/gi, '').trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

/** Kurs (decimal multiplier) from implied probability percent p and edge e:100 / (p * (1+e)), floored at MIN_KURS_MULTIPLIER (edge still applies in % ↔ kurs display). */
export function percentToMultiplier(percent: number, edge: number): number | undefined {
  if (!(percent > 0) || percent > 100 || !(edge >= 0)) return undefined
  const raw = 100 / (percent * (1 + edge))
  return clampMinKurs(raw)
}

export function multiplierFromPercentInput(percentStr: string, edge: number): string {
  const p = parseNumLoose(percentStr)
  if (p === undefined) return ''
  const m = percentToMultiplier(p, edge)
  return m !== undefined ? formatMultiplier(m) : ''
}

/** Implied % from stored kurs m and edge e: 100 / (m * (1+e)); effective kurs is at least MIN_KURS_MULTIPLIER so marża stays in the % readout. */
export function multiplierToPercent(multiplierStr: string, edge: number): string {
  const mRaw = parseNumLoose(multiplierStr)
  if (mRaw === undefined || mRaw <= 0) return ''
  const m = clampMinKurs(mRaw)
  const p = 100 / (m * (1 + edge))
  if (!Number.isFinite(p)) return ''
  return formatMultiplier(p)
}

export function formatMultiplier(n: number): string {
  return (Math.round(n * 100) / 100).toString()
}

/** Keep true implied probability when category (edge) changes. */
export function remapMultipliersForEdgeChange<T extends { multiplier: string }>(
  options: T[],
  oldEdge: number,
  newEdge: number,
): T[] {
  if (oldEdge === newEdge) return options
  return options.map(o => {
    const m = parseNumLoose(o.multiplier)
    if (m === undefined || m <= 0) return o
    const impliedPct = 100 / (m * (1 + oldEdge))
    const newM = percentToMultiplier(impliedPct, newEdge)
    if (newM === undefined) return o
    return { ...o, multiplier: formatMultiplier(newM) }
  })
}
