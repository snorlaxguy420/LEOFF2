import {
    getCurrentUser,
    logoutAccount
} from "./apiClient.js";

const AUTH_SYNC_KEY = "leoffHelperAuthSync";
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const HEARTBEAT_COOLDOWN_MS = 60 * 1000;

let currentUser = null;
let idleTimeoutId = null;
let lastHeartbeatAt = 0;
let heartbeatPromise = null;
let logoutPromise = null;

function formatDisplayName(user = null) {
    if (user?.displayName?.trim()) {
        return user.displayName.trim();
    }

    const fullName = [user?.firstName, user?.lastName]
        .map(value => String(value || "").trim())
        .filter(Boolean)
        .join(" ");

    if (fullName) {
        return fullName;
    }

    const localPart = String(user?.email || "").split("@")[0] || "Member";

    return localPart
        .replace(/[._-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, character => character.toUpperCase());
}

function getNavLoginLinks() {
    return Array.from(document.querySelectorAll(".nav .nav-login"));
}

function ensureGreeting(nav, loginLink) {
    let greeting = nav.querySelector(".nav-auth-status");

    if (!greeting) {
        greeting = document.createElement("span");
        greeting.className = "nav-auth-status";
        greeting.hidden = true;
        nav.insertBefore(greeting, loginLink);
    }

    return greeting;
}

function broadcastAuthChange(type) {
    try {
        localStorage.setItem(
            AUTH_SYNC_KEY,
            JSON.stringify({
                type,
                at: Date.now()
            })
        );
    } catch (error) {
        console.warn("Auth sync broadcast failed", error);
    }

    window.dispatchEvent(
        new CustomEvent("leoff-auth-state", {
            detail: {
                type,
                user: currentUser
            }
        })
    );
}

function clearIdleTimeout() {
    if (idleTimeoutId) {
        window.clearTimeout(idleTimeoutId);
        idleTimeoutId = null;
    }
}

function ensureBannerStyles() {
    if (document.getElementById("authSessionBannerStyles")) {
        return;
    }

    const style = document.createElement("style");
    style.id = "authSessionBannerStyles";
    style.textContent = `
        .auth-session-banner {
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 10000;
            max-width: min(420px, calc(100vw - 32px));
            padding: 14px 16px;
            border-radius: 14px;
            background: rgba(31, 77, 58, 0.96);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.18);
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
            font: 600 14px/1.5 "Segoe UI", system-ui, sans-serif;
        }

        .auth-session-banner[data-tone="error"] {
            background: rgba(124, 42, 42, 0.96);
        }

        @media (max-width: 720px) {
            .auth-session-banner {
                top: auto;
                bottom: 16px;
                left: 16px;
                right: 16px;
                max-width: none;
            }
        }
    `;
    document.head.appendChild(style);
}

function getBanner() {
    ensureBannerStyles();

    let banner = document.querySelector(".auth-session-banner");

    if (banner) {
        return banner;
    }

    banner = document.createElement("div");
    banner.className = "auth-session-banner";
    banner.hidden = true;
    document.body.appendChild(banner);

    return banner;
}

function showBanner(message, tone = "neutral") {
    if (!message) {
        return;
    }

    const banner = getBanner();
    banner.hidden = false;
    banner.dataset.tone = tone;
    banner.textContent = message;

    window.clearTimeout(showBanner.timeoutId);
    showBanner.timeoutId = window.setTimeout(() => {
        banner.hidden = true;
        banner.textContent = "";
        banner.dataset.tone = "";
    }, 5000);
}

function renderAuthHeader() {
    getNavLoginLinks().forEach(link => {
        const nav = link.closest(".nav");

        if (!nav) {
            return;
        }

        if (currentUser?.email) {
            const greeting = ensureGreeting(nav, link);
            greeting.hidden = false;
            greeting.textContent = `Welcome, ${formatDisplayName(currentUser)}`;
            link.textContent = "PROFILE";
            link.href = "/ui/profile.html";
            link.dataset.authMode = "profile";
            return;
        }

        const greeting = nav.querySelector(".nav-auth-status");

        if (greeting) {
            greeting.hidden = true;
            greeting.textContent = "";
        }

        link.textContent = "LOG IN";
        link.href = "/ui/login.html";
        link.dataset.authMode = "login";
    });
}

function scheduleIdleLogout() {
    clearIdleTimeout();

    if (!currentUser) {
        return;
    }

    idleTimeoutId = window.setTimeout(() => {
        void performLogout({
            reason: "Your session timed out after 15 minutes of inactivity."
        });
    }, IDLE_TIMEOUT_MS);
}

async function refreshSessionHeartbeat() {
    if (!currentUser) {
        return null;
    }

    if (heartbeatPromise) {
        return heartbeatPromise;
    }

    lastHeartbeatAt = Date.now();
    heartbeatPromise = getCurrentUser()
        .then(user => {
            currentUser = user;
            renderAuthHeader();
            scheduleIdleLogout();
            return user;
        })
        .catch(() => {
            currentUser = null;
            renderAuthHeader();
            clearIdleTimeout();
            broadcastAuthChange("expired");
            return null;
        })
        .finally(() => {
            heartbeatPromise = null;
        });

    return heartbeatPromise;
}

function handleActivity() {
    if (!currentUser) {
        return;
    }

    scheduleIdleLogout();

    if ((Date.now() - lastHeartbeatAt) >= HEARTBEAT_COOLDOWN_MS) {
        void refreshSessionHeartbeat();
    }
}

async function performLogout({ reason = "" } = {}) {
    if (logoutPromise) {
        return logoutPromise;
    }

    logoutPromise = Promise.resolve()
        .then(async () => {
            if (currentUser) {
                try {
                    await logoutAccount();
                } catch (error) {
                    console.warn("Logout request failed", error);
                }
            }

            currentUser = null;
            clearIdleTimeout();
            renderAuthHeader();
            broadcastAuthChange(reason ? "expired" : "logout");

            if (reason) {
                showBanner(reason, "error");
            }
        })
        .finally(() => {
            logoutPromise = null;
        });

    return logoutPromise;
}

async function hydrateHeaderAuth() {
    try {
        currentUser = await getCurrentUser();
        lastHeartbeatAt = Date.now();
    } catch (error) {
        currentUser = null;
    }

    renderAuthHeader();
    scheduleIdleLogout();
}

function bindNavLogout() {
    getNavLoginLinks().forEach(link => {
        if (link.dataset.authBound === "true") {
            return;
        }

        link.dataset.authBound = "true";
        link.addEventListener("click", async event => {
            if (link.dataset.authMode !== "logout") {
                return;
            }

            event.preventDefault();
            await performLogout();
        });
    });
}

function bindSessionSync() {
    const activityEvents = [
        "click",
        "keydown",
        "mousedown",
        "mousemove",
        "scroll",
        "touchstart"
    ];

    activityEvents.forEach(eventName => {
        window.addEventListener(eventName, handleActivity, {
            passive: true
        });
    });

    window.addEventListener("storage", event => {
        if (event.key !== AUTH_SYNC_KEY || !event.newValue) {
            return;
        }

        void hydrateHeaderAuth();
    });

    window.addEventListener("leoff-auth-state", event => {
        if (event.detail?.user !== undefined) {
            currentUser = event.detail.user;
            renderAuthHeader();
            scheduleIdleLogout();
            return;
        }

        void hydrateHeaderAuth();
    });
}

bindNavLogout();
bindSessionSync();
hydrateHeaderAuth();
