/* =========================================================
RETIREMENT READINESS SCORE ENGINE
Consumes simulation results only
========================================================= */

export function calculateReadinessScore(results, retireAge) {

    if (!results || !results.length) {
        return { score: 0, grade: "F" };
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

    const score = Math.round(
        coverageScore +
        essentialScore +
        longevityScore +
        earlyScore +
        marginScore
    );

    const grade =
        score >= 90 ? "A" :
        score >= 80 ? "B" :
        score >= 70 ? "C" :
        score >= 60 ? "D" : "F";

    return {
        score,
        grade,
        breakdown: {
            coverageScore,
            essentialScore,
            longevityScore,
            earlyScore,
            marginScore
        }
    };

}
