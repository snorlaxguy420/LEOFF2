import { calculateReadinessScore as scoreReadiness } from "./readinessScore.js";
import { compareRetirementAges } from "./retirementScenarios.js";

function totalPortfolio(result) {
    if (!result?.portfolios) return 0;

    return Object.values(result.portfolios)
        .reduce((sum, value) => sum + (value || 0), 0);
}

export function calculateEarliestRetirementAge({ inputs, incomeSources }) {
    return compareRetirementAges({ inputs, incomeSources })
        .earliestSustainableAge;
}

export function calculateFinancialFreedomAge({ inputs, incomeSources }) {
    return compareRetirementAges({ inputs, incomeSources })
        .financialFreedomAge;
}

export function calculateRecommendedRetirementAge({ inputs, incomeSources }) {
    return compareRetirementAges({ inputs, incomeSources })
        .recommendedRetirementAge;
}

export function calculateRetirementFailureAge(results) {
    const failureYear = (results || [])
        .find(result => result.expenses > result.income);

    return failureYear?.age ?? null;
}

export function calculateReadinessScore(results, retireAge, options = {}) {
    const readiness = scoreReadiness(results, retireAge, options);

    return {
        ...readiness,
        RetirementReadinessGrade: readiness.grade
    };
}

export function analyzeRetirementPlan({
    inputs,
    incomeSources,
    projection,
    monteCarloSummary = null
}) {

    const results = projection?.results || [];
    const comparison =
        compareRetirementAges({ inputs, incomeSources });
    const retirementFailureAge =
        calculateRetirementFailureAge(results);
    const readiness =
        calculateReadinessScore(results, inputs?.retireAge, {
            monteCarlo: monteCarloSummary
        });
    const assetDepletionAge =
        (results || []).find(result => totalPortfolio(result) <= 0)?.age
        ?? null;

    return {
        earliestRetirementAge:
            comparison.earliestSustainableAge,
        financialFreedomAge:
            comparison.financialFreedomAge,
        recommendedRetirementAge:
            comparison.recommendedRetirementAge,
        recommendedMonteCarloSuccessThreshold:
            comparison.recommendedMonteCarloSuccessThreshold,
        retirementFailureAge,
        assetDepletionAge,
        readinessScore: readiness.score,
        readinessGrade: readiness.grade,
        readinessBreakdown: readiness.breakdown,
        readinessMaxScores: readiness.maxScores,
        readinessProbabilityAdjusted: readiness.probabilityAdjusted,
        monteCarloDurabilityRatio:
            readiness.monteCarloDurabilityRatio,
        RetirementReadinessGrade: readiness.RetirementReadinessGrade
    };
}
