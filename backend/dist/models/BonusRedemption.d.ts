import mongoose, { Document, Types } from 'mongoose';
export interface IBonusRedemption extends Document {
    userId: Types.ObjectId;
    telegramId: string;
    promoCodeId: Types.ObjectId;
    code: string;
    amountPln: number;
    createdAt: Date;
}
export declare const BonusRedemption: mongoose.Model<IBonusRedemption, {}, {}, {}, mongoose.Document<unknown, {}, IBonusRedemption, {}, mongoose.DefaultSchemaOptions> & IBonusRedemption & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IBonusRedemption>;
//# sourceMappingURL=BonusRedemption.d.ts.map