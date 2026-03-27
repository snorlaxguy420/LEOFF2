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

function sanitizeUser(user) {
    return {
        id: user.id,
        email: user.email,
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
    return {
        ...sanitizePlanSummary(plan),
        simulationState: plan.simulationState
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
        tokenHash
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
    const expiresAt = new Date(
        Date.now() + (config.sessionTtlDays * 24 * 60 * 60 * 1000)
    ).toISOString();
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
        buildCookie(config.sessionCookieName, sessionToken, {
            httpOnly: true,
            path: "/",
            sameSite: "Lax",
            secure: getCookieSecurity(req),
            maxAge: config.sessionTtlDays * 24 * 60 * 60
        })
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
    const expiresAt = new Date(
        Date.now() + (config.sessionTtlDays * 24 * 60 * 60 * 1000)
    ).toISOString();
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
        buildCookie(config.sessionCookieName, sessionToken, {
            httpOnly: true,
            path: "/",
            sameSite: "Lax",
            secure: getCookieSecurity(req),
            maxAge: config.sessionTtlDays * 24 * 60 * 60
        })
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

    return sessionContext;
}

async function handleGetMe(req, res) {
    const sessionContext = await requireAuth(req, res);

    if (!sessionContext) {
        return;
    }

    sendJson(res, 200, {
        user: sanitizeUser(sessionContext.user)
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
    const simulationState = body.simulationState;

    if (!name) {
        sendError(res, 400, "Plan name is required.");
        return;
    }

    if (!simulationState || typeof simulationState !== "object") {
        sendError(res, 400, "A simulationState object is required.");
        return;
    }

    const now = new Date().toISOString();
    const plan = {
        id: createId("plan"),
        userId: sessionContext.user.id,
        name,
        simulationState,
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

            updatedPlan = {
                ...plan,
                ...(nextName !== undefined ? { name: nextName } : {}),
                ...(nextSimulationState !== undefined
                    ? { simulationState: nextSimulationState }
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

        sendError(res, 500, "Internal server error.");
    }
}
