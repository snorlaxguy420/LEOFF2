/* =========================================================
   SIMPLE FEDERAL TAX ESTIMATOR
========================================================= */

const FEDERAL_TAX_BRACKETS = [
    { cap: 11000, rate: 0.10 },
    { cap: 44725, rate: 0.12 },
    { cap: 95375, rate: 0.22 },
    { cap: 182100, rate: 0.24 },
    { cap: Infinity, rate: 0.32 }
];

export function calculateFederalIncomeTax(taxableIncome = 0) {
    let remainingIncome = Math.max(0, taxableIncome);
    let totalTax = 0;
    let lowerBound = 0;

    for (const bracket of FEDERAL_TAX_BRACKETS) {
        if (remainingIncome <= 0) {
            break;
        }

        const upperBound = bracket.cap;
        const bracketWidth = upperBound - lowerBound;
        const taxableAtBracket =
            Math.min(remainingIncome, bracketWidth);

        totalTax += taxableAtBracket * bracket.rate;
        remainingIncome -= taxableAtBracket;
        lowerBound = upperBound;
    }

    return totalTax;
}

export function calculateSocialSecurityTaxableAmount({
    socialSecurityIncome = 0,
    otherTaxableIncome = 0
}) {
    const provisionalIncome =
        otherTaxableIncome + (socialSecurityIncome * 0.5);

    if (provisionalIncome <= 25000) {
        return 0;
    }

    if (provisionalIncome <= 34000) {
        return Math.min(
            socialSecurityIncome * 0.5,
            (provisionalIncome - 25000) * 0.5
        );
    }

    return Math.min(
        socialSecurityIncome * 0.85,
        ((provisionalIncome - 34000) * 0.85) +
        Math.min(socialSecurityIncome * 0.5, 4500)
    );
}

export function getFixedIncomeTaxableAmount({
    source,
    income,
    currentTaxableIncome
}) {
    if (!income || source?.taxable === false) {
        return 0;
    }

    if (source?.taxCategory === "social_security") {
        return calculateSocialSecurityTaxableAmount({
            socialSecurityIncome: income,
            otherTaxableIncome: currentTaxableIncome
        });
    }

    if (
        source?.taxable === true ||
        source?.taxCategory === "ordinary_income"
    ) {
        return income;
    }

    return 0;
}

const RMD_UNIFORM_LIFETIME_FACTORS = {
    73: 26.5,
    74: 25.5,
    75: 24.6,
    76: 23.7,
    77: 22.9,
    78: 22.0,
    79: 21.1,
    80: 20.2,
    81: 19.4,
    82: 18.5,
    83: 17.7,
    84: 16.8,
    85: 16.0,
    86: 15.2,
    87: 14.4,
    88: 13.7,
    89: 12.9,
    90: 12.2,
    91: 11.5,
    92: 10.8,
    93: 10.1,
    94: 9.5,
    95: 8.9,
    96: 8.4,
    97: 7.8,
    98: 7.3,
    99: 6.8,
    100: 6.4,
    101: 6.0,
    102: 5.6,
    103: 5.2,
    104: 4.9,
    105: 4.6,
    106: 4.3,
    107: 4.1,
    108: 3.9,
    109: 3.7,
    110: 3.5,
    111: 3.4,
    112: 3.3,
    113: 3.1,
    114: 3.0,
    115: 2.9,
    116: 2.8,
    117: 2.7,
    118: 2.5,
    119: 2.3,
    120: 2.0
};

function getApproximateRequiredMinimumDistribution(balance, currentAge, rules) {
    if (!rules.rmdEligible || currentAge < rules.rmdStartAge || balance <= 0) {
        return 0;
    }

    const factor =
        RMD_UNIFORM_LIFETIME_FACTORS[currentAge] ||
        RMD_UNIFORM_LIFETIME_FACTORS[120];

    if (!factor) {
        return 0;
    }

    return balance / factor;
}

function getPlannedPortfolioWithdrawal({
    source,
    balance
}) {
    if (balance <= 0) {
        return 0;
    }

    if (source.withdrawalType === "percent") {
        return balance * (source.withdrawalRate || 0);
    }

    return source.withdrawal || 0;
}

function solveGrossWithdrawalForNetTarget({
    source,
    currentAge,
    currentTaxableIncome,
    targetNetWithdrawal,
    maxGrossWithdrawal
}) {
    const safeTarget = Math.max(0, targetNetWithdrawal || 0);
    const safeMax = Math.max(0, maxGrossWithdrawal || 0);

    if (safeTarget <= 0 || safeMax <= 0) {
        return 0;
    }

    const maxResult = applyRetirementAccountTaxTreatment({
        source,
        withdrawal: safeMax,
        currentAge,
        currentTaxableIncome
    });

    if (maxResult.netWithdrawal <= safeTarget) {
        return safeMax;
    }

    let lowerBound = 0;
    let upperBound = safeMax;

    for (let iteration = 0; iteration < 18; iteration += 1) {
        const midpoint = (lowerBound + upperBound) / 2;
        const midpointResult = applyRetirementAccountTaxTreatment({
            source,
            withdrawal: midpoint,
            currentAge,
            currentTaxableIncome
        });

        if (midpointResult.netWithdrawal >= safeTarget) {
            upperBound = midpoint;
        } else {
            lowerBound = midpoint;
        }
    }

    return upperBound;
}

function isRetirementAccountPortfolio(source) {
    return source.type === "portfolio" && !!source.accountType;
}

function getRetirementAccountWithdrawalPriority(source) {
    const accountType = source.accountType;

    if (accountType === "457b") return 10;

    if (
        accountType === "401k" ||
        accountType === "403b" ||
        accountType === "401a" ||
        accountType === "tsp" ||
        accountType === "traditional_ira"
    ) {
        return 20;
    }

    if (accountType === "roth_401k") return 30;
    if (accountType === "roth_ira") return 40;

    return 50;
}

function orderIncomeSourcesForProjection(incomeSources) {
    return incomeSources
        .map((source, index) => ({ source, index }))
        .sort((left, right) => {
            const leftIsRetirement = isRetirementAccountPortfolio(left.source);
            const rightIsRetirement = isRetirementAccountPortfolio(right.source);

            if (leftIsRetirement && rightIsRetirement) {
                const priorityDifference =
                    getRetirementAccountWithdrawalPriority(left.source) -
                    getRetirementAccountWithdrawalPriority(right.source);

                if (priorityDifference !== 0) {
                    return priorityDifference;
                }
            }

            return left.index - right.index;
        })
        .map(entry => entry.source);
}

function getRetirementAccountDistributionRules(source, currentAge) {

    const accountType = source.accountType || "generic_portfolio";
    const penaltyExceptionType =
        source.penaltyExceptionType || "standard";

    function getQualifiedPlanPenaltyRate() {
        if (penaltyExceptionType === "public_safety_age50") {
            return currentAge < 50 ? 0.10 : 0;
        }

        if (penaltyExceptionType === "age55") {
            return currentAge < 55 ? 0.10 : 0;
        }

        return currentAge < 59.5 ? 0.10 : 0;
    }

    if (accountType === "401k") {
        return {
            accountType,
            taxable: true,
            earlyWithdrawalPenaltyRate: getQualifiedPlanPenaltyRate(),
            rmdEligible: true,
            rmdStartAge: 73
        };
    }

    if (accountType === "403b") {
        return {
            accountType,
            taxable: true,
            earlyWithdrawalPenaltyRate: getQualifiedPlanPenaltyRate(),
            rmdEligible: true,
            rmdStartAge: 73
        };
    }

    if (accountType === "401a") {
        return {
            accountType,
            taxable: true,
            earlyWithdrawalPenaltyRate: getQualifiedPlanPenaltyRate(),
            rmdEligible: true,
            rmdStartAge: 73
        };
    }

    if (accountType === "tsp") {
        return {
            accountType,
            taxable: true,
            earlyWithdrawalPenaltyRate: getQualifiedPlanPenaltyRate(),
            rmdEligible: true,
            rmdStartAge: 73
        };
    }

    if (accountType === "traditional_ira") {
        return {
            accountType,
            taxable: true,
            earlyWithdrawalPenaltyRate: currentAge < 59.5 ? 0.10 : 0,
            rmdEligible: true,
            rmdStartAge: 73
        };
    }

    if (accountType === "457b") {
        return {
            accountType,
            taxable: true,
            earlyWithdrawalPenaltyRate: 0,
            rmdEligible: true,
            rmdStartAge: 73
        };
    }

    if (accountType === "roth_ira") {
        return {
            accountType,
            taxable: false,
            earlyWithdrawalPenaltyRate: 0,
            rmdEligible: false,
            rmdStartAge: null
        };
    }

    if (accountType === "roth_401k") {
        return {
            accountType,
            taxable: false,
            earlyWithdrawalPenaltyRate: getQualifiedPlanPenaltyRate(),
            rmdEligible: false,
            rmdStartAge: null
        };
    }

    return {
        accountType,
        taxable: !!source.taxable,
        earlyWithdrawalPenaltyRate: 0,
        rmdEligible: false,
        rmdStartAge: null
    };
}

export function applyRetirementAccountTaxTreatment({
    source,
    withdrawal,
    currentAge,
    currentTaxableIncome
}) {

    const rules =
        getRetirementAccountDistributionRules(source, currentAge);
    const taxableAmount =
        rules.taxable ? withdrawal : 0;
    const incomeTax =
        calculateFederalIncomeTax(
            currentTaxableIncome + taxableAmount
        ) - calculateFederalIncomeTax(currentTaxableIncome);
    const earlyWithdrawalPenalty =
        withdrawal * rules.earlyWithdrawalPenaltyRate;

    return {
        accountType: rules.accountType,
        grossWithdrawal: withdrawal,
        netWithdrawal:
            withdrawal - incomeTax - earlyWithdrawalPenalty,
        taxableAmount,
        incomeTax,
        earlyWithdrawalPenalty
    };
}

export function projectTotalRetirement({
    incomeSources,
    currentAge: startingAge = null,
    spouseCurrentAge = null,
    spouseRetirementAge = null,
    spouseAnnualIncome = 0,
    currentAnnualPay = 0,
    expectedFinalAnnualPay = 0,
    retireAge,
    lifeExpectancy,
    baseExpenses,
    expenseModel = null,
    inflation,
    inflationModel = null,
    showReal = false,
    marketFirst = false
}) {

    let results = [];
    let cumulativeShortfall = 0;
    let firstDeficitYear = null;
    let depletionAges = {};

    const projectionStartAge =
        Number.isFinite(startingAge)
            ? startingAge
            : retireAge;
    const preRetirementYears =
        Number.isFinite(projectionStartAge) &&
        Number.isFinite(retireAge) &&
        projectionStartAge < retireAge
            ? Math.max(0, Math.floor(retireAge - projectionStartAge))
            : 0;
    let years = lifeExpectancy - projectionStartAge;
    let portfolioBalances = {};
    let realEstateAssets = {};
    let mortgageDebts = {};
    const groceriesAnnual =
        (expenseModel?.groceries ?? 0) * 12;
    const billsAnnual =
        (expenseModel?.bills ?? 0) * 12;
    const autoAnnual =
        (expenseModel?.auto ?? 0) * 12;
    const otherAnnual =
        (expenseModel?.other ?? 0) * 12;
    const housingAnnual =
        (expenseModel?.housing ?? 0) * 12;
    const healthcareAnnual =
        (expenseModel?.healthcare ?? 0) * 12;
    const insuranceAnnual =
        (expenseModel?.insurance ?? 0) * 12;
    const useExpenseModel =
        groceriesAnnual > 0 ||
        billsAnnual > 0 ||
        autoAnnual > 0 ||
        otherAnnual > 0 ||
        housingAnnual > 0 ||
        healthcareAnnual > 0 ||
        insuranceAnnual > 0;
    const inflationPath =
        assumptionsOrNullArray(inflationModel?.overallPath);
    const goodsServicesInflationPath =
        assumptionsOrNullArray(inflationModel?.goodsServicesPath);
    const housingInflationPath =
        assumptionsOrNullArray(inflationModel?.housingPath);
    const healthcareInflationPath =
        assumptionsOrNullArray(inflationModel?.healthcarePath);

    function assumptionsOrNullArray(value) {
        return Array.isArray(value) ? value : null;
    }

    function getRateForYear({
        baseRate = 0,
        path = null,
        yearIndex = 0
    }) {
        if (
            Array.isArray(path) &&
            Number.isFinite(path[yearIndex])
        ) {
            return path[yearIndex];
        }

        return baseRate || 0;
    }

    function buildCumulativeFactorSeries({
        baseRate = 0,
        path = null,
        length = 0
    }) {
        const series = [1];

        for (let yearIndex = 0; yearIndex < length; yearIndex += 1) {
            const annualRate = getRateForYear({
                baseRate,
                path,
                yearIndex
            });

            series.push(series[yearIndex] * (1 + annualRate));
        }

        return series;
    }

    function compoundSourceGrowth(source, periods) {
        let factor = 1;

        for (let yearIndex = 0; yearIndex < periods; yearIndex += 1) {
            const annualRate = getRateForYear({
                baseRate: source?.growthRate || 0,
                path: source?.growthRatePath,
                yearIndex
            });

            factor *= (1 + annualRate);
        }

        return factor;
    }

    function getContributionIncomeForYear(source, yearIndex) {
        const sourceCurrentAnnualIncome =
            Number.isFinite(source?.currentAnnualIncome)
                ? source.currentAnnualIncome
                : null;
        const sourceExpectedFinalAnnualIncome =
            Number.isFinite(source?.expectedFinalAnnualIncome)
                ? source.expectedFinalAnnualIncome
                : null;

        if (sourceCurrentAnnualIncome !== null) {
            if (
                sourceExpectedFinalAnnualIncome !== null &&
                preRetirementYears > 0
            ) {
                const annualStep =
                    (sourceExpectedFinalAnnualIncome - sourceCurrentAnnualIncome) /
                    preRetirementYears;

                return Math.max(
                    sourceCurrentAnnualIncome + (annualStep * yearIndex),
                    0
                );
            }

            return Math.max(sourceCurrentAnnualIncome, 0);
        }

        return getAmortizedAnnualPay({
            currentAnnualPay,
            expectedFinalAnnualPay,
            yearIndex,
            totalYears: preRetirementYears
        });
    }

    function getSourceGrowthRateForYear(source, yearIndex) {
        return getRateForYear({
            baseRate: source?.growthRate || 0,
            path: source?.growthRatePath,
            yearIndex
        });
    }

    const inflationFactorSeries =
        buildCumulativeFactorSeries({
            baseRate: inflation,
            path: inflationPath,
            length: years + 1
        });
    const goodsServicesInflationSeries =
        buildCumulativeFactorSeries({
            baseRate: inflationModel?.goodsServices ?? inflation,
            path: goodsServicesInflationPath,
            length: years + 1
        });
    const housingInflationSeries =
        buildCumulativeFactorSeries({
            baseRate: inflationModel?.housing ?? inflation,
            path: housingInflationPath,
            length: years + 1
        });
    const healthcareInflationSeries =
        buildCumulativeFactorSeries({
            baseRate: inflationModel?.healthcare ?? inflation,
            path: healthcareInflationPath,
            length: years + 1
        });

    function calculateAnnualExpenses(year) {
        if (!useExpenseModel) {
            return {
                total:
                    baseExpenses * inflationFactorSeries[year],
                breakdown: null
            };
        }
        const breakdown = {
            groceries:
                groceriesAnnual * goodsServicesInflationSeries[year],
            bills:
                billsAnnual * goodsServicesInflationSeries[year],
            auto:
                autoAnnual * goodsServicesInflationSeries[year],
            other:
                otherAnnual * goodsServicesInflationSeries[year],
            housing:
                housingAnnual * housingInflationSeries[year],
            healthcare:
                healthcareAnnual * healthcareInflationSeries[year],
            insurance:
                insuranceAnnual * goodsServicesInflationSeries[year]
        };

        breakdown.goodsServices =
            breakdown.groceries +
            breakdown.bills +
            breakdown.auto +
            breakdown.other;
        breakdown.essential =
            breakdown.housing +
            breakdown.groceries +
            breakdown.bills +
            breakdown.healthcare +
            breakdown.insurance;
        breakdown.discretionary =
            breakdown.auto +
            breakdown.other;

        return {
            total:
                breakdown.goodsServices +
                breakdown.housing +
                breakdown.healthcare +
                breakdown.insurance,
            breakdown
        };
    }

    const orderedIncomeSources =
        orderIncomeSourcesForProjection(incomeSources);

    function advancePortfolioBalance({
        balance,
        growthRate = 0,
        annualContribution = 0
    }) {
        const startingBalance = Math.max(balance || 0, 0);
        const annualGrowth = growthRate || 0;
        const contributionAmount =
            Math.max(annualContribution || 0, 0);

        const nextBalance =
            (startingBalance * (1 + annualGrowth)) +
            contributionAmount;

        return nextBalance < 1 ? 0 : nextBalance;
    }

    function getAmortizedAnnualPay({
        currentAnnualPay: startingAnnualPay,
        expectedFinalAnnualPay: endingAnnualPay,
        yearIndex,
        totalYears
    }) {
        const startingPay = Math.max(startingAnnualPay || 0, 0);
        const endingPay = Math.max(endingAnnualPay || 0, 0);
        const fallbackStart =
            startingPay > 0 ? startingPay : endingPay;
        const fallbackEnd =
            endingPay > 0 ? endingPay : startingPay;

        if (totalYears <= 0) {
            return fallbackEnd;
        }

        if (totalYears === 1) {
            return fallbackEnd;
        }

        const progress = yearIndex / (totalYears - 1);

        return fallbackStart + ((fallbackEnd - fallbackStart) * progress);
    }

    function getEmploymentIncome(currentAge) {
        if (
            !Number.isFinite(projectionStartAge) ||
            !Number.isFinite(retireAge) ||
            currentAge >= retireAge
        ) {
            return 0;
        }

        return getAmortizedAnnualPay({
            currentAnnualPay,
            expectedFinalAnnualPay,
            yearIndex: Math.max(0, currentAge - projectionStartAge),
            totalYears: preRetirementYears
        });
    }

    function getSpouseEmploymentIncome(currentAge) {
        if (
            !Number.isFinite(spouseCurrentAge) ||
            !Number.isFinite(spouseRetirementAge) ||
            spouseAnnualIncome <= 0
        ) {
            return 0;
        }

        const spouseAgeAtYear =
            spouseCurrentAge +
            Math.max(0, currentAge - projectionStartAge);

        if (spouseAgeAtYear >= spouseRetirementAge) {
            return 0;
        }

        return spouseAnnualIncome;
    }

    // Initialize balances
orderedIncomeSources.forEach(source => {

    if (source.type === "portfolio") {
        portfolioBalances[source.name] = source.balance;
    }


});

    for (let year = 0; year <= years; year++) {

        let currentAge = projectionStartAge + year;
        let totalIncome = 0;
        let totalTaxes = 0;
        let yearlyTaxableIncome = 0;
        let yearlySocialSecurityIncome = 0;
        let yearlyBreakdown = {};
        let supplementalExpenses = 0;
        const employmentIncome = getEmploymentIncome(currentAge);
        const spouseIncome = getSpouseEmploymentIncome(currentAge);
        const annualExpenseResult = calculateAnnualExpenses(year);

        if (employmentIncome > 0) {
            totalIncome += employmentIncome;
            yearlyBreakdown["Employment Income"] = employmentIncome;
            totalTaxes +=
                calculateFederalIncomeTax(
                    yearlyTaxableIncome + employmentIncome
                ) - calculateFederalIncomeTax(yearlyTaxableIncome);
            yearlyTaxableIncome += employmentIncome;
        }

        if (spouseIncome > 0) {
            totalIncome += spouseIncome;
            yearlyBreakdown["Spouse Income"] = spouseIncome;
            totalTaxes +=
                calculateFederalIncomeTax(
                    yearlyTaxableIncome + spouseIncome
                ) - calculateFederalIncomeTax(yearlyTaxableIncome);
            yearlyTaxableIncome += spouseIncome;
        }

        orderedIncomeSources.forEach(source => {
// ===============================
// REAL ESTATE PROJECTION
// ===============================
if (source.type === "real_estate") {

    const value =
        source.value *
        compoundSourceGrowth(source, year);

    realEstateAssets[source.name] = value;

    const mortgage = source.mortgage;

    if (mortgage) {

        const remainingYears =
            mortgage.yearsRemaining - year;

        mortgageDebts[source.name] =
            remainingYears > 0
                ? mortgage.balance *
                  (remainingYears / mortgage.yearsRemaining)
                : 0;

    } else {

        mortgageDebts[source.name] = 0;

    }

    yearlyBreakdown[source.name] =
        yearlyBreakdown[source.name] || 0;
    return;
}
            let income = 0;

            if (source.type === "expense") {
                const hasEndAge =
                    Number.isFinite(source.endAge);
                if (
                    currentAge >= source.startAge &&
                    (!hasEndAge || currentAge < source.endAge)
                ) {
                    const yearsActive = currentAge - source.startAge;
                    supplementalExpenses +=
                        source.annualAmount * compoundSourceGrowth(source, yearsActive);
                }

                return;
            }

            // ===============================
            // PORTFOLIO SOURCES
            // ===============================
            if (source.type === "portfolio") {

                let balance = portfolioBalances[source.name];
                const openingBalance = balance;

                if (balance > 0 && currentAge < source.startAge) {
                    const contributionIncome =
                        getContributionIncomeForYear(source, year);
                    const annualContribution =
                        currentAge < retireAge
                            ? contributionIncome *
                              Math.max(
                                  (source.employeeContributionRate || 0) +
                                  (source.employerMatchRate || 0),
                                  0
                              )
                            : 0;

                    portfolioBalances[source.name] =
                        advancePortfolioBalance({
                            balance,
                            growthRate: getSourceGrowthRateForYear(source, year),
                            annualContribution
                        });
                    return;
                }

                if (balance > 0 && currentAge >= source.startAge) {

                    const sustainableForever =
                        source.withdrawalType === "percent" &&
                        !Array.isArray(source.growthRatePath) &&
                        source.growthRate >= source.withdrawalRate;

                    if (sustainableForever) {
                        depletionAges[source.name] = "SUSTAINABLE";
                    }

                    if (marketFirst) {
                        balance *= (1 + getSourceGrowthRateForYear(source, year));
                    }

                    const distributionRules =
                        getRetirementAccountDistributionRules(source, currentAge);
                    const requiredMinimumDistribution =
                        getApproximateRequiredMinimumDistribution(
                            openingBalance,
                            currentAge,
                            distributionRules
                        );

                    const plannedWithdrawal =
                        getPlannedPortfolioWithdrawal({
                            source,
                            balance
                        });
                    const isRetirementAccount =
                        !!source.accountType;
                    const remainingAnnualNeed =
                        Math.max(
                            0,
                            (annualExpenseResult.total + supplementalExpenses) - totalIncome
                        );
                    const needAwareGrossWithdrawal =
                        isRetirementAccount
                            ? solveGrossWithdrawalForNetTarget({
                                source,
                                currentAge,
                                currentTaxableIncome: yearlyTaxableIncome,
                                targetNetWithdrawal: remainingAnnualNeed,
                                maxGrossWithdrawal: plannedWithdrawal
                            })
                            : plannedWithdrawal;

                    let withdrawal =
                        isRetirementAccount
                            ? needAwareGrossWithdrawal
                            : plannedWithdrawal;

                    withdrawal = Math.max(
                        withdrawal,
                        requiredMinimumDistribution
                    );

                    withdrawal = Math.min(withdrawal, balance);

                    balance -= withdrawal;

                    if (!marketFirst) {
                        balance *= (1 + getSourceGrowthRateForYear(source, year));
                    }

                    if (balance < 1) balance = 0;

                    if (
                        balance <= 0 &&
                        !depletionAges[source.name] &&
                        !sustainableForever
                    ) {
                        depletionAges[source.name] = currentAge;
                    }

                    portfolioBalances[source.name] = balance;

                    const withdrawalResult =
                        applyRetirementAccountTaxTreatment({
                            source,
                            withdrawal,
                            currentAge,
                            currentTaxableIncome: yearlyTaxableIncome
                        });

                    income = withdrawalResult.netWithdrawal;
                    totalTaxes +=
                        withdrawalResult.incomeTax +
                        withdrawalResult.earlyWithdrawalPenalty;
                    yearlyTaxableIncome +=
                        withdrawalResult.taxableAmount;
                }
            }

            // ===============================
            // FIXED INCOME SOURCES
            // ===============================
            else {

                if (
                    currentAge >= source.startAge &&
                    (!source.endAge || currentAge <= source.endAge)
                ) {

                    let yearsActive = currentAge - source.startAge;

                    income =
                        source.annualAmount *
                        compoundSourceGrowth(source, yearsActive);
                }
            }

            totalIncome += income;
            yearlyBreakdown[source.name] =
                (yearlyBreakdown[source.name] || 0) + income;

            if (source.type === "fixed") {
                if (source?.taxCategory === "social_security") {
                    yearlySocialSecurityIncome += income;
                } else {
                    const taxableAmount =
                        getFixedIncomeTaxableAmount({
                            source,
                            income,
                            currentTaxableIncome: yearlyTaxableIncome
                        });

                    if (taxableAmount > 0) {
                        totalTaxes +=
                            calculateFederalIncomeTax(
                                yearlyTaxableIncome + taxableAmount
                            ) - calculateFederalIncomeTax(yearlyTaxableIncome);
                        yearlyTaxableIncome += taxableAmount;
                    }
                }
            }
        });

        if (yearlySocialSecurityIncome > 0) {
            const socialSecurityTaxableAmount =
                calculateSocialSecurityTaxableAmount({
                    socialSecurityIncome: yearlySocialSecurityIncome,
                    otherTaxableIncome: yearlyTaxableIncome
                });

            if (socialSecurityTaxableAmount > 0) {
                totalTaxes +=
                    calculateFederalIncomeTax(
                        yearlyTaxableIncome + socialSecurityTaxableAmount
                    ) - calculateFederalIncomeTax(yearlyTaxableIncome);
                yearlyTaxableIncome += socialSecurityTaxableAmount;
            }
        }

    
        let adjustedExpenses =
            annualExpenseResult.total + supplementalExpenses;

        if (showReal) {
            const inflationFactor = inflationFactorSeries[year];
            totalIncome /= inflationFactor;
            adjustedExpenses /= inflationFactor;
        }

        let surplus = totalIncome - adjustedExpenses;

        if (surplus < 0 && firstDeficitYear === null) {
            firstDeficitYear = currentAge;
        }

        if (surplus < 0) {
            cumulativeShortfall += Math.abs(surplus);
        }

        let yearlyPortfolios = {};
let realEstateValue =
    Object.values(realEstateAssets)
        .reduce((s,v)=>s+(v||0),0);

let mortgageBalance =
    Object.values(mortgageDebts)
        .reduce((s,v)=>s+(v||0),0);

let netWorth =
    realEstateValue +
    Object.values(portfolioBalances).reduce((s,v)=>s+(v||0),0) -
    mortgageBalance;
        const displayedExpenseBreakdown =
            annualExpenseResult.breakdown
                ? structuredClone(annualExpenseResult.breakdown)
                : null;

        if (showReal) {
            const inflationFactor = inflationFactorSeries[year];

            if (displayedExpenseBreakdown) {
                Object.keys(displayedExpenseBreakdown).forEach(key => {
                    displayedExpenseBreakdown[key] =
                        (displayedExpenseBreakdown[key] || 0) / inflationFactor;
                });
            }

            Object.keys(portfolioBalances).forEach(name => {
                yearlyPortfolios[name] =
                    (portfolioBalances[name] || 0) / inflationFactor;
            });

            realEstateValue /= inflationFactor;
            mortgageBalance /= inflationFactor;
            netWorth /= inflationFactor;
        } else {
            Object.keys(portfolioBalances).forEach(name => {
                yearlyPortfolios[name] = portfolioBalances[name];
            });
        }

       results.push({
    age: currentAge,
    income: totalIncome,
    totalIncome: totalIncome,
    taxes: totalTaxes,
    taxableIncome: yearlyTaxableIncome,
    expenses: adjustedExpenses,
    surplus,
    breakdown: yearlyBreakdown,
    expenseBreakdown: displayedExpenseBreakdown,
    portfolios: yearlyPortfolios,
    realEstateValue,
    mortgageBalance,
    netWorth
});
    }

    return {
        results,
        cumulativeShortfall,
        firstDeficitYear,
        depletionAges,
        retireAge,
        projectionStartAge
    };
}
