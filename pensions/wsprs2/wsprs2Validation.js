import CONSTANTS from "./wsprs2Constants.js";

export function normalizeWSPRS2MemberStatus(memberStatus) {
    return memberStatus === "inactive" ? "inactive" : "active";
}

export function validateWSPRS2Input(input = {}) {
    const {
        serviceYears,
        retirementAge,
        averageFinalSalary,
        averageFinalCompensation,
        finalAverageSalary,
        memberStatus
    } = input;
    const compensation =
        averageFinalSalary ??
        averageFinalCompensation ??
        finalAverageSalary;
    const normalizedMemberStatus =
        normalizeWSPRS2MemberStatus(memberStatus);

    if (
        typeof serviceYears !== "number" ||
        Number.isNaN(serviceYears) ||
        serviceYears < 0
    ) {
        throw new Error("WSPRS2 requires a valid serviceYears number.");
    }

    if (
        typeof retirementAge !== "number" ||
        Number.isNaN(retirementAge)
    ) {
        throw new Error("WSPRS2 requires a valid retirementAge number.");
    }

    if (
        typeof compensation !== "number" ||
        Number.isNaN(compensation) ||
        compensation < 0
    ) {
        throw new Error(
            "WSPRS2 requires a valid averageFinalSalary number."
        );
    }

    if (normalizedMemberStatus === "inactive") {
        if (serviceYears < CONSTANTS.INACTIVE_VESTING_SERVICE_YEARS) {
            throw new Error(
                `WSPRS2 inactive retirement requires at least ${CONSTANTS.INACTIVE_VESTING_SERVICE_YEARS} years of service.`
            );
        }

        if (retirementAge < CONSTANTS.INACTIVE_EARLY_RETIREMENT_MIN_AGE) {
            throw new Error(
                `WSPRS2 inactive retirementAge must be at least ${CONSTANTS.INACTIVE_EARLY_RETIREMENT_MIN_AGE}.`
            );
        }

        return;
    }

    if (
        retirementAge < CONSTANTS.ACTIVE_FULL_RETIREMENT_AGE &&
        serviceYears < CONSTANTS.ACTIVE_FULL_SERVICE_YEARS_ANY_AGE
    ) {
        throw new Error(
            "WSPRS2 active retirement requires age 55+ or at least 25 years of service."
        );
    }
}
