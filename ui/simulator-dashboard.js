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

/* ------------------------------------------------
GLOBAL STATE
------------------------------------------------ */

let chartMode = "line";
let lastResults = null;
let lastIncomeSources = [];
const SUGGESTED_INFLATION_DEFAULTS = {
    goodsServicesInflation: "3.29",
    housingInflation: "2.8",
    healthcareInflation: "6"
};
const DISCLAIMER_STORAGE_KEY = "leoffHelperDisclaimerAccepted";

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
    setupChartToggle();
    setupAutoProjection();
    setupSidebarTabs(); 
    setupAdditionalPensionUi();
    setupSocialSecurityUi();
    setupInflationDefaultsUi();
    setupReportButton();   // add this line
    syncMobileSimulatorMode();
    setupDisclaimerGate();

    if (workspaceState?.simulationState) {
        populateStandardInputs(
            simulationStateToInputs(workspaceState.simulationState)
        );
    }

    runProjection(workspaceState?.simulationState || null);
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

    if(!toggleBtn) return;

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

    const tabs = document.querySelectorAll(".nav-item");
    const modules = document.querySelectorAll(".module");

    tabs.forEach(tab => {

        tab.addEventListener("click", () => {

            const target = tab.dataset.tab;

            // remove active classes
            tabs.forEach(t => t.classList.remove("active"));
            modules.forEach(m => m.classList.remove("active"));

            // activate clicked tab
            tab.classList.add("active");

            const module = document.getElementById(target);
            if(module) module.classList.add("active");

        });

    });

}



/* ------------------------------------------------
PROJECTION ENGINE
------------------------------------------------ */

function runProjection(existingSimulationState = null){

    const inputs = collectInputs();
    const simulationState = buildSimulationState({
        inputs,
        incomeSources: [],
        assumptions:
            inputs.assumptions ||
            {
                inflationRate: 0.0329
            }
    });

    StateManager.saveWorkspaceState({
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
        return;
    }

    const incomeSources = buildSimulationIncomeSources({
        inputs,
        assetRegistry
    });
    simulationState.incomeSources = incomeSources;

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
        simulationState: {
            ...existingSimulationState,
            ...simulationState,
            incomeSources
        }
    });

    renderPreview(projection);

}

function setupAdditionalPensionUi() {

    const hasPers2 = document.getElementById("hasPers2");
    const pers2Section = document.getElementById("pers2Section");

    if (!hasPers2 || !pers2Section) return;

    const togglePers2Section = () => {
        pers2Section.style.display =
            hasPers2.checked ? "grid" : "none";
    };

    hasPers2.addEventListener("change", togglePers2Section);
    togglePers2Section();
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

/* ------------------------------------------------
PREVIEW RENDERER
------------------------------------------------ */

function renderPreview(projection){
    const metrics = applyProjectionPreview({
        projection,
        setText,
        onCoverageColor: coveragePercent => {
            const coverageEl = document.getElementById("incomeCoverage");

            if (!coverageEl) return;

            coverageEl.style.color =
                coveragePercent < 100 ? "#DB2B39" :
                coveragePercent < 120 ? "#BC6C25" :
                "#1F4D3A";
        }
    });

    if (!metrics) return;

    lastResults = projection.results;

    drawTimeline(projection.results);

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

