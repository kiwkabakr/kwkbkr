import mongoose, { Document, Types } from 'mongoose';
export type PromoCodeSource = 'admin' | 'reward-x' | 'reward-steam';
export interface IPromoCode extends Document {
    code: string;
    amountPln: number;
    /** 0 = unlimited global uses */
    usesLimit: number;
    usesCount: number;
    /** Required minimum sum of all confirmed deposits (PLN). 0 = just needs any deposit. */
    minDepositPln: number;
    /** Required minimum total wagered (PLN). 0 = no requirement. */
    minWageredPln: number;
    /** If true, user must have at least one confirmed deposit (any amount). */
    requireAnyDeposit: boolean;
    source: PromoCodeSource;
    enabled: boolean;
    expiresAt?: Date;
    redeemedBy: Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}
export declare const PromoCode: mongoose.Model<IPromoCode, {}, {}, {}, mongoose.Document<unknown, {}, IPromoCode, {}, mongoose.DefaultSchemaOptions> & IPromoCode & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IPromoCode>;
//# sourceMappingURL=PromoCode.d.ts.map