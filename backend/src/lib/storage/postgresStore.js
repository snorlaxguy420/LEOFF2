import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { config } from "../../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCHEMA_PATH = path.join(__dirname, "schema.sql");
const ADVISORY_LOCK_KEY = 2147482647;

const DEFAULT_STORE = Object.freeze({
    users: [],
    sessions: [],
    plans: [],
    passwordResetTokens: []
});

function cloneDefaultStore() {
    return JSON.parse(JSON.stringify(DEFAULT_STORE));
}

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

function normalizeStoreShape(store = {}) {
    return {
        ...cloneDefaultStore(),
        ...store,
        users: Array.isArray(store?.users)
            ? store.users.map(normalizeUserRecord)
            : [],
        sessions: Array.isArray(store?.sessions) ? store.sessions : [],
        plans: Array.isArray(store?.plans) ? store.plans : [],
        passwordResetTokens: Array.isArray(store?.passwordResetTokens)
            ? store.passwordResetTokens
            : []
    };
}

let pool = null;
let schemaPromise = null;

function getSslConfig() {
    if (!config.databaseSsl) {
        return false;
    }

    return {
        rejectUnauthorized: false
    };
}

function getPool() {
    if (!config.databaseUrl) {
        throw new Error(
            "DATABASE_URL is required when DATA_BACKEND=postgres."
        );
    }

    if (!pool) {
        pool = new Pool({
            connectionString: config.databaseUrl,
            ssl: getSslConfig(),
            max: 5
        });
    }

    return pool;
}

async function loadSchemaSql() {
    return fs.readFile(SCHEMA_PATH, "utf8");
}

export async function ensurePostgresSchema() {
    if (!schemaPromise) {
        schemaPromise = (async () => {
            const sql = await loadSchemaSql();
            const db = getPool();
            await db.query(sql);
        })().catch(error => {
            schemaPromise = null;
            throw error;
        });
    }

    await schemaPromise;
}

function mapUserRow(row) {
    return normalizeUserRecord({
        id: row.id,
        email: row.email,
        passwordHash: row.password_hash,
        passwordSalt: row.password_salt,
        displayName: row.display_name,
        retirementCheckInFrequency: row.retirement_check_in_frequency,
        lastRetirementCheckInSentAt: row.last_retirement_check_in_sent_at,
        planTier: row.plan_tier,
        premiumSource: row.premium_source,
        premiumGrantedAt: row.premium_granted_at,
        premiumExpiresAt: row.premium_expires_at,
        createdAt: normalizeIsoDate(row.created_at),
        updatedAt: normalizeIsoDate(row.updated_at)
    });
}

function mapSessionRow(row) {
    return {
        id: row.id,
        userId: row.user_id,
        tokenHash: row.token_hash,
        createdAt: normalizeIsoDate(row.created_at),
        expiresAt: normalizeIsoDate(row.expires_at)
    };
}

function mapPasswordResetRow(row) {
    return {
        id: row.id,
        userId: row.user_id,
        tokenHash: row.token_hash,
        createdAt: normalizeIsoDate(row.created_at),
        expiresAt: normalizeIsoDate(row.expires_at),
        usedAt: normalizeIsoDate(row.used_at)
    };
}

function mapPlanRow(row) {
    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        simulationState: row.simulation_state,
        workspaceState: row.workspace_state,
        createdAt: normalizeIsoDate(row.created_at),
        updatedAt: normalizeIsoDate(row.updated_at)
    };
}

async function readStoreFromClient(client) {
    const usersResult = await client.query(
        "SELECT * FROM users ORDER BY created_at ASC, id ASC"
    );
    const sessionsResult = await client.query(
        "SELECT * FROM sessions ORDER BY created_at ASC, id ASC"
    );
    const passwordResetResult = await client.query(
        "SELECT * FROM password_reset_tokens ORDER BY created_at ASC, id ASC"
    );
    const plansResult = await client.query(
        "SELECT * FROM plans ORDER BY updated_at DESC, id ASC"
    );

    return normalizeStoreShape({
        users: usersResult.rows.map(mapUserRow),
        sessions: sessionsResult.rows.map(mapSessionRow),
        passwordResetTokens: passwordResetResult.rows.map(mapPasswordResetRow),
        plans: plansResult.rows.map(mapPlanRow)
    });
}

async function deleteMissingRows(client, tableName, keepIds) {
    const result = await client.query(`SELECT id FROM ${tableName}`);
    const existingIds = result.rows.map(row => row.id);
    const keepSet = new Set(keepIds);
    const idsToDelete = existingIds.filter(id => !keepSet.has(id));

    if (!idsToDelete.length) {
        return;
    }

    await client.query(
        `DELETE FROM ${tableName} WHERE id = ANY($1::text[])`,
        [idsToDelete]
    );
}

async function syncUsers(client, users) {
    for (const user of users) {
        await client.query(
            `
                INSERT INTO users (
                    id,
                    email,
                    password_hash,
                    password_salt,
                    display_name,
                    retirement_check_in_frequency,
                    last_retirement_check_in_sent_at,
                    plan_tier,
                    premium_source,
                    premium_granted_at,
                    premium_expires_at,
                    created_at,
                    updated_at
                )
                VALUES (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
                )
                ON CONFLICT (id) DO UPDATE SET
                    email = EXCLUDED.email,
                    password_hash = EXCLUDED.password_hash,
                    password_salt = EXCLUDED.password_salt,
                    display_name = EXCLUDED.display_name,
                    retirement_check_in_frequency = EXCLUDED.retirement_check_in_frequency,
                    last_retirement_check_in_sent_at = EXCLUDED.last_retirement_check_in_sent_at,
                    plan_tier = EXCLUDED.plan_tier,
                    premium_source = EXCLUDED.premium_source,
                    premium_granted_at = EXCLUDED.premium_granted_at,
                    premium_expires_at = EXCLUDED.premium_expires_at,
                    created_at = EXCLUDED.created_at,
                    updated_at = EXCLUDED.updated_at
            `,
            [
                user.id,
                user.email,
                user.passwordHash,
                user.passwordSalt,
                user.displayName || "",
                normalizeRetirementCheckInFrequency(
                    user.retirementCheckInFrequency
                ),
                normalizeIsoDate(user.lastRetirementCheckInSentAt),
                normalizePlanTier(user.planTier),
                normalizePremiumSource(user.premiumSource),
                normalizeIsoDate(user.premiumGrantedAt),
                normalizeIsoDate(user.premiumExpiresAt),
                user.createdAt,
                user.updatedAt
            ]
        );
    }

    await deleteMissingRows(
        client,
        "users",
        users.map(user => user.id)
    );
}

async function syncSessions(client, sessions) {
    for (const session of sessions) {
        await client.query(
            `
                INSERT INTO sessions (
                    id,
                    user_id,
                    token_hash,
                    created_at,
                    expires_at
                )
                VALUES ($1,$2,$3,$4,$5)
                ON CONFLICT (id) DO UPDATE SET
                    user_id = EXCLUDED.user_id,
                    token_hash = EXCLUDED.token_hash,
                    created_at = EXCLUDED.created_at,
                    expires_at = EXCLUDED.expires_at
            `,
            [
                session.id,
                session.userId,
                session.tokenHash,
                session.createdAt,
                session.expiresAt
            ]
        );
    }

    await deleteMissingRows(
        client,
        "sessions",
        sessions.map(session => session.id)
    );
}

async function syncPasswordResetTokens(client, tokens) {
    for (const token of tokens) {
        await client.query(
            `
                INSERT INTO password_reset_tokens (
                    id,
                    user_id,
                    token_hash,
                    created_at,
                    expires_at,
                    used_at
                )
                VALUES ($1,$2,$3,$4,$5,$6)
                ON CONFLICT (id) DO UPDATE SET
                    user_id = EXCLUDED.user_id,
                    token_hash = EXCLUDED.token_hash,
                    created_at = EXCLUDED.created_at,
                    expires_at = EXCLUDED.expires_at,
                    used_at = EXCLUDED.used_at
            `,
            [
                token.id,
                token.userId,
                token.tokenHash,
                token.createdAt,
                token.expiresAt,
                normalizeIsoDate(token.usedAt)
            ]
        );
    }

    await deleteMissingRows(
        client,
        "password_reset_tokens",
        tokens.map(token => token.id)
    );
}

async function syncPlans(client, plans) {
    for (const plan of plans) {
        await client.query(
            `
                INSERT INTO plans (
                    id,
                    user_id,
                    name,
                    simulation_state,
                    workspace_state,
                    created_at,
                    updated_at
                )
                VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7)
                ON CONFLICT (id) DO UPDATE SET
                    user_id = EXCLUDED.user_id,
                    name = EXCLUDED.name,
                    simulation_state = EXCLUDED.simulation_state,
                    workspace_state = EXCLUDED.workspace_state,
                    created_at = EXCLUDED.created_at,
                    updated_at = EXCLUDED.updated_at
            `,
            [
                plan.id,
                plan.userId,
                plan.name,
                JSON.stringify(plan.simulationState || {}),
                JSON.stringify(plan.workspaceState || {}),
                plan.createdAt,
                plan.updatedAt
            ]
        );
    }

    await deleteMissingRows(
        client,
        "plans",
        plans.map(plan => plan.id)
    );
}

async function syncStoreToClient(client, nextStore) {
    const normalized = normalizeStoreShape(nextStore);

    await syncUsers(client, normalized.users);
    await syncSessions(client, normalized.sessions);
    await syncPasswordResetTokens(client, normalized.passwordResetTokens);
    await syncPlans(client, normalized.plans);

    return normalized;
}

export async function readStore() {
    await ensurePostgresSchema();

    const client = await getPool().connect();

    try {
        return await readStoreFromClient(client);
    } finally {
        client.release();
    }
}

export async function writeStore(nextStore) {
    await ensurePostgresSchema();

    const client = await getPool().connect();

    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock($1)", [ADVISORY_LOCK_KEY]);
        const writtenStore = await syncStoreToClient(client, nextStore);
        await client.query("COMMIT");
        return writtenStore;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function withStore(mutator) {
    await ensurePostgresSchema();

    const client = await getPool().connect();

    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock($1)", [ADVISORY_LOCK_KEY]);
        const store = await readStoreFromClient(client);
        const nextStore = await mutator(store);

        if (!nextStore) {
            throw new Error("Store mutator must return the next store value.");
        }

        const writtenStore = await syncStoreToClient(client, nextStore);
        await client.query("COMMIT");
        return writtenStore;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
