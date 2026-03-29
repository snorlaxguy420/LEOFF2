function formatCurrency(value) {
    const absolute = Math.abs(Math.round(value || 0)).toLocaleString();

    return `${value < 0 ? "-" : ""}$${absolute}`;
}

function formatYear(value) {
    return Number.isFinite(value)
        ? String(value)
        : "-";
}

function totalPortfolio(result) {
    if (!result?.portfolios) {
        return 0;
    }

    return Object.values(result.portfolios)
        .reduce((sum, value) => sum + (value || 0), 0);
}

function hasRealEstateExposure(results = [], incomeSources = []) {
    return (
        (results || []).some(result => (result?.realEstateValue || 0) > 0) ||
        (incomeSources || []).some(source => source?.type === "real_estate")
    );
}

function hasRetirementAccounts(incomeSources = []) {
    return (incomeSources || []).some(source =>
        source?.type === "portfolio" &&
        Boolean(source?.accountType)
    );
}

function buildEstateHelpCards({
    currentInputs,
    incomeSources,
    results,
    finalNetWorth
}) {
    const spouse = currentInputs?.profile?.spouse;
    const cards = [
        {
            title: "Core Documents",
            body:
                "Make sure a will, durable power of attorney, and healthcare directive exist and still match the people you trust to act for you."
        }
    ];

    if (hasRetirementAccounts(incomeSources)) {
        cards.push({
            title: "Beneficiary Review",
            body:
                "Retirement accounts usually pass by beneficiary form, not by will. Review primary and contingent beneficiaries so the projected estate actually flows where you expect."
        });
    }

    if (hasRealEstateExposure(results, incomeSources)) {
        cards.push({
            title: "Real Estate Transfer Plan",
            body:
                "Because this plan includes real estate value, review title, mortgage handling, and whether transfer-on-death, trust, or probate planning should be part of the estate plan."
        });
    }

    if (spouse) {
        cards.push({
            title: "Household Coordination",
            body:
                "Spousal survivor choices, beneficiaries, and property ownership should be reviewed together so the household plan and estate plan are not working against each other."
        });
    }

    if ((finalNetWorth || 0) >= 500000 || hasRealEstateExposure(results, incomeSources)) {
        cards.push({
            title: "Professional Help Trigger",
            body:
                "If the projected estate stays material over time, or if real estate and multiple account types are involved, it is worth getting an estate-planning attorney and tax professional to review the transfer path."
        });
    }

    return cards;
}

export function buildEstateProjectionSummary({
    currentInputs = {},
    incomeSources = [],
    projection = {}
} = {}) {
    const results = projection?.results || [];
    const currentAge = currentInputs?.profile?.currentAge ?? null;
    const currentYear = new Date().getFullYear();
    const rows = results.map(result => {
        const age = result?.age ?? null;
        const offset =
            Number.isFinite(currentAge) && Number.isFinite(age)
                ? age - currentAge
                : null;
        const calendarYear =
            Number.isFinite(offset)
                ? currentYear + offset
                : null;

        return {
            age: formatYear(age),
            year: formatYear(calendarYear),
            netWorthValue: result?.netWorth || 0,
            netWorth: formatCurrency(result?.netWorth || 0),
            portfolio: formatCurrency(totalPortfolio(result)),
            realEstate: formatCurrency(result?.realEstateValue || 0),
            debts: formatCurrency(result?.mortgageBalance || 0)
        };
    });

    const finalRow = rows[rows.length - 1] || null;
    const peakRow =
        rows.reduce((best, row) => {
            if (!best || row.netWorthValue > best.netWorthValue) {
                return row;
            }

            return best;
        }, null);
    const firstNegativeRow =
        rows.find(row => row.netWorthValue < 0) || null;
    const helpCards = buildEstateHelpCards({
        currentInputs,
        incomeSources,
        results,
        finalNetWorth: finalRow?.netWorthValue || 0
    });

    return {
        headline: "Expected estate value over life",
        summary:
            finalRow
                ? `This table shows the deterministic expected net worth path for every projected year of life, so you can see what estate value may remain if the current plan plays out as modeled.`
                : "Estate projection data is not available yet.",
        highlights: {
            endOfLifeNetWorth: finalRow?.netWorth || "-",
            peakNetWorth: peakRow?.netWorth || "-",
            peakNetWorthAge: peakRow?.age || "-",
            firstNegativeAge: firstNegativeRow?.age || "None"
        },
        rows,
        helpCards
    };
}
