function normalizeFiniteNumber(value) {
    const numericValue =
        typeof value === "number"
            ? value
            : Number(value);

    return Number.isFinite(numericValue)
        ? numericValue
        : null;
}

function normalizeRate(value, {
    min = null,
    max = null
} = {}) {
    const numericValue = normalizeFiniteNumber(value);

    if (numericValue === null) {
        return null;
    }

    if (min !== null && numericValue < min) {
        return min;
    }

    if (max !== null && numericValue > max) {
        return max;
    }

    return numericValue;
}

function normalizePositiveInteger(value, fallback = 0, max = 10) {
    const numericValue =
        typeof value === "number"
            ? value
            : Number(value);

    if (!Number.isFinite(numericValue)) {
        return fallback;
    }

    return Math.min(
        Math.max(0, Math.round(numericValue)),
        max
    );
}

export const DEFAULT_PREMIUM_STRESS_TESTING = Object.freeze({
    enabled: false,
    goodsServicesInflationTargetRate: null,
    housingInflationTargetRate: null,
    healthcareInflationTargetRate: null,
    portfolioDownsideFloorRate: null,
    earlyRetirementShockYears: 0,
    earlyRetirementShockRate: null
});

export function normalizePremiumStressTesting(settings = {}) {
    const nextSettings = settings || {};

    return {
        enabled: Boolean(nextSettings.enabled),
        goodsServicesInflationTargetRate: normalizeRate(
            nextSettings.goodsServicesInflationTargetRate,
            { min: 0, max: 0.15 }
        ),
        housingInflationTargetRate: normalizeRate(
            nextSettings.housingInflationTargetRate,
            { min: 0, max: 0.15 }
        ),
        healthcareInflationTargetRate: normalizeRate(
            nextSettings.healthcareInflationTargetRate,
            { min: 0, max: 0.2 }
        ),
        portfolioDownsideFloorRate: normalizeRate(
            nextSettings.portfolioDownsideFloorRate,
            { min: -0.6, max: 0 }
        ),
        earlyRetirementShockYears: normalizePositiveInteger(
            nextSettings.earlyRetirementShockYears,
            0,
            10
        ),
        earlyRetirementShockRate: normalizeRate(
            nextSettings.earlyRetirementShockRate,
            { min: -0.6, max: 0 }
        )
    };
}

export function buildPremiumStressTestMonteCarloConfig({
    premiumStressTesting = {},
    baseAssumptions = {}
} = {}) {
    const settings =
        normalizePremiumStressTesting(premiumStressTesting);

    if (!settings.enabled) {
        return null;
    }

    const overallBaseRate =
        baseAssumptions?.goodsServicesInflationRate ??
        baseAssumptions?.inflationRate ??
        0.03;
    const housingBaseRate =
        baseAssumptions?.housingInflationRate ??
        overallBaseRate;
    const healthcareBaseRate =
        baseAssumptions?.healthcareInflationRate ??
        overallBaseRate;
    const config = {};

    if (settings.goodsServicesInflationTargetRate !== null) {
        config.inflation = {
            mean:
                settings.goodsServicesInflationTargetRate -
                overallBaseRate
        };
        config.goodsServicesInflation = {
            mean:
                settings.goodsServicesInflationTargetRate -
                overallBaseRate
        };
    }

    if (settings.housingInflationTargetRate !== null) {
        config.housingInflation = {
            mean:
                settings.housingInflationTargetRate -
                housingBaseRate
        };
    }

    if (settings.healthcareInflationTargetRate !== null) {
        config.healthcareInflation = {
            mean:
                settings.healthcareInflationTargetRate -
                healthcareBaseRate
        };
    }

    if (settings.portfolioDownsideFloorRate !== null) {
        config.portfolioReturn = {
            min: settings.portfolioDownsideFloorRate
        };
    }

    if (
        settings.earlyRetirementShockYears > 0 &&
        settings.earlyRetirementShockRate !== null
    ) {
        config.stressAdjustments = {
            earlyRetirementShockYears:
                settings.earlyRetirementShockYears,
            earlyRetirementShockRate:
                settings.earlyRetirementShockRate
        };
    }

    return Object.keys(config).length
        ? config
        : null;
}
