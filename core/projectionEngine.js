import { projectTotalRetirement } from "./incomeEngine.js";

/*
Thin projection wrapper that lets the UI pass a single simulation object
without changing the underlying projection math.
*/
export function runProjection(simulationState) {

    const state = simulationState || {};
    const profile = state.profile || {};
    const expenses = state.expenses || {};
    const assumptions = state.assumptions || {};
    const pension = state.pension || {};
    const spouse = profile.spouse || {};
    const currentAge = profile.currentAge;

    const retireAge =
        state.retireAge ??
        state.retirementAge ??
        profile.retirementAge ??
        state.settings?.retirementAge;

    const lifeExpectancy =
        state.lifeExpectancy ??
        profile.lifeExpectancy;

    const baseExpenses =
        expenses.annual ??
        expenses.baseAnnualExpenses ??
        0;

    return projectTotalRetirement({
        incomeSources: state.incomeSources || [],
        currentAge,
        spouseCurrentAge:
            spouse.currentAge ??
            spouse.age ??
            null,
        spouseRetirementAge:
            spouse.retirementAge ?? null,
        spouseAnnualIncome:
            spouse.annualIncome ?? 0,
        currentAnnualPay: pension.currentAnnualPay ?? 0,
        expectedFinalAnnualPay: pension.finalAverageSalary ?? 0,
        retireAge,
        lifeExpectancy,
        baseExpenses,
        expenseModel: {
            housing: expenses.housing ?? 0,
            groceries: expenses.groceries ?? 0,
            bills: expenses.bills ?? 0,
            auto: expenses.auto ?? 0,
            healthcare: expenses.healthcare ?? 0,
            insurance: expenses.insurance ?? 0,
            other: expenses.other ?? 0
        },
        inflation: assumptions.inflationRate ?? state.inflation ?? 0,
        inflationModel: {
            overallPath:
                assumptions.inflationPath ?? null,
            goodsServices:
                assumptions.goodsServicesInflationRate ??
                assumptions.inflationRate ??
                state.inflation ??
                0,
            goodsServicesPath:
                assumptions.goodsServicesInflationPath ?? null,
            housing:
                assumptions.housingInflationRate ??
                assumptions.inflationRate ??
                state.inflation ??
                0,
            housingPath:
                assumptions.housingInflationPath ?? null,
            healthcare:
                assumptions.healthcareInflationRate ??
                assumptions.inflationRate ??
                state.inflation ??
                0,
            healthcarePath:
                assumptions.healthcareInflationPath ?? null
        },
        showReal: state.showReal ?? state.toggles?.showReal ?? false,
        marketFirst: state.marketFirst ?? state.toggles?.marketFirst ?? false
    });
}
