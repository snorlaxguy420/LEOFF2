import CONSTANTS from "../pensions/LEOFF2/leoff2Constants.js";
import { runProjection } from "../core/projectionEngine.js";
import { calculateReadinessScore } from "../analysis/readinessScore.js";
import { buildSimulationState } from "../core/simulationState.js";
import { buildPensionIncomeSources } from "../ui/simulatorShared.js";

/* =========================================================
LEOFF 2 RETIREMENT RECOMMENDATION ENGINE
========================================================= */

export function compareRetirementAges({ inputs, incomeSources }) {

    const pension = inputs?.pension;
    const expenses = inputs?.expenses;

    if (!pension || !expenses) {
        return {
            recommendedAge: null,
            scenarios: []
        };
    }

    const longevityAge = Math.max(inputs.lifeExpectancy || 0, 100);
    const inflationAssumptions = {
        inflationRate:
            inputs?.assumptions?.inflationRate ?? 0.03,
        goodsServicesInflationRate:
            inputs?.assumptions?.goodsServicesInflationRate ??
            inputs?.assumptions?.inflationRate ??
            0.03,
        housingInflationRate:
            inputs?.assumptions?.housingInflationRate ??
            inputs?.assumptions?.inflationRate ??
            0.03,
        healthcareInflationRate:
            inputs?.assumptions?.healthcareInflationRate ??
            inputs?.assumptions?.inflationRate ??
            0.03
    };

    const scenarios = [];
    const currentAge =
        Math.max(
            0,
            Math.ceil(inputs?.profile?.currentAge || 0)
        );
    const minAge = Math.max(50, currentAge);
    const maxAge = Math.max(
        minAge,
        Math.min(
            Math.max(inputs.lifeExpectancy || 70, 70) - 5,
            70
        )
    );

    function totalPortfolio(result) {
        if (!result?.portfolios) return 0;

        return Object.values(result.portfolios)
            .reduce((sum, value) => sum + (value || 0), 0);
    }

    function buildPortfolioIncomeNameSet(sources) {
        return new Set(
            (sources || [])
                .filter(source => source.type === "portfolio")
                .map(source => source.name)
        );
    }

    function getPortfolioIncome(result, portfolioIncomeNames) {
        if (!result?.breakdown) return 0;

        return Object.entries(result.breakdown)
            .reduce((sum, [name, value]) => {
                return portfolioIncomeNames.has(name)
                    ? sum + (value || 0)
                    : sum;
            }, 0);
    }

    function hasPortfolioDepletion(results) {
        let hadPositivePortfolio = false;

        return results.some(result => {
            const total = totalPortfolio(result);

            if (total > 0) {
                hadPositivePortfolio = true;
                return false;
            }

            return hadPositivePortfolio && total <= 0;
        });
    }

    function getEssentialExpenses(result) {
        return result?.expenseBreakdown?.essential ??
            result?.expenses ??
            0;
    }

    for (let age = minAge; age <= maxAge; age++) {
        try {
            const pensionNames = new Set([
                "LEOFF Pension",
                "PERS Plan 2 Pension"
            ]);
            const pensionSources = buildPensionIncomeSources({
                inputs,
                retireAge: age
            });
            const nonPensionSources = (incomeSources || [])
                .filter(source => !pensionNames.has(source.name));
            const adjustedSources = [
                ...pensionSources,
                ...nonPensionSources
            ];
            const portfolioIncomeNames =
                buildPortfolioIncomeNameSet(adjustedSources);
            const simulationState = buildSimulationState({
                inputs,
                incomeSources: adjustedSources,
                assumptions: inflationAssumptions,
                overrides: {
                    retireAge: age,
                    lifeExpectancy: longevityAge
                }
            });
            const projection = runProjection(simulationState);
            const readiness =
                calculateReadinessScore(
                    projection.results,
                    age
                );
            const firstDeficit =
                projection.results.find(r => r.expenses > r.income);
            const assetDepletion =
                hasPortfolioDepletion(projection.results);
            const noPortfolioWithdrawalNeeded =
                projection.results.every(result => {
                    const portfolioIncome =
                        getPortfolioIncome(
                            result,
                            portfolioIncomeNames
                        );
                    const nonPortfolioIncome =
                        (result.income || 0) - portfolioIncome;

                    return nonPortfolioIncome >= (result.expenses || 0);
                });

            scenarios.push({
                age,
                readinessScore: readiness.score,
                grade: readiness.grade,
                firstDeficitAge: firstDeficit?.age ?? null,
                sustainable:
                    projection.results.every(result =>
                        (result.income || 0) >= getEssentialExpenses(result)
                    ) &&
                    !assetDepletion &&
                    readiness.score >= 70,
                freedom:
                    projection.results.every(r => r.income >= r.expenses) &&
                    !assetDepletion,
                recommended:
                    noPortfolioWithdrawalNeeded &&
                    !assetDepletion
            });
        } catch (error) {
            continue;
        }

   

    }

const earliestSustainable =
    scenarios.find(s => s.sustainable);

const financialFreedom =
    scenarios.find(s => s.freedom);
const recommendedRetirement =
    scenarios.find(s => s.recommended);
   
if (scenarios.length === 0) {

    console.warn("No retirement scenarios generated");

    return {
        earliestSustainableAge: null,
        financialFreedomAge: null,
        recommendedRetirementAge: null,
        scenarios: []
    };
}

return {

    earliestSustainableAge:
        earliestSustainable?.age ?? null,

    financialFreedomAge:
        financialFreedom?.age ?? null,

    recommendedRetirementAge:
        recommendedRetirement?.age ?? null,

    scenarios
};
}
