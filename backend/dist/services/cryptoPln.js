"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nativeAmountToPln = nativeAmountToPln;
const axios_1 = __importDefault(require("axios"));
const COINGECKO_IDS = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    SOL: 'solana',
    USDC: 'usd-coin',
};
let cache = null;
const CACHE_MS = 60_000;
async function fetchPlnPrices() {
    const ids = [...new Set(Object.values(COINGECKO_IDS))].join(',');
    const { data } = await axios_1.default.get('https://api.coingecko.com/api/v3/simple/price', { params: { ids, vs_currencies: 'pln' }, timeout: 12_000 });
    const out = {};
    for (const [id, row] of Object.entries(data)) {
        if (row?.pln != null && Number.isFinite(row.pln))
            out[id] = row.pln;
    }
    return out;
}
/** PLN value of `nativeAmount` for supported currencies. */
async function nativeAmountToPln(currency, nativeAmount) {
    if (!(nativeAmount > 0) || !Number.isFinite(nativeAmount))
        return 0;
    const id = COINGECKO_IDS[currency];
    if (!id)
        return 0;
    const now = Date.now();
    if (!cache || now - cache.fetchedAt > CACHE_MS) {
        try {
            cache = { plnById: await fetchPlnPrices(), fetchedAt: now };
        }
        catch (err) {
            console.error('[cryptoPln] CoinGecko fetch failed:', err);
            if (cache) {
                console.warn('[cryptoPln] Using stale price cache');
            }
            else {
                throw err;
            }
        }
    }
    const plnPerUnit = cache.plnById[id];
    if (plnPerUnit == null || !Number.isFinite(plnPerUnit)) {
        throw new Error(`No PLN price for ${currency}`);
    }
    return Math.round(nativeAmount * plnPerUnit * 1e6) / 1e6;
}
//# sourceMappingURL=cryptoPln.js.map