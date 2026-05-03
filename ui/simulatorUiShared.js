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
        pers2ServiceYears: pers2?.serviceYears,
        pers2Afc: pers2?.averageFinalCompensation,
        pers2StartAge: pers2?.retirementAge,
        pers2HireDate: pers2?.hireDate,
        trs2ServiceYears: trs2?.serviceYears,
        trs2Afc: trs2?.averageFinalCompensation,
        trs2StartAge: trs2?.retirementAge,
        trs2HireDate: trs2?.hireDate,
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

    if (pers2Section && hasPers2) {
        pers2Section.style.display =
            hasPers2.checked ? "grid" : "none";
    }

    if (trs2Section && hasTrs2) {
        trs2Section.style.display =
            hasTrs2.checked ? "grid" : "none";
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
