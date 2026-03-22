/*****************************************************************************************
 * leoff2EarlyRetirement.js
 *
 * PURPOSE
 * ---------------------------------------------------------------------------------------
 * Applies early retirement reduction factors for LEOFF 2.
 *
 * NOTE:
 * ---------------------------------------------------------------------------------------
 * This is a simplified reduction model.
 * Real statutory reductions are actuarial and age-based.
 *
 * Replace reduction logic with exact actuarial tables if required.
 *****************************************************************************************/

import CONSTANTS from "./leoff2Constants.js";


/**
 * applyEarlyRetirementReduction(baseAnnualBenefit, retirementAge)
 *
 * @param {number} baseAnnualBenefit
 * @param {number} retirementAge
 * @returns {number} adjustedAnnualBenefit
 */
const EARLY_RETIREMENT_FACTORS = {
    50: 0.91,
    51: 0.94,
    52: 0.97,
    53: 1.00
};

export function applyEarlyRetirementReduction(baseAnnualBenefit, retirementAge) {

    if (retirementAge >= 53) {
        return baseAnnualBenefit;
    }

    const factor = EARLY_RETIREMENT_FACTORS[retirementAge];

    if (!factor) {
        throw new Error("Invalid LEOFF 2 retirement age");
    }

    return baseAnnualBenefit * factor;
}