/*****************************************************************************************
 * trs2Engine.js
 *****************************************************************************************/

import CONSTANTS from "./trs2Constants.js";
import { validateTRS2Input } from "./trs2Validation.js";
import { applyTRS2EarlyRetirementReduction } from "./trs2EarlyRetirement.js";

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
    return applyTRS2EarlyRetirementReduction(monthlyBenefit, input);
}

export function calculateMonthlyPension(monthlyBenefit) {
    return monthlyBenefit;
}

function calculateTRS2Internal(input) {
    validateTRS2Input(input);

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
            system: "TRS2",
            version: "1.0.0",
            source: "Washington DRS TRS Plan 2"
        })
    });
}

export const calculateTRS2 =
    Object.freeze(calculateTRS2Internal);
