import mongoose, { Schema, Document, Types } from 'mongoose'

export type PromoCodeSource = 'admin' | 'reward-x' | 'reward-steam'

export interface IPromoCode extends Document {
  code: string
  amountPln: number
  /** 0 = unlimited global uses */
  usesLimit: number
  usesCount: number
  /** Required minimum sum of all confirmed deposits (PLN). 0 = just needs any deposit. */
  minDepositPln: number
  /** Required minimum total wagered (PLN). 0 = no requirement. */
  minWageredPln: number
  /** If true, user must have at least one confirmed deposit (any amount). */
  requireAnyDeposit: boolean
  source: PromoCodeSource
  enabled: boolean
  expiresAt?: Date
  redeemedBy: Types.ObjectId[]
  createdAt: Date
  updatedAt: Date
}

const promoCodeSchema = new Schema<IPromoCode>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    amountPln: { type: Number, required: true, min: 0.01 },
    usesLimit: { type: Number, default: 0, min: 0 },
    usesCount: { type: Number, default: 0, min: 0 },
    minDepositPln: { type: Number, default: 0, min: 0 },
    minWageredPln: { type: Number, default: 0, min: 0 },
    requireAnyDeposit: { type: Boolean, default: true },
    source: { type: String, enum: ['admin', 'reward-x', 'reward-steam'], default: 'admin' },
    enabled: { type: Boolean, default: true },
    expiresAt: { type: Date },
    redeemedBy: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
  },
  { timestamps: true }
)

export const PromoCode = mongoose.model<IPromoCode>('PromoCode', promoCodeSchema)
