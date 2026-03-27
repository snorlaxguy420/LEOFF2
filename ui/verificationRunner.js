import {
    buildSimulationState,
    simulationStateToInputs
} from "../core/simulationState.js";
import { runProjection } from "../core/projectionEngine.js";
import {
    applyRetirementAccountTaxTreatment,
    projectTotalRetirement
} from "../core/incomeEngine.js";
import { renderProjectionChart } from "./projectionChart.js";
import { assetRegistry } from "../core/assetRegistry.js";
import {
    buildSimulationIncomeSources,
    normalizeLeoffSurvivorOption
} from "./simulatorShared.js";
import { generateRealEstatePayloads } from "../core/realEstateEngine.js";
import {
    calculateSocialSecurityAgeFactor,
    calculateSocialSecurityIncomeSource,
    normalizeSocialSecurityFraBenefit
} from "../core/socialSecurityEngine.js";
import { compareRetirementAges } from "../analysis/retirementScenarios.js";
import { runMonteCarloSimulation } from "../analysis/monteCarloEngine.js";
import { analyzeRetirementPlan } from "../analysis/retirementAnalysis.js";
import { calculateReadinessScore } from "../analysis/readinessScore.js";
import { runRetirementVulnerabilityAnalysis } from "../analysis/retirementVulnerability.js";
import {
    populateSimulatorInputs,
    getProjectionPreviewMetrics
} from "./simulatorUiShared.js";
import { createCollapsibleCard } from "../core/createCollapsibleCard.js";
import {
    buildExpenseBreakdownSummary,
    buildMonteCarloContent,
    buildPlanningLeverContent,
    buildRecommendedAgeSummary,
    buildRecommendationContent,
    buildShortfallSummary,
    buildTaxSnapshotSummary,
    buildTopRiskEntries,
    getDisplayedRecommendationAge
} from "../analysis/dashboardViewModel.js";
import {
    deriveCurrentAgeFromBirthYear,
    parseRetirementAges,
    buildScenario as buildRetirementComparisonScenario,
    enrichComparisonRows
} from "./retirement-age-comparison.js";
import {
    estimateSurvivorOptions,
    validateInputs as validateSurvivorEstimatorInputs
} from "./survivor-benefit-estimator.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function logResult(message) {
    const output = document.getElementById("verificationOutput");
    if (!output) return;

    const item = document.createElement("li");
    item.textContent = message;
    output.appendChild(item);
}

function logSmokeResult(message) {
    const output = document.getElementById("smokeTestOutput");
    if (!output) return;

    const item = document.createElement("li");
    item.textContent = message;
    output.appendChild(item);
}

const SMOKE_TEST_PAGES = [
    {
        name: "Homepage",
        path: "./index.html",
        selectors: [".site-header img", ".hero", ".about-section"]
    },
    {
        name: "Simulator",
        path: "./simulator.html",
        selectors: [".planner-grid", "#incomeTimelineChart", ".planner-sidebar"]
    },
    {
        name: "Dashboard",
        path: "./retirementDashboard.html",
        selectors: [
            "#retirementDashboard",
            "#comparisonChart",
            "#retirementAgeSlider",
            "#downloadPdfBtn",
            "#recommendationHeadline",
            "#monteCarloHeadline",
            "#planningLeverHeadline",
            "#readinessCoverageScore",
            "#expenseEssential",
            "#taxesAtRetirement",
            "#topRisksList",
            "#reportCumulativeShortfall"
        ]
    },
    {
        name: "Articles Hub",
        path: "./articles.html",
        selectors: [".articles-shell", ".article-grid", ".site-header img"]
    },
    {
        name: "About Page",
        path: "./about.html",
        selectors: [".about-shell", ".about-grid", ".site-header img"]
    },
    {
        name: "Retirement Age Comparison",
        path: "./retirement-age-comparison.html",
        selectors: [".comparison-shell", "#runComparisonBtn", "#comparisonTableBody"]
    },
    {
        name: "Survivor Benefit Estimator",
        path: "./survivor-benefit-estimator.html",
        selectors: [".survivor-shell", "#runSurvivorEstimatorBtn", "#survivorSummaryTableBody"]
    },
    {
        name: "Article Page",
        path: "./articles/article-leoff-retirement.html",
        selectors: [".article-shell", ".article-content", ".article-sidebar"]
    }
];

function loadFrame(frame, path) {
    return new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
            reject(new Error(`Timed out loading ${path}`));
        }, 12000);

        frame.onload = () => {
            window.clearTimeout(timeoutId);
            resolve();
        };

        frame.onerror = () => {
            window.clearTimeout(timeoutId);
            reject(new Error(`Failed to load ${path}`));
        };

        frame.src = path;
    });
}

function assertSmokeSelectors(doc, page) {
    page.selectors.forEach(selector => {
        assert(
            doc.querySelector(selector),
            `${page.name} missing selector ${selector}`
        );
    });
}

function assertSmokeImages(doc, page) {
    const images = Array.from(doc.images || []);

    if (!images.length) {
        return;
    }

    images.forEach(image => {
        assert(
            image.complete,
            `${page.name} image did not finish loading: ${image.getAttribute("src") || "(unknown src)"}`
        );
    });
}

async function runBrowserSmokeTests() {
    const frame = document.getElementById("smokeTestFrame");
    assert(frame, "Smoke test frame missing");

    for (const page of SMOKE_TEST_PAGES) {
        await loadFrame(frame, page.path);

        const doc = frame.contentDocument;
        assert(doc, `${page.name} document was not available`);

        assertSmokeSelectors(doc, page);
        assertSmokeImages(doc, page);

        logSmokeResult(`${page.name} smoke test passed`);
    }
}

function buildSampleResults() {
    return [
        {
            age: 53,
            income: 72000,
            totalIncome: 72000,
            expenses: 60000,
            breakdown: {
                "LEOFF Pension": 48000,
                "Social Security": 24000
            },
            portfolios: {
                "401k": 300000
            },
            realEstateValue: 0,
            mortgageBalance: 0,
            netWorth: 300000
        },
        {
            age: 54,
            income: 71000,
            totalIncome: 71000,
            expenses: 62000,
            breakdown: {
                "LEOFF Pension": 49000,
                "Social Security": 22000
            },
            portfolios: {
                "401k": 280000
            },
            realEstateValue: 0,
            mortgageBalance: 0,
            netWorth: 280000
        },
        {
            age: 55,
            income: 40000,
            totalIncome: 40000,
            expenses: 65000,
            breakdown: {
                "LEOFF Pension": 40000
            },
            portfolios: {
                "401k": 0
            },
            realEstateValue: 0,
            mortgageBalance: 0,
            netWorth: 0
        }
    ];
}

function testSimulationStateRoundTrip() {
    const inputs = {
        profile: {
            currentAge: 45,
            spouse: {
                name: "Taylor",
                currentAge: 43,
                retirementAge: 58,
                annualIncome: 65000
            }
        },
        retireAge: 53,
        lifeExpectancy: 90,
        pension: {
            serviceYears: 25,
            finalAverageSalary: 110000,
            currentAnnualPay: 100000,
            cola: 0.02,
            benefitEnhancement: "lump_sum",
            survivorOption: "50%",
            survivorAge: 50
        },
        socialSecurity: {
            birthYear: 1981,
            claimAge: 67,
            cola: 0.02,
            fraBenefit: 24000
        },
        expenses: {
            housing: 1800,
            groceries: 700,
            bills: 450,
            auto: 500,
            healthcare: 600,
            insurance: 250,
            other: 400,
            monthly: 4700,
            annual: 56400
        },
        assumptions: {
            inflationRate: 0.03,
            goodsServicesInflationRate: 0.03,
            housingInflationRate: 0.04,
            healthcareInflationRate: 0.05
        },
        toggles: {
            showReal: true,
            marketFirst: false
        }
    };

    const simulationState = buildSimulationState({
        inputs,
        incomeSources: []
    });
    const roundTrip = simulationStateToInputs(simulationState);

    assert(roundTrip.retireAge === 53, "Retirement age round-trip failed");
    assert(roundTrip.pension.serviceYears === 25, "Service years round-trip failed");
    assert(roundTrip.pension.currentAnnualPay === 100000, "Current annual pay round-trip failed");
    assert(roundTrip.pension.benefitEnhancement === "lump_sum", "Benefit enhancement round-trip failed");
    assert(roundTrip.profile.spouse.currentAge === 43, "Spouse current age round-trip failed");
    assert(roundTrip.profile.spouse.retirementAge === 58, "Spouse retirement age round-trip failed");
    assert(roundTrip.profile.spouse.annualIncome === 65000, "Spouse income round-trip failed");
    assert(roundTrip.expenses.housing === 1800, "Expense detail round-trip failed");
    assert(roundTrip.expenses.insurance === 250, "Insurance round-trip failed");
    assert(roundTrip.socialSecurity.claimAge === 67, "Social Security round-trip failed");
    assert(roundTrip.assumptions.housingInflationRate === 0.04, "Inflation split round-trip failed");
    assert(roundTrip.toggles.showReal === true, "Toggle round-trip failed");

    logResult("Simulation state round-trip passed");
}

function testProjectionChartModes() {
    const results = buildSampleResults();

    renderProjectionChart({
        canvasId: "verificationChart",
        results,
        mode: "bar",
        tooltipId: "tooltip",
        incomeColors: {
            "LEOFF Pension": "#1F4D3A",
            "Social Security": "#5C7C8A"
        }
    });

    renderProjectionChart({
        canvasId: "verificationChart",
        results,
        mode: "line",
        tooltipId: "tooltip",
        legendId: "timelineLegend",
        incomeColors: {
            "LEOFF Pension": "#1F4D3A",
            "Social Security": "#5C7C8A"
        },
        yScaleMultiplier: 1.15
    });

    const canvas = document.getElementById("verificationChart");
    assert(canvas && canvas.width > 0, "Projection chart render failed");

    logResult("Projection chart bar/line smoke render passed");
}

function testProjectionChartDatasets() {
    const results = buildSampleResults();
    const incomeSources = [
        {
            name: "LEOFF Pension",
            type: "fixed",
            annualAmount: 48000,
            startAge: 53,
            growthRate: 0
        }
    ];

    renderProjectionChart({
        canvasId: "verificationChart",
        results,
        dataset: "pensionIncome",
        mode: "line",
        tooltipId: "tooltip",
        legendId: "timelineLegend",
        incomeSources,
        incomeColors: {
            "LEOFF Pension": "#1F4D3A"
        }
    });

    renderProjectionChart({
        canvasId: "verificationChart",
        results,
        dataset: "assetsOverTime",
        mode: "bar",
        tooltipId: "tooltip",
        incomeColors: {
            "Portfolio Assets": "#1E2F44",
            "Real Estate Value": "#6A8F6B"
        }
    });

    const legend = document.getElementById("timelineLegend");
    assert(legend !== null, "Chart dataset legend container missing");

    logResult("Projection chart dataset contract passed");
}

function testSharedSimulatorHelpers() {
    const inputs = {
        retireAge: 53,
        pension: {
            serviceYears: 25,
            finalAverageSalary: 110000,
            cola: 0.02,
            benefitEnhancement: "lump_sum",
            survivorOption: "50%",
            survivorAge: 50
        },
        socialSecurity: {
            claimAge: 67,
            cola: 0.02,
            fraBenefit: 24000
        }
    };

    const fakeRegistry = {
        getAll() {
            return [
                {
                    getSimulationPayloads() {
                        return {
                            type: "portfolio",
                            name: "Brokerage",
                            balance: 100000,
                            growthRate: 0.06
                        };
                    }
                }
            ];
        }
    };

    const incomeSources = buildSimulationIncomeSources({
        inputs,
        assetRegistry: fakeRegistry
    });

    assert(
        normalizeLeoffSurvivorOption("50%") === "JOINT_50",
        "Survivor option normalization failed"
    );
    assert(incomeSources.length === 4, "Income source assembly failed");
    assert(
        incomeSources.some(source => source.name === "LEOFF Pension"),
        "LEOFF pension source missing"
    );
    assert(
        incomeSources.some(source => source.name === "LEOFF Lump Sum"),
        "LEOFF lump sum source missing"
    );

    logResult("Shared simulator income helper passed");
}

function testSocialSecurityCalculation() {
    const source = calculateSocialSecurityIncomeSource({
        birthYear: 1960,
        claimAge: 62,
        cola: 0.02,
        fraBenefit: 2000
    });

    assert(source !== null, "Social Security source was not built");
    assert(source.startAge === 62, "Social Security start age failed");
    assert(source.metadata.fra === 67, "Social Security FRA failed");
    assert(
        source.metadata.ageFactor < 1,
        "Social Security early claim factor failed"
    );
    assert(
        Math.round(source.annualAmount) === 16800,
        "Social Security annual amount failed"
    );

    const delayedFactor =
        calculateSocialSecurityAgeFactor(70, 67);

    assert(delayedFactor > 1, "Social Security delayed credit failed");

    const normalizedFraFrom62 = normalizeSocialSecurityFraBenefit({
        birthYear: 1960,
        mode: "benefit62",
        benefit62: 1400
    });

    const normalizedFraFrom70 = normalizeSocialSecurityFraBenefit({
        birthYear: 1960,
        mode: "benefit70",
        benefit70: 2480
    });

    assert(
        Math.round(normalizedFraFrom62) === 2000,
        "Social Security 62 benefit normalization failed"
    );
    assert(
        Math.round(normalizedFraFrom70) === 2000,
        "Social Security 70 benefit normalization failed"
    );

    logResult("Social Security calculation passed");
}

function testRetirementAccountTaxTreatment() {
    const four01k = applyRetirementAccountTaxTreatment({
        source: {
            accountType: "401k",
            taxable: true
        },
        withdrawal: 10000,
        currentAge: 55,
        currentTaxableIncome: 0
    });

    const traditionalIra = applyRetirementAccountTaxTreatment({
        source: {
            accountType: "traditional_ira",
            taxable: true
        },
        withdrawal: 10000,
        currentAge: 55,
        currentTaxableIncome: 0
    });

    const four03b = applyRetirementAccountTaxTreatment({
        source: {
            accountType: "403b",
            taxable: true,
            penaltyExceptionType: "public_safety_age50"
        },
        withdrawal: 10000,
        currentAge: 55,
        currentTaxableIncome: 0
    });

    const four01a = applyRetirementAccountTaxTreatment({
        source: {
            accountType: "401a",
            taxable: true,
            penaltyExceptionType: "age55"
        },
        withdrawal: 10000,
        currentAge: 55,
        currentTaxableIncome: 0
    });

    const tsp = applyRetirementAccountTaxTreatment({
        source: {
            accountType: "tsp",
            taxable: true,
            penaltyExceptionType: "public_safety_age50"
        },
        withdrawal: 10000,
        currentAge: 55,
        currentTaxableIncome: 0
    });

    const four57b = applyRetirementAccountTaxTreatment({
        source: {
            accountType: "457b",
            taxable: true
        },
        withdrawal: 10000,
        currentAge: 55,
        currentTaxableIncome: 0
    });

    const rothIra = applyRetirementAccountTaxTreatment({
        source: {
            accountType: "roth_ira",
            taxable: false
        },
        withdrawal: 10000,
        currentAge: 55,
        currentTaxableIncome: 0
    });

    const roth401k = applyRetirementAccountTaxTreatment({
        source: {
            accountType: "roth_401k",
            taxable: false,
            penaltyExceptionType: "public_safety_age50"
        },
        withdrawal: 10000,
        currentAge: 55,
        currentTaxableIncome: 0
    });

    const publicSafety401k = applyRetirementAccountTaxTreatment({
        source: {
            accountType: "401k",
            taxable: true,
            penaltyExceptionType: "public_safety_age50"
        },
        withdrawal: 10000,
        currentAge: 50,
        currentTaxableIncome: 0
    });

    const pensionLoaded401k = applyRetirementAccountTaxTreatment({
        source: {
            accountType: "401k",
            taxable: true
        },
        withdrawal: 10000,
        currentAge: 60,
        currentTaxableIncome: 50000
    });

    assert(four01k.incomeTax === 1000, "401k tax handling failed");
    assert(four01k.earlyWithdrawalPenalty === 1000, "401k penalty handling failed");
    assert(four01k.netWithdrawal === 8000, "401k net withdrawal failed");

    assert(
        traditionalIra.earlyWithdrawalPenalty === 1000,
        "Traditional IRA penalty handling failed"
    );
    assert(four03b.incomeTax === 1000, "403(b) tax handling failed");
    assert(four03b.earlyWithdrawalPenalty === 0, "403(b) public safety penalty handling failed");
    assert(four03b.netWithdrawal === 9000, "403(b) net withdrawal failed");
    assert(four01a.incomeTax === 1000, "401(a) tax handling failed");
    assert(four01a.earlyWithdrawalPenalty === 0, "401(a) age-55 penalty handling failed");
    assert(four01a.netWithdrawal === 9000, "401(a) net withdrawal failed");
    assert(tsp.incomeTax === 1000, "TSP tax handling failed");
    assert(tsp.earlyWithdrawalPenalty === 0, "TSP public safety penalty handling failed");
    assert(tsp.netWithdrawal === 9000, "TSP net withdrawal failed");
    assert(four57b.incomeTax === 1000, "457b tax handling failed");
    assert(four57b.earlyWithdrawalPenalty === 0, "457b penalty handling failed");
    assert(four57b.netWithdrawal === 9000, "457b net withdrawal failed");

    assert(rothIra.incomeTax === 0, "Roth IRA tax handling failed");
    assert(rothIra.earlyWithdrawalPenalty === 0, "Roth IRA penalty handling failed");
    assert(rothIra.netWithdrawal === 10000, "Roth IRA net withdrawal failed");

    assert(roth401k.incomeTax === 0, "Roth 401k tax handling failed");
    assert(roth401k.earlyWithdrawalPenalty === 0, "Roth 401k penalty handling failed");
    assert(roth401k.netWithdrawal === 10000, "Roth 401k net withdrawal failed");
    assert(publicSafety401k.earlyWithdrawalPenalty === 0, "401k public safety exception failed");
    assert(publicSafety401k.netWithdrawal === 9000, "401k public safety net withdrawal failed");
    assert(pensionLoaded401k.incomeTax === 2200, "401k stacked tax handling failed");
    assert(pensionLoaded401k.netWithdrawal === 7800, "401k stacked net withdrawal failed");

    logResult("Retirement account tax treatment passed");
}

function testRetirementAccountRmdProjection() {
    const projection = projectTotalRetirement({
        incomeSources: [
            {
                type: "portfolio",
                name: "Traditional IRA",
                balance: 265000,
                startAge: 60,
                growthRate: 0,
                withdrawalType: "amount",
                withdrawal: 5000,
                taxable: true,
                accountType: "traditional_ira"
            },
            {
                type: "portfolio",
                name: "Roth IRA",
                balance: 265000,
                startAge: 60,
                growthRate: 0,
                withdrawalType: "amount",
                withdrawal: 5000,
                taxable: false,
                accountType: "roth_ira"
            }
        ],
        retireAge: 73,
        lifeExpectancy: 73,
        baseExpenses: 0,
        inflation: 0,
        showReal: false
    });

    const age73 = projection.results.find(result => result.age === 73);
    const traditionalIraIncome = age73?.breakdown?.["Traditional IRA"] || 0;
    const rothIraIncome = age73?.breakdown?.["Roth IRA"] || 0;

    assert(
        traditionalIraIncome > rothIraIncome,
        "Traditional IRA should honor an approximate RMD floor before Roth accounts do"
    );
    assert(
        traditionalIraIncome >= 9000,
        "Traditional IRA RMD floor should raise the net draw above the manual $5,000 amount at age 73"
    );
    assert(
        rothIraIncome === 5000,
        "Roth IRA should keep the configured withdrawal when no RMD applies"
    );

    logResult("Retirement account RMD projection passed");
}

function testRetirementAccountContributionAccumulation() {
    const projection = projectTotalRetirement({
        incomeSources: [
            {
                type: "portfolio",
                name: "401k",
                balance: 100000,
                startAge: 60,
                growthRate: 0.10,
                employeeContributionRate: 0.10,
                employerMatchRate: 0.05,
                withdrawalType: "amount",
                withdrawal: 1000,
                taxable: true,
                accountType: "401k"
            }
        ],
        currentAge: 45,
        currentAnnualPay: 100000,
        expectedFinalAnnualPay: 110000,
        retireAge: 47,
        lifeExpectancy: 48,
        baseExpenses: 0,
        inflation: 0,
        showReal: false
    });

    const age47 = projection.results.find(result => result.age === 47);
    const age48 = projection.results.find(result => result.age === 48);
    const age47Balance = age47?.portfolios?.["401k"] || 0;
    const age48Balance = age48?.portfolios?.["401k"] || 0;

    assert(
        Math.round(age47Balance) === 169400,
        "Retirement account pay-based contributions did not accumulate into the starting retirement balance"
    );
    assert(
        Math.round(age48Balance) === 186340,
        "Retirement account balances should keep growing before withdrawals begin"
    );

    logResult("Retirement account contribution accumulation passed");
}

function testSplitExpenseInflationProjection() {
    const simulationState = buildSimulationState({
        inputs: {
            retireAge: 60,
            lifeExpectancy: 61,
            expenses: {
                housing: 1000,
                groceries: 500,
                bills: 200,
                auto: 100,
                healthcare: 300,
                insurance: 150,
                other: 250,
                monthly: 2500,
                annual: 30000
            },
            assumptions: {
                inflationRate: 0.03,
                goodsServicesInflationRate: 0.03,
                housingInflationRate: 0.05,
                healthcareInflationRate: 0.08
            }
        },
        incomeSources: []
    });
    const projection = runProjection(simulationState);
    const age61 = projection.results.find(result => result.age === 61);
    const expectedExpenses =
        (1000 * 12 * 1.05) +
        ((500 + 200 + 100 + 250) * 12 * 1.03) +
        (300 * 12 * 1.08) +
        (150 * 12 * 1.03);

    assert(
        Math.round(age61.expenses) === Math.round(expectedExpenses),
        "Split expense inflation projection failed"
    );
    assert(
        Math.round(age61.expenseBreakdown.insurance) === Math.round(150 * 12 * 1.03),
        "Insurance expense breakdown failed"
    );
    assert(
        Math.round(age61.expenseBreakdown.essential) ===
        Math.round(
            (1000 * 12 * 1.05) +
            (500 * 12 * 1.03) +
            (200 * 12 * 1.03) +
            (300 * 12 * 1.08) +
            (150 * 12 * 1.03)
        ),
        "Essential expense breakdown failed"
    );
    assert(
        Math.round(age61.expenseBreakdown.discretionary) ===
        Math.round(
            (100 * 12 * 1.03) +
            (250 * 12 * 1.03)
        ),
        "Discretionary expense breakdown failed"
    );

    logResult("Split expense inflation projection passed");
}

function testPreRetirementEmploymentIncomeProjection() {
    const projection = projectTotalRetirement({
        incomeSources: [],
        currentAge: 45,
        currentAnnualPay: 100000,
        expectedFinalAnnualPay: 110000,
        retireAge: 47,
        lifeExpectancy: 47,
        baseExpenses: 50000,
        inflation: 0.03
    });
    const age45 = projection.results.find(result => result.age === 45);
    const age46 = projection.results.find(result => result.age === 46);
    const age47 = projection.results.find(result => result.age === 47);

    assert(age45, "Pre-retirement projection missing current-age year");
    assert(age46, "Pre-retirement projection missing working-age year");
    assert(age47, "Pre-retirement projection missing retirement year");
    assert(
        Math.round(age45.income || 0) === 100000,
        "Current-age employment income was not projected"
    );
    assert(
        Math.round(age46.income || 0) === 110000,
        "Pre-retirement earnings were not amortized toward final pay"
    );
    assert(
        Math.round(age47.income || 0) === 0,
        "Employment income should stop at retirement age"
    );

    logResult("Pre-retirement employment income projection passed");
}

function testSpouseIncomeStopsAtSpouseRetirement() {
    const projection = projectTotalRetirement({
        incomeSources: [],
        currentAge: 45,
        spouseCurrentAge: 43,
        spouseRetirementAge: 45,
        spouseAnnualIncome: 60000,
        retireAge: 47,
        lifeExpectancy: 47,
        baseExpenses: 50000,
        inflation: 0.03
    });
    const age45 = projection.results.find(result => result.age === 45);
    const age46 = projection.results.find(result => result.age === 46);
    const age47 = projection.results.find(result => result.age === 47);

    assert(
        Math.round((age45?.breakdown?.["Spouse Income"] || 0)) === 60000,
        "Spouse income should count before spouse retirement"
    );
    assert(
        Math.round((age46?.breakdown?.["Spouse Income"] || 0)) === 60000,
        "Spouse income should continue until the spouse reaches retirement age"
    );
    assert(
        Math.round((age47?.breakdown?.["Spouse Income"] || 0)) === 0,
        "Spouse income should stop once spouse reaches retirement age"
    );

    logResult("Spouse income retirement stop passed");
}

function testRentalIncomeProjectionBreakdown() {
    const rentalPayloads = generateRealEstatePayloads({
        label: "Test Rental",
        type: "rental",
        propertyValue: 500000,
        monthlyRent: 3000,
        vacancyRate: 0.05,
        mortgageBalance: 0,
        mortgageRate: 0,
        mortgageYearsRemaining: 0,
        appreciation: 0.04,
        propertyTaxRate: 0.011,
        maintenanceRate: 0.01,
        insuranceCost: 1800,
        currentAge: 53,
        inflation: 0.028
    }).filter(payload => payload.name === "Rental Income");

    const projection = runProjection(
        buildSimulationState({
            inputs: {
                retireAge: 53,
                lifeExpectancy: 54,
                expenses: {
                    monthly: 0,
                    annual: 0
                }
            },
            incomeSources: rentalPayloads
        })
    );

    const firstYear = projection.results[0];

    assert(
        Math.round(firstYear.breakdown["Rental Income"] || 0) === 34200,
        "Rental income did not appear in projection breakdown"
    );
    assert(
        Math.round(firstYear.totalIncome || 0) === 34200,
        "Rental income did not count toward total income"
    );

    logResult("Rental income projection breakdown passed");
}

function testDebtPayloadConsistency() {
    const debtSource = {
        type: "expense",
        name: "Car Loan",
        startAge: 53,
        endAge: 58,
        annualAmount: 6000,
        growthRate: 0,
        taxable: false
    };

    const projection = runProjection(
        buildSimulationState({
            inputs: {
                retireAge: 53,
                lifeExpectancy: 53,
                expenses: {
                    monthly: 12000 / 12,
                    annual: 12000
                }
            },
            incomeSources: [debtSource]
        })
    );

    const firstYear = projection.results[0];

    assert(
        Math.round(firstYear.expenses || 0) === 18000,
        "Debt payload did not flow through as an expense"
    );
    assert(
        Math.round(firstYear.totalIncome || 0) === 0,
        "Debt payload incorrectly affected total income"
    );

    logResult("Debt payload consistency passed");
}

async function testDebtModuleCardFlow() {
    await import("../modules/assets/debts.js");

    const debtModule = assetRegistry.get("debt");
    const debtContainer = document.getElementById("debtTypeContainer");

    assert(debtModule, "Debt module did not register");
    assert(debtContainer, "Debt container missing");

    const debtCard = debtModule.createCard();
    debtContainer.appendChild(debtCard);

    debtCard.querySelector("#debtName").value = "Car Loan";
    debtCard.querySelector("#debtBalance").value = "18000";
    debtCard.querySelector("#debtRate").value = "6";
    debtCard.querySelector("#debtPayment").value = "450";
    debtCard.querySelector("#debtExtra").value = "50";
    debtCard.querySelector(".save-debt").click();

    const summaryText =
        debtCard.querySelector(".summary-text")?.textContent || "";

    assert(
        summaryText.includes("Car Loan") &&
        summaryText.includes("$18,000") &&
        summaryText.includes("$450"),
        "Debt card summary did not render expected values after save"
    );

    debtCard.remove();

    logResult("Debt module card flow passed");
}

function testRetirementVulnerabilityEngine() {
    const inputs = {
        retireAge: 53,
        lifeExpectancy: 90
    };
    const incomeSources = [
        {
            type: "fixed",
            name: "LEOFF Pension",
            annualAmount: 50000,
            startAge: 53,
            growthRate: 0.02
        },
        {
            type: "portfolio",
            name: "401k",
            balance: 300000,
            startAge: 53,
            growthRate: 0.05,
            withdrawalType: "amount",
            withdrawal: 12000,
            taxable: true,
            accountType: "401k"
        }
    ];
    const projection = {
        results: buildSampleResults(),
        cumulativeShortfall: 0
    };

    const vulnerability = runRetirementVulnerabilityAnalysis({
        inputs,
        incomeSources,
        projection,
        assumedInflationRate: 0.03
    });

    assert(vulnerability.primaryRisk, "Retirement vulnerability primary risk missing");
    assert(
        vulnerability.risks.length >= 1,
        "Retirement vulnerability ranked risks missing"
    );
    assert(
        vulnerability.risks.some(risk => risk.id === vulnerability.primaryRisk.id),
        "Retirement vulnerability primary risk should be included in ranked risks"
    );
    assert(vulnerability.primaryRisk.mitigation, "Retirement vulnerability mitigation missing");
    assert(vulnerability.primaryRisk.severityTier, "Retirement vulnerability severity tier missing");

    logResult("Retirement vulnerability engine passed");
}

function testZeroHousingDoesNotTriggerHousingRisk() {
    const vulnerability = runRetirementVulnerabilityAnalysis({
        inputs: {
            retireAge: 53,
            lifeExpectancy: 90,
            expenses: {
                housing: 0,
                monthly: 0,
                annual: 0
            }
        },
        incomeSources: [],
        projection: {
            results: [
                {
                    age: 53,
                    income: 50000,
                    totalIncome: 50000,
                    expenses: 0,
                    surplus: 50000,
                    breakdown: {},
                    expenseBreakdown: {
                        housing: 0,
                        essential: 0
                    },
                    portfolios: {}
                }
            ],
            cumulativeShortfall: 0
        },
        assumedInflationRate: 0.03
    });

    assert(
        vulnerability.primaryRisk === null,
        "Zero-severity vulnerability scenarios should not produce a fake primary risk"
    );
    assert(
        vulnerability.risks.length === 0,
        "Zero-severity vulnerability scenarios should not produce ranked risks"
    );

    logResult("Zero-housing vulnerability guard passed");
}

function testReadinessScoreUsesRetirementYearsOnly() {
    const results = [
        {
            age: 45,
            income: 120000,
            expenses: 60000,
            portfolios: {
                "401k": 0
            }
        },
        {
            age: 46,
            income: 125000,
            expenses: 61000,
            portfolios: {
                "401k": 0
            }
        },
        {
            age: 53,
            income: 42000,
            expenses: 50000,
            expenseBreakdown: {
                essential: 40000
            },
            portfolios: {
                "401k": 0
            }
        },
        {
            age: 54,
            income: 52000,
            expenses: 50000,
            expenseBreakdown: {
                essential: 40000
            },
            portfolios: {
                "401k": 0
            }
        }
    ];

    const readiness = calculateReadinessScore(results, 53);

    assert(
        Math.round(readiness.breakdown.coverageScore || 0) === 15,
        "Readiness score should only count retirement years for income coverage"
    );
    assert(
        Math.round(readiness.breakdown.essentialScore || 0) === 20,
        "Readiness score should grant full essential coverage when retirement income covers essentials"
    );
    assert(
        Math.round(readiness.breakdown.longevityScore || 0) === 25,
        "Readiness score should not treat absent portfolios as depleted assets"
    );

    logResult("Readiness score retirement-year guard passed");
}

function testRecommendedRetirementAgeDoesNotGoBelowCurrentAge() {
    const comparison = compareRetirementAges({
        inputs: {
            profile: {
                currentAge: 58
            },
            retireAge: 58,
            lifeExpectancy: 90,
            pension: {
                serviceYears: 25,
                finalAverageSalary: 110000,
                cola: 0.02,
                benefitEnhancement: "tiered_multiplier",
                survivorOption: "none",
                survivorAge: null
            },
            expenses: {
                monthly: 0,
                annual: 0
            },
            assumptions: {
                inflationRate: 0.03
            }
        },
        incomeSources: []
    });

    assert(comparison.scenarios.length > 0, "Retirement comparison produced no scenarios");
    assert(
        comparison.scenarios.every(scenario => scenario.age >= 58),
        "Retirement comparison should not evaluate ages below the user's current age"
    );

    if (comparison.earliestSustainableAge !== null) {
        assert(
            comparison.earliestSustainableAge >= 58,
            "Earliest sustainable age should not be below the user's current age"
        );
    }

    if (comparison.financialFreedomAge !== null) {
        assert(
            comparison.financialFreedomAge >= 58,
            "Financial freedom age should not be below the user's current age"
        );
    }

    if (comparison.recommendedRetirementAge !== null) {
        assert(
            comparison.recommendedRetirementAge >= 58,
            "Recommended retirement age should not be below the user's current age"
        );
    }

    logResult("Retirement recommendation current-age floor passed");
}

function testDashboardRecommendationConsistency() {
    const analysis = {
        recommendedRetirementAge: null,
        financialFreedomAge: 55,
        earliestRetirementAge: 54,
        retirementFailureAge: null,
        assetDepletionAge: null
    };
    const vulnerabilityAnalysis = {
        primaryRisk: {
            id: "withdrawal_dependency_risk",
            label: "Withdrawal Dependency Risk"
        }
    };
    const results = [
        { age: 55, income: 95000, expenses: 82000 },
        { age: 56, income: 97000, expenses: 83000 },
        { age: 57, income: 99000, expenses: 84500 }
    ];
    const displayedAge =
        getDisplayedRecommendationAge(analysis, 55);
    const recommendationContent = buildRecommendationContent({
        retireAge: 55,
        analysis,
        vulnerabilityAnalysis,
        results
    });
    const recommendationSummary =
        buildRecommendedAgeSummary({
            retireAge: 55,
            analysis
        });
    const planningLever = buildPlanningLeverContent({
        retireAge: 55,
        analysis,
        vulnerabilityAnalysis,
        avgMargin: 15000,
        retirementYear: {
            income: 95000,
            expenses: 82000
        }
    });

    assert(
        displayedAge === 55,
        "Dashboard recommendation fallback should use financial freedom age when strict recommendation is unavailable"
    );
    assert(
        recommendationContent.headline.includes("55") &&
        recommendationContent.shortText.includes("planned portfolio withdrawals") &&
        recommendationContent.narrative.includes("planned portfolio withdrawals"),
        "Dashboard recommendation copy should stay consistent for withdrawal-dependent plans"
    );
    assert(
        !recommendationContent.shortText.includes("Not Achievable") &&
        !recommendationSummary.includes("Not Achievable"),
        "Dashboard recommendation copy should not regress to misleading failure wording for workable plans"
    );
    assert(
        planningLever.headline.toLowerCase().includes("portfolio dependence"),
        "Dashboard planning lever should align with the primary withdrawal-dependence risk"
    );

    logResult("Dashboard recommendation consistency passed");
}

function testRetirementAgeComparisonMonotonicity() {
    const baseInputs = {
        profile: {
            currentAge: 45,
            birthYear: 1981
        },
        retireAge: 53,
        lifetimeValueAge: 90,
        pension: {
            leoffStartYear: 2001,
            finalAverageSalary: 110000,
            cola: 0.02,
            benefitEnhancement: "tiered_multiplier",
            survivorOption: "none",
            survivorAge: null
        },
        socialSecurity: {
            birthYear: 1981,
            claimAge: 67,
            cola: 0,
            fraBenefit: 0
        }
    };
    const rows =
        [53, 55, 57, 60]
            .map(age => buildRetirementComparisonScenario(age, baseInputs));
    const enrichedRows = enrichComparisonRows(rows, baseInputs);

    for (let index = 1; index < enrichedRows.length; index += 1) {
        const previous = enrichedRows[index - 1];
        const current = enrichedRows[index];

        assert(
            current.serviceYears >= previous.serviceYears,
            "Retirement age comparison should not lose service credit at later retirement ages"
        );
        assert(
            current.annualPension >= previous.annualPension,
            "Retirement age comparison should not lower annual pension at later retirement ages"
        );
        assert(
            current.bridgeYears <= previous.bridgeYears,
            "Retirement age comparison should not increase Social Security bridge years at later retirement ages"
        );
    }

    logResult("Retirement age comparison monotonicity passed");
}

function testSurvivorEstimatorOrdering() {
    const optionResults = estimateSurvivorOptions({
        retirementAge: 53,
        serviceYears: 25,
        finalAverageSalary: 144000,
        colaRate: 0.02,
        benefitEnhancement: "tiered_multiplier",
        spouseAge: 48,
        survivorYearsAfterDeath: 10
    });
    const singleLife = optionResults.find(option => option.key === "SINGLE");
    const joint50 = optionResults.find(option => option.key === "JOINT_50");
    const joint66 = optionResults.find(option => option.key === "JOINT_66");
    const joint100 = optionResults.find(option => option.key === "JOINT_100");

    assert(
        singleLife &&
        joint50 &&
        joint66 &&
        joint100,
        "Survivor estimator should return all expected survivor options"
    );
    assert(
        singleLife.monthlyBenefit > joint50.monthlyBenefit &&
        joint50.monthlyBenefit > joint66.monthlyBenefit &&
        joint66.monthlyBenefit > joint100.monthlyBenefit,
        "Survivor estimator retiree income ordering should be Single > 50% > 66.67% > 100%"
    );
    assert(
        singleLife.survivorMonthlyBenefit < joint50.survivorMonthlyBenefit &&
        joint50.survivorMonthlyBenefit < joint66.survivorMonthlyBenefit &&
        joint66.survivorMonthlyBenefit < joint100.survivorMonthlyBenefit,
        "Survivor estimator survivor income ordering should increase with stronger survivor protection"
    );
    assert(
        singleLife.reductionApplied < joint50.reductionApplied &&
        joint50.reductionApplied < joint66.reductionApplied &&
        joint66.reductionApplied < joint100.reductionApplied,
        "Survivor estimator reduction ordering should increase with stronger survivor protection"
    );

    logResult("Survivor estimator ordering passed");
}

function buildDashboardVerificationInputs() {
    return {
        profile: {
            currentAge: 52
        },
        retireAge: 55,
        lifeExpectancy: 92,
        pension: {
            serviceYears: 28,
            finalAverageSalary: 132000,
            currentAnnualPay: 128000,
            cola: 0.02,
            benefitEnhancement: "tiered_multiplier",
            survivorOption: "none",
            survivorAge: null
        },
        socialSecurity: {
            birthYear: 1974,
            claimAge: 67,
            cola: 0.02,
            mode: "fraBenefit",
            fraBenefit: 24000
        },
        expenses: {
            monthly: 6400,
            annual: 76800,
            essentialMonthly: 4800,
            essentialAnnual: 57600,
            discretionaryMonthly: 1600,
            discretionaryAnnual: 19200,
            housing: 1800,
            groceries: 900,
            bills: 600,
            auto: 500,
            healthcare: 800,
            insurance: 450,
            other: 1350
        },
        assumptions: {
            inflationRate: 0.03,
            goodsServicesInflationRate: 0.03,
            housingInflationRate: 0.035,
            healthcareInflationRate: 0.05
        },
        toggles: {
            showReal: true,
            marketFirst: false
        }
    };
}

function testDashboardAgeOrderIntegrity() {
    const strongInputs = {
        profile: {
            currentAge: 54
        },
        retireAge: 56,
        lifeExpectancy: 90,
        pension: {
            serviceYears: 28,
            finalAverageSalary: 145000,
            cola: 0.02,
            benefitEnhancement: "tiered_multiplier",
            survivorOption: "none",
            survivorAge: null
        },
        socialSecurity: {
            birthYear: 1972,
            claimAge: 67,
            cola: 0.02,
            mode: "fraBenefit",
            fraBenefit: 26000
        },
        expenses: {
            monthly: 3200,
            annual: 38400,
            essentialMonthly: 2600,
            essentialAnnual: 31200,
            discretionaryMonthly: 600,
            discretionaryAnnual: 7200
        },
        assumptions: {
            inflationRate: 0.03,
            goodsServicesInflationRate: 0.03,
            housingInflationRate: 0.03,
            healthcareInflationRate: 0.04
        }
    };
    const strongIncomeSources =
        buildSimulationIncomeSources({
            inputs: strongInputs,
            assetRegistry
        });
    const comparison =
        compareRetirementAges({
            inputs: strongInputs,
            incomeSources: strongIncomeSources
        });
    const displayedAge =
        getDisplayedRecommendationAge(comparison, strongInputs.retireAge);
    const recommendedSummary =
        buildRecommendedAgeSummary({
            retireAge: strongInputs.retireAge,
            analysis: comparison
        });
    const fallbackAnalysis = {
        recommendedRetirementAge: null,
        financialFreedomAge: 58,
        earliestRetirementAge: 57
    };
    const fallbackDisplayedAge =
        getDisplayedRecommendationAge(
            fallbackAnalysis,
            strongInputs.retireAge
        );

    assert(
        comparison.earliestSustainableAge !== null,
        "Dashboard age-order verification should produce an earliest sustainable age"
    );

    if (comparison.financialFreedomAge !== null) {
        assert(
            comparison.earliestSustainableAge <= comparison.financialFreedomAge,
            "Dashboard age ordering should keep earliest sustainable age at or before financial freedom age"
        );
    }

    if (
        comparison.recommendedRetirementAge !== null &&
        comparison.financialFreedomAge !== null
    ) {
        assert(
            comparison.financialFreedomAge <= comparison.recommendedRetirementAge,
            "Dashboard age ordering should keep financial freedom age at or before recommended retirement age"
        );
    }

    assert(
        displayedAge >= strongInputs.profile.currentAge,
        "Dashboard displayed recommendation age should never fall below the user's current age"
    );
    assert(
        recommendedSummary.includes(String(displayedAge)),
        "Dashboard recommended age summary should reference the same displayed retirement age"
    );
    assert(
        fallbackDisplayedAge >= strongInputs.profile.currentAge,
        "Dashboard fallback recommendation age should stay at or above the user's current age"
    );

    logResult("Dashboard age-order integrity passed");
}

function testDashboardReportSectionPopulation() {
    const inputs = buildDashboardVerificationInputs();
    const incomeSources = buildSimulationIncomeSources({
        inputs,
        assetRegistry
    });
    const simulationState = buildSimulationState({
        inputs,
        incomeSources,
        assumptions: inputs.assumptions
    });
    const projection = runProjection(simulationState);
    const analysis = analyzeRetirementPlan({
        inputs,
        incomeSources,
        projection
    });
    const vulnerabilityAnalysis =
        runRetirementVulnerabilityAnalysis({
            inputs,
            incomeSources,
            projection,
            assumedInflationRate:
                inputs?.assumptions?.goodsServicesInflationRate ??
                inputs?.assumptions?.inflationRate ??
                0.03
        });
    const retirementYear =
        projection.results.find(result => result.age === inputs.retireAge) ||
        projection.results[0];
    const expenseSummary =
        buildExpenseBreakdownSummary(retirementYear);
    const taxSnapshot =
        buildTaxSnapshotSummary(retirementYear);
    const topRisks =
        buildTopRiskEntries(vulnerabilityAnalysis);
    const shortfallSummary =
        buildShortfallSummary({
            projection,
            analysis
        });

    assert(
        projection.results.length > 0,
        "Dashboard report verification fixture should produce projection results"
    );
    assert(
        expenseSummary.essential !== "--" &&
        expenseSummary.housing !== "--",
        "Dashboard expense breakdown summary should produce formatted values"
    );
    assert(
        taxSnapshot.narrative &&
        !taxSnapshot.narrative.includes("will appear here once the dashboard finishes loading"),
        "Dashboard tax snapshot summary should replace placeholder copy"
    );
    assert(
        topRisks.length > 0 &&
        topRisks[0].label !== "Loading risks",
        "Dashboard top risk summary should resolve real risk-card data"
    );
    assert(
        shortfallSummary.cumulativeShortfall !== "--" &&
        shortfallSummary.firstDeficitAge !== "--",
        "Dashboard shortfall summary should resolve real report values"
    );
    assert(
        typeof shortfallSummary.worstAnnualDeficit === "string" &&
        shortfallSummary.worstAnnualDeficit.length > 0,
        "Dashboard shortfall summary should provide a worst-deficit label"
    );

    logResult("Dashboard report section population passed");
}

function testToolEdgeCaseValidation() {
    const currentYear = new Date().getFullYear();
    const derivedCurrentAge =
        deriveCurrentAgeFromBirthYear(currentYear - 47);
    const parsedAges =
        parseRetirementAges("49, 53, 53, abc, 55, 71, 60", 52);
    const emptyParsedAges =
        parseRetirementAges("abc, , 48", 52);
    const wideGapOptions =
        estimateSurvivorOptions({
            retirementAge: 53,
            serviceYears: 25,
            finalAverageSalary: 144000,
            colaRate: 0.02,
            benefitEnhancement: "tiered_multiplier",
            spouseAge: 72,
            survivorYearsAfterDeath: 10
        });
    const wideGapSingle =
        wideGapOptions.find(option => option.key === "SINGLE");

    assert(
        wideGapSingle,
        "Survivor estimator edge-case verification should include the single-life option"
    );

    assert(
        derivedCurrentAge === 47,
        "Retirement age comparison should derive the current age from birth year correctly"
    );
    assert(
        JSON.stringify(parsedAges) === JSON.stringify([53, 55, 60]),
        "Retirement age comparison should discard invalid or duplicate ages and respect the current-age floor"
    );
    assert(
        emptyParsedAges.length === 0,
        "Retirement age comparison should return no rows when every requested age is invalid"
    );

    let survivorValidationMessage = "";

    try {
        validateSurvivorEstimatorInputs({
            retirementAge: 53,
            serviceYears: 25,
            finalAverageSalary: 144000,
            colaRate: 0.02,
            benefitEnhancement: "tiered_multiplier",
            spouseAge: 48,
            survivorYearsAfterDeath: 0
        });
    } catch (error) {
        survivorValidationMessage = error.message;
    }

    assert(
        survivorValidationMessage === "Survivor years after death must be at least 1.",
        "Survivor estimator should reject zero survivor years with a clear validation message"
    );

    wideGapOptions.forEach(option => {
        assert(
            Number.isFinite(option.monthlyBenefit) &&
            Number.isFinite(option.survivorMonthlyBenefit) &&
            Number.isFinite(option.reductionApplied),
            "Survivor estimator should keep outputs finite even for unusual spouse age gaps"
        );
        assert(
            option.monthlyBenefit >= 0 &&
            option.survivorMonthlyBenefit >= 0,
            "Survivor estimator should not produce negative benefit values"
        );
        assert(
            option.monthlyBenefit <= wideGapSingle.monthlyBenefit ||
            option.key === "SINGLE",
            "Survivor estimator should not pay more to the retiree than the single-life option"
        );
    });

    logResult("Tool edge-case validation passed");
}

function testMonteCarloEngine() {
    const inputs = buildDashboardVerificationInputs();
    const incomeSources = buildSimulationIncomeSources({
        inputs,
        assetRegistry
    });
    const simulationState = buildSimulationState({
        inputs,
        incomeSources,
        assumptions: inputs.assumptions
    });
    const firstRun = runMonteCarloSimulation({
        simulationState,
        iterations: 40,
        seed: 12345
    });
    const secondRun = runMonteCarloSimulation({
        simulationState,
        iterations: 40,
        seed: 12345
    });
    const wealthStressSimulationState = structuredClone(simulationState);
    wealthStressSimulationState.incomeSources = [
        ...(wealthStressSimulationState.incomeSources || []),
        {
            type: "portfolio",
            name: "Verification Growth Portfolio",
            balance: 500000,
            startAge: inputs.retireAge,
            growthRate: 0.07,
            withdrawalType: "percent",
            withdrawalRate: 0.03,
            taxable: true
        }
    ];
    const exaggeratedRun = runMonteCarloSimulation({
        simulationState: wealthStressSimulationState,
        iterations: 12,
        seed: 9876,
        config: {
            portfolioReturn: {
                mean: 0,
                stdDev: 0,
                min: 0.6,
                max: 0.6,
                fallbackBase: 0.6
            },
            realEstateReturn: {
                mean: 0,
                stdDev: 0,
                min: 0.25,
                max: 0.25,
                fallbackBase: 0.25
            }
        }
    });
    const exaggeratedContent =
        buildMonteCarloContent(exaggeratedRun);

    assert(
        firstRun.iterations === 40 &&
        firstRun.trials.length === 40,
        "Monte Carlo engine should produce one trial summary per iteration"
    );
    assert(
        firstRun.successRate >= 0 &&
        firstRun.successRate <= 1 &&
        firstRun.essentialSuccessRate >= 0 &&
        firstRun.essentialSuccessRate <= 1,
        "Monte Carlo engine success rates should stay within probability bounds"
    );
    assert(
        firstRun.essentialSuccessRate >= firstRun.successRate,
        "Monte Carlo essential-expense coverage rate should never be lower than full-solvency success rate"
    );
    assert(
        JSON.stringify(firstRun) === JSON.stringify(secondRun),
        "Monte Carlo engine should be deterministic for a fixed seed"
    );
    assert(
        firstRun.model === "monte_carlo_regime_v2",
        "Monte Carlo engine should report the upgraded annual-scenario model version"
    );
    assert(
        typeof firstRun.wealthMetricsTrusted === "boolean",
        "Monte Carlo engine should expose whether ending-wealth metrics are trustworthy enough to display"
    );

    firstRun.trials.forEach(trial => {
        assert(
            Number.isFinite(trial.readinessScore),
            "Monte Carlo engine should produce numeric readiness scores for each trial"
        );
        assert(
            Number.isFinite(trial.sampledRates.inflationRate) &&
            trial.sampledRates.inflationRate >= 0 &&
            trial.sampledRates.inflationRate <= 0.08,
            "Monte Carlo engine should keep sampled inflation within configured bounds"
        );
        assert(
            Number.isFinite(trial.sampledRates.healthcareInflationRate) &&
            trial.sampledRates.healthcareInflationRate >= 0.01 &&
            trial.sampledRates.healthcareInflationRate <= 0.12,
            "Monte Carlo engine should keep sampled healthcare inflation within configured bounds"
        );
    });
    assert(
        exaggeratedRun.wealthMetricsTrusted === false,
        "Monte Carlo engine should flag implausibly wide ending-wealth ranges instead of treating them as trustworthy"
    );
    assert(
        exaggeratedContent.medianEndingNetWorth === "Range too wide" &&
        exaggeratedContent.percentile10EndingNetWorth === "Range too wide",
        "Dashboard Monte Carlo copy should suppress wealth values when the engine marks them as unreliable"
    );

    logResult("Monte Carlo engine passed");
}

async function testLiquidAssetModules() {
    await import("../modules/assets/liquidAccounts.js");

    const checkingModule = assetRegistry.get("checkingCash");
    const savingsModule = assetRegistry.get("savings");
    const brokerageModule = assetRegistry.get("brokerage");
    const assetContainer = document.getElementById("assetTypeContainer");

    assert(checkingModule, "Checking / Cash module did not register");
    assert(savingsModule, "Savings / HYSA module did not register");
    assert(brokerageModule, "Taxable Brokerage module did not register");
    assert(assetContainer, "Asset container missing for liquid-asset verification");

    const checkingCard = checkingModule.createCard();
    const savingsCard = savingsModule.createCard();
    const brokerageCard = brokerageModule.createCard();

    assetContainer.appendChild(checkingCard);
    assetContainer.appendChild(savingsCard);
    assetContainer.appendChild(brokerageCard);

    checkingCard.querySelector("#checkingCashLabel").value = "Emergency Fund";
    checkingCard.querySelector("#checkingCashBalance").value = "25000";
    checkingCard.querySelector("#checkingCashRate").value = "2";
    checkingCard.querySelector("#checkingCashWithdrawAge").value = "55";
    checkingCard.querySelector("#checkingCashWithdrawType").value = "amount";
    checkingCard.querySelector("#checkingCashWithdrawValue").value = "12000";

    savingsCard.querySelector("#savingsLabel").value = "HYSA";
    savingsCard.querySelector("#savingsBalance").value = "50000";
    savingsCard.querySelector("#savingsRate").value = "4";
    savingsCard.querySelector("#savingsWithdrawAge").value = "55";
    savingsCard.querySelector("#savingsWithdrawType").value = "amount";
    savingsCard.querySelector("#savingsWithdrawValue").value = "18000";

    brokerageCard.querySelector("#brokerageLabel").value = "Joint Brokerage";
    brokerageCard.querySelector("#brokerageBalance").value = "180000";
    brokerageCard.querySelector("#brokerageRate").value = "7";
    brokerageCard.querySelector("#brokerageWithdrawAge").value = "55";
    brokerageCard.querySelector("#brokerageWithdrawType").value = "percent";
    brokerageCard.querySelector("#brokerageWithdrawValue").value = "4";

    const checkingPayload = checkingModule.getSimulationPayloads();
    const savingsPayload = savingsModule.getSimulationPayloads();
    const brokeragePayload = brokerageModule.getSimulationPayloads();

    assert(
        checkingPayload?.name === "Emergency Fund" &&
        checkingPayload?.withdrawal === 12000 &&
        checkingPayload?.taxable === false,
        "Checking / Cash payload did not match expected values"
    );
    assert(
        savingsPayload?.name === "HYSA" &&
        savingsPayload?.growthRate === 0.04,
        "Savings / HYSA payload did not match expected values"
    );
    assert(
        brokeragePayload?.name === "Joint Brokerage" &&
        brokeragePayload?.withdrawalRate === 0.04,
        "Taxable Brokerage payload did not match expected values"
    );

    checkingCard.remove();
    savingsCard.remove();
    brokerageCard.remove();

    logResult("Liquid asset module payloads passed");
}

function testMultipleRetirementAccountPayloads() {
    const sourceA = {
        type: "portfolio",
        name: "Geoff Roth 401k",
        balance: 100000
    };
    const sourceB = {
        type: "portfolio",
        name: "Spouse Roth 401k",
        balance: 80000
    };

    assert(
        sourceA.name !== sourceB.name,
        "Multiple retirement account labels must stay unique"
    );

    logResult("Multiple retirement account naming passed");
}

function testInputPopulationAndPreviewMetrics() {
    document.getElementById("retireAge").value = "";
    document.getElementById("serviceYears").value = "";
    document.getElementById("expenseHousing").value = "";

    populateSimulatorInputs({
        retireAge: 53,
        lifeExpectancy: 90,
        pension: {
            serviceYears: 25,
            finalAverageSalary: 110000,
            currentAnnualPay: 100000,
            cola: 0.02,
            benefitEnhancement: "lump_sum",
            survivorOption: "50%",
            survivorAge: 50
        },
        socialSecurity: {
            birthYear: 1981,
            claimAge: 67,
            cola: 0.02,
            mode: "benefit62",
            benefit62: 1800
        },
        expenses: {
            housing: 1800,
            groceries: 700,
            bills: 450,
            auto: 500,
            healthcare: 600,
            insurance: 250,
            other: 400
        },
        assumptions: {
            inflationRate: 0.03,
            goodsServicesInflationRate: 0.03,
            housingInflationRate: 0.04,
            healthcareInflationRate: 0.05
        },
        toggles: {
            showReal: true,
            marketFirst: false
        }
    });

    assert(
        document.getElementById("retireAge").value === "53",
        "Shared input population failed for retire age"
    );
    assert(
        document.getElementById("serviceYears").value === "25",
        "Shared input population failed for service years"
    );
    assert(
        document.getElementById("currentAnnualPay").value === "100000",
        "Shared input population failed for current annual pay"
    );
    assert(
        document.getElementById("leoffBenefitEnhancement").value === "lump_sum",
        "Shared input population failed for LEOFF benefit enhancement"
    );
    assert(
        document.getElementById("expenseHousing").value === "1800",
        "Shared input population failed for expenses"
    );
    assert(
        document.getElementById("expenseInsurance").value === "250",
        "Shared input population failed for insurance"
    );
    assert(
        document.getElementById("housingInflation").value === "4",
        "Shared input population failed for housing inflation"
    );
    assert(
        document.getElementById("ssMode").value === "benefit62",
        "Shared input population failed for Social Security mode"
    );
    assert(
        document.getElementById("ssBenefit62").value === "1800",
        "Shared input population failed for Social Security benefit"
    );

    const metrics = getProjectionPreviewMetrics({
        retireAge: 53,
        firstDeficitYear: 55,
        results: [
            {
                age: 45,
                income: 100000,
                totalIncome: 100000,
                expenses: 50000,
                netWorth: 250000
            },
            ...buildSampleResults()
        ]
    });

    assert(metrics.coveragePercent === 120, "Preview metric coverage failed");
    assert(metrics.firstDeficit === 55, "Preview metric deficit failed");

    logResult("Shared UI input/preview helpers passed");
}

function testModuleRestorePlacement() {
    const assetContainer = document.getElementById("assetTypeContainer");
    const debtContainer = document.getElementById("debtTypeContainer");
    const profileContainer = document.getElementById("profileModuleContainer");

    assetRegistry.registerAsset({
        id: "verify-asset",
        name: "Verify Asset",
        type: "asset",
        mount: "assetTypeContainer",
        restoreState() {
            const card = document.createElement("div");
            card.dataset.module = "verify-asset";
            card.textContent = "asset";
            return card;
        }
    });

    assetRegistry.registerAsset({
        id: "verify-debt",
        name: "Verify Debt",
        type: "asset",
        mount: "debtTypeContainer",
        restoreState() {
            const card = document.createElement("div");
            card.dataset.module = "verify-debt";
            card.textContent = "debt";
            return card;
        }
    });

    assetRegistry.registerAsset({
        id: "verify-profile",
        name: "Verify Profile",
        type: "system",
        mount: "profileModuleContainer",
        restoreState() {
            const card = document.createElement("div");
            card.dataset.module = "verify-profile";
            card.textContent = "profile";
            return card;
        }
    });

    assetRegistry.restore({
        "verify-asset": {},
        "verify-debt": {},
        "verify-profile": {}
    });

    assert(assetContainer.children.length === 1, "Asset restore placement failed");
    assert(debtContainer.children.length === 1, "Debt restore placement failed");
    assert(profileContainer.children.length === 1, "Profile restore placement failed");

    logResult("Module restore placement passed");
}

function testMixedModuleRestoreAndSimulation() {
    const assetContainer = document.getElementById("assetTypeContainer");
    const debtContainer = document.getElementById("debtTypeContainer");

    assetContainer.innerHTML = "";
    debtContainer.innerHTML = "";

    assetRegistry.registerAsset({
        id: "verify-mixed-asset",
        name: "Verify Mixed Asset",
        type: "asset",
        mount: "assetTypeContainer",
        restoreState(state) {
            const values = Array.isArray(state) ? state : [state];
            return values.map((value, index) => {
                const card = document.createElement("div");
                card.dataset.module = "verify-mixed-asset";
                card.dataset.index = String(index);
                card.textContent = value.label;
                return card;
            });
        }
    });

    assetRegistry.registerAsset({
        id: "verify-mixed-debt",
        name: "Verify Mixed Debt",
        type: "asset",
        mount: "debtTypeContainer",
        restoreState(state) {
            const card = document.createElement("div");
            card.dataset.module = "verify-mixed-debt";
            card.textContent = state.label;
            return card;
        }
    });

    assetRegistry.restore({
        "verify-mixed-asset": [
            { label: "Brokerage Card" },
            { label: "Rental Card" }
        ],
        "verify-mixed-debt": { label: "Debt Card" }
    });

    assert(
        assetContainer.querySelectorAll('[data-module="verify-mixed-asset"]').length === 2,
        "Mixed-module restore did not place multiple asset cards correctly"
    );
    assert(
        debtContainer.querySelectorAll('[data-module="verify-mixed-debt"]').length === 1,
        "Mixed-module restore did not place debt cards correctly"
    );

    const inputs = {
        retireAge: 53,
        lifeExpectancy: 54,
        pension: {
            serviceYears: 25,
            finalAverageSalary: 110000,
            cola: 0.02,
            benefitEnhancement: "tiered_multiplier",
            survivorOption: "none",
            survivorAge: null
        },
        socialSecurity: {
            claimAge: 67,
            cola: 0.02,
            fraBenefit: 24000
        },
        expenses: {
            monthly: 0,
            annual: 0
        }
    };

    const fakeRegistry = {
        getAll() {
            return [
                {
                    getSimulationPayloads() {
                        return {
                            type: "portfolio",
                            name: "Brokerage",
                            balance: 120000,
                            startAge: 53,
                            growthRate: 0.05,
                            withdrawalType: "amount",
                            withdrawal: 12000,
                            taxable: true
                        };
                    }
                },
                {
                    getSimulationPayloads() {
                        return [
                            {
                                type: "fixed",
                                name: "Rental Income",
                                annualAmount: 18000,
                                startAge: 53,
                                growthRate: 0.02,
                                taxable: true,
                                taxCategory: "ordinary_income"
                            },
                            {
                                type: "expense",
                                name: "Rental Expenses",
                                annualAmount: 3000,
                                startAge: 53,
                                growthRate: 0.02,
                                taxable: false
                            }
                        ];
                    }
                },
                {
                    getSimulationPayloads() {
                        return {
                            type: "expense",
                            name: "Car Loan",
                            annualAmount: 6000,
                            startAge: 53,
                            endAge: 58,
                            growthRate: 0,
                            taxable: false
                        };
                    }
                },
                {
                    getSimulationPayloads() {
                        return {
                            type: "portfolio",
                            name: "Roth IRA",
                            balance: 80000,
                            startAge: 53,
                            growthRate: 0.05,
                            withdrawalType: "amount",
                            withdrawal: 4000,
                            taxable: false,
                            accountType: "roth_ira"
                        };
                    }
                }
            ];
        }
    };

    const incomeSources = buildSimulationIncomeSources({
        inputs,
        assetRegistry: fakeRegistry
    });

    const projection = runProjection(
        buildSimulationState({
            inputs,
            incomeSources
        })
    );

    const firstYear = projection.results[0];

    assert(
        incomeSources.some(source => source.name === "Brokerage"),
        "Mixed-module simulation sources missing brokerage payload"
    );
    assert(
        incomeSources.some(source => source.name === "Rental Income"),
        "Mixed-module simulation sources missing rental payload"
    );
    assert(
        incomeSources.some(source => source.name === "Car Loan" && source.type === "expense"),
        "Mixed-module simulation sources missing debt expense payload"
    );
    assert(
        (firstYear.breakdown["Rental Income"] || 0) > 0,
        "Mixed-module projection did not include rental income in the breakdown"
    );
    assert(
        (firstYear.breakdown["Brokerage"] || 0) > 0,
        "Mixed-module projection did not include brokerage withdrawals in the breakdown"
    );
    assert(
        Math.round(firstYear.expenses || 0) === 9000,
        "Mixed-module projection did not combine debt and rental expenses correctly"
    );
    assert(
        (firstYear.totalIncome || 0) > 30000,
        "Mixed-module projection total income was lower than expected"
    );

    logResult("Mixed module restore and simulation passed");
}

function testCollapsibleCardValidation() {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const cardUi = createCollapsibleCard({
        moduleId: "verify-validation",
        formClass: "verify-validation-form",
        summaryClass: "verify-validation-summary",
        saveSelector: ".save-validation",
        removeSelector: ".remove-validation",
        editButtonClass: "edit-validation",
        validate: ({ form }) => {
            const amount =
                parseFloat(form.querySelector("#validationAmount")?.value || 0);
            return amount > 0
                ? null
                : "Validation message should appear";
        },
        formHTML: `
            <label>Amount</label>
            <input id="validationAmount" type="number" value="0">
            <button class="save-validation">Save</button>
            <button class="remove-validation">Remove</button>
        `,
        buildSummary: () => "saved"
    });

    host.appendChild(cardUi.card);

    cardUi.form.querySelector(".save-validation").click();

    const messageEl =
        cardUi.form.querySelector(".card-validation-message");

    assert(
        messageEl?.textContent === "Validation message should appear",
        "Card validation message did not render"
    );
    assert(
        cardUi.summary.style.display !== "block",
        "Card collapsed even though validation failed"
    );

    cardUi.form.querySelector("#validationAmount").value = "100";
    cardUi.form.querySelector(".save-validation").click();

    assert(
        cardUi.summary.style.display === "block",
        "Card did not collapse after validation passed"
    );

    host.remove();

    logResult("Shared card validation passed");
}

async function runVerification() {
    try {
        await runBrowserSmokeTests();
        await testLiquidAssetModules();
        await testDebtModuleCardFlow();
        testSimulationStateRoundTrip();
        testProjectionChartModes();
        testProjectionChartDatasets();
        testSharedSimulatorHelpers();
        testSocialSecurityCalculation();
        testRetirementAccountTaxTreatment();
        testRetirementAccountRmdProjection();
        testRetirementAccountContributionAccumulation();
        testSplitExpenseInflationProjection();
        testPreRetirementEmploymentIncomeProjection();
        testSpouseIncomeStopsAtSpouseRetirement();
        testRentalIncomeProjectionBreakdown();
        testDebtPayloadConsistency();
        testRetirementVulnerabilityEngine();
        testZeroHousingDoesNotTriggerHousingRisk();
        testReadinessScoreUsesRetirementYearsOnly();
        testRecommendedRetirementAgeDoesNotGoBelowCurrentAge();
        testDashboardRecommendationConsistency();
        testDashboardAgeOrderIntegrity();
        testDashboardReportSectionPopulation();
        testMonteCarloEngine();
        testRetirementAgeComparisonMonotonicity();
        testSurvivorEstimatorOrdering();
        testToolEdgeCaseValidation();
        testMultipleRetirementAccountPayloads();
        testInputPopulationAndPreviewMetrics();
        testModuleRestorePlacement();
        testMixedModuleRestoreAndSimulation();
        testCollapsibleCardValidation();
        logResult("All verification checks passed");
    } catch (error) {
        logResult(`Verification failed: ${error.message}`);
        throw error;
    }
}

document.addEventListener("DOMContentLoaded", runVerification);
