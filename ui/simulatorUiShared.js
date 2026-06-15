function deriveBirthYearFromAge(age) {
    const parsedAge = Number(age);

    if (!Number.isFinite(parsedAge) || parsedAge <= 0) {
        return null;
    }

    return new Date().getFullYear() - parsedAge;
}

function populateProfileInputs(inputs = {}) {
    const profile = inputs.profile || {};
    const spouse = profile.spouse || {};
    const profileValueMap = {
        userName: profile.name,
        birthMonth: profile.birthMonth,
        birthYear: profile.birthYear,
        maritalStatus: profile.maritalStatus,
        spouseName: spouse.name,
        spouseBirthYear:
            spouse.birthYear ??
            deriveBirthYearFromAge(spouse.currentAge ?? spouse.age),
        spouseRetirementAge: spouse.retirementAge,
        spouseAnnualIncome: spouse.annualIncome
    };

    Object.entries(profileValueMap).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (!el || value === undefined || value === null) return;
        el.value = value;
    });

    const maritalStatusEl = document.getElementById("maritalStatus");
    const spouseSection = document.getElementById("spouseSection");

    if (maritalStatusEl) {
        maritalStatusEl.dispatchEvent(new Event("change"));
    } else if (spouseSection) {
        spouseSection.style.display =
            profile.maritalStatus === "married" ? "block" : "none";
    }

    const birthYearEl = document.getElementById("birthYear");

    if (birthYearEl && birthYearEl.value) {
        birthYearEl.dispatchEvent(new Event("input"));
        birthYearEl.dispatchEvent(new Event("change"));
    }
}

export function populateSimulatorInputs(inputs) {

    if (!inputs) return;

    populateProfileInputs(inputs);

    const pers2 =
        (inputs.additionalPensions || [])
            .find(pension => pension.system === "PERS2") || null;
    const trs2 =
        (inputs.additionalPensions || [])
            .find(pension => pension.system === "TRS2") || null;
    const sers2 =
        (inputs.additionalPensions || [])
            .find(pension => pension.system === "SERS2") || null;
    const psers2 =
        (inputs.additionalPensions || [])
            .find(pension => pension.system === "PSERS2") || null;
    const wsprs2 =
        (inputs.additionalPensions || [])
            .find(pension => pension.system === "WSPRS2") || null;
    const militaryRetiredPay =
        (inputs.additionalPensions || [])
            .find(
                pension => pension.system === "MILITARY_RETIRED_PAY"
            ) || null;
    const militaryDisabilityPay =
        (inputs.additionalPensions || [])
            .find(
                pension => pension.system === "MILITARY_DISABILITY_PAY"
            ) || null;
    const otherStableIncomeSources =
        (inputs.additionalPensions || [])
            .filter(
                pension => pension.system === "OTHER_STABLE_INCOME"
            )
            .slice(0, 3);
    const spouseDefinedBenefitPension =
        (inputs.additionalPensions || [])
            .find(pension => pension.system === "SPOUSE_DEFINED_BENEFIT") ||
        null;
    const socialSecurityMode =
        inputs.socialSecurity?.mode === "benefitFRA"
            ? "fraBenefit"
            : (inputs.socialSecurity?.mode || "fraBenefit");
    const spouseSocialSecurityMode =
        inputs.socialSecurity?.spouse?.mode === "benefitFRA"
            ? "fraBenefit"
            : (inputs.socialSecurity?.spouse?.mode || "fraBenefit");
    const spouseSocialSecurityEnabled =
        Boolean(
            inputs.socialSecurity?.spouse?.enabled ||
            inputs.socialSecurity?.spouse?.birthYear ||
            inputs.socialSecurity?.spouse?.claimAge ||
            inputs.socialSecurity?.spouse?.fraBenefit ||
            inputs.socialSecurity?.spouse?.benefit62 ||
            inputs.socialSecurity?.spouse?.benefitFRA ||
            inputs.socialSecurity?.spouse?.benefit70
        );
    const preRetirementSurplusSweep =
        inputs.assumptions?.preRetirementSurplusSweep || {};

    const valueMap = {
        retireAge: inputs.retireAge,
        lifeExpectancy: inputs.lifeExpectancy,
        serviceYears: inputs.pension?.serviceYears,
        fas: inputs.pension?.finalAverageSalary,
        currentAnnualPay: inputs.pension?.currentAnnualPay,
        cola: (inputs.pension?.cola || 0) * 100,
        leoffBenefitEnhancement:
            inputs.pension?.benefitEnhancement || "tiered_multiplier",
        survivorOption: inputs.pension?.survivorOption,
        survivorAge: inputs.pension?.survivorAge,
        pers2Owner: pers2?.owner || "primary",
        pers2ServiceYears: pers2?.serviceYears,
        pers2Afc: pers2?.averageFinalCompensation,
        pers2StartAge: pers2?.retirementAge,
        pers2HireDate: pers2?.hireDate,
        trs2Owner: trs2?.owner || "primary",
        trs2ServiceYears: trs2?.serviceYears,
        trs2Afc: trs2?.averageFinalCompensation,
        trs2StartAge: trs2?.retirementAge,
        trs2HireDate: trs2?.hireDate,
        sers2Owner: sers2?.owner || "primary",
        sers2ServiceYears: sers2?.serviceYears,
        sers2Afc: sers2?.averageFinalCompensation,
        sers2StartAge: sers2?.retirementAge,
        sers2HireDate: sers2?.hireDate,
        psers2Owner: psers2?.owner || "primary",
        psers2ServiceYears: psers2?.serviceYears,
        psers2Afc: psers2?.averageFinalCompensation,
        psers2StartAge: psers2?.retirementAge,
        wsprs2Owner: wsprs2?.owner || "primary",
        wsprs2ServiceYears: wsprs2?.serviceYears,
        wsprs2Afs:
            wsprs2?.averageFinalSalary ??
            wsprs2?.averageFinalCompensation,
        wsprs2StartAge: wsprs2?.retirementAge,
        wsprs2MemberStatus: wsprs2?.memberStatus || "active",
        militaryRetiredPayOwner:
            militaryRetiredPay?.owner || "primary",
        militaryRetiredPayPlan:
            militaryRetiredPay?.retirementPlan || "high36",
        militaryRetiredPayServiceYears:
            militaryRetiredPay?.serviceYears,
        militaryRetiredPayBase:
            militaryRetiredPay?.retiredPayBase ??
            militaryRetiredPay?.monthlyRetiredPayBase,
        militaryRetiredPayStartAge:
            militaryRetiredPay?.retirementAge,
        militaryRetiredPayCola:
            (militaryRetiredPay?.cola ?? 0.025) * 100,
        militaryDisabilityPayOwner:
            militaryDisabilityPay?.owner || "primary",
        militaryDisabilityPayType:
            militaryDisabilityPay?.payType || "va_disability",
        militaryDisabilityRetirementPlan:
            militaryDisabilityPay?.retirementPlan || "legacy",
        militaryDisabilityPayMonthlyAmount:
            militaryDisabilityPay?.monthlyAmount,
        militaryDisabilityPayBase:
            militaryDisabilityPay?.retiredPayBase ??
            militaryDisabilityPay?.monthlyRetiredPayBase,
        militaryDisabilityPayPercent:
            militaryDisabilityPay?.disabilityPercent,
        militaryDisabilityPayServiceYears:
            militaryDisabilityPay?.serviceYears,
        militaryDisabilityPayStartAge:
            militaryDisabilityPay?.retirementAge ??
            militaryDisabilityPay?.startAge,
        militaryDisabilityPayCola:
            (militaryDisabilityPay?.cola ?? 0.025) * 100,
        otherStableIncome1Type:
            otherStableIncomeSources[0]?.incomeType || "annuity",
        otherStableIncome1Name:
            otherStableIncomeSources[0]?.name || "Annuity",
        otherStableIncome1MonthlyAmount:
            Number(otherStableIncomeSources[0]?.monthlyAmount) > 0
                ? otherStableIncomeSources[0].monthlyAmount
                : ((otherStableIncomeSources[0]?.annualAmount || 0) / 12),
        otherStableIncome1StartAge:
            otherStableIncomeSources[0]?.startAge,
        otherStableIncome1EndAge:
            otherStableIncomeSources[0]?.endAge,
        otherStableIncome1Cola:
            (otherStableIncomeSources[0]?.cola || 0) * 100,
        otherStableIncome2Type:
            otherStableIncomeSources[1]?.incomeType || "military_pension",
        otherStableIncome2Name:
            otherStableIncomeSources[1]?.name || "Military Pension",
        otherStableIncome2MonthlyAmount:
            Number(otherStableIncomeSources[1]?.monthlyAmount) > 0
                ? otherStableIncomeSources[1].monthlyAmount
                : ((otherStableIncomeSources[1]?.annualAmount || 0) / 12),
        otherStableIncome2StartAge:
            otherStableIncomeSources[1]?.startAge,
        otherStableIncome2EndAge:
            otherStableIncomeSources[1]?.endAge,
        otherStableIncome2Cola:
            (otherStableIncomeSources[1]?.cola || 0) * 100,
        otherStableIncome3Type:
            otherStableIncomeSources[2]?.incomeType || "trust_payment",
        otherStableIncome3Name:
            otherStableIncomeSources[2]?.name || "Trust Payment",
        otherStableIncome3MonthlyAmount:
            Number(otherStableIncomeSources[2]?.monthlyAmount) > 0
                ? otherStableIncomeSources[2].monthlyAmount
                : ((otherStableIncomeSources[2]?.annualAmount || 0) / 12),
        otherStableIncome3StartAge:
            otherStableIncomeSources[2]?.startAge,
        otherStableIncome3EndAge:
            otherStableIncomeSources[2]?.endAge,
        otherStableIncome3Cola:
            (otherStableIncomeSources[2]?.cola || 0) * 100,
        spousePensionOwner:
            spouseDefinedBenefitPension
                ? spouseDefinedBenefitPension.owner || "spouse"
                : "primary",
        spousePensionName:
            spouseDefinedBenefitPension?.name ||
            "Defined Benefit Pension",
        spousePensionStartAge:
            spouseDefinedBenefitPension?.spouseStartAge ??
            spouseDefinedBenefitPension?.retirementAge ??
            spouseDefinedBenefitPension?.startAge,
        spousePensionMonthlyAmount:
            Number(spouseDefinedBenefitPension?.monthlyAmount) > 0
                ? spouseDefinedBenefitPension.monthlyAmount
                : ((spouseDefinedBenefitPension?.annualAmount || 0) / 12),
        spousePensionCola:
            (spouseDefinedBenefitPension?.cola || 0) * 100,
        ssBirthYear: inputs.socialSecurity?.birthYear,
        ssClaimAge: inputs.socialSecurity?.claimAge,
        ssCola: (inputs.socialSecurity?.cola || 0) * 100,
        ssMode: socialSecurityMode,
        ssFraBenefit:
            inputs.socialSecurity?.fraBenefit ||
            inputs.socialSecurity?.benefitFRA,
        ssBenefit62: inputs.socialSecurity?.benefit62,
        ssBenefitFRA: inputs.socialSecurity?.benefitFRA,
        ssBenefit70: inputs.socialSecurity?.benefit70,
        spouseSsBirthYear: inputs.socialSecurity?.spouse?.birthYear,
        spouseSsClaimAge: inputs.socialSecurity?.spouse?.claimAge,
        spouseSsCola: (inputs.socialSecurity?.spouse?.cola || 0) * 100,
        spouseSsMode: spouseSocialSecurityMode,
        spouseSsFraBenefit:
            inputs.socialSecurity?.spouse?.fraBenefit ||
            inputs.socialSecurity?.spouse?.benefitFRA,
        spouseSsBenefit62: inputs.socialSecurity?.spouse?.benefit62,
        spouseSsBenefitFRA: inputs.socialSecurity?.spouse?.benefitFRA,
        spouseSsBenefit70: inputs.socialSecurity?.spouse?.benefit70,
        expenseHousing: inputs.expenses?.housing,
        expenseGroceries: inputs.expenses?.groceries,
        expenseBills: inputs.expenses?.bills,
        expenseAuto: inputs.expenses?.auto,
        expenseHealthcare: inputs.expenses?.healthcare,
        expenseInsurance: inputs.expenses?.insurance,
        expenseOther: inputs.expenses?.other,
        goodsServicesInflation:
            (inputs.assumptions?.goodsServicesInflationRate ||
             inputs.assumptions?.inflationRate ||
             0) * 100,
        housingInflation:
            (inputs.assumptions?.housingInflationRate ||
             inputs.assumptions?.inflationRate ||
             0) * 100,
        healthcareInflation:
            (inputs.assumptions?.healthcareInflationRate ||
             inputs.assumptions?.inflationRate ||
             0) * 100,
        preRetirementSurplusTarget:
            preRetirementSurplusSweep.target || "none",
        preRetirementSurplusSweepRate:
            (preRetirementSurplusSweep.sweepRate ?? 1) * 100,
        preRetirementSurplusGrowthRate:
            (preRetirementSurplusSweep.growthRate ?? 0.05) * 100
    };

    Object.entries(valueMap).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (!el || value === undefined || value === null) return;
        el.value = value;
    });

    const toggleMap = {
        hasPers2: Boolean(pers2?.enabled),
        hasTrs2: Boolean(trs2?.enabled),
        hasSers2: Boolean(sers2?.enabled),
        hasPsers2: Boolean(psers2?.enabled),
        hasWsprs2: Boolean(wsprs2?.enabled),
        hasMilitaryRetiredPay: Boolean(militaryRetiredPay?.enabled),
        hasMilitaryDisabilityPay:
            Boolean(militaryDisabilityPay?.enabled),
        militaryDisabilityPayTaxable:
            Boolean(militaryDisabilityPay?.taxable),
        hasOtherStableIncome:
            otherStableIncomeSources.some(pension => pension?.enabled),
        otherStableIncome1Taxable:
            otherStableIncomeSources[0]?.taxable !== false,
        otherStableIncome2Taxable:
            otherStableIncomeSources[1]?.taxable !== false,
        otherStableIncome3Taxable:
            otherStableIncomeSources[2]?.taxable !== false,
        hasSpouseDefinedBenefitPension:
            Boolean(spouseDefinedBenefitPension?.enabled),
        ssOptimize: inputs.socialSecurity?.optimize,
        includeSpouseSocialSecurity: spouseSocialSecurityEnabled,
        realToggle: inputs.toggles?.showReal,
        marketFirstToggle: inputs.toggles?.marketFirst
    };

    Object.entries(toggleMap).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.checked = Boolean(value);
    });

    const pers2Section = document.getElementById("pers2Section");
    const hasPers2 = document.getElementById("hasPers2");
    const trs2Section = document.getElementById("trs2Section");
    const hasTrs2 = document.getElementById("hasTrs2");
    const sers2Section = document.getElementById("sers2Section");
    const hasSers2 = document.getElementById("hasSers2");
    const psers2Section = document.getElementById("psers2Section");
    const hasPsers2 = document.getElementById("hasPsers2");
    const wsprs2Section = document.getElementById("wsprs2Section");
    const hasWsprs2 = document.getElementById("hasWsprs2");
    const militaryRetiredPaySection =
        document.getElementById("militaryRetiredPaySection");
    const hasMilitaryRetiredPay =
        document.getElementById("hasMilitaryRetiredPay");
    const militaryDisabilityPaySection =
        document.getElementById("militaryDisabilityPaySection");
    const hasMilitaryDisabilityPay =
        document.getElementById("hasMilitaryDisabilityPay");
    const otherStableIncomeSection =
        document.getElementById("otherStableIncomeSection");
    const hasOtherStableIncome =
        document.getElementById("hasOtherStableIncome");
    const spouseDefinedBenefitPensionSection =
        document.getElementById("spouseDefinedBenefitPensionSection");
    const hasSpouseDefinedBenefitPension =
        document.getElementById("hasSpouseDefinedBenefitPension");

    if (pers2Section && hasPers2) {
        pers2Section.style.display =
            hasPers2.checked ? "grid" : "none";
    }

    if (trs2Section && hasTrs2) {
        trs2Section.style.display =
            hasTrs2.checked ? "grid" : "none";
    }

    if (sers2Section && hasSers2) {
        sers2Section.style.display =
            hasSers2.checked ? "grid" : "none";
    }

    if (psers2Section && hasPsers2) {
        psers2Section.style.display =
            hasPsers2.checked ? "grid" : "none";
    }

    if (wsprs2Section && hasWsprs2) {
        wsprs2Section.style.display =
            hasWsprs2.checked ? "grid" : "none";
    }

    if (militaryRetiredPaySection && hasMilitaryRetiredPay) {
        militaryRetiredPaySection.style.display =
            hasMilitaryRetiredPay.checked ? "grid" : "none";
    }

    if (militaryDisabilityPaySection && hasMilitaryDisabilityPay) {
        militaryDisabilityPaySection.style.display =
            hasMilitaryDisabilityPay.checked ? "grid" : "none";
    }

    if (otherStableIncomeSection && hasOtherStableIncome) {
        otherStableIncomeSection.style.display =
            hasOtherStableIncome.checked ? "grid" : "none";
    }

    if (
        spouseDefinedBenefitPensionSection &&
        hasSpouseDefinedBenefitPension
    ) {
        spouseDefinedBenefitPensionSection.style.display =
            hasSpouseDefinedBenefitPension.checked ? "grid" : "none";
    }

    const survivorOption = document.getElementById("survivorOption");

    if (survivorOption) {
        survivorOption.dispatchEvent(new Event("change"));
    }

    const event = new CustomEvent("socialSecurity:mode-sync");
    document.dispatchEvent(event);
}

export function getProjectionPreviewMetrics(projection) {

    const results = projection?.results || [];

    if (!results.length) {
        return null;
    }

    const retirementYear =
        results.find(result => result.age === projection.retireAge) ||
        results[0];

    const income =
        retirementYear.totalIncome ||
        retirementYear.income ||
        0;

    const expenses = Math.max(retirementYear.expenses || 0, 1);
    const coveragePercent = Math.round((income / expenses) * 100);

    return {
        retirementYear,
        coveragePercent,
        firstDeficit:
            projection.firstDeficitYear || "None",
        retirementStatus:
            projection.firstDeficitYear ? "At Risk" : "Sustainable"
    };
}

export function clearProjectionPreview(setText) {
    setText("incomeCoverage", "--");
    setText("firstDeficit", "--");
    setText("retirementStatus", "Enter current expenses");

    const netWorthEl = document.getElementById("netWorth");
    if (netWorthEl) {
        netWorthEl.textContent = "--";
    }
}

export function applyProjectionPreview({
    projection,
    setText,
    onCoverageColor
}) {

    const metrics = getProjectionPreviewMetrics(projection);

    if (!metrics) return null;

    setText("incomeCoverage", metrics.coveragePercent + "%");
    setText(
        "netWorth",
        "$" + Math.round(metrics.retirementYear.netWorth).toLocaleString()
    );
    setText("firstDeficit", metrics.firstDeficit);
    setText("retirementStatus", metrics.retirementStatus);

    if (onCoverageColor) {
        onCoverageColor(metrics.coveragePercent);
    }

    return metrics;
}
