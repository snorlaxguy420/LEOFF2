import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../../config.js";

const DEFAULT_STORE = Object.freeze({
    users: [],
    sessions: [],
    plans: [],
    passwordResetTokens: []
});

function normalizePlanTier(value) {
    return String(value || "").toLowerCase() === "premium"
        ? "premium"
        : "free";
}

function normalizePremiumSource(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized || null;
}

function normalizeIsoDate(value) {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
        ? null
        : parsed.toISOString();
}

function normalizeRetirementCheckInFrequency(value) {
    const normalized = String(value || "").trim().toLowerCase();

    if (normalized === "monthly") {
        return "monthly";
    }

    if (
        normalized === "every_6_months" ||
        normalized === "every-6-months" ||
        normalized === "semiannual"
    ) {
        return "every_6_months";
    }

    if (normalized === "yearly" || normalized === "annual") {
        return "yearly";
    }

    return "never";
}

function normalizeUserRecord(user = {}) {
    return {
        ...user,
        displayName: user.displayName || "",
        retirementCheckInFrequency:
            normalizeRetirementCheckInFrequency(user.retirementCheckInFrequency),
        lastRetirementCheckInSentAt:
            normalizeIsoDate(user.lastRetirementCheckInSentAt),
        planTier: normalizePlanTier(user.planTier),
        premiumSource: normalizePremiumSource(user.premiumSource),
        premiumGrantedAt: normalizeIsoDate(user.premiumGrantedAt),
        premiumExpiresAt: normalizeIsoDate(user.premiumExpiresAt)
    };
}

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
        users: Array.isArray(parsed?.users)
            ? parsed.users.map(normalizeUserRecord)
            : [],
        sessions: Array.isArray(parsed?.sessions) ? parsed.sessions : [],
        plans: Array.isArray(parsed?.plans) ? parsed.plans : [],
        passwordResetTokens: Array.isArray(parsed?.passwordResetTokens)
            ? parsed.passwordResetTokens
            : []
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
