"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveAddress = deriveAddress;
exports.getNextIndex = getNextIndex;
exports.initDerivationIndices = initDerivationIndices;
const ethers_1 = require("ethers");
const env_1 = require("../config/env");
let nextIndex = { BTC: 0, ETH: 0, USDC: 0, SOL: 0 };
function deriveAddress(currency, index) {
    const mnemonic = env_1.env.MASTER_MNEMONIC;
    if (!mnemonic)
        return null;
    try {
        if (currency === 'ETH' || currency === 'USDC') {
            const hd = ethers_1.ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, `m/44'/60'/0'/0/${index}`);
            return hd.address;
        }
        if (currency === 'BTC') {
            // For BTC we use a simplified approach - derive from the ETH HD path
            // In production, use bitcoinjs-lib with proper BIP-84 derivation
            const hd = ethers_1.ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, `m/44'/0'/0'/0/${index}`);
            return hd.address;
        }
        if (currency === 'SOL') {
            // SOL derivation requires ed25519 - use the derivation index as identifier
            // In production, use @solana/web3.js with proper derivation
            const hd = ethers_1.ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, `m/44'/501'/0'/${index}'`);
            return hd.address;
        }
    }
    catch (err) {
        console.error(`[crypto] Failed to derive ${currency} address:`, err);
    }
    return null;
}
function getNextIndex(currency) {
    const key = currency;
    return nextIndex[key]++;
}
async function initDerivationIndices() {
    // Load highest derivation index from DB on startup
    const { Payment } = await Promise.resolve().then(() => __importStar(require('../models/Payment')));
    for (const curr of ['BTC', 'ETH', 'USDC', 'SOL']) {
        const last = await Payment.findOne({ currency: curr, type: 'deposit' })
            .sort({ derivationIndex: -1 })
            .select('derivationIndex')
            .lean();
        nextIndex[curr] = (last?.derivationIndex ?? -1) + 1;
    }
}
//# sourceMappingURL=crypto.js.map