import mongoose, { Document } from 'mongoose';
export interface IUser extends Document {
    telegramId: string;
    username: string;
    firstName: string;
    /** Legacy plaintext; kept nullable for one-time migration. */
    passkey?: string | null;
    passkeyHash?: string | null;
    passkeyShown: boolean;
    /** Legacy plaintext; kept nullable for one-time migration. */
    verificationCode?: string | null;
    verificationCodeHash?: string | null;
    verificationCodeShown: boolean;
    balance: number;
    redeemedCodes: string[];
    createdAt: Date;
    compareVerificationCode(code: string): Promise<boolean>;
}
export declare function generatePasskey(): string;
export declare function generateVerificationCode(): string;
export declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, mongoose.DefaultSchemaOptions> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IUser>;
/**
 * Idempotent. Hashes any leftover plaintext passkey / verificationCode values
 * from legacy rows into the matching *Hash fields and clears the plaintext.
 */
export declare function migratePlaintextSecrets(): Promise<{
    migrated: number;
}>;
//# sourceMappingURL=User.d.ts.map