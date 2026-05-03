/* =========================================================
   SCHEMA-DRIVEN INPUT COLLECTOR
========================================================= */

import { assetRegistry } from "../core/assetRegistry.js";

function readValue(id, type) {

    const el = document.getElementById(id);

    if (!el) return 0;

    if (type === "checkbox") return el.checked;

    const value = el.value;

    if (type === "int") return parseInt(value) || 0;

    if (type === "number") return parseFloat(value) || 0;

    return value || "";

}

/* =========================================================
   INPUT SCHEMA
========================================================= */

const schema = {

    retireAge: "int",
    lifeExpectancy: "int",

    serviceYears: "number",
    fas: "number",
    currentAnnualPay: "number",
    cola: "number",
    leoffBenefitEnhancement: "text",

    survivorOption: "text",
    survivorAge: "int",
    hasPers2: "checkbox",
    hasTrs2: "checkbox",
    pers2ServiceYears: "number",
    pers2Afc: "number",
    pers2StartAge: "number",
    pers2HireDate: "text",
    trs2ServiceYears: "number",
    trs2Afc: "number",
    trs2StartAge: "number",
    trs2HireDate: "text",

    /* =========================
       SOCIAL SECURITY INPUTS
    ========================= */

    ssBirthYear: "int",
    ssClaimAge: "number",
    ssCola: "number",
    ssMode: "text",
    includeSpouseSocialSecurity: "checkbox",
    spouseSsBirthYear: "int",
    spouseSsClaimAge: "number",
    spouseSsCola: "number",
    spouseSsMode: "text",

    ssFraBenefit: "number",
    ssBenefit62: "number",
    ssBenefitFRA: "number",
    ssBenefit70: "number",
    spouseSsFraBenefit: "number",
    spouseSsBenefit62: "number",
    spouseSsBenefitFRA: "number",
    spouseSsBenefit70: "number",

    ssOptimize: "checkbox",

    expenseHousing: "number",
    expenseGroceries: "number",
    expenseBills: "number",
    expenseAuto: "number",
    expenseHealthcare: "number",
    expenseInsurance: "number",
    expenseOther: "number",
    goodsServicesInflation: "number",
    housingInflation: "number",
    healthcareInflation: "number",
    preRetirementSurplusTarget: "text",
    preRetirementSurplusSweepRate: "number",
    preRetirementSurplusGrowthRate: "number",

    realToggle: "checkbox",
    marketFirstToggle: "checkbox"

};

/* =========================================================
   MAIN COLLECTOR
========================================================= */

export function collectInputs() {

    const raw = {};

    Object.entries(schema).forEach(([id,type]) => {
        raw[id] = readValue(id,type);
    });

    const ssMode = raw.ssMode || "fraBenefit";
    const spouseSsMode = raw.spouseSsMode || "fraBenefit";
    const spouseSocialSecurityEnabled =
        Boolean(
            raw.includeSpouseSocialSecurity ||
            raw.spouseSsBirthYear ||
            raw.spouseSsClaimAge ||
            raw.spouseSsFraBenefit ||
            raw.spouseSsBenefit62 ||
            raw.spouseSsBenefitFRA ||
            raw.spouseSsBenefit70
        );

    /* =====================================================
       DERIVED VALUES
    ===================================================== */

    const monthlyExpenses =
        raw.expenseHousing +
        raw.expenseGroceries +
        raw.expenseBills +
        raw.expenseAuto +
        raw.expenseHealthcare +
        raw.expenseInsurance +
        raw.expenseOther;
    const essentialMonthlyExpenses =
        raw.expenseHousing +
        raw.expenseGroceries +
        raw.expenseBills +
        raw.expenseHealthcare +
        raw.expenseInsurance;
    const discretionaryMonthlyExpenses =
        raw.expenseAuto +
        raw.expenseOther;

    const baseAnnualExpenses = monthlyExpenses * 12;
    const essentialAnnualExpenses = essentialMonthlyExpenses * 12;
    const discretionaryAnnualExpenses = discretionaryMonthlyExpenses * 12;

    /* =====================================================
       PROFILE MODULE (canonical age source)
    ===================================================== */

   const profileModule = assetRegistry.get("profile");
   const profile = profileModule ? profileModule.getProfile() : null;

    const additionalPensions = [];

    if (raw.hasPers2) {
        additionalPensions.push({
            system: "PERS2",
            enabled: true,
            serviceYears: raw.pers2ServiceYears,
            averageFinalCompensation: raw.pers2Afc,
            retirementAge: raw.pers2StartAge,
            hireDate: raw.pers2HireDate || null
        });
    }

    if (raw.hasTrs2) {
        additionalPensions.push({
            system: "TRS2",
            enabled: true,
            serviceYears: raw.trs2ServiceYears,
            averageFinalCompensation: raw.trs2Afc,
            retirementAge: raw.trs2StartAge,
            hireDate: raw.trs2HireDate || null
        });
    }

    return {

        profile,

        retireAge: raw.retireAge,
        lifeExpectancy: raw.lifeExpectancy,

        pension: {
            serviceYears: raw.serviceYears,
            finalAverageSalary: raw.fas,
            currentAnnualPay: raw.currentAnnualPay,
            cola: raw.cola / 100,
            benefitEnhancement: raw.leoffBenefitEnhancement || "tiered_multiplier",
            survivorOption: raw.survivorOption,
            survivorAge: raw.survivorAge
        },

        additionalPensions,

        /* =========================
           SOCIAL SECURITY OBJECT
        ========================= */

        socialSecurity: {
            birthYear: raw.ssBirthYear,
            claimAge: raw.ssClaimAge,
            cola: raw.ssCola / 100,
            mode: ssMode,
            fraBenefit: raw.ssFraBenefit,
            benefit62: raw.ssBenefit62,
            benefitFRA: raw.ssBenefitFRA,
            benefit70: raw.ssBenefit70,
            optimize: raw.ssOptimize,
            spouse: {
                enabled: spouseSocialSecurityEnabled,
                birthYear: raw.spouseSsBirthYear,
                claimAge: raw.spouseSsClaimAge,
                cola: raw.spouseSsCola / 100,
                mode: spouseSsMode,
                fraBenefit: raw.spouseSsFraBenefit,
                benefit62: raw.spouseSsBenefit62,
                benefitFRA: raw.spouseSsBenefitFRA,
                benefit70: raw.spouseSsBenefit70
            }
        },

        expenses: {
            housing: raw.expenseHousing,
            groceries: raw.expenseGroceries,
            bills: raw.expenseBills,
            auto: raw.expenseAuto,
            healthcare: raw.expenseHealthcare,
            insurance: raw.expenseInsurance,
            other: raw.expenseOther,
            essentialMonthly: essentialMonthlyExpenses,
            discretionaryMonthly: discretionaryMonthlyExpenses,
            monthly: monthlyExpenses,
            essentialAnnual: essentialAnnualExpenses,
            discretionaryAnnual: discretionaryAnnualExpenses,
            annual: baseAnnualExpenses
        },

        assumptions: {
            inflationRate: (raw.goodsServicesInflation || 3.29) / 100,
            goodsServicesInflationRate:
                (raw.goodsServicesInflation || 3.29) / 100,
            housingInflationRate:
                (raw.housingInflation || 2.8) / 100,
            healthcareInflationRate:
                (raw.healthcareInflation || 6) / 100,
            preRetirementSurplusSweep: {
                target:
                    raw.preRetirementSurplusTarget || "none",
                sweepRate:
                    Math.max(
                        0,
                        Math.min(
                            raw.preRetirementSurplusSweepRate / 100,
                            1
                        )
                    ),
                growthRate:
                    raw.preRetirementSurplusGrowthRate / 100
            }
        },

        toggles: {
            showReal: raw.realToggle,
            marketFirst: raw.marketFirstToggle
        }

    };

}
