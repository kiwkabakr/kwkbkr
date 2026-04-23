import { type ISiteTapes } from '../models';
export type PublicTapeLine = {
    betShortId: string;
    optionId: string;
    question: string;
    image?: string;
    selection: string;
    oldMultiplier: string;
    newMultiplier: string;
    hasOld: boolean;
};
export type PublicTape = {
    title: string;
    lines: PublicTapeLine[];
    totalOld: string;
    totalNew: string;
    hasAnyOld: boolean;
} | null;
export declare function buildPublicTapes(config: ISiteTapes): Promise<{
    day: PublicTape;
    week: PublicTape;
}>;
//# sourceMappingURL=siteTapesHydrate.d.ts.map