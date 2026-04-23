import { normalizeEmail } from "./lib/security.js";
import { withStore } from "./lib/store.js";
import { recordAuditEvent } from "./lib/auditLog.js";

function printUsage() {
    console.log(
        [
            "Usage:",
            "  node ./src/setUserPlanTier.js <email> <free|premium> [source] [premiumExpiresAtIso]",
            "",
            "Examples:",
            "  node ./src/setUserPlanTier.js geoff@example.com premium manual",
            "  node ./src/setUserPlanTier.js geoff@example.com premium manual 2026-12-31T23:59:59.000Z",
            "  node ./src/setUserPlanTier.js geoff@example.com free"
        ].join("\n")
    );
}

function normalizePlanTier(value) {
    return String(value || "").trim().toLowerCase() === "premium"
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

    if (Number.isNaN(parsed.getTime())) {
        throw new Error("premiumExpiresAtIso must be a valid ISO timestamp.");
    }

    return parsed.toISOString();
}

async function main() {
    const [, , emailArg, tierArg, sourceArg, expiresAtArg] = process.argv;
    const email = normalizeEmail(emailArg);

    if (!email || !tierArg) {
        printUsage();
        process.exitCode = 1;
        return;
    }

    const planTier = normalizePlanTier(tierArg);
    const premiumSource =
        planTier === "premium"
            ? normalizePremiumSource(sourceArg) || "manual"
            : null;
    const premiumExpiresAt =
        planTier === "premium"
            ? normalizeIsoDate(expiresAtArg)
            : null;
    let updatedUser = null;

    await withStore(store => ({
        ...store,
        users: store.users.map(user => {
            if (user.email !== email) {
                return user;
            }

            updatedUser = {
                ...user,
                planTier,
                premiumSource,
                premiumGrantedAt:
                    planTier === "premium"
                        ? new Date().toISOString()
                        : null,
                premiumExpiresAt,
                updatedAt: new Date().toISOString()
            };

            return updatedUser;
        })
    }));

    if (!updatedUser) {
        await recordAuditEvent({
            action: "account.tier_update",
            outcome: "failed",
            email,
            metadata: {
                reason: "user_not_found",
                planTier
            }
        });
        throw new Error(`No user found for ${email}.`);
    }

    await recordAuditEvent({
        action: "account.tier_update",
        outcome: "success",
        targetUserId: updatedUser.id,
        email: updatedUser.email,
        metadata: {
            planTier: updatedUser.planTier,
            premiumSource: updatedUser.premiumSource || "none",
            hasPremiumExpiry: Boolean(updatedUser.premiumExpiresAt)
        }
    });

    console.log(
        JSON.stringify(
            {
                email: updatedUser.email,
                planTier: updatedUser.planTier,
                premiumSource: updatedUser.premiumSource,
                premiumGrantedAt: updatedUser.premiumGrantedAt,
                premiumExpiresAt: updatedUser.premiumExpiresAt
            },
            null,
            2
        )
    );
}

main().catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
});
