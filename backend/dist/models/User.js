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
exports.User = void 0;
exports.generatePasskey = generatePasskey;
exports.generateVerificationCode = generateVerificationCode;
exports.migratePlaintextSecrets = migratePlaintextSecrets;
const mongoose_1 = __importStar(require("mongoose"));
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const BCRYPT_COST = 10;
function generatePasskey() {
    const d = Array.from({ length: 9 }, () => crypto_1.default.randomInt(10)).join('');
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}
function generateVerificationCode() {
    return Array.from({ length: 6 }, () => crypto_1.default.randomInt(10)).join('');
}
const userSchema = new mongoose_1.Schema({
    telegramId: { type: String, required: true, unique: true, index: true },
    username: { type: String, default: '' },
    firstName: { type: String, default: '' },
    passkey: { type: String, default: null, select: false },
    passkeyHash: { type: String, default: null, select: false },
    passkeyShown: { type: Boolean, default: false },
    verificationCode: { type: String, default: null, select: false },
    verificationCodeHash: { type: String, default: null, select: false },
    verificationCodeShown: { type: Boolean, default: false },
    balance: { type: Number, default: 0, min: 0 },
    redeemedCodes: { type: [String], default: [] },
}, { timestamps: true });
userSchema.pre('save', async function hashSecretsIfPlain() {
    const doc = this;
    if (doc.passkey && !doc.passkeyHash) {
        doc.passkeyHash = await bcryptjs_1.default.hash(doc.passkey, BCRYPT_COST);
    }
    if (doc.passkey)
        doc.passkey = null;
    if (doc.verificationCode && !doc.verificationCodeHash) {
        doc.verificationCodeHash = await bcryptjs_1.default.hash(doc.verificationCode, BCRYPT_COST);
    }
    if (doc.verificationCode)
        doc.verificationCode = null;
});
userSchema.methods.compareVerificationCode = async function (code) {
    if (!this.verificationCodeHash)
        return false;
    return bcryptjs_1.default.compare(String(code), this.verificationCodeHash);
};
exports.User = mongoose_1.default.model('User', userSchema);
/**
 * Idempotent. Hashes any leftover plaintext passkey / verificationCode values
 * from legacy rows into the matching *Hash fields and clears the plaintext.
 */
async function migratePlaintextSecrets() {
    const cursor = exports.User.find({
        $or: [
            { passkey: { $type: 'string', $ne: null } },
            { verificationCode: { $type: 'string', $ne: null } },
        ],
    })
        .select('+passkey +passkeyHash +verificationCode +verificationCodeHash')
        .cursor();
    let migrated = 0;
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        let changed = false;
        if (doc.passkey && !doc.passkeyHash) {
            doc.passkeyHash = await bcryptjs_1.default.hash(doc.passkey, BCRYPT_COST);
            changed = true;
        }
        if (doc.passkey) {
            doc.passkey = null;
            changed = true;
        }
        if (doc.verificationCode && !doc.verificationCodeHash) {
            doc.verificationCodeHash = await bcryptjs_1.default.hash(doc.verificationCode, BCRYPT_COST);
            changed = true;
        }
        if (doc.verificationCode) {
            doc.verificationCode = null;
            changed = true;
        }
        if (changed) {
            await doc.save();
            migrated += 1;
        }
    }
    return { migrated };
}
//# sourceMappingURL=User.js.map