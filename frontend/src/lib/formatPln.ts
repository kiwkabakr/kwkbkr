/** PLN formatter: min 2, up to 8 fraction digits for small crypto-backed balances. */
const plnFull = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 8,
})

export function formatPln(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return plnFull.format(n)
}
