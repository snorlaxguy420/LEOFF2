const rateLimitBuckets = new Map();

function getWindowStart(now, windowMs) {
    return now - (now % windowMs);
}

function buildBucketKey(scope, identifier, windowStart) {
    return `${scope}:${identifier}:${windowStart}`;
}

function pruneExpiredBuckets(now) {
    for (const [key, bucket] of rateLimitBuckets.entries()) {
        if (bucket.resetAt <= now) {
            rateLimitBuckets.delete(key);
        }
    }
}

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

export function takeRateLimitToken({
    req,
    scope,
    maxRequests,
    windowMs
}) {
    const now = Date.now();
    const safeMaxRequests = Math.max(1, Number(maxRequests) || 1);
    const safeWindowMs = Math.max(1000, Number(windowMs) || 60_000);
    const windowStart = getWindowStart(now, safeWindowMs);
    const resetAt = windowStart + safeWindowMs;
    const identifier = getClientIp(req);
    const bucketKey = buildBucketKey(scope, identifier, windowStart);

    pruneExpiredBuckets(now);

    const bucket = rateLimitBuckets.get(bucketKey) || {
        count: 0,
        resetAt
    };

    bucket.count += 1;
    bucket.resetAt = resetAt;
    rateLimitBuckets.set(bucketKey, bucket);

    const remaining = Math.max(0, safeMaxRequests - bucket.count);
    const retryAfterSeconds = Math.max(
        1,
        Math.ceil((resetAt - now) / 1000)
    );

    return {
        allowed: bucket.count <= safeMaxRequests,
        limit: safeMaxRequests,
        remaining,
        resetAt,
        retryAfterSeconds,
        identifier
    };
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
