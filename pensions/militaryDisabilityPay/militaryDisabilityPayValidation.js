import CONSTANTS from "./militaryDisabilityPayConstants.js";

export function normalizeMilitaryDisabilityPayType(payType) {
    const normalizedPayType = String(payType || "").toLowerCase();
    const validPayTypes = Object.values(CONSTANTS.PAY_TYPES);

    return validPayTypes.includes(normalizedPayType)
        ? normalizedPayType
        : CONSTANTS.PAY_TYPES.VA_DISABILITY;
}

export function normalizeMilitaryDisabilityRetirementPlan(plan) {
    return String(plan || "").toLowerCase() === "brs"
        ? "brs"
        : "legacy";
}

export function validateMilitaryDisabilityPayInput(input = {}) {
    const {
        payType,
        monthlyAmount,
        retirementAge,
        retiredPayBase,
        monthlyRetiredPayBase,
        disabilityPercent,
        serviceYears
    } = input;
    const normalizedPayType =
        normalizeMilitaryDisabilityPayType(payType);

    if (
        typeof retirementAge !== "number" ||
        Number.isNaN(retirementAge) ||
        retirementAge <= 0
    ) {
        throw new Error(
            "Military disability pay requires a valid start age."
        );
    }

    if (normalizedPayType === CONSTANTS.PAY_TYPES.VA_DISABILITY) {
        if (
            typeof monthlyAmount !== "number" ||
            Number.isNaN(monthlyAmount) ||
            monthlyAmount <= 0
        ) {
            throw new Error(
                "VA disability compensation requires a valid monthly amount."
            );
        }

        return;
    }

    const payBase =
        Number(retiredPayBase) || Number(monthlyRetiredPayBase) || 0;

    if (!Number.isFinite(payBase) || payBase <= 0) {
        throw new Error(
            "DoD disability retirement requires a valid monthly retired-pay base."
        );
    }

    if (
        typeof disabilityPercent !== "number" ||
        Number.isNaN(disabilityPercent) ||
        disabilityPercent < 0 ||
        disabilityPercent > 100
    ) {
        throw new Error(
            "DoD disability retirement requires a disability percentage from 0 to 100."
        );
    }

    if (
        typeof serviceYears !== "number" ||
        Number.isNaN(serviceYears) ||
        serviceYears < 0
    ) {
        throw new Error(
            "DoD disability retirement requires valid creditable service years."
        );
    }
}
