"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const models_1 = require("../models");
const betNormalize_1 = require("../util/betNormalize");
const siteTapesHydrate_1 = require("../util/siteTapesHydrate");
const betDeadline_1 = require("../util/betDeadline");
const r = (0, express_1.Router)();
// Short-lived caching is safe for public listings.
r.use((_req, res, next) => {
    res.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=30');
    next();
});
const SHORT_ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
function validateShortId(req, res, next) {
    const id = String(req.params.shortId ?? '');
    if (!SHORT_ID_RE.test(id)) {
        res.status(400).json({ error: 'Invalid id' });
        return;
    }
    next();
}
const listQuery = zod_1.z.object({
    category: zod_1.z.string().trim().max(64).optional(),
    status: zod_1.z.enum(['open', 'pending', 'resolved', 'cancelled']).optional(),
});
async function loadPersonMap(bets) {
    const ids = new Set();
    for (const bet of bets) {
        if (bet.personId)
            ids.add(String(bet.personId));
        for (const o of bet.options ?? []) {
            if (o.personId)
                ids.add(o.personId);
        }
        for (const g of bet.subGroups ?? []) {
            if (g.personId)
                ids.add(g.personId);
        }
    }
    if (ids.size === 0)
        return {};
    const persons = (await models_1.Person.find({ _id: { $in: [...ids] } })
        .select('name pfp')
        .lean());
    return Object.fromEntries(persons.map(p => [String(p._id), { name: p.name, pfp: p.pfp }]));
}
function applyPersonMeta(bet, map) {
    const options = (bet.options ?? []).map(o => ({
        ...o,
        personMeta: o.personId ? map[String(o.personId)] : undefined,
    }));
    const subGroups = (bet.subGroups ?? []).map(g => ({
        ...g,
        personMeta: g.personId ? map[String(g.personId)] : undefined,
    }));
    return { ...bet, options, subGroups };
}
async function hydrateBets(raw) {
    const normalized = raw
        .map(b => (0, betNormalize_1.normalizeBetForApi)(b))
        .filter((b) => b != null);
    const map = await loadPersonMap(normalized);
    return normalized.map(b => applyPersonMeta(b, map));
}
r.get('/', async (req, res) => {
    await (0, betDeadline_1.closeBetsPastDeadline)();
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid query' });
        return;
    }
    const filter = { status: parsed.data.status ?? 'open' };
    if (parsed.data.category)
        filter.category = parsed.data.category;
    const bets = await models_1.Bet.find(filter).sort({ createdAt: -1 }).lean();
    res.json(await hydrateBets(bets));
});
r.get('/featured', async (_req, res) => {
    await (0, betDeadline_1.closeBetsPastDeadline)();
    const bets = await models_1.Bet.find({ featuredOrder: { $gte: 1 }, status: 'open' })
        .sort({ featuredOrder: 1 })
        .limit(3)
        .lean();
    res.json(await hydrateBets(bets));
});
r.get('/categories', async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json(await models_1.Category.find().sort({ name: 1 }).lean());
});
r.get('/tapes', async (_req, res) => {
    await (0, betDeadline_1.closeBetsPastDeadline)();
    const cfg = await (0, models_1.getOrCreateSiteTapes)();
    res.json(await (0, siteTapesHydrate_1.buildPublicTapes)(cfg));
});
r.get('/:shortId', validateShortId, async (req, res) => {
    await (0, betDeadline_1.closeBetsPastDeadline)();
    const bet = await models_1.Bet.findOne({ shortId: req.params.shortId }).lean();
    if (!bet) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    const [hydrated] = await hydrateBets([bet]);
    res.json(hydrated);
});
exports.publicRoutes = r;
//# sourceMappingURL=public.js.map