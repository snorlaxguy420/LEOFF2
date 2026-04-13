import { runProjection } from "../core/projectionEngine.js";
import {
    calculateSocialSecurityFRA,
    calculateSocialSecurityIncomeSource,
    normalizeSocialSecurityFraBenefit
} from "../core/socialSecurityEngine.js";
import { simulationStateToInputs } from "../core/simulationState.js";
import { analyzeRetirementPlan } from "./retirementAnalysis.js";

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function formatCurrency(value) {
    return "$" + Math.round(value || 0).toLocaleString();
}

function formatMonthlyCurrency(value) {
    return "$" + Math.round(value || 0).toLocaleString() + "/mo";
}

function totalPortfolio(result = {}) {
    if (!result?.portfolios) {
        return 0;
    }

    return Object.values(result.portfolios)
        .reduce((sum, portfolioValue) => sum + (portfolioValue || 0), 0);
}

function findResultAtOrAfterAge(results = [], targetAge = null) {
    if (!Number.isFinite(targetAge)) {
        return results[0] || null;
    }

    return results.find(result => (result?.age ?? 0) >= targetAge) ||
        results[results.length - 1] ||
        null;
}

function sumSocialSecurityIncomeThroughAge(results = [], targetAge = 85) {
    return (results || [])
        .filter(result => (result?.age ?? 0) <= targetAge)
        .reduce((sum, result) => {
            return sum + (result?.breakdown?.["Social Security"] || 0);
        }, 0);
}

function formatAgeLabel(age) {
    if (!Number.isFinite(age)) {
        return "--";
    }

    const years = Math.floor(age);
    const remainingMonths =
        Math.round((age - years) * 12);

    if (!remainingMonths) {
        return `Age ${years}`;
    }

    return `Age ${years}y ${remainingMonths}m`;
}

function formatClaimAgeShort(age) {
    if (!Number.isFinite(age)) {
        return "--";
    }

    const years = Math.floor(age);
    const remainingMonths =
        Math.round((age - years) * 12);

    if (!remainingMonths) {
        return String(years);
    }

    return `${years}y ${remainingMonths}m`;
}

function buildLateLifeSecurityText(option, bestMonthlyBenefit) {
    const monthlyGap =
        (bestMonthlyBenefit || 0) - (option?.monthlyBenefit || 0);

    if (monthlyGap <= 0) {
        return "This option gives you the strongest guaranteed late-life check.";
    }

    return `This option gives up about ${formatMonthlyCurrency(monthlyGap)} versus the strongest delayed-income choice.`;
}

function formatSignedCurrency(value, monthly = false) {
    const rounded = Math.round(value || 0);
    const formatted =
        "$" + Math.abs(rounded).toLocaleString() + (monthly ? "/mo" : "");

    if (!rounded) {
        return "$0" + (monthly ? "/mo" : "");
    }

    return `${rounded > 0 ? "+" : "-"}${formatted}`;
}

function getBridgeStrainLabel(option) {
    const bridgeRatio =
        (option?.retirementYearGap || 0) /
        Math.max(option?.retirementYearExpenses || 1, 1);
    const drawRatio =
        (option?.bridgePortfolioDraw || 0) /
        Math.max(option?.retirementPortfolio || 1, 1);

    if (bridgeRatio >= 0.28 || drawRatio >= 0.32 || (option?.bridgeYears || 0) >= 8) {
        return "High";
    }

    if (bridgeRatio >= 0.12 || drawRatio >= 0.16 || (option?.bridgeYears || 0) >= 4) {
        return "Moderate";
    }

    return "Low";
}

function buildOptionBestFor(option) {
    if (!option) {
        return "General comparison";
    }

    if (option.claimAge >= 69.5) {
        return "Late-life income protection";
    }

    if (option.claimAge <= 62.1) {
        return "Near-term cash flow relief";
    }

    return "Balanced middle-ground timing";
}

function buildOptionNarrative(option, bestMonthlyBenefit) {
    const bridgeText =
        option.bridgeYears > 0
            ? `It creates about ${option.bridgeYears.toFixed(option.bridgeYears % 1 ? 1 : 0)} bridge year${option.bridgeYears === 1 ? "" : "s"} from retirement to claiming.`
            : "It starts right away from the retirement timeline shown here.";
    const gapText =
        option.retirementYearGap > 0
            ? `The first retirement year still shows about ${formatCurrency(option.retirementYearGap)} of spending pressure.`
            : "The first retirement year stays covered in this plan.";
    const bridgeDrawText =
        option.bridgePortfolioDraw > 0
            ? `The plan appears to spend roughly ${formatCurrency(option.bridgePortfolioDraw)} from the portfolio before Social Security begins.`
            : "The plan does not appear to need material bridge withdrawals before Social Security begins.";

    return `${bridgeText} ${gapText} ${bridgeDrawText} ${buildLateLifeSecurityText(option, bestMonthlyBenefit)}`;
}

function buildRecommendationConfidence(bestOption, runnerUp) {
    if (!bestOption || !runnerUp) {
        return "No comparison confidence yet";
    }

    const scoreGap =
        (bestOption?.claimFitScore || 0) -
        (runnerUp?.claimFitScore || 0);

    if (scoreGap >= 12) {
        return "Clear lead";
    }

    if (scoreGap >= 5) {
        return "Moderate lead";
    }

    return "Close call";
}

function buildRecommendationSummary(bestOption, runnerUp) {
    if (!bestOption) {
        return "Claiming guidance is not available yet.";
    }

    const confidence =
        buildRecommendationConfidence(bestOption, runnerUp);

    if (bestOption.claimAge >= 69.5) {
        return confidence === "Close call"
            ? "This is a relatively close decision, but the current plan still looks sturdy enough to wait for the larger delayed benefit."
            : "This plan looks strong enough to carry the bridge, so delaying appears to buy better late-life income protection.";
    }

    if (bestOption.claimAge <= 62.1) {
        return confidence === "Close call"
            ? "This is a relatively close decision, but early claiming still does the most to reduce bridge strain and support early cash flow."
            : "This plan shows enough early-retirement pressure that claiming earlier helps support cash flow and reduces bridge strain.";
    }

    return confidence === "Close call"
        ? "This is a close decision overall, and full retirement age looks like the cleanest compromise between earlier cash flow and delayed-income upside."
        : "Full retirement age looks like the best balance between near-term cash flow and delayed-income upside for this plan.";
}

function buildRecommendationHeadline(bestOption) {
    if (!bestOption) {
        return "Social Security optimizer unavailable yet";
    }

    return `Recommended claiming age: ${bestOption.label}`;
}

function buildRecommendationWhy(bestOption, runnerUp) {
    if (!bestOption) {
        return "Add a complete Social Security estimate to compare claiming paths.";
    }

    const scoreGap =
        Math.max(
            0,
            (bestOption?.claimFitScore || 0) -
            (runnerUp?.claimFitScore || 0)
        );
    const confidence =
        buildRecommendationConfidence(bestOption, runnerUp);
    const liftVs62 =
        (bestOption?.monthlyBenefit || 0) -
        (bestOption?.base62MonthlyBenefit || 0);

    if (bestOption.claimAge >= 69.5) {
        return `${confidence}: delaying protects later-life guaranteed income by about ${formatMonthlyCurrency(liftVs62)} versus age 62, and the bridge strain stays ${String(bestOption.bridgeStrain || "manageable").toLowerCase()}.`;
    }

    if (bestOption.claimAge <= 62.1) {
        return `${confidence}: claiming earlier reduces bridge pressure now, with about ${formatCurrency(bestOption.bridgePortfolioDraw || 0)} less portfolio strain before benefits begin.`;
    }

    return `${confidence}: full retirement age keeps more delayed-income upside than age 62 without asking the plan to carry as much bridge strain as age 70.`;
}

function buildCrossoverAge(laterOption, earlierOption) {
    if (!laterOption || !earlierOption) {
        return null;
    }

    const missedIncome =
        (earlierOption.annualBenefit || 0) *
        Math.max(0, (laterOption.claimAge || 0) - (earlierOption.claimAge || 0));
    const annualLift =
        (laterOption.annualBenefit || 0) -
        (earlierOption.annualBenefit || 0);

    if (annualLift <= 0) {
        return null;
    }

    return laterOption.claimAge + (missedIncome / annualLift);
}

function replaceSocialSecuritySource(incomeSources = [], replacement = null) {
    const filteredSources = (incomeSources || []).filter(source => {
        return !(
            source?.name === "Social Security" ||
            source?.taxCategory === "social_security"
        );
    });

    return replacement
        ? [...filteredSources, replacement]
        : filteredSources;
}

function buildVariantSimulationState(simulationState = {}, claimAge) {
    const nextSocialSecurity = {
        ...(simulationState?.socialSecurity || {}),
        claimAge
    };
    const socialSecuritySource =
        calculateSocialSecurityIncomeSource(nextSocialSecurity);
    const nextIncomeSources =
        replaceSocialSecuritySource(
            simulationState?.incomeSources || [],
            socialSecuritySource
        );

    return {
        ...structuredClone(simulationState),
        socialSecurity: nextSocialSecurity,
        incomeSources: nextIncomeSources
    };
}

function normalizeValue(value, min, max) {
    if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
        return 0;
    }

    if (max <= min) {
        return 1;
    }

    return (value - min) / (max - min);
}

function buildClaimFitScore(option, ranges = {}) {
    const readinessComponent = (option?.readinessScore || 0) * 0.55;
    const benefitComponent =
        normalizeValue(
            option?.monthlyBenefit || 0,
            ranges?.monthlyBenefitMin || 0,
            ranges?.monthlyBenefitMax || 0
        ) * 12;
    const cumulativeComponent =
        normalizeValue(
            option?.cumulativeTo85 || 0,
            ranges?.cumulativeTo85Min || 0,
            ranges?.cumulativeTo85Max || 0
        ) * 8;
    const endNetWorthComponent =
        normalizeValue(
            option?.endingNetWorth || 0,
            ranges?.endingNetWorthMin || 0,
            ranges?.endingNetWorthMax || 0
        ) * 8;
    const bridgePortfolioPenalty =
        normalizeValue(
            option?.bridgePortfolioDraw || 0,
            ranges?.bridgePortfolioDrawMin || 0,
            ranges?.bridgePortfolioDrawMax || 0
        ) * 14;
    const bridgePenalty =
        option?.retirementYearGap > 0
            ? Math.min(
                18,
                ((option.retirementYearGap / Math.max(option.retirementYearExpenses || 1, 1)) * 28) +
                ((option.bridgeYears || 0) * 1.8)
            )
            : Math.min(6, (option.bridgeYears || 0) * 0.8);
    const depletionPenalty =
        option?.assetDepletionAge == null
            ? 0
            : option.assetDepletionAge < 85
                ? 12
                : 6;
    const deficitPenalty =
        option?.retirementFailureAge == null
            ? 0
            : option.retirementFailureAge < 85
                ? 10
                : 5;

    return Math.round(
        clamp(
            readinessComponent +
            benefitComponent +
            cumulativeComponent +
            endNetWorthComponent -
            bridgePortfolioPenalty -
            bridgePenalty -
            depletionPenalty -
            deficitPenalty,
            0,
            100
        )
    );
}

export function buildSocialSecurityOptimization({
    simulationState = {}
} = {}) {
    const socialSecurity = simulationState?.socialSecurity || {};
    const birthYear = socialSecurity?.birthYear;
    const fraBenefit =
        normalizeSocialSecurityFraBenefit(socialSecurity);
    const retireAge =
        simulationState?.profile?.retirementAge ??
        simulationState?.retireAge ??
        simulationState?.pension?.retirementAge ??
        null;

    if (!Number.isFinite(birthYear) || !fraBenefit || !Number.isFinite(retireAge)) {
        return {
            available: false,
            headline: "Social Security optimizer unavailable yet",
            summary:
                "Add birth year, a Social Security benefit estimate, and a retirement age to compare claiming choices.",
            highlights: {},
            options: [],
            notes: []
        };
    }

    const fra = calculateSocialSecurityFRA(birthYear);
    const candidates = [
        { key: "62", claimAge: 62, label: "Age 62" },
        { key: "fra", claimAge: fra, label: `FRA (${formatClaimAgeShort(fra)})` },
        { key: "70", claimAge: 70, label: "Age 70" }
    ];
    const options = candidates.map(candidate => {
        const variantSimulationState =
            buildVariantSimulationState(
                simulationState,
                candidate.claimAge
            );
        const variantInputs =
            simulationStateToInputs(variantSimulationState);
        const variantProjection =
            runProjection(variantSimulationState);
        const variantAnalysis =
            analyzeRetirementPlan({
                inputs: variantInputs,
                incomeSources: variantSimulationState.incomeSources || [],
                projection: variantProjection
            });
        const socialSecuritySource =
            calculateSocialSecurityIncomeSource({
                ...socialSecurity,
                claimAge: candidate.claimAge
            });
        const results = variantProjection?.results || [];
        const retirementYearResult =
            findResultAtOrAfterAge(results, retireAge);
        const age85Result =
            findResultAtOrAfterAge(results, 85);
        const lastResult =
            results[results.length - 1] || null;
        const claimStartResult =
            findResultAtOrAfterAge(results, candidate.claimAge);
        const retirementPortfolio =
            totalPortfolio(retirementYearResult);
        const claimStartPortfolio =
            totalPortfolio(claimStartResult);

        return {
            ...candidate,
            monthlyBenefit:
                socialSecuritySource?.metadata?.monthlyBenefit || 0,
            annualBenefit:
                socialSecuritySource?.annualAmount || 0,
            bridgeYears: Math.max(0, candidate.claimAge - retireAge),
            readinessScore: variantAnalysis?.readinessScore || 0,
            readinessBand: variantAnalysis?.readinessBand || "Fragile",
            retirementFailureAge: variantAnalysis?.retirementFailureAge,
            assetDepletionAge: variantAnalysis?.assetDepletionAge,
            retirementYearGap:
                Math.max(
                    0,
                    (retirementYearResult?.expenses || 0) -
                    (retirementYearResult?.income || 0)
                ),
            retirementYearExpenses:
                retirementYearResult?.expenses || 0,
            retirementPortfolio,
            claimStartPortfolio,
            bridgePortfolioDraw:
                Math.max(0, retirementPortfolio - claimStartPortfolio),
            cumulativeTo85:
                sumSocialSecurityIncomeThroughAge(results, 85),
            age85SocialSecurity:
                age85Result?.breakdown?.["Social Security"] || 0,
            endingNetWorth:
                lastResult?.netWorth || 0,
            endingPortfolio:
                totalPortfolio(lastResult),
            variantProjection,
            variantAnalysis
        };
    });

    const ranges = {
        monthlyBenefitMin:
            Math.min(...options.map(option => option.monthlyBenefit)),
        monthlyBenefitMax:
            Math.max(...options.map(option => option.monthlyBenefit)),
        cumulativeTo85Min:
            Math.min(...options.map(option => option.cumulativeTo85)),
        cumulativeTo85Max:
            Math.max(...options.map(option => option.cumulativeTo85)),
        endingNetWorthMin:
            Math.min(...options.map(option => option.endingNetWorth)),
        endingNetWorthMax:
            Math.max(...options.map(option => option.endingNetWorth)),
        bridgePortfolioDrawMin:
            Math.min(...options.map(option => option.bridgePortfolioDraw)),
        bridgePortfolioDrawMax:
            Math.max(...options.map(option => option.bridgePortfolioDraw))
    };

    options.forEach(option => {
        option.bridgeStrain = getBridgeStrainLabel(option);
        option.bestFor = buildOptionBestFor(option);
        option.claimFitScore =
            buildClaimFitScore(option, ranges);
    });

    const rankedOptions =
        [...options]
            .sort((a, b) => {
                if (b.claimFitScore !== a.claimFitScore) {
                    return b.claimFitScore - a.claimFitScore;
                }

                return b.monthlyBenefit - a.monthlyBenefit;
            });
    const bestOption = rankedOptions[0] || null;
    const runnerUp = rankedOptions[1] || null;
    const bestMonthlyBenefit =
        Math.max(...options.map(option => option.monthlyBenefit));
    const option62 =
        options.find(option => option.key === "62");
    const optionFra =
        options.find(option => option.key === "fra");
    const option70 =
        options.find(option => option.key === "70");

    options.forEach(option => {
        option.isRecommended = option === bestOption;
        option.base62MonthlyBenefit = option62?.monthlyBenefit || 0;
        option.monthlyLiftVs62 =
            (option?.monthlyBenefit || 0) -
            (option62?.monthlyBenefit || 0);
        option.monthlyLiftVsFra =
            (option?.monthlyBenefit || 0) -
            (optionFra?.monthlyBenefit || 0);
        option.narrative =
            buildOptionNarrative(option, bestMonthlyBenefit);
    });

    const crossoverFra =
        buildCrossoverAge(optionFra, option62);
    const crossover70 =
        buildCrossoverAge(option70, option62);
    const crossover70VsFra =
        buildCrossoverAge(option70, optionFra);
    const recommendationWhy =
        buildRecommendationWhy(bestOption, runnerUp);

    return {
        available: true,
        headline: buildRecommendationHeadline(bestOption),
        summary: buildRecommendationSummary(bestOption, runnerUp),
        highlights: {
            recommendedAge: bestOption?.label || "--",
            recommendedMonthlyBenefit:
                formatMonthlyCurrency(bestOption?.monthlyBenefit || 0),
            cumulativeTo85:
                formatCurrency(bestOption?.cumulativeTo85 || 0),
            recommendationWhy
        },
        options: options.map(option => ({
            title: option.label,
            badge: option.isRecommended ? "Best Fit" : "",
            bestFor: option.bestFor,
            claimFitScore: option.claimFitScore,
            monthlyBenefit:
                formatMonthlyCurrency(option.monthlyBenefit),
            annualBenefit:
                formatCurrency(option.annualBenefit),
            monthlyLiftVs62:
                formatSignedCurrency(option.monthlyLiftVs62, true),
            bridgeYears:
                option.bridgeYears > 0
                    ? option.bridgeYears.toFixed(option.bridgeYears % 1 ? 1 : 0)
                    : "0",
            bridgeStrain: option.bridgeStrain,
            bridgePortfolioDraw:
                option.bridgePortfolioDraw > 0
                    ? formatCurrency(option.bridgePortfolioDraw)
                    : "Minimal",
            readiness:
                `${option.readinessScore} / 100 (${option.readinessBand})`,
            firstDeficitAge:
                option.retirementFailureAge ?? "Never",
            assetDepletionAge:
                option.assetDepletionAge ?? "Never",
            cumulativeTo85:
                formatCurrency(option.cumulativeTo85),
            endingNetWorth:
                formatCurrency(option.endingNetWorth),
            narrative: option.narrative
        })),
        notes: [
            {
                label: "Current FRA",
                value: formatAgeLabel(fra)
            },
            {
                label: "Recommendation read",
                value: recommendationWhy
            },
            {
                label: "62 vs FRA crossover",
                value: crossoverFra
                    ? formatAgeLabel(crossoverFra)
                    : "No clear crossover"
            },
            {
                label: "62 vs 70 crossover",
                value: crossover70
                    ? formatAgeLabel(crossover70)
                    : "No clear crossover"
            },
            {
                label: "FRA vs 70 crossover",
                value: crossover70VsFra
                    ? formatAgeLabel(crossover70VsFra)
                    : "No clear crossover"
            },
            {
                label: "Why this wins",
                value:
                    bestOption?.claimAge >= 69.5
                        ? "The current plan looks sturdy enough to wait for a bigger guaranteed check."
                        : bestOption?.claimAge <= 62.1
                            ? "The plan shows enough bridge pressure that earlier claiming helps support near-term cash flow."
                            : "Full retirement age looks like the cleaner middle ground between cash flow and delayed-income upside."
            }
        ]
    };
}
