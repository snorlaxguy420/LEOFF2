import { collectInputs } from "./inputCollector.js";
import { runProjection as runProjectionEngine } from "../core/projectionEngine.js";
import { loadAssetModules } from "../core/assetModuleLoader.js";
import { assetRegistry } from "../core/assetRegistry.js";
import "../modules/profiles/profileModule.js";
import { renderProjectionChart } from "../ui/projectionChart.js";
import { StateManager } from "../core/stateManager.js";
import {
    buildSimulationState,
    simulationStateToInputs
} from "../core/simulationState.js";
import {
    buildSimulationIncomeSources,
    saveProjectionSnapshot
} from "./simulatorShared.js";
import {
    populateSimulatorInputs,
    applyProjectionPreview,
    clearProjectionPreview
} from "./simulatorUiShared.js";
import {
    buildAssetButtons,
    loadProfileModule
} from "./simulatorBootstrap.js";
import {
    createPlan as createAccountPlan,
    deletePlan as deleteAccountPlan,
    getAccountContext,
    getPlan as fetchAccountPlan,
    listPlans as listAccountPlans,
    updatePlan as updateAccountPlan
} from "./apiClient.js";
import { hasPremiumAccess } from "./accountEntitlements.js";
import {
    applyPremiumStressPreset,
    DEFAULT_PREMIUM_STRESS_TESTING,
    getPremiumStressPresetLabel,
    normalizePremiumStressTesting
} from "../core/premiumStressTesting.js";
import {
    buildScenarioComparisonCard,
    buildScenarioComparisonScoreboard
} from "../analysis/scenarioComparisonSummary.js";

/* ------------------------------------------------
GLOBAL STATE
------------------------------------------------ */

let chartMode = "line";
let lastResults = null;
let lastIncomeSources = [];
const SIMULATOR_TAB_SEQUENCE = [
    "profile",
    "pension",
    "ss",
    "retirement",
    "assets",
    "debts",
    "expenses"
];
const SIMULATOR_TAB_META = {
    profile: {
        label: "Profile",
        shortLabel: "Profile",
        title: "Start with your household baseline",
        summary:
            "Set the age and household context that every later retirement estimate depends on.",
        checklist: [
            "Add your birth month and birth year.",
            "Set marital status if household planning matters.",
            "Use this as the baseline before modeling pension or Social Security."
        ],
        navHint: "Household timing"
    },
    pension: {
        label: "Pension",
        shortLabel: "Pension",
        title: "Model your core pension income",
        summary:
            "Your pension is usually the anchor of the plan, so start with the retirement age and compensation assumptions you trust most.",
        checklist: [
            "Set retirement age, service years, and final average salary.",
            "Choose the survivor option you want to compare.",
            "Add PERS 2 only if it is part of the real plan."
        ],
        navHint: "LEOFF and PERS"
    },
    ss: {
        label: "Social Security",
        shortLabel: "Social Security",
        title: "Layer in Social Security timing",
        summary:
            "Use a simple claim-age estimate first, then refine the benefit inputs once you know them.",
        checklist: [
            "Confirm birth year and claim age.",
            "Choose the benefit type you actually know.",
            "Treat this as a timing decision, not a perfect-number exercise."
        ],
        navHint: "Claim timing"
    },
    retirement: {
        label: "Retirement Accounts",
        shortLabel: "Retirement",
        title: "Add retirement accounts you may draw from",
        summary:
            "This is where the planner models balances that support the pension and fill later cash-flow gaps.",
        checklist: [
            "Add 457, IRA, Roth, or other retirement balances.",
            "Use rough balances if exact numbers are not handy.",
            "Think of this as support income, not the whole plan."
        ],
        navHint: "457, IRA, Roth"
    },
    assets: {
        label: "Assets",
        shortLabel: "Assets",
        title: "Capture non-retirement assets and reserves",
        summary:
            "Savings, brokerage, and property can add flexibility even if they are not your main retirement funding source.",
        checklist: [
            "Add liquid reserves first if you have them.",
            "Include taxable investments and major real assets when relevant.",
            "Skip anything you are unlikely to use in retirement planning."
        ],
        navHint: "Savings and property"
    },
    debts: {
        label: "Debts",
        shortLabel: "Debts",
        title: "Account for obligations that follow you into retirement",
        summary:
            "Debt changes the cash-flow picture, so include the major obligations that could still exist after you stop working.",
        checklist: [
            "Add mortgage or other large recurring debts.",
            "Focus on obligations that materially affect retirement spending.",
            "Use this to make the plan more realistic, not more complicated."
        ],
        navHint: "Mortgage and loans"
    },
    expenses: {
        label: "Expenses",
        shortLabel: "Expenses",
        title: "Finish with the spending baseline",
        summary:
            "Monthly expenses unlock the live projection preview, so this is the step that turns the planner on.",
        checklist: [
            "Enter current monthly household spending.",
            "Start with a realistic rough draft instead of perfect categories.",
            "Use inflation assumptions only if you want to override the defaults."
        ],
        navHint: "Monthly spending"
    }
};
const SUGGESTED_INFLATION_DEFAULTS = {
    goodsServicesInflation: "3.29",
    housingInflation: "2.8",
    healthcareInflation: "6"
};
const SUGGESTED_PREMIUM_STRESS_DEFAULTS = {
    enabled: false,
    goodsServicesInflationTargetRate: 0.045,
    housingInflationTargetRate: 0.04,
    healthcareInflationTargetRate: 0.075,
    portfolioDownsideFloorRate: -0.28,
    earlyRetirementShockYears: 3,
    earlyRetirementShockRate: -0.12
};
const DISCLAIMER_STORAGE_KEY = "leoffHelperDisclaimerAccepted";
const ACCOUNT_PLAN_META_KEY = "leoffHelperAccountPlanMeta";
const AUTH_SYNC_KEY = "leoffHelperAuthSync";
const SCENARIO_COMPARISON_MAX_SELECTION = 3;
let currentAccountUser = null;
let currentAccountContext = null;
let currentAccountPlans = [];
let currentScenarioComparisonPlans = [];

function getSimulatorTabMeta(tabId) {
    return SIMULATOR_TAB_META[tabId] || SIMULATOR_TAB_META.profile;
}

function renderChecklist(container, items, itemClassName) {
    if (!container) {
        return;
    }

    container.innerHTML = (Array.isArray(items) ? items : [])
        .map(item => `
            <div class="${itemClassName}">
                <span aria-hidden="true">+</span>
                <span>${escapeHtml(item)}</span>
            </div>
        `)
        .join("");
}

function applySimulatorTabMeta() {
    getSimulatorTabs().forEach((tab, index) => {
        const meta = getSimulatorTabMeta(tab.dataset.tab);

        tab.innerHTML = `
            <span class="nav-item-step">Step ${index + 1}</span>
            <span class="nav-item-copy">
                <strong>${escapeHtml(meta.label)}</strong>
                <small>${escapeHtml(meta.navHint)}</small>
            </span>
        `;
        tab.setAttribute(
            "aria-label",
            `Step ${index + 1}: ${meta.label}. ${meta.navHint}.`
        );
    });
}

function renderPlannerStepGuide(activeTabId) {
    const currentIndex =
        Math.max(0, SIMULATOR_TAB_SEQUENCE.indexOf(activeTabId));
    const meta = getSimulatorTabMeta(activeTabId);
    const kicker = document.getElementById("plannerStepKicker");
    const title = document.getElementById("plannerStepTitle");
    const count = document.getElementById("plannerStepCountBadge");
    const summary = document.getElementById("plannerStepSummary");
    const checklist = document.getElementById("plannerStepChecklist");

    if (kicker) {
        kicker.textContent = `Step ${currentIndex + 1}`;
    }

    if (title) {
        title.textContent = meta.title;
    }

    if (count) {
        count.textContent = `${currentIndex + 1} of ${SIMULATOR_TAB_SEQUENCE.length}`;
    }

    if (summary) {
        summary.textContent = meta.summary;
    }

    renderChecklist(checklist, meta.checklist, "planner-step-check");
}

function getPlannerNextStepState(inputs) {
    const profile = inputs?.profile || {};
    const pension = inputs?.pension || {};
    const socialSecurity = inputs?.socialSecurity || {};

    if (!profile?.birthYear) {
        return {
            title: "Finish the household profile first",
            summary:
                "Your birth year anchors retirement timing, Social Security timing, and the overall planning horizon.",
            checklist: [
                "Add birth month and birth year.",
                "Set marital status if spouse planning matters.",
                "Then move into the pension section."
            ]
        };
    }

    if ((pension?.serviceYears || 0) <= 0 || (pension?.finalAverageSalary || 0) <= 0) {
        return {
            title: "Add the pension assumptions that anchor the plan",
            summary:
                "The planner gets much more useful once service years and final average salary reflect a realistic retirement path.",
            checklist: [
                "Set retirement age, service years, and final average salary.",
                "Choose a survivor option if you are comparing one.",
                "Then keep building with accounts and expenses."
            ]
        };
    }

    if (!hasRequiredCurrentExpenses(inputs)) {
        return {
            title: "Add current monthly expenses to unlock the live projection",
            summary:
                "The preview cards and chart stay conservative until the planner knows what your household spends each month.",
            checklist: [
                "Enter housing, groceries, bills, healthcare, and other monthly costs.",
                "Use rounded numbers if you are still estimating.",
                "Once expenses are in, the projection preview updates automatically."
            ]
        };
    }

    if (!socialSecurity?.birthYear || !(socialSecurity?.claimAge > 0)) {
        return {
            title: "Refine Social Security timing when you are ready",
            summary:
                "Your plan is live now, and Social Security is one of the best next refinements for improving the retirement picture.",
            checklist: [
                "Add a claim age and whichever benefit number you know.",
                "Compare timing options if you expect flexibility.",
                "Then generate the retirement report or save the scenario."
            ]
        };
    }

    return {
        title: "Your live plan is running",
        summary:
            "Keep refining accounts, assets, debts, and stress assumptions, then save the scenario or open the full report when the picture feels right.",
        checklist: [
            "Use My Scenarios to save important what-ifs.",
            "Open the retirement report for the full dashboard.",
            "Use focused tools when you want to compare a narrower decision."
        ]
    };
}

function renderPlannerNextStepCard(
    inputs = collectInputs(),
    activeTabId = getActiveSimulatorTabId()
) {
    const title = document.getElementById("plannerNextStepTitle");
    const summary = document.getElementById("plannerNextStepSummary");
    const checklist = document.getElementById("plannerNextStepChecklist");
    const nextStepState = getPlannerNextStepState(inputs);
    const activeMeta = getSimulatorTabMeta(activeTabId);

    if (title) {
        title.textContent = nextStepState.title;
    }

    if (summary) {
        summary.textContent = `${nextStepState.summary} You are currently in ${activeMeta.label}.`;
    }

    renderChecklist(
        checklist,
        nextStepState.checklist,
        "planner-next-step-check"
    );
}

function buildDefaultAccountScenarioName() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");

    return `Scenario ${year}-${month}-${day} ${hours}${minutes}`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function normalizeScenarioComparisonPlanIds(planIds = []) {
    return Array.from(
        new Set(
            (Array.isArray(planIds) ? planIds : [])
                .map(id => String(id || "").trim())
                .filter(Boolean)
        )
    ).slice(0, SCENARIO_COMPARISON_MAX_SELECTION);
}

function toPercentFieldValue(rate, fallback) {
    return Number.isFinite(rate)
        ? String(Math.round(rate * 1000) / 10)
        : fallback;
}

function readOptionalPercentFieldValue(id) {
    const rawValue =
        document.getElementById(id)?.value?.trim() || "";

    if (!rawValue) {
        return null;
    }

    const parsedValue = Number(rawValue);

    return Number.isFinite(parsedValue)
        ? parsedValue / 100
        : null;
}

function getPremiumStressTestingFieldDefaults() {
    return {
        premiumStressTestingEnabled:
            Boolean(SUGGESTED_PREMIUM_STRESS_DEFAULTS.enabled),
        premiumStressPreset: "custom",
        premiumStressGoodsServicesInflation:
            toPercentFieldValue(
                SUGGESTED_PREMIUM_STRESS_DEFAULTS.goodsServicesInflationTargetRate,
                "4.5"
            ),
        premiumStressHousingInflation:
            toPercentFieldValue(
                SUGGESTED_PREMIUM_STRESS_DEFAULTS.housingInflationTargetRate,
                "4.0"
            ),
        premiumStressHealthcareInflation:
            toPercentFieldValue(
                SUGGESTED_PREMIUM_STRESS_DEFAULTS.healthcareInflationTargetRate,
                "7.5"
            ),
        premiumStressPortfolioFloor:
            toPercentFieldValue(
                SUGGESTED_PREMIUM_STRESS_DEFAULTS.portfolioDownsideFloorRate,
                "-28"
            ),
        premiumStressEarlyShockYears:
            String(SUGGESTED_PREMIUM_STRESS_DEFAULTS.earlyRetirementShockYears),
        premiumStressEarlyShockReturn:
            toPercentFieldValue(
                SUGGESTED_PREMIUM_STRESS_DEFAULTS.earlyRetirementShockRate,
                "-12"
            )
    };
}

function getWorkspacePremiumStressTesting() {
    return normalizePremiumStressTesting(
        StateManager.state?.premiumStressTesting ||
        {}
    );
}

function readPremiumStressTestingFromInputs() {
    const enabled =
        Boolean(document.getElementById("premiumStressTestingEnabled")?.checked);

    return normalizePremiumStressTesting({
        enabled,
        preset:
            document.getElementById("premiumStressPreset")?.value ||
            "custom",
        goodsServicesInflationTargetRate:
            readOptionalPercentFieldValue(
                "premiumStressGoodsServicesInflation"
            ),
        housingInflationTargetRate:
            readOptionalPercentFieldValue(
                "premiumStressHousingInflation"
            ),
        healthcareInflationTargetRate:
            readOptionalPercentFieldValue(
                "premiumStressHealthcareInflation"
            ),
        portfolioDownsideFloorRate:
            readOptionalPercentFieldValue(
                "premiumStressPortfolioFloor"
            ),
        earlyRetirementShockYears:
            parseInt(
                document.getElementById("premiumStressEarlyShockYears")?.value || "0",
                10
            ) || 0,
        earlyRetirementShockRate:
            readOptionalPercentFieldValue(
                "premiumStressEarlyShockReturn"
            )
    });
}

function syncPremiumStressTestingStateFromInputs() {
    StateManager.state =
        StateManager.normalizeWorkspaceState({
            ...StateManager.state,
            premiumStressTesting: readPremiumStressTestingFromInputs()
        });

    return StateManager.state.premiumStressTesting;
}

function populatePremiumStressTestingInputs(workspaceState = null) {
    const settings =
        normalizePremiumStressTesting(
            workspaceState?.premiumStressTesting ||
            StateManager.state?.premiumStressTesting ||
            SUGGESTED_PREMIUM_STRESS_DEFAULTS
        );
    const fieldValues = {
        premiumStressTestingEnabled: settings.enabled,
        premiumStressPreset: settings.preset || "custom",
        premiumStressGoodsServicesInflation:
            toPercentFieldValue(
                settings.goodsServicesInflationTargetRate,
                getPremiumStressTestingFieldDefaults().premiumStressGoodsServicesInflation
            ),
        premiumStressHousingInflation:
            toPercentFieldValue(
                settings.housingInflationTargetRate,
                getPremiumStressTestingFieldDefaults().premiumStressHousingInflation
            ),
        premiumStressHealthcareInflation:
            toPercentFieldValue(
                settings.healthcareInflationTargetRate,
                getPremiumStressTestingFieldDefaults().premiumStressHealthcareInflation
            ),
        premiumStressPortfolioFloor:
            toPercentFieldValue(
                settings.portfolioDownsideFloorRate,
                getPremiumStressTestingFieldDefaults().premiumStressPortfolioFloor
            ),
        premiumStressEarlyShockYears:
            String(
                settings.earlyRetirementShockYears ??
                SUGGESTED_PREMIUM_STRESS_DEFAULTS.earlyRetirementShockYears
            ),
        premiumStressEarlyShockReturn:
            toPercentFieldValue(
                settings.earlyRetirementShockRate,
                getPremiumStressTestingFieldDefaults().premiumStressEarlyShockReturn
            )
    };

    Object.entries(fieldValues).forEach(([id, value]) => {
        const field = document.getElementById(id);

        if (!field) {
            return;
        }

        if (field instanceof HTMLInputElement && field.type === "checkbox") {
            field.checked = Boolean(value);
            return;
        }

        field.value = String(value ?? "");
    });

    syncPremiumStressTestingStateFromInputs();
}

function setPremiumStressPresetToCustom() {
    const presetField =
        document.getElementById("premiumStressPreset");

    if (presetField && presetField.value !== "custom") {
        presetField.value = "custom";
    }
}

function handlePremiumStressPresetChange() {
    const presetField =
        document.getElementById("premiumStressPreset");

    if (!presetField) {
        return;
    }

    const currentSettings =
        getWorkspacePremiumStressTesting();
    const nextSettings =
        presetField.value === "custom"
            ? normalizePremiumStressTesting({
                ...currentSettings,
                preset: "custom"
            })
            : applyPremiumStressPreset(
                currentSettings,
                presetField.value
            );

    populatePremiumStressTestingInputs({
        premiumStressTesting: nextSettings
    });
    syncPremiumStressTestingUi();
    renderScenarioComparisonList();
    StateManager.saveAll();
}

function syncPremiumStressTestingUi() {
    const card = document.getElementById("premiumStressTestingCard");
    const badge = document.getElementById("premiumStressTestingBadge");
    const summary = document.getElementById("premiumStressTestingSummary");
    const toggle = document.getElementById("premiumStressTestingEnabled");
    const presetField = document.getElementById("premiumStressPreset");
    const resetBtn = document.getElementById("resetPremiumStressDefaultsBtn");
    const premiumEnabled =
        hasPremiumAccess(currentAccountContext, "monteCarloPlus");
    const stressSettings =
        getWorkspacePremiumStressTesting();
    const stressFields = Array.from(
        document.querySelectorAll(
            "#premiumStressTestingCard input:not(#premiumStressTestingEnabled), #premiumStressTestingCard select"
        )
    );

    if (!card || !badge || !summary || !toggle) {
        return;
    }

    card.classList.toggle("is-disabled", !premiumEnabled);
    badge.textContent = premiumEnabled
        ? "Premium Active"
        : "Premium Only";
    toggle.disabled = !premiumEnabled;

    stressFields.forEach(field => {
        field.disabled = !premiumEnabled || !toggle.checked;
    });

    if (resetBtn) {
        resetBtn.disabled = !premiumEnabled;
    }

    if (presetField) {
        presetField.disabled = !premiumEnabled || !toggle.checked;
    }

    if (!premiumEnabled) {
        summary.textContent = currentAccountUser
            ? "This account is on the free tier. Upgrade to premium to run harsher Monte Carlo assumptions and sequence-risk stress profiles."
            : "Sign in with a premium account to define harsher Monte Carlo assumptions for inflation, healthcare, and sequence risk.";
        return;
    }

    const stressLead =
        stressSettings.preset &&
        stressSettings.preset !== "custom"
            ? `${getPremiumStressPresetLabel(stressSettings.preset)} stress pack active`
            : "Custom premium stress profile active";

    if (!stressSettings.enabled) {
        summary.textContent =
            "Premium stress packs are available. Turn them on to run Monte Carlo Plus with harsher inflation, healthcare, and early-recession assumptions.";
        return;
    }

    summary.textContent =
        `${stressLead}: goods/services inflation ${toPercentFieldValue(stressSettings.goodsServicesInflationTargetRate, "n/a")}%, healthcare inflation ${toPercentFieldValue(stressSettings.healthcareInflationTargetRate, "n/a")}%, portfolio floor ${toPercentFieldValue(stressSettings.portfolioDownsideFloorRate, "n/a")}%, and an early shock of ${toPercentFieldValue(stressSettings.earlyRetirementShockRate, "n/a")}% for ${stressSettings.earlyRetirementShockYears || 0} years.`;
    return;

    if (!stressSettings.enabled) {
        summary.textContent =
            "Premium custom stress testing is available. Turn it on to run Monte Carlo Plus with harsher inflation, healthcare, and early-recession assumptions.";
        return;
    }

    summary.textContent =
        `Custom premium stress profile active: goods/services inflation ${toPercentFieldValue(stressSettings.goodsServicesInflationTargetRate, "—")}%, healthcare inflation ${toPercentFieldValue(stressSettings.healthcareInflationTargetRate, "—")}%, portfolio floor ${toPercentFieldValue(stressSettings.portfolioDownsideFloorRate, "—")}%, and an early shock of ${toPercentFieldValue(stressSettings.earlyRetirementShockRate, "—")}% for ${stressSettings.earlyRetirementShockYears || 0} years.`;
    summary.textContent =
        `Custom premium stress profile active: goods/services inflation ${toPercentFieldValue(stressSettings.goodsServicesInflationTargetRate, "n/a")}%, healthcare inflation ${toPercentFieldValue(stressSettings.healthcareInflationTargetRate, "n/a")}%, portfolio floor ${toPercentFieldValue(stressSettings.portfolioDownsideFloorRate, "n/a")}%, and an early shock of ${toPercentFieldValue(stressSettings.earlyRetirementShockRate, "n/a")}% for ${stressSettings.earlyRetirementShockYears || 0} years.`;
}

function getScenarioComparisonState() {
    const comparisonState =
        StateManager.state?.comparisonState ||
        {};

    return {
        planIds: normalizeScenarioComparisonPlanIds(
            comparisonState.planIds
        )
    };
}

function setScenarioComparisonState(planIds = []) {
    const nextState =
        StateManager.normalizeWorkspaceState({
            ...StateManager.state,
            comparisonState: {
                planIds: normalizeScenarioComparisonPlanIds(planIds)
            }
        });

    StateManager.state = nextState;
    StateManager.save();

    return nextState.comparisonState;
}

function getStoredAccountPlanMeta() {
    try {
        const raw = localStorage.getItem(ACCOUNT_PLAN_META_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("Account plan metadata could not be read", error);
        return null;
    }
}

function storeAccountPlanMeta(meta = null) {
    if (!meta) {
        localStorage.removeItem(ACCOUNT_PLAN_META_KEY);
        return;
    }

    localStorage.setItem(
        ACCOUNT_PLAN_META_KEY,
        JSON.stringify({
            id: meta.id,
            name: meta.name
        })
    );
}

function buildWorkspaceStateForPersistence(simulationState = null) {
    return StateManager.normalizeWorkspaceState({
        ...StateManager.state,
        premiumStressTesting:
            readPremiumStressTestingFromInputs(),
        simulationState:
            simulationState ??
            StateManager.getSimulationState() ??
            null,
        moduleState: StateManager.collectModuleState()
    });
}

function formatAccountPlanTimestamp(isoString) {
    if (!isoString) {
        return "Unknown update time";
    }

    const parsed = new Date(isoString);

    if (Number.isNaN(parsed.getTime())) {
        return "Unknown update time";
    }

    return parsed.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

function getAccountPlanDisplayName(plan) {
    return String(plan?.name || "").trim() || "Untitled Scenario";
}

function getAccountPlansSummaryText() {
    if (!currentAccountUser) {
        return "Sign in to start building synced retirement scenarios.";
    }

    const scenarioCount = currentAccountPlans.length;
    const countLabel =
        scenarioCount === 1
            ? "1 saved scenario"
            : `${scenarioCount} saved scenarios`;
    const currentPlanMeta = getStoredAccountPlanMeta();

    if (currentPlanMeta?.name) {
        return `${countLabel}. Current save target: ${currentPlanMeta.name}.`;
    }

    return `${countLabel}. Save the current workspace as a new scenario or pick one as your save target.`;
}

function getScenarioComparisonSummaryText() {
    if (!currentAccountUser) {
        return "Sign in to compare the current workspace with synced scenarios.";
    }

    const premiumComparisonEnabled =
        hasPremiumAccess(currentAccountContext, "premium");
    const selectedCount =
        getScenarioComparisonState().planIds.length;

    if (!selectedCount) {
        return premiumComparisonEnabled
            ? `Premium comparison is ready. Add up to ${SCENARIO_COMPARISON_MAX_SELECTION} synced scenarios to compare real planning outcomes side by side.`
            : `Current workspace ready. Add up to ${SCENARIO_COMPARISON_MAX_SELECTION} synced scenarios to compare key assumptions side by side.`;
    }

    const comparisonLabel =
        selectedCount === 1
            ? "1 synced scenario"
            : `${selectedCount} synced scenarios`;
    const currentPlanMeta = getStoredAccountPlanMeta();
    const persistenceHint = currentPlanMeta?.id
        ? `Update Current Scenario to sync this comparison set to your account.`
        : "Save the current scenario if you want this comparison set tied to your account.";

    return premiumComparisonEnabled
        ? `Premium comparison is active for the current workspace and ${comparisonLabel}. ${persistenceHint}`
        : `Comparing the current workspace with ${comparisonLabel}. ${persistenceHint}`;
}

function setAccountPlansStatus(message, tone = "neutral") {
    const statusEl = document.getElementById("accountPlansStatus");

    if (!statusEl) {
        return;
    }

    statusEl.textContent = message;
    statusEl.dataset.tone = tone;
}

function renderAccountPlansSummary() {
    const summaryEl = document.getElementById("accountPlansSummary");

    if (!summaryEl) {
        return;
    }

    summaryEl.textContent = getAccountPlansSummaryText();
}

function renderScenarioComparisonSummary() {
    const summaryEl =
        document.getElementById("accountComparisonSummary");

    if (!summaryEl) {
        return;
    }

    summaryEl.textContent = getScenarioComparisonSummaryText();
}

function renderScenarioComparisonList() {
    const listEl =
        document.getElementById("accountComparisonList");
    const scoreboardEl =
        document.getElementById("accountComparisonScoreboard");
    const premiumNoteEl =
        document.getElementById("accountComparisonPremiumNote");
    const premiumComparisonEnabled =
        hasPremiumAccess(currentAccountContext, "premium");

    if (!listEl) {
        return;
    }

    if (scoreboardEl) {
        scoreboardEl.hidden = true;
        scoreboardEl.innerHTML = "";
    }

    if (premiumNoteEl) {
        premiumNoteEl.hidden = premiumComparisonEnabled;
    }

    if (!currentAccountUser) {
        listEl.innerHTML = `
            <div class="account-plan-empty">
                Sign in to compare the current workspace against your synced scenarios.
            </div>
        `;
        renderScenarioComparisonSummary();
        return;
    }

    const selectedPlanIds =
        getScenarioComparisonState().planIds;

    if (!selectedPlanIds.length) {
        listEl.innerHTML = `
            <div class="account-plan-empty">
                No synced scenarios selected yet. Use Compare on any saved scenario to add it here.
            </div>
        `;
        renderScenarioComparisonSummary();
        return;
    }

    const currentSimulationState =
        StateManager.getSimulationState() ||
        buildCurrentSimulationPayload().simulationState;
    const currentWorkspaceState =
        StateManager.normalizeWorkspaceState({
            ...StateManager.state,
            simulationState: currentSimulationState
        });
    const cards = [
        buildScenarioComparisonCard({
            name: "Current Workspace",
            workspaceState: currentWorkspaceState,
            simulationState: currentSimulationState,
            badgeText: "Current",
            isCurrentWorkspace: true,
            premium: premiumComparisonEnabled
        }),
        ...currentScenarioComparisonPlans.map(plan =>
            buildScenarioComparisonCard({
                name: getAccountPlanDisplayName(plan),
                workspaceState:
                    plan.workspaceState || {},
                simulationState:
                    plan.workspaceState?.simulationState ||
                    plan.simulationState ||
                    null,
                updatedAt: plan.updatedAt,
                badgeText: premiumComparisonEnabled
                    ? "Premium Compare"
                    : "Synced",
                premium: premiumComparisonEnabled
            })
        )
    ];
    const comparisonScoreboard =
        premiumComparisonEnabled
            ? buildScenarioComparisonScoreboard(cards)
            : [];

    if (scoreboardEl && comparisonScoreboard.length) {
        scoreboardEl.hidden = false;
        scoreboardEl.innerHTML = comparisonScoreboard.map(item => `
            <div class="account-comparison-score-item">
                <span class="account-comparison-score-label">${escapeHtml(item.label)}</span>
                <strong class="account-comparison-score-name">${escapeHtml(item.winnerName)}</strong>
                <span class="account-comparison-score-value">${escapeHtml(item.value)}</span>
            </div>
        `).join("");
    }

    listEl.innerHTML = cards.map(card => `
        <div class="account-comparison-card ${card.isCurrentWorkspace ? "is-current" : ""}">
            <div class="account-comparison-top">
                <div>
                    <p class="account-comparison-name">${escapeHtml(card.name)}</p>
                    <p class="account-comparison-meta">
                        ${card.isCurrentWorkspace
                            ? "Live simulator inputs"
                            : `Updated ${escapeHtml(formatAccountPlanTimestamp(card.updatedAt))}`}
                    </p>
                </div>
                ${card.badgeText
                    ? `<span class="account-plan-badge ${card.isCurrentWorkspace ? "" : "is-secondary"}">${escapeHtml(card.badgeText)}</span>`
                    : ""}
            </div>
            ${card.sections.map(section => `
                <div class="account-comparison-section">
                    <div class="account-comparison-section-title">${escapeHtml(section.title)}</div>
                    <div class="account-comparison-grid">
                        ${section.metrics.map(metric => `
                            <div class="account-comparison-metric">
                                <span class="account-comparison-label">${escapeHtml(metric.label)}</span>
                                <span class="account-comparison-value">${escapeHtml(metric.value)}</span>
                            </div>
                        `).join("")}
                    </div>
                </div>
            `).join("")}
        </div>
    `).join("");

    renderScenarioComparisonSummary();
}

async function loadScenarioComparisonPlans() {
    if (!currentAccountUser) {
        currentScenarioComparisonPlans = [];
        renderScenarioComparisonList();
        return;
    }

    const selectedPlanIds =
        getScenarioComparisonState().planIds;
    const validPlanIds = selectedPlanIds.filter(planId =>
        currentAccountPlans.some(plan => plan.id === planId)
    );

    if (validPlanIds.length !== selectedPlanIds.length) {
        setScenarioComparisonState(validPlanIds);
        renderAccountPlansList();
    }

    if (!validPlanIds.length) {
        currentScenarioComparisonPlans = [];
        renderScenarioComparisonList();
        return;
    }

    const plans = await Promise.all(
        validPlanIds.map(async planId => {
            try {
                return await fetchAccountPlan(planId);
            } catch (error) {
                console.warn(
                    `Scenario comparison load failed for plan ${planId}`,
                    error
                );
                return null;
            }
        })
    );

    currentScenarioComparisonPlans = plans.filter(Boolean);

    if (currentScenarioComparisonPlans.length !== validPlanIds.length) {
        setScenarioComparisonState(
            currentScenarioComparisonPlans.map(plan => plan.id)
        );
        renderAccountPlansList();
    }

    renderScenarioComparisonList();
}

function renderAccountPlansList() {
    const listEl = document.getElementById("accountPlansList");
    const saveBtn = document.getElementById("saveAccountPlanBtn");
    const saveAsNewBtn = document.getElementById("saveAccountPlanAsNewBtn");
    const refreshBtn = document.getElementById("refreshAccountPlansBtn");
    const clearComparisonBtn =
        document.getElementById("clearScenarioComparisonBtn");
    const currentPlanMeta = getStoredAccountPlanMeta();
    const selectedComparisonPlanIds =
        getScenarioComparisonState().planIds;
    const selectedComparisonSet =
        new Set(selectedComparisonPlanIds);

    if (saveBtn) {
        saveBtn.disabled = !currentAccountUser;
        saveBtn.textContent = currentPlanMeta?.id
            ? "Update Current Scenario"
            : "Save Current Scenario";
    }

    if (saveAsNewBtn) {
        saveAsNewBtn.disabled = !currentAccountUser;
        saveAsNewBtn.textContent = "Save as New Scenario";
    }

    if (refreshBtn) {
        refreshBtn.disabled = false;
    }

    if (clearComparisonBtn) {
        clearComparisonBtn.disabled =
            !currentAccountUser ||
            selectedComparisonPlanIds.length === 0;
    }

    if (!listEl) {
        return;
    }

    if (!currentAccountUser) {
        listEl.innerHTML = `
            <div class="account-plan-empty">
                Sign in from the account page to save scenarios to your account and reopen them here.
            </div>
        `;
        renderAccountPlansSummary();
        return;
    }

    if (!currentAccountPlans.length) {
        listEl.innerHTML = `
            <div class="account-plan-empty">
                You do not have any synced scenarios yet. Save the current workspace to create your first one.
            </div>
        `;
        renderAccountPlansSummary();
        return;
    }

    const currentPlanId = currentPlanMeta?.id || null;

    listEl.innerHTML = currentAccountPlans.map(plan => `
        <div class="account-plan-item ${plan.id === currentPlanId ? "is-current" : ""}">
            <div class="account-plan-top">
                <div>
                    <p class="account-plan-name">${escapeHtml(getAccountPlanDisplayName(plan))}</p>
                    <p class="account-plan-meta">Updated ${escapeHtml(formatAccountPlanTimestamp(plan.updatedAt))}</p>
                    <p class="account-plan-meta">Created ${escapeHtml(formatAccountPlanTimestamp(plan.createdAt))}</p>
                </div>
                <div class="account-plan-badges">
                    ${plan.id === currentPlanId
                        ? '<span class="account-plan-badge">Current Save Target</span>'
                        : ""}
                    <span class="account-plan-badge is-secondary">Synced</span>
                </div>
            </div>
            <div class="account-plan-actions">
                <button type="button" data-account-action="open" data-plan-id="${escapeHtml(plan.id)}">Open</button>
                <button type="button" data-account-action="set-current-target" data-plan-id="${escapeHtml(plan.id)}" ${plan.id === currentPlanId ? "disabled" : ""}>Set Save Target</button>
                <button type="button" data-account-action="rename" data-plan-id="${escapeHtml(plan.id)}">Rename</button>
                <button type="button" data-account-action="duplicate" data-plan-id="${escapeHtml(plan.id)}">Duplicate</button>
                <button
                    type="button"
                    class="${selectedComparisonSet.has(plan.id) ? "account-plan-compare-active" : ""}"
                    data-account-action="toggle-compare"
                    data-plan-id="${escapeHtml(plan.id)}"
                    ${(selectedComparisonPlanIds.length >= SCENARIO_COMPARISON_MAX_SELECTION && !selectedComparisonSet.has(plan.id)) ? "disabled" : ""}
                >
                    ${selectedComparisonSet.has(plan.id) ? "Remove From Compare" : "Compare"}
                </button>
                <button type="button" class="account-plan-delete" data-account-action="delete" data-plan-id="${escapeHtml(plan.id)}">Delete</button>
            </div>
        </div>
    `).join("");

    renderAccountPlansSummary();
}

function renderDefaultAccountStatus() {
    if (!currentAccountUser) {
        setAccountPlansStatus(
            "Sign in to save and reopen scenarios across devices.",
            "neutral"
        );
        return;
    }

    const currentPlanMeta = getStoredAccountPlanMeta();

    if (currentPlanMeta?.name) {
        setAccountPlansStatus(
            `Signed in as ${currentAccountUser.email}. Current scenario save target: ${currentPlanMeta.name}.`,
            "success"
        );
        return;
    }

    setAccountPlansStatus(
        `Signed in as ${currentAccountUser.email}. Save this workspace to create your first synced scenario.`,
        "success"
    );
}

function applyWorkspaceStateToSimulator(workspaceState, accountPlanMeta = null) {
    const importedState =
        StateManager.importPortablePlan({ workspaceState });

    loadProfileModule(assetRegistry);
    sessionStorage.removeItem("retirementProjection");
    populateStandardInputs(
        simulationStateToInputs(importedState.simulationState)
    );
    populatePremiumStressTestingInputs(importedState);
    syncPremiumStressTestingUi();
    setActiveSimulatorTab("profile", {
        scrollOnMobile: isPhoneChartLayout()
    });

    if (accountPlanMeta) {
        storeAccountPlanMeta(accountPlanMeta);
    } else {
        storeAccountPlanMeta(null);
    }

    runProjection(importedState.simulationState);
    void loadScenarioComparisonPlans();
}

async function refreshAccountPlans({ keepStatus = false } = {}) {
    try {
        currentAccountContext = await getAccountContext();
        currentAccountUser = currentAccountContext?.user || null;
        currentAccountPlans = await listAccountPlans();

        const storedPlanMeta = getStoredAccountPlanMeta();

        if (
            storedPlanMeta?.id &&
            !currentAccountPlans.some(plan => plan.id === storedPlanMeta.id)
        ) {
            storeAccountPlanMeta(null);
        }
    } catch (error) {
        currentAccountContext = null;
        currentAccountUser = null;
        currentAccountPlans = [];
    }

    renderAccountPlansList();
    await loadScenarioComparisonPlans();
    syncPremiumStressTestingUi();

    if (!keepStatus) {
        renderDefaultAccountStatus();
    }
}

async function saveCurrentPlanToAccount({ forceNew = false } = {}) {
    if (!currentAccountUser) {
        setAccountPlansStatus(
            "Sign in first, then come back here to save this scenario to your account.",
            "error"
        );
        return;
    }

    const { simulationState } = buildCurrentSimulationPayload();

    StateManager.saveWorkspaceState({ simulationState });

    const workspaceState =
        buildWorkspaceStateForPersistence(simulationState);
    const currentPlanMeta = getStoredAccountPlanMeta();
    const defaultName =
        currentPlanMeta?.name ||
        buildDefaultAccountScenarioName();

    try {
        let savedPlan;

        if (forceNew || !currentPlanMeta?.id) {
            const requestedName =
                window.prompt("Name this scenario:", defaultName) || "";
            const trimmedName = requestedName.trim();

            if (!trimmedName) {
                setAccountPlansStatus("Scenario save cancelled.", "neutral");
                return;
            }

            savedPlan = await createAccountPlan(trimmedName, {
                simulationState,
                workspaceState
            });
        } else {
            savedPlan = await updateAccountPlan(currentPlanMeta.id, {
                simulationState,
                workspaceState
            });
        }

        storeAccountPlanMeta({
            id: savedPlan.id,
            name: savedPlan.name
        });
        await refreshAccountPlans({ keepStatus: true });
        setAccountPlansStatus(
            `${forceNew || !currentPlanMeta?.id ? "Saved" : "Updated"} scenario "${savedPlan.name}" in your account.`,
            "success"
        );
    } catch (error) {
        console.error("Account plan save failed", error);
        setAccountPlansStatus(
            error.message || "The scenario could not be saved right now.",
            "error"
        );
    }
}

async function openAccountPlan(planId) {
    try {
        const plan = await fetchAccountPlan(planId);
        const workspaceState =
            plan?.workspaceState ||
            {
                simulationState: plan?.simulationState || null,
                moduleState: {}
            };

        if (!workspaceState?.simulationState) {
            throw new Error("That scenario is missing its simulation state.");
        }

        applyWorkspaceStateToSimulator(workspaceState, {
            id: plan.id,
            name: plan.name
        });
        await refreshAccountPlans({ keepStatus: true });
        setAccountPlansStatus(
            `Loaded scenario "${plan.name}" from your account.`,
            "success"
        );
    } catch (error) {
        console.error("Account plan load failed", error);
        setAccountPlansStatus(
            error.message || "That scenario could not be opened.",
            "error"
        );
    }
}

async function renameAccountPlanById(planId) {
    const plan =
        currentAccountPlans.find(entry => entry.id === planId) ||
        null;

    if (!plan) {
        return;
    }

    const requestedName =
        window.prompt(
            "Rename this scenario:",
            getAccountPlanDisplayName(plan)
        ) || "";
    const trimmedName = requestedName.trim();

    if (!trimmedName) {
        setAccountPlansStatus("Scenario rename cancelled.", "neutral");
        return;
    }

    if (trimmedName === getAccountPlanDisplayName(plan)) {
        setAccountPlansStatus("Scenario name unchanged.", "neutral");
        return;
    }

    try {
        const updatedPlan = await updateAccountPlan(planId, {
            name: trimmedName
        });

        if (getStoredAccountPlanMeta()?.id === planId) {
            storeAccountPlanMeta({
                id: updatedPlan.id,
                name: updatedPlan.name
            });
        }

        await refreshAccountPlans({ keepStatus: true });
        setAccountPlansStatus(
            `Renamed scenario to "${updatedPlan.name}".`,
            "success"
        );
    } catch (error) {
        console.error("Account scenario rename failed", error);
        setAccountPlansStatus(
            error.message || "That scenario could not be renamed.",
            "error"
        );
    }
}

async function duplicateAccountPlanById(planId) {
    const plan =
        currentAccountPlans.find(entry => entry.id === planId) ||
        null;

    if (!plan) {
        return;
    }

    const requestedName =
        window.prompt(
            "Name the duplicated scenario:",
            `${getAccountPlanDisplayName(plan)} Copy`
        ) || "";
    const trimmedName = requestedName.trim();

    if (!trimmedName) {
        setAccountPlansStatus("Scenario duplication cancelled.", "neutral");
        return;
    }

    try {
        const fullPlan = await fetchAccountPlan(planId);
        const workspaceState =
            fullPlan?.workspaceState ||
            {
                simulationState: fullPlan?.simulationState || null,
                moduleState: {}
            };

        if (!workspaceState?.simulationState) {
            throw new Error("That scenario is missing its simulation state.");
        }

        const duplicatedPlan = await createAccountPlan(trimmedName, {
            simulationState: workspaceState.simulationState,
            workspaceState
        });

        await refreshAccountPlans({ keepStatus: true });
        setAccountPlansStatus(
            `Duplicated "${getAccountPlanDisplayName(plan)}" as "${duplicatedPlan.name}".`,
            "success"
        );
    } catch (error) {
        console.error("Account scenario duplicate failed", error);
        setAccountPlansStatus(
            error.message || "That scenario could not be duplicated.",
            "error"
        );
    }
}

async function deleteAccountPlanById(planId) {
    const plan =
        currentAccountPlans.find(entry => entry.id === planId) ||
        null;
    const confirmed = window.confirm(
        `Delete "${getAccountPlanDisplayName(plan)}" from your account?`
    );

    if (!confirmed) {
        return;
    }

    try {
        await deleteAccountPlan(planId);

        if (getStoredAccountPlanMeta()?.id === planId) {
            storeAccountPlanMeta(null);
        }

        if (getScenarioComparisonState().planIds.includes(planId)) {
            setScenarioComparisonState(
                getScenarioComparisonState().planIds.filter(id => id !== planId)
            );
        }

        await refreshAccountPlans({ keepStatus: true });
        setAccountPlansStatus(
            `Deleted scenario "${getAccountPlanDisplayName(plan)}" from your account.`,
            "success"
        );
    } catch (error) {
        console.error("Account plan delete failed", error);
        setAccountPlansStatus(
            error.message || "That scenario could not be deleted.",
            "error"
        );
    }
}

async function toggleScenarioComparisonById(planId) {
    if (!currentAccountUser) {
        setAccountPlansStatus(
            "Sign in first, then use Compare on synced scenarios.",
            "error"
        );
        return;
    }

    const selectedPlanIds =
        getScenarioComparisonState().planIds;
    const isSelected =
        selectedPlanIds.includes(planId);

    if (!isSelected && selectedPlanIds.length >= SCENARIO_COMPARISON_MAX_SELECTION) {
        setAccountPlansStatus(
            `You can compare up to ${SCENARIO_COMPARISON_MAX_SELECTION} synced scenarios at a time.`,
            "error"
        );
        return;
    }

    const nextPlanIds = isSelected
        ? selectedPlanIds.filter(id => id !== planId)
        : [...selectedPlanIds, planId];
    const plan =
        currentAccountPlans.find(entry => entry.id === planId) ||
        null;

    setScenarioComparisonState(nextPlanIds);
    renderAccountPlansList();
    await loadScenarioComparisonPlans();
    setAccountPlansStatus(
        isSelected
            ? `Removed "${getAccountPlanDisplayName(plan)}" from scenario comparison. Save the current scenario if you want that comparison set synced to your account.`
            : `Added "${getAccountPlanDisplayName(plan)}" to scenario comparison. Save the current scenario if you want that comparison set synced to your account.`,
        "success"
    );
}

async function clearScenarioComparisonSelection() {
    if (!getScenarioComparisonState().planIds.length) {
        setAccountPlansStatus(
            "Scenario comparison is already empty.",
            "neutral"
        );
        return;
    }

    setScenarioComparisonState([]);
    currentScenarioComparisonPlans = [];
    renderAccountPlansList();
    renderScenarioComparisonList();
    setAccountPlansStatus(
        "Cleared the current scenario comparison. Save the current scenario if you want that cleared state synced to your account.",
        "success"
    );
}

function hasRequiredCurrentExpenses(inputs) {
    return (inputs?.expenses?.monthly || 0) > 0;
}

function setReportButtonDisabled(disabled) {
    const reportBtn = document.getElementById("fullReportBtn");

    if (!reportBtn) return;

    const reportLink = reportBtn.closest("a");

    reportBtn.disabled = disabled;
    reportBtn.style.opacity = disabled ? "0.55" : "1";
    reportBtn.style.pointerEvents = disabled ? "none" : "";

    if (reportLink) {
        reportLink.style.pointerEvents = disabled ? "none" : "";
        reportLink.setAttribute("aria-disabled", disabled ? "true" : "false");
    }
}

function clearTimeline() {
    const canvas = document.getElementById("incomeTimelineChart");
    const legend = document.getElementById("timelineLegend");
    const mobileSummary = document.getElementById("mobileIncomeSummary");

    if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (legend) {
        legend.innerHTML = "";
    }

    if (mobileSummary) {
        mobileSummary.innerHTML = "";
    }
}

function isPhoneChartLayout() {
    return window.innerWidth <= 640;
}

function syncMobileSimulatorMode() {
    document.body.classList.toggle(
        "mobile-simulator",
        isPhoneChartLayout()
    );
}

function getSimulatorTabs() {
    return Array.from(document.querySelectorAll(".nav-item"));
}

function getSimulatorModules() {
    return Array.from(document.querySelectorAll(".module"));
}

function getActiveSimulatorTabId() {
    const activeTab =
        getSimulatorTabs().find(tab => tab.classList.contains("active"));

    return activeTab?.dataset?.tab || SIMULATOR_TAB_SEQUENCE[0];
}

function scrollActiveModuleIntoView() {
    if (!isPhoneChartLayout()) {
        return;
    }

    const plannerInput = document.querySelector(".planner-input");

    plannerInput?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function updateMobileSectionUi(activeTabId) {
    const currentIndex =
        Math.max(0, SIMULATOR_TAB_SEQUENCE.indexOf(activeTabId));
    const prevBtn = document.getElementById("mobilePrevSectionBtn");
    const nextBtn = document.getElementById("mobileNextSectionBtn");
    const label = document.getElementById("mobileSectionLabel");
    const count = document.getElementById("mobileSectionCount");
    const previousTabId = SIMULATOR_TAB_SEQUENCE[currentIndex - 1] || null;
    const nextTabId =
        SIMULATOR_TAB_SEQUENCE[currentIndex + 1] || null;
    const currentMeta = getSimulatorTabMeta(activeTabId);
    const previousMeta = previousTabId
        ? getSimulatorTabMeta(previousTabId)
        : null;
    const nextMeta = nextTabId
        ? getSimulatorTabMeta(nextTabId)
        : null;

    if (label) {
        label.textContent = currentMeta.label || "Profile";
    }

    if (count) {
        count.textContent =
            `${currentIndex + 1} of ${SIMULATOR_TAB_SEQUENCE.length}`;
    }

    if (prevBtn) {
        prevBtn.disabled = !previousTabId;
        prevBtn.textContent = previousTabId
            ? `Previous: ${previousMeta?.shortLabel || "Previous"}`
            : "Start of Calculator";
    }

    if (nextBtn) {
        nextBtn.disabled = !nextTabId;
        nextBtn.textContent = nextTabId
            ? `Next: ${nextMeta?.shortLabel || "Next"}`
            : "Final Step Reached";
    }
}

function setActiveSimulatorTab(targetTabId, { scrollOnMobile = false } = {}) {
    const tabs = getSimulatorTabs();
    const modules = getSimulatorModules();

    if (!targetTabId) {
        return;
    }

    tabs.forEach(tab => {
        tab.classList.toggle("active", tab.dataset.tab === targetTabId);
    });

    modules.forEach(module => {
        module.classList.toggle("active", module.id === targetTabId);
    });

    updateMobileSectionUi(targetTabId);
    renderPlannerStepGuide(targetTabId);
    renderPlannerNextStepCard(collectInputs(), targetTabId);

    if (scrollOnMobile) {
        scrollActiveModuleIntoView();
    }
}

function syncChartModeUi() {
    const toggleBtn = document.getElementById("chartToggleBtn");

    if (!toggleBtn) return;

    if (isPhoneChartLayout()) {
        chartMode = "bar";
        toggleBtn.style.display = "none";
        return;
    }

    toggleBtn.style.display = "";
    toggleBtn.textContent =
        chartMode === "line" ? "Bar Chart" : "Line Chart";
}

function setupDisclaimerGate() {
    const overlay = document.getElementById("disclaimerOverlay");
    const acceptBtn = document.getElementById("acceptDisclaimerBtn");

    if (!overlay || !acceptBtn) return;

    const accepted =
        localStorage.getItem(DISCLAIMER_STORAGE_KEY) === "true";

    if (accepted) {
        overlay.style.display = "none";
        document.body.classList.remove("disclaimer-open");
        return;
    }

    overlay.style.display = "flex";
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("disclaimer-open");

    acceptBtn.addEventListener("click", () => {
        localStorage.setItem(DISCLAIMER_STORAGE_KEY, "true");
        overlay.style.display = "none";
        overlay.setAttribute("aria-hidden", "true");
        document.body.classList.remove("disclaimer-open");
    });
}

function buildCurrentSimulationPayload() {
    const inputs = collectInputs();
    const incomeSources = buildSimulationIncomeSources({
        inputs,
        assetRegistry
    });
    const simulationState = buildSimulationState({
        inputs,
        incomeSources,
        assumptions:
            inputs.assumptions ||
            {
                inflationRate: 0.0329
            }
    });

    simulationState.incomeSources = incomeSources;

    return {
        inputs,
        incomeSources,
        simulationState
    };
}

function buildPortablePlanFileName() {
    const stamp =
        new Date()
            .toISOString()
            .slice(0, 10);

    return `leoff-helper-plan-${stamp}.json`;
}

function downloadPortablePlan(portablePlan) {
    const blob = new Blob(
        [JSON.stringify(portablePlan, null, 2)],
        { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = buildPortablePlanFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 0);
}

async function importPortablePlanFile(file) {
    if (!file) {
        return;
    }

    const text = await file.text();
    const payload = JSON.parse(text);
    const workspaceState =
        payload?.workspaceState ||
        payload;

    applyWorkspaceStateToSimulator(workspaceState, null);
}

function setupPlanTransferUi() {
    const exportBtn = document.getElementById("exportPlanBtn");
    const importBtn = document.getElementById("importPlanBtn");
    const importInput = document.getElementById("importPlanInput");

    exportBtn?.addEventListener("click", () => {
        const { simulationState } = buildCurrentSimulationPayload();
        const portablePlan =
            StateManager.buildPortablePlan({
                simulationState
            });

        StateManager.saveWorkspaceState({
            simulationState
        });
        downloadPortablePlan(portablePlan);
    });

    importBtn?.addEventListener("click", () => {
        importInput?.click();
    });

    importInput?.addEventListener("change", async event => {
        const file = event.target?.files?.[0] || null;

        try {
            await importPortablePlanFile(file);
            setAccountPlansStatus("Plan imported successfully.", "success");
        } catch (error) {
            console.error("Plan import failed", error);
            setAccountPlansStatus(
                "That file could not be imported. Please use a LEOFF Helper plan export.",
                "error"
            );
        } finally {
            if (importInput) {
                importInput.value = "";
            }
        }
    });
}

function setupAccountPlansUi() {
    const saveBtn = document.getElementById("saveAccountPlanBtn");
    const saveAsNewBtn = document.getElementById("saveAccountPlanAsNewBtn");
    const refreshBtn = document.getElementById("refreshAccountPlansBtn");
    const clearComparisonBtn =
        document.getElementById("clearScenarioComparisonBtn");
    const listEl = document.getElementById("accountPlansList");

    saveBtn?.addEventListener("click", async () => {
        await saveCurrentPlanToAccount();
    });

    saveAsNewBtn?.addEventListener("click", async () => {
        await saveCurrentPlanToAccount({ forceNew: true });
    });

    refreshBtn?.addEventListener("click", async () => {
        setAccountPlansStatus("Refreshing account scenarios...", "neutral");
        await refreshAccountPlans();
    });

    clearComparisonBtn?.addEventListener("click", async () => {
        await clearScenarioComparisonSelection();
    });

    listEl?.addEventListener("click", async event => {
        const button =
            event.target instanceof Element
                ? event.target.closest("[data-account-action]")
                : null;

        if (!button) {
            return;
        }

        const action = button.dataset.accountAction;
        const planId = button.dataset.planId;

        if (!planId) {
            return;
        }

        if (action === "open") {
            await openAccountPlan(planId);
            return;
        }

        if (action === "set-current-target") {
            const plan =
                currentAccountPlans.find(entry => entry.id === planId) ||
                null;

            if (!plan) {
                return;
            }

            storeAccountPlanMeta({
                id: plan.id,
                name: plan.name
            });
            renderAccountPlansList();
            setAccountPlansStatus(
                `"${plan.name}" is now the current scenario save target.`,
                "success"
            );
            return;
        }

        if (action === "rename") {
            await renameAccountPlanById(planId);
            return;
        }

        if (action === "duplicate") {
            await duplicateAccountPlanById(planId);
            return;
        }

        if (action === "toggle-compare") {
            await toggleScenarioComparisonById(planId);
            return;
        }

        if (action === "delete") {
            await deleteAccountPlanById(planId);
        }
    });

    window.addEventListener("leoff-auth-state", async () => {
        await refreshAccountPlans();
    });

    window.addEventListener("storage", async event => {
        if (event.key !== AUTH_SYNC_KEY) {
            return;
        }

        await refreshAccountPlans();
    });
}

/* ------------------------------------------------
APP BOOT
------------------------------------------------ */

document.addEventListener("DOMContentLoaded", init);

async function init(){

    await loadAssetModules();

    const workspaceState = StateManager.loadAll();
    
    buildAssetButtons(assetRegistry, {
        buttonClassName: "primary-btn"
    });
    loadProfileModule(assetRegistry);
    applySimulatorTabMeta();
    setupChartToggle();
    setupAutoProjection();
    setupSidebarTabs(); 
    setupAdditionalPensionUi();
    setupSocialSecurityUi();
    setupInflationDefaultsUi();
    setupPremiumStressTestingUi();
    setupPlanTransferUi();
    setupAccountPlansUi();
    setupReportButton();   // add this line
    syncMobileSimulatorMode();
    setupDisclaimerGate();

    if (workspaceState?.simulationState) {
        populateStandardInputs(
            simulationStateToInputs(workspaceState.simulationState)
        );
    }

    populatePremiumStressTestingInputs(workspaceState);
    syncPremiumStressTestingUi();

    runProjection(workspaceState?.simulationState || null);
    await refreshAccountPlans();
}



/* ------------------------------------------------
UI SETUP
------------------------------------------------ */

function setupAutoProjection(){

    document.addEventListener("input", e => {

        if (e.target.matches("input, select")) {
            runProjection();
        }

    });

    document.addEventListener("change", e => {

        if (e.target.matches("input, select")) {
            runProjection();
 StateManager.saveAll(); 
        }

    });

}

function setupChartToggle(){

    const toggleBtn = document.getElementById("chartToggleBtn");
    const timelineSection = document.querySelector(".timeline-section");

    if(!toggleBtn || timelineSection?.hidden) return;

    syncChartModeUi();

    toggleBtn.addEventListener("click", () => {

        if (isPhoneChartLayout()) {
            chartMode = "bar";
            syncChartModeUi();
            if (lastResults) drawTimeline(lastResults);
            return;
        }

        chartMode = chartMode === "line" ? "bar" : "line";

        syncChartModeUi();

        if(lastResults) drawTimeline(lastResults);

    });

    window.addEventListener("resize", () => {
        const previousMode = chartMode;

        syncMobileSimulatorMode();
        syncChartModeUi();

        if (previousMode !== chartMode && lastResults) {
            drawTimeline(lastResults);
        } else if (lastResults) {
            drawTimeline(lastResults);
        }
    });

}

function setupSidebarTabs(){

    const tabs = getSimulatorTabs();
    const prevBtn = document.getElementById("mobilePrevSectionBtn");
    const nextBtn = document.getElementById("mobileNextSectionBtn");

    tabs.forEach(tab => {

        tab.addEventListener("click", () => {
            setActiveSimulatorTab(tab.dataset.tab, {
                scrollOnMobile: isPhoneChartLayout()
            });

        });

    });

    prevBtn?.addEventListener("click", () => {
        const currentIndex =
            SIMULATOR_TAB_SEQUENCE.indexOf(getActiveSimulatorTabId());
        const previousTabId =
            SIMULATOR_TAB_SEQUENCE[currentIndex - 1];

        if (previousTabId) {
            setActiveSimulatorTab(previousTabId, {
                scrollOnMobile: true
            });
        }
    });

    nextBtn?.addEventListener("click", () => {
        const currentIndex =
            SIMULATOR_TAB_SEQUENCE.indexOf(getActiveSimulatorTabId());
        const nextTabId =
            SIMULATOR_TAB_SEQUENCE[currentIndex + 1];

        if (nextTabId) {
            setActiveSimulatorTab(nextTabId, {
                scrollOnMobile: true
            });
        }
    });

    setActiveSimulatorTab(getActiveSimulatorTabId());

}



/* ------------------------------------------------
PROJECTION ENGINE
------------------------------------------------ */

function runProjection(existingSimulationState = null){
    const {
        inputs,
        incomeSources,
        simulationState
    } = buildCurrentSimulationPayload();
    const premiumStressTesting =
        syncPremiumStressTestingStateFromInputs();

    StateManager.saveWorkspaceState({
        premiumStressTesting,
        simulationState: {
            ...existingSimulationState,
            ...simulationState,
            incomeSources: simulationState.incomeSources
        }
    });

    if (!hasRequiredCurrentExpenses(inputs)) {
        lastIncomeSources = [];
        lastResults = null;
        clearProjectionPreview(setText);
        const coverageEl = document.getElementById("incomeCoverage");
        if (coverageEl) {
            coverageEl.style.color = "";
        }
        clearTimeline();
        setReportButtonDisabled(true);
        sessionStorage.removeItem("retirementProjection");
        renderPlannerNextStepCard(inputs, getActiveSimulatorTabId());
        renderScenarioComparisonList();
        return;
    }

    const projection = runProjectionEngine(simulationState);
    lastIncomeSources = incomeSources;
    setReportButtonDisabled(false);

    saveProjectionSnapshot({
        projection,
        moduleState: StateManager.collectModuleState(),
        incomeSources,
        inputs,
        simulationState
    });

    StateManager.saveWorkspaceState({
        premiumStressTesting,
        simulationState: {
            ...existingSimulationState,
            ...simulationState,
            incomeSources
        }
    });

    renderPreview(projection);
    renderPlannerNextStepCard(inputs, getActiveSimulatorTabId());
    renderScenarioComparisonList();

}

function setupAdditionalPensionUi() {

    const hasPers2 = document.getElementById("hasPers2");
    const pers2Section = document.getElementById("pers2Section");
    const hasTrs2 = document.getElementById("hasTrs2");
    const trs2Section = document.getElementById("trs2Section");

    const toggleAdditionalPensionSection = (toggle, section) => {
        if (!toggle || !section) {
            return;
        }

        section.style.display =
            toggle.checked ? "grid" : "none";
    };

    const syncAdditionalPensionSections = () => {
        toggleAdditionalPensionSection(hasPers2, pers2Section);
        toggleAdditionalPensionSection(hasTrs2, trs2Section);
    };

    hasPers2?.addEventListener("change", syncAdditionalPensionSections);
    hasTrs2?.addEventListener("change", syncAdditionalPensionSections);
    syncAdditionalPensionSections();
}

function setupSocialSecurityUi() {

    const modeSelect = document.getElementById("ssMode");

    if (!modeSelect) return;

    const fieldMap = {
        fraBenefit: "ssFraBenefitField",
        benefit62: "ssBenefit62Field",
        benefit70: "ssBenefit70Field"
    };

    const toggleFields = () => {
        Object.entries(fieldMap).forEach(([mode, fieldId]) => {
            const field = document.getElementById(fieldId);

            if (!field) return;

            field.style.display =
                modeSelect.value === mode ? "" : "none";
        });
    };

    modeSelect.addEventListener("change", toggleFields);
    document.addEventListener("socialSecurity:mode-sync", toggleFields);
    toggleFields();
}

function setupInflationDefaultsUi() {

    const resetBtn = document.getElementById("resetInflationDefaultsBtn");

    if (!resetBtn) return;

    resetBtn.addEventListener("click", () => {
        Object.entries(SUGGESTED_INFLATION_DEFAULTS).forEach(([id, value]) => {
            const field = document.getElementById(id);

            if (!field) return;

            field.value = value;
        });

        runProjection();
        StateManager.saveAll();
    });
}

function setupPremiumStressTestingUi() {
    const toggle = document.getElementById("premiumStressTestingEnabled");
    const presetField = document.getElementById("premiumStressPreset");
    const resetBtn = document.getElementById("resetPremiumStressDefaultsBtn");
    const manualFields = Array.from(
        document.querySelectorAll(
            "#premiumStressTestingCard input:not(#premiumStressTestingEnabled)"
        )
    );

    if (!toggle) {
        return;
    }

    toggle.addEventListener("change", () => {
        syncPremiumStressTestingStateFromInputs();
        syncPremiumStressTestingUi();
        renderScenarioComparisonList();
        StateManager.saveAll();
    });

    presetField?.addEventListener("change", () => {
        handlePremiumStressPresetChange();
    });

    manualFields.forEach(field => {
        field.addEventListener("change", () => {
            setPremiumStressPresetToCustom();
            syncPremiumStressTestingStateFromInputs();
            syncPremiumStressTestingUi();
            renderScenarioComparisonList();
            StateManager.saveAll();
        });
    });

    resetBtn?.addEventListener("click", () => {
        populatePremiumStressTestingInputs({
            premiumStressTesting: {
                ...DEFAULT_PREMIUM_STRESS_TESTING,
                ...SUGGESTED_PREMIUM_STRESS_DEFAULTS
            }
        });
        syncPremiumStressTestingUi();
        renderScenarioComparisonList();
        runProjection();
        StateManager.saveAll();
    });

    syncPremiumStressTestingUi();
}

/* ------------------------------------------------
PREVIEW RENDERER
------------------------------------------------ */

function renderPreview(projection){
    lastResults = projection.results;
}

/* ------------------------------------------------
CHART RENDERER
------------------------------------------------ */

function drawTimeline(results){
    const isPhoneLayout = isPhoneChartLayout();

    if (isPhoneLayout) {
        chartMode = "bar";
    }

    renderProjectionChart({
        canvasId:"incomeTimelineChart",
        results,
        dataset: "incomeVsExpenses",
        mode: chartMode,
        incomeSources: lastIncomeSources,
        expenseColor:"#DB2B39",
        yScaleMultiplier: chartMode === "line" ? 1.15 : 1.25,
        compactMobile: isPhoneLayout
    });

    renderMobileIncomeSummary(results);

}

function renderMobileIncomeSummary(results) {
    const summaryEl = document.getElementById("mobileIncomeSummary");

    if (!summaryEl) return;

    if (!isPhoneChartLayout() || !Array.isArray(results) || results.length === 0) {
        summaryEl.innerHTML = "";
        return;
    }

    const retireAge =
        parseInt(document.getElementById("retireAge")?.value, 10) || null;
    const retirementYear =
        results.find(result => result.age === retireAge) ||
        results[0];
    const entries = Object.entries(retirementYear.breakdown || {})
        .filter(([_, amount]) => amount > 0)
        .sort((a, b) => b[1] - a[1]);

    if (entries.length === 0) {
        summaryEl.innerHTML = "";
        return;
    }

    const itemsHtml = entries.map(([name, amount]) => `
        <div class="mobile-income-item">
            <span>${name}</span>
            <strong>$${Math.round(amount).toLocaleString()}</strong>
        </div>
    `).join("");

    summaryEl.innerHTML = `
        <h3>Income Sources At Retirement</h3>
        <div class="mobile-income-list">${itemsHtml}</div>
    `;
}

function populateStandardInputs(inputs) {
    populateSimulatorInputs(inputs);
}

/* ------------------------------------------------
SAFE UI HELPER
------------------------------------------------ */

function setText(id,value){

    const el = document.getElementById(id);

    if(el) el.textContent = value;

}
/* ------------------------------------------------
SAVE STATE BEFORE DASHBOARD
------------------------------------------------ */

function setupReportButton(){

    const reportBtn = document.getElementById("fullReportBtn");

    if(!reportBtn) return;

    reportBtn.addEventListener("click", () => {

        StateManager.saveAll();

    });

}

