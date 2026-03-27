import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

const DEFAULT_STORE = Object.freeze({
    users: [],
    sessions: [],
    plans: []
});

let writeQueue = Promise.resolve();

function cloneDefaultStore() {
    return JSON.parse(JSON.stringify(DEFAULT_STORE));
}

async function ensureStoreFile() {
    const directory = path.dirname(config.dataFilePath);

    await fs.mkdir(directory, { recursive: true });

    try {
        await fs.access(config.dataFilePath);
    } catch {
        await fs.writeFile(
            config.dataFilePath,
            JSON.stringify(cloneDefaultStore(), null, 2),
            "utf8"
        );
    }
}

export async function readStore() {
    await ensureStoreFile();

    const raw = await fs.readFile(config.dataFilePath, "utf8");
    const parsed = raw ? JSON.parse(raw) : cloneDefaultStore();

    return {
        ...cloneDefaultStore(),
        ...parsed,
        users: Array.isArray(parsed?.users) ? parsed.users : [],
        sessions: Array.isArray(parsed?.sessions) ? parsed.sessions : [],
        plans: Array.isArray(parsed?.plans) ? parsed.plans : []
    };
}

export async function writeStore(nextStore) {
    await ensureStoreFile();

    writeQueue = writeQueue.then(() =>
        fs.writeFile(
            config.dataFilePath,
            JSON.stringify(nextStore, null, 2),
            "utf8"
        )
    );

    await writeQueue;
    return nextStore;
}

export async function withStore(mutator) {
    const store = await readStore();
    const nextStore = await mutator(store);

    if (!nextStore) {
        throw new Error("Store mutator must return the next store value.");
    }

    return writeStore(nextStore);
}
