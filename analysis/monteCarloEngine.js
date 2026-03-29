import { runProjection } from "../core/projectionEngine.js";
import { calculateReadinessScore } from "./readinessScore.js";

const DEFAULT_MONTE_CARLO_CONFIG = Object.freeze({
    inflation: Object.freeze({
        mean: 0,
        stdDev: 0.01,
        min: 0,
        max: 0.08,
        fallbackBase: 0.03
    }),
    goodsServicesInflation: Object.freeze({
        mean: 0,
        stdDev: 0.01,
        min: 0,
        max: 0.08,
        fallbackBase: 0.03
    }),
    housingInflation: Object.freeze({
        mean: 0,
        stdDev: 0.012,
        min: 0,
        max: 0.09,
        fallbackBase: 0.035
    }),
    healthcareInflation: Object.freeze({
        mean: 0,
        stdDev: 0.015,
        min: 0.01,
        max: 0.12,
        fallbackBase: 0.05
    }),
    portfolioReturn: Object.freeze({
        mean: 0,
        stdDev: 0.08,
        min: -0.18,
        max: 0.18,
        fallbackBase: 0.05
    }),
    realEstateReturn: Object.freeze({
        mean: 0,
        stdDev: 0.035,
        min: -0.1,
        max: 0.1,
        fallbackBase: 0.03
    }),
    stressAdjustments: Object.freeze({
        earlyRetirementShockYears: 0,
        earlyRetirementShockRate: 0
    })
});

function mergeMonteCarloConfig(config = {}) {
    const nextConfig = config || {};

    return Object.fromEntries(
        Object.entries(DEFAULT_MONTE_CARLO_CONFIG).map(([key, value]) => {
            const override = nextConfig?.[key];

            if (
                value &&
                typeof value === "object" &&
                !Array.isArray(value)
            ) {
                return [
                    key,
                    {
                        ...value,
                        ...(override && typeof override === "object"
                            ? override
                            : {})
                    }
                ];
            }

            return [key, override ?? value];
        })
    );
}

function normalizeSeed(seed) {
    const normalized =
        Number.isFinite(seed)
            ? Math.floor(Math.abs(seed))
            : Date.now();

    return (normalized >>> 0) || 1;
}

function createSeededRandom(seed) {
    let state = normalizeSeed(seed);

    return function nextRandom() {
        state = ((1664525 * state) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function sampleStandardNormal(random) {
    let u = 0;
    let v = 0;

    while (u === 0) {
        u = random();
    }

    while (v === 0) {
        v = random();
    }

    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function sampleRate({
    baseRate,
    profile,
    random
}) {
    const mean = profile?.mean ?? 0;
    const stdDev = profile?.stdDev ?? 0;
    const fallbackBase = profile?.fallbackBase ?? 0;
    const sampledBase =
        Number.isFinite(baseRate)
            ? baseRate
            : fallbackBase;

    if (stdDev <= 0) {
        return clamp(
            sampledBase + mean,
            profile?.min ?? -Infinity,
            profile?.max ?? Infinity
        );
    }

    const shock =
        mean + (sampleStandardNormal(random) * stdDev);

    return clamp(
        sampledBase + shock,
        profile?.min ?? -Infinity,
        profile?.max ?? Infinity
    );
}

function sampleRatePath({
    baseRate,
    profile,
    random,
    years
}) {
    const path = [];

    for (let yearIndex = 0; yearIndex < years; yearIndex += 1) {
        path.push(sampleRate({
            baseRate,
            profile,
            random
        }));
    }

    return path;
}

function average(values = []) {
    if (!values.length) {
        return 0;
    }

    return values.reduce((sum, value) => sum + (value || 0), 0) / values.length;
}

function totalPortfolio(result) {
    if (!result?.portfolios) {
        return 0;
    }

    return Object.values(result.portfolios)
        .reduce((sum, value) => sum + (value || 0), 0);
}

function getRetirementEvaluationYears(results = [], retireAge = null) {
    const retirementYears = (results || [])
        .filter(result => {
            if (retireAge == null) {
                return true;
            }

            return (result?.age ?? retireAge) >= retireAge;
        });

    return retirementYears.length
        ? retirementYears
        : (results || []);
}

function findFailureAge(results = [], retireAge = null) {
    return getRetirementEvaluationYears(results, retireAge)
        .find(result => (result?.income || 0) < (result?.expenses || 0))
        ?.age ?? null;
}

function findAssetDepletionAge(results = [], retireAge = null) {
    let hadPositivePortfolio = false;

    for (const result of getRetirementEvaluationYears(results, retireAge)) {
        const total = totalPortfolio(result);

        if (total > 0) {
            hadPositivePortfolio = true;
        }

        if (hadPositivePortfolio && total <= 0) {
            return result?.age ?? null;
        }
    }

    return null;
}

function getEndingNetWorth(results = []) {
    return results[results.length - 1]?.netWorth || 0;
}

function buildNetWorthPath(results = []) {
    return (results || []).map(result => result?.netWorth || 0);
}

function buildAgePath(results = []) {
    return (results || []).map(result => result?.age ?? null);
}

function computeCoverageRate(results = [], retireAge = null) {
    const evaluationYears =
        getRetirementEvaluationYears(results, retireAge);

    if (!evaluationYears.length) {
        return 0;
    }

    return evaluationYears.filter(result => {
        return (result?.income || 0) >= (result?.expenses || 0);
    }).length / evaluationYears.length;
}

function computeEssentialCoverageRate(results = [], retireAge = null) {
    const evaluationYears =
        getRetirementEvaluationYears(results, retireAge);

    if (!evaluationYears.length) {
        return 0;
    }

    return evaluationYears.filter(result => {
        const essentialExpenses =
            result?.expenseBreakdown?.essential ??
            result?.expenses ??
            0;

        return (result?.income || 0) >= essentialExpenses;
    }).length / evaluationYears.length;
}

function computePercentile(values = [], percentile = 0.5) {
    if (!values.length) {
        return null;
    }

    const sorted = [...values].sort((left, right) => left - right);
    const position =
        clamp(percentile, 0, 1) * (sorted.length - 1);
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    const lowerValue = sorted[lowerIndex];
    const upperValue = sorted[upperIndex];

    if (lowerIndex === upperIndex) {
        return lowerValue;
    }

    const progress = position - lowerIndex;
    return lowerValue + ((upperValue - lowerValue) * progress);
}

function computeMedianAge(values = []) {
    const numericValues =
        values.filter(value => Number.isFinite(value));

    if (!numericValues.length) {
        return null;
    }

    return Math.round(
        computePercentile(numericValues, 0.5)
    );
}

function getProjectionYearCount(simulationState = {}) {
    const profile = simulationState?.profile || {};
    const currentAge =
        profile?.currentAge ??
        profile?.retirementAge ??
        simulationState?.retireAge ??
        0;
    const lifeExpectancy =
        profile?.lifeExpectancy ??
        simulationState?.lifeExpectancy ??
        currentAge;

    return Math.max(
        1,
        Math.floor((lifeExpectancy || currentAge) - currentAge) + 1
    );
}

function getStartingNetWorth(simulationState = {}) {
    const sources = simulationState?.incomeSources || [];

    return sources.reduce((sum, source) => {
        if (source?.type === "portfolio") {
            return sum + (source?.balance || 0);
        }

        if (source?.type === "real_estate") {
            return sum + (source?.value || 0) - (source?.mortgage?.balance || 0);
        }

        return sum;
    }, 0);
}

function buildTrialSimulationState({
    simulationState,
    sampledRates
}) {
    const nextState = structuredClone(simulationState || {});
    const assumptions = nextState.assumptions || {};

    nextState.assumptions = {
        ...assumptions,
        inflationRate: sampledRates.inflationRate,
        inflationPath: sampledRates.inflationPath,
        goodsServicesInflationRate: sampledRates.goodsServicesInflationRate,
        goodsServicesInflationPath: sampledRates.goodsServicesInflationPath,
        housingInflationRate: sampledRates.housingInflationRate,
        housingInflationPath: sampledRates.housingInflationPath,
        healthcareInflationRate: sampledRates.healthcareInflationRate,
        healthcareInflationPath: sampledRates.healthcareInflationPath
    };

    nextState.expenses = {
        ...(nextState.expenses || {}),
        inflationRate: sampledRates.inflationRate
    };
    nextState.showReal = true;
    nextState.toggles = {
        ...(nextState.toggles || {}),
        showReal: true
    };

    nextState.incomeSources =
        (nextState.incomeSources || []).map(source => {
            if (source?.type === "portfolio") {
                return {
                    ...source,
                    growthRatePath:
                        sampledRates.portfolioReturnPaths[source.name] || []
                };
            }

            if (source?.type === "real_estate") {
                return {
                    ...source,
                    growthRatePath:
                        sampledRates.realEstateReturnPaths[source.name] || []
                };
            }

            return source;
        });

    return nextState;
}

function buildSampledRates({
    simulationState,
    config,
    random
}) {
    const assumptions = simulationState?.assumptions || {};
    const years = getProjectionYearCount(simulationState);
    const incomeSources = simulationState?.incomeSources || [];
    const inflationPath = sampleRatePath({
        baseRate: assumptions.inflationRate,
        profile: config.inflation,
        random,
        years
    });
    const goodsServicesInflationPath = sampleRatePath({
        baseRate:
            assumptions.goodsServicesInflationRate ??
            assumptions.inflationRate,
        profile: config.goodsServicesInflation,
        random,
        years
    });
    const housingInflationPath = sampleRatePath({
        baseRate:
            assumptions.housingInflationRate ??
            assumptions.inflationRate,
        profile: config.housingInflation,
        random,
        years
    });
    const healthcareInflationPath = sampleRatePath({
        baseRate:
            assumptions.healthcareInflationRate ??
            assumptions.inflationRate,
        profile: config.healthcareInflation,
        random,
        years
    });
    const portfolioReturnPaths = {};
    const realEstateReturnPaths = {};

    incomeSources.forEach(source => {
        if (source?.type === "portfolio") {
            const portfolioReturnPath = sampleRatePath({
                baseRate: source?.growthRate,
                profile: config.portfolioReturn,
                random,
                years
            });

            const shockYears =
                Math.max(
                    0,
                    Math.round(
                        config?.stressAdjustments?.earlyRetirementShockYears || 0
                    )
                );
            const shockRate =
                Number.isFinite(config?.stressAdjustments?.earlyRetirementShockRate)
                    ? config.stressAdjustments.earlyRetirementShockRate
                    : 0;

            if (shockYears > 0 && shockRate !== 0) {
                for (
                    let index = 0;
                    index < Math.min(shockYears, portfolioReturnPath.length);
                    index += 1
                ) {
                    portfolioReturnPath[index] = clamp(
                        portfolioReturnPath[index] + shockRate,
                        config?.portfolioReturn?.min ?? -Infinity,
                        config?.portfolioReturn?.max ?? Infinity
                    );
                }
            }

            portfolioReturnPaths[source.name] = portfolioReturnPath;
        }

        if (source?.type === "real_estate") {
            realEstateReturnPaths[source.name] = sampleRatePath({
                baseRate: source?.growthRate,
                profile: config.realEstateReturn,
                random,
                years
            });
        }
    });

    return {
        inflationRate: average(inflationPath),
        inflationPath,
        goodsServicesInflationRate: average(goodsServicesInflationPath),
        goodsServicesInflationPath,
        housingInflationRate: average(housingInflationPath),
        housingInflationPath,
        healthcareInflationRate: average(healthcareInflationPath),
        healthcareInflationPath,
        portfolioReturnPaths,
        realEstateReturnPaths
    };
}

function summarizeTrial({
    projection,
    retireAge,
    sampledRates
}) {
    const results = projection?.results || [];
    const readiness = calculateReadinessScore(results, retireAge);
    const failureAge = findFailureAge(results, retireAge);
    const assetDepletionAge = findAssetDepletionAge(results, retireAge);
    const essentialCoverageRate =
        computeEssentialCoverageRate(results, retireAge);
    const coverageRate =
        computeCoverageRate(results, retireAge);

    return {
        success:
            failureAge === null &&
            assetDepletionAge === null,
        essentialSuccess:
            essentialCoverageRate === 1 &&
            assetDepletionAge === null,
        readinessScore: readiness.score,
        failureAge,
        assetDepletionAge,
        cumulativeShortfall: projection?.cumulativeShortfall || 0,
        endingNetWorth: getEndingNetWorth(results),
        coverageRate,
        essentialCoverageRate,
        agePath: buildAgePath(results),
        netWorthPath: buildNetWorthPath(results),
        sampledRates: {
            inflationRate: sampledRates.inflationRate,
            goodsServicesInflationRate:
                sampledRates.goodsServicesInflationRate,
            housingInflationRate: sampledRates.housingInflationRate,
            healthcareInflationRate:
                sampledRates.healthcareInflationRate
        }
    };
}

function buildRepresentativeCase(trialSummary = {}, pathLength = 0) {
    return {
        endingNetWorth: trialSummary?.endingNetWorth || 0,
        failureAge: trialSummary?.failureAge ?? null,
        assetDepletionAge: trialSummary?.assetDepletionAge ?? null,
        success: Boolean(trialSummary?.success),
        netWorthPath: (trialSummary?.netWorthPath || []).slice(0, pathLength)
    };
}

function buildProjectionPaths(trialSummaries = []) {
    const pathTrials = trialSummaries.filter(trial => {
        return Array.isArray(trial?.agePath) &&
            Array.isArray(trial?.netWorthPath) &&
            trial.agePath.length > 1 &&
            trial.netWorthPath.length > 1;
    });

    if (!pathTrials.length) {
        return null;
    }

    const pathLength = pathTrials.reduce((smallest, trial) => {
        const trialLength = Math.min(
            trial?.agePath?.length || 0,
            trial?.netWorthPath?.length || 0
        );

        return Math.min(smallest, trialLength);
    }, Infinity);

    if (!Number.isFinite(pathLength) || pathLength < 2) {
        return null;
    }

    const ages = (pathTrials[0]?.agePath || []).slice(0, pathLength);
    const meanNetWorthPath = ages.map((_, index) => {
        const values = pathTrials.map(trial => trial.netWorthPath[index] || 0);
        return average(values);
    });
    const sortedTrials = [...pathTrials].sort((left, right) => {
        return (left?.endingNetWorth || 0) - (right?.endingNetWorth || 0);
    });
    const worstTrial = sortedTrials[0];
    const bestTrial = sortedTrials[sortedTrials.length - 1];

    return {
        ages,
        meanNetWorthPath,
        worstCase: buildRepresentativeCase(worstTrial, pathLength),
        bestCase: buildRepresentativeCase(bestTrial, pathLength)
    };
}

function buildAggregateSummary({
    trialSummaries,
    iterations,
    seed,
    config,
    startingNetWorth
}) {
    const successCount =
        trialSummaries.filter(trial => trial.success).length;
    const essentialSuccessCount =
        trialSummaries.filter(trial => trial.essentialSuccess).length;
    const readinessScores =
        trialSummaries.map(trial => trial.readinessScore);
    const endingNetWorths =
        trialSummaries.map(trial => trial.endingNetWorth);
    const cumulativeShortfalls =
        trialSummaries.map(trial => trial.cumulativeShortfall);
    const failureAges =
        trialSummaries.map(trial => trial.failureAge);
    const depletionAges =
        trialSummaries.map(trial => trial.assetDepletionAge);
    const projectionPaths =
        buildProjectionPaths(trialSummaries);
    const medianEndingNetWorth =
        computePercentile(endingNetWorths, 0.5);
    const wealthMetricsTrusted =
        Number.isFinite(medianEndingNetWorth) &&
        medianEndingNetWorth <= Math.max(25000000, (startingNetWorth || 0) * 15);

    return {
        model: "monte_carlo_regime_v2",
        iterations,
        seed,
        config,
        startingNetWorth,
        wealthMetricsTrusted,
        successCount,
        essentialSuccessCount,
        successRate:
            iterations > 0 ? successCount / iterations : 0,
        essentialSuccessRate:
            iterations > 0 ? essentialSuccessCount / iterations : 0,
        medianReadinessScore:
            computePercentile(readinessScores, 0.5),
        percentile10EndingNetWorth:
            computePercentile(endingNetWorths, 0.1),
        medianEndingNetWorth,
        percentile90EndingNetWorth:
            computePercentile(endingNetWorths, 0.9),
        medianCumulativeShortfall:
            computePercentile(cumulativeShortfalls, 0.5),
        medianFailureAge:
            computeMedianAge(failureAges),
        medianAssetDepletionAge:
            computeMedianAge(depletionAges),
        projectionPaths,
        trials: trialSummaries.map(trial => ({
            index: trial.index,
            success: trial.success,
            essentialSuccess: trial.essentialSuccess,
            readinessScore: trial.readinessScore,
            failureAge: trial.failureAge,
            assetDepletionAge: trial.assetDepletionAge,
            cumulativeShortfall: trial.cumulativeShortfall,
            endingNetWorth: trial.endingNetWorth,
            coverageRate: trial.coverageRate,
            essentialCoverageRate: trial.essentialCoverageRate,
            sampledRates: trial.sampledRates
        }))
    };
}

export function runMonteCarloSimulation({
    simulationState,
    iterations = 250,
    seed = 42,
    config = {}
} = {}) {
    const safeIterations =
        Math.max(1, Math.floor(iterations || 0));
    const mergedConfig = mergeMonteCarloConfig(config);
    const random = createSeededRandom(seed);
    const startingNetWorth =
        getStartingNetWorth(simulationState);
    const retireAge =
        simulationState?.profile?.retirementAge ??
        simulationState?.pension?.retirementAge ??
        simulationState?.retireAge ??
        null;
    const trialSummaries = [];

    for (let index = 0; index < safeIterations; index += 1) {
        const sampledRates = buildSampledRates({
            simulationState,
            config: mergedConfig,
            random
        });
        const trialState = buildTrialSimulationState({
            simulationState,
            sampledRates
        });
        const projection = runProjection(trialState);

        trialSummaries.push({
            index,
            ...summarizeTrial({
                projection,
                retireAge,
                sampledRates
            })
        });
    }

    return buildAggregateSummary({
        trialSummaries,
        iterations: safeIterations,
        seed,
        config: mergedConfig,
        startingNetWorth
    });
}

export { DEFAULT_MONTE_CARLO_CONFIG };
