import cron from 'node-cron'
import axios from 'axios'
import { Payment, User } from '../models'
import { env } from '../config/env'
import { initDerivationIndices } from '../services/crypto'
import { nativeAmountToPln } from '../services/cryptoPln'
import { notifyDepositConfirmed } from '../services/telegramNotifier'

async function checkBTCAddress(address: string): Promise<number> {
  try {
    const { data } = await axios.get(
      `https://mempool.space/api/address/${address}`,
      { timeout: 10000 }
    )
    const funded = data.chain_stats?.funded_txo_sum ?? 0
    const spent = data.chain_stats?.spent_txo_sum ?? 0
    return (funded - spent) / 1e8
  } catch {
    return 0
  }
}

async function checkETHAddress(address: string): Promise<number> {
  const key = env.ALCHEMY_API_KEY
  if (!key) return 0
  try {
    const { data } = await axios.post(
      `https://eth-mainnet.g.alchemy.com/v2/${key}`,
      { jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] },
      { timeout: 10000 }
    )
    const wei = BigInt(data.result ?? '0')
    return Number(wei) / 1e18
  } catch {
    return 0
  }
}

async function checkUSDCAddress(address: string): Promise<number> {
  const key = env.ALCHEMY_API_KEY
  if (!key) return 0
  const USDC_CONTRACT = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  const balanceOfSig = '0x70a08231'
  const paddedAddr = address.slice(2).padStart(64, '0')
  try {
    const { data } = await axios.post(
      `https://eth-mainnet.g.alchemy.com/v2/${key}`,
      {
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: USDC_CONTRACT, data: `${balanceOfSig}${paddedAddr}` }, 'latest'],
      },
      { timeout: 10000 }
    )
    const raw = BigInt(data.result ?? '0')
    return Number(raw) / 1e6
  } catch {
    return 0
  }
}

async function checkSOLAddress(address: string): Promise<number> {
  try {
    const { data } = await axios.post(
      env.SOLANA_RPC_URL,
      { jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] },
      { timeout: 10000 }
    )
    return (data.result?.value ?? 0) / 1e9
  } catch {
    return 0
  }
}

const checkers: Record<string, (addr: string) => Promise<number>> = {
  BTC: checkBTCAddress,
  ETH: checkETHAddress,
  USDC: checkUSDCAddress,
  SOL: checkSOLAddress,
}

async function pollPendingDeposits() {
  const pending = await Payment.find({ type: 'deposit', status: 'pending' })
  if (pending.length === 0) return

  for (const payment of pending) {
    if (!payment.depositAddress || payment.depositAddress.startsWith('CONFIGURE')) continue
    const checker = checkers[payment.currency]
    if (!checker) continue

    try {
      const balance = await checker(payment.depositAddress)
      if (balance > 0) {
        const pln = await nativeAmountToPln(payment.currency, balance)
        if (!(pln > 0)) {
          console.error(`[deposit] Skip confirm: PLN value zero for ${balance} ${payment.currency}`)
          continue
        }
        payment.amount = balance
        payment.amountPln = pln
        payment.status = 'confirmed'
        await payment.save()
        const updated = await User.findByIdAndUpdate(
          payment.userId,
          { $inc: { balance: pln } },
          { returnDocument: 'after' }
        )
        console.log(
          `[deposit] Confirmed ${balance} ${payment.currency} (~${pln} PLN) for user ${payment.telegramId}`
        )
        notifyDepositConfirmed({
          telegramId: payment.telegramId,
          currency: payment.currency,
          native: balance,
          pln,
          newBalance: updated?.balance ?? pln,
          txHash: payment.txHash,
        }).catch(err => console.error('[deposit] Telegram notify failed:', err))
      }
    } catch (err) {
      console.error(`[deposit] Error checking ${payment.currency} ${payment.depositAddress}:`, err)
    }
  }
}

export function startDepositMonitor() {
  initDerivationIndices().then(() => {
    console.log('[deposit-monitor] Derivation indices initialized')
  })

  cron.schedule('*/60 * * * * *', () => {
    pollPendingDeposits().catch(err => console.error('[deposit-monitor]', err))
  })
  console.log('[deposit-monitor] Running every 60s')
}
