import CONSTANTS from "./militaryDisabilityPayConstants.js";
import {
    normalizeMilitaryDisabilityPayType,
    normalizeMilitaryDisabilityRetirementPlan,
    validateMilitaryDisabilityPayInput
} from "./militaryDisabilityPayValidation.js";

export function calculateMilitaryDisabilityMultiplier({
    disabilityPercent = 0,
    serviceYears = 0,
    retirementPlan = "legacy"
}) {
    const normalizedPlan =
        normalizeMilitaryDisabilityRetirementPlan(retirementPlan);
    const serviceMultiplier =
        serviceYears *
        (
            normalizedPlan === "brs"
                ? CONSTANTS.BRS_MULTIPLIER_PER_YEAR
                : CONSTANTS.LEGACY_MULTIPLIER_PER_YEAR
        );
    const disabilityMultiplier =
        Number(disabilityPercent) / 100;

    return Math.min(
        CONSTANTS.MAX_DISABILITY_MULTIPLIER,
        Math.max(disabilityMultiplier, serviceMultiplier)
    );
}

function calculateMilitaryDisabilityPayInternal(input) {
    validateMilitaryDisabilityPayInput(input);

    const {
        payType,
        monthlyAmount,
        retirementAge,
        retiredPayBase,
        monthlyRetiredPayBase,
        disabilityPercent,
        serviceYears,
        retirementPlan,
        cola,
        taxable = false
    } = input;
    const normalizedPayType =
        normalizeMilitaryDisabilityPayType(payType);
    const normalizedPlan =
        normalizeMilitaryDisabilityRetirementPlan(retirementPlan);

    if (normalizedPayType === CONSTANTS.PAY_TYPES.VA_DISABILITY) {
        const monthlyBenefit = Number(monthlyAmount);

        return Object.freeze({
            monthlyBenefit,
            annualBenefit: monthlyBenefit * 12,
            startAge: retirementAge,
            disabilityMultiplier: null,
            cola:
                Number.isFinite(Number(cola))
                    ? Number(cola)
                    : CONSTANTS.DEFAULT_COLA,
            taxable: Boolean(taxable),
            metadata: Object.freeze({
                system: "MILITARY_DISABILITY_PAY",
                version: "1.0.0",
                payType: normalizedPayType,
                source: "VA disability compensation rates",
                sourceUrl:
                    "https://www.va.gov/disability/compensation-rates/veteran-rates/"
            })
        });
    }

    const payBase =
        Number(retiredPayBase) || Number(monthlyRetiredPayBase);
    const disabilityMultiplier =
        calculateMilitaryDisabilityMultiplier({
            disabilityPercent,
            serviceYears,
            retirementPlan: normalizedPlan
        });
    const monthlyBenefit = payBase * disabilityMultiplier;

    return Object.freeze({
        monthlyBenefit,
        annualBenefit: monthlyBenefit * 12,
        startAge: retirementAge,
        disabilityMultiplier,
        cola:
            Number.isFinite(Number(cola))
                ? Number(cola)
                : CONSTANTS.DEFAULT_COLA,
        taxable: Boolean(taxable),
        metadata: Object.freeze({
            system: "MILITARY_DISABILITY_PAY",
            version: "1.0.0",
            payType: normalizedPayType,
            retirementPlan: normalizedPlan,
            source: "Defense Department disability retirement",
            sourceUrl: "https://militarypay.defense.gov/Pay/Retirement/"
        })
    });
}

export const calculateMilitaryDisabilityPay =
    Object.freeze(calculateMilitaryDisabilityPayInternal);
