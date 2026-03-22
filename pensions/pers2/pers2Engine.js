/*****************************************************************************************
 * pers2Engine.js
 *****************************************************************************************/

import CONSTANTS from "./pers2Constants.js";
import { validatePERS2Input } from "./pers2Validation.js";
import { applyPERS2EarlyRetirementReduction } from "./pers2EarlyRetirement.js";

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
    return applyPERS2EarlyRetirementReduction(monthlyBenefit, input);
}

export function calculateMonthlyPension(monthlyBenefit) {
    return monthlyBenefit;
}

function calculatePERS2Internal(input) {

    validatePERS2Input(input);

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
            system: "PERS2",
            version: "1.0.0",
            source: "Washington DRS PERS Plan 2"
        })
    });
}

export const calculatePERS2 =
    Object.freeze(calculatePERS2Internal);
