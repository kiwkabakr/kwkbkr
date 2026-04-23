"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPublicTapes = buildPublicTapes;
const models_1 = require("../models");
const betNormalize_1 = require("./betNormalize");
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
function parseMult(s) {
    const n = parseFloat(String(s).replace(',', '.').replace(/x/gi, '').trim());
    return Number.isFinite(n) && n > 0 ? n : 1;
}
function fmtKurs(n) {
    return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'x';
}
function rowImage(bet, option) {
    if (option.subGroupId) {
        const sg = bet.subGroups?.find(g => g.groupKey === option.subGroupId);
        if (sg?.image?.trim())
            return sg.image;
        if (sg?.personMeta?.pfp)
            return sg.personMeta.pfp;
    }
    return option.personMeta?.pfp ?? bet.pfp ?? bet.banner;
}
function toHydrated(b) {
    const o = b;
    if (!o?.shortId || o.status !== 'open')
        return null;
    return o;
}
function hydrateBlock(block, byShort) {
    if (!block.lines.length)
        return null;
    const out = [];
    let prodOld = 1;
    let prodNew = 1;
    for (const line of block.lines) {
        const raw = byShort.get(line.betShortId);
        if (!raw)
            continue;
        const bet = toHydrated(raw);
        if (!bet)
            continue;
        const option = bet.options.find(x => x.id === line.optionId);
        if (!option)
            continue;
        const newN = parseMult(option.multiplier);
        const hasOld = !!(option.oldMultiplier && parseMult(option.oldMultiplier) > 0);
        const legOld = hasOld ? parseMult(option.oldMultiplier) : newN;
        prodOld *= legOld;
        prodNew *= newN;
        out.push({
            betShortId: bet.shortId,
            optionId: option.id,
            question: bet.title,
            image: rowImage(bet, option),
            selection: option.label,
            oldMultiplier: fmtKurs(legOld),
            newMultiplier: fmtKurs(newN),
            hasOld,
        });
    }
    if (out.length === 0)
        return null;
    const hasAnyOld = out.some(l => l.hasOld);
    return {
        title: block.title,
        lines: out,
        totalOld: fmtKurs(prodOld),
        totalNew: fmtKurs(prodNew),
        hasAnyOld,
    };
}
async function buildPublicTapes(config) {
    const shortIds = new Set();
    for (const l of config.day.lines)
        shortIds.add(l.betShortId);
    for (const l of config.week.lines)
        shortIds.add(l.betShortId);
    if (shortIds.size === 0) {
        return { day: null, week: null };
    }
    const rawBets = await models_1.Bet.find({ shortId: { $in: [...shortIds] } }).lean();
    const normalized = rawBets
        .map(b => (0, betNormalize_1.normalizeBetForApi)(b))
        .filter((b) => b != null);
    const map = await loadPersonMap(normalized);
    const hydrated = normalized.map(b => applyPersonMeta(b, map));
    const byShort = new Map(hydrated.map(b => [String(b.shortId), b]));
    return {
        day: hydrateBlock(config.day, byShort),
        week: hydrateBlock(config.week, byShort),
    };
}
//# sourceMappingURL=siteTapesHydrate.js.map