import axios from 'axios'
import { env } from '../config/env'

const API_BASE = 'https://api.telegram.org'

const CRYPTO_DECIMALS: Record<string, number> = { BTC: 8, ETH: 8, USDC: 6, SOL: 9 }

function fmtPln(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0,00 zł'
  const s = value.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
  const [int, dec = ''] = s.split('.')
  const padded = dec.length < 2 ? value.toFixed(2) : `${int},${dec}`
  return `${padded.replace('.', ',')} zł`
}

function fmtNative(amount: number, currency: string): string {
  const d = CRYPTO_DECIMALS[currency] ?? 8
  const s = amount.toFixed(d).replace(/0+$/, '').replace(/\.$/, '')
  return s || '0'
}

let warnedMissingToken = false

async function sendMessage(chatId: string, text: string): Promise<boolean> {
  const token = env.TELEGRAM_BOT_TOKEN
  if (!token) {
    if (!warnedMissingToken) {
      console.warn('[telegram] TELEGRAM_BOT_TOKEN not set — live notifications disabled')
      warnedMissingToken = true
    }
    return false
  }
  try {
    await axios.post(
      `${API_BASE}/bot${token}/sendMessage`,
      { chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true },
      { timeout: 8000 }
    )
    console.log(`[telegram] sent notification to ${chatId}`)
    return true
  } catch (err: any) {
    const detail = err?.response?.data ?? err?.message ?? err
    console.error('[telegram] sendMessage failed:', detail)
    return false
  }
}

export async function notifyDepositConfirmed(params: {
  telegramId: string
  currency: string
  native: number
  pln: number
  newBalance: number
  txHash?: string
}): Promise<void> {
  const { telegramId, currency, native, pln, newBalance, txHash } = params
  const lines = [
    '*Wpłata potwierdzona na blockchainie*',
    '',
    `Otrzymano: *${fmtNative(native, currency)} ${currency}*`,
    `Wartość: *${fmtPln(pln)}*`,
    `Nowe saldo: *${fmtPln(newBalance)}*`,
  ]
  if (txHash) lines.push('', `tx: \`${txHash}\``)
  await sendMessage(telegramId, lines.join('\n'))
}

export function telegramNotifierAvailable(): boolean {
  return Boolean(env.TELEGRAM_BOT_TOKEN)
}
