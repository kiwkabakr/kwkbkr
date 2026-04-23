"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.botRoutes = void 0;
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const models_1 = require("../models");
const crypto_1 = require("../services/crypto");
const betDeadline_1 = require("../util/betDeadline");
const r = (0, express_1.Router)();
r.use(auth_1.requireBotKey);
// Keyed per IP + telegramId so a single abusive user can't starve others.
function writeLimiter(max, windowMs = 60_000) {
    return (0, express_rate_limit_1.default)({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: req => {
            const tid = (req.body && typeof req.body === 'object' && req.body.telegramId) || '';
            return `${req.ip ?? 'unknown'}:${tid}`;
        },
    });
}
const writeRouteLimiter = writeLimiter(30);
async function jsonHistoryForUser(user) {
    const [payments, userBets, bonuses] = await Promise.all([
        models_1.Payment.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
        models_1.UserBet.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
        models_1.BonusRedemption.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
    ]);
    const betIds = [...new Set(userBets.map(ub => ub.betId.toString()))];
    const bets = await models_1.Bet.find({ _id: { $in: betIds } }).lean();
    const betMap = new Map(bets.map(b => [b._id.toString(), b]));
    return {
        deposits: payments
            .filter(p => p.type === 'deposit')
            .map(p => ({
            id: p._id,
            currency: p.currency,
            amount: p.amount,
            amountPln: p.amountPln,
            status: p.status,
            createdAt: p.createdAt,
        })),
        payouts: payments
            .filter(p => p.type === 'payout')
            .map(p => ({
            id: p._id,
            currency: p.currency,
            amount: p.amount,
            amountPln: p.amountPln,
            status: p.status,
            createdAt: p.createdAt,
            walletAddress: p.userWalletAddress,
        })),
        bets: userBets.map(ub => {
            const bet = betMap.get(ub.betId.toString());
            const option = bet?.options.find(o => o.id === ub.optionId);
            return {
                id: ub._id,
                betTitle: bet?.title ?? 'Unknown',
                optionLabel: option?.label ?? 'Unknown',
                amount: ub.amount,
                potentialWin: ub.potentialWin,
                status: ub.status,
                createdAt: ub.createdAt,
            };
        }),
        bonuses: bonuses.map(b => ({
            id: b._id,
            code: b.code,
            amountPln: b.amountPln,
            createdAt: b.createdAt,
        })),
    };
}
function sanitizeUser(user) {
    return {
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        balance: user.balance,
        passkeyShown: user.passkeyShown,
        createdAt: user.createdAt,
    };
}
// ── User registration ─────────────────────────────────────────────────
const registerSchema = zod_1.z.object({
    telegramId: zod_1.z.string().min(1),
    username: zod_1.z.string().optional(),
    firstName: zod_1.z.string().optional(),
});
r.post('/users', writeRouteLimiter, (0, validate_1.validate)(registerSchema), async (req, res) => {
    const { telegramId, username, firstName } = req.body;
    let user = await models_1.User.findOne({ telegramId });
    if (!user) {
        const plainPasskey = (0, models_1.generatePasskey)();
        const plainCode = (0, models_1.generateVerificationCode)();
        user = new models_1.User({
            telegramId,
            username,
            firstName,
            passkey: plainPasskey,
            verificationCode: plainCode,
            passkeyShown: true,
            verificationCodeShown: true,
        });
        await user.save();
        res.json({
            user: sanitizeUser(user),
            isNew: true,
            usernameMismatch: false,
            currentTelegramUsername: username ?? '',
            passkey: plainPasskey,
            verificationCode: plainCode,
        });
        return;
    }
    const usernameMismatch = !!username && user.username !== username;
    res.json({
        user: sanitizeUser(user),
        isNew: false,
        usernameMismatch,
        currentTelegramUsername: username ?? '',
    });
});
// ── Get user ──────────────────────────────────────────────────────────
r.get('/users/:telegramId', async (req, res) => {
    const user = await models_1.User.findOne({ telegramId: req.params.telegramId });
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    res.json(sanitizeUser(user));
});
// ── Passkey (one-time, legacy fallback) ───────────────────────────────
r.get('/users/:telegramId/passkey', async (req, res) => {
    const user = await models_1.User.findOne({ telegramId: req.params.telegramId })
        .select('+passkey +verificationCode');
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    if (user.passkeyShown) {
        res.json({ passkey: null, verificationCode: null, alreadyShown: true });
        return;
    }
    const passkey = user.passkey ?? null;
    const verificationCode = user.verificationCode ?? null;
    user.passkeyShown = true;
    user.verificationCodeShown = true;
    await user.save();
    res.json({ passkey, verificationCode, alreadyShown: false });
});
// ── Delete user ───────────────────────────────────────────────────────
r.delete('/users/:telegramId', async (req, res) => {
    const user = await models_1.User.findOne({ telegramId: req.params.telegramId });
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    await models_1.UserBet.deleteMany({ userId: user._id });
    await models_1.Payment.deleteMany({ userId: user._id });
    await models_1.User.deleteOne({ _id: user._id });
    res.json({ success: true });
});
// ── User info (full stats) ───────────────────────────────────────────
r.get('/users/:telegramId/info', async (req, res) => {
    const user = await models_1.User.findOne({ telegramId: req.params.telegramId });
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    const [totalBets, wonBets, deposits, payouts] = await Promise.all([
        models_1.UserBet.countDocuments({ userId: user._id }),
        models_1.UserBet.countDocuments({ userId: user._id, status: 'won' }),
        models_1.Payment.aggregate([
            { $match: { userId: user._id, type: 'deposit', status: 'confirmed' } },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ['$amountPln', '$amount'] } },
                },
            },
        ]),
        models_1.Payment.aggregate([
            { $match: { userId: user._id, type: 'payout', status: { $in: ['confirmed', 'completed'] } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
    ]);
    res.json({
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        balance: user.balance,
        totalBets,
        wonBets,
        totalDeposited: deposits[0]?.total ?? 0,
        totalWithdrawn: payouts[0]?.total ?? 0,
        memberSince: user.createdAt,
    });
});
// ── Create deposit ────────────────────────────────────────────────────
const depositSchema = zod_1.z.object({
    telegramId: zod_1.z.string().min(1),
    currency: zod_1.z.enum(['BTC', 'ETH', 'USDC', 'SOL']),
});
r.post('/deposits', writeRouteLimiter, (0, validate_1.validate)(depositSchema), async (req, res) => {
    const { telegramId, currency } = req.body;
    const user = await models_1.User.findOne({ telegramId });
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    const idx = (0, crypto_1.getNextIndex)(currency);
    const address = (0, crypto_1.deriveAddress)(currency, idx);
    const payment = await models_1.Payment.create({
        userId: user._id,
        telegramId,
        type: 'deposit',
        currency,
        depositAddress: address ?? `CONFIGURE_MASTER_MNEMONIC_${currency}_${idx}`,
        derivationIndex: idx,
        status: 'pending',
    });
    res.json({ paymentId: payment._id, address: payment.depositAddress, currency });
});
// ── Request payout ────────────────────────────────────────────────────
const payoutSchema = zod_1.z.object({
    telegramId: zod_1.z.string().min(1),
    currency: zod_1.z.enum(['BTC', 'ETH', 'USDC', 'SOL']),
    amount: zod_1.z.number().positive(),
    walletAddress: zod_1.z.string().min(1).max(128),
    verificationCode: zod_1.z.string().length(6),
});
r.post('/payouts', writeRouteLimiter, (0, validate_1.validate)(payoutSchema), async (req, res) => {
    const { telegramId, currency, amount, walletAddress, verificationCode } = req.body;
    const user = await models_1.User.findOne({ telegramId }).select('+verificationCodeHash');
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    const codeOk = await user.compareVerificationCode(verificationCode);
    if (!codeOk) {
        res.status(403).json({ error: 'Invalid verification code' });
        return;
    }
    // Atomic debit: only succeeds if the balance still covers the amount.
    const debited = await models_1.User.findOneAndUpdate({ _id: user._id, balance: { $gte: amount } }, { $inc: { balance: -amount } }, { new: true });
    if (!debited) {
        res.status(400).json({ error: 'Insufficient balance' });
        return;
    }
    const payment = await models_1.Payment.create({
        userId: user._id,
        telegramId,
        type: 'payout',
        currency,
        amount,
        amountPln: amount,
        userWalletAddress: walletAddress,
        status: 'pending',
    });
    res.json({ paymentId: payment._id, status: 'pending' });
});
// ── Place bet ─────────────────────────────────────────────────────────
const placeBetSchema = zod_1.z.object({
    telegramId: zod_1.z.string().min(1),
    betShortId: zod_1.z.string().min(1).max(64),
    optionId: zod_1.z.string().min(1).max(64),
    amount: zod_1.z.number().positive(),
});
r.post('/bets/place', writeRouteLimiter, (0, validate_1.validate)(placeBetSchema), async (req, res) => {
    const { telegramId, betShortId, optionId, amount } = req.body;
    const user = await models_1.User.findOne({ telegramId });
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    await (0, betDeadline_1.closeBetsPastDeadline)({ force: true });
    const bet = await models_1.Bet.findOne({ shortId: betShortId, status: 'open' });
    if (!bet) {
        res.status(404).json({ error: 'Bet not found or closed' });
        return;
    }
    if (bet.date <= new Date()) {
        res.status(400).json({ error: 'Betting closed for this event' });
        return;
    }
    const option = bet.options.find(o => o.id === optionId);
    if (!option) {
        res.status(400).json({ error: 'Invalid option' });
        return;
    }
    const multiplier = parseFloat(option.multiplier.replace(',', '.'));
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
        res.status(400).json({ error: 'Invalid multiplier' });
        return;
    }
    const potentialWin = Math.round(amount * multiplier * 100) / 100;
    const debited = await models_1.User.findOneAndUpdate({ _id: user._id, balance: { $gte: amount } }, { $inc: { balance: -amount } }, { new: true });
    if (!debited) {
        res.status(400).json({ error: 'Insufficient balance' });
        return;
    }
    const userBet = await models_1.UserBet.create({
        userId: user._id,
        betId: bet._id,
        betShortId,
        optionId,
        amount,
        potentialWin,
    });
    res.json({ userBet, newBalance: debited.balance });
});
// ── User bets ─────────────────────────────────────────────────────────
r.get('/users/:telegramId/bets', async (req, res) => {
    const user = await models_1.User.findOne({ telegramId: req.params.telegramId });
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    const userBets = await models_1.UserBet.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .lean();
    const betIds = [...new Set(userBets.map(ub => ub.betId.toString()))];
    const bets = await models_1.Bet.find({ _id: { $in: betIds } }).lean();
    const betMap = new Map(bets.map(b => [b._id.toString(), b]));
    const result = userBets.map(ub => {
        const bet = betMap.get(ub.betId.toString());
        const option = bet?.options.find(o => o.id === ub.optionId);
        return {
            ...ub,
            betTitle: bet?.title ?? 'Unknown',
            optionLabel: option?.label ?? 'Unknown',
            betStatus: bet?.status ?? 'unknown',
        };
    });
    res.json(result);
});
// ── Sync username (requires verification code) ────────────────────────
const syncUsernameSchema = zod_1.z.object({
    telegramId: zod_1.z.string().min(1),
    newUsername: zod_1.z.string().min(1).max(64),
    verificationCode: zod_1.z.string().length(6),
});
r.post('/users/sync-username', writeRouteLimiter, (0, validate_1.validate)(syncUsernameSchema), async (req, res) => {
    const { telegramId, newUsername, verificationCode } = req.body;
    const user = await models_1.User.findOne({ telegramId }).select('+verificationCodeHash');
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    const codeOk = await user.compareVerificationCode(verificationCode);
    if (!codeOk) {
        res.status(403).json({ error: 'Invalid verification code' });
        return;
    }
    user.username = newUsername;
    await user.save();
    res.json({ success: true, username: user.username });
});
// ── Redeem promo code ─────────────────────────────────────────────────
const redeemSchema = zod_1.z.object({
    telegramId: zod_1.z.string().min(1),
    code: zod_1.z.string().min(1).max(64),
});
r.post('/redeem', writeRouteLimiter, (0, validate_1.validate)(redeemSchema), async (req, res) => {
    const { telegramId } = req.body;
    const code = String(req.body.code).trim().toUpperCase();
    const user = await models_1.User.findOne({ telegramId });
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    const promo = await models_1.PromoCode.findOne({ code });
    if (!promo) {
        res.status(400).json({ error: 'Invalid code' });
        return;
    }
    if (!promo.enabled) {
        res.status(400).json({ error: 'Code is disabled' });
        return;
    }
    if (promo.expiresAt && promo.expiresAt < new Date()) {
        res.status(400).json({ error: 'Code has expired' });
        return;
    }
    if (promo.requireAnyDeposit || promo.minDepositPln > 0) {
        const [deposits] = await models_1.Payment.aggregate([
            { $match: { userId: user._id, type: 'deposit', status: 'confirmed' } },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    total: { $sum: { $ifNull: ['$amountPln', '$amount'] } },
                },
            },
        ]);
        const count = deposits?.count ?? 0;
        const total = deposits?.total ?? 0;
        if (count === 0) {
            res.status(400).json({ error: 'No deposit — deposit any amount first to redeem codes' });
            return;
        }
        if (promo.minDepositPln > 0 && total < promo.minDepositPln) {
            res.status(400).json({
                error: `Insufficient deposit — need at least ${promo.minDepositPln.toFixed(2)} PLN deposited (you have ${total.toFixed(2)} PLN)`,
            });
            return;
        }
    }
    if (promo.minWageredPln > 0) {
        const [wager] = await models_1.UserBet.aggregate([
            { $match: { userId: user._id } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const total = wager?.total ?? 0;
        if (total < promo.minWageredPln) {
            res.status(400).json({
                error: `Insufficient wagered — need at least ${promo.minWageredPln.toFixed(2)} PLN wagered (you have ${total.toFixed(2)} PLN)`,
            });
            return;
        }
    }
    // Atomic redemption: rejects concurrent double-redeems and over-limit usage.
    const claimed = await models_1.PromoCode.findOneAndUpdate({
        _id: promo._id,
        enabled: true,
        redeemedBy: { $ne: user._id },
        $or: [
            { usesLimit: 0 },
            { $expr: { $lt: ['$usesCount', '$usesLimit'] } },
        ],
    }, {
        $inc: { usesCount: 1 },
        $push: { redeemedBy: user._id },
    }, { new: true });
    if (!claimed) {
        res.status(400).json({ error: 'Code already redeemed or usage limit reached' });
        return;
    }
    const credited = await models_1.User.findByIdAndUpdate(user._id, {
        $inc: { balance: claimed.amountPln },
        $addToSet: { redeemedCodes: claimed.code },
    }, { new: true });
    await models_1.BonusRedemption.create({
        userId: user._id,
        telegramId: user.telegramId,
        promoCodeId: claimed._id,
        code: claimed.code,
        amountPln: claimed.amountPln,
    });
    res.json({ success: true, added: claimed.amountPln, newBalance: credited?.balance ?? user.balance });
});
// ── Full history (deposits, payouts, bets) ────────────────────────────
r.get('/users/:telegramId/history', async (req, res) => {
    const tid = String(req.params.telegramId ?? '').trim();
    const user = await models_1.User.findOne({ telegramId: tid });
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    res.json(await jsonHistoryForUser(user));
});
const historyBodySchema = zod_1.z.object({
    telegramId: zod_1.z.string().min(1).transform(s => s.trim()),
});
r.post('/users/history', (0, validate_1.validate)(historyBodySchema), async (req, res) => {
    const { telegramId } = req.body;
    const user = await models_1.User.findOne({ telegramId });
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    res.json(await jsonHistoryForUser(user));
});
// ── Get single bet by shortId ─────────────────────────────────────────
r.get('/bets/:shortId', async (req, res) => {
    await (0, betDeadline_1.closeBetsPastDeadline)();
    const bet = await models_1.Bet.findOne({ shortId: req.params.shortId }).lean();
    if (!bet) {
        res.status(404).json({ error: 'Bet not found' });
        return;
    }
    res.json(bet);
});
exports.botRoutes = r;
//# sourceMappingURL=bot.js.map