import {
    calculateSocialSecurityIncomeSource
} from "../../core/socialSecurityEngine.js";

const socialSecurityModule = {

    id: "socialSecurity",
    name: "Social Security",
    type: "income",

    getSimulationPayloads(inputs) {
        return calculateSocialSecurityIncomeSource(
            inputs.socialSecurity
        );
    }
};

if (window.assetRegistry) {
    window.assetRegistry.registerAsset(socialSecurityModule);
}

export default socialSecurityModule;
