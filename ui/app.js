/* =========================================================
   LEOFF 2 Retirement Structural Simulator
   FULL FEATURE COMPLETE APP.JS
========================================================= */

import { runProjection as runProjectionEngine } from "../core/projectionEngine.js";
import { renderProjectionChart } from "./projectionChart.js";
import { collectInputs } from "./inputCollector.js";
import { loadAssetModules } from "../core/assetModuleLoader.js";
import { assetRegistry } from "../core/assetRegistry.js";
import { renderRetirementSummary } from "./retirementSummaryRenderer.js";
import { calculateReadinessScore } from "../analysis/readinessScore.js";
import {
    buildSimulationState,
    simulationStateToInputs
} from "../core/simulationState.js";
import { StateManager } from "../core/stateManager.js";
import {
    buildSimulationIncomeSources,
    saveProjectionSnapshot
} from "./simulatorShared.js";
import { populateSimulatorInputs } from "./simulatorUiShared.js";
import {
    buildAssetButtons,
    loadProfileModule
} from "./simulatorBootstrap.js";

import "../modules/income/socialSecurity.js";
import "../modules/profiles/profileModule.js";
/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    console.log("Initializing simulator");

    await loadAssetModules();

    const assets = assetRegistry.getAll();
    console.log("Loaded assets:", assets);

    buildAssetButtons(assetRegistry);

    const workspaceState = StateManager.loadAll();

    const stored = sessionStorage.getItem("retirementProjection");

    if (stored) {

        const { inputs } = JSON.parse(stored);
        populateInputs(inputs);

    } else if (workspaceState?.simulationState) {

        populateInputs(
            simulationStateToInputs(workspaceState.simulationState)
        );

    }

loadProfileModule(assetRegistry);

});
/* =========================================================
   GLOBAL STATE
========================================================= */

let lastProjection = null;
let lastIncomeSources = [];

const legendContainer = document.getElementById("legend");
const outputContainer = document.getElementById("output");
const realToggle = document.getElementById("realToggle");
const totalIncomeToggle = document.getElementById("showTotalIncomeLine");

const EXPENSE_COLOR = "#DB2B39";

/* =========================================================
   DOM INITIALIZATION (RESTORED)
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* ---------- Expense Live Updates ---------- */

    const expenseInputs = [
        "expenseHousing","expenseGroceries","expenseBills",
        "expenseAuto","expenseHealthcare","expenseOther"
    ];

    expenseInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("input", updateExpenseTotalsLive);
    });

    updateExpenseTotalsLive();

    /* ---------- Tab System ---------- */

    document.querySelectorAll(".tab-btn").forEach(btn => {

        btn.addEventListener("click", () => {

            document.querySelectorAll(".tab-btn")
                .forEach(b => b.classList.remove("active"));

            document.querySelectorAll(".tab-content")
                .forEach(c => c.classList.remove("active"));

            btn.classList.add("active");

            const tab = document.getElementById(btn.dataset.tab);
            if (tab) tab.classList.add("active");

        });

    });

    /* ---------- Survivor Age Toggle ---------- */

    const survivorOption = document.getElementById("survivorOption");
    const survivorAgeWrapper = document.getElementById("survivorAgeWrapper");

    if (survivorOption && survivorAgeWrapper) {

        function toggleSurvivorAge() {

            const val = survivorOption.value?.toLowerCase();

            survivorAgeWrapper.style.display =
                (val && val !== "none") ? "block" : "none";

        }

        survivorOption.addEventListener("change", toggleSurvivorAge);
        toggleSurvivorAge();

    }

    /* ---------- Total Income Toggle ---------- */

    if (totalIncomeToggle) {

        totalIncomeToggle.addEventListener("change", () => {

            if (lastProjection) {

                renderProjectionChart({
                    canvasId: "incomeTimelineChart",
                    results: lastProjection.results,
                    mode: "line",
                    yScaleMultiplier: 1.15
                });

            }

        });

    }

});

/* =========================================================
   EXPENSE CALCULATION
========================================================= */

function updateExpenseTotalsLive() {

    const ids = [
        "expenseHousing","expenseGroceries","expenseBills",
        "expenseAuto","expenseHealthcare","expenseOther"
    ];

    const totalMonthly = ids.reduce((sum,id)=>{

        return sum + (parseFloat(document.getElementById(id)?.value) || 0);

    },0);

    const totalAnnual = totalMonthly * 12;

    document.getElementById("totalMonthlyExpenses").value =
        totalMonthly.toLocaleString(undefined,{minimumFractionDigits:2});

    document.getElementById("totalAnnualExpenses").value =
        totalAnnual.toLocaleString(undefined,{minimumFractionDigits:2});

}

/* =========================================================
   RUN SIMULATION
========================================================= */

const runButton = document.getElementById("runBtn");
if (runButton) {

runButton.addEventListener("click", () => {

const profileModule = assetRegistry.get("profile");

if (!profileModule) {
alert("Profile module not loaded.");
return;
}

const profile = profileModule.getProfile?.();

if (!profile || !profile.birthYear || !profile.birthMonth) {

alert("Please complete the Household Profile before running the simulation.");

return;

}

runSimulation();

});

}

function runSimulation() {

    const inputs = collectInputs();
const profileModule = assetRegistry.get("profile");

if (profileModule && typeof profileModule.getProfile === "function") {

    const profile = profileModule.getProfile();

    inputs.currentAge = profile.currentAge;

}

    const retireAge = inputs.retireAge;
    const lifeExpectancy = inputs.lifeExpectancy;

    const incomeSources = buildSimulationIncomeSources({
        inputs,
        assetRegistry
    });
    console.log("Income Sources:", incomeSources);

    const simulationState = buildSimulationState({
        inputs,
        incomeSources,
        assumptions: {
            inflationRate: 0.0329
        },
        overrides: {
            retireAge,
            lifeExpectancy
        }
    });
    simulationState.toggles.showReal = realToggle?.checked || false;
    simulationState.toggles.marketFirst = false;

    const projection = runProjectionEngine(simulationState);

    lastProjection = projection;
    lastIncomeSources = incomeSources;

/* =========================================
   SAVE RESULTS FOR DASHBOARD
========================================= */
saveProjectionSnapshot({
    projection,
    moduleState: StateManager.collectModuleState(),
    inputs,
    incomeSources,
    simulationState
});

StateManager.saveWorkspaceState({
    simulationState
});
/* =========================================
   REDIRECT TO DASHBOARD
========================================= */

window.location.href = "retirementDashboard.html";

}

/* =========================================================
   CHART WRAPPER
========================================================= */

function drawChart(results) {

    renderProjectionChart({
        canvasId: "comparisonChart",
        results,
        mode: "bar",
        expenseColor: EXPENSE_COLOR,
        yScaleMultiplier: 1.25
    });

}

 /* =========================
       POPULATE INPUTS
    ========================= */


function populateInputs(inputs) {

    if (!inputs) return;

    populateSimulatorInputs(inputs);

}

/* =========================================================
   LEGEND
========================================================= */

function renderLegend(incomeSources) {

    if (!legendContainer) return;

    legendContainer.innerHTML = "";

    incomeSources.forEach(source => {

        const div = document.createElement("div");
        div.className = "legend-item";

        div.innerHTML = `
            <div class="legend-color"
                style="background:#3F7C85">
            </div>
            <span>${source.name}</span>
        `;

        legendContainer.appendChild(div);

    });

}

/* =========================================================
   DEPLETION INFO
========================================================= */

function renderDepletionInfo(depletionAges) {

    if (!outputContainer) return;

    outputContainer.innerHTML = "";

    Object.entries(depletionAges).forEach(([name, age]) => {

        const p = document.createElement("p");

        p.innerHTML = (age === "SUSTAINABLE")
            ? `<strong>${name}</strong> is Sustainable Forever`
            : `<strong>${name}</strong> depleted at age ${age}`;

        outputContainer.appendChild(p);

    });

}
