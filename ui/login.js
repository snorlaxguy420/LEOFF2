import {
    getCurrentUser,
    loginAccount,
    logoutAccount,
    registerAccount
} from "./apiClient.js";

const MODE_COPY = {
    login: "Use your account email to access your saved retirement work.",
    register: "Create your account now so saved-plan syncing can attach to your retirement work."
};

const MODE_SUBMIT_LABEL = {
    login: "Log In",
    register: "Create Account"
};

const state = {
    mode: "login",
    user: null,
    pending: false
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
    modeButtons: Array.from(document.querySelectorAll("[data-auth-mode-toggle]"))
};

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

function renderAuthenticatedState(user) {
    state.user = user;

    const authenticated = Boolean(user);

    if (elements.form) {
        elements.form.hidden = authenticated;
    }

    if (elements.authenticatedPanel) {
        elements.authenticatedPanel.hidden = !authenticated;
    }

    if (elements.logoutButton) {
        elements.logoutButton.hidden = !authenticated;
    }

    if (elements.footer) {
        elements.footer.textContent = authenticated
            ? "You can stay signed in here while the saved-plan account UI expands."
            : "New here? Create an account now so your saved-plan flow is ready as frontend syncing rolls out.";
    }

    if (elements.authenticatedEmail) {
        elements.authenticatedEmail.textContent = user?.email || "";
    }

    if (authenticated) {
        setStatus("You're signed in successfully.", "success");
    }

    setPending(false);
}

async function refreshSession() {
    try {
        const user = await getCurrentUser();
        renderAuthenticatedState(user);
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
        const user = state.mode === "register"
            ? await registerAccount(email, password)
            : await loginAccount(email, password);

        renderAuthenticatedState(user);
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
        if (elements.form) {
            elements.form.hidden = false;
            elements.form.reset();
        }
        renderAuthenticatedState(null);
        updateMode("login");
        setStatus("You have been signed out.", "success");
    } catch (error) {
        setPending(false);
        setStatus(error.message || "Unable to sign out right now.", "error");
    }
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
}

updateMode("login");
bindEvents();
refreshSession();
