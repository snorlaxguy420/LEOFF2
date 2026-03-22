/*****************************************************************************************
 * leoff2Engine.js
 *****************************************************************************************/

import CONSTANTS from "./leoff2Constants.js";
import { validateLEOFF2Input } from "./leoff2Validation.js";
import { applyEarlyRetirementReduction as applyEarlyReduction } from "./leoff2EarlyRetirement.js";
import { applySurvivorOption } from "./leoff2SurvivorModel.js";

export function calculateBasePension({
    serviceYears,
    finalAverageSalary
}) {
    return (
        serviceYears *
        finalAverageSalary *
        CONSTANTS.BENEFIT_MULTIPLIER
    );
}

export function calculateTieredMultiplier({
    serviceYears,
    finalAverageSalary
}) {

    const tierYears =
        Math.max(
            0,
            Math.min(
                serviceYears,
                CONSTANTS.TIER_END_YEARS
            ) - CONSTANTS.TIER_START_YEARS
        );

    return (
        tierYears *
        finalAverageSalary *
        CONSTANTS.TIER_BONUS_MULTIPLIER
    );
}

export function calculateLumpSumBenefit(serviceYears = 0) {
    return serviceYears * 12 * CONSTANTS.LUMP_SUM_PER_SERVICE_MONTH;
}

export function calculateEarlyRetirementReduction(
    annualBenefit,
    retirementAge
) {
    return applyEarlyReduction(annualBenefit, retirementAge);
}

export function calculateMonthlyPension(annualBenefit) {
    return annualBenefit / 12;
}

/*
   INTERNAL function
   We give it a DIFFERENT name so we can safely export a frozen version.
*/
function calculateLEOFF2Internal(input) {

    validateLEOFF2Input(input);

    const {
        serviceYears,
        retirementAge,
        finalAverageSalary,
        colaOverride,
        benefitEnhancement = "tiered_multiplier",
        survivorOption = "SINGLE"
    } = input;

// Base 2% multiplier
const baseAnnualBenefit =
    calculateBasePension({
        serviceYears,
        finalAverageSalary
    });

// Tiered multiplier bonus (0.5% for years 15–25)
const tierAnnualBenefit =
    calculateTieredMultiplier({
        serviceYears,
        finalAverageSalary
    });

const annualBenefitBeforeReduction =
    benefitEnhancement === "lump_sum"
        ? baseAnnualBenefit
        : baseAnnualBenefit + tierAnnualBenefit;

    const earlyAdjusted =
        calculateEarlyRetirementReduction(
            annualBenefitBeforeReduction,
            retirementAge
        );

    const survivorAdjusted =
        applySurvivorOption(
            earlyAdjusted,
            survivorOption
        );

    const cola =
        Math.min(
            colaOverride ?? CONSTANTS.COLA_CAP,
            CONSTANTS.COLA_CAP
        );
    const lumpSumBenefit =
        benefitEnhancement === "lump_sum"
            ? calculateLumpSumBenefit(serviceYears)
            : 0;

    return Object.freeze({
        annualBenefit: survivorAdjusted.annualBenefit,
        monthlyBenefit:
            calculateMonthlyPension(
                survivorAdjusted.annualBenefit
            ),
        survivorAnnualBenefit:
            survivorAdjusted.survivorAnnualBenefit,
        survivorMonthlyBenefit:
            calculateMonthlyPension(
                survivorAdjusted.survivorAnnualBenefit
            ),
        survivorOption: survivorAdjusted.option,
        survivorPercent: survivorAdjusted.survivorPercent,
        reductionApplied: survivorAdjusted.reductionApplied,
        startAge: retirementAge,
        cola,
        lumpSumBenefit,
        benefitEnhancement,
        metadata: Object.freeze({
            system: "LEOFF2",
            version: "1.2.0-model-benefit-enhancement"
        })
    });
}

/*
   SAFE EXPORT
   No duplicate identifier.
*/
export const calculateLEOFF2 =
    Object.freeze(calculateLEOFF2Internal);
