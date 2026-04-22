import { z } from 'zod'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  MONGO_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  ADMIN_PASSWORD_HASH: z.string().min(1),
  BOT_API_KEY: z.string().min(16),
  BOT_ALLOWED_IPS: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  MASTER_MNEMONIC: z.string().optional(),
  ALCHEMY_API_KEY: z.string().optional(),
  SOLANA_RPC_URL: z.string().default('https://api.mainnet-beta.solana.com'),
  CLOUDINARY_UPLOAD_PRESET: z.string().optional(),
  CLOUDINARY_UPLOAD_URL: z.string().optional(),
})

export const env = schema.parse(process.env)

export const isProd = env.NODE_ENV === 'production'
