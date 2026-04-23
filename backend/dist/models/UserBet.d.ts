import mongoose, { Document, Types } from 'mongoose';
export interface IUserBet extends Document {
    userId: Types.ObjectId;
    betId: Types.ObjectId;
    betShortId: string;
    optionId: string;
    amount: number;
    potentialWin: number;
    status: 'active' | 'won' | 'lost';
    createdAt: Date;
}
export declare const UserBet: mongoose.Model<IUserBet, {}, {}, {}, mongoose.Document<unknown, {}, IUserBet, {}, mongoose.DefaultSchemaOptions> & IUserBet & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IUserBet>;
//# sourceMappingURL=UserBet.d.ts.map