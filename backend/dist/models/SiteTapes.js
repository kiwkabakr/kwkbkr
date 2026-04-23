"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiteTapes = void 0;
exports.getOrCreateSiteTapes = getOrCreateSiteTapes;
const mongoose_1 = __importDefault(require("mongoose"));
const tapeLineSchema = new mongoose_1.default.Schema({
    betShortId: { type: String, required: true, trim: true },
    optionId: { type: String, required: true, trim: true },
}, { _id: false });
const tapeBlockSchema = new mongoose_1.default.Schema({
    title: { type: String, default: 'Taśma dnia' },
    lines: { type: [tapeLineSchema], default: [] },
}, { _id: false });
const siteTapesSchema = new mongoose_1.default.Schema({
    key: { type: String, default: 'main', unique: true, index: true },
    day: { type: tapeBlockSchema, default: () => ({ title: 'Taśma dnia', lines: [] }) },
    week: { type: tapeBlockSchema, default: () => ({ title: 'Taśma tygodnia', lines: [] }) },
}, { timestamps: true });
exports.SiteTapes = mongoose_1.default.model('SiteTapes', siteTapesSchema);
async function getOrCreateSiteTapes() {
    const doc = await exports.SiteTapes.findOneAndUpdate({ key: 'main' }, { $setOnInsert: { key: 'main' } }, { new: true, upsert: true, setDefaultsOnInsert: true }).lean();
    if (!doc) {
        return {
            key: 'main',
            day: { title: 'Taśma dnia', lines: [] },
            week: { title: 'Taśma tygodnia', lines: [] },
        };
    }
    return {
        key: 'main',
        day: { title: doc.day?.title ?? 'Taśma dnia', lines: doc.day?.lines ?? [] },
        week: { title: doc.week?.title ?? 'Taśma tygodnia', lines: doc.week?.lines ?? [] },
    };
}
//# sourceMappingURL=SiteTapes.js.map