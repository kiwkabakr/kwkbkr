import mongoose, { Document } from 'mongoose';
export interface IBetSubGroup {
    /** Stable id for options.subGroupId (do not use field name `id` — Mongoose reserves it) */
    groupKey: string;
    title: string;
    /** Shown left of the category title on the bet page */
    image?: string;
    personId?: string;
    /** Own bet card on home grid with top sub-options (links to parent bet). */
    promoted?: boolean;
    /** Hover tooltip for the info icon next to this category title on the bet page */
    infoTooltip?: string;
}
export interface IBetOption {
    id: string;
    label: string;
    multiplier: string;
    oldMultiplier?: string;
    personId?: string;
    result?: 'won' | 'lost';
    /** Main = home grid + featured; sub = extra rows on bet detail only */
    tier?: 'main' | 'sub';
    /** When tier=sub, links to subGroups[].groupKey */
    subGroupId?: string;
    /** Render this option as its own bet card on the home grid (links to parent bet page). */
    promoted?: boolean;
}
export interface IBet extends Document {
    shortId: string;
    title: string;
    banner?: string;
    pfp?: string;
    date: Date;
    options: IBetOption[];
    /** Grouped “Więcej opcji” markets (title + optional person); sub options reference by subGroupId */
    subGroups: IBetSubGroup[];
    settlementRules: string;
    /** Hover tooltip for the info icon next to the Główne block on the bet page */
    mainMarketTooltip?: string;
    category: string;
    personId?: string;
    /** open = accepting wagers; pending = past cutoff, awaiting admin resolution */
    status: 'open' | 'pending' | 'resolved' | 'cancelled';
    featuredOrder: number;
    createdAt: Date;
}
export declare const Bet: mongoose.Model<IBet, {}, {}, {}, mongoose.Document<unknown, {}, IBet, {}, mongoose.DefaultSchemaOptions> & IBet & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IBet>;
//# sourceMappingURL=Bet.d.ts.map