import { assetRegistry } from "../core/assetRegistry.js";


/****************************************************************
STATE MANAGER
Central source of truth for simulator
****************************************************************/

const STATE_KEY = "leoffSimulationState";

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

    saveWorkspaceState({ simulationState = null } = {}) {

        const nextState = {
            ...this.defaultState(),
            ...this.state,
            simulationState:
                simulationState ??
                this.state.simulationState ??
                null,
            moduleState: this.collectModuleState()
        };

        this.state = nextState;
        this.save();

        return nextState;

    },

    saveAll({ simulationState = null } = {}){
        return this.saveWorkspaceState({ simulationState });
    },

loadAll(){

    const saved = localStorage.getItem(STATE_KEY);

    if(!saved) return this.defaultState();

    const parsed = JSON.parse(saved);
    const moduleState =
        parsed?.moduleState ||
        (parsed && !parsed.simulationState ? parsed : null);

    this.state = {
        ...this.defaultState(),
        ...(parsed?.simulationState ? parsed : {})
    };

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
                    lifeExpectancy: null
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
            moduleState: {}
        };
    }

};
