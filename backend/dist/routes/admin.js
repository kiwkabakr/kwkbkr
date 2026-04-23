"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = void 0;
exports.generateUniquePromoCode = generateUniquePromoCode;
exports.backfillLegacyDepositsPln = backfillLegacyDepositsPln;
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const zod_1 = require("zod");
const env_1 = require("../config/env");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const models_1 = require("../models");
const betNormalize_1 = require("../util/betNormalize");
const betDeadline_1 = require("../util/betDeadline");
const cryptoPln_1 = require("../services/cryptoPln");
const r = (0, express_1.Router)();
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const COOKIE_JWT = 'admin_token';
const COOKIE_CSRF = 'csrf_token';
const adminLoginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60_000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
});
function authCookieOpts(maxAgeMs) {
    return {
        httpOnly: true,
        secure: env_1.isProd,
        sameSite: 'strict',
        path: '/api',
        maxAge: maxAgeMs,
    };
}
function csrfCookieOpts(maxAgeMs) {
    return {
        httpOnly: false,
        secure: env_1.isProd,
        sameSite: 'strict',
        path: '/api',
        maxAge: maxAgeMs,
    };
}
const MIN_KURS_MULTIPLIER = 1.01;
function clampBetOptionsMultipliers(options) {
    return options.map(o => {
        const m = Number(String(o.multiplier).replace(',', '.').replace(/x/gi, '').trim());
        if (!Number.isFinite(m) || m < MIN_KURS_MULTIPLIER) {
            return { ...o, multiplier: String(MIN_KURS_MULTIPLIER) };
        }
        return { ...o, multiplier: String(Math.round(m * 100) / 100) };
    });
}
// ── Login ─────────────────────────────────────────────────────────────
const loginSchema = zod_1.z.object({ password: zod_1.z.string().min(1) });
r.post('/login', adminLoginLimiter, (0, validate_1.validate)(loginSchema), async (req, res) => {
    const { password } = req.body;
    const match = await bcryptjs_1.default.compare(password, env_1.env.ADMIN_PASSWORD_HASH);
    if (!match) {
        res.status(401).json({ error: 'Wrong password' });
        return;
    }
    const token = jsonwebtoken_1.default.sign({ role: 'admin' }, env_1.env.JWT_SECRET, { expiresIn: '8h' });
    const csrf = crypto_1.default.randomBytes(32).toString('hex');
    res.cookie(COOKIE_JWT, token, authCookieOpts(SESSION_MAX_AGE_MS));
    res.cookie(COOKIE_CSRF, csrf, csrfCookieOpts(SESSION_MAX_AGE_MS));
    res.json({ ok: true, csrfToken: csrf });
});
r.post('/logout', (_req, res) => {
    res.clearCookie(COOKIE_JWT, { path: '/api' });
    res.clearCookie(COOKIE_CSRF, { path: '/api' });
    res.json({ ok: true });
});
r.get('/me', auth_1.requireAdmin, (_req, res) => {
    res.json({ ok: true, role: 'admin' });
});
// ── Bets CRUD ─────────────────────────────────────────────────────────
const betBodySchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    banner: zod_1.z.string().optional(),
    pfp: zod_1.z.string().optional(),
    date: zod_1.z.string().min(1),
    options: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().min(1),
        label: zod_1.z.string().min(1),
        multiplier: zod_1.z.string().min(1),
        oldMultiplier: zod_1.z.string().optional(),
        personId: zod_1.z.string().optional(),
        result: zod_1.z.enum(['won', 'lost']).optional(),
        tier: zod_1.z.enum(['main', 'sub']).optional(),
        subGroupId: zod_1.z.preprocess(v => (v === '' || v === null || v === undefined ? undefined : String(v)), zod_1.z.string().optional()),
        promoted: zod_1.z.boolean().optional(),
    })).min(2),
    subGroups: zod_1.z.array(zod_1.z
        .object({
        groupKey: zod_1.z.string().optional(),
        id: zod_1.z.string().optional(),
        title: zod_1.z.string().min(1),
        image: zod_1.z.string().optional(),
        personId: zod_1.z.string().optional(),
        promoted: zod_1.z.boolean().optional(),
        infoTooltip: zod_1.z.string().optional(),
    })
        .transform(s => ({
        groupKey: String(s.groupKey ?? s.id ?? '').trim(),
        title: s.title,
        image: s.image,
        personId: s.personId,
        promoted: s.promoted,
        infoTooltip: s.infoTooltip != null && String(s.infoTooltip).trim() !== ''
            ? String(s.infoTooltip).trim()
            : undefined,
    }))
        .refine(s => s.groupKey.length > 0, { message: 'subGroup groupKey required' })).optional().default([]),
    settlementRules: zod_1.z.string().optional(),
    mainMarketTooltip: zod_1.z.string().optional(),
    category: zod_1.z.string().optional(),
    personId: zod_1.z.string().optional(),
    featuredOrder: zod_1.z.number().int().min(0).max(3).optional(),
});
r.get('/bets', auth_1.requireAdmin, async (_req, res) => {
    await (0, betDeadline_1.closeBetsPastDeadline)();
    const bets = await models_1.Bet.find().sort({ createdAt: -1 }).lean();
    res.json(bets.map(b => (0, betNormalize_1.normalizeBetForApi)(b)));
});
r.post('/bets', auth_1.requireAdmin, (0, validate_1.validate)(betBodySchema), async (req, res) => {
    const data = { ...req.body, options: clampBetOptionsMultipliers(req.body.options) };
    if (data.featuredOrder && data.featuredOrder > 0) {
        await models_1.Bet.updateMany({ featuredOrder: data.featuredOrder }, { featuredOrder: 0 });
    }
    const bet = await models_1.Bet.create({ ...data, date: new Date(data.date) });
    await autoCreateCategory(data.personId, data.options);
    res.status(201).json((0, betNormalize_1.normalizeBetForApi)(bet.toObject()));
});
r.put('/bets/:id', auth_1.requireAdmin, (0, validate_1.validate)(betBodySchema), async (req, res) => {
    const data = { ...req.body, options: clampBetOptionsMultipliers(req.body.options) };
    if (data.featuredOrder && data.featuredOrder > 0) {
        await models_1.Bet.updateMany({ featuredOrder: data.featuredOrder, _id: { $ne: req.params.id } }, { featuredOrder: 0 });
    }
    const bet = await models_1.Bet.findById(req.params.id);
    if (!bet) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    bet.title = data.title;
    bet.banner = data.banner;
    bet.pfp = data.pfp;
    bet.date = new Date(data.date);
    if (bet.status === 'pending' && bet.date > new Date()) {
        bet.status = 'open';
    }
    bet.options = data.options;
    bet.subGroups = data.subGroups ?? [];
    bet.settlementRules = data.settlementRules ?? '';
    bet.mainMarketTooltip = data.mainMarketTooltip ?? '';
    bet.category = data.category ?? '';
    bet.personId = data.personId;
    if (typeof data.featuredOrder === 'number')
        bet.featuredOrder = data.featuredOrder;
    bet.markModified('subGroups');
    bet.markModified('options');
    await bet.save();
    await autoCreateCategory(data.personId, data.options);
    res.json((0, betNormalize_1.normalizeBetForApi)(bet.toObject()));
});
r.delete('/bets/:id', auth_1.requireAdmin, async (req, res) => {
    const bet = await models_1.Bet.findByIdAndDelete(req.params.id);
    if (!bet) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.json({ success: true });
});
// ── Resolve ───────────────────────────────────────────────────────────
const resolveSchema = zod_1.z.object({
    optionResults: zod_1.z.record(zod_1.z.string(), zod_1.z.enum(['won', 'lost'])),
});
r.post('/bets/:id/resolve', auth_1.requireAdmin, (0, validate_1.validate)(resolveSchema), async (req, res) => {
    const { optionResults } = req.body;
    await (0, betDeadline_1.closeBetsPastDeadline)({ force: true });
    const bet = await models_1.Bet.findById(req.params.id);
    if (!bet) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    if (bet.status === 'resolved') {
        res.status(400).json({ error: 'Already resolved' });
        return;
    }
    if (bet.status === 'cancelled') {
        res.status(400).json({ error: 'Cannot resolve a cancelled bet' });
        return;
    }
    bet.status = 'resolved';
    bet.options = bet.options.map(o => ({ ...o, result: optionResults[o.id] ?? 'lost' }));
    await bet.save();
    // Idempotent per-userBet settlement: only credit if the row was still active
    // when we flipped it, so a crash + retry can't double-pay.
    const userBets = await models_1.UserBet.find({ betId: bet._id, status: 'active' }).lean();
    for (const ub of userBets) {
        const won = optionResults[ub.optionId] === 'won';
        const flipped = await models_1.UserBet.findOneAndUpdate({ _id: ub._id, status: 'active' }, { $set: { status: won ? 'won' : 'lost' } });
        if (flipped && won) {
            await models_1.User.findByIdAndUpdate(ub.userId, { $inc: { balance: ub.potentialWin } });
        }
    }
    res.json(bet);
});
// ── Feature ───────────────────────────────────────────────────────────
const featureSchema = zod_1.z.object({ featuredOrder: zod_1.z.number().int().min(0).max(3) });
r.put('/bets/:id/feature', auth_1.requireAdmin, (0, validate_1.validate)(featureSchema), async (req, res) => {
    const { featuredOrder } = req.body;
    if (featuredOrder > 0) {
        await models_1.Bet.updateMany({ featuredOrder, _id: { $ne: req.params.id } }, { featuredOrder: 0 });
    }
    const bet = await models_1.Bet.findByIdAndUpdate(req.params.id, { featuredOrder }, { new: true });
    if (!bet) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.json(bet);
});
// ── Persons CRUD ──────────────────────────────────────────────────────
const personSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    pfp: zod_1.z.string().optional(),
});
r.get('/persons', auth_1.requireAdmin, async (_req, res) => {
    res.json(await models_1.Person.find().sort({ name: 1 }).lean());
});
r.post('/persons', auth_1.requireAdmin, (0, validate_1.validate)(personSchema), async (req, res) => {
    res.status(201).json(await models_1.Person.create(req.body));
});
r.put('/persons/:id', auth_1.requireAdmin, (0, validate_1.validate)(personSchema), async (req, res) => {
    const doc = await models_1.Person.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.json(doc);
});
r.delete('/persons/:id', auth_1.requireAdmin, async (req, res) => {
    const doc = await models_1.Person.findByIdAndDelete(req.params.id);
    if (!doc) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.json({ success: true });
});
// ── Categories CRUD ───────────────────────────────────────────────────
const categorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    autoCreated: zod_1.z.boolean().optional(),
});
r.get('/categories', auth_1.requireAdmin, async (_req, res) => {
    res.json(await models_1.Category.find().sort({ name: 1 }).lean());
});
r.post('/categories', auth_1.requireAdmin, (0, validate_1.validate)(categorySchema), async (req, res) => {
    res.status(201).json(await models_1.Category.create(req.body));
});
r.put('/categories/:id', auth_1.requireAdmin, (0, validate_1.validate)(categorySchema), async (req, res) => {
    const doc = await models_1.Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.json(doc);
});
r.delete('/categories/:id', auth_1.requireAdmin, async (req, res) => {
    const doc = await models_1.Category.findByIdAndDelete(req.params.id);
    if (!doc) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.json({ success: true });
});
// ── Users & Payments ──────────────────────────────────────────────────
r.get('/users', auth_1.requireAdmin, async (_req, res) => {
    const users = await models_1.User.find().select('-passkey -verificationCode').sort({ createdAt: -1 }).lean();
    if (users.length === 0) {
        res.json([]);
        return;
    }
    const userIds = users.map(u => u._id);
    const [betCounts, wonCounts, deposits, payouts] = await Promise.all([
        models_1.UserBet.aggregate([
            { $match: { userId: { $in: userIds } } },
            { $group: { _id: '$userId', total: { $sum: 1 }, wagered: { $sum: '$amount' } } },
        ]),
        models_1.UserBet.aggregate([
            { $match: { userId: { $in: userIds }, status: 'won' } },
            { $group: { _id: '$userId', total: { $sum: 1 } } },
        ]),
        models_1.Payment.aggregate([
            { $match: { userId: { $in: userIds }, type: 'deposit', status: 'confirmed' } },
            {
                $group: {
                    _id: '$userId',
                    total: { $sum: { $ifNull: ['$amountPln', '$amount'] } },
                },
            },
        ]),
        models_1.Payment.aggregate([
            { $match: { userId: { $in: userIds }, type: 'payout', status: { $in: ['confirmed', 'completed'] } } },
            { $group: { _id: '$userId', total: { $sum: '$amount' } } },
        ]),
    ]);
    const pick = (arr, id, field = 'total') => arr.find(x => x._id.toString() === id.toString())?.[field] ?? 0;
    res.json(users.map(u => ({
        ...u,
        totalBets: pick(betCounts, u._id),
        totalWagered: pick(betCounts, u._id, 'wagered'),
        wonBets: pick(wonCounts, u._id),
        totalDeposited: pick(deposits, u._id),
        totalWithdrawn: pick(payouts, u._id),
    })));
});
r.delete('/users/:id', auth_1.requireAdmin, async (req, res) => {
    const { id } = req.params;
    if (!mongoose_1.default.isValidObjectId(id)) {
        res.status(400).json({ error: 'Invalid user id' });
        return;
    }
    const user = await models_1.User.findById(id);
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    await models_1.UserBet.deleteMany({ userId: user._id });
    await models_1.Payment.deleteMany({ userId: user._id });
    await models_1.User.deleteOne({ _id: user._id });
    res.json({ success: true });
});
r.get('/payments', auth_1.requireAdmin, async (_req, res) => {
    res.json(await models_1.Payment.find().sort({ createdAt: -1 }).limit(200).lean());
});
// ── Promo codes ───────────────────────────────────────────────────────
function randomPromoCode(len = 10) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < len; i++)
        out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
}
async function generateUniquePromoCode(len = 10) {
    for (let attempt = 0; attempt < 10; attempt++) {
        const code = randomPromoCode(len);
        const exists = await models_1.PromoCode.exists({ code });
        if (!exists)
            return code;
    }
    throw new Error('Could not generate a unique promo code');
}
const promoCreateSchema = zod_1.z.object({
    code: zod_1.z.string().trim().min(3).max(32).optional(),
    amountPln: zod_1.z.number().positive(),
    usesLimit: zod_1.z.number().int().min(0).optional(),
    minDepositPln: zod_1.z.number().min(0).optional(),
    minWageredPln: zod_1.z.number().min(0).optional(),
    requireAnyDeposit: zod_1.z.boolean().optional(),
    expiresAt: zod_1.z.string().optional(),
});
r.get('/promo-codes', auth_1.requireAdmin, async (_req, res) => {
    const codes = await models_1.PromoCode.find().sort({ createdAt: -1 }).lean();
    res.json(codes);
});
r.post('/promo-codes', auth_1.requireAdmin, (0, validate_1.validate)(promoCreateSchema), async (req, res) => {
    const body = req.body;
    const code = (body.code?.toUpperCase().trim()) || (await generateUniquePromoCode());
    if (body.code) {
        const existing = await models_1.PromoCode.findOne({ code });
        if (existing) {
            res.status(400).json({ error: 'Code already exists' });
            return;
        }
    }
    const doc = await models_1.PromoCode.create({
        code,
        amountPln: body.amountPln,
        usesLimit: body.usesLimit ?? 0,
        minDepositPln: body.minDepositPln ?? 0,
        minWageredPln: body.minWageredPln ?? 0,
        requireAnyDeposit: body.requireAnyDeposit ?? true,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        source: 'admin',
    });
    res.status(201).json(doc);
});
const promoUpdateSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().optional(),
});
r.patch('/promo-codes/:id', auth_1.requireAdmin, (0, validate_1.validate)(promoUpdateSchema), async (req, res) => {
    if (!mongoose_1.default.isValidObjectId(req.params.id)) {
        res.status(400).json({ error: 'Invalid id' });
        return;
    }
    const doc = await models_1.PromoCode.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.json(doc);
});
r.delete('/promo-codes/:id', auth_1.requireAdmin, async (req, res) => {
    if (!mongoose_1.default.isValidObjectId(req.params.id)) {
        res.status(400).json({ error: 'Invalid id' });
        return;
    }
    const doc = await models_1.PromoCode.findByIdAndDelete(req.params.id);
    if (!doc) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.json({ success: true });
});
// ── Backfill PLN for legacy deposits ──────────────────────────────────
// Finds confirmed deposits without a valid amountPln, fetches current PLN
// rate, stores amountPln, and corrects user.balance (was incremented by
// raw native amount instead of PLN value).
r.post('/backfill-pln', auth_1.requireAdmin, async (_req, res) => {
    res.json(await backfillLegacyDepositsPln());
});
// ── Main page tapes (taśma dnia / taśma tygodnia) ─────────────────────
const tapeLineSchema = zod_1.z.object({
    betShortId: zod_1.z.string().min(1),
    optionId: zod_1.z.string().min(1),
});
const tapeBlockSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    lines: zod_1.z.array(tapeLineSchema).max(12),
});
const siteTapesPutSchema = zod_1.z.object({
    day: tapeBlockSchema,
    week: tapeBlockSchema,
});
r.get('/tapes', auth_1.requireAdmin, async (_req, res) => {
    res.json(await (0, models_1.getOrCreateSiteTapes)());
});
r.put('/tapes', auth_1.requireAdmin, (0, validate_1.validate)(siteTapesPutSchema), async (req, res) => {
    const { day, week } = req.body;
    const doc = await models_1.SiteTapes.findOneAndUpdate({ key: 'main' }, { $set: { day, week } }, { new: true, upsert: true, setDefaultsOnInsert: true }).lean();
    if (!doc) {
        res.status(500).json({ error: 'Failed' });
        return;
    }
    res.json({
        key: 'main',
        day: { title: doc.day?.title ?? 'Taśma dnia', lines: doc.day?.lines ?? [] },
        week: { title: doc.week?.title ?? 'Taśma tygodnia', lines: doc.week?.lines ?? [] },
    });
});
// ── Helpers ───────────────────────────────────────────────────────────
async function autoCreateCategory(personId, options) {
    const personIds = [personId, ...options.map(o => o.personId)].filter(Boolean);
    for (const pid of [...new Set(personIds)]) {
        const count = await models_1.Bet.countDocuments({
            $or: [
                { personId: pid },
                { 'options.personId': pid },
            ],
        });
        if (count >= 2) {
            const person = await models_1.Person.findById(pid);
            if (person) {
                await models_1.Category.findOneAndUpdate({ name: person.name }, { name: person.name, autoCreated: true }, { upsert: true });
            }
        }
    }
}
async function backfillLegacyDepositsPln() {
    const legacy = await models_1.Payment.find({
        type: 'deposit',
        status: 'confirmed',
        amount: { $gt: 0 },
        $or: [
            { amountPln: { $exists: false } },
            { amountPln: null },
            { amountPln: { $lte: 0 } },
        ],
    }).lean();
    if (legacy.length === 0) {
        return { fixed: 0, results: [], errors: [] };
    }
    const results = [];
    const errors = [];
    for (const p of legacy) {
        try {
            const pln = await (0, cryptoPln_1.nativeAmountToPln)(p.currency, p.amount);
            if (!(pln > 0)) {
                errors.push(`${p._id}: PLN price zero for ${p.currency}`);
                continue;
            }
            await models_1.Payment.updateOne({ _id: p._id }, { $set: { amountPln: pln } });
            // Balance was previously incremented by raw native amount; replace with PLN value
            await models_1.User.findByIdAndUpdate(p.userId, {
                $inc: { balance: pln - p.amount },
            });
            results.push({ paymentId: p._id.toString(), currency: p.currency, native: p.amount, pln });
        }
        catch (err) {
            errors.push(`${p._id}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    return { fixed: results.length, results, errors };
}
exports.adminRoutes = r;
//# sourceMappingURL=admin.js.map