import CONSTANTS from "./militaryRetiredPayConstants.js";
import {
    normalizeMilitaryRetiredPayPlan,
    validateMilitaryRetiredPayInput
} from "./militaryRetiredPayValidation.js";

export function calculateMilitaryRetiredPayMultiplier({
    serviceYears,
    retirementPlan
}) {
    const normalizedPlan =
        normalizeMilitaryRetiredPayPlan(retirementPlan);

    if (normalizedPlan === CONSTANTS.PLANS.BRS) {
        return serviceYears * CONSTANTS.BRS_MULTIPLIER_PER_YEAR;
    }

    if (normalizedPlan === CONSTANTS.PLANS.REDUX) {
        const legacyMultiplier =
            serviceYears * CONSTANTS.LEGACY_MULTIPLIER_PER_YEAR;
        const yearsShortOf30 =
            Math.max(
                0,
                CONSTANTS.REDUX_PENALTY_SERVICE_YEAR_TARGET - serviceYears
            );

        return Math.max(
            0,
            legacyMultiplier -
                (yearsShortOf30 *
                    CONSTANTS.REDUX_PENALTY_PER_YEAR_SHORT_OF_30)
        );
    }

    return serviceYears * CONSTANTS.LEGACY_MULTIPLIER_PER_YEAR;
}

function calculateMilitaryRetiredPayInternal(input) {
    validateMilitaryRetiredPayInput(input);

    const {
        serviceYears,
        retirementAge,
        retirementPlan,
        retiredPayBase,
        monthlyRetiredPayBase,
        cola
    } = input;
    const normalizedPlan =
        normalizeMilitaryRetiredPayPlan(retirementPlan);
    const monthlyPayBase =
        Number(retiredPayBase) || Number(monthlyRetiredPayBase);
    const retiredPayMultiplier =
        calculateMilitaryRetiredPayMultiplier({
            serviceYears,
            retirementPlan: normalizedPlan
        });
    const monthlyBenefit =
        monthlyPayBase * retiredPayMultiplier;

    return Object.freeze({
        monthlyBenefit,
        annualBenefit: monthlyBenefit * 12,
        startAge: retirementAge,
        retiredPayMultiplier,
        cola:
            Number.isFinite(Number(cola))
                ? Number(cola)
                : CONSTANTS.DEFAULT_COLA,
        metadata: Object.freeze({
            system: "MILITARY_RETIRED_PAY",
            version: "1.0.0",
            retirementPlan: normalizedPlan,
            source: "Defense Department Military Compensation Retirement",
            sourceUrl: "https://militarypay.defense.gov/Pay/Retirement/"
        })
    });
}

export const calculateMilitaryRetiredPay =
    Object.freeze(calculateMilitaryRetiredPayInternal);
