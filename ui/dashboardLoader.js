import { renderProjectionChart } from "./projectionChart.js";
import { renderMonteCarloProjectionChart } from "./monteCarloProjectionChart.js";
import { getAccountContext } from "./apiClient.js";
import { hasPremiumAccess } from "./accountEntitlements.js";
import {
    analyzeRetirementPlan
} from "../analysis/retirementAnalysis.js";
import { runMonteCarloSimulation } from "../analysis/monteCarloEngine.js";
import { buildEstateProjectionSummary } from "../analysis/estateProjectionSummary.js";
import { buildSocialSecurityOptimization } from "../analysis/socialSecurityOptimizer.js";
import { buildWithdrawalStrategyOptimization } from "../analysis/withdrawalStrategyOptimizer.js";
import { StateManager } from "../core/stateManager.js";
import { buildPremiumStressTestMonteCarloConfig } from "../core/premiumStressTesting.js";
import { runProjection } from "../core/projectionEngine.js";
import { simulationStateToInputs } from "../core/simulationState.js";
import { runRetirementVulnerabilityAnalysis } from "../analysis/retirementVulnerability.js";
import {
    buildRiskListEntries,
    buildMonteCarloContent,
    buildMonteCarloProjectionChartContent,
    buildExpenseBreakdownSummary,
    buildMarginOverviewText,
    buildPlanningLeverContent,
    buildRecommendedAgeSummary,
    buildRecommendationContent,
    buildSpouseConversationSummary,
    buildShortfallSummary,
    buildTaxSnapshotSummary,
    buildTopRiskEntries,
    formatCurrency,
    formatMarginExtremeValue,
    getMaximumDashboardRetirementAge,
    getDisplayedRecommendationAge,
    getMinimumDashboardRetirementAge,
    getReadinessBandDescription,
    summarizeDashboardResults
} from "../analysis/dashboardViewModel.js";
import { buildDashboardScenario } from "./dashboardScenario.js";

let comparisonChartMode = "bar";
let monteCarloRenderToken = 0;
let monteCarloTimeoutId = null;

const FREE_MONTE_CARLO_ITERATIONS = 250;
const PREMIUM_MONTE_CARLO_ITERATIONS = 1000;
const MONTE_CARLO_BASE_SEED = 424242;

let monteCarloIterations = FREE_MONTE_CARLO_ITERATIONS;
let monteCarloPlusEnabled = false;
let dashboardAccountContext = null;

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

function normalizeReadinessBand(analysis = {}) {
    return analysis?.readinessBand ||
        analysis?.readinessGrade ||
        "Fragile";
}

function applyReadinessBandState(band) {
    const badge = document.getElementById("readinessGrade");

    if (!badge) {
        return;
    }

    badge.innerText = band;
    badge.classList.remove(
        "readiness-band-fragile",
        "readiness-band-workable",
        "readiness-band-strong",
        "readiness-band-durable"
    );

    const normalizedBand =
        String(band || "")
            .trim()
            .toLowerCase();

    if (normalizedBand) {
        badge.classList.add(`readiness-band-${normalizedBand}`);
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

function renderWithdrawalOptimizerSection({
    simulationState,
    projection
}) {
    const premiumEnabled =
        hasPremiumAccess(dashboardAccountContext, "premium");
    const headline = document.getElementById("withdrawalOptimizerHeadline");
    const summary = document.getElementById("withdrawalOptimizerSummary");
    const premiumNote =
        document.getElementById("withdrawalOptimizerPremiumNote");
    const highlights =
        document.getElementById("withdrawalOptimizerHighlights");
    const bridgePlan =
        document.getElementById("withdrawalOptimizerBridgePlan");
    const sequence =
        document.getElementById("withdrawalOptimizerSequence");
    const notes =
        document.getElementById("withdrawalOptimizerNotes");

    if (!headline || !summary || !premiumNote || !highlights || !bridgePlan || !sequence || !notes) {
        return;
    }

    if (!premiumEnabled) {
        headline.textContent = "Premium withdrawal strategy guidance";
        summary.textContent =
            "Premium turns your account mix into a suggested withdrawal order, bridge-year funding plan, and tax-order guidance.";
        premiumNote.hidden = false;
        premiumNote.textContent =
            dashboardAccountContext?.user?.email
                ? "This account is currently on the free tier. Upgrade to premium to unlock personalized withdrawal order, bridge-year, and tax-order guidance."
                : "Sign in with a premium account to unlock personalized withdrawal order, bridge-year, and tax-order guidance.";
        highlights.hidden = true;
        sequence.innerHTML = `
            <div class="optimizer-sequence-item">
                <h3>Premium optimizer preview</h3>
                <p>See which accounts to tap first, which dollars to preserve for later, and where bridge-year tax pressure is likely to come from.</p>
            </div>
        `;
        bridgePlan.innerHTML = `
            <div class="optimizer-sequence-item">
                <h3>Premium bridge-year planner preview</h3>
                <p>See the cumulative spending gap before Social Security starts, the cleanest bridge funding source, and a step-by-step bridge-year funding sequence.</p>
            </div>
        `;
        notes.innerHTML = "";
        return;
    }

    premiumNote.hidden = true;

    const optimization =
        buildWithdrawalStrategyOptimization({
            simulationState,
            projection
        });

    headline.textContent = optimization.headline;
    summary.textContent = optimization.summary;
    highlights.hidden = false;

    setElementText(
        "withdrawalOptimizerBridgeYears",
        optimization.highlights?.bridgeYears
            ? `${optimization.highlights.bridgeYears}`
            : "0"
    );
    setElementText(
        "withdrawalOptimizerAnnualGap",
        optimization.highlights?.annualGap > 0
            ? formatCurrency(optimization.highlights.annualGap)
            : "Covered"
    );
    setElementText(
        "withdrawalOptimizerBridgeGap",
        optimization.highlights?.cumulativeBridgeGap > 0
            ? formatCurrency(optimization.highlights.cumulativeBridgeGap)
            : "Covered"
    );
    setElementText(
        "withdrawalOptimizerPrimaryBridgeSource",
        optimization.highlights?.primaryBridgeSource || "--"
    );
    setElementText(
        "withdrawalOptimizerBridgePressure",
        optimization.highlights?.bridgePressure || "--"
    );
    setElementText(
        "withdrawalOptimizerTaxDeferredBalance",
        formatCurrency(optimization.highlights?.taxDeferredBalance || 0)
    );

    bridgePlan.innerHTML =
        optimization.bridgePlan.length
            ? optimization.bridgePlan.map((entry, index) => `
                <div class="optimizer-sequence-item optimizer-bridge-item">
                    <div class="optimizer-sequence-eyebrow">Bridge Step ${index + 1}</div>
                    <h3>${entry.title}</h3>
                    <p>${entry.rationale}</p>
                    ${entry.amount > 0 ? `
                        <div class="optimizer-bridge-amount">
                            <span>Potential bridge dollars</span>
                            <strong>${formatCurrency(entry.amount)}</strong>
                        </div>
                    ` : ""}
                </div>
            `).join("")
            : `
                <div class="optimizer-sequence-item">
                    <h3>No bridge plan needed yet</h3>
                    <p>Social Security timing does not create a meaningful bridge window in the current plan.</p>
                </div>
            `;

    sequence.innerHTML =
        optimization.sequence.length
            ? optimization.sequence.map((entry, index) => `
                <div class="optimizer-sequence-item">
                    <h3>${index + 1}. ${entry.title}</h3>
                    <p>${entry.rationale}</p>
                </div>
            `).join("")
            : `
                <div class="optimizer-sequence-item">
                    <h3>No withdrawal sequence available yet</h3>
                    <p>Add retirement or liquid accounts to generate personalized withdrawal guidance.</p>
                </div>
            `;

    notes.innerHTML =
        optimization.notes.map(note => `
            <div class="optimizer-note-card">
                <span>${note.label}</span>
                <strong>${note.value}</strong>
            </div>
        `).join("");
}

function renderSocialSecurityOptimizerSection({
    simulationState
}) {
    const premiumEnabled =
        hasPremiumAccess(dashboardAccountContext, "premium");
    const headline =
        document.getElementById("socialSecurityOptimizerHeadline");
    const summary =
        document.getElementById("socialSecurityOptimizerSummary");
    const premiumNote =
        document.getElementById("socialSecurityOptimizerPremiumNote");
    const highlights =
        document.getElementById("socialSecurityOptimizerHighlights");
    const options =
        document.getElementById("socialSecurityOptimizerOptions");
    const notes =
        document.getElementById("socialSecurityOptimizerNotes");

    if (!headline || !summary || !premiumNote || !highlights || !options || !notes) {
        return;
    }

    if (!premiumEnabled) {
        headline.textContent = "Premium Social Security claiming guidance";
        summary.textContent =
            "Premium compares age 62, full retirement age, and age 70 against the current plan so you can see which claiming age best fits the bridge years, portfolio pressure, and late-life income tradeoff.";
        premiumNote.hidden = false;
        premiumNote.textContent =
            dashboardAccountContext?.user?.email
                ? "This account is currently on the free tier. Upgrade to premium to unlock plan-aware Social Security claiming guidance."
                : "Sign in with a premium account to unlock plan-aware Social Security claiming guidance.";
        highlights.hidden = true;
        options.innerHTML = `
            <div class="optimizer-sequence-item">
                <h3>Premium optimizer preview</h3>
                <p>See how claiming at 62, full retirement age, and 70 changes your bridge years, readiness, first deficit age, and late-life guaranteed income.</p>
            </div>
        `;
        notes.innerHTML = "";
        return;
    }

    premiumNote.hidden = true;

    const optimization =
        buildSocialSecurityOptimization({
            simulationState
        });

    headline.textContent = optimization.headline;
    summary.textContent = optimization.summary;

    if (!optimization.available) {
        highlights.hidden = true;
        options.innerHTML = `
            <div class="optimizer-sequence-item">
                <h3>Social Security inputs need one more pass</h3>
                <p>${optimization.summary}</p>
            </div>
        `;
        notes.innerHTML = "";
        return;
    }

    highlights.hidden = false;
    setElementText(
        "socialSecurityOptimizerRecommendedAge",
        optimization.highlights?.recommendedAge || "--"
    );
    setElementText(
        "socialSecurityOptimizerMonthlyBenefit",
        optimization.highlights?.recommendedMonthlyBenefit || "--"
    );
    setElementText(
        "socialSecurityOptimizerCumulativeTo85",
        optimization.highlights?.cumulativeTo85 || "--"
    );
    setElementText(
        "socialSecurityOptimizerWhy",
        optimization.highlights?.recommendationWhy || "--"
    );

    options.innerHTML =
        optimization.options.length
            ? optimization.options.map(option => `
                <div class="optimizer-sequence-item">
                    ${option.badge ? `<div class="social-security-option-badge">${option.badge}</div>` : ""}
                    <h3>${option.title}</h3>
                    <p>${option.narrative}</p>
                    <div class="social-security-option-metrics">
                        <div>
                            <span>Best For</span>
                            <strong>${option.bestFor}</strong>
                        </div>
                        <div>
                            <span>Monthly Benefit</span>
                            <strong>${option.monthlyBenefit}</strong>
                        </div>
                        <div>
                            <span>Lift vs 62</span>
                            <strong>${option.monthlyLiftVs62}</strong>
                        </div>
                        <div>
                            <span>Bridge Years</span>
                            <strong>${option.bridgeYears}</strong>
                        </div>
                        <div>
                            <span>Bridge Strain</span>
                            <strong>${option.bridgeStrain}</strong>
                        </div>
                        <div>
                            <span>Portfolio Used Before Claim</span>
                            <strong>${option.bridgePortfolioDraw}</strong>
                        </div>
                        <div>
                            <span>Readiness</span>
                            <strong>${option.readiness}</strong>
                        </div>
                        <div>
                            <span>First Deficit Age</span>
                            <strong>${option.firstDeficitAge}</strong>
                        </div>
                        <div>
                            <span>Asset Depletion</span>
                            <strong>${option.assetDepletionAge}</strong>
                        </div>
                        <div>
                            <span>Social Security Through 85</span>
                            <strong>${option.cumulativeTo85}</strong>
                        </div>
                        <div>
                            <span>Claim Fit Score</span>
                            <strong>${option.claimFitScore} / 100</strong>
                        </div>
                        <div>
                            <span>Ending Net Worth</span>
                            <strong>${option.endingNetWorth}</strong>
                        </div>
                    </div>
                </div>
            `).join("")
            : `
                <div class="optimizer-sequence-item">
                    <h3>No claiming comparison available yet</h3>
                    <p>Add birth year, a Social Security benefit estimate, and a retirement age to compare claiming choices.</p>
                </div>
            `;

    notes.innerHTML =
        optimization.notes.map(note => `
            <div class="optimizer-note-card">
                <span>${note.label}</span>
                <strong>${note.value}</strong>
            </div>
        `).join("");
}

function renderEstateProjectionSection({
    currentInputs,
    simulationState,
    projection
}) {
    const premiumEnabled =
        hasPremiumAccess(dashboardAccountContext, "premium");
    const headline = document.getElementById("estateProjectionHeadline");
    const summary = document.getElementById("estateProjectionSummary");
    const premiumNote =
        document.getElementById("estateProjectionPremiumNote");
    const highlights =
        document.getElementById("estateProjectionHighlights");
    const tableBody =
        document.getElementById("estateProjectionTableBody");
    const helpGrid =
        document.getElementById("estatePlanningHelp");

    if (!headline || !summary || !premiumNote || !highlights || !tableBody || !helpGrid) {
        return;
    }

    if (!premiumEnabled) {
        headline.textContent = "Premium estate projection guidance";
        summary.textContent =
            "Premium shows the expected net-worth path at every projected age and adds estate-planning prompts based on the assets in the plan.";
        premiumNote.hidden = false;
        premiumNote.textContent =
            dashboardAccountContext?.user?.email
                ? "This account is currently on the free tier. Upgrade to premium to unlock year-by-year estate projection and estate-planning guidance."
                : "Sign in with a premium account to unlock year-by-year estate projection and estate-planning guidance.";
        highlights.hidden = true;
        tableBody.innerHTML = `
            <tr>
                <td colspan="6">Premium estate projection rows will appear here once a premium account is active.</td>
            </tr>
        `;
        helpGrid.innerHTML = "";
        return;
    }

    premiumNote.hidden = true;

    const estateProjection =
        buildEstateProjectionSummary({
            currentInputs,
            incomeSources: simulationState?.incomeSources || [],
            projection
        });

    headline.textContent = estateProjection.headline;
    summary.textContent = estateProjection.summary;
    highlights.hidden = false;

    setElementText(
        "estateProjectionEndOfLifeNetWorth",
        estateProjection.highlights?.endOfLifeNetWorth || "-"
    );
    setElementText(
        "estateProjectionPeakNetWorth",
        estateProjection.highlights?.peakNetWorth || "-"
    );
    setElementText(
        "estateProjectionFirstNegativeAge",
        estateProjection.highlights?.firstNegativeAge || "None"
    );

    tableBody.innerHTML =
        estateProjection.rows.length
            ? estateProjection.rows.map(row => `
                <tr>
                    <td>${row.age}</td>
                    <td>${row.year}</td>
                    <td>${row.netWorth}</td>
                    <td>${row.portfolio}</td>
                    <td>${row.realEstate}</td>
                    <td>${row.debts}</td>
                </tr>
            `).join("")
            : `
                <tr>
                    <td colspan="6">Estate projection data is not available yet.</td>
                </tr>
            `;

    helpGrid.innerHTML =
        estateProjection.helpCards.map(card => `
            <div class="estate-help-card">
                <h3>${card.title}</h3>
                <p>${card.body}</p>
            </div>
        `).join("");
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

function formatReadinessBreakdownValue(value, maxValue, fallback = "--") {
    if (!Number.isFinite(value) || !Number.isFinite(maxValue)) {
        return fallback;
    }

    return `${Math.round(value)} / ${Math.round(maxValue)}`;
}

function renderReadinessBreakdown(readiness = null) {
    const breakdown = readiness?.breakdown || {};
    const maxScores = readiness?.maxScores || {};

    document.getElementById("readinessCoverageScore").innerText =
        formatReadinessBreakdownValue(
            breakdown.coverageScore,
            maxScores.coverageScore ?? 30
        );
    document.getElementById("readinessDeficitScore").innerText =
        formatReadinessBreakdownValue(
            breakdown.essentialScore,
            maxScores.essentialScore ?? 20
        );
    document.getElementById("readinessLongevityScore").innerText =
        formatReadinessBreakdownValue(
            breakdown.longevityScore,
            maxScores.longevityScore ?? 25
        );
    document.getElementById("readinessEarlyScore").innerText =
        formatReadinessBreakdownValue(
            breakdown.earlyScore,
            maxScores.earlyScore ?? 15
        );
    document.getElementById("readinessStabilityScore").innerText =
        formatReadinessBreakdownValue(
            breakdown.marginScore,
            maxScores.marginScore ?? 10
        );
    document.getElementById("readinessMonteCarloScore").innerText =
        formatReadinessBreakdownValue(
            breakdown.monteCarloScore,
            maxScores.monteCarloScore ?? 20,
            "Pending"
        );
}

function renderExpenseBreakdown(retirementYear) {
    if (!document.getElementById("expenseEssential")) {
        return;
    }

    const breakdown = buildExpenseBreakdownSummary(retirementYear);

    setElementText("expenseEssential", breakdown.essential);
    setElementText("expenseDiscretionary", breakdown.discretionary);
    setElementText("expenseHousing", breakdown.housing);
    setElementText("expenseHealthcare", breakdown.healthcare);
    setElementText("expenseInsurance", breakdown.insurance);
    setElementText("expenseGoodsServices", breakdown.goodsServices);
}

function renderTaxSnapshot(retirementYear) {
    const taxSnapshot = buildTaxSnapshotSummary(retirementYear);

    setElementText("taxesAtRetirement", taxSnapshot.taxesAtRetirement);
    setElementText("taxableIncomeAtRetirement", taxSnapshot.taxableIncomeAtRetirement);
    setElementText("taxDragRatio", taxSnapshot.taxDragRatio);
    setElementText(
        "taxSnapshotNarrative",
        taxSnapshot.narrative
    );
}

function renderTopRisks(vulnerabilityAnalysis) {
    const container = document.getElementById("topRisksList");
    if (!container) return;

    const topRisks = buildTopRiskEntries(vulnerabilityAnalysis);

    container.innerHTML = topRisks.map(risk => `
        <div class="report-risk-item">
            ${risk.severityMeta ? `<div class="report-risk-meta">${risk.severityMeta}</div>` : ""}
            <h4>${risk.label}</h4>
            <p>${risk.explanation}</p>
            ${risk.mitigation ? `<p><strong>Best mitigation:</strong> ${risk.mitigation}</p>` : ""}
        </div>
    `).join("");
}

function renderShortfallSummary(projection, analysis) {
    if (!document.getElementById("reportFirstDeficitAge")) {
        return;
    }

    const shortfallSummary = buildShortfallSummary({
        projection,
        analysis
    });

    setElementText("reportFirstDeficitAge", shortfallSummary.firstDeficitAge);
    setElementText("reportCumulativeShortfall", shortfallSummary.cumulativeShortfall);
    setElementText("reportWorstAnnualDeficit", shortfallSummary.worstAnnualDeficit);
}

function renderSpouseConversationSection({
    currentInputs,
    analysis,
    vulnerabilityAnalysis,
    projection
}) {
    const headline = document.getElementById("spouseConversationHeadline");
    const summary = document.getElementById("spouseConversationSummary");
    const snapshot = document.getElementById("spouseConversationSnapshot");
    const prompts = document.getElementById("spouseConversationPrompts");
    const note = document.getElementById("spouseConversationNote");

    if (!headline || !summary || !snapshot || !prompts || !note) {
        return;
    }

    const content = buildSpouseConversationSummary({
        currentInputs,
        analysis,
        vulnerabilityAnalysis,
        projection
    });

    headline.textContent = content.headline;
    summary.textContent = content.summary;
    note.textContent = content.note;

    snapshot.innerHTML =
        content.snapshot.length
            ? content.snapshot.map(item => `
                <div class="report-highlight-card spouse-conversation-card">
                    <div class="report-highlight-label">${item.label}</div>
                    <div class="report-highlight-value">${item.value}</div>
                </div>
            `).join("")
            : `
                <div class="report-highlight-card spouse-conversation-card">
                    <div class="report-highlight-label">Setup Needed</div>
                    <div class="report-highlight-value report-highlight-value-note">Add spouse planning inputs in the calculator to populate this section.</div>
                </div>
            `;

    prompts.innerHTML =
        content.prompts.length
            ? content.prompts.map((item, index) => `
                <div class="optimizer-sequence-item spouse-conversation-item">
                    <div class="optimizer-sequence-eyebrow">Conversation ${index + 1}</div>
                    <h3>${item.title}</h3>
                    <p>${item.body}</p>
                </div>
            `).join("")
            : `
                <div class="optimizer-sequence-item spouse-conversation-item">
                    <h3>Spouse planning inputs not found</h3>
                    <p>Add spouse age, retirement age, and income in the calculator to generate a household discussion summary.</p>
                </div>
            `;
}

function renderRiskList(vulnerabilityAnalysis) {
    const riskList = document.getElementById("riskList");
    if (!riskList) return;

    const riskEntries =
        buildRiskListEntries(vulnerabilityAnalysis);

    riskList.innerHTML = "";

    riskEntries.forEach(text => {
        const li = document.createElement("li");
        li.textContent = text;
        riskList.appendChild(li);
    });
}

function setMonteCarloLoadingState() {
    setElementText("monteCarloHeadline", "Monte Carlo success rate loading...");
    setElementText(
        "monteCarloSummary",
        "The Monte Carlo engine is running different market and inflation scenarios for this retirement age."
    );
    setElementText("monteCarloSuccessRate", "--");
    setElementText("monteCarloEssentialSuccessRate", "--");
    setElementText("monteCarloConfidenceLabel", "Running trials");
    setElementText(
        "monteCarloNarrative",
        "We are stress-testing this plan under many different market and inflation scenarios now."
    );
    setElementText("monteCarloMedianReadiness", "--");
    setElementText("monteCarloMedianFailureAge", "--");
    setElementText("monteCarloMedianAssetDepletionAge", "--");
    setElementText("monteCarloP10NetWorth", "--");
    setElementText("monteCarloMedianNetWorth", "--");
    setElementText("monteCarloP90NetWorth", "--");
    setElementText("monteCarloIterations", String(monteCarloIterations));
    setElementText(
        "monteCarloRangeSummary",
        "Building the Monte Carlo range chart for this retirement age now."
    );
    setElementText("monteCarloMeanEndingNetWorth", "--");
    setElementText("monteCarloWorstEndingNetWorth", "--");
    setElementText("monteCarloBestEndingNetWorth", "--");
    setElementText("monteCarloWorstCaseMeta", "Awaiting range data");
    setElementText("monteCarloBestCaseMeta", "Awaiting range data");
    renderMonteCarloProjectionChart({
        canvasId: "monteCarloProjectionChart",
        chart: null
    });
}

async function loadDashboardAccountContext() {
    try {
        dashboardAccountContext = await getAccountContext();
    } catch (error) {
        dashboardAccountContext = null;
    }

    return dashboardAccountContext;
}

function applyMonteCarloEntitlementState(accountContext = null) {
    monteCarloPlusEnabled =
        hasPremiumAccess(accountContext, "monteCarloPlus");
    monteCarloIterations =
        monteCarloPlusEnabled
            ? PREMIUM_MONTE_CARLO_ITERATIONS
            : FREE_MONTE_CARLO_ITERATIONS;

    const premiumNote = document.getElementById("monteCarloPremiumNote");
    const rangePanel = document.getElementById("monteCarloRangePanel");

    if (premiumNote) {
        premiumNote.hidden = monteCarloPlusEnabled;
        premiumNote.textContent =
            accountContext?.user?.email
                ? "Monte Carlo Plus path ranges and deeper trial runs are reserved for premium accounts. This account is currently on the free tier."
                : "Sign in with a premium account to unlock Monte Carlo Plus path ranges and deeper trial runs.";
    }

    if (rangePanel) {
        rangePanel.hidden = !monteCarloPlusEnabled;
    }
}

function syncPremiumStressTestingNote({
    premiumStressTesting = null,
    customStressConfig = null
} = {}) {
    const note = document.getElementById("monteCarloStressNote");

    if (!note) {
        return;
    }

    if (!monteCarloPlusEnabled) {
        note.hidden = true;
        note.textContent = "";
        return;
    }

    const settings = premiumStressTesting || {};
    const customStressEnabled =
        Boolean(settings?.enabled) &&
        Boolean(customStressConfig);

    note.hidden = !customStressEnabled;

    if (!customStressEnabled) {
        note.textContent = "";
        return;
    }

    const goodsServicesRate =
        Number.isFinite(settings?.goodsServicesInflationTargetRate)
            ? `${Math.round(settings.goodsServicesInflationTargetRate * 1000) / 10}%`
            : "default";
    const healthcareRate =
        Number.isFinite(settings?.healthcareInflationTargetRate)
            ? `${Math.round(settings.healthcareInflationTargetRate * 1000) / 10}%`
            : "default";
    const portfolioFloor =
        Number.isFinite(settings?.portfolioDownsideFloorRate)
            ? `${Math.round(settings.portfolioDownsideFloorRate * 1000) / 10}%`
            : "default";
    const shockRate =
        Number.isFinite(settings?.earlyRetirementShockRate)
            ? `${Math.round(settings.earlyRetirementShockRate * 1000) / 10}%`
            : "default";
    const shockYears =
        Number.isFinite(settings?.earlyRetirementShockYears)
            ? settings.earlyRetirementShockYears
            : 0;

    note.textContent =
        `Custom premium stress profile active: goods/services inflation ${goodsServicesRate}, healthcare inflation ${healthcareRate}, portfolio floor ${portfolioFloor}, and an early shock of ${shockRate} for ${shockYears} years.`;
}

function renderMonteCarloSection({
    simulationState,
    retireAge,
    inputs,
    incomeSources,
    projection,
    premiumStressTesting = null
}) {
    monteCarloRenderToken += 1;
    const currentToken = monteCarloRenderToken;

    if (monteCarloTimeoutId) {
        window.clearTimeout(monteCarloTimeoutId);
    }

    setMonteCarloLoadingState();

    const customStressConfig =
        monteCarloPlusEnabled
            ? buildPremiumStressTestMonteCarloConfig({
                premiumStressTesting,
                baseAssumptions: simulationState?.assumptions || {}
            })
            : null;

    syncPremiumStressTestingNote({
        premiumStressTesting,
        customStressConfig
    });

    monteCarloTimeoutId = window.setTimeout(() => {
        const monteCarlo = runMonteCarloSimulation({
            simulationState,
            iterations: monteCarloIterations,
            seed: MONTE_CARLO_BASE_SEED,
            config: customStressConfig || {}
        });

        if (currentToken !== monteCarloRenderToken) {
            return;
        }

        const content = buildMonteCarloContent(monteCarlo);

        setElementText("monteCarloHeadline", content.headline);
        setElementText("monteCarloSummary", content.summary);
        setElementText("monteCarloSuccessRate", content.successRate);
        setElementText(
            "monteCarloEssentialSuccessRate",
            content.essentialSuccessRate
        );
        setElementText("monteCarloConfidenceLabel", content.confidenceLabel);
        setElementText("monteCarloNarrative", content.narrative);
        setElementText(
            "monteCarloMedianReadiness",
            content.medianReadinessScore
        );
        setElementText(
            "monteCarloMedianFailureAge",
            content.medianFailureAge
        );
        setElementText(
            "monteCarloMedianAssetDepletionAge",
            content.medianAssetDepletionAge
        );
        setElementText("monteCarloP10NetWorth", content.percentile10EndingNetWorth);
        setElementText("monteCarloMedianNetWorth", content.medianEndingNetWorth);
        setElementText("monteCarloP90NetWorth", content.percentile90EndingNetWorth);
        setElementText("monteCarloIterations", content.iterations);

        if (monteCarloPlusEnabled) {
            const probabilityAdjustedAnalysis =
                analyzeRetirementPlan({
                    inputs,
                    incomeSources,
                    projection,
                    monteCarloSummary: monteCarlo
                });
            const readinessBand =
                normalizeReadinessBand(probabilityAdjustedAnalysis);

            document.getElementById("readinessScore").innerText =
                `${probabilityAdjustedAnalysis.readinessScore} / 100`;
            applyReadinessBandState(readinessBand);
            document.getElementById("readinessDescription").innerText =
                getReadinessBandDescription(readinessBand);
            renderReadinessBreakdown({
                breakdown: probabilityAdjustedAnalysis.readinessBreakdown,
                maxScores: probabilityAdjustedAnalysis.readinessMaxScores
            });

            const projectionChartContent =
                buildMonteCarloProjectionChartContent(monteCarlo);

            if (projectionChartContent) {
                setElementText(
                    "monteCarloRangeSummary",
                    projectionChartContent.summary
                );
                setElementText(
                    "monteCarloMeanEndingNetWorth",
                    projectionChartContent.meanEndingNetWorth
                );
                setElementText(
                    "monteCarloWorstEndingNetWorth",
                    projectionChartContent.worstEndingNetWorth
                );
                setElementText(
                    "monteCarloBestEndingNetWorth",
                    projectionChartContent.bestEndingNetWorth
                );
                setElementText(
                    "monteCarloWorstCaseMeta",
                    projectionChartContent.worstCaseMeta
                );
                setElementText(
                    "monteCarloBestCaseMeta",
                    projectionChartContent.bestCaseMeta
                );
                renderMonteCarloProjectionChart({
                    canvasId: "monteCarloProjectionChart",
                    chart: projectionChartContent.chart
                });
            } else {
                setElementText(
                    "monteCarloRangeSummary",
                    "Representative best, mean, and worst-case projection paths are not available for this run."
                );
            }
        }
    }, 60);
}

document.addEventListener("DOMContentLoaded", async () => {

    await loadDashboardAccountContext();
    applyMonteCarloEntitlementState(dashboardAccountContext);

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
    const baseSavedSources = incomeSources || [];
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

    function renderDashboardForAge(retireAge) {
        updateRetirementAgeLabel(retireAge);

        const {
            currentInputs,
            currentIncomeSources,
            currentProjection,
            currentSimulationState
        } = buildDashboardScenario({
            baseInputs,
            baseSources: baseSavedSources,
            baseAssumptions,
            retireAge
        });
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
        const readinessBand = normalizeReadinessBand(analysis);

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
        applyReadinessBandState(readinessBand);
        document.getElementById("readinessDescription").innerText =
            getReadinessBandDescription(readinessBand);
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
        renderSpouseConversationSection({
            currentInputs,
            analysis,
            vulnerabilityAnalysis,
            projection: currentProjection
        });
        renderReadinessBreakdown({
            breakdown: analysis.readinessBreakdown,
            maxScores: analysis.readinessMaxScores
        });
        renderExpenseBreakdown(retirementYear);
        renderTaxSnapshot(retirementYear);
        renderShortfallSummary(currentProjection, analysis);
        renderMonteCarloSection({
            simulationState: currentSimulationState,
            retireAge,
            inputs: currentInputs,
            incomeSources: currentIncomeSources,
            projection: currentProjection,
            premiumStressTesting:
                workspaceState?.premiumStressTesting || null
        });
        renderWithdrawalOptimizerSection({
            simulationState: currentSimulationState,
            projection: currentProjection
        });
        renderSocialSecurityOptimizerSection({
            simulationState: currentSimulationState
        });
        renderEstateProjectionSection({
            currentInputs,
            simulationState: currentSimulationState,
            projection: currentProjection
        });
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
