"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyDepositConfirmed = notifyDepositConfirmed;
exports.telegramNotifierAvailable = telegramNotifierAvailable;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../config/env");
const API_BASE = 'https://api.telegram.org';
const CRYPTO_DECIMALS = { BTC: 8, ETH: 8, USDC: 6, SOL: 9 };
function fmtPln(value) {
    if (!Number.isFinite(value) || value <= 0)
        return '0,00 zł';
    const s = value.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
    const [int, dec = ''] = s.split('.');
    const padded = dec.length < 2 ? value.toFixed(2) : `${int},${dec}`;
    return `${padded.replace('.', ',')} zł`;
}
function fmtNative(amount, currency) {
    const d = CRYPTO_DECIMALS[currency] ?? 8;
    const s = amount.toFixed(d).replace(/0+$/, '').replace(/\.$/, '');
    return s || '0';
}
let warnedMissingToken = false;
async function sendMessage(chatId, text) {
    const token = env_1.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        if (!warnedMissingToken) {
            console.warn('[telegram] TELEGRAM_BOT_TOKEN not set — live notifications disabled');
            warnedMissingToken = true;
        }
        return false;
    }
    try {
        await axios_1.default.post(`${API_BASE}/bot${token}/sendMessage`, { chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true }, { timeout: 8000 });
        console.log(`[telegram] sent notification to ${chatId}`);
        return true;
    }
    catch (err) {
        const detail = err?.response?.data ?? err?.message ?? err;
        console.error('[telegram] sendMessage failed:', detail);
        return false;
    }
}
async function notifyDepositConfirmed(params) {
    const { telegramId, currency, native, pln, newBalance, txHash } = params;
    const lines = [
        '*Wpłata potwierdzona na blockchainie*',
        '',
        `Otrzymano: *${fmtNative(native, currency)} ${currency}*`,
        `Wartość: *${fmtPln(pln)}*`,
        `Nowe saldo: *${fmtPln(newBalance)}*`,
    ];
    if (txHash)
        lines.push('', `tx: \`${txHash}\``);
    await sendMessage(telegramId, lines.join('\n'));
}
function telegramNotifierAvailable() {
    return Boolean(env_1.env.TELEGRAM_BOT_TOKEN);
}
//# sourceMappingURL=telegramNotifier.js.map