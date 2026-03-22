/*****************************************************************************************
 * leoff2Constants.js
 *
 * PURPOSE
 * ---------------------------------------------------------------------------------------
 * Contains ALL statutory constants for Washington LEOFF Plan 2.
 *
 * CRITICAL RULE:
 * ---------------------------------------------------------------------------------------
 * These constants must NEVER be shared with other pension systems.
 * They must NEVER be modified without statutory review.
 *
 * LEOFF 2 is governed by Washington State law.
 *****************************************************************************************/


/**
 * LEOFF 2 statutory constants
 *
 * Values based on Washington State LEOFF Plan 2 structure.
 */
const LEOFF2_CONSTANTS = Object.freeze({

    // Benefit multiplier (2% per year of service)
    BENEFIT_MULTIPLIER: 0.02,

    // Minimum service credit required to vest
    MIN_SERVICE_YEARS: 5,

    // Earliest retirement age with 5+ years
    EARLIEST_RETIREMENT_AGE: 53,

    // Normal retirement age (no early reduction)
    NORMAL_RETIREMENT_AGE: 60,

    // Statutory COLA cap (Plan 2 capped at 3%)
    COLA_CAP: 0.03,

    // Tiered multiplier bonus (post-2021 hires)
    TIER_BONUS_MULTIPLIER: 0.005,

    // Tier bonus begins after 15 years
    TIER_START_YEARS: 15,

    // Tier bonus ends at 25 years
    TIER_END_YEARS: 25,

    // Optional lump-sum enhancement paid per service credit month
    LUMP_SUM_PER_SERVICE_MONTH: 100

});


export default LEOFF2_CONSTANTS;
