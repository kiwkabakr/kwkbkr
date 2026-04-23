"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const db_1 = require("./config/db");
const env_1 = require("./config/env");
const admin_1 = require("./routes/admin");
const public_1 = require("./routes/public");
const bot_1 = require("./routes/bot");
const rewards_1 = require("./routes/rewards");
const depositMonitor_1 = require("./jobs/depositMonitor");
const defaultCategories_1 = require("./seed/defaultCategories");
const telegramNotifier_1 = require("./services/telegramNotifier");
const models_1 = require("./models");
const app = (0, express_1.default)();
// Trust the first proxy hop (nginx / cloud LB) so rate-limit sees real client IPs.
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.set('etag', false);
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
            connectSrc: ["'self'", env_1.env.FRONTEND_URL],
            fontSrc: ["'self'", 'data:'],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: env_1.isProd ? [] : null,
        },
    },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: env_1.isProd ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
}));
app.use((0, compression_1.default)());
app.use((0, cookie_parser_1.default)());
app.use((0, cors_1.default)({
    origin: env_1.env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Bot-Key', 'Authorization'],
}));
app.use(express_1.default.json({ limit: '100kb' }));
app.use((0, express_rate_limit_1.default)({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
}));
// Never cache authenticated / state-changing surfaces.
app.use(['/api/admin', '/api/bot', '/api/rewards'], (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});
app.use('/api/admin', admin_1.adminRoutes);
app.use('/api/bets', public_1.publicRoutes);
app.use('/api/bot', bot_1.botRoutes);
app.use('/api/rewards', rewards_1.rewardsRoutes);
app.get('/api/health', (_req, res) => res.json({ ok: true }));
// Sanitising error handler — never leak stack traces or Mongo internals to clients.
app.use((err, _req, res, _next) => {
    const e = err;
    const status = e?.status ?? e?.statusCode ?? 500;
    console.error('[error]', e?.message ?? e, env_1.isProd ? '' : e?.stack ?? '');
    res.status(status).json({ error: env_1.isProd ? 'Internal error' : (e?.message ?? 'Internal error') });
});
async function main() {
    await (0, db_1.connectDB)();
    await (0, defaultCategories_1.seedDefaultCategories)();
    app.listen(Number(env_1.env.PORT), () => {
        console.log(`[server] Running on port ${env_1.env.PORT}`);
    });
    (0, depositMonitor_1.startDepositMonitor)();
    console.log((0, telegramNotifier_1.telegramNotifierAvailable)()
        ? '[telegram] Live notifications enabled'
        : '[telegram] TELEGRAM_BOT_TOKEN missing — live notifications disabled');
    (0, models_1.migratePlaintextSecrets)()
        .then(r => {
        if (r.migrated > 0)
            console.log(`[startup] Hashed plaintext secrets for ${r.migrated} user(s)`);
    })
        .catch(err => console.error('[startup] Secret migration failed:', err));
    (0, admin_1.backfillLegacyDepositsPln)()
        .then(r => {
        if (r.fixed > 0)
            console.log(`[startup] Backfilled PLN for ${r.fixed} legacy deposit(s)`);
        if (r.errors.length > 0)
            console.warn('[startup] Backfill errors:', r.errors);
    })
        .catch(err => console.error('[startup] Backfill failed:', err));
}
main().catch(console.error);
//# sourceMappingURL=index.js.map