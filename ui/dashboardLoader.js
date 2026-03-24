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
import {
    buildMarginOverviewText,
    buildPlanningLeverContent,
    buildRecommendedAgeSummary,
    buildRecommendationContent,
    formatCurrency,
    formatMarginExtremeValue,
    formatPercent,
    getDisplayedRecommendationAge,
    getReadinessGradeDescription,
    summarizeDashboardResults
} from "../analysis/dashboardViewModel.js";

let comparisonChartMode = "bar";

function getMinimumDashboardRetirementAge(inputs = {}) {
    const currentAge =
        Math.max(
            0,
            Math.ceil(inputs?.profile?.currentAge || 0)
        );

    return Math.max(50, currentAge);
}

function getMaximumDashboardRetirementAge(inputs = {}) {
    const minimumAge = getMinimumDashboardRetirementAge(inputs);

    return Math.max(
        minimumAge,
        Math.min(
            Math.max(inputs?.lifeExpectancy || 70, 70) - 5,
            70
        )
    );
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

function setElementText(id, value) {
    const el = document.getElementById(id);

    if (el) {
        el.innerText = value;
    }
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
    const content = buildRecommendationContent({
        retireAge,
        analysis,
        vulnerabilityAnalysis,
        results
    });

    if (headline) {
        headline.textContent = content.headline;
    }

    if (narrative) {
        narrative.textContent = content.narrative;
    }

    if (shortText) {
        shortText.textContent = content.shortText;
    }
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

function renderReadinessBreakdown(results, retireAge) {
    const readiness = calculateReadinessScore(results, retireAge);
    const breakdown = readiness.breakdown || {};

    document.getElementById("readinessCoverageScore").innerText =
        `${Math.round(breakdown.coverageScore || 0)} / 30`;
    document.getElementById("readinessDeficitScore").innerText =
        `${Math.round(breakdown.essentialScore || 0)} / 20`;
    document.getElementById("readinessLongevityScore").innerText =
        `${Math.round(breakdown.longevityScore || 0)} / 25`;
    document.getElementById("readinessEarlyScore").innerText =
        `${Math.round(breakdown.earlyScore || 0)} / 15`;
    document.getElementById("readinessStabilityScore").innerText =
        `${Math.round(breakdown.marginScore || 0)} / 10`;
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
        const dashboardSummary = summarizeDashboardResults({
            results,
            retireAge: currentInputs.retireAge
        });
        const {
            coverage,
            avgMargin,
            retirementYear,
            totalAssets,
            totalDebts,
            netWorth,
            marginExtremes
        } = dashboardSummary;
        const comparisonChartModeForScreen = comparisonChartMode;

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
        setElementText(
            "recommendedRetirement",
            getDisplayedRecommendationAge(analysis, retireAge) ?? "Not Achievable"
        );
        setElementText("reportIncomeMargin", `${avgMargin >= 0 ? "+" : "-"}${formatCurrency(Math.abs(avgMargin))}`);
        setElementText("assetDepletion", analysis.assetDepletionAge ?? "Sustainable");
        setElementText("totalAssets", "$" + Math.round(totalAssets).toLocaleString());
        setElementText("totalDebts", "$" + Math.round(totalDebts).toLocaleString());
        setElementText("netWorth", "$" + Math.round(netWorth).toLocaleString());
        setElementText("retirementIncome", "$" + Math.round(retirementYear.income).toLocaleString());
        setElementText("annualExpenses", "$" + Math.round(retirementYear.expenses).toLocaleString());
        setElementText(
            "lowestAnnualMargin",
            formatMarginExtremeValue(marginExtremes?.lowest)
        );
        setElementText(
            "highestAnnualMargin",
            formatMarginExtremeValue(marginExtremes?.highest)
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
        setElementText(
            "recommendedAgeSummary",
            buildRecommendedAgeSummary({
                retireAge,
                analysis
            })
        );
        setElementText(
            "marginSummaryText",
            buildMarginOverviewText({
                retirementYear,
                results
            })
        );
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
    const minimumRetirementAge =
        getMinimumDashboardRetirementAge(baseInputs);
    const maximumRetirementAge =
        getMaximumDashboardRetirementAge(baseInputs);
    const initialSliderAge =
        Math.min(
            Math.max(initialRecommendedAge, minimumRetirementAge),
            maximumRetirementAge
        );

    if (slider) {
        slider.min = String(minimumRetirementAge);
        slider.max = String(maximumRetirementAge);
        slider.value = String(initialSliderAge);
        slider.addEventListener("input", () => {
            const retireAge =
                parseInt(slider.value, 10) || initialSliderAge;
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
                parseInt(slider?.value || String(initialSliderAge), 10) ||
                initialSliderAge;

            renderDashboardForAge(retireAge);
        });
    }

    initializeDetailToggles();
    renderDashboardForAge(initialSliderAge);
});
