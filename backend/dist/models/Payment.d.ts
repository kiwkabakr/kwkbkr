import mongoose, { Document, Types } from 'mongoose';
export interface IPayment extends Document {
    userId: Types.ObjectId;
    telegramId: string;
    type: 'deposit' | 'payout';
    currency: 'BTC' | 'ETH' | 'USDC' | 'SOL';
    /** On-chain / token amount (e.g. ETH). For payouts this is the PLN value debited from balance. */
    amount: number;
    /** PLN credited on confirmed deposits; equals `amount` for payouts (balance is PLN). */
    amountPln?: number;
    depositAddress?: string;
    derivationIndex?: number;
    userWalletAddress?: string;
    txHash?: string;
    status: 'pending' | 'confirmed' | 'completed' | 'failed';
    createdAt: Date;
}
export declare const Payment: mongoose.Model<IPayment, {}, {}, {}, mongoose.Document<unknown, {}, IPayment, {}, mongoose.DefaultSchemaOptions> & IPayment & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IPayment>;
//# sourceMappingURL=Payment.d.ts.map