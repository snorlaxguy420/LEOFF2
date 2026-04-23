import crypto from "node:crypto";
import { config } from "../config.js";

export function getClientIp(req) {
    const forwardedFor = String(req.headers["x-forwarded-for"] || "")
        .split(",")
        .map(part => part.trim())
        .filter(Boolean);

    if (forwardedFor.length) {
        return forwardedFor[0];
    }

    return (
        req.socket?.remoteAddress ||
        req.connection?.remoteAddress ||
        "unknown"
    );
}

export function hashIdentifier(value) {
    return crypto
        .createHmac("sha256", config.requestIdentityHashSalt)
        .update(String(value || "unknown"))
        .digest("hex");
}

export function getClientIpHash(req) {
    return hashIdentifier(getClientIp(req));
}
