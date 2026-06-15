import CONSTANTS from "./sers2Constants.js";

export function validateSERS2Input(input = {}) {
    const {
        serviceYears,
        retirementAge,
        averageFinalCompensation,
        finalAverageSalary,
        hireDate
    } = input;
    const compensation =
        averageFinalCompensation ?? finalAverageSalary;

    if (
        typeof serviceYears !== "number" ||
        Number.isNaN(serviceYears) ||
        serviceYears < 0
    ) {
        throw new Error("SERS2 requires a valid serviceYears number.");
    }

    if (
        typeof retirementAge !== "number" ||
        Number.isNaN(retirementAge) ||
        retirementAge < CONSTANTS.EARLY_RETIREMENT_MIN_AGE
    ) {
        throw new Error(
            `SERS2 retirementAge must be at least ${CONSTANTS.EARLY_RETIREMENT_MIN_AGE}.`
        );
    }

    if (
        typeof compensation !== "number" ||
        Number.isNaN(compensation) ||
        compensation < 0
    ) {
        throw new Error(
            "SERS2 requires a valid averageFinalCompensation number."
        );
    }

    if (serviceYears < CONSTANTS.VESTING_SERVICE_YEARS) {
        throw new Error(
            `SERS2 requires at least ${CONSTANTS.VESTING_SERVICE_YEARS} years of service to vest.`
        );
    }

    if (hireDate !== undefined && hireDate !== null && hireDate !== "") {
        const normalizedHireDate = new Date(hireDate);

        if (Number.isNaN(normalizedHireDate.getTime())) {
            throw new Error(
                "SERS2 hireDate must be a valid date string when provided."
            );
        }
    }
}
