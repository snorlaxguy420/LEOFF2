import { runProjection } from "../core/projectionEngine.js";
import { simulationStateToInputs } from "../core/simulationState.js";
import {
    getPremiumStressPresetLabel,
    normalizePremiumStressTesting
} from "../core/premiumStressTesting.js";
import { calculateReadinessScore } from "./readinessScore.js";

function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
    }).format(value || 0);
}

function formatSignedCurrency(value) {
    if (!Number.isFinite(value)) {
        return "-";
    }

    if (value === 0) {
        return "$0";
    }

    return `${value > 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`;
}

function formatPercentRate(value) {
    return Number.isFinite(value)
        ? `${Math.round(value * 1000) / 10}%`
        : "-";
}

function formatAgeValue(value) {
    return Number.isFinite(value)
        ? String(value)
        : "None";
}

function formatScenarioBenefitEnhancement(value) {
    return value === "lump_sum"
        ? "2% + Lump Sum"
        : "Tiered Multiplier";
}

function formatScenarioSurvivorOption(value) {
    const normalized = String(value || "").toUpperCase();

    if (!value || normalized === "NONE" || normalized === "SINGLE") {
        return "None";
    }

    if (normalized === "JOINT_50" || value === "50%") {
        return "50%";
    }

    if (
        normalized === "JOINT_66" ||
        value === "66%" ||
        value === "66.6%"
    ) {
        return "66%";
    }

    if (normalized === "JOINT_100" || value === "100%") {
        return "100%";
    }

    return String(value);
}

function totalPortfolio(result) {
    if (!result?.portfolios) {
        return 0;
    }

    return Object.values(result.portfolios)
        .reduce((sum, value) => sum + (value || 0), 0);
}

function findRetirementYearResult(results = [], retireAge = null) {
    if (!results.length) {
        return null;
    }

    return results.find(result => {
        if (!Number.isFinite(retireAge)) {
            return true;
        }

        return (result?.age ?? retireAge) >= retireAge;
    }) || results[0];
}

function findFailureAge(results = [], retireAge = null) {
    return (results || []).find(result => {
        if (Number.isFinite(retireAge) && (result?.age ?? retireAge) < retireAge) {
            return false;
        }

        return (result?.income || 0) < (result?.expenses || 0);
    })?.age ?? null;
}

function findAssetDepletionAge(results = [], retireAge = null) {
    let hadPositivePortfolio = false;

    for (const result of (results || [])) {
        if (Number.isFinite(retireAge) && (result?.age ?? retireAge) < retireAge) {
            continue;
        }

        const portfolioTotal = totalPortfolio(result);

        if (portfolioTotal > 0) {
            hadPositivePortfolio = true;
        }

        if (hadPositivePortfolio && portfolioTotal <= 0) {
            return result?.age ?? null;
        }
    }

    return null;
}

function buildFreeMetrics({
    simulationState,
    annualExpenses
}) {
    const profile = simulationState?.profile || {};
    const pension = simulationState?.pension || {};
    const socialSecurity = simulationState?.socialSecurity || {};

    return [
        {
            label: "Retirement Age",
            value: profile.retirementAge ?? pension.retirementAge ?? "-"
        },
        {
            label: "Service Credit",
            value:
                pension.yearsOfService || pension.serviceYears
                    ? `${pension.yearsOfService || pension.serviceYears} yrs`
                    : "-"
        },
        {
            label: "Final Average Salary",
            value:
                pension.finalAverageSalary > 0
                    ? formatCurrency(pension.finalAverageSalary)
                    : "-"
        },
        {
            label: "Annual Expenses",
            value:
                annualExpenses > 0
                    ? formatCurrency(annualExpenses)
                    : "-"
        },
        {
            label: "Benefit Enhancement",
            value: formatScenarioBenefitEnhancement(
                pension.benefitEnhancement
            )
        },
        {
            label: "Survivor Option",
            value: formatScenarioSurvivorOption(
                pension.survivorOption
            )
        },
        {
            label: "SS Claim Age",
            value: socialSecurity.claimAge || "-"
        },
        {
            label: "Housing Inflation",
            value: formatPercentRate(
                simulationState?.assumptions?.housingInflationRate
            )
        }
    ];
}

function buildPremiumSections({
    simulationState,
    workspaceState,
    readiness,
    retirementYearResult,
    annualExpenses,
    failureAge,
    assetDepletionAge
}) {
    const pension = simulationState?.pension || {};
    const socialSecurity = simulationState?.socialSecurity || {};
    const premiumStressTesting =
        normalizePremiumStressTesting(
            workspaceState?.premiumStressTesting || {}
        );
    const stressProfileLabel =
        premiumStressTesting.enabled
            ? (
                premiumStressTesting.preset &&
                premiumStressTesting.preset !== "custom"
                    ? `${getPremiumStressPresetLabel(premiumStressTesting.preset)} pack`
                    : "Custom premium stress"
            )
            : "Standard";
    const retirementMargin =
        (retirementYearResult?.income || 0) -
        (retirementYearResult?.expenses || annualExpenses || 0);

    return [
        {
            title: "Outcomes",
            metrics: [
                {
                    label: "Readiness",
                    value: `${readiness.score} / 100 (${readiness.band || readiness.grade})`
                },
                {
                    label: "Retirement Income",
                    value: formatCurrency(
                        retirementYearResult?.income || 0
                    )
                },
                {
                    label: "Retirement Margin",
                    value: formatSignedCurrency(retirementMargin)
                },
                {
                    label: "Failure Age",
                    value: formatAgeValue(failureAge)
                },
                {
                    label: "Asset Depletion",
                    value: formatAgeValue(assetDepletionAge)
                },
                {
                    label: "Net Worth At Retirement",
                    value: formatCurrency(
                        retirementYearResult?.netWorth || 0
                    )
                }
            ]
        },
        {
            title: "Setup",
            metrics: [
                {
                    label: "Retirement Age",
                    value:
                        simulationState?.profile?.retirementAge ??
                        pension.retirementAge ??
                        "-"
                },
                {
                    label: "Annual Expenses",
                    value:
                        annualExpenses > 0
                            ? formatCurrency(annualExpenses)
                            : "-"
                },
                {
                    label: "Benefit Enhancement",
                    value: formatScenarioBenefitEnhancement(
                        pension.benefitEnhancement
                    )
                },
                {
                    label: "Survivor Option",
                    value: formatScenarioSurvivorOption(
                        pension.survivorOption
                    )
                },
                {
                    label: "SS Claim Age",
                    value: socialSecurity.claimAge || "-"
                },
                {
                    label: "Stress Profile",
                    value: stressProfileLabel
                }
            ]
        }
    ];
}

function buildPremiumComparisonSnapshot({
    readiness,
    retirementYearResult,
    annualExpenses,
    failureAge,
    assetDepletionAge
}) {
    return {
        readinessScore: readiness?.score ?? 0,
        retirementMargin:
            (retirementYearResult?.income || 0) -
            (retirementYearResult?.expenses || annualExpenses || 0),
        failureAge,
        assetDepletionAge,
        retirementNetWorth: retirementYearResult?.netWorth || 0
    };
}

function formatScoreboardAge(value) {
    return Number.isFinite(value)
        ? `Age ${value}`
        : "No failure seen";
}

function pickScoreboardWinner(cards = [], {
    getComparableValue,
    getDisplayValue
}) {
    const rankedCards = cards
        .filter(card => card?.comparisonSnapshot)
        .map(card => ({
            card,
            comparableValue: getComparableValue(card.comparisonSnapshot)
        }))
        .sort((left, right) => right.comparableValue - left.comparableValue);

    if (!rankedCards.length) {
        return null;
    }

    const winner = rankedCards[0].card;

    return {
        winnerName: winner.name,
        value: getDisplayValue(winner.comparisonSnapshot)
    };
}

export function buildScenarioComparisonScoreboard(cards = []) {
    const premiumCards =
        (cards || []).filter(card =>
            card?.premium &&
            card?.comparisonSnapshot
        );

    if (premiumCards.length < 2) {
        return [];
    }

    const scoreboards = [
        {
            label: "Best Readiness",
            winner: pickScoreboardWinner(premiumCards, {
                getComparableValue: snapshot => snapshot.readinessScore ?? -Infinity,
                getDisplayValue: snapshot => `${snapshot.readinessScore} / 100`
            })
        },
        {
            label: "Best Retirement Margin",
            winner: pickScoreboardWinner(premiumCards, {
                getComparableValue: snapshot => snapshot.retirementMargin ?? -Infinity,
                getDisplayValue: snapshot => formatSignedCurrency(snapshot.retirementMargin)
            })
        },
        {
            label: "Strongest Downside Durability",
            winner: pickScoreboardWinner(premiumCards, {
                getComparableValue: snapshot =>
                    Number.isFinite(snapshot.failureAge)
                        ? snapshot.failureAge
                        : Number.POSITIVE_INFINITY,
                getDisplayValue: snapshot => formatScoreboardAge(snapshot.failureAge)
            })
        },
        {
            label: "Best Net Worth At Retirement",
            winner: pickScoreboardWinner(premiumCards, {
                getComparableValue: snapshot => snapshot.retirementNetWorth ?? -Infinity,
                getDisplayValue: snapshot => formatCurrency(snapshot.retirementNetWorth)
            })
        }
    ];

    return scoreboards
        .filter(entry => entry?.winner)
        .map(entry => ({
            label: entry.label,
            winnerName: entry.winner.winnerName,
            value: entry.winner.value
        }));
}

export function buildScenarioComparisonCard({
    name,
    workspaceState = null,
    simulationState = null,
    updatedAt,
    badgeText = "",
    isCurrentWorkspace = false,
    premium = false
} = {}) {
    const safeWorkspaceState = workspaceState || {};
    const safeSimulationState =
        simulationState ||
        safeWorkspaceState?.simulationState ||
        {};
    const annualExpenses =
        safeSimulationState?.expenses?.annual ||
        ((safeSimulationState?.expenses?.monthly || 0) * 12);

    if (!premium) {
        return {
            name,
            badgeText,
            isCurrentWorkspace,
            updatedAt,
            premium: false,
            sections: [
                {
                    title: "Snapshot",
                    metrics: buildFreeMetrics({
                        simulationState: safeSimulationState,
                        annualExpenses
                    })
                }
            ]
        };
    }

    const inputs =
        simulationStateToInputs(safeSimulationState);
    const projection =
        runProjection(safeSimulationState);
    const results = projection?.results || [];
    const retireAge =
        inputs?.retireAge ??
        safeSimulationState?.profile?.retirementAge ??
        safeSimulationState?.pension?.retirementAge ??
        null;

    const readiness =
        calculateReadinessScore(results, retireAge);
    const retirementYearResult =
        findRetirementYearResult(results, retireAge);
    const failureAge =
        findFailureAge(results, retireAge);
    const assetDepletionAge =
        findAssetDepletionAge(results, retireAge);

    return {
        name,
        badgeText,
        isCurrentWorkspace,
        updatedAt,
        premium: true,
        comparisonSnapshot: buildPremiumComparisonSnapshot({
            readiness,
            retirementYearResult,
            annualExpenses,
            failureAge,
            assetDepletionAge
        }),
        sections: buildPremiumSections({
            simulationState: safeSimulationState,
            workspaceState: safeWorkspaceState,
            readiness,
            retirementYearResult,
            annualExpenses,
            failureAge,
            assetDepletionAge
        })
    };
}
