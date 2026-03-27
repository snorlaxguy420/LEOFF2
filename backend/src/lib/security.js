import crypto from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(crypto.scrypt);

export function createId(prefix) {
    return `${prefix}_${crypto.randomUUID()}`;
}

export function normalizeEmail(email = "") {
    return String(email || "").trim().toLowerCase();
}

export async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const derivedKey = await scryptAsync(password, salt, 64);

    return {
        salt,
        hash: Buffer.from(derivedKey).toString("hex")
    };
}

export async function verifyPassword(password, passwordHash, passwordSalt) {
    const derivedKey = await scryptAsync(password, passwordSalt, 64);
    const expected = Buffer.from(passwordHash, "hex");
    const received = Buffer.from(derivedKey);

    if (expected.length !== received.length) {
        return false;
    }

    return crypto.timingSafeEqual(expected, received);
}

export function createSessionToken() {
    return crypto.randomBytes(32).toString("base64url");
}

export function hashSessionToken(token) {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}
