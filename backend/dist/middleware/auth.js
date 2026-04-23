"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = requireAdmin;
exports.requireBotKey = requireBotKey;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
function timingSafeEqualStr(a, b) {
    const ab = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ab.length !== bb.length)
        return false;
    return crypto_1.default.timingSafeEqual(ab, bb);
}
function requireAdmin(req, res, next) {
    const token = req.cookies?.admin_token;
    if (!token) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        if (payload.role !== 'admin')
            throw new Error('role');
    }
    catch {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }
    if (!SAFE_METHODS.has(req.method)) {
        const cookieCsrf = req.cookies?.csrf_token;
        const headerCsrf = req.headers['x-csrf-token'];
        const header = Array.isArray(headerCsrf) ? headerCsrf[0] : headerCsrf;
        if (!cookieCsrf || !header || !timingSafeEqualStr(cookieCsrf, String(header))) {
            res.status(403).json({ error: 'CSRF check failed' });
            return;
        }
    }
    req.adminId = 'admin';
    next();
}
function parseAllowedIps() {
    return (env_1.env.BOT_ALLOWED_IPS ?? '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
}
const ALLOWED_BOT_IPS = parseAllowedIps();
const BOT_KEY_BUF = Buffer.from(env_1.env.BOT_API_KEY, 'utf8');
function requireBotKey(req, res, next) {
    const raw = req.headers['x-bot-key'];
    const key = Array.isArray(raw) ? raw[0] : raw;
    if (typeof key !== 'string') {
        res.status(403).json({ error: 'Invalid bot key' });
        return;
    }
    const keyBuf = Buffer.from(key, 'utf8');
    if (keyBuf.length !== BOT_KEY_BUF.length || !crypto_1.default.timingSafeEqual(keyBuf, BOT_KEY_BUF)) {
        res.status(403).json({ error: 'Invalid bot key' });
        return;
    }
    if (ALLOWED_BOT_IPS.length > 0) {
        const ip = req.ip ?? '';
        if (!ALLOWED_BOT_IPS.includes(ip)) {
            res.status(403).json({ error: 'IP not allowed' });
            return;
        }
    }
    next();
}
//# sourceMappingURL=auth.js.map