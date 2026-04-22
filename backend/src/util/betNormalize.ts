/**
 * Normalize bet subGroups/options for API JSON so subgroup keys match option.subGroupId.
 * Canonical key is `groupKey`. Legacy Mongo subdocs may use `id` instead.
 */
export function normalizeBetForApi(bet: unknown): Record<string, unknown> | null | undefined {
  if (bet == null) return bet as null | undefined
  if (typeof bet !== 'object') return undefined
  const b = bet as Record<string, unknown>

  const rawGroups = (b.subGroups as Record<string, unknown>[]) ?? []
  const subGroups = rawGroups
    .map((g: Record<string, unknown>) => {
      const key = String(g.groupKey ?? g.id ?? '').trim()
      if (!key) return null
      return {
        ...g,
        groupKey: key,
        title: String(g.title ?? ''),
      }
    })
    .filter(Boolean) as Record<string, unknown>[]

  const options = ((b.options as Record<string, unknown>[]) ?? []).map((o: Record<string, unknown>) => {
    const raw = o.subGroupId
    const subGroupId =
      raw != null && String(raw).trim() !== '' ? String(raw).trim() : undefined
    return { ...o, subGroupId }
  })

  return { ...b, subGroups, options }
}
