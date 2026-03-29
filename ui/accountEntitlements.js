function normalizePlanTier(value) {
    return String(value || "").toLowerCase() === "premium"
        ? "premium"
        : "free";
}

function normalizeIsoDate(value) {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
        ? null
        : parsed.toISOString();
}

export function normalizeEntitlements(raw = {}) {
    const requestedPlanTier = normalizePlanTier(raw?.planTier);
    const premiumExpiresAt = normalizeIsoDate(raw?.premiumExpiresAt);
    const premium =
        Boolean(raw?.premium) &&
        requestedPlanTier === "premium" &&
        (
            !premiumExpiresAt ||
            new Date(premiumExpiresAt).getTime() > Date.now()
        );
    const features = {
        monteCarloPlus: premium && Boolean(raw?.features?.monteCarloPlus)
    };

    return {
        planTier: premium
            ? "premium"
            : "free",
        premium,
        premiumSource:
            premium
                ? String(raw?.premiumSource || "").trim().toLowerCase() || null
                : null,
        premiumExpiresAt:
            premium
                ? premiumExpiresAt
                : null,
        features
    };
}

export function normalizeAccountContext(payload = {}) {
    return {
        user: payload?.user || null,
        session: payload?.session || null,
        entitlements: normalizeEntitlements(payload?.entitlements)
    };
}

export function hasPremiumAccess(subject, feature = "premium") {
    const entitlements = normalizeEntitlements(
        subject?.entitlements || subject
    );

    if (feature === "premium") {
        return entitlements.premium;
    }

    return Boolean(entitlements.features?.[feature]);
}

export function getPlanTierLabel(subject) {
    const entitlements = normalizeEntitlements(
        subject?.entitlements || subject
    );

    return entitlements.planTier === "premium"
        ? "Premium"
        : "Free";
}
