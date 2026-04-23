"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProd = exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const schema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PORT: zod_1.z.string().default('3000'),
    MONGO_URI: zod_1.z.string().min(1),
    JWT_SECRET: zod_1.z.string().min(32),
    ADMIN_PASSWORD_HASH: zod_1.z.string().min(1),
    BOT_API_KEY: zod_1.z.string().min(16),
    BOT_ALLOWED_IPS: zod_1.z.string().optional(),
    TELEGRAM_BOT_TOKEN: zod_1.z.string().optional(),
    FRONTEND_URL: zod_1.z.string().default('http://localhost:5173'),
    MASTER_MNEMONIC: zod_1.z.string().optional(),
    ALCHEMY_API_KEY: zod_1.z.string().optional(),
    SOLANA_RPC_URL: zod_1.z.string().default('https://api.mainnet-beta.solana.com'),
    CLOUDINARY_UPLOAD_PRESET: zod_1.z.string().optional(),
    CLOUDINARY_UPLOAD_URL: zod_1.z.string().optional(),
});
exports.env = schema.parse(process.env);
exports.isProd = exports.env.NODE_ENV === 'production';
//# sourceMappingURL=env.js.map