import CONSTANTS from "./pers2Constants.js";

function getWholeYearRetirementAge(retirementAge) {
    return Math.floor(retirementAge);
}

function isPost2013Hire(hireDate) {
    if (!hireDate) return false;

    return new Date(hireDate) >= new Date(CONSTANTS.POST_2013_HIRE_DATE);
}

function getThirtyPlusErf({
    retirementAge,
    hireDate
}) {
    const ageKey = getWholeYearRetirementAge(retirementAge);

    if (isPost2013Hire(hireDate)) {
        return CONSTANTS.THIRTY_PLUS_POST_2013_ERF[ageKey] ?? 0;
    }

    return CONSTANTS.THIRTY_PLUS_PRE_2013_ERF[ageKey] ?? 0;
}

export function getPERS2EarlyRetirementFactor({
    retirementAge,
    serviceYears,
    hireDate
}) {

    if (retirementAge >= CONSTANTS.FULL_RETIREMENT_AGE) {
        return 1;
    }

    if (
        serviceYears >= CONSTANTS.THIRTY_YEAR_SERVICE_THRESHOLD &&
        retirementAge >= CONSTANTS.THIRTY_YEAR_FULL_RETIREMENT_AGE &&
        !isPost2013Hire(hireDate)
    ) {
        return 1;
    }

    if (
        serviceYears < CONSTANTS.EARLY_RETIREMENT_MIN_SERVICE_YEARS ||
        retirementAge < CONSTANTS.EARLY_RETIREMENT_MIN_AGE
    ) {
        throw new Error(
            "PERS2 early retirement requires age 55+ and at least 20 years of service."
        );
    }

    if (serviceYears >= CONSTANTS.THIRTY_YEAR_SERVICE_THRESHOLD) {
        return getThirtyPlusErf({
            retirementAge,
            hireDate
        });
    }

    const ageKey = getWholeYearRetirementAge(retirementAge);

    return CONSTANTS.LESS_THAN_30_ERF[ageKey] ?? 0;
}

export function applyPERS2EarlyRetirementReduction(
    monthlyBenefit,
    {
        retirementAge,
        serviceYears,
        hireDate
    }
) {
    const earlyRetirementFactor = getPERS2EarlyRetirementFactor({
        retirementAge,
        serviceYears,
        hireDate
    });

    return {
        monthlyBenefit: monthlyBenefit * earlyRetirementFactor,
        earlyRetirementFactor
    };
}
