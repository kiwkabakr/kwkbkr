import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IUserBet extends Document {
  userId: Types.ObjectId
  betId: Types.ObjectId
  betShortId: string
  optionId: string
  amount: number
  potentialWin: number
  status: 'active' | 'won' | 'lost'
  createdAt: Date
}

const userBetSchema = new Schema<IUserBet>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    betId: { type: Schema.Types.ObjectId, ref: 'Bet', required: true, index: true },
    betShortId: { type: String, required: true },
    optionId: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    potentialWin: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['active', 'won', 'lost'], default: 'active' },
  },
  { timestamps: true }
)

export const UserBet = mongoose.model<IUserBet>('UserBet', userBetSchema)
