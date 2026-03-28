import {
    changeAccountPassword,
    getAccountContext,
    loginAccount,
    logoutAccount,
    registerAccount,
    updateAccountProfile
} from "./apiClient.js";

const MODE_COPY = {
    login: "Use your account email to access your saved retirement work.",
    register: "Create your account now so saved-plan syncing can attach to your retirement work."
};

const MODE_SUBMIT_LABEL = {
    login: "Log In",
    register: "Create Account"
};

const AUTH_SYNC_KEY = "leoffHelperAuthSync";

const state = {
    mode: "login",
    user: null,
    session: null,
    pending: false,
    profilePending: false,
    passwordPending: false
};

const elements = {
    form: document.querySelector("[data-auth-form]"),
    emailInput: document.querySelector('input[name="email"]'),
    passwordInput: document.querySelector('input[name="password"]'),
    submitButton: document.querySelector("[data-auth-submit]"),
    logoutButton: document.querySelector("[data-auth-logout]"),
    status: document.querySelector("[data-auth-status]"),
    footer: document.querySelector("[data-auth-footer]"),
    copy: document.querySelector("[data-auth-copy]"),
    authenticatedPanel: document.querySelector("[data-authenticated-panel]"),
    authenticatedEmail: document.querySelector("[data-auth-email]"),
    authenticatedDisplayName: document.querySelector("[data-auth-display-name]"),
    authenticatedCreatedAt: document.querySelector("[data-auth-created-at]"),
    sessionStatus: document.querySelector("[data-session-status]"),
    sessionExpiry: document.querySelector("[data-session-expiry]"),
    sessionRefreshButton: document.querySelector("[data-session-refresh]"),
    modeButtons: Array.from(document.querySelectorAll("[data-auth-mode-toggle]")),
    profileForm: document.querySelector("[data-profile-form]"),
    profileSubmit: document.querySelector("[data-profile-submit]"),
    displayNameInput: document.querySelector('[data-profile-form] input[name="displayName"]'),
    passwordForm: document.querySelector("[data-password-form]"),
    passwordSubmit: document.querySelector("[data-password-submit]")
};

function broadcastAuthChange(type, user = null) {
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
                user
            }
        })
    );
}

function formatDisplayName(user) {
    if (user?.displayName?.trim()) {
        return user.displayName.trim();
    }

    const localPart = String(user?.email || "").split("@")[0] || "Member";

    return localPart
        .replace(/[._-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, character => character.toUpperCase());
}

function formatTimestamp(value) {
    if (!value) {
        return "Unavailable";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Unavailable";
    }

    return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

function setStatus(message, tone = "neutral") {
    if (!elements.status) {
        return;
    }

    if (!message) {
        elements.status.hidden = true;
        elements.status.textContent = "";
        elements.status.dataset.tone = "neutral";
        return;
    }

    elements.status.hidden = false;
    elements.status.textContent = message;
    elements.status.dataset.tone = tone;
}

function setPending(pending) {
    state.pending = pending;

    const disabled = pending || Boolean(state.user);

    if (elements.emailInput) {
        elements.emailInput.disabled = disabled;
    }

    if (elements.passwordInput) {
        elements.passwordInput.disabled = disabled;
        elements.passwordInput.autocomplete =
            state.mode === "register" ? "new-password" : "current-password";
    }

    if (elements.submitButton) {
        elements.submitButton.disabled = disabled;
        elements.submitButton.textContent = pending
            ? (state.mode === "register" ? "Creating Account..." : "Logging In...")
            : MODE_SUBMIT_LABEL[state.mode];
    }

    elements.modeButtons.forEach(button => {
        button.disabled = pending || Boolean(state.user);
    });
}

function setProfilePending(pending) {
    state.profilePending = pending;

    if (elements.displayNameInput) {
        elements.displayNameInput.disabled = pending;
    }

    if (elements.profileSubmit) {
        elements.profileSubmit.disabled = pending;
        elements.profileSubmit.textContent = pending
            ? "Saving..."
            : "Save Settings";
    }
}

function setPasswordPending(pending) {
    state.passwordPending = pending;

    if (!elements.passwordForm) {
        return;
    }

    Array.from(elements.passwordForm.querySelectorAll("input"))
        .forEach(input => {
            input.disabled = pending;
        });

    if (elements.passwordSubmit) {
        elements.passwordSubmit.disabled = pending;
        elements.passwordSubmit.textContent = pending
            ? "Updating..."
            : "Update Password";
    }
}

function updateMode(mode) {
    state.mode = mode;

    elements.modeButtons.forEach(button => {
        const active = button.dataset.authModeToggle === mode;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
    });

    if (elements.copy) {
        elements.copy.textContent = MODE_COPY[mode];
    }

    if (elements.submitButton) {
        elements.submitButton.textContent = MODE_SUBMIT_LABEL[mode];
    }

    if (elements.passwordInput) {
        elements.passwordInput.autocomplete =
            mode === "register" ? "new-password" : "current-password";
    }

    setStatus("");
}

function renderSessionInfo(session) {
    if (elements.sessionStatus) {
        elements.sessionStatus.textContent = session
            ? `Active (${session.idleTimeoutMinutes || 15}-minute inactivity timeout)`
            : "Signed out";
    }

    if (elements.sessionExpiry) {
        elements.sessionExpiry.textContent = session
            ? formatTimestamp(session.expiresAt)
            : "Unavailable";
    }
}

function renderAuthenticatedState(accountContext = null) {
    const user = accountContext?.user || null;
    const session = accountContext?.session || null;
    const authenticated = Boolean(user);

    state.user = user;
    state.session = session;

    if (elements.form) {
        elements.form.hidden = authenticated;
    }

    if (elements.authenticatedPanel) {
        elements.authenticatedPanel.hidden = !authenticated;
    }

    if (elements.logoutButton) {
        elements.logoutButton.hidden = !authenticated;
    }

    if (elements.sessionRefreshButton) {
        elements.sessionRefreshButton.hidden = !authenticated;
    }

    if (elements.footer) {
        elements.footer.textContent = authenticated
            ? "Your account is active. Settings and password management are available here while synced planning continues to expand."
            : "New here? Create an account now so your saved-plan flow is ready as frontend syncing rolls out.";
    }

    if (elements.authenticatedEmail) {
        elements.authenticatedEmail.textContent = user?.email || "";
    }

    if (elements.authenticatedDisplayName) {
        elements.authenticatedDisplayName.textContent = authenticated
            ? formatDisplayName(user)
            : "";
    }

    if (elements.authenticatedCreatedAt) {
        elements.authenticatedCreatedAt.textContent = authenticated
            ? formatTimestamp(user.createdAt)
            : "Unavailable";
    }

    if (elements.displayNameInput) {
        elements.displayNameInput.value = user?.displayName || "";
    }

    renderSessionInfo(session);
    setPending(false);
    setProfilePending(false);
    setPasswordPending(false);
}

async function refreshAccountContext(statusMessage = "", tone = "success") {
    try {
        const accountContext = await getAccountContext();
        renderAuthenticatedState(accountContext);

        if (statusMessage) {
            setStatus(statusMessage, tone);
        } else if (accountContext?.user) {
            setStatus("You're signed in successfully.", "success");
        } else {
            setStatus("");
        }
    } catch (error) {
        renderAuthenticatedState(null);
        setStatus("");
    }
}

async function handleSubmit(event) {
    event.preventDefault();

    if (state.pending || state.user) {
        return;
    }

    const email = elements.emailInput?.value?.trim() || "";
    const password = elements.passwordInput?.value || "";

    if (!email || !password) {
        setStatus("Email and password are required.", "error");
        return;
    }

    if (state.mode === "register" && password.length < 8) {
        setStatus("Password must be at least 8 characters.", "error");
        return;
    }

    setPending(true);
    setStatus(
        state.mode === "register"
            ? "Creating your account..."
            : "Signing you in...",
        "neutral"
    );

    try {
        if (state.mode === "register") {
            await registerAccount(email, password);
        } else {
            await loginAccount(email, password);
        }

        await refreshAccountContext(
            state.mode === "register"
                ? "Your account is ready."
                : "You're signed in successfully.",
            "success"
        );
        broadcastAuthChange("login", state.user);
    } catch (error) {
        setPending(false);
        setStatus(error.message || "Authentication failed.", "error");
    }
}

async function handleLogout() {
    if (state.pending || !state.user) {
        return;
    }

    setPending(true);
    setStatus("Signing you out...", "neutral");

    try {
        await logoutAccount();

        elements.form?.reset();
        elements.passwordForm?.reset();
        renderAuthenticatedState(null);
        updateMode("login");
        setStatus("You have been signed out.", "success");
        broadcastAuthChange("logout", null);
    } catch (error) {
        setPending(false);
        setStatus(error.message || "Unable to sign out right now.", "error");
    }
}

async function handleProfileSubmit(event) {
    event.preventDefault();

    if (!state.user || state.profilePending) {
        return;
    }

    const displayName = elements.displayNameInput?.value?.trim() || "";

    setProfilePending(true);
    setStatus("Saving account settings...", "neutral");

    try {
        const accountContext = await updateAccountProfile({ displayName });
        renderAuthenticatedState(accountContext);
        setStatus("Account settings updated.", "success");
        broadcastAuthChange("profile", accountContext?.user || null);
    } catch (error) {
        setProfilePending(false);
        setStatus(error.message || "Account settings could not be saved.", "error");
    }
}

async function handlePasswordSubmit(event) {
    event.preventDefault();

    if (!state.user || state.passwordPending || !elements.passwordForm) {
        return;
    }

    const currentPassword =
        elements.passwordForm.querySelector('input[name="currentPassword"]')?.value || "";
    const newPassword =
        elements.passwordForm.querySelector('input[name="newPassword"]')?.value || "";
    const confirmPassword =
        elements.passwordForm.querySelector('input[name="confirmPassword"]')?.value || "";

    if (!currentPassword || !newPassword || !confirmPassword) {
        setStatus("Fill out all password fields before updating.", "error");
        return;
    }

    if (newPassword.length < 8) {
        setStatus("New password must be at least 8 characters.", "error");
        return;
    }

    if (newPassword !== confirmPassword) {
        setStatus("New password and confirmation must match.", "error");
        return;
    }

    setPasswordPending(true);
    setStatus("Updating your password...", "neutral");

    try {
        await changeAccountPassword(currentPassword, newPassword);
        elements.passwordForm.reset();
        await refreshAccountContext(
            "Password updated successfully. Your active session remains signed in.",
            "success"
        );
    } catch (error) {
        setPasswordPending(false);
        setStatus(error.message || "Password could not be updated.", "error");
    }
}

async function handleSessionRefresh() {
    if (!state.user) {
        return;
    }

    setStatus("Refreshing your active session...", "neutral");
    await refreshAccountContext("Session refreshed.", "success");
}

function bindEvents() {
    elements.modeButtons.forEach(button => {
        button.addEventListener("click", () => {
            if (state.pending || state.user) {
                return;
            }

            updateMode(button.dataset.authModeToggle || "login");
        });
    });

    elements.form?.addEventListener("submit", handleSubmit);
    elements.logoutButton?.addEventListener("click", handleLogout);
    elements.profileForm?.addEventListener("submit", handleProfileSubmit);
    elements.passwordForm?.addEventListener("submit", handlePasswordSubmit);
    elements.sessionRefreshButton?.addEventListener("click", handleSessionRefresh);

    window.addEventListener("leoff-auth-state", event => {
        const type = event.detail?.type || "";

        if (type === "logout" || type === "expired") {
            elements.form?.reset();
            elements.passwordForm?.reset();
            renderAuthenticatedState(null);
            updateMode("login");
            setStatus(
                type === "expired"
                    ? "Your session timed out after 15 minutes of inactivity."
                    : "You have been signed out.",
                type === "expired" ? "error" : "success"
            );
        }
    });
}

updateMode("login");
bindEvents();
refreshAccountContext();
