import { Buffer } from "node:buffer";

export function sendJson(res, statusCode, payload) {
    const body = JSON.stringify(payload);

    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Length", Buffer.byteLength(body));
    res.end(body);
}

export function sendError(res, statusCode, message, details = null) {
    sendJson(res, statusCode, {
        error: message,
        ...(details ? { details } : {})
    });
}

export function sendNoContent(res) {
    res.statusCode = 204;
    res.end();
}

export async function readJsonBody(req) {
    const chunks = [];

    for await (const chunk of req) {
        chunks.push(chunk);
    }

    const rawBody = Buffer.concat(chunks).toString("utf8").trim();

    if (!rawBody) {
        return {};
    }

    return JSON.parse(rawBody);
}

export function parseCookies(req) {
    const rawCookie = req.headers.cookie || "";

    return rawCookie
        .split(";")
        .map(part => part.trim())
        .filter(Boolean)
        .reduce((cookies, pair) => {
            const separatorIndex = pair.indexOf("=");

            if (separatorIndex === -1) {
                return cookies;
            }

            const key = pair.slice(0, separatorIndex).trim();
            const value = pair.slice(separatorIndex + 1).trim();

            cookies[key] = decodeURIComponent(value);
            return cookies;
        }, {});
}

export function buildCookie(name, value, options = {}) {
    const parts = [
        `${name}=${encodeURIComponent(value)}`
    ];

    if (options.httpOnly !== false) {
        parts.push("HttpOnly");
    }

    if (options.path) {
        parts.push(`Path=${options.path}`);
    }

    if (options.sameSite) {
        parts.push(`SameSite=${options.sameSite}`);
    }

    if (options.maxAge !== undefined) {
        parts.push(`Max-Age=${options.maxAge}`);
    }

    if (options.secure) {
        parts.push("Secure");
    }

    return parts.join("; ");
}

export function applyCors(req, res, corsOrigins = []) {
    const origin = req.headers.origin;

    if (origin && corsOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
}
