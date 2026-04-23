declare function generateUniquePromoCode(len?: number): Promise<string>;
export { generateUniquePromoCode };
export declare function backfillLegacyDepositsPln(): Promise<{
    fixed: number;
    results: {
        paymentId: string;
        currency: string;
        native: number;
        pln: number;
    }[];
    errors: string[];
}>;
export declare const adminRoutes: import("express-serve-static-core").Router;
//# sourceMappingURL=admin.d.ts.map