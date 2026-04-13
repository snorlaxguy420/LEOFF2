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
    preset: "custom",
    goodsServicesInflationTargetRate: null,
    housingInflationTargetRate: null,
    healthcareInflationTargetRate: null,
    portfolioDownsideFloorRate: null,
    earlyRetirementShockYears: 0,
    earlyRetirementShockRate: null
});

export const PREMIUM_STRESS_PRESETS = Object.freeze({
    custom: {
        label: "Custom"
    },
    early_recession: {
        label: "Early Retirement Recession",
        goodsServicesInflationTargetRate: 0.045,
        housingInflationTargetRate: 0.04,
        healthcareInflationTargetRate: 0.075,
        portfolioDownsideFloorRate: -0.32,
        earlyRetirementShockYears: 3,
        earlyRetirementShockRate: -0.18
    },
    sticky_inflation: {
        label: "Sticky Inflation Decade",
        goodsServicesInflationTargetRate: 0.055,
        housingInflationTargetRate: 0.06,
        healthcareInflationTargetRate: 0.085,
        portfolioDownsideFloorRate: -0.22,
        earlyRetirementShockYears: 2,
        earlyRetirementShockRate: -0.08
    },
    weak_first_decade: {
        label: "Weak First 10 Years",
        goodsServicesInflationTargetRate: 0.042,
        housingInflationTargetRate: 0.04,
        healthcareInflationTargetRate: 0.072,
        portfolioDownsideFloorRate: -0.26,
        earlyRetirementShockYears: 5,
        earlyRetirementShockRate: -0.10
    },
    healthcare_shock: {
        label: "Healthcare Cost Shock",
        goodsServicesInflationTargetRate: 0.04,
        housingInflationTargetRate: 0.038,
        healthcareInflationTargetRate: 0.11,
        portfolioDownsideFloorRate: -0.24,
        earlyRetirementShockYears: 2,
        earlyRetirementShockRate: -0.09
    }
});

function normalizePremiumStressPreset(value) {
    const normalized = String(value || "").trim().toLowerCase();

    return PREMIUM_STRESS_PRESETS[normalized]
        ? normalized
        : "custom";
}

export function getPremiumStressPresetLabel(value) {
    const presetKey = normalizePremiumStressPreset(value);
    return PREMIUM_STRESS_PRESETS[presetKey]?.label || "Custom";
}

export function normalizePremiumStressTesting(settings = {}) {
    const nextSettings = settings || {};
    const preset = normalizePremiumStressPreset(nextSettings.preset);

    return {
        enabled: Boolean(nextSettings.enabled),
        preset,
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

export function applyPremiumStressPreset(settings = {}, preset = "custom") {
    const presetKey = normalizePremiumStressPreset(preset);
    const presetDefinition = PREMIUM_STRESS_PRESETS[presetKey] || PREMIUM_STRESS_PRESETS.custom;

    return normalizePremiumStressTesting({
        ...settings,
        ...presetDefinition,
        preset: presetKey
    });
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
