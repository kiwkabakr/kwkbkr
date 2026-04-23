"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rewardsRoutes = void 0;
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const zod_1 = require("zod");
const validate_1 = require("../middleware/validate");
const models_1 = require("../models");
const admin_1 = require("./admin");
const r = (0, express_1.Router)();
const REWARD_AMOUNTS = {
    x: 10,
    steam: 2.5,
};
const claimLimiter = (0, express_rate_limit_1.default)({
    windowMs: 24 * 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
});
const claimSchema = zod_1.z.object({
    platform: zod_1.z.enum(['x', 'steam']),
});
r.post('/claim', claimLimiter, (0, validate_1.validate)(claimSchema), async (req, res) => {
    const { platform } = req.body;
    const amountPln = REWARD_AMOUNTS[platform];
    const code = await (0, admin_1.generateUniquePromoCode)(10);
    const doc = await models_1.PromoCode.create({
        code,
        amountPln,
        usesLimit: 1,
        requireAnyDeposit: true,
        source: platform === 'x' ? 'reward-x' : 'reward-steam',
    });
    res.json({ code: doc.code, amountPln: doc.amountPln });
});
exports.rewardsRoutes = r;
//# sourceMappingURL=rewards.js.map