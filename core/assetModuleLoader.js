import { assetRegistry } from "../core/assetRegistry.js";

/* =========================================================
   ASSET MODULE LOADER
========================================================= */

export async function loadAssetModules() {

    const modules = [
        "../modules/assets/preciousMetals.js",
        "../modules/assets/crypto.js",
        "../modules/assets/debts.js",
        "../modules/assets/realEstate.js",
        "../modules/assets/taxAdvantagedAccounts.js",
    ];

    /* ---------- Load modules ---------- */

    for (const path of modules) {

        try {

            console.log("Loading asset module:", path);
            await import(path);

        } catch (err) {

            console.error("Failed loading module:", path, err);

        }

    }

    /* ---------- Restore module state ---------- */

    const stored = sessionStorage.getItem("retirementProjection");

    if (!stored) return;

const { moduleState } = JSON.parse(stored);

/* restore profile module */


    Object.entries(moduleState || {}).forEach(([id, state]) => {

        const module = assetRegistry.get(id);
        if (!module || !module.restoreState) return;

        const cards = module.restoreState(state);

const container = assetRegistry.resolveMountContainer(module);

if (!container) return;

const frag = document.createDocumentFragment();

if (Array.isArray(cards)) {
    cards.forEach(card => frag.appendChild(card));
} else if (cards) {
    frag.appendChild(cards);
}

container.appendChild(frag);

    });

}
