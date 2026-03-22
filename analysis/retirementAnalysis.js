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

export function calculateReadinessScore(results, retireAge) {
    const readiness = scoreReadiness(results, retireAge);

    return {
        ...readiness,
        RetirementReadinessGrade: readiness.grade
    };
}

export function analyzeRetirementPlan({
    inputs,
    incomeSources,
    projection
}) {

    const results = projection?.results || [];
    const earliestRetirementAge =
        calculateEarliestRetirementAge({ inputs, incomeSources });
    const financialFreedomAge =
        calculateFinancialFreedomAge({ inputs, incomeSources });
    const recommendedRetirementAge =
        calculateRecommendedRetirementAge({ inputs, incomeSources });
    const retirementFailureAge =
        calculateRetirementFailureAge(results);
    const readiness =
        calculateReadinessScore(results, inputs?.retireAge);
    const assetDepletionAge =
        (results || []).find(result => totalPortfolio(result) <= 0)?.age
        ?? null;

    return {
        earliestRetirementAge,
        financialFreedomAge,
        recommendedRetirementAge,
        retirementFailureAge,
        assetDepletionAge,
        readinessScore: readiness.score,
        readinessGrade: readiness.grade,
        RetirementReadinessGrade: readiness.RetirementReadinessGrade
    };
}
