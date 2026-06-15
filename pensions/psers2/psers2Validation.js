import CONSTANTS from "./psers2Constants.js";

export function validatePSERS2Input(input = {}) {
    const {
        serviceYears,
        retirementAge,
        averageFinalCompensation,
        finalAverageSalary
    } = input;
    const compensation =
        averageFinalCompensation ?? finalAverageSalary;

    if (
        typeof serviceYears !== "number" ||
        Number.isNaN(serviceYears) ||
        serviceYears < 0
    ) {
        throw new Error("PSERS2 requires a valid serviceYears number.");
    }

    if (
        typeof retirementAge !== "number" ||
        Number.isNaN(retirementAge)
    ) {
        throw new Error("PSERS2 requires a valid retirementAge number.");
    }

    if (
        typeof compensation !== "number" ||
        Number.isNaN(compensation) ||
        compensation < 0
    ) {
        throw new Error(
            "PSERS2 requires a valid averageFinalCompensation number."
        );
    }

    if (serviceYears < CONSTANTS.VESTING_SERVICE_YEARS) {
        throw new Error(
            `PSERS2 requires at least ${CONSTANTS.VESTING_SERVICE_YEARS} years of service to vest.`
        );
    }

    const hasFullAge65Eligibility =
        retirementAge >= CONSTANTS.FULL_RETIREMENT_AGE;
    const hasAge60Eligibility =
        retirementAge >= CONSTANTS.AGE_60_FULL_RETIREMENT_AGE &&
        serviceYears >= CONSTANTS.AGE_60_FULL_SERVICE_YEARS;
    const hasEarlyEligibility =
        retirementAge >= CONSTANTS.EARLY_RETIREMENT_MIN_AGE &&
        serviceYears >= CONSTANTS.EARLY_RETIREMENT_MIN_SERVICE_YEARS;

    if (
        !hasFullAge65Eligibility &&
        !hasAge60Eligibility &&
        !hasEarlyEligibility
    ) {
        throw new Error(
            "PSERS2 retirement requires age 65 with 5 years, age 60 with 10 years, or age 53+ with 20 years."
        );
    }
}
