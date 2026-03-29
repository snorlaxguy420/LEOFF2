import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function readEnv(name, fallback = "") {
    const value = process.env[name];
    return value === undefined || value === null || value === ""
        ? fallback
        : value;
}

function readNumberEnv(name, fallback) {
    const value = Number(readEnv(name, fallback));
    return Number.isFinite(value) ? value : fallback;
}

function readBooleanEnv(name, fallback = false) {
    const value = String(readEnv(name, fallback ? "true" : "false"))
        .trim()
        .toLowerCase();

    if (["1", "true", "yes", "on"].includes(value)) {
        return true;
    }

    if (["0", "false", "no", "off"].includes(value)) {
        return false;
    }

    return fallback;
}

function parseOrigins(value) {
    return String(value || "")
        .split(",")
        .map(origin => origin.trim())
        .filter(Boolean);
}

export const config = {
    host: readEnv("HOST", "0.0.0.0"),
    port: readNumberEnv("PORT", 8787),
    corsOrigins: parseOrigins(
        readEnv(
            "CORS_ORIGINS",
            [
                "https://leoffhelper.com",
                "https://www.leoffhelper.com",
                "http://localhost:5500",
                "http://127.0.0.1:5500",
                "http://localhost:8123",
                "http://127.0.0.1:8123"
            ].join(",")
        )
    ),
    sessionCookieName: readEnv(
        "SESSION_COOKIE_NAME",
        "leoff_helper_session"
    ),
    sessionTtlMinutes: readNumberEnv("SESSION_TTL_MINUTES", 15),
    passwordResetTtlMinutes: readNumberEnv("PASSWORD_RESET_TTL_MINUTES", 60),
    publicSiteUrl: readEnv("PUBLIC_SITE_URL", "https://leoffhelper.com"),
    supportEmail: readEnv("SUPPORT_EMAIL", "leoffhelper@gmail.com"),
    signupSummaryRecipient: readEnv(
        "SIGNUP_SUMMARY_RECIPIENT",
        readEnv("SUPPORT_EMAIL", "leoffhelper@gmail.com")
    ),
    emailFrom: readEnv("EMAIL_FROM", ""),
    resendApiKey: readEnv("RESEND_API_KEY", ""),
    dataBackend: readEnv("DATA_BACKEND", "file").trim().toLowerCase(),
    databaseUrl: readEnv("DATABASE_URL", ""),
    databaseSsl: readBooleanEnv("DATABASE_SSL", false),
    dataFilePath: readEnv(
        "DATA_FILE_PATH",
        path.join(projectRoot, "data", "store.json")
    )
};
