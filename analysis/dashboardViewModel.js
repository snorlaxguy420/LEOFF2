function totalPortfolio(result) {
    if (!result?.portfolios) {
        return 0;
    }

    return Object.values(result.portfolios)
        .reduce((sum, value) => sum + (value || 0), 0);
}

function totalRealEstate(result) {
    return result?.realEstateValue || 0;
}

function totalMortgages(result) {
    return result?.mortgageBalance || 0;
}

export function formatCurrency(value) {
    return "$" + Math.round(value || 0).toLocaleString();
}

export function formatPercent(value) {
    return `${Math.round((value || 0) * 100)}%`;
}

export function getDisplayedRecommendationAge(analysis = {}, retireAge = null) {
    return (
        analysis.recommendedRetirementAge ??
        analysis.financialFreedomAge ??
        analysis.earliestRetirementAge ??
        retireAge
    );
}

export function getMinimumDashboardRetirementAge(inputs = {}) {
    const currentAge =
        Math.max(
            0,
            Math.ceil(inputs?.profile?.currentAge || 0)
        );

    return Math.max(50, currentAge);
}

export function getMaximumDashboardRetirementAge(inputs = {}) {
    const minimumAge =
        getMinimumDashboardRetirementAge(inputs);

    return Math.max(
        minimumAge,
        Math.min(
            Math.max(inputs?.lifeExpectancy || 70, 70) - 5,
            70
        )
    );
}

export function getMarginExtremes(results = []) {
    if (!Array.isArray(results) || results.length === 0) {
        return null;
    }

    let lowest = null;
    let highest = null;

    results.forEach(result => {
        const margin =
            (result?.income || 0) - (result?.expenses || 0);
        const entry = {
            age: result?.age ?? null,
            margin
        };

        if (!lowest || margin < lowest.margin) {
            lowest = entry;
        }

        if (!highest || margin > highest.margin) {
            highest = entry;
        }
    });

    return {
        lowest,
        highest
    };
}

function describeMarginExtreme(label, entry) {
    if (!entry) {
        return null;
    }

    const ageLabel =
        entry.age !== null && entry.age !== undefined
            ? `at age ${entry.age}`
            : "in the projection";

    if (entry.margin >= 0) {
        return `${label} annual surplus is ${formatCurrency(entry.margin)} ${ageLabel}`;
    }

    return `${label} annual margin is a deficit of ${formatCurrency(Math.abs(entry.margin))} ${ageLabel}`;
}

export function buildMarginRangeSentence(results = []) {
    const extremes = getMarginExtremes(results);

    if (!extremes) {
        return "Margin range data is not available yet.";
    }

    return `${describeMarginExtreme("Lowest", extremes.lowest)}. ${describeMarginExtreme("Highest", extremes.highest)}.`;
}

export function getReadinessBandDescription(band) {
    const descriptions = {
        Durable: "Your retirement plan looks durable under the current assumptions.",
        Strong: "You are in a strong position, with a few things still worth watching.",
        Workable: "Your plan can work, but it still carries meaningful pressure points.",
        Fragile: "Your current plan looks fragile and needs meaningful changes."
    };

    return descriptions[band] ||
        "Your retirement outlook is still taking shape.";
}

export const getReadinessGradeDescription = getReadinessBandDescription;

export function summarizeDashboardResults({
    results = [],
    retireAge
}) {
    const coverage =
        results.reduce((sum, result) => {
            const expenses = result?.expenses || 0;
            const yearlyCoverage =
                expenses > 0
                    ? (result?.income || 0) / expenses
                    : 1;

            return sum + yearlyCoverage;
        }, 0) / Math.max(results.length, 1);
    const avgMargin =
        results.reduce(
            (sum, result) => sum + ((result?.income || 0) - (result?.expenses || 0)),
            0
        ) / Math.max(results.length, 1);
    const retirementYear =
        results.find(result => result?.age === retireAge) || results[0] || null;
    const portfolioAssets = totalPortfolio(retirementYear);
    const realEstateAssets = totalRealEstate(retirementYear);
    const mortgageDebts = totalMortgages(retirementYear);
    const totalAssets = portfolioAssets + realEstateAssets;
    const totalDebts = mortgageDebts;

    return {
        coverage,
        avgMargin,
        retirementYear,
        portfolioAssets,
        realEstateAssets,
        mortgageDebts,
        totalAssets,
        totalDebts,
        netWorth: totalAssets - totalDebts,
        marginExtremes: getMarginExtremes(results)
    };
}

export function buildRecommendationContent({
    retireAge,
    analysis,
    vulnerabilityAnalysis,
    results
}) {
    const recommendedAge =
        getDisplayedRecommendationAge(analysis, retireAge);
    const primaryRiskShort =
        vulnerabilityAnalysis.primaryRisk?.label ?? "lower stress sensitivity";
    const primaryRiskLong =
        vulnerabilityAnalysis.primaryRisk?.label ?? "Low Vulnerability";
    const earliestSustainable =
        analysis.earliestRetirementAge;
    const financialFreedomAge =
        analysis.financialFreedomAge;
    const monteCarloThreshold =
        Math.round(
            (analysis.recommendedMonteCarloSuccessThreshold ?? 0.9) * 100
        );
    const marginSentence =
        buildMarginRangeSentence(results);
    const supportPoints = [];

    if (earliestSustainable !== null && earliestSustainable !== undefined) {
        supportPoints.push(
            `The plan first looks sustainably solvent at age ${earliestSustainable}`
        );
    }

    if (financialFreedomAge !== null && financialFreedomAge !== undefined) {
        supportPoints.push(
            `projected income fully covers expenses by age ${financialFreedomAge}`
        );
    }

    const shortText =
        analysis.recommendedRetirementAge == null &&
        analysis.financialFreedomAge != null
            ? `Age ${recommendedAge} appears to cover expenses throughout the plan, but it still depends on planned portfolio withdrawals and does not yet clear the ${monteCarloThreshold}% Monte Carlo confidence target for a strict recommendation. ${marginSentence} The main pressure point is ${primaryRiskShort}.`
            : `Age ${recommendedAge} appears to be the strongest current balance of sustainability and resilience. ${marginSentence} The main pressure point is ${primaryRiskShort}.`;

    if (
        analysis.recommendedRetirementAge === null &&
        financialFreedomAge !== null &&
        financialFreedomAge !== undefined
    ) {
        return {
            headline: `Recommended retirement age: ${recommendedAge}`,
            shortText,
            narrative:
                `Age ${recommendedAge} appears to be the strongest current timing for full expense coverage in this plan, even though the projection still relies on planned portfolio withdrawals in some years and does not yet clear the ${monteCarloThreshold}% Monte Carlo confidence target for a strict recommendation. ${supportPoints.length ? `${supportPoints.join(", ")}, and ` : ""}${marginSentence} The main risk to keep watching is ${primaryRiskLong}.`
        };
    }

    if (
        financialFreedomAge !== null &&
        financialFreedomAge !== undefined &&
        recommendedAge > financialFreedomAge
    ) {
        supportPoints.push(
            `the later recommendation reflects a stricter goal of covering expenses without relying on portfolio withdrawals while still clearing the ${monteCarloThreshold}% Monte Carlo confidence target`
        );
    }

    return {
        headline: `Recommended retirement age: ${recommendedAge}`,
        shortText,
        narrative:
            `We recommend age ${recommendedAge} because it offers the strongest balance of sustainability, income coverage, and retirement resilience in the current plan. ${supportPoints.length ? `${supportPoints.join(", ")}, and ` : ""}${marginSentence} The main risk to keep watching is ${primaryRiskLong}.`
    };
}

export function buildPlanningLeverContent({
    retireAge,
    analysis,
    vulnerabilityAnalysis,
    avgMargin,
    retirementYear
}) {
    const primaryRisk = vulnerabilityAnalysis.primaryRisk;
    const recommendedAge =
        getDisplayedRecommendationAge(analysis, retireAge);
    const deficitAge = analysis.retirementFailureAge;
    const assetDepletionAge = analysis.assetDepletionAge;
    const expenseBase = retirementYear?.expenses || 0;
    const marginGap =
        avgMargin < 0 ? formatCurrency(Math.abs(avgMargin)) : null;

    if (retireAge < recommendedAge) {
        return {
            headline: "This scenario appears most sensitive to retirement timing",
            narrative:
                `Under the current assumptions, the model points to age ${recommendedAge} as the stronger timing balance. Retiring earlier than that appears to increase bridge pressure, lower pension support, and make the plan more exposed to deficits or drawdown.`
        };
    }

    if (primaryRisk?.id === "withdrawal_dependency_risk") {
        return {
            headline: "This scenario appears most sensitive to portfolio dependence",
            narrative:
                "Under the current assumptions, this plan leans heavily on savings withdrawals. The projection would improve most if guaranteed income covered more of retirement spending, or if retirement spending pressure were lower."
        };
    }

    if (primaryRisk?.id === "essential_expense_gap_risk") {
        return {
            headline: "This scenario appears most sensitive to must-pay expenses",
            narrative:
                "Under the current assumptions, essential spending is the tightest pressure point. The projection would improve most if guaranteed income covered a larger share of core costs like housing, healthcare, and insurance."
        };
    }

    if (primaryRisk?.id === "early_retirement_bridge_risk") {
        return {
            headline: "This scenario appears most sensitive to bridge years",
            narrative:
                "Under the current assumptions, the years between retirement and later income sources create the most fragility. A shorter bridge, stronger reserve base, or later retirement timing would likely improve this projection most."
        };
    }

    if (primaryRisk?.id === "housing_concentration_risk") {
        return {
            headline: "This scenario appears most sensitive to housing concentration",
            narrative:
                "Under the current assumptions, housing carries outsized weight in the plan. The projection would likely improve most if retirement cash flow were less concentrated in housing-related costs or housing-dependent assumptions."
        };
    }

    if (primaryRisk?.id && primaryRisk.id.includes("inflation")) {
        return {
            headline: "This scenario appears most sensitive to rising costs",
            narrative:
                "Under the current assumptions, inflation is one of the strongest pressure points in the plan. The projection would likely improve most from a larger long-term margin between retirement income and spending."
        };
    }

    if (marginGap && expenseBase > 0) {
        return {
            headline: "This scenario appears most sensitive to spending pressure",
            narrative:
                `Under the current assumptions, the plan carries an average annual shortfall of ${marginGap}. A lower spending base or more guaranteed income would likely improve this projection the most.`
        };
    }

    if (assetDepletionAge !== null || deficitAge !== null) {
        return {
            headline: "This scenario appears most sensitive to long-term margin",
            narrative:
                "Under the current assumptions, the plan would benefit most from a wider cushion between income and expenses over time. More margin would reduce the chance that later deficits or depletion become the dominant issue."
        };
    }

    return {
        headline: "This scenario appears most sensitive to preserving its current margin",
        narrative:
            "Under the current assumptions, this plan is in relatively strong shape. The main planning lever is preserving the margin it already has by avoiding large increases in recurring spending or new dependence on withdrawals."
    };
}

export function buildRecommendedAgeSummary({
    retireAge,
    analysis
}) {
    const recommendedRetirement =
        getDisplayedRecommendationAge(analysis, retireAge);
    const earliestSustainable =
        analysis.earliestRetirementAge ?? "Not Sustainable";
    const freedomAge =
        analysis.financialFreedomAge ?? "Requires Drawdown";
    const monteCarloThreshold =
        Math.round(
            (analysis.recommendedMonteCarloSuccessThreshold ?? 0.9) * 100
        );

    if (
        analysis.recommendedRetirementAge === null &&
        typeof analysis.financialFreedomAge === "number"
    ) {
        return `Age ${recommendedRetirement} is the first age currently projected to cover expenses year by year, but it still appears to rely on planned portfolio withdrawals and does not yet clear the ${monteCarloThreshold}% Monte Carlo confidence target for a strict recommendation. Earliest sustainable timing is ${earliestSustainable}, and projected income fully covers expenses by age ${freedomAge}.`;
    }

    if (
        typeof analysis.recommendedRetirementAge === "number" &&
        typeof analysis.financialFreedomAge === "number" &&
        analysis.recommendedRetirementAge > analysis.financialFreedomAge
    ) {
        return `Age ${recommendedRetirement} is the current model favorite because it is the first age that appears to cover expenses without relying on portfolio withdrawals and still clears the ${monteCarloThreshold}% Monte Carlo confidence target. Age ${earliestSustainable} is the earliest sustainable timing, and age ${freedomAge} is the first age projected income fully covers expenses.`;
    }

    return `Age ${recommendedRetirement} is the current model favorite. Earliest sustainable timing is ${earliestSustainable}, and projected income fully covers expenses by age ${freedomAge}.`;
}

export function buildMarginOverviewText({
    retirementYear,
    results
}) {
    const retirementIncome = formatCurrency(retirementYear?.income || 0);
    const retirementExpenses = formatCurrency(retirementYear?.expenses || 0);

    return `The selected retirement year projects ${retirementIncome} of income against ${retirementExpenses} of annual expenses. ${buildMarginRangeSentence(results)}`;
}

export function formatMarginExtremeValue(entry) {
    return entry
        ? `${formatCurrency(entry.margin)} at ${entry.age}`
        : "--";
}

export function buildExpenseBreakdownSummary(retirementYear = {}) {
    const breakdown = retirementYear?.expenseBreakdown || {};

    return {
        essential: formatCurrency(breakdown.essential || 0),
        discretionary: formatCurrency(breakdown.discretionary || 0),
        housing: formatCurrency(breakdown.housing || 0),
        healthcare: formatCurrency(breakdown.healthcare || 0),
        insurance: formatCurrency(breakdown.insurance || 0),
        goodsServices: formatCurrency(breakdown.goodsServices || 0)
    };
}

export function buildTaxSnapshotSummary(retirementYear = {}) {
    const taxes = retirementYear?.taxes || 0;
    const taxableIncome = retirementYear?.taxableIncome || 0;
    const grossIncome = retirementYear?.income || 0;
    const taxDrag = grossIncome > 0 ? taxes / grossIncome : 0;

    return {
        taxesAtRetirement: formatCurrency(taxes),
        taxableIncomeAtRetirement: formatCurrency(taxableIncome),
        taxDragRatio: formatPercent(taxDrag),
        narrative:
            grossIncome > 0
                ? `In the selected retirement year, taxes consume about ${Math.round(taxDrag * 100)}% of projected income.`
                : "No retirement-year income is currently projected, so tax drag is effectively zero."
    };
}

function formatAgeLabel(age, fallback = "Not set") {
    return Number.isFinite(age)
        ? `Age ${age}`
        : fallback;
}

function formatSurvivorOptionLabel(option) {
    if (option === "50%") {
        return "50% survivor option";
    }

    if (option === "66%" || option === "66.67%") {
        return "66.67% survivor option";
    }

    if (option === "100%") {
        return "100% survivor option";
    }

    if (!option || option === "none") {
        return "Single life / no survivor pension";
    }

    return String(option);
}

function findResultForAge(results = [], age) {
    if (!Number.isFinite(age)) {
        return null;
    }

    return results.find(result => result?.age === age) || null;
}

export function buildSpouseConversationSummary({
    currentInputs = {},
    analysis = {},
    vulnerabilityAnalysis = {},
    projection = {}
}) {
    const spouse = currentInputs?.profile?.spouse;

    if (!spouse) {
        return {
            available: false,
            headline: "Household conversation guide",
            summary:
                "Add spouse age, retirement age, and income in the calculator to generate a cleaner household discussion summary for the report.",
            snapshot: [],
            prompts: [],
            note: "This section is meant to translate the technical plan into a household conversation before a retirement decision is finalized."
        };
    }

    const retireAge =
        currentInputs?.retireAge ??
        currentInputs?.profile?.retirementAge ??
        null;
    const recommendedAge =
        getDisplayedRecommendationAge(analysis, retireAge);
    const spouseRetirementAge =
        Number.isFinite(spouse?.retirementAge)
            ? spouse.retirementAge
            : null;
    const spouseAnnualIncome =
        Number.isFinite(spouse?.annualIncome)
            ? spouse.annualIncome
            : 0;
    const survivorOptionLabel =
        formatSurvivorOptionLabel(currentInputs?.pension?.survivorOption);
    const results = projection?.results || [];
    const retirementYear =
        findResultForAge(results, retireAge) ||
        results[0] ||
        null;
    const preSpouseRetirementYear =
        findResultForAge(results, spouseRetirementAge - 1);
    const spouseRetirementYear =
        findResultForAge(results, spouseRetirementAge);
    const primaryRiskLabel =
        vulnerabilityAnalysis?.primaryRisk?.label ||
        "Current income margin";
    const selectedMargin =
        (retirementYear?.income || 0) - (retirementYear?.expenses || 0);
    const selectedMarginLabel =
        selectedMargin >= 0
            ? `+${formatCurrency(selectedMargin)}`
            : `-${formatCurrency(Math.abs(selectedMargin))}`;
    const spouseTransitionDelta =
        preSpouseRetirementYear && spouseRetirementYear
            ? Math.max(
                0,
                (preSpouseRetirementYear?.income || 0) -
                (spouseRetirementYear?.income || 0)
            )
            : 0;

    let summary =
        `This summary reframes the current plan as a household decision instead of only a technical report. The selected retirement age is ${formatAgeLabel(retireAge)}, and the current model preference is ${formatAgeLabel(recommendedAge)}.`;

    if (
        Number.isFinite(retireAge) &&
        Number.isFinite(recommendedAge) &&
        retireAge < recommendedAge
    ) {
        summary += ` The model still prefers waiting until ${formatAgeLabel(recommendedAge)} for a stronger margin and lower stress exposure.`;
    }

    if (spouseAnnualIncome > 0 && Number.isFinite(spouseRetirementAge)) {
        summary += ` Spouse income of ${formatCurrency(spouseAnnualIncome)} per year is currently modeled through ${formatAgeLabel(spouseRetirementAge - 1, "the year before spouse retirement")}.`;
    }

    const prompts = [];

    if (spouseAnnualIncome > 0 && Number.isFinite(spouseRetirementAge)) {
        prompts.push({
            title: "Talk through the spouse-income transition",
            body:
                spouseTransitionDelta > 0
                    ? `The projection shows household income dropping by about ${formatCurrency(spouseTransitionDelta)} when spouse income ends at ${formatAgeLabel(spouseRetirementAge)}. Decide whether that transition still feels comfortable at your planned retirement timing.`
                    : `Spouse income is modeled through ${formatAgeLabel(spouseRetirementAge - 1, "the year before spouse retirement")}. Confirm that the plan still feels realistic once that paycheck is gone.`
        });
    } else {
        prompts.push({
            title: "Confirm the household income assumptions",
            body:
                "This report does not currently include a meaningful spouse-income assumption. If spouse work income matters to the decision, add it before using the report as a final household planning document."
        });
    }

    if (!currentInputs?.pension?.survivorOption || currentInputs.pension.survivorOption === "none") {
        prompts.push({
            title: "Revisit the survivor-income decision",
            body:
                "The pension is currently modeled as single life with no survivor continuation. Confirm that this still matches what the surviving spouse could live on if the retiree dies first."
        });
    } else {
        prompts.push({
            title: "Pressure-test the survivor election",
            body:
                `The plan currently uses the ${survivorOptionLabel}. Confirm that the lower retiree benefit is worth the surviving-spouse protection in your actual household budget.`
        });
    }

    if (Number.isFinite(analysis?.retirementFailureAge)) {
        prompts.push({
            title: "Agree on the backup move before pressure hits",
            body:
                `Under the current assumptions, the first modeled deficit appears at age ${analysis.retirementFailureAge}. Decide in advance whether your first response would be to work longer, trim spending, or change withdrawals.`
        });
    } else {
        prompts.push({
            title: "Name the household pressure point now",
            body:
                `The current report does not show a modeled deficit, but the main stress signal is still ${primaryRiskLabel}. Decide what you would change first if that risk turns out worse than expected.`
        });
    }

    return {
        available: true,
        headline: "Household conversation guide",
        summary,
        snapshot: [
            {
                label: "Selected Retirement Age",
                value: formatAgeLabel(retireAge)
            },
            {
                label: "Current Model Preference",
                value: formatAgeLabel(recommendedAge)
            },
            {
                label: "Spouse Retirement Age",
                value: formatAgeLabel(spouseRetirementAge, "Not modeled")
            },
            {
                label: "Spouse Income in Plan",
                value:
                    spouseAnnualIncome > 0
                        ? `${formatCurrency(spouseAnnualIncome)}/yr`
                        : "Not modeled"
            },
            {
                label: "Survivor Election",
                value: survivorOptionLabel
            },
            {
                label: "Retirement-Year Margin",
                value: selectedMarginLabel
            }
        ],
        prompts,
        note:
            `Primary watch item: ${primaryRiskLabel}. Use this page to align on timing, survivor protection, and which fallback move the household would actually make first.`
    };
}

export function buildTopRiskEntries(vulnerabilityAnalysis = {}) {
    const topRisks = (vulnerabilityAnalysis?.risks || []).slice(0, 3);

    if (!topRisks.length) {
        return [
            {
                severityMeta: null,
                label: "Low current stress signal",
                explanation: "The current report did not surface three major retirement risks.",
                mitigation: null
            }
        ];
    }

    return topRisks.map(risk => ({
        severityMeta: `${risk.severityTier} Severity | Score ${risk.severityScore}`,
        label: risk.label,
        explanation: risk.explanation,
        mitigation: risk.mitigation
    }));
}

export function buildRiskListEntries(vulnerabilityAnalysis = {}) {
    if (!vulnerabilityAnalysis?.primaryRisk) {
        return [
            "No major vulnerability signal was detected under the current V2 stress tests."
        ];
    }

    return (vulnerabilityAnalysis.secondaryRisks || [])
        .slice(0, 3)
        .map(risk => `${risk.label} (${risk.severityTier})`);
}

export function buildShortfallSummary({
    projection = {},
    analysis = {}
}) {
    const results = projection?.results || [];
    let worstAnnualDeficit = 0;

    results.forEach(result => {
        if ((result?.surplus || 0) < 0) {
            worstAnnualDeficit = Math.max(
                worstAnnualDeficit,
                Math.abs(result.surplus)
            );
        }
    });

    return {
        firstDeficitAge: analysis.retirementFailureAge ?? "Never",
        cumulativeShortfall: formatCurrency(projection?.cumulativeShortfall || 0),
        worstAnnualDeficit:
            worstAnnualDeficit > 0
                ? formatCurrency(worstAnnualDeficit)
                : "None"
    };
}

function formatAgeValue(age) {
    return Number.isFinite(age)
        ? `Age ${age}`
        : "None";
}

function getMonteCarloConfidenceLabel(successRate = 0) {
    if (successRate >= 0.85) {
        return "High-confidence outlook";
    }

    if (successRate >= 0.7) {
        return "Resilient under stress";
    }

    if (successRate >= 0.5) {
        return "Mixed under stress";
    }

    return "Fragile under stress";
}

function formatSignedCurrency(value) {
    const absoluteValue = formatCurrency(Math.abs(value || 0));
    return (value || 0) < 0
        ? `-${absoluteValue}`
        : absoluteValue;
}

export function buildMonteCarloContent(monteCarlo = {}) {
    const successRate = monteCarlo?.successRate ?? 0;
    const essentialSuccessRate =
        monteCarlo?.essentialSuccessRate ?? 0;
    const iterations =
        monteCarlo?.iterations ?? 0;
    const medianFailureAge =
        formatAgeValue(monteCarlo?.medianFailureAge);
    const medianAssetDepletionAge =
        formatAgeValue(monteCarlo?.medianAssetDepletionAge);
    const medianReadinessScore =
        Number.isFinite(monteCarlo?.medianReadinessScore)
            ? `${Math.round(monteCarlo.medianReadinessScore)} / 100`
            : "--";
    const percentile10EndingNetWorth =
        monteCarlo?.wealthMetricsTrusted !== false &&
        Number.isFinite(monteCarlo?.percentile10EndingNetWorth)
            ? formatCurrency(monteCarlo.percentile10EndingNetWorth)
            : "Range too wide";
    const medianEndingNetWorth =
        monteCarlo?.wealthMetricsTrusted !== false &&
        Number.isFinite(monteCarlo?.medianEndingNetWorth)
            ? formatCurrency(monteCarlo.medianEndingNetWorth)
            : "Range too wide";
    const percentile90EndingNetWorth =
        monteCarlo?.wealthMetricsTrusted !== false &&
        Number.isFinite(monteCarlo?.percentile90EndingNetWorth)
            ? formatCurrency(monteCarlo.percentile90EndingNetWorth)
            : "Range too wide";
    const confidenceLabel =
        getMonteCarloConfidenceLabel(successRate);
    const wealthNarrative =
        monteCarlo?.wealthMetricsTrusted === false
            ? "The ending net worth range is still too wide to summarize cleanly, so we are emphasizing success odds instead of precise wealth figures."
            : `The median readiness score across trials is ${medianReadinessScore}, the downside 10th percentile ending net worth is ${percentile10EndingNetWorth}, and the median ending net worth is ${medianEndingNetWorth}.`;
    const rangeNarrative =
        monteCarlo?.projectionPaths?.ages?.length
            ? " The range chart below now shows the mean net-worth path plus the best and worst ending-net-worth trial paths from this run."
            : "";

    return {
        headline: `${formatPercent(successRate)} Success Rate`,
        summary:
            `Across ${iterations} simulated different market and inflation scenarios, this plan stays fully solvent in ${formatPercent(successRate)} of trials and still covers essential expenses in ${formatPercent(essentialSuccessRate)} of trials.`,
        narrative:
            `This standalone Monte Carlo view tests the current plan against many different market and inflation scenarios. ${wealthNarrative}${rangeNarrative}`,
        confidenceLabel,
        successRate: formatPercent(successRate),
        essentialSuccessRate: formatPercent(essentialSuccessRate),
        medianReadinessScore,
        medianFailureAge,
        medianAssetDepletionAge,
        percentile10EndingNetWorth,
        medianEndingNetWorth,
        percentile90EndingNetWorth,
        iterations: String(iterations || 0)
    };
}

export function buildMonteCarloProjectionChartContent(monteCarlo = {}) {
    const projectionPaths = monteCarlo?.projectionPaths;
    const ages = projectionPaths?.ages || [];
    const meanNetWorthPath = projectionPaths?.meanNetWorthPath || [];
    const worstCasePath = projectionPaths?.worstCase?.netWorthPath || [];
    const bestCasePath = projectionPaths?.bestCase?.netWorthPath || [];

    if (
        ages.length < 2 ||
        meanNetWorthPath.length !== ages.length ||
        worstCasePath.length !== ages.length ||
        bestCasePath.length !== ages.length
    ) {
        return null;
    }

    const meanEndingNetWorth =
        meanNetWorthPath[meanNetWorthPath.length - 1] || 0;
    const worstEndingNetWorth =
        projectionPaths?.worstCase?.endingNetWorth || 0;
    const bestEndingNetWorth =
        projectionPaths?.bestCase?.endingNetWorth || 0;

    return {
        chart: {
            ages,
            series: [
                {
                    key: "mean",
                    label: "Mean Projection",
                    color: "#1F4D3A",
                    dash: [10, 6],
                    values: meanNetWorthPath
                },
                {
                    key: "worst",
                    label: "Worst Case",
                    color: "#B33A3A",
                    values: worstCasePath
                },
                {
                    key: "best",
                    label: "Best Case",
                    color: "#3F7C85",
                    values: bestCasePath
                }
            ]
        },
        summary:
            `Worst and best case are the single lowest and highest ending-net-worth trials out of ${monteCarlo?.iterations || 0} runs. The mean projection is the average net-worth path across the full simulation set.`,
        meanEndingNetWorth: formatSignedCurrency(meanEndingNetWorth),
        worstEndingNetWorth: formatSignedCurrency(worstEndingNetWorth),
        bestEndingNetWorth: formatSignedCurrency(bestEndingNetWorth),
        worstCaseMeta:
            projectionPaths?.worstCase?.failureAge != null
                ? `Failure age ${projectionPaths.worstCase.failureAge}`
                : projectionPaths?.worstCase?.assetDepletionAge != null
                    ? `Assets depleted by age ${projectionPaths.worstCase.assetDepletionAge}`
                    : "No modeled failure",
        bestCaseMeta:
            projectionPaths?.bestCase?.failureAge != null
                ? `Failure age ${projectionPaths.bestCase.failureAge}`
                : projectionPaths?.bestCase?.assetDepletionAge != null
                    ? `Assets depleted by age ${projectionPaths.bestCase.assetDepletionAge}`
                    : "No modeled failure"
    };
}

export function buildDashboardAgeAdjustedInputs({
    baseInputs = {},
    retireAge
}) {
    const nextInputs = structuredClone(baseInputs || {});
    const currentAge = nextInputs?.profile?.currentAge ?? null;
    const baseRetireAge =
        baseInputs?.retireAge ??
        baseInputs?.profile?.retirementAge ??
        retireAge;
    const baseServiceYears =
        baseInputs?.pension?.serviceYears ?? 0;
    const serviceYearDelta =
        Number.isFinite(baseRetireAge) && Number.isFinite(retireAge)
            ? retireAge - baseRetireAge
            : 0;
    const currentAnnualPay =
        baseInputs?.pension?.currentAnnualPay ?? 0;
    const baseFinalAverageSalary =
        baseInputs?.pension?.finalAverageSalary ?? currentAnnualPay;
    const yearsUntilBaseRetirement =
        Number.isFinite(currentAge) &&
        Number.isFinite(baseRetireAge)
            ? Math.max(0, baseRetireAge - currentAge)
            : 0;
    const annualSalaryStep =
        yearsUntilBaseRetirement > 0
            ? (baseFinalAverageSalary - currentAnnualPay) / yearsUntilBaseRetirement
            : 0;
    const yearsUntilSelectedRetirement =
        Number.isFinite(currentAge) &&
        Number.isFinite(retireAge)
            ? Math.max(0, retireAge - currentAge)
            : yearsUntilBaseRetirement;
    const adjustedServiceYears =
        Math.max(0, baseServiceYears + serviceYearDelta);
    const adjustedFinalAverageSalary =
        Math.max(
            0,
            currentAnnualPay + (annualSalaryStep * yearsUntilSelectedRetirement)
        ) || baseFinalAverageSalary;

    nextInputs.retireAge = retireAge;
    nextInputs.pension = {
        ...(nextInputs.pension || {}),
        serviceYears: adjustedServiceYears,
        finalAverageSalary: adjustedFinalAverageSalary
    };

    return nextInputs;
}

function agesMatch(left, right) {
    if (!Number.isFinite(left) || !Number.isFinite(right)) {
        return false;
    }

    return Math.abs(left - right) < 0.01;
}

export function buildDashboardAgeAdjustedIncomeSources({
    baseSources = [],
    baseInputs = {},
    retireAge
}) {
    const baseRetireAge =
        baseInputs?.retireAge ??
        baseInputs?.profile?.retirementAge ??
        retireAge;
    const pensionSourceNames = new Set([
        "LEOFF Pension",
        "LEOFF Lump Sum",
        "PERS Plan 2 Pension"
    ]);

    return (baseSources || [])
        .filter(source => !pensionSourceNames.has(source?.name))
        .map(source => {
            const nextSource = structuredClone(source || {});

            if (
                nextSource?.type === "portfolio" &&
                agesMatch(nextSource.startAge, baseRetireAge)
            ) {
                nextSource.startAge = retireAge;
            }

            return nextSource;
        });
}
