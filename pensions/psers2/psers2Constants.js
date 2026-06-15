const PSERS2_CONSTANTS = Object.freeze({
    BENEFIT_MULTIPLIER: 0.02,
    VESTING_SERVICE_YEARS: 5,
    FULL_RETIREMENT_AGE: 65,
    AGE_60_FULL_SERVICE_YEARS: 10,
    AGE_60_FULL_RETIREMENT_AGE: 60,
    EARLY_RETIREMENT_MIN_AGE: 53,
    EARLY_RETIREMENT_MIN_SERVICE_YEARS: 20,
    EARLY_RETIREMENT_FACTORS: Object.freeze({
        53: 0.79,
        54: 0.82,
        55: 0.85,
        56: 0.88,
        57: 0.91,
        58: 0.94,
        59: 0.97,
        60: 1.00
    })
});

export default PSERS2_CONSTANTS;
