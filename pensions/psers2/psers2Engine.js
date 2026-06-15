import CONSTANTS from "./psers2Constants.js";
import { validatePSERS2Input } from "./psers2Validation.js";
import { applyPSERS2EarlyRetirementReduction } from "./psers2EarlyRetirement.js";

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
    return applyPSERS2EarlyRetirementReduction(monthlyBenefit, input);
}

export function calculateMonthlyPension(monthlyBenefit) {
    return monthlyBenefit;
}

function calculatePSERS2Internal(input) {
    validatePSERS2Input(input);

    const {
        serviceYears,
        retirementAge,
        averageFinalCompensation,
        finalAverageSalary
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
                serviceYears
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
            system: "PSERS2",
            version: "1.0.0",
            source: "Washington DRS PSERS Plan 2",
            sourceUrl: "https://www.drs.wa.gov/plan/psers2/"
        })
    });
}

export const calculatePSERS2 =
    Object.freeze(calculatePSERS2Internal);
