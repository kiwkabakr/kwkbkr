import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IBonusRedemption extends Document {
  userId: Types.ObjectId
  telegramId: string
  promoCodeId: Types.ObjectId
  code: string
  amountPln: number
  createdAt: Date
}

const bonusRedemptionSchema = new Schema<IBonusRedemption>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    telegramId: { type: String, required: true, index: true },
    promoCodeId: { type: Schema.Types.ObjectId, ref: 'PromoCode', required: true, index: true },
    code: { type: String, required: true, uppercase: true },
    amountPln: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
)

export const BonusRedemption = mongoose.model<IBonusRedemption>('BonusRedemption', bonusRedemptionSchema)
