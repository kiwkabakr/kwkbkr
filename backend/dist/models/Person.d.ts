import mongoose, { Document } from 'mongoose';
export interface IPerson extends Document {
    name: string;
    pfp?: string;
}
export declare const Person: mongoose.Model<IPerson, {}, {}, {}, mongoose.Document<unknown, {}, IPerson, {}, mongoose.DefaultSchemaOptions> & IPerson & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IPerson>;
//# sourceMappingURL=Person.d.ts.map