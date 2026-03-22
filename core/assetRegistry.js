/* =========================================================
   Asset Registry
========================================================= */

const assets = {};

export const assetRegistry = {

    registerAsset(asset) {

        /* -------------------------------------------------
           Validate Asset Definition
        ------------------------------------------------- */

        if (!asset || !asset.id) {
            console.warn("Invalid asset module:", asset);
            return;
        }

        /* -------------------------------------------------
           Prevent Duplicate Registrations
           -------------------------------------------------
           If a module is accidentally loaded twice
           (for example via dynamic imports or dev reloads),
           we ignore the duplicate instead of overwriting
           the original registered asset.
        ------------------------------------------------- */

        if (assets[asset.id]) {
            console.warn("Duplicate asset registration ignored:", asset.id);
            return;
        }

        /* -------------------------------------------------
           Register Asset
        ------------------------------------------------- */

        assets[asset.id] = asset;

        console.log("Registered asset:", asset.id);

    },

    /* -----------------------------------------------------
       Get All Registered Assets
    ----------------------------------------------------- */

    getAll() {
        return Object.values(assets);
    },

    /* -----------------------------------------------------
       Get Single Asset By ID
    ----------------------------------------------------- */

    get(id) {
        return assets[id];
    },

    resolveMountContainer(asset) {

        if (!asset) return null;

        const preferredIds = [
            asset.mount,
            asset.type === "retirement"
                ? "retirementTypeContainer"
                : null,
            asset.id === "debt" || asset.mount === "debtTypeContainer"
                ? "debtTypeContainer"
                : null,
            asset.type === "asset" || asset.type === "retirement"
                ? "assetTypeContainer"
                : null,
            asset.id === "profile"
                ? "profileModuleContainer"
                : null
        ].filter(Boolean);

        for (const id of preferredIds) {
            const container = document.getElementById(id);
            if (container) return container;
        }

        return null;

    },

    /* -----------------------------------------------------
      RESTORE
    ----------------------------------------------------- */
restore(moduleState){

    if (!moduleState) return;

    // clear existing module UI before restoring
    document
        .querySelectorAll("[data-module]")
        .forEach(el => el.remove());

    Object.entries(moduleState).forEach(([id, state]) => {

        const module = this.get(id);

        if (!module || typeof module.restoreState !== "function") return;

        const result = module.restoreState(state);

        if (!result) return;

        const container = this.resolveMountContainer(module);

        if (!container) return;

        if (Array.isArray(result)) {

            result.forEach(card => container.appendChild(card));

        } else {

            container.appendChild(result);

        }

    });

}


};

window.assetRegistry = assetRegistry;
