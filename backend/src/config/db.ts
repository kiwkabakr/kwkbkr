import mongoose from 'mongoose'
import { env } from './env'

const MAX_RETRIES = 5
const RETRY_MS = 5000

export async function connectDB() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await mongoose.connect(env.MONGO_URI, { dbName: 'czutkagg' })
      console.log('[db] Connected to MongoDB')
      return
    } catch (err) {
      const e = err as Error & { code?: number | string }
      console.error(`[db] Connection attempt ${attempt}/${MAX_RETRIES} failed:`, e.message)
      if (e.code !== undefined) console.error('[db] error code:', e.code)
      const sys = e as Error & { syscall?: string }
      if (sys.syscall) console.error('[db] syscall:', sys.syscall)
      const c = (e as Error & { cause?: Error }).cause
      if (c?.message) console.error('[db] cause:', c.message)
      if (attempt === MAX_RETRIES) {
        console.error('[db] All retries exhausted. Exiting.')
        process.exit(1)
      }
      await new Promise(r => setTimeout(r, RETRY_MS))
    }
  }
}
