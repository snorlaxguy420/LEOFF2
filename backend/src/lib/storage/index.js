import { config } from "../../config.js";

let adapterPromise = null;

function getBackend() {
    return config.dataBackend === "postgres"
        ? "postgres"
        : "file";
}

async function getAdapter() {
    if (!adapterPromise) {
        adapterPromise = getBackend() === "postgres"
            ? import("./postgresStore.js")
            : import("./fileStore.js");
    }

    return adapterPromise;
}

export async function readStore() {
    const adapter = await getAdapter();
    return adapter.readStore();
}

export async function writeStore(nextStore) {
    const adapter = await getAdapter();
    return adapter.writeStore(nextStore);
}

export async function withStore(mutator) {
    const adapter = await getAdapter();
    return adapter.withStore(mutator);
}

export async function ensureConfiguredStoreReady() {
    const adapter = await getAdapter();

    if (typeof adapter.ensurePostgresSchema === "function") {
        await adapter.ensurePostgresSchema();
    }
}
