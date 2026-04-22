import { Router, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { validate } from '../middleware/validate'
import { PromoCode } from '../models'
import { generateUniquePromoCode } from './admin'

const r = Router()

const REWARD_AMOUNTS: Record<string, number> = {
  x: 10,
  steam: 2.5,
}

const claimLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
})

const claimSchema = z.object({
  platform: z.enum(['x', 'steam']),
})

r.post('/claim', claimLimiter, validate(claimSchema), async (req: Request, res: Response) => {
  const { platform } = req.body as { platform: 'x' | 'steam' }
  const amountPln = REWARD_AMOUNTS[platform]
  const code = await generateUniquePromoCode(10)

  const doc = await PromoCode.create({
    code,
    amountPln,
    usesLimit: 1,
    requireAnyDeposit: true,
    source: platform === 'x' ? 'reward-x' : 'reward-steam',
  })

  res.json({ code: doc.code, amountPln: doc.amountPln })
})

export const rewardsRoutes = r
