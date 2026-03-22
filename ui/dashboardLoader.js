import { renderProjectionChart } from "./projectionChart.js";
import {
    analyzeRetirementPlan,
    calculateReadinessScore
} from "../analysis/retirementAnalysis.js";
import { StateManager } from "../core/stateManager.js";
import { runProjection } from "../core/projectionEngine.js";
import {
    buildSimulationState,
    simulationStateToInputs
} from "../core/simulationState.js";
import { buildPensionIncomeSources } from "./simulatorShared.js";
import { runRetirementVulnerabilityAnalysis } from "../analysis/retirementVulnerability.js";

let comparisonChartMode = "bar";

function totalPortfolio(result) {
    if (!result?.portfolios) return 0;

    return Object.values(result.portfolios)
        .reduce((sum, value) => sum + (value || 0), 0);
}

function totalRealEstate(result) {
    return result?.realEstateValue || 0;
}

function totalMortgages(result) {
    return result?.mortgageBalance || 0;
}

function updateRetirementAgeLabel(retireAge) {
    const label = document.getElementById("retirementAgeSliderLabel");

    if (label) {
        label.innerHTML = `Retirement Age: <strong>${retireAge}</strong>`;
    }
}

function buildReportDocumentTitle(retireAge) {
    const now = new Date();
    const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")
    ].join("-");

    return `LEOFF-Helper-Retirement-Report-Age-${retireAge}-${stamp}`;
}

function toggleDetailSection(button) {
    const targetId = button?.dataset?.detailTarget;
    const target = targetId ? document.getElementById(targetId) : null;

    if (!button || !target) {
        return;
    }

    const isOpen = target.classList.toggle("is-open");
    button.setAttribute("aria-expanded", isOpen ? "true" : "false");
    button.textContent = isOpen ? "- Hide Detail" : "+ Show Detail";
}

function initializeDetailToggles() {
    const buttons = document.querySelectorAll(".detail-toggle");

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            toggleDetailSection(button);
        });
    });
}

function openPdfExportFlow(retireAge) {
    const previousTitle = document.title;
    document.title = buildReportDocumentTitle(retireAge);

    window.print();

    window.setTimeout(() => {
        document.title = previousTitle;
    }, 250);
}

function formatCurrency(value) {
    return "$" + Math.round(value || 0).toLocaleString();
}

function setElementText(id, value) {
    const el = document.getElementById(id);

    if (el) {
        el.innerText = value;
    }
}

function getMarginExtremes(results = []) {
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

function buildMarginRangeSentence(results = []) {
    const extremes = getMarginExtremes(results);

    if (!extremes) {
        return "Margin range data is not available yet.";
    }

    return `${describeMarginExtreme("Lowest", extremes.lowest)}. ${describeMarginExtreme("Highest", extremes.highest)}.`;
}

function getReadinessGradeDescription(grade) {
    const descriptions = {
        A: "Your retirement is secure and sustainable.",
        B: "You are in a strong position, with a few things still worth watching.",
        C: "Good start, but there is room for improvement.",
        D: "Your plan needs work, but there is still time to strengthen it.",
        F: "Your current plan is fragile and needs meaningful changes."
    };

    return descriptions[grade] ||
        "Your retirement outlook is still taking shape.";
}

function buildBriefRecommendationText({
    analysis,
    vulnerabilityAnalysis,
    results
}) {
    const recommendedAge =
        analysis.recommendedRetirementAge ??
        analysis.earliestRetirementAge;
    const primaryRisk =
        vulnerabilityAnalysis.primaryRisk?.label ?? "lower stress sensitivity";

    return `Age ${recommendedAge} appears to be the strongest current balance of sustainability and resilience. ${buildMarginRangeSentence(results)} The main pressure point is ${primaryRisk}.`;
}

function buildRecommendationNarrative({
    retireAge,
    analysis,
    vulnerabilityAnalysis,
    results
}) {
    const recommendedAge =
        analysis.recommendedRetirementAge ??
        analysis.earliestRetirementAge ??
        retireAge;
    const earliestSustainable =
        analysis.earliestRetirementAge;
    const financialFreedomAge =
        analysis.financialFreedomAge;
    const primaryRisk =
        vulnerabilityAnalysis.primaryRisk?.label ?? "Low Vulnerability";
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

    if (
        financialFreedomAge !== null &&
        financialFreedomAge !== undefined &&
        recommendedAge > financialFreedomAge
    ) {
        supportPoints.push(
            `the later recommendation reflects a stricter goal of covering expenses without relying on portfolio withdrawals`
        );
    }

    return `We recommend age ${recommendedAge} because it offers the strongest balance of sustainability, income coverage, and retirement resilience in the current plan. ${supportPoints.length ? `${supportPoints.join(", ")}, and ` : ""}${marginSentence} The main risk to keep watching is ${primaryRisk}.`;
}

function renderRecommendationSection({
    retireAge,
    analysis,
    vulnerabilityAnalysis,
    results
}) {
    const headline = document.getElementById("recommendationHeadline");
    const narrative = document.getElementById("recommendationNarrative");
    const shortText = document.getElementById("dashboardRecommendationText");
    const recommendedAge =
        analysis.recommendedRetirementAge ??
        analysis.earliestRetirementAge ??
        retireAge;

    if (headline) {
        headline.textContent =
            `Recommended retirement age: ${recommendedAge}`;
    }

    if (narrative) {
        narrative.textContent = buildRecommendationNarrative({
            retireAge,
            analysis,
            vulnerabilityAnalysis,
            results
        });
    }

    if (shortText) {
        shortText.textContent = buildBriefRecommendationText({
            analysis,
            vulnerabilityAnalysis,
            results
        });
    }
}

function buildPlanningLeverContent({
    retireAge,
    analysis,
    vulnerabilityAnalysis,
    avgMargin,
    retirementYear
}) {
    const primaryRisk = vulnerabilityAnalysis.primaryRisk;
    const recommendedAge =
        analysis.recommendedRetirementAge ??
        analysis.earliestRetirementAge ??
        retireAge;
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

function renderPlanningLeverSection({
    retireAge,
    analysis,
    vulnerabilityAnalysis,
    avgMargin,
    retirementYear
}) {
    const headline = document.getElementById("planningLeverHeadline");
    const narrative = document.getElementById("planningLeverNarrative");
    const content = buildPlanningLeverContent({
        retireAge,
        analysis,
        vulnerabilityAnalysis,
        avgMargin,
        retirementYear
    });

    if (headline) {
        headline.textContent = content.headline;
    }

    if (narrative) {
        narrative.textContent = content.narrative;
    }
}

function formatPercent(value) {
    return `${Math.round((value || 0) * 100)}%`;
}

function syncComparisonChartToggleUi() {
    const toggleBtn = document.getElementById("comparisonChartToggleBtn");

    if (!toggleBtn) {
        return;
    }

    toggleBtn.textContent =
        comparisonChartMode === "bar"
            ? "Line Chart"
            : "Bar Chart";
}

function clearTimelineLegend() {
    const legend = document.getElementById("timelineLegend");

    if (legend) {
        legend.innerHTML = "";
    }
}

function renderRecommendedAgeOverview({
    retireAge,
    analysis
}) {
    const summary = document.getElementById("recommendedAgeSummary");
    const recommendedRetirement =
        analysis.recommendedRetirementAge ??
        analysis.earliestRetirementAge ??
        retireAge;
    const earliestSustainable =
        analysis.earliestRetirementAge ?? "Not Sustainable";
    const freedomAge =
        analysis.financialFreedomAge ?? "Requires Drawdown";

    if (summary) {
        if (
            typeof analysis.recommendedRetirementAge === "number" &&
            typeof analysis.financialFreedomAge === "number" &&
            analysis.recommendedRetirementAge > analysis.financialFreedomAge
        ) {
            summary.textContent =
                `Age ${recommendedRetirement} is the current model favorite because it is the first age that appears to cover expenses without relying on portfolio withdrawals. Age ${earliestSustainable} is the earliest sustainable timing, and age ${freedomAge} is the first age projected income fully covers expenses.`;
            return;
        }

        summary.textContent =
            `Age ${recommendedRetirement} is the current model favorite. Earliest sustainable timing is ${earliestSustainable}, and projected income fully covers expenses by age ${freedomAge}.`;
    }
}

function renderMarginOverview({
    retirementYear,
    results
}) {
    const summary = document.getElementById("marginSummaryText");

    if (!summary) {
        return;
    }

    const retirementIncome = formatCurrency(retirementYear?.income || 0);
    const retirementExpenses = formatCurrency(retirementYear?.expenses || 0);

    summary.textContent =
        `The selected retirement year projects ${retirementIncome} of income against ${retirementExpenses} of annual expenses. ${buildMarginRangeSentence(results)}`;
}

function renderReadinessBreakdown(results, retireAge) {
    const readiness = calculateReadinessScore(results, retireAge);
    const breakdown = readiness.breakdown || {};

    document.getElementById("readinessCoverageScore").innerText =
        `${Math.round(breakdown.coverageScore || 0)} / 35`;
    document.getElementById("readinessDeficitScore").innerText =
        `${Math.round(breakdown.deficitScore || 0)} / 20`;
    document.getElementById("readinessLongevityScore").innerText =
        `${Math.round(breakdown.longevityScore || 0)} / 20`;
    document.getElementById("readinessEarlyScore").innerText =
        `${Math.round(breakdown.earlyScore || 0)} / 15`;
    document.getElementById("readinessStabilityScore").innerText =
        `${Math.round(breakdown.stabilityScore || 0)} / 10`;
}

function renderExpenseBreakdown(retirementYear) {
    if (!document.getElementById("expenseEssential")) {
        return;
    }

    const breakdown = retirementYear?.expenseBreakdown || {};

    setElementText("expenseEssential", formatCurrency(breakdown.essential || 0));
    setElementText("expenseDiscretionary", formatCurrency(breakdown.discretionary || 0));
    setElementText("expenseHousing", formatCurrency(breakdown.housing || 0));
    setElementText("expenseHealthcare", formatCurrency(breakdown.healthcare || 0));
    setElementText("expenseInsurance", formatCurrency(breakdown.insurance || 0));
    setElementText("expenseGoodsServices", formatCurrency(breakdown.goodsServices || 0));
}

function renderTaxSnapshot(retirementYear) {
    const taxes = retirementYear?.taxes || 0;
    const taxableIncome = retirementYear?.taxableIncome || 0;
    const grossIncome = retirementYear?.income || 0;
    const taxDrag = grossIncome > 0 ? taxes / grossIncome : 0;

    setElementText("taxesAtRetirement", formatCurrency(taxes));
    setElementText("taxableIncomeAtRetirement", formatCurrency(taxableIncome));
    setElementText("taxDragRatio", formatPercent(taxDrag));
    setElementText(
        "taxSnapshotNarrative",
        grossIncome > 0
            ? `In the selected retirement year, taxes consume about ${Math.round(taxDrag * 100)}% of projected income.`
            : "No retirement-year income is currently projected, so tax drag is effectively zero."
    );
}

function renderTopRisks(vulnerabilityAnalysis) {
    const container = document.getElementById("topRisksList");
    if (!container) return;

    const topRisks = (vulnerabilityAnalysis?.risks || []).slice(0, 3);

    if (!topRisks.length) {
        container.innerHTML = `
            <div class="report-risk-item">
                <h4>Low current stress signal</h4>
                <p>The current report did not surface three major retirement risks.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = topRisks.map(risk => `
        <div class="report-risk-item">
            <div class="report-risk-meta">${risk.severityTier} Severity | Score ${risk.severityScore}</div>
            <h4>${risk.label}</h4>
            <p>${risk.explanation}</p>
            <p><strong>Best mitigation:</strong> ${risk.mitigation}</p>
        </div>
    `).join("");
}

function renderShortfallSummary(projection, analysis) {
    if (!document.getElementById("reportFirstDeficitAge")) {
        return;
    }

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

    setElementText("reportFirstDeficitAge", analysis.retirementFailureAge ?? "Never");
    setElementText("reportCumulativeShortfall", formatCurrency(projection?.cumulativeShortfall || 0));
    setElementText(
        "reportWorstAnnualDeficit",
        worstAnnualDeficit > 0
            ? formatCurrency(worstAnnualDeficit)
            : "None"
    );
}

document.addEventListener("DOMContentLoaded", () => {

    const stored = sessionStorage.getItem("retirementProjection");
    const workspaceState = StateManager.loadAll();
    const savedSimulationState = workspaceState?.simulationState;

    if (!stored && !savedSimulationState) {
        alert("No retirement analysis found.");
        window.location.href = "simulator.html";
        return;
    }

    const fallbackPayload = savedSimulationState ? {
        projection: runProjection(savedSimulationState),
        incomeSources: savedSimulationState.incomeSources || [],
        inputs: simulationStateToInputs(savedSimulationState)
    } : null;

    const {
        projection,
        incomeSources,
        inputs
    } = stored ? JSON.parse(stored) : fallbackPayload;

    const baseInputs = structuredClone(inputs);
    const pensionNames = new Set([
        "LEOFF Pension",
        "PERS Plan 2 Pension"
    ]);
    const baseNonPensionSources = (incomeSources || [])
        .filter(source => !pensionNames.has(source.name));
    const assumedInflationRate =
        savedSimulationState?.assumptions?.goodsServicesInflationRate ??
        savedSimulationState?.assumptions?.inflationRate ??
        baseInputs?.assumptions?.goodsServicesInflationRate ??
        baseInputs?.assumptions?.inflationRate ??
        0.0329;
    const baseAssumptions = {
        inflationRate:
            baseInputs?.assumptions?.inflationRate ??
            savedSimulationState?.assumptions?.inflationRate ??
            assumedInflationRate,
        goodsServicesInflationRate:
            baseInputs?.assumptions?.goodsServicesInflationRate ??
            savedSimulationState?.assumptions?.goodsServicesInflationRate ??
            assumedInflationRate,
        housingInflationRate:
            baseInputs?.assumptions?.housingInflationRate ??
            savedSimulationState?.assumptions?.housingInflationRate ??
            assumedInflationRate,
        healthcareInflationRate:
            baseInputs?.assumptions?.healthcareInflationRate ??
            savedSimulationState?.assumptions?.healthcareInflationRate ??
            assumedInflationRate
    };

    function buildProjectionForAge(retireAge) {
        const currentInputs = {
            ...baseInputs,
            retireAge
        };
        const currentIncomeSources = [
            ...buildPensionIncomeSources({
                inputs: currentInputs,
                retireAge
            }),
            ...baseNonPensionSources
        ];
        const longevityAge = Math.max(
            currentInputs.lifeExpectancy || 0,
            100
        );
        const simulationState = buildSimulationState({
            inputs: currentInputs,
            incomeSources: currentIncomeSources,
            assumptions: baseAssumptions,
            overrides: {
                retireAge,
                lifeExpectancy: longevityAge
            }
        });

        return {
            currentInputs,
            currentIncomeSources,
            currentProjection: runProjection(simulationState)
        };
    }

    function renderRiskList(vulnerabilityAnalysis) {
        const riskList = document.getElementById("riskList");
        if (!riskList) return;

        riskList.innerHTML = "";

        function addRisk(text) {
            const li = document.createElement("li");
            li.textContent = text;
            riskList.appendChild(li);
        }

        if (!vulnerabilityAnalysis?.primaryRisk) {
            addRisk("No major vulnerability signal was detected under the current V2 stress tests.");
            return;
        }

        vulnerabilityAnalysis.secondaryRisks.slice(0, 3).forEach(risk => {
            addRisk(
                `${risk.label} (${risk.severityTier})`
            );
        });
    }

    function renderDashboardForAge(retireAge) {
        updateRetirementAgeLabel(retireAge);

        const {
            currentInputs,
            currentIncomeSources,
            currentProjection
        } = buildProjectionForAge(retireAge);
        const results = currentProjection.results;
        const analysis = analyzeRetirementPlan({
            inputs: currentInputs,
            incomeSources: currentIncomeSources,
            projection: currentProjection
        });
        const vulnerabilityAnalysis =
            runRetirementVulnerabilityAnalysis({
                inputs: currentInputs,
                incomeSources: currentIncomeSources,
                projection: currentProjection,
                assumedInflationRate
            });
        const firstDeficit = results.find(result => result.expenses > result.income);
        const coverage =
            results.reduce((sum, result) => {
                const expenses = result.expenses || 0;
                const yearlyCoverage =
                    expenses > 0
                        ? (result.income || 0) / expenses
                        : 1;

                return sum + yearlyCoverage;
            }, 0) / results.length;
        const avgMargin =
            results.reduce((sum, result) => sum + (result.income - result.expenses), 0) /
            results.length;
        const retirementYear =
            results.find(result => result.age === currentInputs.retireAge) || results[0];
        const portfolioAssets = totalPortfolio(retirementYear);
        const realEstateAssets = totalRealEstate(retirementYear);
        const mortgageDebts = totalMortgages(retirementYear);
        const totalAssets = portfolioAssets + realEstateAssets;
        const totalDebts = mortgageDebts;
        const netWorth = totalAssets - totalDebts;
        const comparisonChartModeForScreen = comparisonChartMode;
        const marginExtremes = getMarginExtremes(results);

        if (comparisonChartModeForScreen === "bar") {
            clearTimelineLegend();
        }

        renderProjectionChart({
            canvasId: "comparisonChart",
            results,
            dataset: "incomeVsExpenses",
            mode: comparisonChartModeForScreen,
            incomeSources: currentIncomeSources,
            expenseColor: "#DB2B39",
            yScaleMultiplier:
                comparisonChartModeForScreen === "line"
                    ? 1.15
                    : 1.25,
            tooltipId: "tooltip",
            legendId: "timelineLegend"
        });

        renderProjectionChart({
            canvasId: "printBarChart",
            results,
            dataset: "incomeVsExpenses",
            mode: "bar",
            incomeSources: currentIncomeSources,
            expenseColor: "#DB2B39",
            yScaleMultiplier: 1.25
        });

        renderProjectionChart({
            canvasId: "printLineChart",
            results,
            dataset: "incomeVsExpenses",
            mode: "line",
            incomeSources: currentIncomeSources,
            expenseColor: "#DB2B39",
            yScaleMultiplier: 1.25
        });

        document.getElementById("readinessScore").innerText =
            `${analysis.readinessScore} / 100`;
        document.getElementById("readinessGrade").innerText =
            analysis.readinessGrade;
        document.getElementById("readinessDescription").innerText =
            getReadinessGradeDescription(analysis.readinessGrade);
        setElementText("pensionCoverage", Math.round(coverage * 100) + "%");
        setElementText("safetyMargin", "$" + Math.round(avgMargin).toLocaleString());
        setElementText("firstDeficitAge", analysis.retirementFailureAge ?? "Never");
        setElementText("earliestRetirement", analysis.earliestRetirementAge ?? "Not Sustainable");
        setElementText("freedomAge", analysis.financialFreedomAge ?? "Requires Drawdown");
        setElementText("recommendedRetirement", analysis.recommendedRetirementAge ?? "Not Achievable");
        setElementText("reportIncomeMargin", `${avgMargin >= 0 ? "+" : "-"}${formatCurrency(Math.abs(avgMargin))}`);
        setElementText("assetDepletion", analysis.assetDepletionAge ?? "Sustainable");
        setElementText("totalAssets", "$" + Math.round(totalAssets).toLocaleString());
        setElementText("totalDebts", "$" + Math.round(totalDebts).toLocaleString());
        setElementText("netWorth", "$" + Math.round(netWorth).toLocaleString());
        setElementText("retirementIncome", "$" + Math.round(retirementYear.income).toLocaleString());
        setElementText("annualExpenses", "$" + Math.round(retirementYear.expenses).toLocaleString());
        setElementText(
            "lowestAnnualMargin",
            marginExtremes?.lowest
                ? `${formatCurrency(marginExtremes.lowest.margin)} at ${marginExtremes.lowest.age}`
                : "--"
        );
        setElementText(
            "highestAnnualMargin",
            marginExtremes?.highest
                ? `${formatCurrency(marginExtremes.highest.margin)} at ${marginExtremes.highest.age}`
                : "--"
        );

        setElementText("largestVulnerability", vulnerabilityAnalysis.primaryRisk?.label ?? "Low Vulnerability");
        setElementText(
            "vulnerabilityExplanation",
            vulnerabilityAnalysis.primaryRisk?.explanation ??
            "Current stress tests did not identify a single dominant retirement threat."
        );
        setElementText(
            "vulnerabilityMitigation",
            vulnerabilityAnalysis.primaryRisk?.mitigation ??
            "Best mitigation: preserve margin and keep reducing dependence on stressed assumptions."
        );
        setElementText(
            "primaryRiskSeverity",
            vulnerabilityAnalysis.primaryRisk
                ? `${vulnerabilityAnalysis.primaryRisk.severityTier} (${vulnerabilityAnalysis.primaryRisk.severityScore})`
                : "Low"
        );
        setElementText(
            "primaryRiskFailureAge",
            vulnerabilityAnalysis.primaryRisk?.stressedMetrics?.failureAge ?? "None"
        );
        setElementText(
            "primaryRiskDepletionAge",
            vulnerabilityAnalysis.primaryRisk?.stressedMetrics?.assetDepletionAge ?? "None"
        );

        renderRiskList(vulnerabilityAnalysis);
        renderRecommendedAgeOverview({
            retireAge,
            analysis
        });
        renderMarginOverview({
            retirementYear,
            results
        });
        renderRecommendationSection({
            retireAge,
            analysis,
            vulnerabilityAnalysis,
            results
        });
        renderPlanningLeverSection({
            retireAge,
            analysis,
            vulnerabilityAnalysis,
            avgMargin,
            retirementYear
        });
        renderReadinessBreakdown(results, retireAge);
        renderExpenseBreakdown(retirementYear);
        renderTaxSnapshot(retirementYear);
        renderShortfallSummary(currentProjection, analysis);
    }

    document.getElementById("editInputsBtn").onclick = () => {
        window.location.href = "simulator.html";
    };

    const printButton = document.getElementById("printReportBtn");
    if (printButton) {
        printButton.onclick = () => window.print();
    }

    const downloadPdfButton = document.getElementById("downloadPdfBtn");
    if (downloadPdfButton) {
        downloadPdfButton.onclick = () => {
            const slider = document.getElementById("retirementAgeSlider");
            const activeRetireAge =
                parseInt(slider?.value || String(initialRecommendedAge), 10) ||
                initialRecommendedAge;
            openPdfExportFlow(activeRetireAge);
        };
    }

    const baselineAnalysis = analyzeRetirementPlan({
        inputs: baseInputs,
        incomeSources,
        projection
    });
    const initialRecommendedAge =
        baselineAnalysis.recommendedRetirementAge ??
        baselineAnalysis.earliestRetirementAge ??
        baseInputs.retireAge;
    const slider = document.getElementById("retirementAgeSlider");
    const comparisonChartToggleBtn =
        document.getElementById("comparisonChartToggleBtn");

    if (slider) {
        slider.min = String(50);
        slider.max = String(
            Math.min(
                Math.max(baseInputs.lifeExpectancy || 70, 70) - 5,
                70
            )
        );
        slider.value = String(initialRecommendedAge);
        slider.addEventListener("input", () => {
            const retireAge =
                parseInt(slider.value, 10) || initialRecommendedAge;
            renderDashboardForAge(retireAge);
        });
    }

    if (comparisonChartToggleBtn) {
        syncComparisonChartToggleUi();
        comparisonChartToggleBtn.addEventListener("click", () => {
            comparisonChartMode =
                comparisonChartMode === "bar"
                    ? "line"
                    : "bar";

            syncComparisonChartToggleUi();

            const retireAge =
                parseInt(slider?.value || String(initialRecommendedAge), 10) ||
                initialRecommendedAge;

            renderDashboardForAge(retireAge);
        });
    }

    initializeDetailToggles();
    renderDashboardForAge(initialRecommendedAge);
});
