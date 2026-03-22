export function syncProfileBirthYearToSocialSecurity() {

    const birthEl = document.getElementById("birthYear");
    const ssEl = document.getElementById("ssBirthYear");

    if (!birthEl || !ssEl) return;

    const syncBirth = () => {
        if (birthEl.value) {
            ssEl.value = birthEl.value;
        }
    };

    birthEl.addEventListener("input", syncBirth);
    birthEl.addEventListener("change", syncBirth);
    syncBirth();
}

export function loadProfileModule(assetRegistry) {

    const container = document.getElementById("profileModuleContainer");

    if (!container || container.children.length > 0) return;

    const profileModule = assetRegistry.get("profile");

    if (!profileModule || typeof profileModule.createCard !== "function") {
        return;
    }

    const card = profileModule.createCard();
    container.appendChild(card);

    syncProfileBirthYearToSocialSecurity();
}

export function buildAssetButtons(assetRegistry, {
    assetBarId = "assetButtonBar",
    retirementBarId = "retirementButtonBar",
    debtBarId = "debtButtonBar",
    buttonClassName = ""
} = {}) {

    const assetBar = document.getElementById(assetBarId);
    const retirementBar = document.getElementById(retirementBarId);
    const debtBar = document.getElementById(debtBarId);

    assetRegistry.getAll().forEach(asset => {

        if (asset.type === "income") return;
        if (asset.id === "profile") return;

        const button = document.createElement("button");
        button.textContent =
            asset.id === "debt" ? "Add Debt" : asset.name;

        if (buttonClassName) {
            button.className = buttonClassName;
        }

        button.addEventListener("click", () => {

            if (typeof asset.createCard !== "function") return;

            const card = asset.createCard();
            const container = assetRegistry.resolveMountContainer(asset);

            if (card && container) {
                container.appendChild(card);
            }
        });

        if (asset.type === "retirement") {
            retirementBar?.appendChild(button);
        } else if (asset.type === "debt") {
            debtBar?.appendChild(button);
        } else {
            assetBar?.appendChild(button);
        }
    });
}
