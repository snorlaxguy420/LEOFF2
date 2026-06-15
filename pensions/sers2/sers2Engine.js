import CONSTANTS from "./sers2Constants.js";
import { validateSERS2Input } from "./sers2Validation.js";
import { applySERS2EarlyRetirementReduction } from "./sers2EarlyRetirement.js";

export function calculateBasePension({
    serviceYears,
    averageFinalCompensation
}) {
    return (
        serviceYears *
        averageFinalCompensation *
        CONSTANTS.BENEFIT_MULTIPLIER
    );
}

export function calculateEarlyRetirementReduction(
    monthlyBenefit,
    input
) {
    return applySERS2EarlyRetirementReduction(monthlyBenefit, input);
}

export function calculateMonthlyPension(monthlyBenefit) {
    return monthlyBenefit;
}

function calculateSERS2Internal(input) {
    validateSERS2Input(input);

    const {
        serviceYears,
        retirementAge,
        averageFinalCompensation,
        finalAverageSalary,
        hireDate = null
    } = input;
    const compensation =
        averageFinalCompensation ?? finalAverageSalary;

    const baseMonthlyBenefit =
        calculateBasePension({
            serviceYears,
            averageFinalCompensation: compensation
        });

    const earlyAdjusted =
        calculateEarlyRetirementReduction(
            baseMonthlyBenefit,
            {
                retirementAge,
                serviceYears,
                hireDate
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
            system: "SERS2",
            version: "1.0.0",
            source: "Washington DRS SERS Plan 2",
            sourceUrl: "https://www.drs.wa.gov/plan/sers2/"
        })
    });
}

export const calculateSERS2 =
    Object.freeze(calculateSERS2Internal);
