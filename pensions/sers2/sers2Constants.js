const SERS2_CONSTANTS = Object.freeze({
    BENEFIT_MULTIPLIER: 0.02,
    VESTING_SERVICE_YEARS: 5,
    FULL_RETIREMENT_AGE: 65,
    THIRTY_YEAR_FULL_RETIREMENT_AGE: 62,
    EARLY_RETIREMENT_MIN_AGE: 55,
    EARLY_RETIREMENT_MIN_SERVICE_YEARS: 20,
    THIRTY_YEAR_SERVICE_THRESHOLD: 30,
    POST_2013_HIRE_DATE: "2013-05-01",
    LESS_THAN_30_ERF: Object.freeze({
        55: 0.4092,
        56: 0.4450,
        57: 0.4844,
        58: 0.5280,
        59: 0.5760,
        60: 0.6292,
        61: 0.6882,
        62: 0.7538,
        63: 0.8269,
        64: 0.9085
    }),
    THIRTY_PLUS_PRE_2013_ERF: Object.freeze({
        55: 0.80,
        56: 0.83,
        57: 0.86,
        58: 0.89,
        59: 0.92,
        60: 0.95,
        61: 0.98,
        62: 1.00,
        63: 1.00,
        64: 1.00
    }),
    THIRTY_PLUS_POST_2013_ERF: Object.freeze({
        55: 0.50,
        56: 0.55,
        57: 0.60,
        58: 0.65,
        59: 0.70,
        60: 0.75,
        61: 0.80,
        62: 0.85,
        63: 0.90,
        64: 0.95
    })
});

export default SERS2_CONSTANTS;
