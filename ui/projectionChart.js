import { renderChart } from "./chartRenderer.js";
import { renderIncomeTimeline } from "./incomeTimelineRenderer.js";

const BASE_COLOR_BANK = [
    "#1F4D3A",
    "#3F7C85",
    "#B46A3C",
    "#E3D888",
    "#FFEAEE",
    "#1E2F44",
    "#6A8F6B",
    "#C97B63",
    "#87677B",
    "#7F5539",
    "#4E6A84",
    "#8C6A4A",
    "#58735C",
    "#C08A4D",
    "#7B5E57",
    "#6F8B95",
    "#A7B97B"
];

const NAMED_INCOME_COLORS = {
    "LEOFF Pension": "#1F4D3A",
    "PERS Plan 2 Pension": "#2E5F49",
    "TRS Plan 2 Pension": "#58735C",
    "SERS Plan 2 Pension": "#6A8F6B",
    "PSERS Plan 2 Pension": "#4E6A84",
    "WSPRS Plan 2 Pension": "#7F5539",
    "Military Retired Pay": "#606C38",
    "Military Disability Pay": "#8C5E58",
    "Spouse PERS Plan 2 Pension": "#446E56",
    "Spouse TRS Plan 2 Pension": "#6A8F6B",
    "Spouse SERS Plan 2 Pension": "#7FA37F",
    "Spouse PSERS Plan 2 Pension": "#5C7C8A",
    "Spouse WSPRS Plan 2 Pension": "#967259",
    "Spouse Military Retired Pay": "#7B7F45",
    "Spouse Military Disability Pay": "#87677B",
    "Defined Benefit Pension": "#967259",
    "Spouse Pension": "#87677B",
    "Annuity": "#C08A4D",
    "Military Pension": "#4E6A84",
    "Out-of-State Pension": "#6F8B95",
    "Trust Payment": "#8C6A4A",
    "Stable Income": "#7B5E57",
    "Social Security": "#3F7C85",
    "Spouse Social Security": "#5C7C8A",
    "LEOFF Lump Sum": "#B46A3C",
    "Rental Income": "#6B4F3A",
    "Portfolio Assets": "#1E2F44",
    "Real Estate Value": "#6A8F6B",
    "Pre-Retirement Surplus Cash Reserve": "#6A8F6B",
    "Pre-Retirement Surplus Taxable Brokerage": "#B46A3C"
};

const ACCOUNT_TYPE_COLOR_FAMILIES = {
    "401k": ["#606C38", "#E3D888", "#4E6A84", "#FFEAEE", "#C97B63", "#87677B"],
    "roth_401k": ["#A7B97B", "#B46A3C", "#6F8B95", "#E3D888", "#87677B", "#FFEAEE"],
    "traditional_ira": ["#8C5E58", "#E3D888", "#58735C", "#FFEAEE", "#C08A4D", "#87677B"],
    "roth_ira": ["#C08A4D", "#4E6A84", "#E3D888", "#87677B", "#7B5E57", "#FFEAEE"],
    "457b": ["#4E6A84", "#E3D888", "#B46A3C", "#FFEAEE", "#6A8F6B", "#87677B"],
    "403b": ["#7B5E57", "#A7B97B", "#E3D888", "#87677B", "#3F7C85", "#FFEAEE"],
    "401a": ["#967259", "#E3D888", "#58735C", "#FFEAEE", "#C97B63", "#87677B"],
    "tsp": ["#58735C", "#E3D888", "#4E6A84", "#87677B", "#B46A3C", "#FFEAEE"]
};

function hashString(value = "") {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
        hash = value.charCodeAt(index) + ((hash << 5) - hash);
    }

    return Math.abs(hash);
}

function generateFallbackColor(seedLabel) {
    const hue = hashString(seedLabel) % 360;
    return `hsl(${hue}, 48%, 42%)`;
}

function resolveIncomeColorCandidates({ name, source }) {
    if (NAMED_INCOME_COLORS[name]) {
        return [NAMED_INCOME_COLORS[name]];
    }

    if (
        source?.accountType &&
        ACCOUNT_TYPE_COLOR_FAMILIES[source.accountType]
    ) {
        const family =
            ACCOUNT_TYPE_COLOR_FAMILIES[source.accountType];
        const startIndex = hashString(name) % family.length;

        return family.map((_, index) =>
            family[(startIndex + index) % family.length]
        );
    }

    if (source?.taxCategory === "social_security" || name.includes("Social Security")) {
        return ["#3F7C85"];
    }

    if (name.includes("Pension")) {
        return ["#1F4D3A", "#2E5F49", "#58735C"];
    }

    if (name.includes("Lump Sum")) {
        return ["#B46A3C", "#C08A4D", "#8C6A4A"];
    }

    if (name.includes("Rental")) {
        return ["#6B4F3A", "#7B5E57", "#8C6A4A"];
    }

    return [];
}

function pickUniqueColor({
    name,
    source,
    usedColors = new Set(),
    fallbackIndex = 0
}) {
    const preferredColors =
        resolveIncomeColorCandidates({ name, source });
    const fallbackColors = [
        ...BASE_COLOR_BANK,
        generateFallbackColor(name)
    ];
    const candidates = [
        ...preferredColors,
        ...fallbackColors.slice(fallbackIndex),
        ...fallbackColors.slice(0, fallbackIndex)
    ];

    for (const color of candidates) {
        if (!usedColors.has(color)) {
            usedColors.add(color);
            return color;
        }
    }

    const generatedColor = generateFallbackColor(`${name}-${fallbackIndex}`);
    usedColors.add(generatedColor);
    return generatedColor;
}

function collectBreakdownNames(results) {
    const names = new Set();

    (results || []).forEach(result => {
        Object.entries(result?.breakdown || {}).forEach(([name, value]) => {
            if ((value || 0) !== 0) {
                names.add(name);
            }
        });
    });

    return Array.from(names);
}

function buildDefaultIncomeColors({
    dataset,
    results,
    incomeSources = []
}) {
    if (dataset === "assetsOverTime") {
        return {
            "Portfolio Assets": "#1E2F44",
            "Real Estate Value": "#6A8F6B"
        };
    }

    if (dataset === "pensionIncome") {
        return Object.fromEntries(
            collectBreakdownNames(results).map(name => [name, "#1F4D3A"])
        );
    }

    const orderedSources = [];
    const seenNames = new Set();

    incomeSources.forEach(source => {
        if (!source?.name || seenNames.has(source.name)) {
            return;
        }

        seenNames.add(source.name);
        orderedSources.push({
            name: source.name,
            source
        });
    });

    collectBreakdownNames(results).forEach(name => {
        if (!seenNames.has(name)) {
            seenNames.add(name);
            orderedSources.push({
                name,
                source: null
            });
        }
    });

    const usedColors = new Set();

    return Object.fromEntries(
        orderedSources.map(({ name, source }, index) => [
            name,
            pickUniqueColor({
                name,
                source,
                usedColors,
                fallbackIndex: index
            })
        ])
    );
}

function totalPortfolio(result) {
    if (!result?.portfolios) return 0;

    return Object.values(result.portfolios)
        .reduce((sum, value) => sum + (value || 0), 0);
}

function totalAssets(result) {
    return totalPortfolio(result) + (result?.realEstateValue || 0);
}

function buildRecurringSourceSeries(results, source) {
    return (results || []).map(result => {
        const startAge = source.startAge ?? 0;

        if (result.age < startAge) {
            return 0;
        }

        if (source.endAge && result.age > source.endAge) {
            return 0;
        }

        const yearsActive = result.age - startAge;

        return (
            (source.annualAmount || 0) *
            Math.pow(1 + (source.growthRate || 0), yearsActive)
        );
    });
}

function prepareIncomeVsExpenseResults(results, incomeSources = []) {
    if (!Array.isArray(results) || results.length === 0) {
        return {
            results,
            rendererOptions: {}
        };
    }

    const rentalSources = incomeSources.filter(source =>
        source?.name === "Rental Income" &&
        source?.type === "fixed"
    );

    if (rentalSources.length === 0) {
        return {
            results,
            rendererOptions: {}
        };
    }

    const rentalSeries = results.map((_, index) =>
        rentalSources.reduce((sum, source) => {
            const sourceSeries = buildRecurringSourceSeries(results, source);
            return sum + (sourceSeries[index] || 0);
        }, 0)
    );

    const preparedResults = results.map((result, index) => {
        const synthesizedRentalIncome = rentalSeries[index] || 0;
        const existingRentalIncome =
            result.breakdown?.["Rental Income"] || 0;

        if (synthesizedRentalIncome <= existingRentalIncome) {
            return result;
        }

        return {
            ...result,
            breakdown: {
                ...(result.breakdown || {}),
                "Rental Income": synthesizedRentalIncome
            }
        };
    });

    return {
        results: preparedResults,
        rendererOptions: {}
    };
}

function prepareIncomeVsExpenseLineResults(results, incomeSources = []) {
    const basePrepared =
        prepareIncomeVsExpenseResults(results, incomeSources);
    const retirementPortfolioSources =
        (incomeSources || []).filter(source =>
            source?.type === "portfolio" &&
            !!source?.accountType &&
            !!source?.name
        );
    const knownPortfolioNames =
        new Set(retirementPortfolioSources.map(source => source.name));

    if (!retirementPortfolioSources.length) {
        const hasSyntheticSurplusPortfolio =
            (basePrepared.results || []).some(result =>
                Object.keys(result?.portfolios || {}).some(name =>
                    name.startsWith("Pre-Retirement Surplus ")
                )
            );

        if (!hasSyntheticSurplusPortfolio) {
            return basePrepared;
        }
    }

    const syntheticSurplusPortfolioNames = new Set();
    (basePrepared.results || []).forEach(result => {
        Object.keys(result?.portfolios || {}).forEach(name => {
            if (name.startsWith("Pre-Retirement Surplus ")) {
                syntheticSurplusPortfolioNames.add(name);
            }
        });
    });

    if (!retirementPortfolioSources.length && !syntheticSurplusPortfolioNames.size) {
        return basePrepared;
    }

    const preparedResults =
        (basePrepared.results || []).map(result => {
            const portfolioBalances = result?.portfolios || {};
            const nextBreakdown = {
                ...(result?.breakdown || {})
            };

            retirementPortfolioSources.forEach(source => {
                nextBreakdown[source.name] =
                    portfolioBalances[source.name] || 0;
            });

            syntheticSurplusPortfolioNames.forEach(name => {
                if (!knownPortfolioNames.has(name)) {
                    nextBreakdown[name] = portfolioBalances[name] || 0;
                }
            });

            return {
                ...result,
                breakdown: nextBreakdown
            };
        });

    return {
        results: preparedResults,
        rendererOptions: basePrepared.rendererOptions
    };
}

function preparePensionIncomeResults(results, incomeSources = []) {
    const pensionNames = new Set(
        (incomeSources || [])
            .filter(source =>
                source?.name?.includes("Pension")
            )
            .map(source => source.name)
    );

    const transformed = (results || []).map(result => {
        const pensionBreakdownEntries =
            Object.entries(result.breakdown || {})
                .filter(([name]) => pensionNames.has(name));
        const pensionBreakdown =
            Object.fromEntries(pensionBreakdownEntries);
        const totalPensionIncome =
            pensionBreakdownEntries.reduce(
                (sum, [, value]) => sum + (value || 0),
                0
            );

        return {
            ...result,
            income: totalPensionIncome,
            totalIncome: totalPensionIncome,
            expenses: 0,
            breakdown: pensionBreakdown
        };
    });

    return {
        results: transformed,
        rendererOptions: {
            showExpenseSeries: false,
            totalSeriesLabel: "Total Pension",
            totalSeriesColor: "#1F4D3A"
        }
    };
}

function prepareAssetsOverTimeResults(results) {
    const transformed = (results || []).map(result => {
        const portfolioAssets = totalPortfolio(result);
        const realEstateAssets = result?.realEstateValue || 0;
        const totalAssetValue = totalAssets(result);

        return {
            ...result,
            income: totalAssetValue,
            totalIncome: totalAssetValue,
            expenses: 0,
            breakdown: {
                "Portfolio Assets": portfolioAssets,
                "Real Estate Value": realEstateAssets
            }
        };
    });

    return {
        results: transformed,
        rendererOptions: {
            showExpenseSeries: false,
            totalSeriesLabel: "Total Assets",
            totalSeriesColor: "#1E2F44"
        }
    };
}

function buildCompactMobileResults(results) {
    return (results || []).map(result => ({
        ...result,
        breakdown: {
            "Total Income": result.totalIncome || result.income || 0
        }
    }));
}

export function renderProjectionChart({
    canvasId,
    results,
    dataset = "incomeVsExpenses",
    mode = "bar",
    incomeSources = [],
    incomeColors = {},
    expenseColor = "#DB2B39",
    yScaleMultiplier = 1.25,
    compactMobile = false,
    retirementAge = null,
    tooltipId = "tooltip",
    legendId = "timelineLegend"
}) {
    const preparedDataset = (() => {
        if (compactMobile) {
            return {
                results: buildCompactMobileResults(results),
                rendererOptions: {
                    showExpenseSeries: false,
                    totalSeriesLabel: "Total Income"
                }
            };
        }

        if (dataset === "pensionIncome") {
            return preparePensionIncomeResults(results, incomeSources);
        }

        if (dataset === "assetsOverTime") {
            return prepareAssetsOverTimeResults(results);
        }

        if (dataset === "incomeVsExpenses" && mode === "line") {
            return prepareIncomeVsExpenseLineResults(results, incomeSources);
        }

        return prepareIncomeVsExpenseResults(results, incomeSources);
    })();
    const resolvedIncomeColors = {
        ...buildDefaultIncomeColors({
            dataset: compactMobile ? "compactMobile" : dataset,
            results: preparedDataset.results,
            incomeSources
        }),
        ...(incomeColors || {})
    };
    if (mode === "line") {
        renderIncomeTimeline({
            canvasId,
            results: preparedDataset.results,
            incomeColors: resolvedIncomeColors,
            yScaleMultiplier,
            retirementAge,
            tooltipId,
            legendId,
            ...preparedDataset.rendererOptions
        });

        return;
    }

    renderChart({
        canvasId,
        results: preparedDataset.results,
        incomeColors: resolvedIncomeColors,
        expenseColor,
        yScaleMultiplier,
        retirementAge,
        tooltipId,
        ...preparedDataset.rendererOptions
    });
}
