import { buildPensionIncomeSources } from "./simulatorShared.js";
import { calculateSocialSecurityIncomeSource } from "../core/socialSecurityEngine.js";
import {
    calculateLifetimePensionValue,
    deriveCurrentAgeFromBirthYear,
    deriveServiceYearsForRetirement
} from "./leoff-tool-math.js";

function parsePercent(id) {
    return (parseFloat(document.getElementById(id)?.value || 0) || 0) / 100;
}

function parseMoney(id) {
    return parseFloat(document.getElementById(id)?.value || 0) || 0;
}

function parseIntValue(id) {
    return parseInt(document.getElementById(id)?.value || 0, 10) || 0;
}

function parseStringValue(id, fallback = "") {
    return document.getElementById(id)?.value || fallback;
}

export function parseRetirementAges(value, minimumAge = 50) {
    return Array.from(
        new Set(
            String(value || "")
                .split(",")
                .map(part => parseInt(part.trim(), 10))
                .filter(age => Number.isFinite(age) && age >= minimumAge && age <= 70)
        )
    ).sort((a, b) => a - b);
}

function formatMoney(value, maximumFractionDigits = 0) {
    return `$${Math.round(value || 0).toLocaleString(undefined, {
        maximumFractionDigits
    })}`;
}

function formatYears(value) {
    return `${(Math.round((value || 0) * 10) / 10).toFixed(1)} yrs`;
}

function formatPercent(value) {
    return `${((value || 0) * 100).toFixed(1)}%`;
}

function formatSignedMoney(value) {
    const rounded = Math.round(value || 0);

    if (rounded === 0) {
        return "$0";
    }

    return `${rounded > 0 ? "+" : "-"}${formatMoney(Math.abs(rounded))}`;
}

export {
    calculateLifetimePensionValue,
    deriveCurrentAgeFromBirthYear,
    deriveServiceYearsForRetirement
};

export function calculateExtraSalaryEarned({
    baselineAge,
    comparisonAge,
    currentAge,
    currentSalary
}) {
    if (comparisonAge <= baselineAge) {
        return 0;
    }

    return currentSalary * Math.max(0, comparisonAge - baselineAge);
}

function buildBaseInputs() {
    const birthYear = parseIntValue("cmpBirthYear");

    return {
        profile: {
            currentAge: deriveCurrentAgeFromBirthYear(birthYear),
            birthYear
        },
        retireAge: 53,
        lifetimeValueAge: parseIntValue("cmpLifetimeValueAge"),
        pension: {
            leoffStartYear: parseIntValue("cmpLeoffStartYear"),
            finalAverageSalary: parseMoney("cmpFas"),
            cola: parsePercent("cmpCola"),
            benefitEnhancement: parseStringValue("cmpBenefitEnhancement", "tiered_multiplier"),
            survivorOption: "none",
            survivorAge: null
        },
        socialSecurity: {
            birthYear,
            claimAge: parseIntValue("cmpSsClaimAge"),
            cola: 0,
            fraBenefit: 0
        }
    };
}

export function buildScenario(age, baseInputs) {
    const serviceYears = deriveServiceYearsForRetirement({
        birthYear: baseInputs.profile.birthYear,
        retirementAge: age,
        leoffStartYear: baseInputs.pension.leoffStartYear
    });
    const finalAverageSalary = baseInputs.pension.finalAverageSalary;
    const inputs = {
        ...baseInputs,
        retireAge: age,
        pension: {
            ...baseInputs.pension,
            serviceYears,
            finalAverageSalary
        }
    };
    const incomeSources = [
        ...buildPensionIncomeSources({
            inputs,
            retireAge: age
        })
    ];
    const socialSecuritySource =
        calculateSocialSecurityIncomeSource(inputs.socialSecurity);

    if (socialSecuritySource) {
        incomeSources.push(socialSecuritySource);
    }

    const pensionSource =
        incomeSources.find(source => source.name === "LEOFF Pension");
    const annualPension = pensionSource?.annualAmount || 0;
    const bridgeYears = Math.max(0, (inputs.socialSecurity.claimAge || 0) - age);

    return {
        age,
        serviceYears,
        finalAverageSalary,
        percentOfFas: finalAverageSalary > 0 ? annualPension / finalAverageSalary : 0,
        monthlyPension: annualPension / 12,
        annualPension,
        bridgeYears,
        lifetimePensionValue: calculateLifetimePensionValue(
            annualPension,
            baseInputs.pension.cola,
            age,
            baseInputs.lifetimeValueAge
        )
    };
}

export function enrichComparisonRows(rows, baseInputs) {
    const baselineAge = rows[0]?.age;
    const baselineMonthlyPension = rows[0]?.monthlyPension || 0;
    const baselineLifetimeValue = rows[0]?.lifetimePensionValue || 0;

    return rows.map(row => ({
        ...row,
        extraSalaryEarned: calculateExtraSalaryEarned({
            baselineAge,
            comparisonAge: row.age,
            currentAge: baseInputs.profile.currentAge,
            currentSalary: baseInputs.pension.finalAverageSalary
        }),
        deltaMonthlyPension: row.monthlyPension - baselineMonthlyPension,
        deltaLifetimePensionValue: row.lifetimePensionValue - baselineLifetimeValue
    }));
}

function renderComparisonTable(rows, baseInputs) {
    const body = document.getElementById("comparisonTableBody");
    const status = document.getElementById("comparisonStatus");
    const takeaway = document.getElementById("comparisonTakeaway");

    if (!body || !status || !takeaway) return;

    if (!rows.length) {
        body.innerHTML = `<tr><td colspan="10">Enter at least one valid retirement age from your current age through 70.</td></tr>`;
        status.textContent = "No valid ages to compare.";
        takeaway.textContent = "Enter inputs and run the comparison to see the biggest tradeoff.";
        return;
    }

    const baselineAge = rows[0].age;
    const enrichedRows = enrichComparisonRows(rows, baseInputs);

    body.innerHTML = enrichedRows.map(row => `
        <tr>
            <td><strong>${row.age}</strong></td>
            <td>${formatYears(row.serviceYears)}</td>
            <td>${formatMoney(row.finalAverageSalary)}</td>
            <td>
                <span class="comparison-metric">${formatMoney(row.monthlyPension)}</span>
                <span class="comparison-delta ${row.age === baselineAge ? "muted" : ""}">
                    ${row.age === baselineAge ? "Baseline age" : `${formatSignedMoney(row.deltaMonthlyPension)} vs ${baselineAge}`}
                </span>
            </td>
            <td>${formatMoney(row.annualPension)}</td>
            <td>${formatPercent(row.percentOfFas)}</td>
            <td>${row.bridgeYears}</td>
            <td>${formatMoney(row.extraSalaryEarned)}</td>
            <td>
                <span class="comparison-metric">${formatMoney(row.lifetimePensionValue)}</span>
                <span class="comparison-delta ${row.age === baselineAge ? "muted" : ""}">
                    ${row.age === baselineAge ? "Baseline age" : `${formatSignedMoney(row.deltaLifetimePensionValue)} vs ${baselineAge}`}
                </span>
            </td>
        </tr>
    `).join("");

    const bestBridgeAge = enrichedRows.reduce((best, row) => (
        !best || row.bridgeYears < best.bridgeYears ? row : best
    ), null);
    const bestTradeoff = enrichedRows.reduce((best, row) => (
        row.age === baselineAge || !best || row.deltaMonthlyPension > best.deltaMonthlyPension ? row : best
    ), null);

    takeaway.textContent = bestTradeoff && bestTradeoff.age !== baselineAge
        ? `Working to ${bestTradeoff.age} adds about ${formatMoney(bestTradeoff.deltaMonthlyPension)} per month in pension, ${formatMoney(bestTradeoff.extraSalaryEarned)} in extra salary before retirement, and cuts the Social Security bridge to ${bestBridgeAge?.bridgeYears ?? 0} years.`
        : `Age ${baselineAge} is your baseline. Compare later ages to see how much more pension and salary power you gain by waiting.`;

    status.textContent =
        `Comparing ${enrichedRows.length} retirement age options through age ${baseInputs.lifetimeValueAge}.`;
}

function buildComparisonSummary(baseInputs, rows) {
    if (!rows.length) {
        return "No valid retirement ages were available to compare.";
    }

    const baseline = rows[0];
    const strongestLaterOption = rows.reduce((best, row) => (
        row.age === baseline.age || !best || row.deltaMonthlyPension > best.deltaMonthlyPension ? row : best
    ), null);
    const lines = [
        "LEOFF Retirement Age Comparison",
        `Birth year: ${baseInputs.profile.birthYear}`,
        `LEOFF start year: ${baseInputs.pension.leoffStartYear}`,
        `Benefit enhancement: ${baseInputs.pension.benefitEnhancement === "lump_sum" ? "2% Pension + Lump Sum" : "Tiered Multiplier"}`,
        `Final average salary: ${formatMoney(baseInputs.pension.finalAverageSalary)}`,
        `Compared ages: ${rows.map(row => row.age).join(", ")}`
    ];

    if (strongestLaterOption && strongestLaterOption.age !== baseline.age) {
        lines.push(
            "",
            `Key takeaway: working to ${strongestLaterOption.age} instead of ${baseline.age} adds about ` +
            `${formatMoney(strongestLaterOption.deltaMonthlyPension)} per month in pension, ` +
            `${formatMoney(strongestLaterOption.extraSalaryEarned)} in extra salary before retirement, and ` +
            `${formatMoney(strongestLaterOption.deltaLifetimePensionValue)} in lifetime pension value through age ${baseInputs.lifetimeValueAge}.`
        );
    }

    lines.push("", "Detailed comparison:");

    rows.forEach(row => {
        lines.push(
            `Age ${row.age}: ${formatMoney(row.monthlyPension)}/month pension ` +
            `(${formatPercent(row.percentOfFas)} of FAS), ` +
            `${row.bridgeYears} bridge years, ` +
            `${formatMoney(row.extraSalaryEarned)} extra salary earned, ` +
            `${formatMoney(row.lifetimePensionValue)} lifetime pension value`
        );
    });

    return lines.join("\n");
}

function runComparison() {
    const baseInputs = buildBaseInputs();
    const ages = parseRetirementAges(
        document.getElementById("cmpRetirementAges")?.value,
        baseInputs.profile.currentAge
    );
    const rows = ages.map(age => buildScenario(age, baseInputs));
    const enrichedRows = rows.length ? enrichComparisonRows(rows, baseInputs) : rows;

    renderComparisonTable(rows, baseInputs);
    window.__comparisonSummaryText = buildComparisonSummary(baseInputs, enrichedRows);
}

function copyComparisonSummary() {
    const summary = window.__comparisonSummaryText || "Run a comparison first.";

    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(summary);
        return;
    }

    const tempArea = document.createElement("textarea");
    tempArea.value = summary;
    document.body.appendChild(tempArea);
    tempArea.select();
    document.execCommand("copy");
    document.body.removeChild(tempArea);
}

document.addEventListener("DOMContentLoaded", () => {
    document
        .getElementById("runComparisonBtn")
        ?.addEventListener("click", runComparison);
    document
        .getElementById("copyComparisonBtn")
        ?.addEventListener("click", copyComparisonSummary);
    document
        .getElementById("printComparisonBtn")
        ?.addEventListener("click", () => window.print());

    runComparison();
});
