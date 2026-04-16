/* =========================================================
   REAL ESTATE ENGINE
   ---------------------------------------------------------
   Centralized financial modeling for real estate assets.

   Responsibilities
   ---------------------------------------------------------
   • Mortgage amortization math
   • Property appreciation
   • Property operating costs
   • Rental income modeling
   • Equity calculation

   This engine DOES NOT talk directly to the simulator.
   It returns standardized simulation payloads which
   the realEstate module forwards into the system.

   Design Goal
   ---------------------------------------------------------
   Keep UI modules clean and move financial math here.

   Real estate is treated as:
       • balance sheet asset
       • NOT a withdrawable portfolio
========================================================= */


/* =========================================================
   HELPER — Mortgage Payment
========================================================= */

export function calculateMonthlyMortgagePayment(
    balance,
    rate,
    years
){

    if (!balance || !years) return 0;

    const monthlyRate = rate / 12;
    const payments = years * 12;

    if (!monthlyRate) {
        return balance / payments;
    }

    return (
        balance *
        (monthlyRate * Math.pow(1 + monthlyRate, payments)) /
        (Math.pow(1 + monthlyRate, payments) - 1)
    );

}

export function calculateAnnualMortgagePayment(
    balance,
    rate,
    years,
    extraMonthlyPrincipal = 0
){

    const monthlyPayment =
        calculateMonthlyMortgagePayment(
            balance,
            rate,
            years
        ) + Math.max(extraMonthlyPrincipal || 0, 0);

    return monthlyPayment * 12;

}

export function calculateMortgageYearsToPayoff(
    balance,
    rate,
    years,
    extraMonthlyPrincipal = 0
) {

    if (!balance || !years) return 0;

    const scheduledMonthlyPayment =
        calculateMonthlyMortgagePayment(balance, rate, years);
    const totalMonthlyPayment =
        scheduledMonthlyPayment + Math.max(extraMonthlyPrincipal || 0, 0);

    if (totalMonthlyPayment <= 0) {
        return 0;
    }

    const monthlyRate = rate / 12;

    if (!monthlyRate) {
        return (balance / totalMonthlyPayment) / 12;
    }

    if (totalMonthlyPayment <= balance * monthlyRate) {
        return years;
    }

    const months =
        Math.log(totalMonthlyPayment / (totalMonthlyPayment - balance * monthlyRate)) /
        Math.log(1 + monthlyRate);

    return months / 12;

}


/* =========================================================
   HELPER — Mortgage Balance After N Years
========================================================= */

export function remainingMortgageBalance(
    balance,
    rate,
    yearsRemaining,
    yearsElapsed
){

    if (!balance || !rate || !yearsRemaining) return 0;

    const monthlyRate = rate / 12;
    const totalPayments = yearsRemaining * 12;
    const paymentsMade = yearsElapsed * 12;

    if (paymentsMade >= totalPayments) return 0;

    const monthlyPayment =
        balance *
        (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) /
        (Math.pow(1 + monthlyRate, totalPayments) - 1);

    const remaining =
        balance *
        Math.pow(1 + monthlyRate, paymentsMade) -
        monthlyPayment *
        (
            (Math.pow(1 + monthlyRate, paymentsMade) - 1) /
            monthlyRate
        );

    return Math.max(0, remaining);

}


/* =========================================================
   PROPERTY COST CALCULATOR
========================================================= */

export function calculateOperatingCosts({

    propertyValue,
    propertyTaxRate,
    maintenanceRate,
    insuranceCost

}){

    const propertyTax =
        propertyValue * (propertyTaxRate || 0);

    const maintenance =
        propertyValue * (maintenanceRate || 0);

    const insurance =
        insuranceCost || 0;

    return propertyTax + maintenance + insurance;

}


/* =========================================================
   RENTAL INCOME CALCULATOR
========================================================= */

export function calculateRentalIncome({

    monthlyRent,
    vacancyRate

}){

    if (!monthlyRent) return 0;

    const annualRent = monthlyRent * 12;

    const effectiveRent =
        annualRent * (1 - (vacancyRate || 0));

    return effectiveRent;

}


/* =========================================================
   PROPERTY VALUE PROJECTION
========================================================= */

export function projectPropertyValue({

    value,
    appreciation,
    years

}){

    if (!value) return 0;

    return value * Math.pow(1 + (appreciation || 0), years);

}


/* =========================================================
   MAIN ENGINE
========================================================= */

export function generateRealEstatePayloads({

    label,
    type,
    propertyValue,
    monthlyRent,
    vacancyRate,
    mortgageBalance,
    mortgageRate,
    mortgageYearsRemaining,
    mortgageExtraPrincipalPayment,
    appreciation,
    rentalGrowthRate,
    propertyTaxRate,
    maintenanceRate,
    insuranceCost,
    currentAge,
    inflation

}){

    const payloads = [];

    /* -----------------------------------------------------
       PROPERTY COSTS
    ----------------------------------------------------- */

    const annualCosts = calculateOperatingCosts({

        propertyValue,
        propertyTaxRate,
        maintenanceRate,
        insuranceCost

    });

    if (annualCosts > 0) {

        payloads.push({

            type: "expense",
            name: label + " Costs",

            startAge: currentAge,

            annualAmount: annualCosts,

            growthRate: inflation || 0,

            taxable: false

        });

    }


    /* -----------------------------------------------------
       MORTGAGE PAYMENT
    ----------------------------------------------------- */

    const mortgagePayment =
        calculateAnnualMortgagePayment(
            mortgageBalance,
            mortgageRate,
            mortgageYearsRemaining,
            mortgageExtraPrincipalPayment
        );
    const mortgagePayoffYears =
        calculateMortgageYearsToPayoff(
            mortgageBalance,
            mortgageRate,
            mortgageYearsRemaining,
            mortgageExtraPrincipalPayment
        );

    if (mortgagePayment > 0){

        payloads.push({

            type: "expense",

            name: label + " Mortgage",

            startAge: currentAge,

            endAge: currentAge + mortgagePayoffYears,

            annualAmount: mortgagePayment,

            growthRate: 0,

            taxable: false

        });

    }


    /* -----------------------------------------------------
       RENTAL INCOME
    ----------------------------------------------------- */

    const rent =
        calculateRentalIncome({
            monthlyRent,
            vacancyRate
        });

    if (rent > 0){

        payloads.push({

            type: "fixed",

            name: "Rental Income",

            startAge: currentAge,

            annualAmount: rent,

            growthRate: rentalGrowthRate || 0,

            taxable: true,
            taxCategory: "ordinary_income"

        });

    }


    /* -----------------------------------------------------
       PROPERTY VALUE TRACKING
       (Balance sheet only — not withdrawable)
    ----------------------------------------------------- */

    payloads.push({

        type: "real_estate",

        name: label,

        value: propertyValue,

        growthRate: appreciation || 0,

    mortgage: {
        balance: mortgageBalance,
        rate: mortgageRate,
        yearsRemaining: mortgagePayoffYears,
        scheduledYearsRemaining: mortgageYearsRemaining,
        extraPrincipalPayment: mortgageExtraPrincipalPayment || 0
    }

    });


    return payloads;

}
