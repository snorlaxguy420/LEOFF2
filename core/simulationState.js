/*
Builds a normalized simulation state object for engine consumption.
This keeps UI callers from assembling projection state ad hoc.
*/
export function buildSimulationState({
    inputs = {},
    incomeSources = [],
    assumptions = {},
    overrides = {}
} = {}) {

    const profile = inputs.profile || {};
    const pension = inputs.pension || {};
    const additionalPensions = inputs.additionalPensions || [];
    const expenses = inputs.expenses || {};
    const socialSecurity = inputs.socialSecurity || {};
    const toggles = inputs.toggles || {};
    const mergedAssumptions = {
        ...(inputs.assumptions || {}),
        ...(assumptions || {})
    };
    const inflationRate =
        mergedAssumptions.inflationRate ??
        overrides.inflationRate ??
        0;
    const goodsServicesInflationRate =
        mergedAssumptions.goodsServicesInflationRate ??
        inflationRate;
    const housingInflationRate =
        mergedAssumptions.housingInflationRate ??
        inflationRate;
    const healthcareInflationRate =
        mergedAssumptions.healthcareInflationRate ??
        inflationRate;

    return {
        profile: {
            currentAge: profile.currentAge ?? null,
            retirementAge:
                overrides.retireAge ??
                inputs.retireAge ??
                profile.retirementAge ??
                null,
            lifeExpectancy:
                overrides.lifeExpectancy ??
                inputs.lifeExpectancy ??
                profile.lifeExpectancy ??
                null
        },
        pension: {
            system: overrides.pensionSystem ?? "LEOFF2",
            yearsOfService: pension.serviceYears ?? 0,
            finalAverageSalary: pension.finalAverageSalary ?? 0,
            currentAnnualPay: pension.currentAnnualPay ?? 0,
            retirementAge:
                overrides.retireAge ??
                inputs.retireAge ??
                null,
            benefitEnhancement:
                pension.benefitEnhancement ??
                "tiered_multiplier",
            survivorOption: pension.survivorOption ?? "SINGLE",
            survivorAge: pension.survivorAge ?? null,
            cola: pension.cola ?? 0
        },
        additionalPensions,
        incomeSources,
        socialSecurity,
        expenses: {
            monthly: expenses.monthly ?? 0,
            essentialMonthly: expenses.essentialMonthly ?? 0,
            discretionaryMonthly: expenses.discretionaryMonthly ?? 0,
            annual: expenses.annual ?? 0,
            essentialAnnual: expenses.essentialAnnual ?? 0,
            discretionaryAnnual: expenses.discretionaryAnnual ?? 0,
            housing: expenses.housing ?? 0,
            groceries: expenses.groceries ?? 0,
            bills: expenses.bills ?? 0,
            auto: expenses.auto ?? 0,
            healthcare: expenses.healthcare ?? 0,
            insurance: expenses.insurance ?? 0,
            other: expenses.other ?? 0,
            inflationRate
        },
        assumptions: {
            inflationRate,
            goodsServicesInflationRate,
            housingInflationRate,
            healthcareInflationRate
        },
        toggles: {
            showReal: toggles.showReal ?? false,
            marketFirst: toggles.marketFirst ?? false
        }
    };
}

export function simulationStateToInputs(simulationState = {}) {

    const state = simulationState || {};
    const profile = state.profile || {};
    const pension = state.pension || {};
    const additionalPensions = state.additionalPensions || [];
    const expenses = state.expenses || {};
    const socialSecurity = state.socialSecurity || {};
    const toggles = state.toggles || {};

    const survivorOptionMap = {
        SINGLE: "none",
        JOINT_50: "50%",
        JOINT_66: "66%",
        JOINT_100: "100%"
    };

    return {
        profile,
        retireAge:
            pension.retirementAge ??
            profile.retirementAge ??
            null,
        lifeExpectancy:
            profile.lifeExpectancy ??
            null,
        pension: {
            serviceYears: pension.yearsOfService ?? 0,
            finalAverageSalary: pension.finalAverageSalary ?? 0,
            currentAnnualPay: pension.currentAnnualPay ?? 0,
            cola: pension.cola ?? 0,
            benefitEnhancement:
                pension.benefitEnhancement ?? "tiered_multiplier",
            survivorOption:
                survivorOptionMap[pension.survivorOption] ?? "none",
            survivorAge: pension.survivorAge ?? null
        },
        additionalPensions,
        socialSecurity: {
            birthYear: socialSecurity.birthYear ?? null,
            claimAge: socialSecurity.claimAge ?? null,
            cola: socialSecurity.cola ?? 0,
            mode: socialSecurity.mode ?? "fraBenefit",
            fraBenefit: socialSecurity.fraBenefit ?? 0,
            benefit62: socialSecurity.benefit62 ?? 0,
            benefitFRA: socialSecurity.benefitFRA ?? 0,
            benefit70: socialSecurity.benefit70 ?? 0,
            optimize: socialSecurity.optimize ?? false
        },
        expenses: {
            monthly: expenses.monthly ?? 0,
            essentialMonthly: expenses.essentialMonthly ?? 0,
            discretionaryMonthly: expenses.discretionaryMonthly ?? 0,
            annual: expenses.annual ?? 0,
            essentialAnnual: expenses.essentialAnnual ?? 0,
            discretionaryAnnual: expenses.discretionaryAnnual ?? 0,
            housing: expenses.housing ?? 0,
            groceries: expenses.groceries ?? 0,
            bills: expenses.bills ?? 0,
            auto: expenses.auto ?? 0,
            healthcare: expenses.healthcare ?? 0,
            insurance: expenses.insurance ?? 0,
            other: expenses.other ?? 0
        },
        assumptions: {
            inflationRate: state.assumptions?.inflationRate ?? 0,
            goodsServicesInflationRate:
                state.assumptions?.goodsServicesInflationRate ??
                state.assumptions?.inflationRate ??
                0,
            housingInflationRate:
                state.assumptions?.housingInflationRate ??
                state.assumptions?.inflationRate ??
                0,
            healthcareInflationRate:
                state.assumptions?.healthcareInflationRate ??
                state.assumptions?.inflationRate ??
                0
        },
        toggles: {
            showReal: toggles.showReal ?? false,
            marketFirst: toggles.marketFirst ?? false
        }
    };
}
