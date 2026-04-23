"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeBetsPastDeadline = closeBetsPastDeadline;
const models_1 = require("../models");
/**
 * Moves bets whose cutoff (`date`) has passed from open → pending.
 *
 * Hot-path guard: every public GET used to run `updateMany` on each request.
 * With 3 parallel calls on the main page, that meant 3 DB writes per visitor.
 * We now throttle to at most one pass every `THROTTLE_MS` (10s). A forced
 * pass still runs for write-critical paths (e.g. placing a bet).
 */
const THROTTLE_MS = 10_000;
let lastRunAt = 0;
let inFlight = null;
async function runUpdate() {
    await models_1.Bet.updateMany({ status: 'open', date: { $lte: new Date() } }, { $set: { status: 'pending' } });
}
async function closeBetsPastDeadline(options) {
    const now = Date.now();
    if (!options?.force && now - lastRunAt < THROTTLE_MS)
        return;
    if (inFlight)
        return inFlight;
    lastRunAt = now;
    inFlight = runUpdate().finally(() => {
        inFlight = null;
    });
    return inFlight;
}
//# sourceMappingURL=betDeadline.js.map