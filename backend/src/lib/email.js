import { config } from "../config.js";

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function getPublicSiteUrl() {
    return String(config.publicSiteUrl || "https://leoffhelper.com")
        .replace(/\/+$/, "");
}

function buildAbsoluteUrl(pathname) {
    return new URL(pathname, `${getPublicSiteUrl()}/`).toString();
}

export function buildPasswordResetUrl(token) {
    const url = new URL("/ui/login.html", `${getPublicSiteUrl()}/`);
    url.searchParams.set("resetToken", token);
    return url.toString();
}

export function buildSimulatorUrl() {
    return buildAbsoluteUrl("/ui/simulator.html");
}

export function buildLoginUrl() {
    return buildAbsoluteUrl("/ui/login.html");
}

async function sendConfiguredEmail({
    toEmails,
    subject,
    text,
    html,
    missingConfigLogParts,
    missingConfigMode = "log",
    failureMessage
}) {
    if (!config.resendApiKey || !config.emailFrom) {
        console.info(missingConfigLogParts.join(" "));

        return {
            mode: missingConfigMode
        };
    }

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${config.resendApiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            from: config.emailFrom,
            to: toEmails,
            subject,
            text,
            html
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        const error = new Error(failureMessage);
        error.statusCode = 502;
        error.details = errorBody;
        throw error;
    }

    return {
        mode: "resend"
    };
}

function buildResetEmailText({ displayName, resetUrl }) {
    const name = displayName || "there";

    return [
        `Hi ${name},`,
        "",
        "We received a request to reset your LEOFF Helper password.",
        "Use the link below to choose a new password:",
        resetUrl,
        "",
        `This link expires in ${config.passwordResetTtlMinutes} minutes.`,
        `If you did not request this, you can ignore this email or contact ${config.supportEmail}.`
    ].join("\n");
}

function buildResetEmailHtml({ displayName, resetUrl }) {
    const name = escapeHtml(displayName || "there");
    const safeUrl = escapeHtml(resetUrl);
    const safeSupportEmail = escapeHtml(config.supportEmail);

    return `
        <div style="font-family:Segoe UI,Arial,sans-serif;color:#1e2f44;line-height:1.6;">
            <p>Hi ${name},</p>
            <p>We received a request to reset your LEOFF Helper password.</p>
            <p>
                <a
                    href="${safeUrl}"
                    style="display:inline-block;padding:12px 18px;border-radius:999px;background:#3f7c85;color:#ffffff;text-decoration:none;font-weight:700;"
                >
                    Reset Password
                </a>
            </p>
            <p>If the button does not open, use this link instead:</p>
            <p><a href="${safeUrl}">${safeUrl}</a></p>
            <p>This link expires in ${config.passwordResetTtlMinutes} minutes.</p>
            <p>If you did not request this, you can ignore this email or contact ${safeSupportEmail}.</p>
        </div>
    `.trim();
}

function buildWelcomeEmailText({ displayName, simulatorUrl, loginUrl }) {
    const name = displayName || "there";

    return [
        `Hi ${name},`,
        "",
        "Your LEOFF Helper account is ready.",
        `You can jump back into the simulator here: ${simulatorUrl}`,
        `If you ever need to sign in again, use: ${loginUrl}`,
        "",
        "Account perks currently include synced scenarios, account settings, and password recovery.",
        `If you did not create this account, contact ${config.supportEmail}.`
    ].join("\n");
}

function buildWelcomeEmailHtml({ displayName, simulatorUrl, loginUrl }) {
    const name = escapeHtml(displayName || "there");
    const safeSimulatorUrl = escapeHtml(simulatorUrl);
    const safeLoginUrl = escapeHtml(loginUrl);
    const safeSupportEmail = escapeHtml(config.supportEmail);

    return `
        <div style="font-family:Segoe UI,Arial,sans-serif;color:#1e2f44;line-height:1.6;">
            <p>Hi ${name},</p>
            <p>Your LEOFF Helper account is ready.</p>
            <p>
                <a
                    href="${safeSimulatorUrl}"
                    style="display:inline-block;padding:12px 18px;border-radius:999px;background:#1f4d3a;color:#ffffff;text-decoration:none;font-weight:700;"
                >
                    Open LEOFF Helper
                </a>
            </p>
            <p>You can also sign in again any time here:</p>
            <p><a href="${safeLoginUrl}">${safeLoginUrl}</a></p>
            <p>Account perks currently include synced scenarios, account settings, and password recovery.</p>
            <p>If you did not create this account, contact ${safeSupportEmail}.</p>
        </div>
    `.trim();
}

function formatSignupSummaryTimestamp(isoString) {
    const timestamp = new Date(isoString);

    if (!Number.isFinite(timestamp.getTime())) {
        return "Unknown signup time";
    }

    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Los_Angeles"
    }).format(timestamp);
}

function buildSignupSummaryText({
    recipientEmail,
    summaryStart,
    summaryEnd,
    newUsers,
    totalUsers
}) {
    const summaryLines = [
        "LEOFF Helper daily signup summary",
        "",
        `Window: ${formatSignupSummaryTimestamp(summaryStart)} to ${formatSignupSummaryTimestamp(summaryEnd)} (America/Los_Angeles)`,
        `New accounts in the last 24 hours: ${newUsers.length}`,
        `Total accounts: ${totalUsers}`,
        `Summary recipient: ${recipientEmail}`,
        ""
    ];

    if (!newUsers.length) {
        summaryLines.push("No new accounts were created in the last 24 hours.");
        return summaryLines.join("\n");
    }

    summaryLines.push("New signup emails:");
    newUsers.forEach(user => {
        summaryLines.push(
            `- ${user.email} (${formatSignupSummaryTimestamp(user.createdAt)})`
        );
    });

    return summaryLines.join("\n");
}

function buildSignupSummaryHtml({
    summaryStart,
    summaryEnd,
    newUsers,
    totalUsers
}) {
    const listMarkup = newUsers.length
        ? `
            <ul>
                ${newUsers.map(user => `
                    <li>
                        <strong>${escapeHtml(user.email)}</strong>
                        <span style="color:#5c6b75;"> - ${escapeHtml(formatSignupSummaryTimestamp(user.createdAt))}</span>
                    </li>
                `).join("")}
            </ul>
        `
        : "<p>No new accounts were created in the last 24 hours.</p>";

    return `
        <div style="font-family:Segoe UI,Arial,sans-serif;color:#1e2f44;line-height:1.6;">
            <p><strong>LEOFF Helper daily signup summary</strong></p>
            <p>Window: ${escapeHtml(formatSignupSummaryTimestamp(summaryStart))} to ${escapeHtml(formatSignupSummaryTimestamp(summaryEnd))} (America/Los_Angeles)</p>
            <p>New accounts in the last 24 hours: <strong>${newUsers.length}</strong><br>Total accounts: <strong>${totalUsers}</strong></p>
            <p><strong>New signup emails</strong></p>
            ${listMarkup}
        </div>
    `.trim();
}

export async function sendPasswordResetEmail({
    toEmail,
    displayName,
    resetUrl
}) {
    return sendConfiguredEmail({
        toEmails: [toEmail],
        subject: "Reset your LEOFF Helper password",
        text: buildResetEmailText({
            displayName,
            resetUrl
        }),
        html: buildResetEmailHtml({
            displayName,
            resetUrl
        }),
        missingConfigLogParts: [
            "Password reset email delivery not configured.",
            `Requested email: ${toEmail}`,
            `Reset URL: ${resetUrl}`
        ],
        failureMessage: "Password reset email could not be sent."
    });
}

export async function sendWelcomeEmail({
    toEmail,
    displayName
}) {
    const simulatorUrl = buildSimulatorUrl();
    const loginUrl = buildLoginUrl();

    return sendConfiguredEmail({
        toEmails: [toEmail],
        subject: "Your LEOFF Helper account is ready",
        text: buildWelcomeEmailText({
            displayName,
            simulatorUrl,
            loginUrl
        }),
        html: buildWelcomeEmailHtml({
            displayName,
            simulatorUrl,
            loginUrl
        }),
        missingConfigLogParts: [
            "Welcome email delivery not configured.",
            `Requested email: ${toEmail}`,
            `Simulator URL: ${simulatorUrl}`,
            `Login URL: ${loginUrl}`
        ],
        failureMessage: "Welcome email could not be sent."
    });
}

export async function sendDailySignupSummaryEmail({
    recipientEmail,
    summaryStart,
    summaryEnd,
    newUsers,
    totalUsers
}) {
    return sendConfiguredEmail({
        toEmails: [recipientEmail],
        subject: `LEOFF Helper daily signup summary: ${newUsers.length} new account${newUsers.length === 1 ? "" : "s"}`,
        text: buildSignupSummaryText({
            recipientEmail,
            summaryStart,
            summaryEnd,
            newUsers,
            totalUsers
        }),
        html: buildSignupSummaryHtml({
            summaryStart,
            summaryEnd,
            newUsers,
            totalUsers
        }),
        missingConfigLogParts: [
            "Daily signup summary email delivery not configured.",
            `Recipient email: ${recipientEmail}`,
            `New accounts in window: ${newUsers.length}`,
            `Signup emails: ${newUsers.length ? newUsers.map(user => user.email).join(", ") : "(none)"}`
        ],
        failureMessage: "Daily signup summary email could not be sent."
    });
}
