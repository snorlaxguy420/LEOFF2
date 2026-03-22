import { renderChart } from "./chartRenderer.js";
import { renderIncomeTimeline } from "./incomeTimelineRenderer.js";

const BASE_COLOR_BANK = [
    "#1F4D3A",
    "#3F7C85",
    "#B46A3C",
    "#1E2F44",
    "#6A8F6B",
    "#7F5539",
    "#4E6A84",
    "#8C6A4A",
    "#58735C",
    "#C08A4D",
    "#7B5E57",
    "#6F8B95"
];

const NAMED_INCOME_COLORS = {
    "LEOFF Pension": "#1F4D3A",
    "PERS Plan 2 Pension": "#2E5F49",
    "Social Security": "#3F7C85",
    "LEOFF Lump Sum": "#B46A3C",
    "Rental Income": "#6B4F3A",
    "Portfolio Assets": "#1E2F44",
    "Real Estate Value": "#6A8F6B"
};

const ACCOUNT_TYPE_COLORS = {
    "401k": "#606C38",
    "roth_401k": "#7A8F45",
    "traditional_ira": "#8C5E58",
    "roth_ira": "#C08A4D",
    "457b": "#4E6A84",
    "403b": "#7B5E57",
    "401a": "#967259",
    "tsp": "#58735C"
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

function resolveIncomeColor({ name, source }) {
    if (NAMED_INCOME_COLORS[name]) {
        return NAMED_INCOME_COLORS[name];
    }

    if (source?.accountType && ACCOUNT_TYPE_COLORS[source.accountType]) {
        return ACCOUNT_TYPE_COLORS[source.accountType];
    }

    if (source?.taxCategory === "social_security" || name.includes("Social Security")) {
        return "#3F7C85";
    }

    if (name.includes("Pension")) {
        return "#1F4D3A";
    }

    if (name.includes("Lump Sum")) {
        return "#B46A3C";
    }

    if (name.includes("Rental")) {
        return "#6B4F3A";
    }

    return null;
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

    return Object.fromEntries(
        orderedSources.map(({ name, source }, index) => [
            name,
            resolveIncomeColor({ name, source }) ||
            BASE_COLOR_BANK[index] ||
            generateFallbackColor(name)
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
        tooltipId,
        ...preparedDataset.rendererOptions
    });
}
