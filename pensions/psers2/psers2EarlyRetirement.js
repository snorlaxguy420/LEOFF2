import CONSTANTS from "./psers2Constants.js";

function getWholeYearRetirementAge(retirementAge) {
    return Math.floor(retirementAge);
}

export function getPSERS2EarlyRetirementFactor({
    retirementAge,
    serviceYears
}) {
    if (
        retirementAge >= CONSTANTS.FULL_RETIREMENT_AGE ||
        (
            retirementAge >= CONSTANTS.AGE_60_FULL_RETIREMENT_AGE &&
            serviceYears >= CONSTANTS.AGE_60_FULL_SERVICE_YEARS
        )
    ) {
        return 1;
    }

    if (
        serviceYears < CONSTANTS.EARLY_RETIREMENT_MIN_SERVICE_YEARS ||
        retirementAge < CONSTANTS.EARLY_RETIREMENT_MIN_AGE
    ) {
        throw new Error(
            "PSERS2 early retirement requires age 53+ and at least 20 years of service."
        );
    }

    const ageKey = Math.min(
        CONSTANTS.AGE_60_FULL_RETIREMENT_AGE,
        getWholeYearRetirementAge(retirementAge)
    );

    return CONSTANTS.EARLY_RETIREMENT_FACTORS[ageKey] ?? 0;
}

export function applyPSERS2EarlyRetirementReduction(
    monthlyBenefit,
    {
        retirementAge,
        serviceYears
    }
) {
    const earlyRetirementFactor = getPSERS2EarlyRetirementFactor({
        retirementAge,
        serviceYears
    });

    return {
        monthlyBenefit: monthlyBenefit * earlyRetirementFactor,
        earlyRetirementFactor
    };
}
