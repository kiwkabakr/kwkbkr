import mongoose, { Schema, Document } from 'mongoose'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

export interface IUser extends Document {
  telegramId: string
  username: string
  firstName: string
  /** Legacy plaintext; kept nullable for one-time migration. */
  passkey?: string | null
  passkeyHash?: string | null
  passkeyShown: boolean
  /** Legacy plaintext; kept nullable for one-time migration. */
  verificationCode?: string | null
  verificationCodeHash?: string | null
  verificationCodeShown: boolean
  balance: number
  redeemedCodes: string[]
  createdAt: Date
  compareVerificationCode(code: string): Promise<boolean>
}

const BCRYPT_COST = 10

export function generatePasskey(): string {
  const d = Array.from({ length: 9 }, () => crypto.randomInt(10)).join('')
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
}

export function generateVerificationCode(): string {
  return Array.from({ length: 6 }, () => crypto.randomInt(10)).join('')
}

const userSchema = new Schema<IUser>(
  {
    telegramId: { type: String, required: true, unique: true, index: true },
    username: { type: String, default: '' },
    firstName: { type: String, default: '' },
    passkey: { type: String, default: null, select: false },
    passkeyHash: { type: String, default: null, select: false },
    passkeyShown: { type: Boolean, default: false },
    verificationCode: { type: String, default: null, select: false },
    verificationCodeHash: { type: String, default: null, select: false },
    verificationCodeShown: { type: Boolean, default: false },
    balance: { type: Number, default: 0, min: 0 },
    redeemedCodes: { type: [String], default: [] },
  },
  { timestamps: true }
)

userSchema.pre('save', async function hashSecretsIfPlain() {
  const doc = this as IUser
  if (doc.passkey && !doc.passkeyHash) {
    doc.passkeyHash = await bcrypt.hash(doc.passkey, BCRYPT_COST)
  }
  if (doc.passkey) doc.passkey = null
  if (doc.verificationCode && !doc.verificationCodeHash) {
    doc.verificationCodeHash = await bcrypt.hash(doc.verificationCode, BCRYPT_COST)
  }
  if (doc.verificationCode) doc.verificationCode = null
})

userSchema.methods.compareVerificationCode = async function (code: string): Promise<boolean> {
  if (!this.verificationCodeHash) return false
  return bcrypt.compare(String(code), this.verificationCodeHash)
}

export const User = mongoose.model<IUser>('User', userSchema)

/**
 * Idempotent. Hashes any leftover plaintext passkey / verificationCode values
 * from legacy rows into the matching *Hash fields and clears the plaintext.
 */
export async function migratePlaintextSecrets(): Promise<{ migrated: number }> {
  const cursor = User.find({
    $or: [
      { passkey: { $type: 'string', $ne: null } },
      { verificationCode: { $type: 'string', $ne: null } },
    ],
  })
    .select('+passkey +passkeyHash +verificationCode +verificationCodeHash')
    .cursor()

  let migrated = 0
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    let changed = false
    if (doc.passkey && !doc.passkeyHash) {
      doc.passkeyHash = await bcrypt.hash(doc.passkey, BCRYPT_COST)
      changed = true
    }
    if (doc.passkey) { doc.passkey = null; changed = true }
    if (doc.verificationCode && !doc.verificationCodeHash) {
      doc.verificationCodeHash = await bcrypt.hash(doc.verificationCode, BCRYPT_COST)
      changed = true
    }
    if (doc.verificationCode) { doc.verificationCode = null; changed = true }
    if (changed) {
      await doc.save()
      migrated += 1
    }
  }
  return { migrated }
}
