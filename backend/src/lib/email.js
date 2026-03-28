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

export function buildPasswordResetUrl(token) {
    const url = new URL("/ui/login.html", `${getPublicSiteUrl()}/`);
    url.searchParams.set("resetToken", token);
    return url.toString();
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

export async function sendPasswordResetEmail({
    toEmail,
    displayName,
    resetUrl
}) {
    if (!config.resendApiKey || !config.emailFrom) {
        console.info(
            [
                "Password reset email delivery not configured.",
                `Requested email: ${toEmail}`,
                `Reset URL: ${resetUrl}`
            ].join(" ")
        );

        return {
            mode: "log"
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
            to: [toEmail],
            subject: "Reset your LEOFF Helper password",
            text: buildResetEmailText({
                displayName,
                resetUrl
            }),
            html: buildResetEmailHtml({
                displayName,
                resetUrl
            })
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        const error = new Error("Password reset email could not be sent.");
        error.statusCode = 502;
        error.details = errorBody;
        throw error;
    }

    return {
        mode: "resend"
    };
}
