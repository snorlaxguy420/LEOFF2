import { config } from "./config.js";
import {
    buildPasswordResetUrl,
    sendPasswordResetEmail,
    sendWelcomeEmail
} from "./lib/email.js";
import {
    applyCors,
    buildCookie,
    parseCookies,
    readJsonBody,
    sendError,
    sendJson,
    sendNoContent
} from "./lib/http.js";
import {
    createId,
    createSessionToken,
    hashPassword,
    hashSessionToken,
    normalizeEmail,
    verifyPassword
} from "./lib/security.js";
import {
    applyRateLimitHeaders,
    takeRateLimitToken
} from "./lib/rateLimit.js";
import { readStore, withStore } from "./lib/store.js";

function getCookieSecurity(req) {
    const forwardedProto = req.headers["x-forwarded-proto"];
    const encrypted = req.socket?.encrypted;

    return Boolean(encrypted || forwardedProto === "https");
}

function getSessionMaxAgeSeconds() {
    return config.sessionTtlMinutes * 60;
}

function buildSessionExpiryIso() {
    return new Date(
        Date.now() + (getSessionMaxAgeSeconds() * 1000)
    ).toISOString();
}

function getPasswordResetMaxAgeMs() {
    return config.passwordResetTtlMinutes * 60 * 1000;
}

function buildPasswordResetExpiryIso() {
    return new Date(
        Date.now() + getPasswordResetMaxAgeMs()
    ).toISOString();
}

function buildSessionCookieOptions(req) {
    return {
        httpOnly: true,
        path: "/",
        sameSite: "Lax",
        secure: getCookieSecurity(req),
        maxAge: getSessionMaxAgeSeconds()
    };
}

function enforceRateLimit(req, res, options) {
    const result = takeRateLimitToken({
        req,
        ...options
    });

    applyRateLimitHeaders(res, result);

    if (result.allowed) {
        return true;
    }

    sendError(
        res,
        429,
        "Too many requests. Please wait a bit and try again."
    );
    return false;
}

function sanitizeUser(user) {
    return {
        id: user.id,
        email: user.email,
        displayName: user.displayName || "",
        retirementCheckInFrequency:
            normalizeRetirementCheckInFrequency(user.retirementCheckInFrequency),
        lastRetirementCheckInSentAt:
            normalizeIsoDate(user.lastRetirementCheckInSentAt),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    };
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

function resolvePremiumFeatureFlag(rawFeatures, key, premiumActive) {
    if (!premiumActive) {
        return false;
    }

    if (
        rawFeatures &&
        typeof rawFeatures === "object" &&
        Object.prototype.hasOwnProperty.call(rawFeatures, key)
    ) {
        return Boolean(rawFeatures[key]);
    }

    return true;
}

function buildUserEntitlements(user = {}) {
    const requestedPlanTier = normalizePlanTier(user.planTier);
    const premiumExpiresAt = normalizeIsoDate(user.premiumExpiresAt);
    const premiumSource = normalizePremiumSource(user.premiumSource);
    const premiumActive =
        requestedPlanTier === "premium" &&
        (
            !premiumExpiresAt ||
            new Date(premiumExpiresAt).getTime() > Date.now()
        );
    const effectivePlanTier =
        premiumActive
            ? "premium"
            : "free";
    const rawFeatures =
        user?.features && typeof user.features === "object"
            ? user.features
            : {};

    return {
        planTier: effectivePlanTier,
        premium: premiumActive,
        premiumSource:
            premiumActive
                ? premiumSource
                : null,
        premiumExpiresAt:
            premiumActive
                ? premiumExpiresAt
                : null,
        features: {
            monteCarloPlus:
                resolvePremiumFeatureFlag(rawFeatures, "monteCarloPlus", premiumActive),
            readinessTimeline:
                resolvePremiumFeatureFlag(rawFeatures, "readinessTimeline", premiumActive),
            withdrawalStrategyOptimizer:
                resolvePremiumFeatureFlag(rawFeatures, "withdrawalStrategyOptimizer", premiumActive),
            socialSecurityOptimizer:
                resolvePremiumFeatureFlag(rawFeatures, "socialSecurityOptimizer", premiumActive),
            survivorOptionOptimizer:
                resolvePremiumFeatureFlag(rawFeatures, "survivorOptionOptimizer", premiumActive),
            estateProjection:
                resolvePremiumFeatureFlag(rawFeatures, "estateProjection", premiumActive),
            taxDetailViews:
                resolvePremiumFeatureFlag(rawFeatures, "taxDetailViews", premiumActive),
            premiumScenarioComparison:
                resolvePremiumFeatureFlag(rawFeatures, "premiumScenarioComparison", premiumActive),
            premiumStressTesting:
                resolvePremiumFeatureFlag(rawFeatures, "premiumStressTesting", premiumActive)
        }
    };
}

function buildAccountContextPayload({
    user,
    session = null
}) {
    return {
        user: sanitizeUser(user),
        entitlements: buildUserEntitlements(user),
        ...(session
            ? {
                session: {
                    expiresAt: session.expiresAt,
                    idleTimeoutMinutes: config.sessionTtlMinutes
                }
            }
            : {})
    };
}

function sanitizePlanSummary(plan) {
    return {
        id: plan.id,
        name: plan.name,
        share: sanitizePlanShare(plan),
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt
    };
}

function sanitizePlan(plan) {
    const workspaceState =
        plan.workspaceState && typeof plan.workspaceState === "object"
            ? {
                ...plan.workspaceState,
                simulationState: plan.simulationState,
                moduleState:
                    plan.workspaceState.moduleState &&
                    typeof plan.workspaceState.moduleState === "object"
                        ? plan.workspaceState.moduleState
                        : {}
            }
            : {
                simulationState: plan.simulationState,
                moduleState: {}
            };

    return {
        ...sanitizePlanSummary(plan),
        simulationState: plan.simulationState,
        workspaceState
    };
}

function buildPlanShareUrl(shareToken) {
    if (!shareToken) {
        return null;
    }

    const publicSiteUrl =
        String(config.publicSiteUrl || "https://leoffhelper.com")
            .replace(/\/+$/, "");

    return `${publicSiteUrl}/ui/retirementDashboard.html?sharedPlanToken=${encodeURIComponent(shareToken)}`;
}

function sanitizePlanShare(plan) {
    const shareToken = String(plan?.shareToken || "").trim();

    if (!shareToken) {
        return {
            enabled: false,
            url: null,
            createdAt: null
        };
    }

    return {
        enabled: true,
        url: buildPlanShareUrl(shareToken),
        createdAt: normalizeIsoDate(plan?.shareCreatedAt)
    };
}

function sanitizeSharedPlan(plan, owner = {}) {
    const workspaceState =
        plan.workspaceState && typeof plan.workspaceState === "object"
            ? {
                ...plan.workspaceState,
                simulationState: plan.simulationState,
                moduleState:
                    plan.workspaceState.moduleState &&
                    typeof plan.workspaceState.moduleState === "object"
                        ? plan.workspaceState.moduleState
                        : {}
            }
            : {
                simulationState: plan.simulationState,
                moduleState: {}
            };

    return {
        id: plan.id,
        name: plan.name,
        sharedAt: normalizeIsoDate(plan.shareCreatedAt),
        updatedAt: plan.updatedAt,
        simulationState: plan.simulationState,
        workspaceState,
        entitlements: buildUserEntitlements(owner)
    };
}

function normalizeWorkspaceStatePayload(payload = {}) {
    const rawWorkspaceState = payload?.workspaceState;
    const simulationState =
        payload?.simulationState ??
        rawWorkspaceState?.simulationState ??
        null;

    if (!simulationState || typeof simulationState !== "object") {
        return {
            error: "A simulationState object is required."
        };
    }

    if (
        rawWorkspaceState !== undefined &&
        (!rawWorkspaceState || typeof rawWorkspaceState !== "object")
    ) {
        return {
            error: "workspaceState must be an object when provided."
        };
    }

    return {
        simulationState,
        workspaceState: {
            ...(rawWorkspaceState && typeof rawWorkspaceState === "object"
                ? rawWorkspaceState
                : {}),
            simulationState,
            moduleState:
                rawWorkspaceState?.moduleState &&
                typeof rawWorkspaceState.moduleState === "object"
                    ? rawWorkspaceState.moduleState
                    : {}
        }
    };
}

function getRouteParams(pathname, routePrefix) {
    if (!pathname.startsWith(routePrefix)) {
        return null;
    }

    const id = pathname.slice(routePrefix.length).trim();
    return id || null;
}

function filterActivePasswordResetTokens(tokens = []) {
    const now = Date.now();

    return tokens.filter(entry => {
        if (!entry?.tokenHash || !entry?.userId || !entry?.expiresAt) {
            return false;
        }

        if (entry.usedAt) {
            return false;
        }

        return new Date(entry.expiresAt).getTime() > now;
    });
}

async function getAuthenticatedSession(req) {
    const cookies = parseCookies(req);
    const sessionToken = cookies[config.sessionCookieName];

    if (!sessionToken) {
        return null;
    }

    const tokenHash = hashSessionToken(sessionToken);
    const store = await readStore();
    const now = Date.now();
    const session = store.sessions.find(entry =>
        entry.tokenHash === tokenHash &&
        new Date(entry.expiresAt).getTime() > now
    );

    if (!session) {
        return null;
    }

    const user = store.users.find(entry => entry.id === session.userId);

    if (!user) {
        return null;
    }

    return {
        user,
        session,
        tokenHash,
        sessionToken
    };
}

async function handleRegister(req, res) {
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!email || !email.includes("@")) {
        sendError(res, 400, "A valid email address is required.");
        return;
    }

    if (password.length < 8) {
        sendError(res, 400, "Password must be at least 8 characters.");
        return;
    }

    const existingStore = await readStore();
    const existingUser = existingStore.users.find(user => user.email === email);

    if (existingUser) {
        sendError(res, 409, "An account with that email already exists.");
        return;
    }

    const passwordRecord = await hashPassword(password);
    const sessionToken = createSessionToken();
    const tokenHash = hashSessionToken(sessionToken);
    const now = new Date().toISOString();
    const expiresAt = buildSessionExpiryIso();
    const user = {
        id: createId("user"),
        email,
        passwordHash: passwordRecord.hash,
        passwordSalt: passwordRecord.salt,
        retirementCheckInFrequency: "never",
        lastRetirementCheckInSentAt: null,
        planTier: "free",
        premiumSource: null,
        premiumGrantedAt: null,
        premiumExpiresAt: null,
        createdAt: now,
        updatedAt: now
    };
    const session = {
        id: createId("session"),
        userId: user.id,
        tokenHash,
        createdAt: now,
        expiresAt
    };

    await withStore(store => ({
        ...store,
        users: [...store.users, user],
        sessions: [...store.sessions, session]
    }));

    try {
        await sendWelcomeEmail({
            toEmail: user.email,
            displayName: user.displayName
        });
    } catch (error) {
        console.warn(
            "Welcome email delivery failed after registration.",
            {
                email: user.email,
                message: error?.message,
                details: error?.details
            }
        );
    }

    res.setHeader(
        "Set-Cookie",
        buildCookie(
            config.sessionCookieName,
            sessionToken,
            buildSessionCookieOptions(req)
        )
    );

    sendJson(res, 201, buildAccountContextPayload({
        user,
        session
    }));
}

async function handleLogin(req, res) {
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const store = await readStore();
    const user = store.users.find(entry => entry.email === email);

    if (!user) {
        sendError(res, 401, "Invalid email or password.");
        return;
    }

    const validPassword = await verifyPassword(
        password,
        user.passwordHash,
        user.passwordSalt
    );

    if (!validPassword) {
        sendError(res, 401, "Invalid email or password.");
        return;
    }

    const sessionToken = createSessionToken();
    const tokenHash = hashSessionToken(sessionToken);
    const now = new Date().toISOString();
    const expiresAt = buildSessionExpiryIso();
    const session = {
        id: createId("session"),
        userId: user.id,
        tokenHash,
        createdAt: now,
        expiresAt
    };

    await withStore(nextStore => ({
        ...nextStore,
        sessions: [
            ...nextStore.sessions.filter(entry => entry.userId !== user.id),
            session
        ]
    }));

    res.setHeader(
        "Set-Cookie",
        buildCookie(
            config.sessionCookieName,
            sessionToken,
            buildSessionCookieOptions(req)
        )
    );

    sendJson(res, 200, buildAccountContextPayload({
        user,
        session
    }));
}

async function handleLogout(req, res) {
    const sessionContext = await getAuthenticatedSession(req);

    if (sessionContext?.tokenHash) {
        await withStore(store => ({
            ...store,
            sessions: store.sessions.filter(
                entry => entry.tokenHash !== sessionContext.tokenHash
            )
        }));
    }

    res.setHeader(
        "Set-Cookie",
        buildCookie(config.sessionCookieName, "", {
            httpOnly: true,
            path: "/",
            sameSite: "Lax",
            secure: getCookieSecurity(req),
            maxAge: 0
        })
    );

    sendNoContent(res);
}

async function requireAuth(req, res) {
    const sessionContext = await getAuthenticatedSession(req);

    if (!sessionContext) {
        sendError(res, 401, "Authentication required.");
        return null;
    }

    const refreshedExpiresAt = buildSessionExpiryIso();

    await withStore(store => ({
        ...store,
        sessions: store.sessions.map(entry => {
            if (entry.id !== sessionContext.session.id) {
                return entry;
            }

            return {
                ...entry,
                expiresAt: refreshedExpiresAt
            };
        })
    }));

    res.setHeader(
        "Set-Cookie",
        buildCookie(
            config.sessionCookieName,
            sessionContext.sessionToken,
            buildSessionCookieOptions(req)
        )
    );

    return {
        ...sessionContext,
        session: {
            ...sessionContext.session,
            expiresAt: refreshedExpiresAt
        }
    };
}

async function handleGetMe(req, res) {
    const sessionContext = await requireAuth(req, res);

    if (!sessionContext) {
        return;
    }

    sendJson(res, 200, buildAccountContextPayload({
        user: sessionContext.user,
        session: sessionContext.session
    }));
}

async function handleUpdateMe(req, res) {
    const sessionContext = await requireAuth(req, res);

    if (!sessionContext) {
        return;
    }

    const body = await readJsonBody(req);
    const nextDisplayName = String(body.displayName || "").trim();
    const nextRetirementCheckInFrequency =
        body.retirementCheckInFrequency !== undefined
            ? normalizeRetirementCheckInFrequency(
                body.retirementCheckInFrequency
            )
            : undefined;
    let updatedUser = null;

    if (nextDisplayName.length > 80) {
        sendError(res, 400, "Display name must be 80 characters or fewer.");
        return;
    }

    await withStore(store => ({
        ...store,
        users: store.users.map(user => {
            if (user.id !== sessionContext.user.id) {
                return user;
            }

            const normalizedExistingFrequency =
                normalizeRetirementCheckInFrequency(
                    user.retirementCheckInFrequency
                );
            const frequencyChanged =
                nextRetirementCheckInFrequency !== undefined &&
                nextRetirementCheckInFrequency !== normalizedExistingFrequency;
            updatedUser = {
                ...user,
                displayName: nextDisplayName,
                ...(nextRetirementCheckInFrequency !== undefined
                    ? {
                        retirementCheckInFrequency:
                            nextRetirementCheckInFrequency
                    }
                    : {}),
                ...(frequencyChanged && nextRetirementCheckInFrequency !== "never"
                    ? {
                        lastRetirementCheckInSentAt:
                            new Date().toISOString()
                    }
                    : {}),
                updatedAt: new Date().toISOString()
            };

            return updatedUser;
        })
    }));

    if (!updatedUser) {
        sendError(res, 404, "User not found.");
        return;
    }

    sendJson(res, 200, buildAccountContextPayload({
        user: updatedUser,
        session: sessionContext.session
    }));
}

async function handleChangePassword(req, res) {
    const sessionContext = await requireAuth(req, res);

    if (!sessionContext) {
        return;
    }

    const body = await readJsonBody(req);
    const currentPassword = String(body.currentPassword || "");
    const nextPassword = String(body.newPassword || "");

    if (!currentPassword || !nextPassword) {
        sendError(res, 400, "Current password and new password are required.");
        return;
    }

    if (nextPassword.length < 8) {
        sendError(res, 400, "New password must be at least 8 characters.");
        return;
    }

    const validPassword = await verifyPassword(
        currentPassword,
        sessionContext.user.passwordHash,
        sessionContext.user.passwordSalt
    );

    if (!validPassword) {
        sendError(res, 401, "Current password is incorrect.");
        return;
    }

    const passwordRecord = await hashPassword(nextPassword);
    const updatedAt = new Date().toISOString();

    await withStore(store => ({
        ...store,
        users: store.users.map(user => {
            if (user.id !== sessionContext.user.id) {
                return user;
            }

            return {
                ...user,
                passwordHash: passwordRecord.hash,
                passwordSalt: passwordRecord.salt,
                updatedAt
            };
        })
    }));

    sendJson(res, 200, {
        message: "Password updated successfully."
    });
}

async function handleForgotPassword(req, res) {
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);
    const genericMessage =
        "If that email is registered, a password reset link is on the way.";

    if (!email || !email.includes("@")) {
        sendError(res, 400, "A valid email address is required.");
        return;
    }

    const store = await readStore();
    const user = store.users.find(entry => entry.email === email);

    if (!user) {
        sendJson(res, 200, {
            message: genericMessage
        });
        return;
    }

    const resetToken = createSessionToken();
    const tokenHash = hashSessionToken(resetToken);
    const now = new Date().toISOString();
    const expiresAt = buildPasswordResetExpiryIso();
    const passwordResetRecord = {
        id: createId("pwreset"),
        userId: user.id,
        tokenHash,
        createdAt: now,
        expiresAt
    };

    await withStore(nextStore => ({
        ...nextStore,
        passwordResetTokens: [
            ...filterActivePasswordResetTokens(nextStore.passwordResetTokens)
                .filter(entry => entry.userId !== user.id),
            passwordResetRecord
        ]
    }));

    try {
        await sendPasswordResetEmail({
            toEmail: user.email,
            displayName: user.displayName || "",
            resetUrl: buildPasswordResetUrl(resetToken)
        });
    } catch (error) {
        await withStore(nextStore => ({
            ...nextStore,
            passwordResetTokens: filterActivePasswordResetTokens(
                nextStore.passwordResetTokens
            ).filter(entry => entry.tokenHash !== tokenHash)
        }));
        throw error;
    }

    sendJson(res, 200, {
        message: genericMessage
    });
}

async function handleResetPassword(req, res) {
    const body = await readJsonBody(req);
    const resetToken = String(body.token || "");
    const nextPassword = String(body.newPassword || "");

    if (!resetToken) {
        sendError(res, 400, "A password reset token is required.");
        return;
    }

    if (nextPassword.length < 8) {
        sendError(res, 400, "New password must be at least 8 characters.");
        return;
    }

    const tokenHash = hashSessionToken(resetToken);
    const store = await readStore();
    const activeResetToken = filterActivePasswordResetTokens(
        store.passwordResetTokens
    ).find(entry => entry.tokenHash === tokenHash);

    if (!activeResetToken) {
        sendError(res, 400, "That password reset link is invalid or has expired.");
        return;
    }

    const user = store.users.find(entry => entry.id === activeResetToken.userId);

    if (!user) {
        sendError(res, 404, "User not found.");
        return;
    }

    const passwordRecord = await hashPassword(nextPassword);
    const updatedAt = new Date().toISOString();

    await withStore(nextStore => ({
        ...nextStore,
        users: nextStore.users.map(entry => {
            if (entry.id !== user.id) {
                return entry;
            }

            return {
                ...entry,
                passwordHash: passwordRecord.hash,
                passwordSalt: passwordRecord.salt,
                updatedAt
            };
        }),
        sessions: nextStore.sessions.filter(entry => entry.userId !== user.id),
        passwordResetTokens: filterActivePasswordResetTokens(
            nextStore.passwordResetTokens
        ).filter(entry => entry.userId !== user.id)
    }));

    sendJson(res, 200, {
        message: "Password reset successfully."
    });
}

async function handleListPlans(req, res) {
    const sessionContext = await requireAuth(req, res);

    if (!sessionContext) {
        return;
    }

    const store = await readStore();
    const plans = store.plans
        .filter(plan => plan.userId === sessionContext.user.id)
        .sort((left, right) =>
            new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
        )
        .map(sanitizePlanSummary);

    sendJson(res, 200, { plans });
}

async function handleCreatePlan(req, res) {
    const sessionContext = await requireAuth(req, res);

    if (!sessionContext) {
        return;
    }

    const body = await readJsonBody(req);
    const name = String(body.name || "").trim();
    const normalizedPlanPayload =
        normalizeWorkspaceStatePayload(body);

    if (!name) {
        sendError(res, 400, "Plan name is required.");
        return;
    }

    if (normalizedPlanPayload.error) {
        sendError(res, 400, normalizedPlanPayload.error);
        return;
    }

    const now = new Date().toISOString();
    const plan = {
        id: createId("plan"),
        userId: sessionContext.user.id,
        name,
        simulationState: normalizedPlanPayload.simulationState,
        workspaceState: normalizedPlanPayload.workspaceState,
        createdAt: now,
        updatedAt: now
    };

    await withStore(store => ({
        ...store,
        plans: [...store.plans, plan]
    }));

    sendJson(res, 201, {
        plan: sanitizePlan(plan)
    });
}

async function handleGetPlan(req, res, planId) {
    const sessionContext = await requireAuth(req, res);

    if (!sessionContext) {
        return;
    }

    const store = await readStore();
    const plan = store.plans.find(entry =>
        entry.id === planId &&
        entry.userId === sessionContext.user.id
    );

    if (!plan) {
        sendError(res, 404, "Plan not found.");
        return;
    }

    sendJson(res, 200, {
        plan: sanitizePlan(plan)
    });
}

async function handleUpdatePlan(req, res, planId) {
    const sessionContext = await requireAuth(req, res);

    if (!sessionContext) {
        return;
    }

    const body = await readJsonBody(req);
    const nextName =
        body.name !== undefined
            ? String(body.name || "").trim()
            : undefined;
    const nextSimulationState = body.simulationState;
    const nextWorkspaceState = body.workspaceState;
    let updatedPlan = null;

    if (nextName !== undefined && !nextName) {
        sendError(res, 400, "Plan name cannot be empty.");
        return;
    }

    await withStore(store => ({
        ...store,
        plans: store.plans.map(plan => {
            if (
                plan.id !== planId ||
                plan.userId !== sessionContext.user.id
            ) {
                return plan;
            }

            let nextPlanPayload = null;

            if (
                nextSimulationState !== undefined ||
                nextWorkspaceState !== undefined
            ) {
                nextPlanPayload = normalizeWorkspaceStatePayload({
                    simulationState:
                        nextSimulationState !== undefined
                            ? nextSimulationState
                            : plan.simulationState,
                    workspaceState:
                        nextWorkspaceState !== undefined
                            ? nextWorkspaceState
                            : plan.workspaceState
                });

                if (nextPlanPayload.error) {
                    const validationError = new Error(nextPlanPayload.error);
                    validationError.statusCode = 400;
                    throw validationError;
                }
            }

            updatedPlan = {
                ...plan,
                ...(nextName !== undefined ? { name: nextName } : {}),
                ...(nextPlanPayload
                    ? {
                        simulationState: nextPlanPayload.simulationState,
                        workspaceState: nextPlanPayload.workspaceState
                    }
                    : {}),
                updatedAt: new Date().toISOString()
            };

            return updatedPlan;
        })
    }));

    if (!updatedPlan) {
        sendError(res, 404, "Plan not found.");
        return;
    }

    sendJson(res, 200, {
        plan: sanitizePlan(updatedPlan)
    });
}

async function handleDeletePlan(req, res, planId) {
    const sessionContext = await requireAuth(req, res);

    if (!sessionContext) {
        return;
    }

    let removed = false;

    await withStore(store => ({
        ...store,
        plans: store.plans.filter(plan => {
            const shouldRemove =
                plan.id === planId &&
                plan.userId === sessionContext.user.id;

            if (shouldRemove) {
                removed = true;
            }

            return !shouldRemove;
        })
    }));

    if (!removed) {
        sendError(res, 404, "Plan not found.");
        return;
    }

    sendNoContent(res);
}

async function handleCreatePlanShare(req, res, planId) {
    const sessionContext = await requireAuth(req, res);

    if (!sessionContext) {
        return;
    }

    let sharedPlan = null;

    await withStore(store => ({
        ...store,
        plans: store.plans.map(plan => {
            if (
                plan.id !== planId ||
                plan.userId !== sessionContext.user.id
            ) {
                return plan;
            }

            sharedPlan = {
                ...plan,
                shareToken:
                    String(plan.shareToken || "").trim() ||
                    createSessionToken(),
                shareCreatedAt:
                    plan.shareCreatedAt ||
                    new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            return sharedPlan;
        })
    }));

    if (!sharedPlan) {
        sendError(res, 404, "Plan not found.");
        return;
    }

    sendJson(res, 200, {
        share: sanitizePlanShare(sharedPlan),
        plan: sanitizePlan(sharedPlan)
    });
}

async function handleDeletePlanShare(req, res, planId) {
    const sessionContext = await requireAuth(req, res);

    if (!sessionContext) {
        return;
    }

    let updatedPlan = null;

    await withStore(store => ({
        ...store,
        plans: store.plans.map(plan => {
            if (
                plan.id !== planId ||
                plan.userId !== sessionContext.user.id
            ) {
                return plan;
            }

            updatedPlan = {
                ...plan,
                shareToken: null,
                shareCreatedAt: null,
                updatedAt: new Date().toISOString()
            };

            return updatedPlan;
        })
    }));

    if (!updatedPlan) {
        sendError(res, 404, "Plan not found.");
        return;
    }

    sendJson(res, 200, {
        share: sanitizePlanShare(updatedPlan),
        plan: sanitizePlan(updatedPlan)
    });
}

async function handleGetSharedPlan(req, res, shareToken) {
    const normalizedShareToken = String(shareToken || "").trim();

    if (!normalizedShareToken) {
        sendError(res, 404, "Shared plan not found.");
        return;
    }

    const store = await readStore();
    const plan = store.plans.find(entry =>
        String(entry.shareToken || "").trim() === normalizedShareToken
    );

    if (!plan) {
        sendError(res, 404, "Shared plan not found.");
        return;
    }

    const owner =
        store.users.find(entry => entry.id === plan.userId) ||
        {};

    sendJson(res, 200, {
        plan: sanitizeSharedPlan(plan, owner)
    });
}

export async function handleRequest(req, res) {
    applyCors(req, res, config.corsOrigins);

    if (req.method === "OPTIONS") {
        sendNoContent(res);
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    try {
        if (req.method === "GET" && pathname === "/health") {
            sendJson(res, 200, {
                status: "ok",
                service: "leoff-helper-backend"
            });
            return;
        }

        if (req.method === "POST" && pathname === "/auth/register") {
            if (!enforceRateLimit(req, res, {
                scope: "auth-register",
                maxRequests: config.registerRateLimitMax,
                windowMs: config.registerRateLimitWindowMs
            })) {
                return;
            }

            await handleRegister(req, res);
            return;
        }

        if (req.method === "POST" && pathname === "/auth/login") {
            if (!enforceRateLimit(req, res, {
                scope: "auth-login",
                maxRequests: config.loginRateLimitMax,
                windowMs: config.loginRateLimitWindowMs
            })) {
                return;
            }

            await handleLogin(req, res);
            return;
        }

        if (req.method === "POST" && pathname === "/auth/logout") {
            await handleLogout(req, res);
            return;
        }

        if (req.method === "GET" && pathname === "/me") {
            await handleGetMe(req, res);
            return;
        }

        if (req.method === "PATCH" && pathname === "/me") {
            await handleUpdateMe(req, res);
            return;
        }

        if (req.method === "POST" && pathname === "/auth/change-password") {
            await handleChangePassword(req, res);
            return;
        }

        if (req.method === "POST" && pathname === "/auth/forgot-password") {
            if (!enforceRateLimit(req, res, {
                scope: "auth-forgot-password",
                maxRequests: config.forgotPasswordRateLimitMax,
                windowMs: config.forgotPasswordRateLimitWindowMs
            })) {
                return;
            }

            await handleForgotPassword(req, res);
            return;
        }

        if (req.method === "POST" && pathname === "/auth/reset-password") {
            if (!enforceRateLimit(req, res, {
                scope: "auth-reset-password",
                maxRequests: config.resetPasswordRateLimitMax,
                windowMs: config.resetPasswordRateLimitWindowMs
            })) {
                return;
            }

            await handleResetPassword(req, res);
            return;
        }

        if (req.method === "GET" && pathname === "/plans") {
            await handleListPlans(req, res);
            return;
        }

        if (req.method === "POST" && pathname === "/plans") {
            await handleCreatePlan(req, res);
            return;
        }

        const sharedPlanToken =
            getRouteParams(pathname, "/shared-plans/");

        if (req.method === "GET" && sharedPlanToken) {
            await handleGetSharedPlan(req, res, sharedPlanToken);
            return;
        }

        const planId = getRouteParams(pathname, "/plans/");

        if (req.method === "POST" && planId?.endsWith("/share")) {
            await handleCreatePlanShare(
                req,
                res,
                planId.slice(0, -"/share".length)
            );
            return;
        }

        if (req.method === "DELETE" && planId?.endsWith("/share")) {
            await handleDeletePlanShare(
                req,
                res,
                planId.slice(0, -"/share".length)
            );
            return;
        }

        if (req.method === "GET" && planId) {
            await handleGetPlan(req, res, planId);
            return;
        }

        if (req.method === "PUT" && planId) {
            await handleUpdatePlan(req, res, planId);
            return;
        }

        if (req.method === "DELETE" && planId) {
            await handleDeletePlan(req, res, planId);
            return;
        }

        sendError(res, 404, "Route not found.");
    } catch (error) {
        console.error("Backend request failed", error);

        if (error instanceof SyntaxError) {
            sendError(res, 400, "Invalid JSON request body.");
            return;
        }

        if (error?.statusCode) {
            sendError(
                res,
                error.statusCode,
                error.message || "Request failed.",
                error.details || null
            );
            return;
        }

        sendError(res, 500, "Internal server error.");
    }
}
