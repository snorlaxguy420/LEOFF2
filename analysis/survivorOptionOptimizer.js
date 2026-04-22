import { runProjection } from "../core/projectionEngine.js";
import { simulationStateToInputs } from "../core/simulationState.js";
import { analyzeRetirementPlan } from "./retirementAnalysis.js";
import { getPensionCalculator } from "../pensions/pensionRegistry.js";
import { normalizeLeoffSurvivorOption } from "../ui/simulatorShared.js";

const LEOFF2_SURVIVOR_OPTIONS = Object.freeze([
    Object.freeze({
        inputValue: "none",
        engineValue: "SINGLE",
        label: "Single Life",
        shortLabel: "No survivor"
    }),
    Object.freeze({
        inputValue: "50%",
        engineValue: "JOINT_50",
        label: "50% Survivor",
        shortLabel: "50%"
    }),
    Object.freeze({
        inputValue: "66%",
        engineValue: "JOINT_66",
        label: "66.67% Survivor",
        shortLabel: "66.67%"
    }),
    Object.freeze({
        inputValue: "100%",
        engineValue: "JOINT_100",
        label: "100% Survivor",
        shortLabel: "100%"
    })
]);

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function formatCurrency(value) {
    return "$" + Math.round(value || 0).toLocaleString();
}

function formatMonthlyCurrency(value) {
    return "$" + Math.round(value || 0).toLocaleString() + "/mo";
}

function formatPercent(value) {
    return `${Math.round((value || 0) * 100)}%`;
}

function formatAgeLabel(age) {
    return Number.isFinite(age)
        ? `Age ${age}`
        : "--";
}

function formatSignedCurrency(value) {
    const rounded = Math.round(value || 0);

    if (!rounded) {
        return "$0";
    }

    return `${rounded > 0 ? "+" : "-"}$${Math.abs(rounded).toLocaleString()}`;
}

function replaceLeoffIncomeSources(incomeSources = [], replacementSources = []) {
    const filteredSources = (incomeSources || []).filter(source => {
        return source?.name !== "LEOFF Pension" &&
            source?.name !== "LEOFF Lump Sum";
    });

    return [...filteredSources, ...replacementSources];
}

function buildLeoffIncomeSources({
    inputs,
    retireAge,
    survivorOption
}) {
    const leoffCalculator = getPensionCalculator("LEOFF2");
    const normalizedSurvivorOption =
        normalizeLeoffSurvivorOption(survivorOption);
    const pensionResult = leoffCalculator({
        serviceYears: inputs?.pension?.serviceYears,
        retirementAge: retireAge,
        finalAverageSalary: inputs?.pension?.finalAverageSalary,
        colaOverride: inputs?.pension?.cola,
        benefitEnhancement:
            inputs?.pension?.benefitEnhancement || "tiered_multiplier",
        survivorOption: normalizedSurvivorOption,
        survivorAge:
            normalizedSurvivorOption !== "SINGLE"
                ? inputs?.pension?.survivorAge
                : null
    });
    const incomeSources = [
        {
            type: "fixed",
            name: "LEOFF Pension",
            annualAmount: pensionResult.annualBenefit,
            startAge: pensionResult.startAge,
            growthRate: pensionResult.cola,
            taxable: true,
            taxCategory: "ordinary_income"
        }
    ];

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

    return {
        pensionResult,
        incomeSources
    };
}

function getRetirementYearResult(results = [], retireAge = null) {
    if (!Array.isArray(results) || !results.length) {
        return null;
    }

    if (!Number.isFinite(retireAge)) {
        return results[0] || null;
    }

    return results.find(result => (result?.age ?? retireAge) >= retireAge) ||
        results[results.length - 1] ||
        null;
}

function getHouseholdNeedMultiplier({
    spouseAnnualIncome = 0,
    spouseRetirementAge = null,
    retireAge = null
}) {
    let multiplier = spouseAnnualIncome > 0 ? 0.8 : 1.15;

    if (
        Number.isFinite(spouseRetirementAge) &&
        Number.isFinite(retireAge) &&
        spouseRetirementAge <= retireAge
    ) {
        multiplier += 0.2;
    }

    return clamp(multiplier, 0.65, 1.35);
}

function getBestForLabel(option = {}) {
    if (option?.engineValue === "SINGLE") {
        return "Max current pension";
    }

    if (option?.engineValue === "JOINT_100") {
        return "Max spouse income floor";
    }

    if (option?.engineValue === "JOINT_66") {
        return "Balanced household durability";
    }

    return "Moderate protection with more current income";
}

function buildOptionNarrative({
    option,
    essentialCoverageRatio,
    giveUpVsSingle,
    retirementMargin
}) {
    const coverageText =
        essentialCoverageRatio >= 1
            ? "The survivor pension alone roughly covers essential spending."
            : `The survivor pension covers about ${formatPercent(essentialCoverageRatio)} of essential spending.`;
    const giveUpText =
        giveUpVsSingle > 0
            ? `It gives up about ${formatMonthlyCurrency(giveUpVsSingle)} of monthly pension while you are alive versus single life.`
            : "It keeps the full current-life pension amount.";
    const marginText =
        retirementMargin >= 0
            ? `The selected retirement year still shows a positive margin of ${formatSignedCurrency(retirementMargin)}.`
            : `The selected retirement year shows a deficit of ${formatCurrency(Math.abs(retirementMargin))}.`;

    return `${coverageText} ${giveUpText} ${marginText}`;
}

function buildFitScore({
    readinessScore = 0,
    essentialCoverageRatio = 0,
    giveUpRatio = 0,
    retirementMarginRatio = 0,
    needMultiplier = 1,
    survivorPercent = 0
}) {
    const readinessComponent = readinessScore * 0.5;
    const protectionComponent =
        clamp(essentialCoverageRatio, 0, 1.2) * 28 * needMultiplier;
    const survivorPercentComponent =
        survivorPercent * 18 * needMultiplier;
    const giveUpPenalty =
        clamp(giveUpRatio, 0, 1) * 26;
    const marginPenalty =
        retirementMarginRatio < 0
            ? clamp(Math.abs(retirementMarginRatio), 0, 1) * 22
            : 0;
    const noSurvivorPenalty =
        survivorPercent === 0
            ? 16 * needMultiplier
            : 0;

    return Math.round(
        clamp(
            readinessComponent +
            protectionComponent +
            survivorPercentComponent -
            giveUpPenalty -
            marginPenalty -
            noSurvivorPenalty,
            0,
            100
        )
    );
}

export function buildSurvivorOptionOptimization({
    simulationState = {}
} = {}) {
    const inputs = simulationStateToInputs(simulationState);
    const retireAge =
        inputs?.retireAge ??
        inputs?.profile?.retirementAge ??
        simulationState?.retireAge ??
        null;
    const spouse =
        inputs?.profile?.spouse ||
        simulationState?.profile?.spouse ||
        null;
    const spouseAge =
        spouse?.currentAge ??
        spouse?.age ??
        inputs?.pension?.survivorAge ??
        null;
    const spouseAnnualIncome =
        spouse?.annualIncome ?? 0;
    const spouseRetirementAge =
        spouse?.retirementAge ?? null;
    const essentialAnnualExpenses =
        simulationState?.expenses?.essentialAnnual ||
        simulationState?.expenses?.annual ||
        inputs?.expenses?.essentialAnnual ||
        inputs?.expenses?.annual ||
        0;

    if (!spouse) {
        return {
            available: false,
            headline: "Premium survivor-option guidance",
            summary:
                "Add spouse profile details to compare survivor options against the household plan.",
            highlights: {},
            options: [],
            notes: [],
            exportText: ""
        };
    }

    if (
        !Number.isFinite(retireAge) ||
        (inputs?.pension?.serviceYears || 0) <= 0 ||
        (inputs?.pension?.finalAverageSalary || 0) <= 0 ||
        !Number.isFinite(spouseAge)
    ) {
        return {
            available: false,
            headline: "Premium survivor-option guidance",
            summary:
                "Add retirement age, service years, final average salary, and spouse age to compare survivor options against the household plan.",
            highlights: {},
            options: [],
            notes: [],
            exportText: ""
        };
    }

    const needMultiplier =
        getHouseholdNeedMultiplier({
            spouseAnnualIncome,
            spouseRetirementAge,
            retireAge
        });
    const options = LEOFF2_SURVIVOR_OPTIONS.map(option => {
        const variantInputs = structuredClone(inputs);
        variantInputs.pension = {
            ...(variantInputs.pension || {}),
            survivorOption: option.inputValue,
            survivorAge: spouseAge
        };

        const {
            pensionResult,
            incomeSources: leoffIncomeSources
        } = buildLeoffIncomeSources({
            inputs: variantInputs,
            retireAge,
            survivorOption: option.inputValue
        });
        const variantSimulationState = structuredClone(simulationState);

        variantSimulationState.incomeSources =
            replaceLeoffIncomeSources(
                simulationState?.incomeSources || [],
                leoffIncomeSources
            );
        const variantProjection =
            runProjection(variantSimulationState);
        const variantAnalysis =
            analyzeRetirementPlan({
                inputs: variantInputs,
                incomeSources: variantSimulationState.incomeSources,
                projection: variantProjection
            });
        const retirementYear =
            getRetirementYearResult(
                variantProjection?.results || [],
                retireAge
            );

        return {
            ...option,
            pensionResult,
            readinessScore: variantAnalysis?.readinessScore || 0,
            readinessBand: variantAnalysis?.readinessBand || "Fragile",
            retirementFailureAge: variantAnalysis?.retirementFailureAge,
            assetDepletionAge: variantAnalysis?.assetDepletionAge,
            retirementMargin:
                (retirementYear?.income || 0) -
                (retirementYear?.expenses || 0),
            retirementExpenses:
                retirementYear?.expenses || 0
        };
    });
    const singleLife =
        options.find(option => option.engineValue === "SINGLE") ||
        options[0];

    options.forEach(option => {
        const giveUpAnnual =
            (singleLife?.pensionResult?.annualBenefit || 0) -
            (option?.pensionResult?.annualBenefit || 0);
        const giveUpRatio =
            giveUpAnnual /
            Math.max(singleLife?.pensionResult?.annualBenefit || 1, 1);
        const essentialCoverageRatio =
            (option?.pensionResult?.survivorAnnualBenefit || 0) /
            Math.max(essentialAnnualExpenses || 1, 1);
        const retirementMarginRatio =
            option.retirementMargin /
            Math.max(option.retirementExpenses || 1, 1);

        option.essentialCoverageRatio = essentialCoverageRatio;
        option.giveUpAnnual = giveUpAnnual;
        option.giveUpVsSingle =
            (singleLife?.pensionResult?.monthlyBenefit || 0) -
            (option?.pensionResult?.monthlyBenefit || 0);
        option.fitScore = buildFitScore({
            readinessScore: option.readinessScore,
            essentialCoverageRatio,
            giveUpRatio,
            retirementMarginRatio,
            needMultiplier,
            survivorPercent:
                option?.pensionResult?.survivorPercent || 0
        });
        option.bestFor = getBestForLabel(option);
        option.narrative = buildOptionNarrative({
            option,
            essentialCoverageRatio,
            giveUpVsSingle: option.giveUpVsSingle,
            retirementMargin: option.retirementMargin
        });
    });

    const rankedOptions =
        [...options].sort((left, right) => {
            if ((right.fitScore || 0) !== (left.fitScore || 0)) {
                return (right.fitScore || 0) - (left.fitScore || 0);
            }

            return (
                (right.pensionResult?.survivorAnnualBenefit || 0) -
                (left.pensionResult?.survivorAnnualBenefit || 0)
            );
        });
    const bestOption = rankedOptions[0] || null;
    const runnerUp = rankedOptions[1] || null;
    const scoreGap =
        Math.max(0, (bestOption?.fitScore || 0) - (runnerUp?.fitScore || 0));
    const recommendationConfidence =
        scoreGap >= 12
            ? "Clear lead"
            : scoreGap >= 5
                ? "Moderate lead"
                : "Close call";
    const summary =
        bestOption?.engineValue === "JOINT_100"
            ? `${recommendationConfidence}: the household setup leans toward stronger spouse protection, and 100% survivor looks like the cleanest income-floor choice without making the broader retirement plan collapse.`
            : bestOption?.engineValue === "JOINT_66"
                ? `${recommendationConfidence}: 66.67% survivor currently looks like the best household balance between protecting the spouse and keeping more current pension income.`
                : bestOption?.engineValue === "JOINT_50"
                    ? `${recommendationConfidence}: 50% survivor currently looks like the cleaner middle ground because the plan still needs more current income than the heavier-protection options leave behind.`
                    : `${recommendationConfidence}: single life currently preserves the strongest live pension check, and the broader plan does not look durable enough to absorb more give-up for survivor protection yet.`;
    const exportLines = [
        "LEOFF Helper Premium Survivor Option Guidance",
        "",
        `Selected retirement age: ${formatAgeLabel(retireAge)}`,
        `Spouse age: ${formatAgeLabel(spouseAge)}`,
        `Spouse retirement age: ${formatAgeLabel(spouseRetirementAge)}`,
        `Spouse current income: ${formatCurrency(spouseAnnualIncome)}`,
        `Essential annual expenses: ${formatCurrency(essentialAnnualExpenses)}`,
        `Recommended option: ${bestOption?.label || "--"} (${bestOption?.fitScore || 0} / 100)`,
        `Recommendation summary: ${summary}`,
        "",
        "Survivor option comparison:"
    ];

    options.forEach(option => {
        exportLines.push(
            [
                option.label,
                `Current pension ${formatMonthlyCurrency(option?.pensionResult?.monthlyBenefit || 0)}`,
                `Survivor pension ${formatMonthlyCurrency(option?.pensionResult?.survivorMonthlyBenefit || 0)}`,
                `Give-up vs single ${formatMonthlyCurrency(option.giveUpVsSingle || 0)}`,
                `Survivor essential coverage ${formatPercent(option.essentialCoverageRatio || 0)}`,
                `Readiness ${option.readinessScore || 0} / 100 (${option.readinessBand || "Fragile"})`,
                `Retirement margin ${formatSignedCurrency(option.retirementMargin || 0)}`,
                `Fit score ${option.fitScore || 0} / 100`
            ].join(" | ")
        );
    });

    return {
        available: true,
        headline: `Recommended survivor option: ${bestOption?.shortLabel || "--"}`,
        summary,
        highlights: {
            recommendedOption: bestOption?.label || "--",
            survivorIncome:
                formatMonthlyCurrency(
                    bestOption?.pensionResult?.survivorMonthlyBenefit || 0
                ),
            retireeGiveUp:
                bestOption?.giveUpVsSingle > 0
                    ? formatMonthlyCurrency(bestOption.giveUpVsSingle)
                    : "None",
            fitScore:
                `${bestOption?.fitScore || 0} / 100`
        },
        options: options.map(option => ({
            title: option.label,
            badge: option === bestOption ? "Best Fit" : "",
            bestFor: option.bestFor,
            fitScore: option.fitScore,
            currentMonthlyBenefit:
                formatMonthlyCurrency(
                    option?.pensionResult?.monthlyBenefit || 0
                ),
            survivorMonthlyBenefit:
                option?.pensionResult?.survivorMonthlyBenefit > 0
                    ? formatMonthlyCurrency(
                        option.pensionResult.survivorMonthlyBenefit
                    )
                    : "None",
            giveUpVsSingle:
                option.giveUpVsSingle > 0
                    ? formatMonthlyCurrency(option.giveUpVsSingle)
                    : "None",
            survivorCoverage:
                formatPercent(option.essentialCoverageRatio || 0),
            readiness:
                `${option.readinessScore} / 100 (${option.readinessBand})`,
            retirementMargin:
                formatSignedCurrency(option.retirementMargin || 0),
            firstDeficitAge:
                option.retirementFailureAge ?? "Never",
            assetDepletionAge:
                option.assetDepletionAge ?? "Never",
            narrative: option.narrative
        })),
        notes: [
            {
                label: "Confidence",
                value:
                    `${recommendationConfidence}. Score gap versus next option: ${scoreGap} points.`
            },
            {
                label: "Household context",
                value:
                    spouseAnnualIncome > 0
                        ? `Spouse income is currently ${formatCurrency(spouseAnnualIncome)} per year.`
                        : "The spouse does not currently have modeled employment income."
            },
            {
                label: "Spouse retirement",
                value:
                    Number.isFinite(spouseRetirementAge)
                        ? `Spouse retirement is currently modeled at ${formatAgeLabel(spouseRetirementAge)}.`
                        : "Spouse retirement age is not currently modeled."
            },
            {
                label: "Need multiplier",
                value:
                    needMultiplier >= 1
                        ? "The optimizer is leaning toward stronger survivor protection based on the current household setup."
                        : "The optimizer is allowing more weight for preserving current pension income because the spouse still has some modeled support."
            },
            {
                label: "Why this wins",
                value:
                    bestOption?.engineValue === "JOINT_100"
                        ? "The spouse protection benefit looks worth the current-life pension give-up in the current plan."
                        : bestOption?.engineValue === "JOINT_66"
                            ? "The 66.67% option looks like the cleanest compromise between current pension income and household durability."
                            : bestOption?.engineValue === "JOINT_50"
                                ? "The 50% option preserves more current income while still leaving a meaningful survivor floor."
                                : "The broader retirement plan currently values current pension income more than extra survivor protection."
            }
        ],
        exportText: exportLines.join("\n")
    };
}
