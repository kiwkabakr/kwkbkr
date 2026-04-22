import axios from 'axios'

const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  USDC: 'usd-coin',
}

type PriceCache = { plnById: Record<string, number>; fetchedAt: number }

let cache: PriceCache | null = null
const CACHE_MS = 60_000

async function fetchPlnPrices(): Promise<Record<string, number>> {
  const ids = [...new Set(Object.values(COINGECKO_IDS))].join(',')
  const { data } = await axios.get<Record<string, { pln: number }>>(
    'https://api.coingecko.com/api/v3/simple/price',
    { params: { ids, vs_currencies: 'pln' }, timeout: 12_000 }
  )
  const out: Record<string, number> = {}
  for (const [id, row] of Object.entries(data)) {
    if (row?.pln != null && Number.isFinite(row.pln)) out[id] = row.pln
  }
  return out
}

/** PLN value of `nativeAmount` for supported currencies. */
export async function nativeAmountToPln(currency: string, nativeAmount: number): Promise<number> {
  if (!(nativeAmount > 0) || !Number.isFinite(nativeAmount)) return 0

  const id = COINGECKO_IDS[currency]
  if (!id) return 0

  const now = Date.now()
  if (!cache || now - cache.fetchedAt > CACHE_MS) {
    try {
      cache = { plnById: await fetchPlnPrices(), fetchedAt: now }
    } catch (err) {
      console.error('[cryptoPln] CoinGecko fetch failed:', err)
      if (cache) {
        console.warn('[cryptoPln] Using stale price cache')
      } else {
        throw err
      }
    }
  }

  const plnPerUnit = cache!.plnById[id]
  if (plnPerUnit == null || !Number.isFinite(plnPerUnit)) {
    throw new Error(`No PLN price for ${currency}`)
  }

  return Math.round(nativeAmount * plnPerUnit * 1e6) / 1e6
}
