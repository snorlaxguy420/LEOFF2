import { getPensionCalculator } from "../pensions/pensionRegistry.js";
import { calculateHouseholdSocialSecurityIncomeSources } from "../core/socialSecurityEngine.js";

export function normalizeLeoffSurvivorOption(option) {
    const survivorMap = {
        "none": "SINGLE",
        "NONE": "SINGLE",
        "50%": "JOINT_50",
        "66%": "JOINT_66",
        "66.6%": "JOINT_66",
        "100%": "JOINT_100",
        "": "SINGLE",
        "SINGLE": "SINGLE",
        "JOINT_50": "JOINT_50",
        "JOINT_66": "JOINT_66",
        "JOINT_100": "JOINT_100"
    };

    return survivorMap[option] || "SINGLE";
}

function primaryAgeWhenSpouseReachesAge(profile = {}, spouseTargetAge = null) {
    const targetAge = Number(spouseTargetAge);
    const primaryCurrentAge = Number(profile.currentAge);
    const spouseCurrentAge = Number(
        profile.spouse?.currentAge ??
        profile.spouse?.age
    );

    if (
        Number.isFinite(targetAge) &&
        targetAge > 0 &&
        Number.isFinite(primaryCurrentAge) &&
        Number.isFinite(spouseCurrentAge) &&
        spouseCurrentAge > 0
    ) {
        return primaryCurrentAge + (targetAge - spouseCurrentAge);
    }

    return targetAge;
}

function normalizeIncomeOwner(owner) {
    return owner === "spouse" ? "spouse" : "primary";
}

function startAgeForOwner({
    owner,
    profile,
    startAge
}) {
    return normalizeIncomeOwner(owner) === "spouse"
        ? primaryAgeWhenSpouseReachesAge(profile, startAge)
        : Number(startAge);
}

const ADDITIONAL_DEFINED_BENEFIT_PENSION_SYSTEMS = Object.freeze({
    PERS2: Object.freeze({
        name: "PERS Plan 2 Pension",
        compensationField: "averageFinalCompensation"
    }),
    TRS2: Object.freeze({
        name: "TRS Plan 2 Pension",
        compensationField: "averageFinalCompensation"
    }),
    SERS2: Object.freeze({
        name: "SERS Plan 2 Pension",
        compensationField: "averageFinalCompensation"
    }),
    PSERS2: Object.freeze({
        name: "PSERS Plan 2 Pension",
        compensationField: "averageFinalCompensation"
    }),
    WSPRS2: Object.freeze({
        name: "WSPRS Plan 2 Pension",
        compensationField: "averageFinalSalary"
    }),
    MILITARY_RETIRED_PAY: Object.freeze({
        name: "Military Retired Pay",
        compensationField: "retiredPayBase"
    })
});

function normalizeStableIncomeEndAge(endAge) {
    const parsedEndAge = Number(endAge);

    if (!Number.isFinite(parsedEndAge) || parsedEndAge <= 0) {
        return undefined;
    }

    return parsedEndAge;
}

export function buildSimulationIncomeSources({
    inputs,
    assetRegistry
}) {

    const incomeSources = [];

    buildPensionIncomeSources({
        inputs,
        retireAge: inputs.retireAge
    }).forEach(source => incomeSources.push(source));

    calculateHouseholdSocialSecurityIncomeSources(
        inputs.socialSecurity,
        inputs.profile
    ).forEach(source => incomeSources.push(source));

    assetRegistry.getAll().forEach(asset => {
        if (asset?.id === "socialSecurity") {
            return;
        }

        if (!asset.getSimulationPayloads) return;

        const payloads = asset.getSimulationPayloads(inputs);

        if (!payloads) return;

        if (Array.isArray(payloads)) {
            payloads.forEach(payload => incomeSources.push(payload));
            return;
        }

        incomeSources.push(payloads);
    });

    return incomeSources;
}

export function buildPensionIncomeSources({
    inputs,
    retireAge
}) {

    const incomeSources = [];

    if (inputs.pension && inputs.pension.serviceYears > 0) {
        const pensionCalculator = getPensionCalculator("LEOFF2");
        const survivorOption =
            normalizeLeoffSurvivorOption(inputs.pension.survivorOption);
        const pensionResult = pensionCalculator({
            serviceYears: inputs.pension.serviceYears,
            retirementAge: retireAge,
            finalAverageSalary: inputs.pension.finalAverageSalary,
            colaOverride: inputs.pension.cola,
            benefitEnhancement:
                inputs.pension.benefitEnhancement || "tiered_multiplier",
            survivorOption,
            survivorAge:
                survivorOption !== "SINGLE"
                    ? inputs.pension.survivorAge
                    : null
        });

        incomeSources.push({
            type: "fixed",
            name: "LEOFF Pension",
            annualAmount: pensionResult.annualBenefit,
            startAge: pensionResult.startAge,
            growthRate: pensionResult.cola,
            taxable: true,
            taxCategory: "ordinary_income"
        });

        if (pensionResult.lumpSumBenefit > 0) {
            incomeSources.push({
                type: "fixed",
                name: "LEOFF Lump Sum",
                annualAmount: pensionResult.lumpSumBenefit,
                startAge: pensionResult.startAge,
                endAge: pensionResult.startAge,
                growthRate: 0,
                taxable: true,
                taxCategory: "ordinary_income"
            });
        }
    }

    (inputs.additionalPensions || []).forEach(additionalPension => {
        if (!additionalPension?.enabled) return;

        if (additionalPension.system === "SPOUSE_DEFINED_BENEFIT") {
            const annualAmount =
                Number(additionalPension.annualAmount) ||
                (Number(additionalPension.monthlyAmount) * 12) ||
                0;
            const pensionHolderStartAge =
                Number(additionalPension.spouseStartAge) ||
                Number(additionalPension.retirementAge) ||
                Number(additionalPension.startAge) ||
                0;
            const owner =
                additionalPension.owner === undefined
                    ? "spouse"
                    : normalizeIncomeOwner(additionalPension.owner);
            const startAge =
                startAgeForOwner({
                    owner,
                    profile: inputs.profile,
                    startAge: pensionHolderStartAge
                });

            if (annualAmount <= 0 || !Number.isFinite(startAge)) {
                return;
            }

            incomeSources.push({
                type: "fixed",
                name:
                    additionalPension.name ||
                    (
                        owner === "spouse"
                            ? "Spouse Pension"
                            : "Defined Benefit Pension"
                    ),
                annualAmount,
                startAge,
                growthRate: additionalPension.cola || 0,
                taxable: additionalPension.taxable !== false,
                taxCategory: "ordinary_income",
                metadata: {
                    owner,
                    system: "SPOUSE_DEFINED_BENEFIT",
                    pensionHolderStartAge
                }
            });

            return;
        }

        if (additionalPension.system === "OTHER_STABLE_INCOME") {
            const annualAmount =
                Number(additionalPension.annualAmount) ||
                (Number(additionalPension.monthlyAmount) * 12) ||
                0;
            const startAge = Number(additionalPension.startAge) || 0;

            if (annualAmount <= 0 || startAge <= 0) {
                return;
            }

            incomeSources.push({
                type: "fixed",
                name: additionalPension.name || "Stable Income",
                annualAmount,
                startAge,
                endAge:
                    normalizeStableIncomeEndAge(additionalPension.endAge),
                growthRate: Number(additionalPension.cola) || 0,
                taxable: additionalPension.taxable !== false,
                taxCategory: "ordinary_income",
                metadata: {
                    system: "OTHER_STABLE_INCOME",
                    incomeType: additionalPension.incomeType || "other"
                }
            });

            return;
        }

        if (additionalPension.system === "MILITARY_DISABILITY_PAY") {
            const memberStartAge = Number(
                additionalPension.retirementAge ??
                additionalPension.startAge
            );
            const sourceStartAge =
                startAgeForOwner({
                    owner: additionalPension.owner,
                    profile: inputs.profile,
                    startAge: memberStartAge
                });

            if (
                !Number.isFinite(memberStartAge) ||
                memberStartAge <= 0 ||
                !Number.isFinite(sourceStartAge) ||
                sourceStartAge <= 0
            ) {
                return;
            }

            const pensionCalculator =
                getPensionCalculator(additionalPension.system);
            const pensionResult = pensionCalculator({
                payType: additionalPension.payType,
                monthlyAmount: additionalPension.monthlyAmount,
                retiredPayBase: additionalPension.retiredPayBase,
                disabilityPercent: additionalPension.disabilityPercent,
                serviceYears: additionalPension.serviceYears,
                retirementAge: memberStartAge,
                retirementPlan: additionalPension.retirementPlan,
                cola: additionalPension.cola,
                taxable: additionalPension.taxable
            });

            incomeSources.push({
                type: "fixed",
                name:
                    normalizeIncomeOwner(additionalPension.owner) === "spouse"
                        ? "Spouse Military Disability Pay"
                        : "Military Disability Pay",
                annualAmount: pensionResult.annualBenefit,
                startAge: sourceStartAge,
                growthRate: pensionResult.cola || 0,
                taxable: pensionResult.taxable === true,
                taxCategory: "ordinary_income",
                metadata: {
                    system: additionalPension.system,
                    owner: normalizeIncomeOwner(additionalPension.owner),
                    payType: pensionResult.metadata?.payType,
                    disabilityMultiplier:
                        pensionResult.disabilityMultiplier
                }
            });

            return;
        }

        const definedBenefitSystem =
            ADDITIONAL_DEFINED_BENEFIT_PENSION_SYSTEMS[
                additionalPension.system
            ];

        if (!definedBenefitSystem) {
            return;
        }

        const compensation =
            Number(
                additionalPension[definedBenefitSystem.compensationField] ??
                additionalPension.averageFinalCompensation ??
                additionalPension.averageFinalSalary
            ) || 0;

        const memberRetirementAge =
            Number(additionalPension.retirementAge);
        const sourceStartAge =
            startAgeForOwner({
                owner: additionalPension.owner,
                profile: inputs.profile,
                startAge: memberRetirementAge
            });

        if (
            additionalPension.serviceYears > 0 &&
            compensation > 0 &&
            memberRetirementAge > 0 &&
            sourceStartAge > 0
        ) {
            const pensionCalculator =
                getPensionCalculator(additionalPension.system);
            const pensionResult = pensionCalculator({
                serviceYears: additionalPension.serviceYears,
                retirementAge: memberRetirementAge,
                averageFinalCompensation: compensation,
                averageFinalSalary: compensation,
                retiredPayBase: compensation,
                retirementPlan: additionalPension.retirementPlan,
                hireDate: additionalPension.hireDate,
                memberStatus: additionalPension.memberStatus,
                cola: additionalPension.cola
            });

            incomeSources.push({
                type: "fixed",
                name:
                    normalizeIncomeOwner(additionalPension.owner) === "spouse"
                        ? `Spouse ${definedBenefitSystem.name}`
                        : definedBenefitSystem.name,
                annualAmount: pensionResult.annualBenefit,
                startAge: sourceStartAge,
                growthRate: pensionResult.cola || 0,
                taxable: additionalPension.taxable !== false,
                taxCategory: "ordinary_income",
                metadata: {
                    system: additionalPension.system,
                    owner: normalizeIncomeOwner(additionalPension.owner),
                    earlyRetirementFactor:
                        pensionResult.earlyRetirementFactor,
                    retiredPayMultiplier:
                        pensionResult.retiredPayMultiplier,
                    retirementPlan:
                        pensionResult.metadata?.retirementPlan
                }
            });
        }
    });

    return incomeSources;
}

export function saveProjectionSnapshot(payload) {
    sessionStorage.setItem(
        "retirementProjection",
        JSON.stringify(payload)
    );
}
