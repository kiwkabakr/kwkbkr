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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bet = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const crypto_1 = __importDefault(require("crypto"));
function generateShortId() {
    return crypto_1.default.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
}
const betSubGroupSchema = new mongoose_1.Schema({
    groupKey: { type: String, required: true },
    title: { type: String, required: true },
    image: { type: String },
    personId: { type: String },
    promoted: { type: Boolean, default: false },
    infoTooltip: { type: String },
}, { _id: false, id: false });
const betOptionSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    label: { type: String, required: true },
    multiplier: { type: String, required: true },
    oldMultiplier: { type: String },
    personId: { type: String },
    result: { type: String, enum: ['won', 'lost'] },
    tier: { type: String, enum: ['main', 'sub'], default: 'main' },
    subGroupId: { type: String },
    promoted: { type: Boolean, default: false },
}, { _id: false, id: false });
const betSchema = new mongoose_1.Schema({
    shortId: { type: String, unique: true, default: generateShortId, index: true },
    title: { type: String, required: true },
    banner: { type: String },
    pfp: { type: String },
    date: { type: Date, required: true },
    options: { type: [betOptionSchema], required: true },
    subGroups: { type: [betSubGroupSchema], default: [] },
    settlementRules: { type: String, default: '' },
    mainMarketTooltip: { type: String, default: '' },
    category: { type: String, default: '' },
    personId: { type: String },
    status: { type: String, enum: ['open', 'pending', 'resolved', 'cancelled'], default: 'open' },
    featuredOrder: { type: Number, default: 0, min: 0, max: 3 },
}, { timestamps: true });
// Public listings are always filtered by `status` and commonly sorted by createdAt or featuredOrder.
// These indexes let the hot-path queries in routes/public.ts hit a single b-tree scan.
betSchema.index({ status: 1, createdAt: -1 });
betSchema.index({ status: 1, category: 1, createdAt: -1 });
betSchema.index({ status: 1, featuredOrder: 1 });
// The `date` field is used by closeBetsPastDeadline (status:'open', date:{$lte:now})
betSchema.index({ status: 1, date: 1 });
exports.Bet = mongoose_1.default.model('Bet', betSchema);
//# sourceMappingURL=Bet.js.map