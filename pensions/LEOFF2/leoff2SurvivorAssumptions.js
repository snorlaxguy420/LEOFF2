/*****************************************************************************************
 * leoff2SurvivorAssumptions.js
 *
 * PURPOSE
 * ---------------------------------------------------------------------------------------
 * Contains modeling-only reduction assumptions for LEOFF 2 survivor options.
 *
 * IMPORTANT
 * ---------------------------------------------------------------------------------------
 * These are NOT official DRS actuarial factors.
 * They are structured placeholders until reverse-engineered tables are built.
 *
 * Replace this file in the future with actuarial lookup tables.
 *****************************************************************************************/


/**
 * Survivor reduction assumptions.
 *
 * These represent approximate lifetime reduction factors
 * applied to the member’s benefit when selecting a survivor option.
 *
 * Format:
 *  reduction: percentage reduction from base benefit
 *  survivorPercent: percentage paid to survivor after member death
 */
const LEOFF2_SURVIVOR_ASSUMPTIONS = Object.freeze({

    SINGLE: Object.freeze({
        reduction: 0.00,
        survivorPercent: 0.00
    }),

    JOINT_100: Object.freeze({
        reduction: 0.10,        // 10% modeling assumption
        survivorPercent: 1.00
    }),

    JOINT_66: Object.freeze({
        reduction: 0.07,        // 7% modeling assumption
        survivorPercent: 0.6667
    }),

    JOINT_50: Object.freeze({
        reduction: 0.04,        // 4% modeling assumption
        survivorPercent: 0.50
    })

});


export default LEOFF2_SURVIVOR_ASSUMPTIONS;