import { Bet, Person, type ISiteTapes } from '../models'
import { normalizeBetForApi } from './betNormalize'

type LeanPerson = { _id: unknown; name: string; pfp?: string }
type PersonMap = Record<string, { name: string; pfp?: string }>

async function loadPersonMap(bets: Record<string, unknown>[]): Promise<PersonMap> {
  const ids = new Set<string>()
  for (const bet of bets) {
    if (bet.personId) ids.add(String(bet.personId))
    for (const o of (bet.options as { personId?: string }[]) ?? []) {
      if (o.personId) ids.add(o.personId)
    }
    for (const g of (bet.subGroups as { personId?: string }[]) ?? []) {
      if (g.personId) ids.add(g.personId)
    }
  }
  if (ids.size === 0) return {}
  const persons = (await Person.find({ _id: { $in: [...ids] } })
    .select('name pfp')
    .lean()) as LeanPerson[]
  return Object.fromEntries(persons.map(p => [String(p._id), { name: p.name, pfp: p.pfp }]))
}

function applyPersonMeta(bet: Record<string, unknown>, map: PersonMap) {
  const options = ((bet.options as Record<string, unknown>[]) ?? []).map(o => ({
    ...o,
    personMeta: o.personId ? map[String(o.personId)] : undefined,
  }))
  const subGroups = ((bet.subGroups as Record<string, unknown>[]) ?? []).map(g => ({
    ...g,
    personMeta: g.personId ? map[String(g.personId)] : undefined,
  }))
  return { ...bet, options, subGroups }
}

function parseMult(s: string): number {
  const n = parseFloat(String(s).replace(',', '.').replace(/x/gi, '').trim())
  return Number.isFinite(n) && n > 0 ? n : 1
}

function fmtKurs(n: number): string {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'x'
}

export type PublicTapeLine = {
  betShortId: string
  optionId: string
  question: string
  image?: string
  selection: string
  oldMultiplier: string
  newMultiplier: string
  hasOld: boolean
}

export type PublicTape = {
  title: string
  lines: PublicTapeLine[]
  totalOld: string
  totalNew: string
  hasAnyOld: boolean
} | null

type Opt = {
  id: string
  label: string
  multiplier: string
  oldMultiplier?: string
  personId?: string
  subGroupId?: string
  personMeta?: { pfp?: string; name: string }
}

type SubG = { groupKey: string; image?: string; personMeta?: { pfp?: string } }

type HydratedBet = {
  shortId: string
  title: string
  pfp?: string
  banner?: string
  status: string
  options: Opt[]
  subGroups?: SubG[]
}

function rowImage(bet: HydratedBet, option: Opt): string | undefined {
  if (option.subGroupId) {
    const sg = bet.subGroups?.find(g => g.groupKey === option.subGroupId)
    if (sg?.image?.trim()) return sg.image
    if (sg?.personMeta?.pfp) return sg.personMeta.pfp
  }
  return option.personMeta?.pfp ?? bet.pfp ?? bet.banner
}

function toHydrated(b: Record<string, unknown>): HydratedBet | null {
  const o = b as unknown as HydratedBet
  if (!o?.shortId || o.status !== 'open') return null
  return o
}

function hydrateBlock(
  block: ISiteTapes['day'],
  byShort: Map<string, Record<string, unknown>>
): PublicTape {
  if (!block.lines.length) return null

  const out: PublicTapeLine[] = []
  let prodOld = 1
  let prodNew = 1

  for (const line of block.lines) {
    const raw = byShort.get(line.betShortId)
    if (!raw) continue
    const bet = toHydrated(raw)
    if (!bet) continue
    const option = bet.options.find(x => x.id === line.optionId) as Opt | undefined
    if (!option) continue

    const newN = parseMult(option.multiplier)
    const hasOld = !!(option.oldMultiplier && parseMult(option.oldMultiplier) > 0)
    const legOld = hasOld ? parseMult(option.oldMultiplier as string) : newN

    prodOld *= legOld
    prodNew *= newN

    out.push({
      betShortId: bet.shortId,
      optionId: option.id,
      question: bet.title,
      image: rowImage(bet, option),
      selection: option.label,
      oldMultiplier: fmtKurs(legOld),
      newMultiplier: fmtKurs(newN),
      hasOld,
    })
  }

  if (out.length === 0) return null

  const hasAnyOld = out.some(l => l.hasOld)

  return {
    title: block.title,
    lines: out,
    totalOld: fmtKurs(prodOld),
    totalNew: fmtKurs(prodNew),
    hasAnyOld,
  }
}

export async function buildPublicTapes(config: ISiteTapes): Promise<{ day: PublicTape; week: PublicTape }> {
  const shortIds = new Set<string>()
  for (const l of config.day.lines) shortIds.add(l.betShortId)
  for (const l of config.week.lines) shortIds.add(l.betShortId)
  if (shortIds.size === 0) {
    return { day: null, week: null }
  }

  const rawBets = await Bet.find({ shortId: { $in: [...shortIds] } }).lean()
  const normalized = rawBets
    .map(b => normalizeBetForApi(b))
    .filter((b): b is Record<string, unknown> => b != null)
  const map = await loadPersonMap(normalized)
  const hydrated = normalized.map(b => applyPersonMeta(b, map)) as Record<string, unknown>[]
  const byShort = new Map(
    hydrated.map(b => [String(b.shortId), b as Record<string, unknown>])
  )

  return {
    day: hydrateBlock(config.day, byShort),
    week: hydrateBlock(config.week, byShort),
  }
}
