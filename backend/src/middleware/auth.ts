import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { env } from '../config/env'

export interface AuthRequest extends Request {
  adminId?: string
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const token = (req as Request & { cookies?: Record<string, string> }).cookies?.admin_token
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { role?: string }
    if (payload.role !== 'admin') throw new Error('role')
  } catch {
    res.status(401).json({ error: 'Invalid token' })
    return
  }

  if (!SAFE_METHODS.has(req.method)) {
    const cookieCsrf = (req as Request & { cookies?: Record<string, string> }).cookies?.csrf_token
    const headerCsrf = req.headers['x-csrf-token']
    const header = Array.isArray(headerCsrf) ? headerCsrf[0] : headerCsrf
    if (!cookieCsrf || !header || !timingSafeEqualStr(cookieCsrf, String(header))) {
      res.status(403).json({ error: 'CSRF check failed' })
      return
    }
  }

  req.adminId = 'admin'
  next()
}

function parseAllowedIps(): string[] {
  return (env.BOT_ALLOWED_IPS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

const ALLOWED_BOT_IPS = parseAllowedIps()
const BOT_KEY_BUF = Buffer.from(env.BOT_API_KEY, 'utf8')

export function requireBotKey(req: Request, res: Response, next: NextFunction) {
  const raw = req.headers['x-bot-key']
  const key = Array.isArray(raw) ? raw[0] : raw
  if (typeof key !== 'string') {
    res.status(403).json({ error: 'Invalid bot key' })
    return
  }
  const keyBuf = Buffer.from(key, 'utf8')
  if (keyBuf.length !== BOT_KEY_BUF.length || !crypto.timingSafeEqual(keyBuf, BOT_KEY_BUF)) {
    res.status(403).json({ error: 'Invalid bot key' })
    return
  }
  if (ALLOWED_BOT_IPS.length > 0) {
    const ip = req.ip ?? ''
    if (!ALLOWED_BOT_IPS.includes(ip)) {
      res.status(403).json({ error: 'IP not allowed' })
      return
    }
  }
  next()
}
