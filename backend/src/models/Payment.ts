import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IPayment extends Document {
  userId: Types.ObjectId
  telegramId: string
  type: 'deposit' | 'payout'
  currency: 'BTC' | 'ETH' | 'USDC' | 'SOL'
  /** On-chain / token amount (e.g. ETH). For payouts this is the PLN value debited from balance. */
  amount: number
  /** PLN credited on confirmed deposits; equals `amount` for payouts (balance is PLN). */
  amountPln?: number
  depositAddress?: string
  derivationIndex?: number
  userWalletAddress?: string
  txHash?: string
  status: 'pending' | 'confirmed' | 'completed' | 'failed'
  createdAt: Date
}

const paymentSchema = new Schema<IPayment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    telegramId: { type: String, required: true, index: true },
    type: { type: String, enum: ['deposit', 'payout'], required: true },
    currency: { type: String, enum: ['BTC', 'ETH', 'USDC', 'SOL'], required: true },
    amount: { type: Number, default: 0 },
    amountPln: { type: Number },
    depositAddress: { type: String },
    derivationIndex: { type: Number },
    userWalletAddress: { type: String },
    txHash: { type: String },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true }
)

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema)
