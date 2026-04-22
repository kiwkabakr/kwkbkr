/** Options shown on home grid, featured carousel, and primary row on bet page. */
export function filterMainOptions<T extends { tier?: 'main' | 'sub' }>(options: T[]): T[] {
  const mains = options.filter(o => o.tier !== 'sub')
  return mains.length > 0 ? mains : options
}

/** Extra rows on bet detail only. */
export function filterSubOptions<T extends { tier?: 'main' | 'sub' }>(options: T[]): T[] {
  return options.filter(o => o.tier === 'sub')
}
