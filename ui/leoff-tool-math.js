export function deriveCurrentAgeFromBirthYear(birthYear) {
    const currentYear = new Date().getFullYear();

    if (!birthYear || birthYear < 1900 || birthYear > currentYear) {
        return 0;
    }

    return currentYear - birthYear;
}

export function deriveServiceYearsForRetirement({
    birthYear,
    retirementAge,
    leoffStartYear
}) {
    const retirementYear = birthYear + retirementAge;

    if (!leoffStartYear || !birthYear || retirementYear <= leoffStartYear) {
        return 0;
    }

    return retirementYear - leoffStartYear;
}

export function calculateLifetimePensionValue(
    annualPension,
    colaRate,
    retirementAge,
    targetAge
) {
    const years = Math.max(
        0,
        Math.round((targetAge || retirementAge) - retirementAge)
    );

    if (years === 0 || annualPension <= 0) {
        return 0;
    }

    if (!colaRate) {
        return annualPension * years;
    }

    return annualPension * (
        (Math.pow(1 + colaRate, years) - 1) / colaRate
    );
}
