"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromoCode = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const promoCodeSchema = new mongoose_1.Schema({
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    amountPln: { type: Number, required: true, min: 0.01 },
    usesLimit: { type: Number, default: 0, min: 0 },
    usesCount: { type: Number, default: 0, min: 0 },
    minDepositPln: { type: Number, default: 0, min: 0 },
    minWageredPln: { type: Number, default: 0, min: 0 },
    requireAnyDeposit: { type: Boolean, default: true },
    source: { type: String, enum: ['admin', 'reward-x', 'reward-steam'], default: 'admin' },
    enabled: { type: Boolean, default: true },
    expiresAt: { type: Date },
    redeemedBy: { type: [mongoose_1.Schema.Types.ObjectId], ref: 'User', default: [] },
}, { timestamps: true });
exports.PromoCode = mongoose_1.default.model('PromoCode', promoCodeSchema);
//# sourceMappingURL=PromoCode.js.map