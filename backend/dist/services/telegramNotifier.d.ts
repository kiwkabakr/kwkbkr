export declare function notifyDepositConfirmed(params: {
    telegramId: string;
    currency: string;
    native: number;
    pln: number;
    newBalance: number;
    txHash?: string;
}): Promise<void>;
export declare function telegramNotifierAvailable(): boolean;
//# sourceMappingURL=telegramNotifier.d.ts.map