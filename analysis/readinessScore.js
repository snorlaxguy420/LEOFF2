/* =========================================================
RETIREMENT READINESS SCORE ENGINE
Consumes simulation results only
========================================================= */

export function calculateReadinessScore(results, retireAge) {

    if (!results || !results.length) {
        return { score: 0, grade: "F" };
    }

    let coverageYears = 0;
    let worstDeficit = 0;
    let incomeDrops = 0;

    const incomeValues = [];

    let assetDepletionAge = null;

    function totalPortfolio(r){
        if (!r.portfolios) return 0;
        return Object.values(r.portfolios)
            .reduce((sum,v)=>sum+(v||0),0);
    }

    results.forEach((r,i)=>{

        const income = r.income || 0;
        const expenses = r.expenses || 0;

        incomeValues.push(income);

        if (income >= expenses) {
            coverageYears++;
        } else {
            const deficit = expenses - income;
            if (deficit > worstDeficit) worstDeficit = deficit;
        }

        if (assetDepletionAge === null && totalPortfolio(r) <= 0) {
            assetDepletionAge = r.age;
        }

        if (i > 0) {
            const change = income - incomeValues[i-1];
            if (change < 0) {
                incomeDrops += Math.abs(change);
            }
        }

    });

    const totalYears = results.length;

    /* =========================================================
       1. INCOME COVERAGE (35)
    ========================================================= */

    const coverageRatio = coverageYears / totalYears;
    const coverageScore = coverageRatio * 35;

    /* =========================================================
       2. DEFICIT SEVERITY (20)
    ========================================================= */

    let deficitScore = 20;

    if (worstDeficit > 5000) deficitScore = 18;
    if (worstDeficit > 10000) deficitScore = 15;
    if (worstDeficit > 25000) deficitScore = 10;
    if (worstDeficit > 50000) deficitScore = 0;

    /* =========================================================
       3. LONGEVITY SAFETY (20)
    ========================================================= */

    const finalAge = results[results.length - 1].age;

    let longevityScore = 20;

    if (assetDepletionAge !== null) {

        if (assetDepletionAge >= finalAge) {
            longevityScore = 18;
        }

        else if (assetDepletionAge >= finalAge - 5) {
            longevityScore = 10;
        }

        else {
            longevityScore = 0;
        }

    }

    /* =========================================================
       4. EARLY RETIREMENT STABILITY (15)
    ========================================================= */

    const earlyYears =
        results.filter(r => r.age >= retireAge && r.age < retireAge + 10);

    let earlyDeficits = 0;

    earlyYears.forEach(r=>{
        if (r.income < r.expenses) earlyDeficits++;
    });

    let earlyScore = 15;

    if (earlyDeficits === 1) earlyScore = 12;
    if (earlyDeficits === 2) earlyScore = 8;
    if (earlyDeficits >= 3) earlyScore = 0;

    /* =========================================================
       5. INCOME STABILITY (10)
    ========================================================= */

    const avgDrop = incomeDrops / (incomeValues.length - 1);

    let stabilityScore = 10;

    if (avgDrop > 5000) stabilityScore = 8;
    if (avgDrop > 15000) stabilityScore = 5;
    if (avgDrop > 30000) stabilityScore = 0;

    /* =========================================================
       FINAL SCORE
    ========================================================= */

    const score = Math.round(
        coverageScore +
        deficitScore +
        longevityScore +
        earlyScore +
        stabilityScore
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
            deficitScore,
            longevityScore,
            earlyScore,
            stabilityScore
        }
    };

}