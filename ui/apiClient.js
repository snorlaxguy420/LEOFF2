import { normalizeAccountContext } from "./accountEntitlements.js";

const API_BASE_URL = "https://api.leoffhelper.com";

async function readResponse(response) {
    const contentType = response.headers.get("content-type") || "";

    if (response.status === 204) {
        return null;
    }

    if (contentType.includes("application/json")) {
        return response.json();
    }

    const text = await response.text();
    return text ? { message: text } : null;
}

async function request(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        credentials: "include",
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });
    const payload = await readResponse(response);

    if (!response.ok) {
        const message =
            payload?.error ||
            payload?.message ||
            `Request failed with status ${response.status}.`;
        throw new Error(message);
    }

    return payload;
}

export async function getAccountContext() {
    const payload = await request("/me", {
        method: "GET"
    });

    return normalizeAccountContext(payload);
}

export async function getCurrentUser() {
    const payload = await getAccountContext();

    return payload?.user || null;
}

export async function registerAccount(email, password) {
    const payload = await request("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password })
    });

    return normalizeAccountContext(payload);
}

export async function loginAccount(email, password) {
    const payload = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
    });

    return normalizeAccountContext(payload);
}

export async function logoutAccount() {
    await request("/auth/logout", {
        method: "POST"
    });
}

export async function updateAccountProfile(updates = {}) {
    const payload = await request("/me", {
        method: "PATCH",
        body: JSON.stringify(updates)
    });

    return normalizeAccountContext(payload);
}

export async function changeAccountPassword(currentPassword, newPassword) {
    const payload = await request("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
            currentPassword,
            newPassword
        })
    });

    return payload || null;
}

export async function requestPasswordReset(email) {
    const payload = await request("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email })
    });

    return payload || null;
}

export async function resetAccountPassword(token, newPassword) {
    const payload = await request("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
            token,
            newPassword
        })
    });

    return payload || null;
}

export async function listPlans() {
    const payload = await request("/plans", {
        method: "GET"
    });

    return Array.isArray(payload?.plans) ? payload.plans : [];
}

export async function createPlan(name, planPayload = {}) {
    const simulationState =
        planPayload?.simulationState && typeof planPayload === "object"
            ? planPayload.simulationState
            : planPayload;
    const workspaceState =
        planPayload?.workspaceState && typeof planPayload === "object"
            ? planPayload.workspaceState
            : null;
    const responsePayload = await request("/plans", {
        method: "POST",
        body: JSON.stringify({
            name,
            simulationState,
            ...(workspaceState ? { workspaceState } : {})
        })
    });

    return responsePayload?.plan || null;
}

export async function getPlan(planId) {
    const payload = await request(`/plans/${encodeURIComponent(planId)}`, {
        method: "GET"
    });

    return payload?.plan || null;
}

export async function createPlanShare(planId) {
    const payload = await request(`/plans/${encodeURIComponent(planId)}/share`, {
        method: "POST"
    });

    return payload?.share || null;
}

export async function deletePlanShare(planId) {
    const payload = await request(`/plans/${encodeURIComponent(planId)}/share`, {
        method: "DELETE"
    });

    return payload?.share || null;
}

export async function getSharedPlan(sharedPlanToken) {
    const payload = await request(`/shared-plans/${encodeURIComponent(sharedPlanToken)}`, {
        method: "GET"
    });

    return payload?.plan || null;
}

export async function updatePlan(planId, updates) {
    const payload = await request(`/plans/${encodeURIComponent(planId)}`, {
        method: "PUT",
        body: JSON.stringify(updates)
    });

    return payload?.plan || null;
}

export async function deletePlan(planId) {
    await request(`/plans/${encodeURIComponent(planId)}`, {
        method: "DELETE"
    });
}
