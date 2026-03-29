import { assetRegistry } from "../core/assetRegistry.js";
import {
    DEFAULT_PREMIUM_STRESS_TESTING,
    normalizePremiumStressTesting
} from "./premiumStressTesting.js";


/****************************************************************
STATE MANAGER
Central source of truth for simulator
****************************************************************/

const STATE_KEY = "leoffSimulationState";
const PORTABLE_PLAN_FORMAT = "leoff_helper_plan";
const PORTABLE_PLAN_VERSION = 1;

export const StateManager = {

    state: {},

    load() {
        const saved = localStorage.getItem(STATE_KEY);

        if (saved) {
            this.state = JSON.parse(saved);
        } else {
            this.state = this.defaultState();
        }

        return this.state;
    },

    save() {
        localStorage.setItem(STATE_KEY, JSON.stringify(this.state));
    },
    normalizeWorkspaceState(workspaceState = {}) {
        const defaults = this.defaultState();
        const nextState = workspaceState || {};
        const simulationState = {
            ...defaults.simulationState,
            ...(nextState.simulationState || {})
        };
        const comparisonState = {
            ...defaults.comparisonState,
            ...(nextState.comparisonState || {})
        };
        const premiumStressTesting =
            normalizePremiumStressTesting({
                ...defaults.premiumStressTesting,
                ...(nextState.premiumStressTesting || {})
            });

        return {
            ...defaults,
            ...nextState,
            simulationState,
            comparisonState,
            premiumStressTesting,
            moduleState: nextState.moduleState || {}
        };
    },
    collectModuleState() {

        const moduleState = {};

        assetRegistry.getAll().forEach(asset => {

            if (!asset.getState) return;

            const state = asset.getState();

            if (
                state === null ||
                state === undefined ||
                (Array.isArray(state) && state.length === 0)
            ) {
                return;
            }

            moduleState[asset.id] = state;

        });

        return moduleState;

    },

    saveWorkspaceState({
        simulationState = null,
        premiumStressTesting = null
    } = {}) {
        const defaults = this.defaultState();

        const nextState = this.normalizeWorkspaceState({
            ...this.state,
            premiumStressTesting:
                premiumStressTesting ??
                this.state.premiumStressTesting ??
                defaults.premiumStressTesting,
            simulationState:
                simulationState ??
                this.state.simulationState ??
                null,
            moduleState: this.collectModuleState()
        });

        this.state = nextState;
        this.save();

        return nextState;

    },

    saveAll({
        simulationState = null,
        premiumStressTesting = null
    } = {}){
        return this.saveWorkspaceState({
            simulationState,
            premiumStressTesting
        });
    },
    buildPortablePlan({
        simulationState = null,
        premiumStressTesting = null
    } = {}) {
        const workspaceState =
            this.normalizeWorkspaceState({
                ...this.state,
                premiumStressTesting:
                    premiumStressTesting ??
                    this.state.premiumStressTesting ??
                    this.defaultState().premiumStressTesting,
                simulationState:
                    simulationState ??
                    this.state.simulationState ??
                    null,
                moduleState: this.collectModuleState()
            });

        return {
            format: PORTABLE_PLAN_FORMAT,
            version: PORTABLE_PLAN_VERSION,
            exportedAt: new Date().toISOString(),
            workspaceState
        };
    },
    importPortablePlan(payload = {}) {
        const workspaceState =
            payload?.workspaceState ||
            payload;

        if (
            !workspaceState ||
            (
                !workspaceState.simulationState &&
                !workspaceState.moduleState
            )
        ) {
            throw new Error("Invalid LEOFF Helper plan file.");
        }

        const nextState =
            this.normalizeWorkspaceState(workspaceState);

        this.state = nextState;
        this.save();

        if (Object.keys(nextState.moduleState || {}).length > 0) {
            assetRegistry.restore(nextState.moduleState);
        }

        return nextState;
    },

loadAll(){

    const saved = localStorage.getItem(STATE_KEY);

    if(!saved) return this.defaultState();

    const parsed = JSON.parse(saved);
    const moduleState =
        parsed?.moduleState ||
        (parsed && !parsed.simulationState ? parsed : null);

    this.state = this.normalizeWorkspaceState(
        parsed?.simulationState ? parsed : {}
    );

    if (moduleState) {
        assetRegistry.restore(moduleState);
        this.state.moduleState = moduleState;
    }

    return this.state;

},

    getSimulationState() {
        return this.state?.simulationState || null;
    },

    defaultState() {
        return {
            simulationState: {
                profile: {
                    currentAge: null,
                    retirementAge: 55,
                    lifeExpectancy: null,
                    spouse: null
                },
                pension: {
                    system: "LEOFF2",
                    yearsOfService: 0,
                    finalAverageSalary: 0,
                    currentAnnualPay: 0,
                    retirementAge: 55,
                    survivorOption: "SINGLE",
                    survivorAge: null,
                    cola: 0
                },
                incomeSources: [],
                socialSecurity: {},
                expenses: {
                    monthly: 0,
                    annual: 0,
                    housing: 0,
                    groceries: 0,
                    bills: 0,
                    auto: 0,
                    healthcare: 0,
                    insurance: 0,
                    other: 0,
                    inflationRate: 0
                },
                assumptions: {
                    inflationRate: 0,
                    goodsServicesInflationRate: 0,
                    housingInflationRate: 0,
                    healthcareInflationRate: 0
                },
                toggles: {
                    showReal: false,
                    marketFirst: false
                }
            }
            ,
            comparisonState: {
                planIds: []
            },
            premiumStressTesting: {
                ...DEFAULT_PREMIUM_STRESS_TESTING
            },
            moduleState: {}
        };
    }

};
