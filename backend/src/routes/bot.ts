import { Router, Request, Response } from 'express'
import { Types } from 'mongoose'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { requireBotKey } from '../middleware/auth'
import { validate } from '../middleware/validate'
import {
  User,
  Bet,
  UserBet,
  Payment,
  PromoCode,
  BonusRedemption,
  generatePasskey,
  generateVerificationCode,
  type IUser,
} from '../models'
import { deriveAddress, getNextIndex } from '../services/crypto'
import { closeBetsPastDeadline } from '../util/betDeadline'

const r = Router()
r.use(requireBotKey)

// Keyed per IP + telegramId so a single abusive user can't starve others.
function writeLimiter(max: number, windowMs = 60_000) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: req => {
      const tid = (req.body && typeof req.body === 'object' && (req.body as any).telegramId) || ''
      return `${req.ip ?? 'unknown'}:${tid}`
    },
  })
}

const writeRouteLimiter = writeLimiter(30)

async function jsonHistoryForUser(user: IUser) {
  const [payments, userBets, bonuses] = await Promise.all([
    Payment.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
    UserBet.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
    BonusRedemption.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
  ])

  const betIds = [...new Set(userBets.map(ub => ub.betId.toString()))]
  const bets = await Bet.find({ _id: { $in: betIds } }).lean()
  const betMap = new Map(bets.map(b => [b._id.toString(), b]))

  return {
    deposits: payments
      .filter(p => p.type === 'deposit')
      .map(p => ({
        id: p._id,
        currency: p.currency,
        amount: p.amount,
        amountPln: p.amountPln,
        status: p.status,
        createdAt: p.createdAt,
      })),
    payouts: payments
      .filter(p => p.type === 'payout')
      .map(p => ({
        id: p._id,
        currency: p.currency,
        amount: p.amount,
        amountPln: p.amountPln,
        status: p.status,
        createdAt: p.createdAt,
        walletAddress: p.userWalletAddress,
      })),
    bets: userBets.map(ub => {
      const bet = betMap.get(ub.betId.toString())
      const option = bet?.options.find(o => o.id === ub.optionId)
      return {
        id: ub._id,
        betTitle: bet?.title ?? 'Unknown',
        optionLabel: option?.label ?? 'Unknown',
        amount: ub.amount,
        potentialWin: ub.potentialWin,
        status: ub.status,
        createdAt: ub.createdAt,
      }
    }),
    bonuses: bonuses.map(b => ({
      id: b._id,
      code: b.code,
      amountPln: b.amountPln,
      createdAt: b.createdAt,
    })),
  }
}

function sanitizeUser(user: any) {
  return {
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    balance: user.balance,
    passkeyShown: user.passkeyShown,
    createdAt: user.createdAt,
  }
}

// ── User registration ─────────────────────────────────────────────────

const registerSchema = z.object({
  telegramId: z.string().min(1),
  username: z.string().optional(),
  firstName: z.string().optional(),
})

r.post('/users', writeRouteLimiter, validate(registerSchema), async (req: Request, res: Response) => {
  const { telegramId, username, firstName } = req.body
  let user = await User.findOne({ telegramId })
  if (!user) {
    const plainPasskey = generatePasskey()
    const plainCode = generateVerificationCode()
    user = new User({
      telegramId,
      username,
      firstName,
      passkey: plainPasskey,
      verificationCode: plainCode,
      passkeyShown: true,
      verificationCodeShown: true,
    })
    await user.save()
    res.json({
      user: sanitizeUser(user),
      isNew: true,
      usernameMismatch: false,
      currentTelegramUsername: username ?? '',
      passkey: plainPasskey,
      verificationCode: plainCode,
    })
    return
  }
  const usernameMismatch = !!username && user.username !== username
  res.json({
    user: sanitizeUser(user),
    isNew: false,
    usernameMismatch,
    currentTelegramUsername: username ?? '',
  })
})

// ── Get user ──────────────────────────────────────────────────────────

r.get('/users/:telegramId', async (req, res) => {
  const user = await User.findOne({ telegramId: req.params.telegramId })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }
  res.json(sanitizeUser(user))
})

// ── Passkey (one-time, legacy fallback) ───────────────────────────────

r.get('/users/:telegramId/passkey', async (req, res) => {
  const user = await User.findOne({ telegramId: req.params.telegramId })
    .select('+passkey +verificationCode')
  if (!user) { res.status(404).json({ error: 'User not found' }); return }
  if (user.passkeyShown) {
    res.json({ passkey: null, verificationCode: null, alreadyShown: true })
    return
  }
  const passkey = user.passkey ?? null
  const verificationCode = user.verificationCode ?? null
  user.passkeyShown = true
  user.verificationCodeShown = true
  await user.save()
  res.json({ passkey, verificationCode, alreadyShown: false })
})

// ── Delete user ───────────────────────────────────────────────────────

r.delete('/users/:telegramId', async (req, res) => {
  const user = await User.findOne({ telegramId: req.params.telegramId })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }
  await UserBet.deleteMany({ userId: user._id })
  await Payment.deleteMany({ userId: user._id })
  await User.deleteOne({ _id: user._id })
  res.json({ success: true })
})

// ── User info (full stats) ───────────────────────────────────────────

r.get('/users/:telegramId/info', async (req, res) => {
  const user = await User.findOne({ telegramId: req.params.telegramId })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }

  const [totalBets, wonBets, deposits, payouts] = await Promise.all([
    UserBet.countDocuments({ userId: user._id }),
    UserBet.countDocuments({ userId: user._id, status: 'won' }),
    Payment.aggregate([
      { $match: { userId: user._id, type: 'deposit', status: 'confirmed' } },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ['$amountPln', '$amount'] } },
        },
      },
    ]),
    Payment.aggregate([
      { $match: { userId: user._id, type: 'payout', status: { $in: ['confirmed', 'completed'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ])

  res.json({
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    balance: user.balance,
    totalBets,
    wonBets,
    totalDeposited: deposits[0]?.total ?? 0,
    totalWithdrawn: payouts[0]?.total ?? 0,
    memberSince: user.createdAt,
  })
})

// ── Create deposit ────────────────────────────────────────────────────

const depositSchema = z.object({
  telegramId: z.string().min(1),
  currency: z.enum(['BTC', 'ETH', 'USDC', 'SOL']),
})

r.post('/deposits', writeRouteLimiter, validate(depositSchema), async (req: Request, res: Response) => {
  const { telegramId, currency } = req.body
  const user = await User.findOne({ telegramId })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }

  const idx = getNextIndex(currency)
  const address = deriveAddress(currency, idx)

  const payment = await Payment.create({
    userId: user._id,
    telegramId,
    type: 'deposit',
    currency,
    depositAddress: address ?? `CONFIGURE_MASTER_MNEMONIC_${currency}_${idx}`,
    derivationIndex: idx,
    status: 'pending',
  })

  res.json({ paymentId: payment._id, address: payment.depositAddress, currency })
})

// ── Request payout ────────────────────────────────────────────────────

const payoutSchema = z.object({
  telegramId: z.string().min(1),
  currency: z.enum(['BTC', 'ETH', 'USDC', 'SOL']),
  amount: z.number().positive(),
  walletAddress: z.string().min(1).max(128),
  verificationCode: z.string().length(6),
})

r.post('/payouts', writeRouteLimiter, validate(payoutSchema), async (req: Request, res: Response) => {
  const { telegramId, currency, amount, walletAddress, verificationCode } = req.body
  const user = await User.findOne({ telegramId }).select('+verificationCodeHash')
  if (!user) { res.status(404).json({ error: 'User not found' }); return }
  const codeOk = await user.compareVerificationCode(verificationCode)
  if (!codeOk) {
    res.status(403).json({ error: 'Invalid verification code' })
    return
  }

  // Atomic debit: only succeeds if the balance still covers the amount.
  const debited = await User.findOneAndUpdate(
    { _id: user._id, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true }
  )
  if (!debited) {
    res.status(400).json({ error: 'Insufficient balance' })
    return
  }

  const payment = await Payment.create({
    userId: user._id,
    telegramId,
    type: 'payout',
    currency,
    amount,
    amountPln: amount,
    userWalletAddress: walletAddress,
    status: 'pending',
  })

  res.json({ paymentId: payment._id, status: 'pending' })
})

// ── Place bet ─────────────────────────────────────────────────────────

const placeBetSchema = z.object({
  telegramId: z.string().min(1),
  betShortId: z.string().min(1).max(64),
  optionId: z.string().min(1).max(64),
  amount: z.number().positive(),
})

r.post('/bets/place', writeRouteLimiter, validate(placeBetSchema), async (req: Request, res: Response) => {
  const { telegramId, betShortId, optionId, amount } = req.body
  const user = await User.findOne({ telegramId })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }

  await closeBetsPastDeadline({ force: true })
  const bet = await Bet.findOne({ shortId: betShortId, status: 'open' })
  if (!bet) { res.status(404).json({ error: 'Bet not found or closed' }); return }
  if (bet.date <= new Date()) {
    res.status(400).json({ error: 'Betting closed for this event' })
    return
  }

  const option = bet.options.find(o => o.id === optionId)
  if (!option) { res.status(400).json({ error: 'Invalid option' }); return }

  const multiplier = parseFloat(option.multiplier.replace(',', '.'))
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    res.status(400).json({ error: 'Invalid multiplier' }); return
  }
  const potentialWin = Math.round(amount * multiplier * 100) / 100

  const debited = await User.findOneAndUpdate(
    { _id: user._id, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true }
  )
  if (!debited) {
    res.status(400).json({ error: 'Insufficient balance' })
    return
  }

  const userBet = await UserBet.create({
    userId: user._id,
    betId: bet._id,
    betShortId,
    optionId,
    amount,
    potentialWin,
  })

  res.json({ userBet, newBalance: debited.balance })
})

// ── User bets ─────────────────────────────────────────────────────────

r.get('/users/:telegramId/bets', async (req, res) => {
  const user = await User.findOne({ telegramId: req.params.telegramId })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }

  const userBets = await UserBet.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .lean()

  const betIds = [...new Set(userBets.map(ub => ub.betId.toString()))]
  const bets = await Bet.find({ _id: { $in: betIds } }).lean()
  const betMap = new Map(bets.map(b => [b._id.toString(), b]))

  const result = userBets.map(ub => {
    const bet = betMap.get(ub.betId.toString())
    const option = bet?.options.find(o => o.id === ub.optionId)
    return {
      ...ub,
      betTitle: bet?.title ?? 'Unknown',
      optionLabel: option?.label ?? 'Unknown',
      betStatus: bet?.status ?? 'unknown',
    }
  })

  res.json(result)
})

// ── Sync username (requires verification code) ────────────────────────

const syncUsernameSchema = z.object({
  telegramId: z.string().min(1),
  newUsername: z.string().min(1).max(64),
  verificationCode: z.string().length(6),
})

r.post('/users/sync-username', writeRouteLimiter, validate(syncUsernameSchema), async (req: Request, res: Response) => {
  const { telegramId, newUsername, verificationCode } = req.body
  const user = await User.findOne({ telegramId }).select('+verificationCodeHash')
  if (!user) { res.status(404).json({ error: 'User not found' }); return }
  const codeOk = await user.compareVerificationCode(verificationCode)
  if (!codeOk) {
    res.status(403).json({ error: 'Invalid verification code' })
    return
  }
  user.username = newUsername
  await user.save()
  res.json({ success: true, username: user.username })
})

// ── Redeem promo code ─────────────────────────────────────────────────

const redeemSchema = z.object({
  telegramId: z.string().min(1),
  code: z.string().min(1).max(64),
})

r.post('/redeem', writeRouteLimiter, validate(redeemSchema), async (req: Request, res: Response) => {
  const { telegramId } = req.body
  const code = String(req.body.code).trim().toUpperCase()

  const user = await User.findOne({ telegramId })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }

  const promo = await PromoCode.findOne({ code })
  if (!promo) { res.status(400).json({ error: 'Invalid code' }); return }
  if (!promo.enabled) { res.status(400).json({ error: 'Code is disabled' }); return }
  if (promo.expiresAt && promo.expiresAt < new Date()) {
    res.status(400).json({ error: 'Code has expired' })
    return
  }

  if (promo.requireAnyDeposit || promo.minDepositPln > 0) {
    const [deposits] = await Payment.aggregate([
      { $match: { userId: user._id, type: 'deposit', status: 'confirmed' } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          total: { $sum: { $ifNull: ['$amountPln', '$amount'] } },
        },
      },
    ])
    const count = deposits?.count ?? 0
    const total = deposits?.total ?? 0
    if (count === 0) {
      res.status(400).json({ error: 'No deposit — deposit any amount first to redeem codes' })
      return
    }
    if (promo.minDepositPln > 0 && total < promo.minDepositPln) {
      res.status(400).json({
        error: `Insufficient deposit — need at least ${promo.minDepositPln.toFixed(2)} PLN deposited (you have ${total.toFixed(2)} PLN)`,
      })
      return
    }
  }

  if (promo.minWageredPln > 0) {
    const [wager] = await UserBet.aggregate([
      { $match: { userId: user._id } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ])
    const total = wager?.total ?? 0
    if (total < promo.minWageredPln) {
      res.status(400).json({
        error: `Insufficient wagered — need at least ${promo.minWageredPln.toFixed(2)} PLN wagered (you have ${total.toFixed(2)} PLN)`,
      })
      return
    }
  }

  // Atomic redemption: rejects concurrent double-redeems and over-limit usage.
  const claimed = await PromoCode.findOneAndUpdate(
    {
      _id: promo._id,
      enabled: true,
      redeemedBy: { $ne: user._id as Types.ObjectId },
      $or: [
        { usesLimit: 0 },
        { $expr: { $lt: ['$usesCount', '$usesLimit'] } },
      ],
    },
    {
      $inc: { usesCount: 1 },
      $push: { redeemedBy: user._id as Types.ObjectId },
    },
    { new: true }
  )
  if (!claimed) {
    res.status(400).json({ error: 'Code already redeemed or usage limit reached' })
    return
  }

  const credited = await User.findByIdAndUpdate(
    user._id,
    {
      $inc: { balance: claimed.amountPln },
      $addToSet: { redeemedCodes: claimed.code },
    },
    { new: true }
  )

  await BonusRedemption.create({
    userId: user._id,
    telegramId: user.telegramId,
    promoCodeId: claimed._id,
    code: claimed.code,
    amountPln: claimed.amountPln,
  })

  res.json({ success: true, added: claimed.amountPln, newBalance: credited?.balance ?? user.balance })
})

// ── Full history (deposits, payouts, bets) ────────────────────────────

r.get('/users/:telegramId/history', async (req, res) => {
  const tid = String(req.params.telegramId ?? '').trim()
  const user = await User.findOne({ telegramId: tid })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }
  res.json(await jsonHistoryForUser(user))
})

const historyBodySchema = z.object({
  telegramId: z.string().min(1).transform(s => s.trim()),
})

r.post('/users/history', validate(historyBodySchema), async (req, res) => {
  const { telegramId } = req.body
  const user = await User.findOne({ telegramId })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }
  res.json(await jsonHistoryForUser(user))
})

// ── Get single bet by shortId ─────────────────────────────────────────

r.get('/bets/:shortId', async (req, res) => {
  await closeBetsPastDeadline()
  const bet = await Bet.findOne({ shortId: req.params.shortId }).lean()
  if (!bet) { res.status(404).json({ error: 'Bet not found' }); return }
  res.json(bet)
})

export const botRoutes = r
