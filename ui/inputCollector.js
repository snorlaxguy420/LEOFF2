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

function getStableIncomeTypeLabel(type) {
    const labels = {
        annuity: "Annuity",
        military_pension: "Military Pension",
        out_of_state_pension: "Out-of-State Pension",
        trust_payment: "Trust Payment",
        other: "Stable Income"
    };

    return labels[type] || labels.other;
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
    hasSers2: "checkbox",
    hasPsers2: "checkbox",
    hasWsprs2: "checkbox",
    hasMilitaryRetiredPay: "checkbox",
    hasMilitaryDisabilityPay: "checkbox",
    hasOtherStableIncome: "checkbox",
    pers2Owner: "text",
    pers2ServiceYears: "number",
    pers2Afc: "number",
    pers2StartAge: "number",
    pers2HireDate: "text",
    trs2Owner: "text",
    trs2ServiceYears: "number",
    trs2Afc: "number",
    trs2StartAge: "number",
    trs2HireDate: "text",
    sers2Owner: "text",
    sers2ServiceYears: "number",
    sers2Afc: "number",
    sers2StartAge: "number",
    sers2HireDate: "text",
    psers2Owner: "text",
    psers2ServiceYears: "number",
    psers2Afc: "number",
    psers2StartAge: "number",
    wsprs2Owner: "text",
    wsprs2ServiceYears: "number",
    wsprs2Afs: "number",
    wsprs2StartAge: "number",
    wsprs2MemberStatus: "text",
    militaryRetiredPayOwner: "text",
    militaryRetiredPayPlan: "text",
    militaryRetiredPayServiceYears: "number",
    militaryRetiredPayBase: "number",
    militaryRetiredPayStartAge: "number",
    militaryRetiredPayCola: "number",
    militaryDisabilityPayOwner: "text",
    militaryDisabilityPayType: "text",
    militaryDisabilityRetirementPlan: "text",
    militaryDisabilityPayMonthlyAmount: "number",
    militaryDisabilityPayBase: "number",
    militaryDisabilityPayPercent: "number",
    militaryDisabilityPayServiceYears: "number",
    militaryDisabilityPayStartAge: "number",
    militaryDisabilityPayCola: "number",
    militaryDisabilityPayTaxable: "checkbox",
    otherStableIncome1Type: "text",
    otherStableIncome1Name: "text",
    otherStableIncome1MonthlyAmount: "number",
    otherStableIncome1StartAge: "number",
    otherStableIncome1EndAge: "number",
    otherStableIncome1Cola: "number",
    otherStableIncome1Taxable: "checkbox",
    otherStableIncome2Type: "text",
    otherStableIncome2Name: "text",
    otherStableIncome2MonthlyAmount: "number",
    otherStableIncome2StartAge: "number",
    otherStableIncome2EndAge: "number",
    otherStableIncome2Cola: "number",
    otherStableIncome2Taxable: "checkbox",
    otherStableIncome3Type: "text",
    otherStableIncome3Name: "text",
    otherStableIncome3MonthlyAmount: "number",
    otherStableIncome3StartAge: "number",
    otherStableIncome3EndAge: "number",
    otherStableIncome3Cola: "number",
    otherStableIncome3Taxable: "checkbox",
    hasSpouseDefinedBenefitPension: "checkbox",
    spousePensionOwner: "text",
    spousePensionName: "text",
    spousePensionStartAge: "number",
    spousePensionMonthlyAmount: "number",
    spousePensionCola: "number",

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
            owner: raw.pers2Owner || "primary",
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
            owner: raw.trs2Owner || "primary",
            serviceYears: raw.trs2ServiceYears,
            averageFinalCompensation: raw.trs2Afc,
            retirementAge: raw.trs2StartAge,
            hireDate: raw.trs2HireDate || null
        });
    }

    if (raw.hasSers2) {
        additionalPensions.push({
            system: "SERS2",
            enabled: true,
            owner: raw.sers2Owner || "primary",
            serviceYears: raw.sers2ServiceYears,
            averageFinalCompensation: raw.sers2Afc,
            retirementAge: raw.sers2StartAge,
            hireDate: raw.sers2HireDate || null
        });
    }

    if (raw.hasPsers2) {
        additionalPensions.push({
            system: "PSERS2",
            enabled: true,
            owner: raw.psers2Owner || "primary",
            serviceYears: raw.psers2ServiceYears,
            averageFinalCompensation: raw.psers2Afc,
            retirementAge: raw.psers2StartAge
        });
    }

    if (raw.hasWsprs2) {
        additionalPensions.push({
            system: "WSPRS2",
            enabled: true,
            owner: raw.wsprs2Owner || "primary",
            serviceYears: raw.wsprs2ServiceYears,
            averageFinalSalary: raw.wsprs2Afs,
            retirementAge: raw.wsprs2StartAge,
            memberStatus: raw.wsprs2MemberStatus || "active"
        });
    }

    if (raw.hasMilitaryRetiredPay) {
        additionalPensions.push({
            system: "MILITARY_RETIRED_PAY",
            enabled: true,
            owner: raw.militaryRetiredPayOwner || "primary",
            retirementPlan: raw.militaryRetiredPayPlan || "high36",
            serviceYears: raw.militaryRetiredPayServiceYears,
            retiredPayBase: raw.militaryRetiredPayBase,
            retirementAge: raw.militaryRetiredPayStartAge,
            cola: raw.militaryRetiredPayCola / 100,
            taxable: true
        });
    }

    if (raw.hasMilitaryDisabilityPay) {
        additionalPensions.push({
            system: "MILITARY_DISABILITY_PAY",
            enabled: true,
            owner: raw.militaryDisabilityPayOwner || "primary",
            payType:
                raw.militaryDisabilityPayType || "va_disability",
            retirementPlan:
                raw.militaryDisabilityRetirementPlan || "legacy",
            monthlyAmount: raw.militaryDisabilityPayMonthlyAmount,
            retiredPayBase: raw.militaryDisabilityPayBase,
            disabilityPercent: raw.militaryDisabilityPayPercent,
            serviceYears: raw.militaryDisabilityPayServiceYears,
            retirementAge: raw.militaryDisabilityPayStartAge,
            cola: raw.militaryDisabilityPayCola / 100,
            taxable: Boolean(raw.militaryDisabilityPayTaxable)
        });
    }

    if (raw.hasOtherStableIncome) {
        [1, 2, 3].forEach(slot => {
            const type =
                raw[`otherStableIncome${slot}Type`] || "other";
            const monthlyAmount =
                raw[`otherStableIncome${slot}MonthlyAmount`];

            if (monthlyAmount <= 0) {
                return;
            }

            additionalPensions.push({
                system: "OTHER_STABLE_INCOME",
                enabled: true,
                incomeType: type,
                name:
                    raw[`otherStableIncome${slot}Name`] ||
                    getStableIncomeTypeLabel(type),
                startAge: raw[`otherStableIncome${slot}StartAge`],
                endAge:
                    raw[`otherStableIncome${slot}EndAge`] || null,
                monthlyAmount,
                annualAmount: monthlyAmount * 12,
                cola: raw[`otherStableIncome${slot}Cola`] / 100,
                taxable:
                    Boolean(raw[`otherStableIncome${slot}Taxable`])
            });
        });
    }

    if (raw.hasSpouseDefinedBenefitPension) {
        additionalPensions.push({
            system: "SPOUSE_DEFINED_BENEFIT",
            enabled: true,
            owner: raw.spousePensionOwner || "primary",
            name: raw.spousePensionName || "Defined Benefit Pension",
            spouseStartAge: raw.spousePensionStartAge,
            retirementAge: raw.spousePensionStartAge,
            monthlyAmount: raw.spousePensionMonthlyAmount,
            annualAmount: raw.spousePensionMonthlyAmount * 12,
            cola: raw.spousePensionCola / 100,
            taxable: true
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
