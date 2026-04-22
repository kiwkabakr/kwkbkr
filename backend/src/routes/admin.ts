import { Router, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import mongoose from 'mongoose'
import { z } from 'zod'
import { env, isProd } from '../config/env'
import { requireAdmin } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { Bet, User, Payment, Person, Category, UserBet, PromoCode, SiteTapes, getOrCreateSiteTapes } from '../models'
import { normalizeBetForApi } from '../util/betNormalize'
import { closeBetsPastDeadline } from '../util/betDeadline'
import { nativeAmountToPln } from '../services/cryptoPln'

const r = Router()

const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000
const COOKIE_JWT = 'admin_token'
const COOKIE_CSRF = 'csrf_token'

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
})

function authCookieOpts(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict' as const,
    path: '/api',
    maxAge: maxAgeMs,
  }
}

function csrfCookieOpts(maxAgeMs: number) {
  return {
    httpOnly: false,
    secure: isProd,
    sameSite: 'strict' as const,
    path: '/api',
    maxAge: maxAgeMs,
  }
}

const MIN_KURS_MULTIPLIER = 1.01

function clampBetOptionsMultipliers<T extends { multiplier: string }>(options: T[]): T[] {
  return options.map(o => {
    const m = Number(String(o.multiplier).replace(',', '.').replace(/x/gi, '').trim())
    if (!Number.isFinite(m) || m < MIN_KURS_MULTIPLIER) {
      return { ...o, multiplier: String(MIN_KURS_MULTIPLIER) }
    }
    return { ...o, multiplier: String(Math.round(m * 100) / 100) }
  })
}

// ── Login ─────────────────────────────────────────────────────────────

const loginSchema = z.object({ password: z.string().min(1) })

r.post('/login', adminLoginLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  const { password } = req.body
  const match = await bcrypt.compare(password, env.ADMIN_PASSWORD_HASH)
  if (!match) { res.status(401).json({ error: 'Wrong password' }); return }
  const token = jwt.sign({ role: 'admin' }, env.JWT_SECRET, { expiresIn: '8h' })
  const csrf = crypto.randomBytes(32).toString('hex')
  res.cookie(COOKIE_JWT, token, authCookieOpts(SESSION_MAX_AGE_MS))
  res.cookie(COOKIE_CSRF, csrf, csrfCookieOpts(SESSION_MAX_AGE_MS))
  res.json({ ok: true, csrfToken: csrf })
})

r.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_JWT, { path: '/api' })
  res.clearCookie(COOKIE_CSRF, { path: '/api' })
  res.json({ ok: true })
})

r.get('/me', requireAdmin, (_req, res) => {
  res.json({ ok: true, role: 'admin' })
})

// ── Bets CRUD ─────────────────────────────────────────────────────────

const betBodySchema = z.object({
  title: z.string().min(1),
  banner: z.string().optional(),
  pfp: z.string().optional(),
  date: z.string().min(1),
  options: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      multiplier: z.string().min(1),
      oldMultiplier: z.string().optional(),
      personId: z.string().optional(),
      result: z.enum(['won', 'lost']).optional(),
      tier: z.enum(['main', 'sub']).optional(),
      subGroupId: z.preprocess(
        v => (v === '' || v === null || v === undefined ? undefined : String(v)),
        z.string().optional()
      ),
      promoted: z.boolean().optional(),
    })
  ).min(2),
  subGroups: z.array(
    z
      .object({
        groupKey: z.string().optional(),
        id: z.string().optional(),
        title: z.string().min(1),
        image: z.string().optional(),
        personId: z.string().optional(),
        promoted: z.boolean().optional(),
        infoTooltip: z.string().optional(),
      })
      .transform(s => ({
        groupKey: String(s.groupKey ?? s.id ?? '').trim(),
        title: s.title,
        image: s.image,
        personId: s.personId,
        promoted: s.promoted,
        infoTooltip:
          s.infoTooltip != null && String(s.infoTooltip).trim() !== ''
            ? String(s.infoTooltip).trim()
            : undefined,
      }))
      .refine(s => s.groupKey.length > 0, { message: 'subGroup groupKey required' })
  ).optional().default([]),
  settlementRules: z.string().optional(),
  mainMarketTooltip: z.string().optional(),
  category: z.string().optional(),
  personId: z.string().optional(),
  featuredOrder: z.number().int().min(0).max(3).optional(),
})

r.get('/bets', requireAdmin, async (_req, res) => {
  await closeBetsPastDeadline()
  const bets = await Bet.find().sort({ createdAt: -1 }).lean()
  res.json(bets.map(b => normalizeBetForApi(b)))
})

r.post('/bets', requireAdmin, validate(betBodySchema), async (req: Request, res: Response) => {
  const data = { ...req.body, options: clampBetOptionsMultipliers(req.body.options) }
  if (data.featuredOrder && data.featuredOrder > 0) {
    await Bet.updateMany({ featuredOrder: data.featuredOrder }, { featuredOrder: 0 })
  }
  const bet = await Bet.create({ ...data, date: new Date(data.date) })
  await autoCreateCategory(data.personId, data.options)
  res.status(201).json(normalizeBetForApi(bet.toObject()))
})

r.put('/bets/:id', requireAdmin, validate(betBodySchema), async (req: Request, res: Response) => {
  const data = { ...req.body, options: clampBetOptionsMultipliers(req.body.options) }
  if (data.featuredOrder && data.featuredOrder > 0) {
    await Bet.updateMany(
      { featuredOrder: data.featuredOrder, _id: { $ne: req.params.id } },
      { featuredOrder: 0 }
    )
  }
  const bet = await Bet.findById(req.params.id)
  if (!bet) { res.status(404).json({ error: 'Not found' }); return }

  bet.title = data.title
  bet.banner = data.banner
  bet.pfp = data.pfp
  bet.date = new Date(data.date)
  if (bet.status === 'pending' && bet.date > new Date()) {
    bet.status = 'open'
  }
  bet.options = data.options
  bet.subGroups = data.subGroups ?? []
  bet.settlementRules = data.settlementRules ?? ''
  bet.mainMarketTooltip = data.mainMarketTooltip ?? ''
  bet.category = data.category ?? ''
  bet.personId = data.personId
  if (typeof data.featuredOrder === 'number') bet.featuredOrder = data.featuredOrder
  bet.markModified('subGroups')
  bet.markModified('options')
  await bet.save()

  await autoCreateCategory(data.personId, data.options)
  res.json(normalizeBetForApi(bet.toObject()))
})

r.delete('/bets/:id', requireAdmin, async (req, res) => {
  const bet = await Bet.findByIdAndDelete(req.params.id)
  if (!bet) { res.status(404).json({ error: 'Not found' }); return }
  res.json({ success: true })
})

// ── Resolve ───────────────────────────────────────────────────────────

const resolveSchema = z.object({
  optionResults: z.record(z.string(), z.enum(['won', 'lost'])),
})

r.post('/bets/:id/resolve', requireAdmin, validate(resolveSchema), async (req: Request, res: Response) => {
  const { optionResults } = req.body as { optionResults: Record<string, 'won' | 'lost'> }
  await closeBetsPastDeadline({ force: true })
  const bet = await Bet.findById(req.params.id)
  if (!bet) { res.status(404).json({ error: 'Not found' }); return }
  if (bet.status === 'resolved') { res.status(400).json({ error: 'Already resolved' }); return }
  if (bet.status === 'cancelled') { res.status(400).json({ error: 'Cannot resolve a cancelled bet' }); return }

  bet.status = 'resolved'
  bet.options = bet.options.map(o => ({ ...o, result: optionResults[o.id] ?? 'lost' }))
  await bet.save()

  // Idempotent per-userBet settlement: only credit if the row was still active
  // when we flipped it, so a crash + retry can't double-pay.
  const userBets = await UserBet.find({ betId: bet._id, status: 'active' }).lean()
  for (const ub of userBets) {
    const won = optionResults[ub.optionId] === 'won'
    const flipped = await UserBet.findOneAndUpdate(
      { _id: ub._id, status: 'active' },
      { $set: { status: won ? 'won' : 'lost' } }
    )
    if (flipped && won) {
      await User.findByIdAndUpdate(ub.userId, { $inc: { balance: ub.potentialWin } })
    }
  }

  res.json(bet)
})

// ── Feature ───────────────────────────────────────────────────────────

const featureSchema = z.object({ featuredOrder: z.number().int().min(0).max(3) })

r.put('/bets/:id/feature', requireAdmin, validate(featureSchema), async (req: Request, res: Response) => {
  const { featuredOrder } = req.body
  if (featuredOrder > 0) {
    await Bet.updateMany(
      { featuredOrder, _id: { $ne: req.params.id } },
      { featuredOrder: 0 }
    )
  }
  const bet = await Bet.findByIdAndUpdate(req.params.id, { featuredOrder }, { new: true })
  if (!bet) { res.status(404).json({ error: 'Not found' }); return }
  res.json(bet)
})

// ── Persons CRUD ──────────────────────────────────────────────────────

const personSchema = z.object({
  name: z.string().min(1),
  pfp: z.string().optional(),
})

r.get('/persons', requireAdmin, async (_req, res) => {
  res.json(await Person.find().sort({ name: 1 }).lean())
})

r.post('/persons', requireAdmin, validate(personSchema), async (req, res) => {
  res.status(201).json(await Person.create(req.body))
})

r.put('/persons/:id', requireAdmin, validate(personSchema), async (req, res) => {
  const doc = await Person.findByIdAndUpdate(req.params.id, req.body, { new: true })
  if (!doc) { res.status(404).json({ error: 'Not found' }); return }
  res.json(doc)
})

r.delete('/persons/:id', requireAdmin, async (req, res) => {
  const doc = await Person.findByIdAndDelete(req.params.id)
  if (!doc) { res.status(404).json({ error: 'Not found' }); return }
  res.json({ success: true })
})

// ── Categories CRUD ───────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1),
  autoCreated: z.boolean().optional(),
})

r.get('/categories', requireAdmin, async (_req, res) => {
  res.json(await Category.find().sort({ name: 1 }).lean())
})

r.post('/categories', requireAdmin, validate(categorySchema), async (req, res) => {
  res.status(201).json(await Category.create(req.body))
})

r.put('/categories/:id', requireAdmin, validate(categorySchema), async (req, res) => {
  const doc = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true })
  if (!doc) { res.status(404).json({ error: 'Not found' }); return }
  res.json(doc)
})

r.delete('/categories/:id', requireAdmin, async (req, res) => {
  const doc = await Category.findByIdAndDelete(req.params.id)
  if (!doc) { res.status(404).json({ error: 'Not found' }); return }
  res.json({ success: true })
})

// ── Users & Payments ──────────────────────────────────────────────────

r.get('/users', requireAdmin, async (_req, res) => {
  const users = await User.find().select('-passkey -verificationCode').sort({ createdAt: -1 }).lean()
  if (users.length === 0) { res.json([]); return }

  const userIds = users.map(u => u._id)
  const [betCounts, wonCounts, deposits, payouts] = await Promise.all([
    UserBet.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', total: { $sum: 1 }, wagered: { $sum: '$amount' } } },
    ]),
    UserBet.aggregate([
      { $match: { userId: { $in: userIds }, status: 'won' } },
      { $group: { _id: '$userId', total: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { userId: { $in: userIds }, type: 'deposit', status: 'confirmed' } },
      {
        $group: {
          _id: '$userId',
          total: { $sum: { $ifNull: ['$amountPln', '$amount'] } },
        },
      },
    ]),
    Payment.aggregate([
      { $match: { userId: { $in: userIds }, type: 'payout', status: { $in: ['confirmed', 'completed'] } } },
      { $group: { _id: '$userId', total: { $sum: '$amount' } } },
    ]),
  ])

  const pick = (arr: any[], id: any, field = 'total') =>
    arr.find(x => x._id.toString() === id.toString())?.[field] ?? 0

  res.json(users.map(u => ({
    ...u,
    totalBets: pick(betCounts, u._id),
    totalWagered: pick(betCounts, u._id, 'wagered'),
    wonBets: pick(wonCounts, u._id),
    totalDeposited: pick(deposits, u._id),
    totalWithdrawn: pick(payouts, u._id),
  })))
})

r.delete('/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: 'Invalid user id' })
    return
  }
  const user = await User.findById(id)
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  await UserBet.deleteMany({ userId: user._id })
  await Payment.deleteMany({ userId: user._id })
  await User.deleteOne({ _id: user._id })
  res.json({ success: true })
})

r.get('/payments', requireAdmin, async (_req, res) => {
  res.json(await Payment.find().sort({ createdAt: -1 }).limit(200).lean())
})

// ── Promo codes ───────────────────────────────────────────────────────

function randomPromoCode(len = 10): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

async function generateUniquePromoCode(len = 10): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomPromoCode(len)
    const exists = await PromoCode.exists({ code })
    if (!exists) return code
  }
  throw new Error('Could not generate a unique promo code')
}

const promoCreateSchema = z.object({
  code: z.string().trim().min(3).max(32).optional(),
  amountPln: z.number().positive(),
  usesLimit: z.number().int().min(0).optional(),
  minDepositPln: z.number().min(0).optional(),
  minWageredPln: z.number().min(0).optional(),
  requireAnyDeposit: z.boolean().optional(),
  expiresAt: z.string().optional(),
})

r.get('/promo-codes', requireAdmin, async (_req, res) => {
  const codes = await PromoCode.find().sort({ createdAt: -1 }).lean()
  res.json(codes)
})

r.post('/promo-codes', requireAdmin, validate(promoCreateSchema), async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof promoCreateSchema>
  const code = (body.code?.toUpperCase().trim()) || (await generateUniquePromoCode())
  if (body.code) {
    const existing = await PromoCode.findOne({ code })
    if (existing) { res.status(400).json({ error: 'Code already exists' }); return }
  }
  const doc = await PromoCode.create({
    code,
    amountPln: body.amountPln,
    usesLimit: body.usesLimit ?? 0,
    minDepositPln: body.minDepositPln ?? 0,
    minWageredPln: body.minWageredPln ?? 0,
    requireAnyDeposit: body.requireAnyDeposit ?? true,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    source: 'admin',
  })
  res.status(201).json(doc)
})

const promoUpdateSchema = z.object({
  enabled: z.boolean().optional(),
})

r.patch('/promo-codes/:id', requireAdmin, validate(promoUpdateSchema), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: 'Invalid id' })
    return
  }
  const doc = await PromoCode.findByIdAndUpdate(req.params.id, req.body, { new: true })
  if (!doc) { res.status(404).json({ error: 'Not found' }); return }
  res.json(doc)
})

r.delete('/promo-codes/:id', requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: 'Invalid id' })
    return
  }
  const doc = await PromoCode.findByIdAndDelete(req.params.id)
  if (!doc) { res.status(404).json({ error: 'Not found' }); return }
  res.json({ success: true })
})

export { generateUniquePromoCode }

// ── Backfill PLN for legacy deposits ──────────────────────────────────
// Finds confirmed deposits without a valid amountPln, fetches current PLN
// rate, stores amountPln, and corrects user.balance (was incremented by
// raw native amount instead of PLN value).

r.post('/backfill-pln', requireAdmin, async (_req, res) => {
  res.json(await backfillLegacyDepositsPln())
})

// ── Main page tapes (taśma dnia / taśma tygodnia) ─────────────────────

const tapeLineSchema = z.object({
  betShortId: z.string().min(1),
  optionId: z.string().min(1),
})
const tapeBlockSchema = z.object({
  title: z.string().min(1),
  lines: z.array(tapeLineSchema).max(12),
})
const siteTapesPutSchema = z.object({
  day: tapeBlockSchema,
  week: tapeBlockSchema,
})

r.get('/tapes', requireAdmin, async (_req, res) => {
  res.json(await getOrCreateSiteTapes())
})

r.put('/tapes', requireAdmin, validate(siteTapesPutSchema), async (req: Request, res: Response) => {
  const { day, week } = req.body as z.infer<typeof siteTapesPutSchema>
  const doc = await SiteTapes.findOneAndUpdate(
    { key: 'main' },
    { $set: { day, week } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean()
  if (!doc) { res.status(500).json({ error: 'Failed' }); return }
  res.json({
    key: 'main',
    day: { title: doc.day?.title ?? 'Taśma dnia', lines: doc.day?.lines ?? [] },
    week: { title: doc.week?.title ?? 'Taśma tygodnia', lines: doc.week?.lines ?? [] },
  })
})

// ── Helpers ───────────────────────────────────────────────────────────

async function autoCreateCategory(
  personId: string | undefined,
  options: { personId?: string }[]
) {
  const personIds = [personId, ...options.map(o => o.personId)].filter(Boolean) as string[]
  for (const pid of [...new Set(personIds)]) {
    const count = await Bet.countDocuments({
      $or: [
        { personId: pid },
        { 'options.personId': pid },
      ],
    })
    if (count >= 2) {
      const person = await Person.findById(pid)
      if (person) {
        await Category.findOneAndUpdate(
          { name: person.name },
          { name: person.name, autoCreated: true },
          { upsert: true }
        )
      }
    }
  }
}

export async function backfillLegacyDepositsPln() {
  const legacy = await Payment.find({
    type: 'deposit',
    status: 'confirmed',
    amount: { $gt: 0 },
    $or: [
      { amountPln: { $exists: false } },
      { amountPln: null },
      { amountPln: { $lte: 0 } },
    ],
  }).lean()

  if (legacy.length === 0) {
    return { fixed: 0, results: [], errors: [] as string[] }
  }

  const results: { paymentId: string; currency: string; native: number; pln: number }[] = []
  const errors: string[] = []

  for (const p of legacy) {
    try {
      const pln = await nativeAmountToPln(p.currency, p.amount)
      if (!(pln > 0)) {
        errors.push(`${p._id}: PLN price zero for ${p.currency}`)
        continue
      }
      await Payment.updateOne({ _id: p._id }, { $set: { amountPln: pln } })
      // Balance was previously incremented by raw native amount; replace with PLN value
      await User.findByIdAndUpdate(p.userId, {
        $inc: { balance: pln - p.amount },
      })
      results.push({ paymentId: p._id.toString(), currency: p.currency, native: p.amount, pln })
    } catch (err) {
      errors.push(`${p._id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { fixed: results.length, results, errors }
}

export const adminRoutes = r
