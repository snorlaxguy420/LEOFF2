/*****************************************************************************************
 * pensionRegistry.js
 *
 * PURPOSE
 * ---------------------------------------------------------------------------------------
 * Central registry for all supported pension systems.
 *
 * This file is the ONLY place in the application where pension systems are mapped
 * to their calculation engines.
 *
 * IMPORTANT ARCHITECTURAL RULES
 * ---------------------------------------------------------------------------------------
 * 1. LEOFF 2 is treated as a sealed, standalone statutory engine.
 * 2. No pension system imports or references another pension system.
 * 3. New pension systems are added ONLY in this registry.
 * 4. The simulation engine must remain pension-agnostic.
 *
 * DESIGN GOAL
 * ---------------------------------------------------------------------------------------
 * Allow safe expansion to additional defined benefit systems (PERS, TRS, Military,
 * CalPERS, etc.) without ever modifying LEOFF 2 logic.
 *
 * VERSIONING NOTE
 * ---------------------------------------------------------------------------------------
 * Each pension engine maintains its own internal version.
 * This registry does NOT manage pension math versions.
 *****************************************************************************************/


/* ============================================================================
   IMPORT PENSION ENGINES
   ============================================================================ */

/*
 * LEOFF 2 — Washington State Law Enforcement Officers’ and Fire Fighters’ Plan 2
 *
 * This module must remain fully isolated.
 * DO NOT modify LEOFF 2 logic when adding new pension systems.
 */
import { calculateLEOFF2 } from "./LEOFF2/leoff2Engine.js";
import { calculatePERS2 } from "./pers2/pers2Engine.js";
import { calculateTRS2 } from "./trs2/trs2Engine.js";

/*
 * Generic Pension Engine
 *
 * Used for simple defined benefit systems or placeholder modeling.
 * This is intentionally separate from LEOFF 2.
 */
import { calculateGenericPension } from "./generic/genericPensionEngine.js";


/* ============================================================================
   REGISTRY OBJECT
   ============================================================================ */

/**
 * pensionSystems
 * ----------------------------------------------------------------------------
 * A frozen mapping of pension system identifiers to calculation functions.
 *
 * Keys:
 *   - Must be stable string identifiers
 *   - Used by UI dropdown or configuration layer
 *
 * Values:
 *   - Pure functions
 *   - Accept a standardized input object
 *   - Return a standardized pension result object
 *
 * IMPORTANT:
 * Object.freeze() prevents runtime mutation.
 * This ensures that no system can overwrite LEOFF 2 at runtime.
 */
const pensionSystems = Object.freeze({

    /**
     * LEOFF2
     * Washington State LEOFF Plan 2 defined benefit pension.
     *
     * This must always point directly to the sealed LEOFF 2 engine.
     */
    LEOFF2: calculateLEOFF2,

    /**
     * PERS2
     * Washington State Public Employees' Retirement System Plan 2.
     */
    PERS2: calculatePERS2,

    /**
     * TRS2
     * Washington State Teachers' Retirement System Plan 2.
     */
    TRS2: calculateTRS2,

    /**
     * GENERIC
     * Basic defined benefit modeling engine.
     * Intended for expansion and experimentation.
     */
    GENERIC: calculateGenericPension,

    /*
     * FUTURE SYSTEMS (Example placeholders)
     *
     * Uncomment and implement when ready.
     *
     * PERS2: calculatePERS2,
     * TRS3: calculateTRS3,
     * MILITARY: calculateMilitaryRetirement,
     * CALPERS: calculateCalPERS,
     */

});


/* ============================================================================
   PUBLIC API
   ============================================================================ */

/**
 * getPensionCalculator(systemKey)
 * ----------------------------------------------------------------------------
 * Safely retrieves the pension calculation function for a given system.
 *
 * @param {string} systemKey
 *      Identifier of the pension system (e.g., "LEOFF2")
 *
 * @returns {function}
 *      Pension calculation function
 *
 * @throws {Error}
 *      If systemKey is invalid or not registered
 */
export function getPensionCalculator(systemKey) {

    if (!systemKey) {
        throw new Error("Pension system key is required.");
    }

    const calculator = pensionSystems[systemKey];

    if (!calculator) {
        throw new Error(
            `Unsupported pension system: ${systemKey}. ` +
            `Ensure it is registered in pensionRegistry.js`
        );
    }

    return calculator;
}


/**
 * listAvailablePensionSystems()
 * ----------------------------------------------------------------------------
 * Returns an array of supported pension system identifiers.
 *
 * Useful for:
 *   - UI dropdown population
 *   - Debugging
 *   - Future admin configuration
 *
 * @returns {string[]}
 */
export function listAvailablePensionSystems() {
    return Object.keys(pensionSystems);
}


/* ============================================================================
   ARCHITECTURAL GUARANTEE
   ============================================================================ */

/**
 * This file intentionally does NOT:
 *
 * - Share constants between pension systems
 * - Perform pension math
 * - Apply retirement rules
 * - Perform eligibility checks
 * - Modify input data
 *
 * It is strictly a routing layer.
 *
 * All pension engines must be:
 *   - Pure
 *   - Self-contained
 *   - Statutorily accurate (for real-world systems)
 *
 * LEOFF 2 is never modified here once stable.
 */
