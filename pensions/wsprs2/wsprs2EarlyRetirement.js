import CONSTANTS from "./wsprs2Constants.js";
import { normalizeWSPRS2MemberStatus } from "./wsprs2Validation.js";

function getWholeYearRetirementAge(retirementAge) {
    return Math.floor(retirementAge);
}

export function getWSPRS2EarlyRetirementFactor({
    retirementAge,
    serviceYears,
    memberStatus
}) {
    const normalizedMemberStatus =
        normalizeWSPRS2MemberStatus(memberStatus);

    if (normalizedMemberStatus === "active") {
        if (
            retirementAge >= CONSTANTS.ACTIVE_FULL_RETIREMENT_AGE ||
            serviceYears >= CONSTANTS.ACTIVE_FULL_SERVICE_YEARS_ANY_AGE
        ) {
            return 1;
        }
    }

    if (retirementAge >= CONSTANTS.INACTIVE_FULL_RETIREMENT_AGE) {
        return 1;
    }

    const ageKey = getWholeYearRetirementAge(retirementAge);

    return CONSTANTS.INACTIVE_EARLY_RETIREMENT_FACTORS[ageKey] ?? 0;
}

export function applyWSPRS2EarlyRetirementReduction(
    monthlyBenefit,
    {
        retirementAge,
        serviceYears,
        memberStatus
    }
) {
    const earlyRetirementFactor = getWSPRS2EarlyRetirementFactor({
        retirementAge,
        serviceYears,
        memberStatus
    });

    return {
        monthlyBenefit: monthlyBenefit * earlyRetirementFactor,
        earlyRetirementFactor
    };
}
