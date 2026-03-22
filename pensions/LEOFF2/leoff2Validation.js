/*****************************************************************************************
 * leoff2Validation.js
 *
 * PURPOSE
 * ---------------------------------------------------------------------------------------
 * Validates input for LEOFF 2 pension calculation.
 *
 * This file ensures:
 *   - Eligibility requirements are met
 *   - Values are within legal bounds
 *   - No invalid pension math proceeds
 *
 * This module performs NO calculations.
 *****************************************************************************************/

import CONSTANTS from "./leoff2Constants.js";


/**
 * validateLEOFF2Input(input)
 *
 * @param {Object} input
 * @returns {void}
 * @throws {Error} if validation fails
 */
export function validateLEOFF2Input(input) {

    if (!input) {
        throw new Error("LEOFF 2 input is required.");
    }

    const {
        serviceYears,
        retirementAge,
        finalAverageSalary
    } = input;

    if (serviceYears == null || serviceYears < CONSTANTS.MIN_SERVICE_YEARS) {
        throw new Error(
            `LEOFF 2 requires at least ${CONSTANTS.MIN_SERVICE_YEARS} years of service.`
        );
    }

    if (retirementAge == null || retirementAge < CONSTANTS.EARLIEST_RETIREMENT_AGE) {
        throw new Error(
            `LEOFF 2 retirement age cannot be earlier than ${CONSTANTS.EARLIEST_RETIREMENT_AGE}.`
        );
    }

    if (finalAverageSalary == null || finalAverageSalary <= 0) {
        throw new Error("Final Average Salary must be greater than zero.");
    }
}