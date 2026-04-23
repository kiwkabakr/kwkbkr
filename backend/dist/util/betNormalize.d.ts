/**
 * Normalize bet subGroups/options for API JSON so subgroup keys match option.subGroupId.
 * Canonical key is `groupKey`. Legacy Mongo subdocs may use `id` instead.
 */
export declare function normalizeBetForApi(bet: unknown): Record<string, unknown> | null | undefined;
//# sourceMappingURL=betNormalize.d.ts.map