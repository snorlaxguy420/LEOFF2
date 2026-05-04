const BETA_PREMIUM_FEATURES_UNLOCKED = true;
const POTENTIAL_PREMIUM_FEATURE_LABEL = "Potential Premium Feature";

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

function resolveFeatureFlag(rawFeatures, key, premiumActive) {
    if (!premiumActive) {
        return false;
    }

    if (
        rawFeatures &&
        Object.prototype.hasOwnProperty.call(rawFeatures, key)
    ) {
        return Boolean(rawFeatures[key]);
    }

    return true;
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
    const rawFeatures =
        raw?.features && typeof raw.features === "object"
            ? raw.features
            : {};
    const features = {
        monteCarloPlus:
            resolveFeatureFlag(rawFeatures, "monteCarloPlus", premium),
        readinessTimeline:
            resolveFeatureFlag(rawFeatures, "readinessTimeline", premium),
        withdrawalStrategyOptimizer:
            resolveFeatureFlag(rawFeatures, "withdrawalStrategyOptimizer", premium),
        socialSecurityOptimizer:
            resolveFeatureFlag(rawFeatures, "socialSecurityOptimizer", premium),
        survivorOptionOptimizer:
            resolveFeatureFlag(rawFeatures, "survivorOptionOptimizer", premium),
        estateProjection:
            resolveFeatureFlag(rawFeatures, "estateProjection", premium),
        taxDetailViews:
            resolveFeatureFlag(rawFeatures, "taxDetailViews", premium),
        premiumScenarioComparison:
            resolveFeatureFlag(rawFeatures, "premiumScenarioComparison", premium),
        premiumStressTesting:
            resolveFeatureFlag(rawFeatures, "premiumStressTesting", premium)
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

    if (BETA_PREMIUM_FEATURES_UNLOCKED && feature !== "premium") {
        return true;
    }

    if (feature === "premium") {
        return entitlements.premium;
    }

    return Boolean(entitlements.features?.[feature]);
}

export function isBetaPremiumFeatureUnlockEnabled() {
    return BETA_PREMIUM_FEATURES_UNLOCKED;
}

export function getPotentialPremiumFeatureLabel() {
    return POTENTIAL_PREMIUM_FEATURE_LABEL;
}

export function getPlanTierLabel(subject) {
    const entitlements = normalizeEntitlements(
        subject?.entitlements || subject
    );

    return entitlements.planTier === "premium"
        ? "Premium"
        : "Free";
}
