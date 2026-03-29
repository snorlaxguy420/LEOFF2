/* =========================================================
RETIREMENT READINESS SCORE ENGINE
Consumes simulation results only
========================================================= */

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function buildDeterministicReadiness({
    coverageScore,
    essentialScore,
    longevityScore,
    earlyScore,
    marginScore
}) {
    const score = Math.round(
        coverageScore +
        essentialScore +
        longevityScore +
        earlyScore +
        marginScore
    );

    return {
        score,
        breakdown: {
            coverageScore,
            essentialScore,
            longevityScore,
            earlyScore,
            marginScore,
            monteCarloScore: null
        },
        maxScores: {
            coverageScore: 30,
            essentialScore: 20,
            longevityScore: 25,
            earlyScore: 15,
            marginScore: 10,
            monteCarloScore: null
        },
        probabilityAdjusted: false
    };
}

function buildMonteCarloDurabilityRatio({
    monteCarlo = {},
    retireAge,
    finalAge
}) {
    const successRate =
        clamp(monteCarlo?.successRate ?? 0, 0, 1);
    const essentialSuccessRate =
        clamp(monteCarlo?.essentialSuccessRate ?? 0, 0, 1);
    const medianReadinessRatio =
        clamp((monteCarlo?.medianReadinessScore ?? 0) / 100, 0, 1);
    const evaluationStartAge =
        Number.isFinite(retireAge)
            ? retireAge
            : 0;
    const evaluationEndAge =
        Number.isFinite(finalAge)
            ? finalAge
            : evaluationStartAge;
    const evaluationSpan =
        Math.max(1, evaluationEndAge - evaluationStartAge);
    const failureTimingRatio =
        Number.isFinite(monteCarlo?.medianFailureAge)
            ? clamp(
                (monteCarlo.medianFailureAge - evaluationStartAge) / evaluationSpan,
                0,
                1
            )
            : 1;
    const depletionTimingRatio =
        Number.isFinite(monteCarlo?.medianAssetDepletionAge)
            ? clamp(
                (monteCarlo.medianAssetDepletionAge - evaluationStartAge) / evaluationSpan,
                0,
                1
            )
            : 1;
    const timingDurabilityRatio =
        (failureTimingRatio + depletionTimingRatio) / 2;

    return clamp(
        (successRate * 0.45) +
        (essentialSuccessRate * 0.25) +
        (medianReadinessRatio * 0.2) +
        (timingDurabilityRatio * 0.1),
        0,
        1
    );
}

function applyMonteCarloOverlay({
    deterministic,
    monteCarlo,
    retireAge,
    finalAge
}) {
    if (!monteCarlo || typeof monteCarlo !== "object") {
        return deterministic;
    }

    const monteCarloDurabilityRatio =
        buildMonteCarloDurabilityRatio({
            monteCarlo,
            retireAge,
            finalAge
        });
    const breakdown = {
        coverageScore: deterministic.breakdown.coverageScore * 0.8,
        essentialScore: deterministic.breakdown.essentialScore * 0.8,
        longevityScore: deterministic.breakdown.longevityScore * 0.8,
        earlyScore: deterministic.breakdown.earlyScore * 0.8,
        marginScore: deterministic.breakdown.marginScore * 0.8,
        monteCarloScore: monteCarloDurabilityRatio * 20
    };
    const score = Math.round(
        breakdown.coverageScore +
        breakdown.essentialScore +
        breakdown.longevityScore +
        breakdown.earlyScore +
        breakdown.marginScore +
        breakdown.monteCarloScore
    );

    return {
        score,
        breakdown,
        maxScores: {
            coverageScore: 24,
            essentialScore: 16,
            longevityScore: 20,
            earlyScore: 12,
            marginScore: 8,
            monteCarloScore: 20
        },
        monteCarloDurabilityRatio,
        probabilityAdjusted: true
    };
}

export function calculateReadinessScore(results, retireAge, options = {}) {

    if (!results || !results.length) {
        return {
            score: 0,
            grade: "F",
            breakdown: {
                coverageScore: 0,
                essentialScore: 0,
                longevityScore: 0,
                earlyScore: 0,
                marginScore: 0,
                monteCarloScore: null
            },
            maxScores: {
                coverageScore: 30,
                essentialScore: 20,
                longevityScore: 25,
                earlyScore: 15,
                marginScore: 10,
                monteCarloScore: null
            },
            monteCarloDurabilityRatio: null,
            probabilityAdjusted: false
        };
    }

    const retirementYears = (results || [])
        .filter(result => {
            if (retireAge == null) return true;
            return (result?.age ?? retireAge) >= retireAge;
        });
    const evaluationYears =
        retirementYears.length
            ? retirementYears
            : results;

    let coverageYears = 0;
    let essentialCoverageYears = 0;
    let lowestMarginRatio = 1;
    let hadPositivePortfolio = false;
    let assetDepletionAge = null;

    function totalPortfolio(r){
        if (!r.portfolios) return 0;
        return Object.values(r.portfolios)
            .reduce((sum,v)=>sum+(v||0),0);
    }

    evaluationYears.forEach(r => {
        const income = r.income || 0;
        const expenses = r.expenses || 0;
        const essentialExpenses =
            r?.expenseBreakdown?.essential ??
            expenses;
        const portfolioTotal = totalPortfolio(r);

        if (income >= expenses) {
            coverageYears++;
        }

        if (income >= essentialExpenses) {
            essentialCoverageYears++;
        }

        if (expenses > 0) {
            lowestMarginRatio = Math.min(
                lowestMarginRatio,
                (income - expenses) / expenses
            );
        }

        if (portfolioTotal > 0) {
            hadPositivePortfolio = true;
        }

        if (
            hadPositivePortfolio &&
            assetDepletionAge === null &&
            portfolioTotal <= 0
        ) {
            assetDepletionAge = r.age;
        }
    });

    const totalYears = evaluationYears.length;

    /* =========================================================
       1. INCOME COVERAGE (30)
    ========================================================= */

    const coverageRatio = coverageYears / totalYears;
    const coverageScore = coverageRatio * 30;

    /* =========================================================
       2. ESSENTIAL COVERAGE (20)
    ========================================================= */

    const essentialCoverageRatio = essentialCoverageYears / totalYears;
    const essentialScore = essentialCoverageRatio * 20;

    /* =========================================================
       3. LONGEVITY SAFETY (25)
    ========================================================= */

    const finalAge = evaluationYears[evaluationYears.length - 1].age;

    let longevityScore = 25;

    if (hadPositivePortfolio && assetDepletionAge !== null) {
        const retirementSpan = Math.max(
            1,
            finalAge - (retireAge ?? evaluationYears[0].age ?? finalAge)
        );
        const yearsShort = Math.max(0, finalAge - assetDepletionAge);
        longevityScore = Math.max(
            0,
            25 * (1 - (yearsShort / retirementSpan))
        );
    }

    /* =========================================================
       4. EARLY RETIREMENT STABILITY (15)
    ========================================================= */

    const earlyYears = evaluationYears.slice(0, 10);

    const earlyCoverageRatio =
        earlyYears.length
            ? earlyYears.filter(r => (r.income || 0) >= (r.expenses || 0)).length / earlyYears.length
            : 1;
    const earlyScore = earlyCoverageRatio * 15;

    /* =========================================================
       5. MARGIN STRENGTH (10)
    ========================================================= */

    const normalizedMargin = Math.max(
        0,
        Math.min(1, (lowestMarginRatio + 0.5) / 0.5)
    );
    const marginScore = normalizedMargin * 10;

    /* =========================================================
       FINAL SCORE
    ========================================================= */

    const deterministic =
        buildDeterministicReadiness({
            coverageScore,
            essentialScore,
            longevityScore,
            earlyScore,
            marginScore
        });
    const readiness =
        applyMonteCarloOverlay({
            deterministic,
            monteCarlo: options?.monteCarlo,
            retireAge,
            finalAge
        });
    const score = readiness.score;

    const grade =
        score >= 90 ? "A" :
        score >= 80 ? "B" :
        score >= 70 ? "C" :
        score >= 60 ? "D" : "F";

    return {
        score,
        grade,
        breakdown: readiness.breakdown,
        maxScores: readiness.maxScores,
        monteCarloDurabilityRatio:
            readiness.monteCarloDurabilityRatio ?? null,
        probabilityAdjusted: readiness.probabilityAdjusted
    };

}
