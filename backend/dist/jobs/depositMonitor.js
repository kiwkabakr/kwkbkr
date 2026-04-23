"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDepositMonitor = startDepositMonitor;
const node_cron_1 = __importDefault(require("node-cron"));
const axios_1 = __importDefault(require("axios"));
const models_1 = require("../models");
const env_1 = require("../config/env");
const crypto_1 = require("../services/crypto");
const cryptoPln_1 = require("../services/cryptoPln");
const telegramNotifier_1 = require("../services/telegramNotifier");
async function checkBTCAddress(address) {
    try {
        const { data } = await axios_1.default.get(`https://mempool.space/api/address/${address}`, { timeout: 10000 });
        const funded = data.chain_stats?.funded_txo_sum ?? 0;
        const spent = data.chain_stats?.spent_txo_sum ?? 0;
        return (funded - spent) / 1e8;
    }
    catch {
        return 0;
    }
}
async function checkETHAddress(address) {
    const key = env_1.env.ALCHEMY_API_KEY;
    if (!key)
        return 0;
    try {
        const { data } = await axios_1.default.post(`https://eth-mainnet.g.alchemy.com/v2/${key}`, { jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] }, { timeout: 10000 });
        const wei = BigInt(data.result ?? '0');
        return Number(wei) / 1e18;
    }
    catch {
        return 0;
    }
}
async function checkUSDCAddress(address) {
    const key = env_1.env.ALCHEMY_API_KEY;
    if (!key)
        return 0;
    const USDC_CONTRACT = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const balanceOfSig = '0x70a08231';
    const paddedAddr = address.slice(2).padStart(64, '0');
    try {
        const { data } = await axios_1.default.post(`https://eth-mainnet.g.alchemy.com/v2/${key}`, {
            jsonrpc: '2.0', id: 1, method: 'eth_call',
            params: [{ to: USDC_CONTRACT, data: `${balanceOfSig}${paddedAddr}` }, 'latest'],
        }, { timeout: 10000 });
        const raw = BigInt(data.result ?? '0');
        return Number(raw) / 1e6;
    }
    catch {
        return 0;
    }
}
async function checkSOLAddress(address) {
    try {
        const { data } = await axios_1.default.post(env_1.env.SOLANA_RPC_URL, { jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] }, { timeout: 10000 });
        return (data.result?.value ?? 0) / 1e9;
    }
    catch {
        return 0;
    }
}
const checkers = {
    BTC: checkBTCAddress,
    ETH: checkETHAddress,
    USDC: checkUSDCAddress,
    SOL: checkSOLAddress,
};
async function pollPendingDeposits() {
    const pending = await models_1.Payment.find({ type: 'deposit', status: 'pending' });
    if (pending.length === 0)
        return;
    for (const payment of pending) {
        if (!payment.depositAddress || payment.depositAddress.startsWith('CONFIGURE'))
            continue;
        const checker = checkers[payment.currency];
        if (!checker)
            continue;
        try {
            const balance = await checker(payment.depositAddress);
            if (balance > 0) {
                const pln = await (0, cryptoPln_1.nativeAmountToPln)(payment.currency, balance);
                if (!(pln > 0)) {
                    console.error(`[deposit] Skip confirm: PLN value zero for ${balance} ${payment.currency}`);
                    continue;
                }
                payment.amount = balance;
                payment.amountPln = pln;
                payment.status = 'confirmed';
                await payment.save();
                const updated = await models_1.User.findByIdAndUpdate(payment.userId, { $inc: { balance: pln } }, { returnDocument: 'after' });
                console.log(`[deposit] Confirmed ${balance} ${payment.currency} (~${pln} PLN) for user ${payment.telegramId}`);
                (0, telegramNotifier_1.notifyDepositConfirmed)({
                    telegramId: payment.telegramId,
                    currency: payment.currency,
                    native: balance,
                    pln,
                    newBalance: updated?.balance ?? pln,
                    txHash: payment.txHash,
                }).catch(err => console.error('[deposit] Telegram notify failed:', err));
            }
        }
        catch (err) {
            console.error(`[deposit] Error checking ${payment.currency} ${payment.depositAddress}:`, err);
        }
    }
}
function startDepositMonitor() {
    (0, crypto_1.initDerivationIndices)().then(() => {
        console.log('[deposit-monitor] Derivation indices initialized');
    });
    node_cron_1.default.schedule('*/60 * * * * *', () => {
        pollPendingDeposits().catch(err => console.error('[deposit-monitor]', err));
    });
    console.log('[deposit-monitor] Running every 60s');
}
//# sourceMappingURL=depositMonitor.js.map