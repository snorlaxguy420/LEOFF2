import {
    calculateHouseholdSocialSecurityIncomeSources
} from "../../core/socialSecurityEngine.js";

const socialSecurityModule = {

    id: "socialSecurity",
    name: "Social Security",
    type: "income",

    getSimulationPayloads(inputs) {
        return calculateHouseholdSocialSecurityIncomeSources(
            inputs.socialSecurity,
            inputs.profile
        );
    }
};

if (window.assetRegistry) {
    window.assetRegistry.registerAsset(socialSecurityModule);
}

export default socialSecurityModule;
