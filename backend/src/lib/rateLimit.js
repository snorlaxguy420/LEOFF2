import { Pool } from "pg";
import { config } from "../config.js";
import { getClientIp, hashIdentifier } from "./requestIdentity.js";

const memoryRateLimitBuckets = new Map();
let pool = null;
let postgresPruneCounter = 0;

function getWindowStart(now, windowMs) {
    return now - (now % windowMs);
}

function buildBucketKey(scope, identifier, windowStart) {
    return `${scope}:${identifier}:${windowStart}`;
}

function pruneExpiredMemoryBuckets(now) {
    for (const [key, bucket] of memoryRateLimitBuckets.entries()) {
        if (bucket.resetAt <= now) {
            memoryRateLimitBuckets.delete(key);
        }
    }
}

function getSslConfig() {
    if (!config.databaseSsl) {
        return false;
    }

    return {
        rejectUnauthorized: false
    };
}

function getRateLimitBackend() {
    if (config.rateLimitBackend === "memory") {
        return "memory";
    }

    if (config.rateLimitBackend === "postgres") {
        return "postgres";
    }

    return config.dataBackend === "postgres" && config.databaseUrl
        ? "postgres"
        : "memory";
}

function getPool() {
    if (!config.databaseUrl) {
        throw new Error(
            "DATABASE_URL is required when RATE_LIMIT_BACKEND=postgres."
        );
    }

    if (!pool) {
        pool = new Pool({
            connectionString: config.databaseUrl,
            ssl: getSslConfig(),
            max: 2
        });
    }

    return pool;
}

function buildResult({
    count,
    maxRequests,
    resetAt,
    now,
    identifier
}) {
    const remaining = Math.max(0, maxRequests - count);
    const retryAfterSeconds = Math.max(
        1,
        Math.ceil((resetAt - now) / 1000)
    );

    return {
        allowed: count <= maxRequests,
        limit: maxRequests,
        remaining,
        resetAt,
        retryAfterSeconds,
        identifier
    };
}

async function takePostgresRateLimitToken({
    scope,
    identifier,
    maxRequests,
    windowMs,
    now
}) {
    const safeScope = String(scope || "default");
    const identifierHash = hashIdentifier(identifier);
    const windowStart = getWindowStart(now, windowMs);
    const resetAt = windowStart + windowMs;
    const bucketKey = buildBucketKey(safeScope, identifierHash, windowStart);
    const db = getPool();

    postgresPruneCounter += 1;

    if (postgresPruneCounter % 100 === 1) {
        await db.query(
            "DELETE FROM rate_limit_buckets WHERE reset_at <= NOW()"
        );
    }

    const result = await db.query(
        `
            INSERT INTO rate_limit_buckets (
                bucket_key,
                scope,
                identifier_hash,
                window_start,
                reset_at,
                count,
                updated_at
            )
            VALUES ($1,$2,$3,to_timestamp($4 / 1000.0),to_timestamp($5 / 1000.0),1,NOW())
            ON CONFLICT (bucket_key) DO UPDATE SET
                count = rate_limit_buckets.count + 1,
                reset_at = EXCLUDED.reset_at,
                updated_at = NOW()
            RETURNING count
        `,
        [
            bucketKey,
            safeScope,
            identifierHash,
            windowStart,
            resetAt
        ]
    );

    return buildResult({
        count: Number(result.rows[0]?.count || 0),
        maxRequests,
        resetAt,
        now,
        identifier
    });
}

function takeMemoryRateLimitToken({
    scope,
    identifier,
    maxRequests,
    windowMs,
    now
}) {
    const windowStart = getWindowStart(now, windowMs);
    const resetAt = windowStart + windowMs;
    const bucketKey = buildBucketKey(scope, identifier, windowStart);

    pruneExpiredMemoryBuckets(now);

    const bucket = memoryRateLimitBuckets.get(bucketKey) || {
        count: 0,
        resetAt
    };

    bucket.count += 1;
    bucket.resetAt = resetAt;
    memoryRateLimitBuckets.set(bucketKey, bucket);

    return buildResult({
        count: bucket.count,
        maxRequests,
        resetAt,
        now,
        identifier
    });
}

export async function takeRateLimitToken({
    req,
    scope,
    maxRequests,
    windowMs
}) {
    const now = Date.now();
    const safeMaxRequests = Math.max(1, Number(maxRequests) || 1);
    const safeWindowMs = Math.max(1000, Number(windowMs) || 60_000);
    const identifier = getClientIp(req);

    if (getRateLimitBackend() === "postgres") {
        return takePostgresRateLimitToken({
            scope,
            identifier,
            maxRequests: safeMaxRequests,
            windowMs: safeWindowMs,
            now
        });
    }

    return takeMemoryRateLimitToken({
        scope,
        identifier,
        maxRequests: safeMaxRequests,
        windowMs: safeWindowMs,
        now
    });
}

export function applyRateLimitHeaders(res, result) {
    res.setHeader("X-RateLimit-Limit", String(result.limit));
    res.setHeader("X-RateLimit-Remaining", String(result.remaining));
    res.setHeader(
        "X-RateLimit-Reset",
        String(Math.floor(result.resetAt / 1000))
    );

    if (!result.allowed) {
        res.setHeader("Retry-After", String(result.retryAfterSeconds));
    }
}
