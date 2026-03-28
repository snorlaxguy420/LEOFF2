import { getPensionCalculator } from "../pensions/pensionRegistry.js";
import {
    calculateLifetimePensionValue,
    deriveCurrentAgeFromBirthYear,
    deriveServiceYearsForRetirement
} from "./leoff-tool-math.js";

const calculateLEOFF2 = getPensionCalculator("LEOFF2");

function getElement(id) {
    return document.getElementById(id);
}

function parseNumber(id) {
    return Number(getElement(id)?.value || 0);
}

function formatCurrency(value, decimals = 0) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals
    }).format(value || 0);
}

function formatPercent(value) {
    return `${((value || 0) * 100).toFixed(1)}%`;
}

function formatSignedCurrency(value) {
    if (!value) {
        return formatCurrency(0);
    }

    return `${value > 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`;
}

function buildInputsFromDom() {
    return {
        birthYear: parseNumber("lpvBirthYear"),
        retirementAge: parseNumber("lpvRetirementAge"),
        leoffStartYear: parseNumber("lpvLeoffStartYear"),
        finalAverageSalary: parseNumber("lpvFas"),
        colaRate: parseNumber("lpvCola") / 100,
        benefitEnhancement:
            getElement("lpvBenefitEnhancement")?.value || "tiered_multiplier",
        targetAge: parseNumber("lpvTargetAge")
    };
}

export function validateLifetimeValueInputs(inputs) {
    const currentYear = new Date().getFullYear();
    const currentAge = deriveCurrentAgeFromBirthYear(inputs.birthYear);

    if (!inputs.birthYear || inputs.birthYear < 1900 || inputs.birthYear > currentYear) {
        throw new Error("Enter a valid birth year.");
    }

    if (!inputs.retirementAge || inputs.retirementAge < 50 || inputs.retirementAge > 70) {
        throw new Error("Retirement age must be between 50 and 70.");
    }

    if (currentAge && inputs.retirementAge < currentAge) {
        throw new Error("Retirement age cannot be below your current age.");
    }

    if (!inputs.leoffStartYear || inputs.leoffStartYear < 1977 || inputs.leoffStartYear > currentYear) {
        throw new Error("Enter a valid LEOFF start year.");
    }

    if (!inputs.finalAverageSalary || inputs.finalAverageSalary <= 0) {
        throw new Error("Final average salary must be greater than zero.");
    }

    if (inputs.colaRate < 0 || inputs.colaRate > 0.03) {
        throw new Error("Pension COLA must stay between 0% and 3%.");
    }

    if (!inputs.targetAge || inputs.targetAge <= inputs.retirementAge) {
        throw new Error("Target age must be greater than retirement age.");
    }

    if (inputs.targetAge > 100) {
        throw new Error("Target age must be 100 or lower in this tool.");
    }
}

function calculateScenarioCore(inputs) {
    validateLifetimeValueInputs(inputs);

    const currentAge = deriveCurrentAgeFromBirthYear(inputs.birthYear);
    const serviceYears = deriveServiceYearsForRetirement({
        birthYear: inputs.birthYear,
        retirementAge: inputs.retirementAge,
        leoffStartYear: inputs.leoffStartYear
    });

    if (serviceYears <= 0) {
        throw new Error("LEOFF start year must produce positive service credit by retirement.");
    }

    const pensionResult = calculateLEOFF2({
        serviceYears,
        retirementAge: inputs.retirementAge,
        finalAverageSalary: inputs.finalAverageSalary,
        colaOverride: inputs.colaRate,
        benefitEnhancement: inputs.benefitEnhancement,
        survivorOption: "SINGLE"
    });
    const lifetimeValue = calculateLifetimePensionValue(
        pensionResult.annualBenefit,
        inputs.colaRate,
        inputs.retirementAge,
        inputs.targetAge
    );

    return {
        ...inputs,
        currentAge,
        serviceYears,
        monthlyPension: pensionResult.monthlyBenefit,
        annualPension: pensionResult.annualBenefit,
        percentOfFas:
            inputs.finalAverageSalary > 0
                ? pensionResult.annualBenefit / inputs.finalAverageSalary
                : 0,
        payoutYears: Math.max(0, inputs.targetAge - inputs.retirementAge),
        lifetimeValue,
        lumpSumBenefit: pensionResult.lumpSumBenefit,
        combinedValue: lifetimeValue + pensionResult.lumpSumBenefit
    };
}

export function buildLifetimeValueScenario(inputs) {
    const scenario = calculateScenarioCore(inputs);
    const comparisonAge = Math.min(70, scenario.retirementAge + 1);

    if (comparisonAge > scenario.retirementAge) {
        const nextScenario = calculateScenarioCore({
            ...inputs,
            retirementAge: comparisonAge
        });

        return {
            ...scenario,
            nextScenario,
            deltaMonthlyIfWaiting:
                nextScenario.monthlyPension - scenario.monthlyPension,
            deltaLifetimeIfWaiting:
                nextScenario.lifetimeValue - scenario.lifetimeValue
        };
    }

    return {
        ...scenario,
        nextScenario: null,
        deltaMonthlyIfWaiting: 0,
        deltaLifetimeIfWaiting: 0
    };
}

export function buildLifetimeValueMilestones(scenario) {
    const ages = Array.from(
        new Set(
            [
                scenario.retirementAge + 5,
                scenario.retirementAge + 10,
                67,
                75,
                80,
                90,
                scenario.targetAge
            ].filter(age => age > scenario.retirementAge && age <= scenario.targetAge)
        )
    ).sort((left, right) => left - right);

    if (!ages.length) {
        ages.push(scenario.targetAge);
    }

    return ages.map(age => {
        const pensionValue = calculateLifetimePensionValue(
            scenario.annualPension,
            scenario.colaRate,
            scenario.retirementAge,
            age
        );

        return {
            age,
            yearsCollected: age - scenario.retirementAge,
            pensionValue,
            combinedValue: pensionValue + scenario.lumpSumBenefit
        };
    });
}

function buildTakeaway(scenario) {
    const baseSentence =
        `At retirement age ${scenario.retirementAge}, this projects about ` +
        `${formatCurrency(scenario.monthlyPension)} per month, or ` +
        `${formatCurrency(scenario.annualPension)} per year, with roughly ` +
        `${formatCurrency(scenario.lifetimeValue)} paid through age ${scenario.targetAge}.`;
    const lumpSumSentence = scenario.lumpSumBenefit > 0
        ? ` The one-time lump sum would add ${formatCurrency(scenario.lumpSumBenefit)}, bringing the combined value through age ${scenario.targetAge} to about ${formatCurrency(scenario.combinedValue)}.`
        : "";

    if (!scenario.nextScenario) {
        return `${baseSentence}${lumpSumSentence}`;
    }

    return (
        `${baseSentence}${lumpSumSentence} Waiting one more year to ` +
        `${scenario.nextScenario.retirementAge} changes the monthly pension by ` +
        `${formatSignedCurrency(scenario.deltaMonthlyIfWaiting)} and changes the age-${scenario.targetAge} cumulative pension by ` +
        `${formatSignedCurrency(scenario.deltaLifetimeIfWaiting)}.`
    );
}

function buildStatus(scenario) {
    return (
        `Based on ${scenario.serviceYears.toFixed(1)} years of service credit, ` +
        `${formatCurrency(scenario.finalAverageSalary)} final average salary, ` +
        `${formatPercent(scenario.colaRate)} COLA, and ${scenario.payoutYears} pension-payment years through age ${scenario.targetAge}.`
    );
}

function buildSummaryText(scenario, milestoneRows) {
    const lines = [
        "LEOFF Lifetime Pension Value Calculator",
        "",
        `Birth year: ${scenario.birthYear}`,
        `LEOFF start year: ${scenario.leoffStartYear}`,
        `Retirement age: ${scenario.retirementAge}`,
        `Service credit: ${scenario.serviceYears.toFixed(1)} years`,
        `Final average salary: ${formatCurrency(scenario.finalAverageSalary)}`,
        `Benefit enhancement: ${scenario.benefitEnhancement === "lump_sum" ? "2% Pension + Lump Sum" : "Tiered Multiplier"}`,
        `Pension COLA: ${formatPercent(scenario.colaRate)}`,
        `Monthly pension: ${formatCurrency(scenario.monthlyPension)}`,
        `Annual pension: ${formatCurrency(scenario.annualPension)}`,
        `% of FAS: ${formatPercent(scenario.percentOfFas)}`,
        `Lifetime pension value through age ${scenario.targetAge}: ${formatCurrency(scenario.lifetimeValue)}`
    ];

    if (scenario.lumpSumBenefit > 0) {
        lines.push(
            `One-time lump sum at retirement: ${formatCurrency(scenario.lumpSumBenefit)}`
        );
        lines.push(
            `Combined value through age ${scenario.targetAge}: ${formatCurrency(scenario.combinedValue)}`
        );
    }

    if (scenario.nextScenario) {
        lines.push(
            `Wait to age ${scenario.nextScenario.retirementAge}: ` +
            `${formatSignedCurrency(scenario.deltaMonthlyIfWaiting)} per month, ` +
            `${formatSignedCurrency(scenario.deltaLifetimeIfWaiting)} through age ${scenario.targetAge}.`
        );
    }

    lines.push("", "Milestone totals:");

    milestoneRows.forEach(row => {
        const baseLine =
            `Through age ${row.age}: ${formatCurrency(row.pensionValue)} cumulative pension ` +
            `over ${row.yearsCollected} years`;

        lines.push(
            scenario.lumpSumBenefit > 0
                ? `${baseLine}; ${formatCurrency(row.combinedValue)} including lump sum`
                : baseLine
        );
    });

    return lines.join("\n");
}

function renderScenario(scenario) {
    const milestoneRows = buildLifetimeValueMilestones(scenario);
    const takeaway = getElement("lifetimeTakeaway");
    const status = getElement("lifetimeStatus");
    const milestoneBody = getElement("lifetimeMilestoneTableBody");
    const combinedHeader = getElement("lifetimeCombinedColumn");

    if (!takeaway || !status || !milestoneBody || !combinedHeader) {
        return;
    }

    takeaway.textContent = buildTakeaway(scenario);
    status.textContent = buildStatus(scenario);

    const metricValues = {
        lifetimeServiceCredit: `${scenario.serviceYears.toFixed(1)} yrs`,
        lifetimeMonthlyPension: formatCurrency(scenario.monthlyPension),
        lifetimeAnnualPension: formatCurrency(scenario.annualPension),
        lifetimePercentOfFas: formatPercent(scenario.percentOfFas),
        lifetimeValueTarget: formatCurrency(scenario.lifetimeValue),
        lifetimeLumpSum:
            scenario.lumpSumBenefit > 0
                ? formatCurrency(scenario.lumpSumBenefit)
                : "Not selected",
        lifetimeWaitDelta: scenario.nextScenario
            ? `${formatSignedCurrency(scenario.deltaMonthlyIfWaiting)}/mo`
            : "No later age to compare"
    };

    Object.entries(metricValues).forEach(([id, value]) => {
        const element = getElement(id);
        if (element) {
            element.textContent = value;
        }
    });

    combinedHeader.style.display =
        scenario.lumpSumBenefit > 0 ? "" : "none";

    milestoneBody.innerHTML = milestoneRows.map(row => `
        <tr>
            <td><strong>${row.age}</strong></td>
            <td>${row.yearsCollected}</td>
            <td>${formatCurrency(row.pensionValue)}</td>
            <td style="display:${scenario.lumpSumBenefit > 0 ? "" : "none"}">${formatCurrency(row.combinedValue)}</td>
        </tr>
    `).join("");

    window.__lifetimePensionValueSummary =
        buildSummaryText(scenario, milestoneRows);
}

function renderError(message) {
    const takeaway = getElement("lifetimeTakeaway");
    const status = getElement("lifetimeStatus");
    const milestoneBody = getElement("lifetimeMilestoneTableBody");
    const combinedHeader = getElement("lifetimeCombinedColumn");

    if (takeaway) {
        takeaway.textContent = message;
    }

    if (status) {
        status.textContent = "Update the inputs and try again.";
    }

    if (milestoneBody) {
        milestoneBody.innerHTML = `<tr><td colspan="4">${message}</td></tr>`;
    }

    if (combinedHeader) {
        combinedHeader.style.display = "";
    }

    [
        "lifetimeServiceCredit",
        "lifetimeMonthlyPension",
        "lifetimeAnnualPension",
        "lifetimePercentOfFas",
        "lifetimeValueTarget",
        "lifetimeWaitDelta",
        "lifetimeLumpSum"
    ].forEach(id => {
        const element = getElement(id);
        if (element) {
            element.textContent = "-";
        }
    });

    window.__lifetimePensionValueSummary = null;
}

function runCalculator() {
    try {
        const scenario = buildLifetimeValueScenario(buildInputsFromDom());
        renderScenario(scenario);
    } catch (error) {
        renderError(error.message);
    }
}

function copySummary() {
    const summary =
        window.__lifetimePensionValueSummary ||
        "Run the Lifetime Pension Value Calculator first.";

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

if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
        if (!getElement("runLifetimeValueBtn")) {
            return;
        }

        getElement("runLifetimeValueBtn")
            ?.addEventListener("click", runCalculator);
        getElement("copyLifetimeValueSummaryBtn")
            ?.addEventListener("click", copySummary);
        getElement("printLifetimeValueBtn")
            ?.addEventListener("click", () => window.print());

        runCalculator();
    });
}
