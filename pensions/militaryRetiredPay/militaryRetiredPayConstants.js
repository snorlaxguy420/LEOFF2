const MILITARY_RETIRED_PAY_CONSTANTS = Object.freeze({
    PLANS: Object.freeze({
        FINAL_PAY: "final_pay",
        HIGH36: "high36",
        REDUX: "redux",
        BRS: "brs"
    }),
    LEGACY_MULTIPLIER_PER_YEAR: 0.025,
    BRS_MULTIPLIER_PER_YEAR: 0.02,
    REDUX_PENALTY_PER_YEAR_SHORT_OF_30: 0.01,
    REDUX_PENALTY_SERVICE_YEAR_TARGET: 30,
    DEFAULT_COLA: 0.025
});

export default MILITARY_RETIRED_PAY_CONSTANTS;
