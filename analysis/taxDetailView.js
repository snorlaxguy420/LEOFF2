function formatCurrency(value) {
    return "$" + Math.round(value || 0).toLocaleString();
}

function formatSignedCurrency(value) {
    const rounded = Math.round(value || 0);

    if (!rounded) {
        return "$0";
    }

    return `${rounded > 0 ? "+" : "-"}$${Math.abs(rounded).toLocaleString()}`;
}

function formatPercent(value) {
    return `${Math.round((value || 0) * 100)}%`;
}

function formatAgeLabel(age) {
    return Number.isFinite(age)
        ? `Age ${age}`
        : "--";
}

function isTaxDeferredRetirementAccount(source = {}) {
    return (
        source?.type === "portfolio" &&
        [
            "401k",
            "403b",
            "401a",
            "tsp",
            "traditional_ira",
            "457b"
        ].includes(source?.accountType)
    );
}

function isPortfolioSource(source = {}) {
    return source?.type === "portfolio";
}

function sumPortfolioDraws(result = {}, incomeSources = []) {
    const breakdown = result?.breakdown || {};

    return (incomeSources || [])
        .filter(isPortfolioSource)
        .reduce((sum, source) => {
            return sum + (breakdown[source.name] || 0);
        }, 0);
}

function sumSocialSecurityIncome(result = {}) {
    return Object.entries(result?.breakdown || {})
        .reduce((sum, [name, value]) => {
            return name.includes("Social Security")
                ? sum + (value || 0)
                : sum;
        }, 0);
}

function findPeakTaxRow(rows = []) {
    return rows.reduce((best, row) => {
        if (!best) {
            return row;
        }

        return (row?.taxes || 0) > (best?.taxes || 0)
            ? row
            : best;
    }, null);
}

function findPeakTaxDragRow(rows = []) {
    return rows.reduce((best, row) => {
        if (!best) {
            return row;
        }

        return (row?.taxDragRatio || 0) > (best?.taxDragRatio || 0)
            ? row
            : best;
    }, null);
}

function findFirstResultAtOrAfterAge(results = [], targetAge = null) {
    if (!Array.isArray(results) || !results.length) {
        return null;
    }

    if (!Number.isFinite(targetAge)) {
        return results[0] || null;
    }

    return results.find(result => (result?.age ?? targetAge) >= targetAge) ||
        results[results.length - 1] ||
        null;
}

function buildRowStatus({
    row,
    retireAge,
    socialSecurityStartAge,
    hasTaxDeferredBalances
}) {
    const status = [];

    if (row?.age === retireAge) {
        status.push("Retirement");
    }

    if (
        Number.isFinite(socialSecurityStartAge) &&
        row?.age === socialSecurityStartAge
    ) {
        status.push("Social Security");
    }

    if (hasTaxDeferredBalances && row?.age === 73) {
        status.push("RMD Watch");
    }

    return status.join(" | ");
}

export function buildTaxDetailView({
    simulationState = {},
    projection = {}
} = {}) {
    const results = projection?.results || [];
    const incomeSources = simulationState?.incomeSources || [];
    const retireAge =
        simulationState?.profile?.retirementAge ??
        simulationState?.pension?.retirementAge ??
        projection?.retireAge ??
        null;

    if (!results.length) {
        return {
            available: false,
            headline: "Premium year-by-year tax detail",
            summary:
                "Run a retirement projection first to unlock year-by-year tax detail.",
            highlights: {},
            rows: [],
            notes: [],
            exportText: ""
        };
    }

    const hasTaxDeferredBalances =
        incomeSources.some(isTaxDeferredRetirementAccount);
    const taxDeferredBalanceAtRetirement =
        incomeSources
            .filter(isTaxDeferredRetirementAccount)
            .reduce((sum, source) => sum + (source?.balance || 0), 0);
    const rowData = results.map(result => {
        const taxes = result?.taxes || 0;
        const totalIncome = result?.income || 0;
        const afterTaxIncome = totalIncome - taxes;
        const taxDragRatio =
            totalIncome > 0
                ? taxes / totalIncome
                : 0;
        const socialSecurityIncome =
            sumSocialSecurityIncome(result);

        return {
            age: result?.age ?? null,
            taxes,
            totalIncome,
            afterTaxIncome,
            taxableIncome: result?.taxableIncome || 0,
            expenses: result?.expenses || 0,
            surplus: result?.surplus || 0,
            portfolioDraws:
                sumPortfolioDraws(result, incomeSources),
            socialSecurityIncome,
            taxDragRatio
        };
    });
    const cumulativeTaxes =
        rowData.reduce((sum, row) => sum + (row?.taxes || 0), 0);
    const retirementYearRow =
        findFirstResultAtOrAfterAge(rowData, retireAge) ||
        rowData[0];
    const peakTaxRow = findPeakTaxRow(rowData) || rowData[0];
    const peakTaxDragRow = findPeakTaxDragRow(rowData) || rowData[0];
    const socialSecurityStartAge =
        rowData.find(row => (row?.socialSecurityIncome || 0) > 0)?.age ??
        null;
    const firstTaxYearAge =
        rowData.find(row => (row?.taxes || 0) > 0)?.age ?? null;
    const exportLines = [
        "LEOFF Helper Premium Tax Detail",
        "",
        `Selected retirement age: ${formatAgeLabel(retireAge)}`,
        `Retirement-year taxes: ${formatCurrency(retirementYearRow?.taxes || 0)}`,
        `Retirement-year taxable income: ${formatCurrency(retirementYearRow?.taxableIncome || 0)}`,
        `Retirement-year tax drag: ${formatPercent(retirementYearRow?.taxDragRatio || 0)}`,
        `Lifetime projected federal taxes: ${formatCurrency(cumulativeTaxes)}`,
        `Peak tax year: ${formatAgeLabel(peakTaxRow?.age)} (${formatCurrency(peakTaxRow?.taxes || 0)})`,
        `Peak tax drag: ${formatAgeLabel(peakTaxDragRow?.age)} (${formatPercent(peakTaxDragRow?.taxDragRatio || 0)})`,
        hasTaxDeferredBalances
            ? `Tax-deferred balances at retirement: ${formatCurrency(taxDeferredBalanceAtRetirement)}`
            : "Tax-deferred balances at retirement: None modeled",
        "",
        "Year-by-year detail:"
    ];

    rowData.forEach(row => {
        exportLines.push(
            [
                formatAgeLabel(row.age),
                `Income ${formatCurrency(row.totalIncome)}`,
                `Portfolio draws ${formatCurrency(row.portfolioDraws)}`,
                `Taxes ${formatCurrency(row.taxes)}`,
                `After-tax income ${formatCurrency(row.afterTaxIncome)}`,
                `Taxable income ${formatCurrency(row.taxableIncome)}`,
                `Tax drag ${formatPercent(row.taxDragRatio)}`,
                `Net margin ${formatSignedCurrency(row.surplus)}`
            ].join(" | ")
        );
    });

    return {
        available: true,
        headline: "Premium year-by-year tax detail",
        summary:
            `The current plan projects about ${formatCurrency(cumulativeTaxes)} of lifetime federal tax across the modeled years. The peak tax year appears at ${formatAgeLabel(peakTaxRow?.age)} and the selected retirement year shows ${formatPercent(retirementYearRow?.taxDragRatio || 0)} tax drag on projected income.`,
        highlights: {
            retirementYearTaxes:
                formatCurrency(retirementYearRow?.taxes || 0),
            lifetimeTaxes:
                formatCurrency(cumulativeTaxes),
            peakTaxYear:
                `${formatAgeLabel(peakTaxRow?.age)} | ${formatCurrency(peakTaxRow?.taxes || 0)}`,
            peakTaxDrag:
                `${formatAgeLabel(peakTaxDragRow?.age)} | ${formatPercent(peakTaxDragRow?.taxDragRatio || 0)}`
        },
        rows: rowData.map(row => ({
            age: formatAgeLabel(row.age),
            totalIncome: formatCurrency(row.totalIncome),
            portfolioDraws:
                row.portfolioDraws > 0
                    ? formatCurrency(row.portfolioDraws)
                    : "Minimal",
            taxes: formatCurrency(row.taxes),
            afterTaxIncome: formatCurrency(row.afterTaxIncome),
            taxableIncome: formatCurrency(row.taxableIncome),
            taxDrag: formatPercent(row.taxDragRatio),
            netMargin: formatSignedCurrency(row.surplus),
            status: buildRowStatus({
                row,
                retireAge,
                socialSecurityStartAge,
                hasTaxDeferredBalances
            }),
            isRetirementYear: row.age === retireAge,
            isPeakTaxYear: row.age === peakTaxRow?.age,
            isPeakTaxDragYear: row.age === peakTaxDragRow?.age
        })),
        notes: [
            {
                label: "First tax year",
                value:
                    Number.isFinite(firstTaxYearAge)
                        ? formatAgeLabel(firstTaxYearAge)
                        : "No taxes projected"
            },
            {
                label: "Social Security starts",
                value:
                    Number.isFinite(socialSecurityStartAge)
                        ? formatAgeLabel(socialSecurityStartAge)
                        : "Not modeled"
            },
            {
                label: "RMD watch",
                value:
                    hasTaxDeferredBalances
                        ? "Age 73+ deserves extra tax planning attention"
                        : "No tax-deferred balances modeled"
            },
            {
                label: "Tax-deferred balances",
                value:
                    hasTaxDeferredBalances
                        ? formatCurrency(taxDeferredBalanceAtRetirement)
                        : "None modeled"
            }
        ],
        exportText: exportLines.join("\n")
    };
}
