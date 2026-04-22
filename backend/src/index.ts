import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { connectDB } from './config/db'
import { env, isProd } from './config/env'
import { adminRoutes, backfillLegacyDepositsPln } from './routes/admin'
import { publicRoutes } from './routes/public'
import { botRoutes } from './routes/bot'
import { rewardsRoutes } from './routes/rewards'
import { startDepositMonitor } from './jobs/depositMonitor'
import { seedDefaultCategories } from './seed/defaultCategories'
import { telegramNotifierAvailable } from './services/telegramNotifier'
import { migratePlaintextSecrets } from './models'

const app = express()

// Trust the first proxy hop (nginx / cloud LB) so rate-limit sees real client IPs.
app.set('trust proxy', 1)
app.disable('x-powered-by')
app.set('etag', false)

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
        connectSrc: ["'self'", env.FRONTEND_URL],
        fontSrc: ["'self'", 'data:'],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: isProd ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
  })
)
app.use(compression())
app.use(cookieParser())
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Bot-Key', 'Authorization'],
  })
)
app.use(express.json({ limit: '100kb' }))

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
)

// Never cache authenticated / state-changing surfaces.
app.use(['/api/admin', '/api/bot', '/api/rewards'], (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

app.use('/api/admin', adminRoutes)
app.use('/api/bets', publicRoutes)
app.use('/api/bot', botRoutes)
app.use('/api/rewards', rewardsRoutes)

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// Sanitising error handler — never leak stack traces or Mongo internals to clients.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const e = err as Error & { status?: number; statusCode?: number }
  const status = e?.status ?? e?.statusCode ?? 500
  console.error('[error]', e?.message ?? e, isProd ? '' : e?.stack ?? '')
  res.status(status).json({ error: isProd ? 'Internal error' : (e?.message ?? 'Internal error') })
})

async function main() {
  await connectDB()

  await seedDefaultCategories()

  app.listen(Number(env.PORT), () => {
    console.log(`[server] Running on port ${env.PORT}`)
  })

  startDepositMonitor()

  console.log(
    telegramNotifierAvailable()
      ? '[telegram] Live notifications enabled'
      : '[telegram] TELEGRAM_BOT_TOKEN missing — live notifications disabled'
  )

  migratePlaintextSecrets()
    .then(r => {
      if (r.migrated > 0) console.log(`[startup] Hashed plaintext secrets for ${r.migrated} user(s)`)
    })
    .catch(err => console.error('[startup] Secret migration failed:', err))

  backfillLegacyDepositsPln()
    .then(r => {
      if (r.fixed > 0) console.log(`[startup] Backfilled PLN for ${r.fixed} legacy deposit(s)`)
      if (r.errors.length > 0) console.warn('[startup] Backfill errors:', r.errors)
    })
    .catch(err => console.error('[startup] Backfill failed:', err))
}

main().catch(console.error)
