import { renderProjectionChart } from "./projectionChart.js";
import { renderMonteCarloProjectionChart } from "./monteCarloProjectionChart.js";
import { getAccountContext, getSharedPlan } from "./apiClient.js";
import { hasPremiumAccess } from "./accountEntitlements.js";
import {
    analyzeRetirementPlan
} from "../analysis/retirementAnalysis.js";
import { runMonteCarloSimulation } from "../analysis/monteCarloEngine.js";
import { buildEstateProjectionSummary } from "../analysis/estateProjectionSummary.js";
import { buildSocialSecurityOptimization } from "../analysis/socialSecurityOptimizer.js";
import { buildSurvivorOptionOptimization } from "../analysis/survivorOptionOptimizer.js";
import { buildTaxDetailView } from "../analysis/taxDetailView.js";
import { buildWithdrawalStrategyOptimization } from "../analysis/withdrawalStrategyOptimizer.js";
import { StateManager } from "../core/stateManager.js";
import { buildPremiumStressTestMonteCarloConfig } from "../core/premiumStressTesting.js";
import { runProjection } from "../core/projectionEngine.js";
import { simulationStateToInputs } from "../core/simulationState.js";
import { runRetirementVulnerabilityAnalysis } from "../analysis/retirementVulnerability.js";
import {
    buildRiskListEntries,
    buildMonteCarloContent,
    buildMonteCarloTrustContent,
    buildMonteCarloProjectionChartContent,
    buildExpenseBreakdownSummary,
    buildHouseholdDecisionBrief,
    buildMarginOverviewText,
    buildPlanningLeverContent,
    buildProfessionalReviewSummary,
    buildReadinessTimelineContent,
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
let sharedPlanView = null;

function readSharedPlanTokenFromUrl() {
    try {
        const url = new URL(window.location.href);
        return String(url.searchParams.get("sharedPlanToken") || "").trim();
    } catch (error) {
        return "";
    }
}

function isSharedPlanView() {
    return Boolean(sharedPlanView?.token);
}

function buildPremiumLockedMessage({
    signedInMessage,
    signedOutMessage,
    sharedMessage
}) {
    if (isSharedPlanView()) {
        return sharedMessage;
    }

    if (dashboardAccountContext?.user?.email) {
        return signedInMessage;
    }

    return signedOutMessage;
}

function renderSharedPlanBanner(sharedPlan = null) {
    const banner = document.getElementById("sharedPlanBanner");
    const title = document.getElementById("sharedPlanBannerTitle");
    const summary = document.getElementById("sharedPlanBannerSummary");
    const editButton = document.getElementById("editInputsBtn");

    if (!banner || !title || !summary) {
        return;
    }

    if (!sharedPlan) {
        banner.hidden = true;

        if (editButton) {
            editButton.hidden = false;
        }

        return;
    }

    banner.hidden = false;
    title.textContent = sharedPlan.name
        ? `Shared scenario: ${sharedPlan.name}`
        : "Shared scenario";
    summary.textContent =
        "This dashboard was opened from a share link, so it is view-only and does not change the owner's saved scenario. You can review the report and print it without account access.";

    if (editButton) {
        editButton.hidden = true;
    }
}

function buildReadinessTimelineEntries({
    baseInputs,
    baseSavedSources,
    baseAssumptions,
    minimumRetirementAge,
    maximumRetirementAge
}) {
    const entries = [];

    for (let retireAge = minimumRetirementAge; retireAge <= maximumRetirementAge; retireAge += 1) {
        const {
            currentInputs,
            currentIncomeSources,
            currentProjection
        } = buildDashboardScenario({
            baseInputs,
            baseSources: baseSavedSources,
            baseAssumptions,
            retireAge
        });
        const analysis = analyzeRetirementPlan({
            inputs: currentInputs,
            incomeSources: currentIncomeSources,
            projection: currentProjection
        });
        const summary = summarizeDashboardResults({
            results: currentProjection?.results || [],
            retireAge
        });

        entries.push({
            retireAge,
            readinessScore: analysis?.readinessScore || 0,
            readinessBand: normalizeReadinessBand(analysis),
            averageMargin: summary?.avgMargin || 0,
            firstDeficitAge: analysis?.retirementFailureAge ?? null,
            assetDepletionAge: analysis?.assetDepletionAge ?? null
        });
    }

    return entries;
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

function buildTextDownloadFileName(prefix, retireAge) {
    const now = new Date();
    const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")
    ].join("-");
    const agePart =
        Number.isFinite(retireAge)
            ? `-Age-${retireAge}`
            : "";

    return `${prefix}${agePart}-${stamp}.txt`;
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

async function copyTextToClipboard(value) {
    const text = String(value || "").trim();

    if (!text) {
        throw new Error("Nothing to copy yet.");
    }

    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "readonly");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();

    try {
        document.execCommand("copy");
    } finally {
        document.body.removeChild(textArea);
    }
}

function downloadTextFile(fileName, text) {
    const content = String(text || "").trim();

    if (!content) {
        throw new Error("Nothing to download yet.");
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 0);
}

function flashActionButtonLabel(button, label, fallbackLabel) {
    if (!button) {
        return;
    }

    const nextFallback =
        fallbackLabel ||
        button.dataset.defaultLabel ||
        button.textContent ||
        "Copy Packet";

    button.dataset.defaultLabel = nextFallback;
    button.textContent = label;

    if (button._labelTimeoutId) {
        window.clearTimeout(button._labelTimeoutId);
    }

    button._labelTimeoutId = window.setTimeout(() => {
        button.textContent = nextFallback;
    }, 1800);
}

async function copyReportPacket(button, text) {
    try {
        await copyTextToClipboard(text);
        flashActionButtonLabel(button, "Copied", button?.dataset?.defaultLabel);
    } catch (error) {
        console.error("Failed to copy report packet", error);
        flashActionButtonLabel(button, "Copy failed", button?.dataset?.defaultLabel);
    }
}

function downloadReportPacket(button, text, fileName) {
    try {
        downloadTextFile(fileName, text);
        flashActionButtonLabel(button, "Downloaded", button?.dataset?.defaultLabel);
    } catch (error) {
        console.error("Failed to download report packet", error);
        flashActionButtonLabel(button, "Download failed", button?.dataset?.defaultLabel);
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
        hasPremiumAccess(dashboardAccountContext, "withdrawalStrategyOptimizer");
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

    const optimization =
        buildWithdrawalStrategyOptimization({
            simulationState,
            projection
        });

    if (!premiumEnabled) {
        headline.textContent = "Withdrawal strategy snapshot";
        summary.textContent =
            optimization.summary;
        premiumNote.hidden = false;
        premiumNote.textContent = buildPremiumLockedMessage({
            signedInMessage:
                "This account is currently on the free tier. Premium unlocks the step-by-step withdrawal order, bridge-year funding sequence, and deeper tax-order guidance.",
            signedOutMessage:
                "Sign in with a premium account to unlock the step-by-step withdrawal order, bridge-year funding sequence, and deeper tax-order guidance.",
            sharedMessage:
                "This shared scenario was created from a free-tier plan, so the step-by-step withdrawal order, bridge-year funding sequence, and deeper tax-order guidance are not included in this link."
        });
        highlights.hidden = false;
        highlights.innerHTML = `
            <div class="report-highlight-card">
                <div class="report-highlight-label">Bridge Years</div>
                <div class="report-highlight-value">${optimization.highlights?.bridgeYears ? `${optimization.highlights.bridgeYears}` : "0"}</div>
            </div>
            <div class="report-highlight-card">
                <div class="report-highlight-label">Retirement-Year Gap</div>
                <div class="report-highlight-value">${optimization.highlights?.annualGap > 0 ? formatCurrency(optimization.highlights.annualGap) : "Covered"}</div>
            </div>
            <div class="report-highlight-card">
                <div class="report-highlight-label">Cumulative Bridge Gap</div>
                <div class="report-highlight-value">${optimization.highlights?.cumulativeBridgeGap > 0 ? formatCurrency(optimization.highlights.cumulativeBridgeGap) : "Covered"}</div>
            </div>
            <div class="report-highlight-card">
                <div class="report-highlight-label">Primary Bridge Source</div>
                <div class="report-highlight-value report-highlight-value-note">${optimization.highlights?.primaryBridgeSource || "--"}</div>
            </div>
            <div class="report-highlight-card">
                <div class="report-highlight-label">Bridge Pressure</div>
                <div class="report-highlight-value">${optimization.highlights?.bridgePressure || "--"}</div>
            </div>
            <div class="report-highlight-card">
                <div class="report-highlight-label">Tax-Deferred Balance</div>
                <div class="report-highlight-value">${formatCurrency(optimization.highlights?.taxDeferredBalance || 0)}</div>
            </div>
        `;
        sequence.innerHTML = `
            <div class="optimizer-sequence-item">
                <h3>Premium withdrawal order</h3>
                <p>Premium turns this snapshot into a ranked withdrawal sequence so you can see which dollars to tap first, which dollars to preserve, and where bridge-year tax friction is most likely to show up.</p>
            </div>
        `;
        bridgePlan.innerHTML = `
            <div class="optimizer-sequence-item">
                <h3>Premium bridge-year planner</h3>
                <p>Premium expands this into a step-by-step bridge plan that shows how to cover the years before Social Security starts without burning the wrong accounts too early.</p>
            </div>
        `;
        notes.innerHTML = "";
        return;
    }

    premiumNote.hidden = true;

    headline.textContent = optimization.headline;
    summary.textContent = optimization.summary;
    highlights.hidden = false;
    highlights.innerHTML = `
        <div class="report-highlight-card">
            <div class="report-highlight-label">Bridge Years</div>
            <div id="withdrawalOptimizerBridgeYears" class="report-highlight-value">--</div>
        </div>
        <div class="report-highlight-card">
            <div class="report-highlight-label">Retirement-Year Gap</div>
            <div id="withdrawalOptimizerAnnualGap" class="report-highlight-value">--</div>
        </div>
        <div class="report-highlight-card">
            <div class="report-highlight-label">Cumulative Bridge Gap</div>
            <div id="withdrawalOptimizerBridgeGap" class="report-highlight-value">--</div>
        </div>
        <div class="report-highlight-card">
            <div class="report-highlight-label">Primary Bridge Source</div>
            <div id="withdrawalOptimizerPrimaryBridgeSource" class="report-highlight-value report-highlight-value-note">--</div>
        </div>
        <div class="report-highlight-card">
            <div class="report-highlight-label">Bridge Pressure</div>
            <div id="withdrawalOptimizerBridgePressure" class="report-highlight-value">--</div>
        </div>
        <div class="report-highlight-card">
            <div class="report-highlight-label">Tax-Deferred Balance</div>
            <div id="withdrawalOptimizerTaxDeferredBalance" class="report-highlight-value">--</div>
        </div>
    `;

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
        hasPremiumAccess(dashboardAccountContext, "socialSecurityOptimizer");
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
        premiumNote.textContent = buildPremiumLockedMessage({
            signedInMessage:
                "This account is currently on the free tier. Upgrade to premium to unlock plan-aware Social Security claiming guidance.",
            signedOutMessage:
                "Sign in with a premium account to unlock plan-aware Social Security claiming guidance.",
            sharedMessage:
                "This shared scenario was created from a free-tier plan, so plan-aware Social Security claiming guidance is not included in this link."
        });
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

function renderSurvivorOptionOptimizerSection({
    simulationState
}) {
    const premiumEnabled =
        hasPremiumAccess(dashboardAccountContext, "survivorOptionOptimizer");
    const headline =
        document.getElementById("survivorOptionOptimizerHeadline");
    const summary =
        document.getElementById("survivorOptionOptimizerSummary");
    const premiumNote =
        document.getElementById("survivorOptionOptimizerPremiumNote");
    const highlights =
        document.getElementById("survivorOptionOptimizerHighlights");
    const options =
        document.getElementById("survivorOptionOptimizerOptions");
    const notes =
        document.getElementById("survivorOptionOptimizerNotes");

    if (!headline || !summary || !premiumNote || !highlights || !options || !notes) {
        return;
    }

    if (!premiumEnabled) {
        headline.textContent = "Premium survivor-option guidance";
        summary.textContent =
            "Premium compares single life, 50%, 66.67%, and 100% survivor elections against the current household plan so you can see which tradeoff best balances spouse protection and current retirement income.";
        premiumNote.hidden = false;
        premiumNote.textContent = buildPremiumLockedMessage({
            signedInMessage:
                "This account is currently on the free tier. Upgrade to premium to unlock plan-aware survivor-option guidance.",
            signedOutMessage:
                "Sign in with a premium account to unlock plan-aware survivor-option guidance.",
            sharedMessage:
                "This shared scenario was created from a free-tier plan, so plan-aware survivor-option guidance is not included in this link."
        });
        highlights.hidden = true;
        options.innerHTML = `
            <div class="optimizer-sequence-item">
                <h3>Premium survivor optimizer preview</h3>
                <p>See which survivor election best fits the current household setup, how much pension income it gives up while you are alive, and how much survivor income it leaves behind.</p>
            </div>
        `;
        notes.innerHTML = "";
        return;
    }

    premiumNote.hidden = true;

    const optimization =
        buildSurvivorOptionOptimization({
            simulationState
        });

    headline.textContent = optimization.headline;
    summary.textContent = optimization.summary;

    if (!optimization.available) {
        highlights.hidden = true;
        options.innerHTML = `
            <div class="optimizer-sequence-item">
                <h3>Survivor inputs need one more pass</h3>
                <p>${optimization.summary}</p>
            </div>
        `;
        notes.innerHTML = "";
        return;
    }

    highlights.hidden = false;
    setElementText(
        "survivorOptionOptimizerRecommendedOption",
        optimization.highlights?.recommendedOption || "--"
    );
    setElementText(
        "survivorOptionOptimizerSurvivorIncome",
        optimization.highlights?.survivorIncome || "--"
    );
    setElementText(
        "survivorOptionOptimizerRetireeGiveUp",
        optimization.highlights?.retireeGiveUp || "--"
    );
    setElementText(
        "survivorOptionOptimizerFitScore",
        optimization.highlights?.fitScore || "--"
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
                            <span>Current Pension</span>
                            <strong>${option.currentMonthlyBenefit}</strong>
                        </div>
                        <div>
                            <span>Survivor Pension</span>
                            <strong>${option.survivorMonthlyBenefit}</strong>
                        </div>
                        <div>
                            <span>Give-Up vs Single</span>
                            <strong>${option.giveUpVsSingle}</strong>
                        </div>
                        <div>
                            <span>Survivor Coverage</span>
                            <strong>${option.survivorCoverage}</strong>
                        </div>
                        <div>
                            <span>Readiness</span>
                            <strong>${option.readiness}</strong>
                        </div>
                        <div>
                            <span>Retirement Margin</span>
                            <strong>${option.retirementMargin}</strong>
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
                            <span>Fit Score</span>
                            <strong>${option.fitScore} / 100</strong>
                        </div>
                    </div>
                </div>
            `).join("")
            : `
                <div class="optimizer-sequence-item">
                    <h3>No survivor comparison available yet</h3>
                    <p>Add spouse age and complete pension assumptions to compare survivor elections.</p>
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
        hasPremiumAccess(dashboardAccountContext, "estateProjection");
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
        premiumNote.textContent = buildPremiumLockedMessage({
            signedInMessage:
                "This account is currently on the free tier. Upgrade to premium to unlock year-by-year estate projection and estate-planning guidance.",
            signedOutMessage:
                "Sign in with a premium account to unlock year-by-year estate projection and estate-planning guidance.",
            sharedMessage:
                "This shared scenario was created from a free-tier plan, so year-by-year estate projection and estate-planning guidance are not included in this link."
        });
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

function renderTaxDetailViewSection({
    simulationState,
    projection
}) {
    const premiumEnabled =
        hasPremiumAccess(dashboardAccountContext, "taxDetailViews");
    const headline = document.getElementById("taxDetailHeadline");
    const summary = document.getElementById("taxDetailSummary");
    const premiumNote = document.getElementById("taxDetailPremiumNote");
    const highlights = document.getElementById("taxDetailHighlights");
    const tableBody = document.getElementById("taxDetailTableBody");
    const notes = document.getElementById("taxDetailNotes");

    if (!headline || !summary || !premiumNote || !highlights || !tableBody || !notes) {
        return;
    }

    if (!premiumEnabled) {
        headline.textContent = "Premium year-by-year tax detail";
        summary.textContent =
            "Premium expands the retirement-year tax snapshot into a year-by-year table so you can see income, portfolio draws, taxable income, taxes, and tax drag across the full projection.";
        premiumNote.hidden = false;
        premiumNote.textContent = buildPremiumLockedMessage({
            signedInMessage:
                "This account is currently on the free tier. Upgrade to premium to unlock year-by-year tax detail views.",
            signedOutMessage:
                "Sign in with a premium account to unlock year-by-year tax detail views.",
            sharedMessage:
                "This shared scenario was created from a free-tier plan, so year-by-year tax detail views are not included in this link."
        });
        highlights.hidden = true;
        tableBody.innerHTML = `
            <tr>
                <td colspan="8">Premium tax detail rows will appear here once a premium account is active.</td>
            </tr>
        `;
        notes.innerHTML = "";
        return;
    }

    premiumNote.hidden = true;

    const taxDetail = buildTaxDetailView({
        simulationState,
        projection
    });

    headline.textContent = taxDetail.headline;
    summary.textContent = taxDetail.summary;

    if (!taxDetail.available) {
        highlights.hidden = true;
        tableBody.innerHTML = `
            <tr>
                <td colspan="8">${taxDetail.summary}</td>
            </tr>
        `;
        notes.innerHTML = "";
        return;
    }

    highlights.hidden = false;
    setElementText(
        "taxDetailRetirementYearTaxes",
        taxDetail.highlights?.retirementYearTaxes || "--"
    );
    setElementText(
        "taxDetailLifetimeTaxes",
        taxDetail.highlights?.lifetimeTaxes || "--"
    );
    setElementText(
        "taxDetailPeakTaxYear",
        taxDetail.highlights?.peakTaxYear || "--"
    );
    setElementText(
        "taxDetailPeakTaxDrag",
        taxDetail.highlights?.peakTaxDrag || "--"
    );

    tableBody.innerHTML =
        taxDetail.rows.length
            ? taxDetail.rows.map(row => {
                const classes = [
                    row.isRetirementYear ? "is-retirement-year" : "",
                    row.isPeakTaxYear ? "is-peak-tax" : "",
                    row.isPeakTaxDragYear ? "is-peak-drag" : ""
                ].filter(Boolean).join(" ");

                return `
                    <tr class="${classes}">
                        <td>
                            <span class="readiness-timeline-age">${row.age}</span>
                            ${row.status ? `<div class="readiness-timeline-status">${row.status}</div>` : ""}
                        </td>
                        <td>${row.totalIncome}</td>
                        <td>${row.portfolioDraws}</td>
                        <td>${row.taxes}</td>
                        <td>${row.afterTaxIncome}</td>
                        <td>${row.taxableIncome}</td>
                        <td>${row.taxDrag}</td>
                        <td>${row.netMargin}</td>
                    </tr>
                `;
            }).join("")
            : `
                <tr>
                    <td colspan="8">Tax detail rows are not available yet.</td>
                </tr>
            `;

    notes.innerHTML =
        taxDetail.notes.map(note => `
            <div class="optimizer-note-card">
                <span>${note.label}</span>
                <strong>${note.value}</strong>
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

function renderHouseholdDecisionBriefSection({
    currentInputs,
    analysis,
    vulnerabilityAnalysis,
    projection
}) {
    const headline = document.getElementById("householdDecisionBriefHeadline");
    const summary = document.getElementById("householdDecisionBriefSummary");
    const cards = document.getElementById("householdDecisionBriefCards");
    const points = document.getElementById("householdDecisionBriefPoints");
    const note = document.getElementById("householdDecisionBriefNote");
    const copyButton = document.getElementById("householdDecisionBriefCopyBtn");
    const downloadButton =
        document.getElementById("householdDecisionBriefDownloadBtn");

    if (
        !headline ||
        !summary ||
        !cards ||
        !points ||
        !note ||
        !copyButton ||
        !downloadButton
    ) {
        return;
    }

    const content = buildHouseholdDecisionBrief({
        currentInputs,
        analysis,
        vulnerabilityAnalysis,
        projection
    });

    headline.textContent = content.headline;
    summary.textContent = content.summary;
    note.textContent = content.note;
    cards.innerHTML = content.cards.map(card => `
        <div class="report-highlight-card">
            <div class="report-highlight-label">${card.label}</div>
            <div class="report-highlight-value">${card.value}</div>
        </div>
    `).join("");
    points.innerHTML = content.talkingPoints.map((point, index) => `
        <div class="optimizer-sequence-item">
            <div class="optimizer-sequence-eyebrow">Brief Point ${index + 1}</div>
            <p>${point}</p>
        </div>
    `).join("");
    copyButton.disabled = false;
    copyButton.dataset.defaultLabel = "Copy Brief";
    copyButton.textContent = "Copy Brief";
    copyButton.onclick = () => {
        copyReportPacket(copyButton, content.exportText);
    };
    downloadButton.disabled = false;
    downloadButton.dataset.defaultLabel = "Download Brief";
    downloadButton.textContent = "Download Brief";
    downloadButton.onclick = () => {
        downloadReportPacket(
            downloadButton,
            content.exportText,
            buildTextDownloadFileName(
                "LEOFF-Helper-Household-Decision-Brief",
                currentInputs?.retireAge
            )
        );
    };
}

function renderProfessionalReviewSection({
    currentInputs,
    analysis,
    vulnerabilityAnalysis,
    projection
}) {
    const premiumEnabled =
        hasPremiumAccess(dashboardAccountContext, "premium");
    const headline = document.getElementById("professionalReviewHeadline");
    const summary = document.getElementById("professionalReviewSummary");
    const premiumNote =
        document.getElementById("professionalReviewPremiumNote");
    const cards = document.getElementById("professionalReviewCards");
    const questions = document.getElementById("professionalReviewQuestions");
    const note = document.getElementById("professionalReviewNote");
    const copyButton = document.getElementById("professionalReviewCopyBtn");
    const downloadButton =
        document.getElementById("professionalReviewDownloadBtn");

    if (
        !headline ||
        !summary ||
        !premiumNote ||
        !cards ||
        !questions ||
        !note ||
        !copyButton ||
        !downloadButton
    ) {
        return;
    }

    if (!premiumEnabled) {
        headline.textContent = "Premium professional review packet";
        summary.textContent =
            "Premium turns the dashboard into a cleaner advisor handoff with tax drag, shortfall pressure, top review questions, and a copy-ready packet for CPA, fiduciary, or estate-planning conversations.";
        premiumNote.hidden = false;
        premiumNote.textContent = buildPremiumLockedMessage({
            signedInMessage:
                "This account is currently on the free tier. Upgrade to premium to unlock the professional review packet.",
            signedOutMessage:
                "Sign in with a premium account to unlock the professional review packet.",
            sharedMessage:
                "This shared scenario was created from a free-tier plan, so the professional review packet is not included in this link."
        });
        cards.hidden = true;
        questions.innerHTML = `
            <div class="optimizer-sequence-item">
                <div class="optimizer-sequence-eyebrow">Premium Packet Preview</div>
                <h3>Advisor-ready summary</h3>
                <p>Premium summarizes the current retirement timing, tax drag, shortfall pressure, and the highest-value questions to carry into a professional review.</p>
            </div>
        `;
        note.textContent =
            "Use this section when you want a cleaner handoff into a CPA, fiduciary, or estate-planning conversation instead of sharing the full dashboard first.";
        copyButton.disabled = true;
        copyButton.dataset.defaultLabel = "Premium Only";
        copyButton.textContent = "Premium Only";
        copyButton.onclick = null;
        downloadButton.disabled = true;
        downloadButton.dataset.defaultLabel = "Premium Only";
        downloadButton.textContent = "Premium Only";
        downloadButton.onclick = null;
        return;
    }

    const content = buildProfessionalReviewSummary({
        currentInputs,
        analysis,
        vulnerabilityAnalysis,
        projection
    });

    headline.textContent = content.headline;
    summary.textContent = content.summary;
    premiumNote.hidden = true;
    cards.hidden = false;
    cards.innerHTML = content.cards.map(card => `
        <div class="report-highlight-card">
            <div class="report-highlight-label">${card.label}</div>
            <div class="report-highlight-value">${card.value}</div>
        </div>
    `).join("");
    questions.innerHTML = content.questions.map((question, index) => `
        <div class="optimizer-sequence-item">
            <div class="optimizer-sequence-eyebrow">Review Question ${index + 1}</div>
            <p>${question}</p>
        </div>
    `).join("");
    note.textContent = content.note;
    copyButton.disabled = false;
    copyButton.dataset.defaultLabel = "Copy Packet";
    copyButton.textContent = "Copy Packet";
    copyButton.onclick = () => {
        copyReportPacket(copyButton, content.exportText);
    };
    downloadButton.disabled = false;
    downloadButton.dataset.defaultLabel = "Download Packet";
    downloadButton.textContent = "Download Packet";
    downloadButton.onclick = () => {
        downloadReportPacket(
            downloadButton,
            content.exportText,
            buildTextDownloadFileName(
                "LEOFF-Helper-Professional-Review-Packet",
                currentInputs?.retireAge
            )
        );
    };
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

function renderReadinessTimelineSection({
    entries,
    currentRetireAge,
    recommendedRetirementAge
}) {
    const premiumEnabled =
        hasPremiumAccess(dashboardAccountContext, "readinessTimeline");
    const headline = document.getElementById("readinessTimelineHeadline");
    const summary = document.getElementById("readinessTimelineSummary");
    const premiumNote =
        document.getElementById("readinessTimelinePremiumNote");
    const body = document.getElementById("readinessTimelineBody");
    const footnote = document.getElementById("readinessTimelineFootnote");

    if (!headline || !summary || !premiumNote || !body || !footnote) {
        return;
    }

    if (!premiumEnabled) {
        headline.textContent = "How readiness changes by retirement age";
        summary.textContent =
            "Premium compares the readiness score, annual margin, first deficit age, and depletion timing across the full retirement-age range instead of only the currently selected age.";
        premiumNote.hidden = false;
        premiumNote.textContent = buildPremiumLockedMessage({
            signedInMessage:
                "This account is currently on the free tier. Upgrade to premium to unlock the age-by-age readiness table.",
            signedOutMessage:
                "Sign in with a premium account to unlock the age-by-age readiness table.",
            sharedMessage:
                "This shared scenario was created from a free-tier plan, so the age-by-age readiness table is not included in this link."
        });
        body.innerHTML = `
            <tr>
                <td colspan="6">Premium readiness timeline rows will appear here once a premium account is active.</td>
            </tr>
        `;
        footnote.textContent =
            "Premium turns this section into a retirement-age comparison table so you can see where the plan first becomes Workable, Strong, or Durable before relying on a single selected age.";
        return;
    }

    const content = buildReadinessTimelineContent({
        entries,
        currentRetireAge,
        recommendedRetirementAge
    });

    headline.textContent = "How the score changes by retirement age";
    summary.textContent = content.summary;
    premiumNote.hidden = true;
    body.innerHTML =
        content.rows.length
            ? content.rows.map(row => {
                const classes = [
                    row.isCurrent ? "is-current" : "",
                    row.isRecommended ? "is-recommended" : ""
                ].filter(Boolean).join(" ");

                return `
                    <tr class="${classes}">
                        <td>
                            <span class="readiness-timeline-age">${row.ageLabel}</span>
                            ${row.status ? `<div class="readiness-timeline-status">${row.status}</div>` : ""}
                        </td>
                        <td>${row.scoreLabel}</td>
                        <td><span class="readiness-timeline-band ${row.bandClass}">${row.band}</span></td>
                        <td>${row.marginLabel}</td>
                        <td>${row.firstDeficitAgeLabel}</td>
                        <td>${row.assetDepletionAgeLabel}</td>
                    </tr>
                `;
            }).join("")
            : `
                <tr>
                    <td colspan="6">Readiness timeline data is not available yet.</td>
                </tr>
            `;
    footnote.textContent =
        "This table shows the age-by-age score trend using the current plan inputs. Use the selected age together with the Monte Carlo section below before treating any one score as a final decision.";
}

function renderMonteCarloTrustSection({
    monteCarlo = null,
    premiumStressTesting = null
} = {}) {
    const summary = document.getElementById("monteCarloTrustSummary");
    const cards = document.getElementById("monteCarloTrustCards");
    const footnote = document.getElementById("monteCarloTrustFootnote");

    if (!summary || !cards || !footnote) {
        return;
    }

    const content = buildMonteCarloTrustContent({
        monteCarlo,
        premiumEnabled: monteCarloPlusEnabled,
        stressTestingActive:
            Boolean(monteCarloPlusEnabled) &&
            Boolean(premiumStressTesting?.enabled)
    });

    summary.textContent = content.summary;
    cards.innerHTML = content.cards.map(card => `
        <div class="estate-help-card">
            <h3>${card.title}</h3>
            <p>${card.body}</p>
        </div>
    `).join("");
    footnote.innerHTML =
        `${content.footnote} Review the <a href="/ui/trusted-assumptions.html">trusted assumptions library</a> and the <a href="/ui/articles/article-monte-carlo-retirement-modeling.html">Monte Carlo modeling guide</a> for the current methodology.`;
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
        premiumNote.textContent = buildPremiumLockedMessage({
            signedInMessage:
                "Monte Carlo Plus path ranges and deeper trial runs are reserved for premium accounts. This account is currently on the free tier.",
            signedOutMessage:
                "Sign in with a premium account to unlock Monte Carlo Plus path ranges and deeper trial runs.",
            sharedMessage:
                "This shared scenario was created from a free-tier plan, so Monte Carlo Plus path ranges and deeper trial runs are not included in this link."
        });
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
    renderMonteCarloTrustSection({
        premiumStressTesting
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
        renderMonteCarloTrustSection({
            monteCarlo,
            premiumStressTesting
        });

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
    const sharedPlanToken = readSharedPlanTokenFromUrl();
    let stored = null;
    let workspaceState = null;
    let savedSimulationState = null;
    let projection = null;
    let incomeSources = [];
    let inputs = null;

    if (sharedPlanToken) {
        try {
            const sharedPlan = await getSharedPlan(sharedPlanToken);

            sharedPlanView = {
                token: sharedPlanToken,
                planId: sharedPlan?.id || null,
                name: sharedPlan?.name || "",
                sharedAt: sharedPlan?.sharedAt || null
            };
            dashboardAccountContext = {
                user: null,
                entitlements: sharedPlan?.entitlements || {}
            };
            applyMonteCarloEntitlementState(dashboardAccountContext);
            renderSharedPlanBanner(sharedPlanView);

            savedSimulationState =
                sharedPlan?.workspaceState?.simulationState ||
                sharedPlan?.simulationState ||
                null;
            workspaceState =
                sharedPlan?.workspaceState ||
                {
                    simulationState: savedSimulationState,
                    moduleState: {}
                };

            if (!savedSimulationState) {
                throw new Error("Shared scenario is missing its simulation state.");
            }

            projection = runProjection(savedSimulationState);
            incomeSources = savedSimulationState.incomeSources || [];
            inputs = simulationStateToInputs(savedSimulationState);
        } catch (error) {
            sessionStorage.setItem("plannerStatusMessage", JSON.stringify({
                message:
                    error.message || "That shared scenario could not be opened.",
                tone: "error"
            }));
            window.location.href = "simulator.html";
            return;
        }
    } else {
        await loadDashboardAccountContext();
        applyMonteCarloEntitlementState(dashboardAccountContext);
        renderSharedPlanBanner(null);

        stored = sessionStorage.getItem("retirementProjection");
        workspaceState = StateManager.loadAll();
        savedSimulationState = workspaceState?.simulationState;

        if (!stored && !savedSimulationState) {
            sessionStorage.setItem("plannerStatusMessage", JSON.stringify({
                message: "No saved retirement analysis was found. Build a plan first, then reopen the dashboard.",
                tone: "error"
            }));
            window.location.href = "simulator.html";
            return;
        }

        const fallbackPayload = savedSimulationState ? {
            projection: runProjection(savedSimulationState),
            incomeSources: savedSimulationState.incomeSources || [],
            inputs: simulationStateToInputs(savedSimulationState)
        } : null;

        ({
            projection,
            incomeSources,
            inputs
        } = stored ? JSON.parse(stored) : fallbackPayload);
    }

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
        renderHouseholdDecisionBriefSection({
            currentInputs,
            analysis,
            vulnerabilityAnalysis,
            projection: currentProjection
        });
        renderProfessionalReviewSection({
            currentInputs,
            analysis,
            vulnerabilityAnalysis,
            projection: currentProjection
        });
        renderReadinessBreakdown({
            breakdown: analysis.readinessBreakdown,
            maxScores: analysis.readinessMaxScores
        });
        renderReadinessTimelineSection({
            entries: readinessTimelineEntries,
            currentRetireAge: retireAge,
            recommendedRetirementAge: displayedRecommendedAge
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
        renderSurvivorOptionOptimizerSection({
            simulationState: currentSimulationState
        });
        renderEstateProjectionSection({
            currentInputs,
            simulationState: currentSimulationState,
            projection: currentProjection
        });
        renderTaxDetailViewSection({
            simulationState: currentSimulationState,
            projection: currentProjection
        });
    }

    const editInputsBtn = document.getElementById("editInputsBtn");
    if (editInputsBtn) {
        editInputsBtn.onclick = () => {
            window.location.href = "simulator.html";
        };
    }

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
    const readinessTimelineEnabled =
        hasPremiumAccess(dashboardAccountContext, "readinessTimeline");
    const readinessTimelineEntries =
        readinessTimelineEnabled
            ? buildReadinessTimelineEntries({
                baseInputs,
                baseSavedSources,
                baseAssumptions,
                minimumRetirementAge,
                maximumRetirementAge
            })
            : [];
    const displayedRecommendedAge =
        getDisplayedRecommendationAge(
            baselineAnalysis,
            initialSliderAge
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
