import { getPensionCalculator } from "../pensions/pensionRegistry.js";

const calculateLEOFF2 = getPensionCalculator("LEOFF2");

const SURVIVOR_OPTIONS = Object.freeze([
    Object.freeze({
        key: "SINGLE",
        label: "Single Life",
        survivorLabel: "0%",
        survivorPercent: 0
    }),
    Object.freeze({
        key: "JOINT_50",
        label: "50% Survivor",
        survivorLabel: "50%",
        survivorPercent: 0.5
    }),
    Object.freeze({
        key: "JOINT_66",
        label: "66.67% Survivor",
        survivorLabel: "66.67%",
        survivorPercent: 2 / 3
    }),
    Object.freeze({
        key: "JOINT_100",
        label: "100% Survivor",
        survivorLabel: "100%",
        survivorPercent: 1
    })
]);

const AGE_GAP_REDUCTION_TABLE = Object.freeze({
    JOINT_50: Object.freeze([
        Object.freeze({ gap: -10, reduction: 0.108892 }),
        Object.freeze({ gap: -5, reduction: 0.091877 }),
        Object.freeze({ gap: 0, reduction: 0.075011 }),
        Object.freeze({ gap: 5, reduction: 0.058884 }),
        Object.freeze({ gap: 10, reduction: 0.044977 })
    ]),
    JOINT_66: Object.freeze([
        Object.freeze({ gap: -10, reduction: 0.140997 }),
        Object.freeze({ gap: -5, reduction: 0.119988 }),
        Object.freeze({ gap: 0, reduction: 0.097943 }),
        Object.freeze({ gap: 5, reduction: 0.07797 }),
        Object.freeze({ gap: 10, reduction: 0.058884 })
    ]),
    JOINT_100: Object.freeze([
        Object.freeze({ gap: -10, reduction: 0.196923 }),
        Object.freeze({ gap: -5, reduction: 0.16896 }),
        Object.freeze({ gap: 0, reduction: 0.139962 }),
        Object.freeze({ gap: 5, reduction: 0.111999 }),
        Object.freeze({ gap: 10, reduction: 0.085959 })
    ])
});

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
    return `${(value * 100).toFixed(1)}%`;
}

function sumGrowingAnnualPayments(annualAmount, growthRate, years) {
    const wholeYears = Math.max(0, Math.round(years || 0));

    if (wholeYears === 0 || annualAmount <= 0) {
        return 0;
    }

    if (!growthRate) {
        return annualAmount * wholeYears;
    }

    return annualAmount * ((Math.pow(1 + growthRate, wholeYears) - 1) / growthRate);
}

function interpolateReduction(optionKey, ageGap) {
    const points = AGE_GAP_REDUCTION_TABLE[optionKey];

    if (!points?.length) {
        return 0;
    }

    if (ageGap <= points[0].gap) {
        return points[0].reduction;
    }

    if (ageGap >= points[points.length - 1].gap) {
        return points[points.length - 1].reduction;
    }

    for (let index = 0; index < points.length - 1; index += 1) {
        const left = points[index];
        const right = points[index + 1];

        if (ageGap >= left.gap && ageGap <= right.gap) {
            const progress = (ageGap - left.gap) / (right.gap - left.gap);
            return left.reduction + ((right.reduction - left.reduction) * progress);
        }
    }

    return points[points.length - 1].reduction;
}

function buildDeathAges(retirementAge) {
    const firstAge = Math.max(55, Math.ceil((retirementAge + 1) / 5) * 5);
    const ages = [];

    for (let age = firstAge; age <= 95; age += 5) {
        ages.push(age);
    }

    if (!ages.length) {
        ages.push(retirementAge + 1);
    }

    return ages;
}

function pickScenarioAges(deathAges) {
    const picks = [];
    const targets = [deathAges[0], 75, 90];

    targets.forEach(target => {
        const closest = deathAges.reduce((best, age) => {
            if (best === null) {
                return age;
            }

            return Math.abs(age - target) < Math.abs(best - target) ? age : best;
        }, null);

        if (!picks.includes(closest)) {
            picks.push(closest);
        }
    });

    return picks;
}

function estimateSurvivorOptions(inputs) {
    const singleLife = calculateLEOFF2({
        serviceYears: inputs.serviceYears,
        retirementAge: inputs.retirementAge,
        finalAverageSalary: inputs.finalAverageSalary,
        colaOverride: inputs.colaRate,
        benefitEnhancement: inputs.benefitEnhancement,
        survivorOption: "SINGLE"
    });
    const ageGap = inputs.spouseAge - inputs.retirementAge;

    return SURVIVOR_OPTIONS.map(option => {
        if (option.key === "SINGLE") {
            return {
                ...option,
                annualBenefit: singleLife.annualBenefit,
                monthlyBenefit: singleLife.monthlyBenefit,
                survivorAnnualBenefit: 0,
                survivorMonthlyBenefit: 0,
                reductionApplied: 0
            };
        }

        const reductionApplied = interpolateReduction(option.key, ageGap);
        const annualBenefit = singleLife.annualBenefit * (1 - reductionApplied);
        const survivorAnnualBenefit = annualBenefit * option.survivorPercent;

        return {
            ...option,
            annualBenefit,
            monthlyBenefit: annualBenefit / 12,
            survivorAnnualBenefit,
            survivorMonthlyBenefit: survivorAnnualBenefit / 12,
            reductionApplied
        };
    });
}

function buildScenarioValues(option, inputs, deathAges) {
    return deathAges.map(deathAge => {
        const retireeYears = Math.max(0, deathAge - inputs.retirementAge);
        return {
            deathAge,
            totalValue:
                sumGrowingAnnualPayments(option.annualBenefit, inputs.colaRate, retireeYears) +
                sumGrowingAnnualPayments(
                    option.survivorAnnualBenefit,
                    inputs.colaRate,
                    inputs.survivorYearsAfterDeath
                )
        };
    });
}

function renderSummaryTable(optionResults) {
    const body = getElement("survivorSummaryTableBody");
    const singleLife = optionResults.find(option => option.key === "SINGLE");
    if (!body) {
        return;
    }

    body.innerHTML = optionResults.map(option => `
        <tr>
            <td>
                <span class="survivor-option-label">${option.label}</span>
                <span class="survivor-option-sub">${option.survivorLabel} survivor benefit</span>
            </td>
            <td>
                <span class="survivor-metric">${formatCurrency(option.monthlyBenefit)}</span>
            </td>
            <td>
                <span class="survivor-metric">${formatCurrency(option.survivorMonthlyBenefit)}</span>
            </td>
            <td>
                <span class="survivor-metric">${formatCurrency((singleLife?.monthlyBenefit || 0) - option.monthlyBenefit)}</span>
                <span class="survivor-submetric ${option.key === "SINGLE" ? "muted" : "warn"}">${option.key === "SINGLE" ? "no give-up" : "less income while alive"}</span>
            </td>
            <td>
                <span class="survivor-metric">${formatPercent(option.reductionApplied)}</span>
                <span class="survivor-submetric muted">estimated vs single life</span>
            </td>
            <td>
                <span class="survivor-metric">${decisionLens(option)}</span>
                <span class="survivor-submetric muted">${decisionDetail(option)}</span>
            </td>
        </tr>
    `).join("");
}

function renderScenarioTable(optionResults, scenarioResults, scenarioAges) {
    const headRow = getElement("survivorScenarioHeadRow");
    const body = getElement("survivorScenarioTableBody");

    if (!headRow || !body) {
        return;
    }

    headRow.innerHTML = `<th>Option</th>${scenarioAges.map(age => `<th>Die at ${age}</th>`).join("")}`;

    body.innerHTML = optionResults.map(option => {
        const optionScenario = scenarioResults.find(result => result.key === option.key);
        const visibleValues = scenarioAges.map(age =>
            optionScenario.values.find(value => value.deathAge === age)
        );

        return `
            <tr>
                <td>
                    <span class="survivor-option-label">${option.label}</span>
                    <span class="survivor-option-sub">${formatCurrency(option.monthlyBenefit)} while alive</span>
                </td>
                ${visibleValues.map(value => `
                    <td>
                        <span class="survivor-metric">${formatCurrency(value.totalValue)}</span>
                        <span class="survivor-submetric">${scenarioLabel(option, value.deathAge, scenarioAges)}</span>
                    </td>
                `).join("")}
            </tr>
        `;
    }).join("");
}

function scenarioLabel(option, deathAge, scenarioAges) {
    const firstAge = scenarioAges[0];
    const lastAge = scenarioAges[scenarioAges.length - 1];
    let phase = "middle-death case";

    if (deathAge === firstAge) {
        phase = "early-death case";
    } else if (deathAge === lastAge) {
        phase = "late-death case";
    }

    if (option.key === "SINGLE") {
        return `${phase}; pension ends`;
    }

    return `${phase}; survivor continues`;
}

function decisionLens(option) {
    if (option.key === "SINGLE") {
        return "Highest now";
    }

    if (option.key === "JOINT_100") {
        return "Max protection";
    }

    if (option.key === "JOINT_66") {
        return "Best balance";
    }

    return "Income-leaning";
}

function decisionDetail(option) {
    if (option.key === "SINGLE") {
        return "best if survivor protection is less important";
    }

    if (option.key === "JOINT_100") {
        return "best if spouse needs the strongest income floor";
    }

    if (option.key === "JOINT_66") {
        return "often the compromise path";
    }

    return "more income now, less survivor coverage";
}

function renderDecisionCards(optionResults) {
    const cards = Array.from(document.querySelectorAll("#survivorDecisionCards .survivor-decision-card"));
    const singleLife = optionResults.find(option => option.key === "SINGLE");
    const fullSurvivor = optionResults.find(option => option.key === "JOINT_100");
    const balanced = optionResults.find(option => option.key === "JOINT_66");

    if (cards.length < 3 || !singleLife || !fullSurvivor || !balanced) {
        return;
    }

    cards[0].querySelector(".survivor-decision-value").textContent =
        `${singleLife.label} (${formatCurrency(singleLife.monthlyBenefit)}/mo)`;
    cards[0].querySelector("p").textContent =
        `This leaves the largest monthly pension in your own check, but nothing continues to a survivor.`;

    cards[1].querySelector(".survivor-decision-value").textContent =
        `${fullSurvivor.label} (${formatCurrency(fullSurvivor.survivorMonthlyBenefit)}/mo)`;
    cards[1].querySelector("p").textContent =
        `This leaves the most monthly income for the surviving spouse after your death.`;

    cards[2].querySelector(".survivor-decision-value").textContent =
        `${balanced.label} (${formatCurrency(balanced.monthlyBenefit)}/mo)`;
    cards[2].querySelector("p").textContent =
        `This is usually the middle ground when you want meaningful survivor protection without giving up as much current income as 100%.`;
}

function buildTakeaway(optionResults, scenarioResults, inputs, deathAges) {
    const singleLife = optionResults.find(option => option.key === "SINGLE");
    const fullSurvivor = optionResults.find(option => option.key === "JOINT_100");
    const balanced = optionResults.find(option => option.key === "JOINT_66");
    const scenarioAges = pickScenarioAges(deathAges);
    const firstScenarioAge = scenarioAges[0];

    const firstScenarioWinner = scenarioResults
        .map(result => ({
            key: result.key,
            label: optionResults.find(option => option.key === result.key)?.label || result.key,
            totalValue: result.values.find(value => value.deathAge === firstScenarioAge)?.totalValue || 0
        }))
        .sort((left, right) => right.totalValue - left.totalValue)[0];

    return `
        Single life pays the most while you are alive at ${formatCurrency(singleLife.monthlyBenefit)} per month.
        The 100% survivor option pays the most to a surviving spouse at ${formatCurrency(fullSurvivor.survivorMonthlyBenefit)} per month.
        If you want a middle-ground choice, 66.67% survivor pays ${formatCurrency(balanced.monthlyBenefit)} per month to you and ${formatCurrency(balanced.survivorMonthlyBenefit)} to the survivor.
        In the earliest death scenario shown here, the strongest household-income result is ${firstScenarioWinner.label}.
    `.replace(/\s+/g, " ").trim();
}

function buildStatus(inputs, ageGap, deathAges) {
    const gapLabel = ageGap === 0
        ? "same age"
        : ageGap > 0
            ? `${ageGap} years older`
            : `${Math.abs(ageGap)} years younger`;

    return `Estimated using a spouse who is ${gapLabel}, with death-age scenarios from ${deathAges[0]} to ${deathAges[deathAges.length - 1]}.`;
}

function buildCopySummary(optionResults, scenarioResults, inputs, deathAges) {
    const scenarioAges = pickScenarioAges(deathAges);
    const lines = [
        "LEOFF Survivor Benefit Estimator",
        "",
        `Retirement age: ${inputs.retirementAge}`,
        `Service years: ${inputs.serviceYears.toFixed(1)}`,
        `Final average salary: ${formatCurrency(inputs.finalAverageSalary)}`,
        `Spouse age: ${inputs.spouseAge}`,
        `Survivor years after death: ${inputs.survivorYearsAfterDeath}`,
        "",
        "Monthly benefit summary:"
    ];

    optionResults.forEach(option => {
        lines.push(
            `${option.label}: ${formatCurrency(option.monthlyBenefit)}/mo while alive, ` +
            `${formatCurrency(option.survivorMonthlyBenefit)}/mo to survivor, ` +
            `${formatPercent(option.reductionApplied)} reduction vs single.`
        );
    });

    lines.push("", `Decision snapshots (survivor needs pension ${inputs.survivorYearsAfterDeath} more years):`);

    scenarioResults.forEach(result => {
        const label = optionResults.find(option => option.key === result.key)?.label || result.key;
        const parts = scenarioAges.map(age => {
            const value = result.values.find(item => item.deathAge === age);
            return `die at ${age}: ${formatCurrency(value?.totalValue || 0)}`;
        });
        lines.push(`${label}: ${parts.join(" | ")}`);
    });

    return lines.join("\n");
}

async function copySummary(text) {
    await navigator.clipboard.writeText(text);
}

function readInputs() {
    return {
        retirementAge: parseNumber("survRetirementAge"),
        serviceYears: parseNumber("survServiceYears"),
        finalAverageSalary: parseNumber("survFas"),
        colaRate: parseNumber("survCola") / 100,
        benefitEnhancement: getElement("survBenefitEnhancement")?.value || "tiered_multiplier",
        spouseAge: parseNumber("survSpouseAge"),
        survivorYearsAfterDeath: parseNumber("survSurvivorYears")
    };
}

function validateInputs(inputs) {
    if (inputs.retirementAge < 50 || inputs.retirementAge > 75) {
        throw new Error("Retirement age must be between 50 and 75.");
    }

    if (inputs.serviceYears <= 0 || inputs.finalAverageSalary <= 0) {
        throw new Error("Service years and final average salary must be greater than zero.");
    }

    if (inputs.spouseAge <= 0) {
        throw new Error("Enter a valid spouse age.");
    }

    if (inputs.survivorYearsAfterDeath <= 0) {
        throw new Error("Survivor years after death must be at least 1.");
    }
}

function runEstimator() {
    const inputs = readInputs();
    validateInputs(inputs);

    const optionResults = estimateSurvivorOptions(inputs);
    const deathAges = buildDeathAges(inputs.retirementAge);
    const scenarioAges = pickScenarioAges(deathAges);
    const scenarioResults = optionResults.map(option => ({
        key: option.key,
        values: buildScenarioValues(option, inputs, deathAges)
    }));
    const ageGap = inputs.spouseAge - inputs.retirementAge;

    renderDecisionCards(optionResults);
    renderSummaryTable(optionResults);
    renderScenarioTable(optionResults, scenarioResults, scenarioAges);

    getElement("survivorTakeaway").textContent =
        buildTakeaway(optionResults, scenarioResults, inputs, deathAges);
    getElement("survivorStatus").textContent =
        buildStatus(inputs, ageGap, deathAges);
    getElement("survivorScenarioCaption").textContent =
        `Three cases: early, middle, and late death, assuming the survivor needs pension income for ${inputs.survivorYearsAfterDeath} more years after your death.`;

    const copyButton = getElement("copySurvivorSummaryBtn");
    copyButton.onclick = async () => {
        await copySummary(buildCopySummary(optionResults, scenarioResults, inputs, deathAges));
        copyButton.textContent = "Copied";
        window.setTimeout(() => {
            copyButton.textContent = "Copy Summary";
        }, 1400);
    };
}

document.addEventListener("DOMContentLoaded", () => {
    const runButton = getElement("runSurvivorEstimatorBtn");
    const printButton = getElement("printSurvivorEstimatorBtn");
    const status = getElement("survivorStatus");

    runButton?.addEventListener("click", () => {
        try {
            runEstimator();
        } catch (error) {
            status.textContent = error.message;
        }
    });

    printButton?.addEventListener("click", () => {
        window.print();
    });

    try {
        runEstimator();
    } catch (error) {
        status.textContent = error.message;
    }
});
