const DECIMALS: Record<string, number> = {
  BTC: 8,
  ETH: 8,
  USDC: 6,
  SOL: 9,
}

/** Human-readable on-chain / token amount (not USD). */
export function formatCryptoAmount(amount: number, currency: string): string {
  const c = currency.toUpperCase()
  const d = DECIMALS[c] ?? 8
  const n = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
  return n.toLocaleString('en-US', {
    maximumFractionDigits: d,
    minimumFractionDigits: 0,
  })
}
