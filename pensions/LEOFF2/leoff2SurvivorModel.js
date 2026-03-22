/*****************************************************************************************
 * leoff2SurvivorModel.js
 *
 * PURPOSE
 * ---------------------------------------------------------------------------------------
 * Applies survivor option reductions to LEOFF 2 pension benefit.
 *
 * ARCHITECTURAL RULES
 * ---------------------------------------------------------------------------------------
 * - Does NOT compute base pension
 * - Does NOT validate service eligibility
 * - Only modifies benefit based on survivor selection
 * - Fully swappable when real actuarial tables are obtained
 *****************************************************************************************/

import ASSUMPTIONS from "./leoff2SurvivorAssumptions.js";


/**
 * applySurvivorOption
 *
 * @param {number} annualBenefit
 * @param {string} optionKey
 * @returns {Object}
 */
export function applySurvivorOption(annualBenefit, optionKey = "SINGLE") {

    const option = ASSUMPTIONS[optionKey];

    if (!option) {
        throw new Error(`Invalid LEOFF 2 survivor option: ${optionKey}`);
    }

    const reducedAnnualBenefit =
        annualBenefit * (1 - option.reduction);

    const survivorAnnualBenefit =
        reducedAnnualBenefit * option.survivorPercent;

    return Object.freeze({

        annualBenefit: reducedAnnualBenefit,

        monthlyBenefit: reducedAnnualBenefit / 12,

        survivorAnnualBenefit,

        survivorMonthlyBenefit: survivorAnnualBenefit / 12,

        survivorPercent: option.survivorPercent,

        reductionApplied: option.reduction,

        option: optionKey

    });
}