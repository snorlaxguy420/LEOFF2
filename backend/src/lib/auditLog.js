import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { config } from "../config.js";
import { createId, normalizeEmail } from "./security.js";
import { getClientIpHash, hashIdentifier } from "./requestIdentity.js";

let pool = null;

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
        throw new Error("DATABASE_URL is required for PostgreSQL audit logs.");
    }

    if (!pool) {
        pool = new Pool({
            connectionString: config.databaseUrl,
            ssl: getSslConfig(),
            max: 2
        });
    }

    return pool;
}

function getAuditBackend() {
    return config.dataBackend === "postgres" && config.databaseUrl
        ? "postgres"
        : "file";
}

function sanitizeMetadata(metadata = {}) {
    const sanitized = {};

    for (const [key, value] of Object.entries(metadata || {})) {
        if (value === undefined) {
            continue;
        }

        if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
            sanitized[key] = value;
        }
    }

    return sanitized;
}

export function hashAuditEmail(email) {
    const normalized = normalizeEmail(email);

    return normalized ? hashIdentifier(normalized) : null;
}

async function writePostgresAuditEvent(event) {
    await getPool().query(
        `
            INSERT INTO audit_events (
                id,
                action,
                outcome,
                actor_user_id,
                target_user_id,
                client_ip_hash,
                email_hash,
                metadata,
                created_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
        `,
        [
            event.id,
            event.action,
            event.outcome,
            event.actorUserId,
            event.targetUserId,
            event.clientIpHash,
            event.emailHash,
            JSON.stringify(event.metadata),
            event.createdAt
        ]
    );
}

async function writeFileAuditEvent(event) {
    const directory = path.dirname(config.auditLogPath);

    await fs.mkdir(directory, { recursive: true });
    await fs.appendFile(
        config.auditLogPath,
        `${JSON.stringify(event)}\n`,
        "utf8"
    );
}

export async function recordAuditEvent({
    req = null,
    action,
    outcome,
    actorUserId = null,
    targetUserId = null,
    email = null,
    metadata = {}
} = {}) {
    if (!action || !outcome) {
        return;
    }

    const event = {
        id: createId("audit"),
        action: String(action),
        outcome: String(outcome),
        actorUserId: actorUserId || null,
        targetUserId: targetUserId || null,
        clientIpHash: req ? getClientIpHash(req) : null,
        emailHash: email ? hashAuditEmail(email) : null,
        metadata: sanitizeMetadata(metadata),
        createdAt: new Date().toISOString()
    };

    try {
        if (getAuditBackend() === "postgres") {
            await writePostgresAuditEvent(event);
            return;
        }

        await writeFileAuditEvent(event);
    } catch (error) {
        console.warn("Audit event write failed.", {
            action: event.action,
            outcome: event.outcome,
            message: error?.message
        });
    }
}
