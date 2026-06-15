import CONSTANTS from "./militaryRetiredPayConstants.js";

export function normalizeMilitaryRetiredPayPlan(plan) {
    const normalizedPlan = String(plan || "").toLowerCase();
    const validPlans = Object.values(CONSTANTS.PLANS);

    return validPlans.includes(normalizedPlan)
        ? normalizedPlan
        : CONSTANTS.PLANS.HIGH36;
}

export function validateMilitaryRetiredPayInput(input = {}) {
    const {
        serviceYears,
        retirementAge,
        retiredPayBase,
        monthlyRetiredPayBase
    } = input;
    const payBase =
        Number(retiredPayBase) || Number(monthlyRetiredPayBase) || 0;

    if (
        typeof serviceYears !== "number" ||
        Number.isNaN(serviceYears) ||
        serviceYears <= 0
    ) {
        throw new Error(
            "Military retired pay requires valid creditable service years."
        );
    }

    if (
        typeof retirementAge !== "number" ||
        Number.isNaN(retirementAge) ||
        retirementAge <= 0
    ) {
        throw new Error(
            "Military retired pay requires a valid start age."
        );
    }

    if (!Number.isFinite(payBase) || payBase <= 0) {
        throw new Error(
            "Military retired pay requires a valid monthly retired-pay base."
        );
    }
}
