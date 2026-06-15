import CONSTANTS from "./wsprs2Constants.js";
import {
    normalizeWSPRS2MemberStatus,
    validateWSPRS2Input
} from "./wsprs2Validation.js";
import { applyWSPRS2EarlyRetirementReduction } from "./wsprs2EarlyRetirement.js";

export function calculateBasePension({
    serviceYears,
    averageFinalSalary
}) {
    const uncappedBenefit =
        serviceYears *
        averageFinalSalary *
        CONSTANTS.BENEFIT_MULTIPLIER;
    const cappedBenefit =
        averageFinalSalary * CONSTANTS.MAX_AFS_PERCENT;

    return Math.min(uncappedBenefit, cappedBenefit);
}

export function calculateEarlyRetirementReduction(
    monthlyBenefit,
    input
) {
    return applyWSPRS2EarlyRetirementReduction(monthlyBenefit, input);
}

export function calculateMonthlyPension(monthlyBenefit) {
    return monthlyBenefit;
}

function calculateWSPRS2Internal(input) {
    validateWSPRS2Input(input);

    const {
        serviceYears,
        retirementAge,
        averageFinalSalary,
        averageFinalCompensation,
        finalAverageSalary,
        memberStatus = "active"
    } = input;
    const compensation =
        averageFinalSalary ??
        averageFinalCompensation ??
        finalAverageSalary;
    const normalizedMemberStatus =
        normalizeWSPRS2MemberStatus(memberStatus);

    const baseMonthlyBenefit =
        calculateBasePension({
            serviceYears,
            averageFinalSalary: compensation
        });

    const earlyAdjusted =
        calculateEarlyRetirementReduction(
            baseMonthlyBenefit,
            {
                retirementAge,
                serviceYears,
                memberStatus: normalizedMemberStatus
            }
        );

    const monthlyBenefit =
        calculateMonthlyPension(
            earlyAdjusted.monthlyBenefit
        );

    return Object.freeze({
        monthlyBenefit,
        annualBenefit: monthlyBenefit * 12,
        startAge: retirementAge,
        earlyRetirementFactor:
            earlyAdjusted.earlyRetirementFactor,
        metadata: Object.freeze({
            system: "WSPRS2",
            version: "1.0.0",
            memberStatus: normalizedMemberStatus,
            source: "Washington DRS WSPRS Plan 2",
            sourceUrl: "https://www.drs.wa.gov/plan/wsprs2/"
        })
    });
}

export const calculateWSPRS2 =
    Object.freeze(calculateWSPRS2Internal);
