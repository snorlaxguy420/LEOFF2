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

        if (
            additionalPension.system === "PERS2" &&
            additionalPension.serviceYears > 0 &&
            additionalPension.averageFinalCompensation > 0 &&
            additionalPension.retirementAge > 0
        ) {
            const pensionCalculator = getPensionCalculator("PERS2");
            const pensionResult = pensionCalculator({
                serviceYears: additionalPension.serviceYears,
                retirementAge: additionalPension.retirementAge,
                averageFinalCompensation:
                    additionalPension.averageFinalCompensation,
                hireDate: additionalPension.hireDate
            });

            incomeSources.push({
                type: "fixed",
                name: "PERS Plan 2 Pension",
                annualAmount: pensionResult.annualBenefit,
                startAge: pensionResult.startAge,
                growthRate: 0,
                taxable: true,
                taxCategory: "ordinary_income"
            });
        }

        if (
            additionalPension.system === "TRS2" &&
            additionalPension.serviceYears > 0 &&
            additionalPension.averageFinalCompensation > 0 &&
            additionalPension.retirementAge > 0
        ) {
            const pensionCalculator = getPensionCalculator("TRS2");
            const pensionResult = pensionCalculator({
                serviceYears: additionalPension.serviceYears,
                retirementAge: additionalPension.retirementAge,
                averageFinalCompensation:
                    additionalPension.averageFinalCompensation,
                hireDate: additionalPension.hireDate
            });

            incomeSources.push({
                type: "fixed",
                name: "TRS Plan 2 Pension",
                annualAmount: pensionResult.annualBenefit,
                startAge: pensionResult.startAge,
                growthRate: 0,
                taxable: true,
                taxCategory: "ordinary_income"
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
