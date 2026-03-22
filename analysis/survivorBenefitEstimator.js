import { getPensionCalculator } from "../pensions/pensionRegistry.js";

export const SURVIVOR_OPTIONS = Object.freeze([
    Object.freeze({
        key: "SINGLE",
        label: "Single Life",
        shortLabel: "Single"
    }),
    Object.freeze({
        key: "JOINT_50",
        label: "50% Survivor",
        shortLabel: "50%"
    }),
    Object.freeze({
        key: "JOINT_66",
        label: "66.67% Survivor",
        shortLabel: "66.67%"
    }),
    Object.freeze({
        key: "JOINT_100",
        label: "100% Survivor",
        shortLabel: "100%"
    })
]);

export const DEFAULT_SURVIVOR_DURATION_YEARS = Object.freeze([1, 5, 10, 20]);

function sumGrowingAnnualPayments(annualAmount, growthRate, years) {
    const wholeYears = Math.max(0, Math.round(years || 0));

    if (wholeYears === 0 || annualAmount <= 0) {
        return 0;
    }

    if (!growthRate) {
        return annualAmount * wholeYears;
    }

    return annualAmount * ((Math.pow(1 + growthRate, wholeYears) - 1) / growthRate);
}

function estimateBreakEvenYears(singleAnnualBenefit, optionAnnualBenefit, survivorAnnualBenefit) {
    if (survivorAnnualBenefit <= 0) {
        return null;
    }

    const annualGap = Math.max(0, singleAnnualBenefit - optionAnnualBenefit);
    return Math.ceil(annualGap / survivorAnnualBenefit);
}

export function estimateLEOFF2SurvivorBenefitOptions({
    serviceYears,
    retirementAge,
    finalAverageSalary,
    cola = 0,
    benefitEnhancement = "tiered_multiplier",
    survivorAge = null,
    retireeYearsBeforeDeath = 1,
    survivorDurationYears = DEFAULT_SURVIVOR_DURATION_YEARS
}) {
    const calculateLEOFF2 = getPensionCalculator("LEOFF2");

    const optionResults = SURVIVOR_OPTIONS.map(option => {
        const pensionResult = calculateLEOFF2({
            serviceYears,
            retirementAge,
            finalAverageSalary,
            colaOverride: cola,
            benefitEnhancement,
            survivorOption: option.key,
            survivorAge
        });

        return {
            ...option,
            annualBenefit: pensionResult.annualBenefit,
            monthlyBenefit: pensionResult.monthlyBenefit,
            survivorAnnualBenefit: pensionResult.survivorAnnualBenefit,
            survivorMonthlyBenefit: pensionResult.survivorMonthlyBenefit,
            reductionApplied: pensionResult.reductionApplied,
            survivorPercent: pensionResult.survivorPercent
        };
    });

    const singleLife = optionResults.find(option => option.key === "SINGLE");

    return optionResults.map(option => {
        const deathScenarioValue =
            sumGrowingAnnualPayments(option.annualBenefit, cola, retireeYearsBeforeDeath);
        const survivorScenarioValues = survivorDurationYears.map(years => ({
            years,
            value:
                deathScenarioValue +
                sumGrowingAnnualPayments(option.survivorAnnualBenefit, cola, years)
        }));
        const noSurvivorUseValue = sumGrowingAnnualPayments(option.annualBenefit, cola, 20);

        return {
            ...option,
            retireeYearsBeforeDeath,
            survivorScenarioValues,
            noSurvivorUseValue,
            breakEvenSurvivorYears:
                option.key === "SINGLE"
                    ? null
                    : estimateBreakEvenYears(
                        singleLife?.annualBenefit || 0,
                        option.annualBenefit,
                        option.survivorAnnualBenefit
                    )
        };
    });
}
