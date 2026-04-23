"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("./env");
const MAX_RETRIES = 5;
const RETRY_MS = 5000;
async function connectDB() {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await mongoose_1.default.connect(env_1.env.MONGO_URI, { dbName: 'czutkagg' });
            console.log('[db] Connected to MongoDB');
            return;
        }
        catch (err) {
            const e = err;
            console.error(`[db] Connection attempt ${attempt}/${MAX_RETRIES} failed:`, e.message);
            if (e.code !== undefined)
                console.error('[db] error code:', e.code);
            const sys = e;
            if (sys.syscall)
                console.error('[db] syscall:', sys.syscall);
            const c = e.cause;
            if (c?.message)
                console.error('[db] cause:', c.message);
            if (attempt === MAX_RETRIES) {
                console.error('[db] All retries exhausted. Exiting.');
                process.exit(1);
            }
            await new Promise(r => setTimeout(r, RETRY_MS));
        }
    }
}
//# sourceMappingURL=db.js.map