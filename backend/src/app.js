import { config } from "./config.js";
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

function buildSessionCookieOptions(req) {
    return {
        httpOnly: true,
        path: "/",
        sameSite: "Lax",
        secure: getCookieSecurity(req),
        maxAge: getSessionMaxAgeSeconds()
    };
}

function sanitizeUser(user) {
    return {
        id: user.id,
        email: user.email,
        displayName: user.displayName || "",
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    };
}

function sanitizePlanSummary(plan) {
    return {
        id: plan.id,
        name: plan.name,
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

    res.setHeader(
        "Set-Cookie",
        buildCookie(
            config.sessionCookieName,
            sessionToken,
            buildSessionCookieOptions(req)
        )
    );

    sendJson(res, 201, {
        user: sanitizeUser(user)
    });
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

    sendJson(res, 200, {
        user: sanitizeUser(user)
    });
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

    sendJson(res, 200, {
        user: sanitizeUser(sessionContext.user),
        session: {
            expiresAt: sessionContext.session.expiresAt,
            idleTimeoutMinutes: config.sessionTtlMinutes
        }
    });
}

async function handleUpdateMe(req, res) {
    const sessionContext = await requireAuth(req, res);

    if (!sessionContext) {
        return;
    }

    const body = await readJsonBody(req);
    const nextDisplayName = String(body.displayName || "").trim();
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

            updatedUser = {
                ...user,
                displayName: nextDisplayName,
                updatedAt: new Date().toISOString()
            };

            return updatedUser;
        })
    }));

    if (!updatedUser) {
        sendError(res, 404, "User not found.");
        return;
    }

    sendJson(res, 200, {
        user: sanitizeUser(updatedUser),
        session: {
            expiresAt: sessionContext.session.expiresAt,
            idleTimeoutMinutes: config.sessionTtlMinutes
        }
    });
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
            await handleRegister(req, res);
            return;
        }

        if (req.method === "POST" && pathname === "/auth/login") {
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

        if (req.method === "GET" && pathname === "/plans") {
            await handleListPlans(req, res);
            return;
        }

        if (req.method === "POST" && pathname === "/plans") {
            await handleCreatePlan(req, res);
            return;
        }

        const planId = getRouteParams(pathname, "/plans/");

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
            sendError(res, error.statusCode, error.message || "Request failed.");
            return;
        }

        sendError(res, 500, "Internal server error.");
    }
}
