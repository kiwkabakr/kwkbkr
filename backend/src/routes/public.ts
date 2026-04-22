import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Bet, Category, Person, getOrCreateSiteTapes } from '../models'
import { normalizeBetForApi } from '../util/betNormalize'
import { buildPublicTapes } from '../util/siteTapesHydrate'
import { closeBetsPastDeadline } from '../util/betDeadline'

const r = Router()

// Short-lived caching is safe for public listings.
r.use((_req, res, next) => {
  res.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=30')
  next()
})

const SHORT_ID_RE = /^[A-Za-z0-9_-]{1,32}$/

function validateShortId(req: Request, res: Response, next: NextFunction) {
  const id = String(req.params.shortId ?? '')
  if (!SHORT_ID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid id' })
    return
  }
  next()
}

const listQuery = z.object({
  category: z.string().trim().max(64).optional(),
  status: z.enum(['open', 'pending', 'resolved', 'cancelled']).optional(),
})

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

async function hydrateBets(raw: unknown[]): Promise<Record<string, unknown>[]> {
  const normalized = raw
    .map(b => normalizeBetForApi(b))
    .filter((b): b is Record<string, unknown> => b != null)
  const map = await loadPersonMap(normalized)
  return normalized.map(b => applyPersonMeta(b, map))
}

r.get('/', async (req, res) => {
  await closeBetsPastDeadline()
  const parsed = listQuery.safeParse(req.query)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid query' }); return }
  const filter: Record<string, unknown> = { status: parsed.data.status ?? 'open' }
  if (parsed.data.category) filter.category = parsed.data.category
  const bets = await Bet.find(filter).sort({ createdAt: -1 }).lean()
  res.json(await hydrateBets(bets))
})

r.get('/featured', async (_req, res) => {
  await closeBetsPastDeadline()
  const bets = await Bet.find({ featuredOrder: { $gte: 1 }, status: 'open' })
    .sort({ featuredOrder: 1 })
    .limit(3)
    .lean()
  res.json(await hydrateBets(bets))
})

r.get('/categories', async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  res.json(await Category.find().sort({ name: 1 }).lean())
})

r.get('/tapes', async (_req, res) => {
  await closeBetsPastDeadline()
  const cfg = await getOrCreateSiteTapes()
  res.json(await buildPublicTapes(cfg))
})

r.get('/:shortId', validateShortId, async (req, res) => {
  await closeBetsPastDeadline()
  const bet = await Bet.findOne({ shortId: req.params.shortId }).lean()
  if (!bet) { res.status(404).json({ error: 'Not found' }); return }
  const [hydrated] = await hydrateBets([bet])
  res.json(hydrated)
})

export const publicRoutes = r
