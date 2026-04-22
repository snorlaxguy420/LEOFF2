export function calculateSocialSecurityFRA(birthYear) {

    if (birthYear <= 1937) return 65;
    if (birthYear <= 1942) return 65 + ((birthYear - 1937) * 2) / 12;
    if (birthYear <= 1954) return 66;
    if (birthYear <= 1959) return 66 + ((birthYear - 1954) * 2) / 12;

    return 67;
}

export function calculateSocialSecurityAgeFactor(claimAge, fra) {

    if (claimAge === fra) return 1;

    if (claimAge < fra) {
        const monthsEarly = Math.round((fra - claimAge) * 12);

        if (monthsEarly <= 36) {
            return 1 - (monthsEarly * (5 / 9) / 100);
        }

        const first36 = 36 * (5 / 9) / 100;
        const remaining = (monthsEarly - 36) * (5 / 12) / 100;

        return 1 - first36 - remaining;
    }

    const monthsLate = Math.round((claimAge - fra) * 12);

    return 1 + (monthsLate * (2 / 3) / 100);
}

export function normalizeSocialSecurityFraBenefit(socialSecurity = {}) {

    const birthYear = socialSecurity.birthYear || 1980;
    const fra = calculateSocialSecurityFRA(birthYear);
    const mode = socialSecurity.mode || "fraBenefit";

    const directFraBenefit =
        socialSecurity.fraBenefit ||
        socialSecurity.benefitFRA ||
        0;

    if (
        mode === "fraBenefit" ||
        mode === "benefitFRA" ||
        !mode
    ) {
        return directFraBenefit;
    }

    if (mode === "benefit62" && socialSecurity.benefit62) {
        const factorAt62 = calculateSocialSecurityAgeFactor(62, fra);
        return factorAt62 > 0
            ? socialSecurity.benefit62 / factorAt62
            : 0;
    }

    if (mode === "benefit70" && socialSecurity.benefit70) {
        const factorAt70 = calculateSocialSecurityAgeFactor(70, fra);
        return factorAt70 > 0
            ? socialSecurity.benefit70 / factorAt70
            : 0;
    }

    return directFraBenefit;
}

function resolveSocialSecuritySourceName(householdMember = "primary") {
    return householdMember === "spouse"
        ? "Spouse Social Security"
        : "Social Security";
}

export function calculateSocialSecurityIncomeSource(
    socialSecurity = {},
    options = {}
) {

    const birthYear = socialSecurity.birthYear || 1980;
    const claimAge = socialSecurity.claimAge || 67;
    const cola = socialSecurity.cola || 0.024;
    const householdMember =
        options.householdMember ||
        socialSecurity.householdMember ||
        "primary";
    const fraBenefit =
        normalizeSocialSecurityFraBenefit(socialSecurity);

    if (!fraBenefit) return null;

    const fra = calculateSocialSecurityFRA(birthYear);
    const factor =
        calculateSocialSecurityAgeFactor(claimAge, fra);
    const monthlyBenefit = fraBenefit * factor;

    return {
        type: "fixed",
        name:
            options.name ||
            resolveSocialSecuritySourceName(householdMember),
        startAge: claimAge,
        annualAmount: monthlyBenefit * 12,
        growthRate: cola,
        taxCategory: "social_security",
        metadata: {
            householdMember,
            fra,
            normalizedFraBenefit: fraBenefit,
            ageFactor: factor,
            monthlyBenefit
        }
    };
}

export function calculateHouseholdSocialSecurityIncomeSources(
    socialSecurity = {},
    profile = {}
) {
    const sources = [];
    const primarySource =
        calculateSocialSecurityIncomeSource(
            socialSecurity,
            {
                householdMember: "primary",
                name: "Social Security"
            }
        );

    if (primarySource) {
        sources.push(primarySource);
    }

    const spouseSocialSecurity =
        socialSecurity?.spouse || {};
    const spouseConfigured =
        spouseSocialSecurity.enabled ||
        spouseSocialSecurity.birthYear ||
        spouseSocialSecurity.claimAge ||
        spouseSocialSecurity.fraBenefit ||
        spouseSocialSecurity.benefit62 ||
        spouseSocialSecurity.benefitFRA ||
        spouseSocialSecurity.benefit70;
    const spousePresent =
        profile?.maritalStatus === "married" ||
        Boolean(profile?.spouse);

    if (spousePresent && spouseConfigured) {
        const spouseSource =
            calculateSocialSecurityIncomeSource(
                spouseSocialSecurity,
                {
                    householdMember: "spouse",
                    name: "Spouse Social Security"
                }
            );

        if (spouseSource) {
            sources.push(spouseSource);
        }
    }

    return sources;
}
