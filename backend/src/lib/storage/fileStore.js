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

function normalizeProfileText(value, maxLength = 80) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, maxLength);
}

function normalizeIaffLocalNumber(value) {
    return String(value || "")
        .trim()
        .replace(/^local\s*#?/i, "")
        .replace(/^#/, "")
        .trim()
        .slice(0, 20);
}

function normalizeBirthYear(value) {
    const parsed = parseInt(value, 10);
    const currentYear = new Date().getFullYear();

    if (
        !Number.isFinite(parsed) ||
        parsed < 1900 ||
        parsed > currentYear
    ) {
        return null;
    }

    return parsed;
}

function normalizeUserRecord(user = {}) {
    return {
        ...user,
        firstName: normalizeProfileText(user.firstName),
        lastName: normalizeProfileText(user.lastName),
        iaffLocalNumber: normalizeIaffLocalNumber(user.iaffLocalNumber),
        birthYear: normalizeBirthYear(user.birthYear),
        disclaimerAcceptedAt: normalizeIsoDate(user.disclaimerAcceptedAt),
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
        plans: Array.isArray(parsed?.plans)
            ? parsed.plans.map(plan => ({
                ...plan,
                shareToken: String(plan?.shareToken || "").trim() || null,
                shareCreatedAt: normalizeIsoDate(plan?.shareCreatedAt)
            }))
            : [],
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
