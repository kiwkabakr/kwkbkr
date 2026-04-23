"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeBetForApi = normalizeBetForApi;
/**
 * Normalize bet subGroups/options for API JSON so subgroup keys match option.subGroupId.
 * Canonical key is `groupKey`. Legacy Mongo subdocs may use `id` instead.
 */
function normalizeBetForApi(bet) {
    if (bet == null)
        return bet;
    if (typeof bet !== 'object')
        return undefined;
    const b = bet;
    const rawGroups = b.subGroups ?? [];
    const subGroups = rawGroups
        .map((g) => {
        const key = String(g.groupKey ?? g.id ?? '').trim();
        if (!key)
            return null;
        return {
            ...g,
            groupKey: key,
            title: String(g.title ?? ''),
        };
    })
        .filter(Boolean);
    const options = (b.options ?? []).map((o) => {
        const raw = o.subGroupId;
        const subGroupId = raw != null && String(raw).trim() !== '' ? String(raw).trim() : undefined;
        return { ...o, subGroupId };
    });
    return { ...b, subGroups, options };
}
//# sourceMappingURL=betNormalize.js.map