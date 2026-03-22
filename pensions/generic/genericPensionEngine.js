/*********************************************************************
 * genericPensionEngine.js
 * Placeholder engine for future expansion
 *********************************************************************/

/*
   Internal function
*/
function calculateGenericPensionInternal() {
    throw new Error("Generic Pension Engine not implemented.");
}

/*
   Safe frozen export
*/
export const calculateGenericPension =
    Object.freeze(calculateGenericPensionInternal);