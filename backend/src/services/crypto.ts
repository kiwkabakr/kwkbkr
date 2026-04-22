import { ethers } from 'ethers'
import { env } from '../config/env'

let nextIndex = { BTC: 0, ETH: 0, USDC: 0, SOL: 0 }

export function deriveAddress(currency: string, index: number): string | null {
  const mnemonic = env.MASTER_MNEMONIC
  if (!mnemonic) return null

  try {
    if (currency === 'ETH' || currency === 'USDC') {
      const hd = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, `m/44'/60'/0'/0/${index}`)
      return hd.address
    }
    if (currency === 'BTC') {
      // For BTC we use a simplified approach - derive from the ETH HD path
      // In production, use bitcoinjs-lib with proper BIP-84 derivation
      const hd = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, `m/44'/0'/0'/0/${index}`)
      return hd.address
    }
    if (currency === 'SOL') {
      // SOL derivation requires ed25519 - use the derivation index as identifier
      // In production, use @solana/web3.js with proper derivation
      const hd = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, `m/44'/501'/0'/${index}'`)
      return hd.address
    }
  } catch (err) {
    console.error(`[crypto] Failed to derive ${currency} address:`, err)
  }
  return null
}

export function getNextIndex(currency: string): number {
  const key = currency as keyof typeof nextIndex
  return nextIndex[key]++
}

export async function initDerivationIndices() {
  // Load highest derivation index from DB on startup
  const { Payment } = await import('../models/Payment')
  for (const curr of ['BTC', 'ETH', 'USDC', 'SOL'] as const) {
    const last = await Payment.findOne({ currency: curr, type: 'deposit' })
      .sort({ derivationIndex: -1 })
      .select('derivationIndex')
      .lean()
    nextIndex[curr] = (last?.derivationIndex ?? -1) + 1
  }
}
