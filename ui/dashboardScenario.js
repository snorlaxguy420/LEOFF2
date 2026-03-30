import { runProjection } from "../core/projectionEngine.js";
import { buildSimulationState } from "../core/simulationState.js";
import {
    buildDashboardAgeAdjustedInputs,
    buildDashboardAgeAdjustedIncomeSources
} from "../analysis/dashboardViewModel.js";
import { buildPensionIncomeSources } from "./simulatorShared.js";

export function buildDashboardScenario({
    baseInputs = {},
    baseSources = [],
    baseAssumptions = {},
    retireAge
}) {
    const currentInputs = buildDashboardAgeAdjustedInputs({
        baseInputs,
        retireAge
    });
    const currentNonPensionSources =
        buildDashboardAgeAdjustedIncomeSources({
            baseSources,
            baseInputs,
            retireAge
        });
    const currentIncomeSources = [
        ...buildPensionIncomeSources({
            inputs: currentInputs,
            retireAge
        }),
        ...currentNonPensionSources
    ];
    const longevityAge = Math.max(
        currentInputs.lifeExpectancy || 0,
        100
    );
    const currentSimulationState = buildSimulationState({
        inputs: currentInputs,
        incomeSources: currentIncomeSources,
        assumptions: baseAssumptions,
        overrides: {
            retireAge,
            lifeExpectancy: longevityAge
        }
    });
    const currentProjection =
        runProjection(currentSimulationState);

    return {
        currentInputs,
        currentIncomeSources,
        currentProjection,
        currentSimulationState
    };
}
