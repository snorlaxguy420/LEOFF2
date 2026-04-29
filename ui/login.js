import {
    changeAccountPassword,
    getAccountContext,
    loginAccount,
    logoutAccount,
    registerAccount,
    requestPasswordReset,
    resetAccountPassword,
    updateAccountProfile
} from "./apiClient.js";
import {
    getPlanTierLabel,
    hasPremiumAccess
} from "./accountEntitlements.js";

const MODE_COPY = {
    login: "Use your account email to access your saved retirement work.",
    register: "Create your account now so saved-plan syncing can attach to your retirement work."
};

const MODE_TITLE = {
    login: "Log In",
    register: "Create Account"
};

const VIEW_COPY = {
    forgot:
        "Enter your account email and we will send a recovery link if that address is registered.",
    reset:
        "Choose a new password to regain access to your saved retirement planning work."
};

const VIEW_TITLE = {
    forgot: "Forgot Password",
    reset: "Reset Password"
};

const AUTH_SYNC_KEY = "leoffHelperAuthSync";
const RETIREMENT_CHECK_IN_LABELS = {
    never: "Never",
    monthly: "Monthly",
    every_6_months: "Every 6 Months",
    yearly: "Every Year"
};

const state = {
    mode: "login",
    view: "auth",
    user: null,
    session: null,
    pending: false,
    profilePending: false,
    passwordPending: false,
    recoveryPending: false,
    recoveryPendingType: "",
    resetToken: readResetTokenFromUrl()
};

if (state.resetToken) {
    state.view = "reset";
}

const elements = {
    authTitle: document.querySelector("[data-auth-title]"),
    modeControls: document.querySelector("[data-auth-mode-controls]"),
    form: document.querySelector("[data-auth-form]"),
    emailInput: document.querySelector('input[name="email"]'),
    passwordInput: document.querySelector('input[name="password"]'),
    registerProfileFields: document.querySelector("[data-register-profile-fields]"),
    registerFirstNameInput: document.querySelector('[data-auth-form] input[name="firstName"]'),
    registerLastNameInput: document.querySelector('[data-auth-form] input[name="lastName"]'),
    registerIaffLocalInput: document.querySelector('[data-auth-form] input[name="iaffLocalNumber"]'),
    registerBirthYearInput: document.querySelector('[data-auth-form] input[name="birthYear"]'),
    submitButton: document.querySelector("[data-auth-submit]"),
    logoutButton: document.querySelector("[data-auth-logout]"),
    status: document.querySelector("[data-auth-status]"),
    footer: document.querySelector("[data-auth-footer]"),
    copy: document.querySelector("[data-auth-copy]"),
    recoveryPanel: document.querySelector("[data-recovery-panel]"),
    recoveryTitle: document.querySelector("[data-recovery-title]"),
    recoveryCopy: document.querySelector("[data-recovery-copy]"),
    divider: document.querySelector("[data-auth-divider]"),
    secondaryActions: document.querySelector("[data-auth-secondary-actions]"),
    forgotPasswordTrigger: document.querySelector("[data-forgot-password-trigger]"),
    resetRequestForm: document.querySelector("[data-reset-request-form]"),
    resetRequestEmailInput: document.querySelector('input[name="recoveryEmail"]'),
    resetRequestSubmit: document.querySelector("[data-reset-request-submit]"),
    resetPasswordForm: document.querySelector("[data-reset-password-form]"),
    resetPasswordSubmit: document.querySelector("[data-reset-password-submit]"),
    resetBackButtons: Array.from(document.querySelectorAll("[data-reset-back]")),
    authenticatedPanel: document.querySelector("[data-authenticated-panel]"),
    authenticatedEmail: document.querySelector("[data-auth-email]"),
    authenticatedFullName: document.querySelector("[data-auth-full-name]"),
    authenticatedIaffLocal: document.querySelector("[data-auth-iaff-local]"),
    authenticatedBirthYear: document.querySelector("[data-auth-birth-year]"),
    authenticatedDisplayName: document.querySelector("[data-auth-display-name]"),
    authenticatedCreatedAt: document.querySelector("[data-auth-created-at]"),
    authenticatedPlanTier: document.querySelector("[data-auth-plan-tier]"),
    authenticatedPremiumAccess: document.querySelector("[data-auth-premium-access]"),
    authenticatedPremiumSource: document.querySelector("[data-auth-premium-source]"),
    authenticatedPremiumExpires: document.querySelector("[data-auth-premium-expires]"),
    authenticatedCheckInFrequency: document.querySelector("[data-auth-checkin-frequency]"),
    authenticatedCheckInLastSent: document.querySelector("[data-auth-checkin-last-sent]"),
    sessionStatus: document.querySelector("[data-session-status]"),
    sessionExpiry: document.querySelector("[data-session-expiry]"),
    sessionRefreshButton: document.querySelector("[data-session-refresh]"),
    modeButtons: Array.from(document.querySelectorAll("[data-auth-mode-toggle]")),
    profileForm: document.querySelector("[data-profile-form]"),
    profileSubmit: document.querySelector("[data-profile-submit]"),
    firstNameInput: document.querySelector('[data-profile-form] input[name="firstName"]'),
    lastNameInput: document.querySelector('[data-profile-form] input[name="lastName"]'),
    iaffLocalInput: document.querySelector('[data-profile-form] input[name="iaffLocalNumber"]'),
    birthYearInput: document.querySelector('[data-profile-form] input[name="birthYear"]'),
    displayNameInput: document.querySelector('[data-profile-form] input[name="displayName"]'),
    retirementCheckInFrequencySelect: document.querySelector("[data-profile-checkin-frequency]"),
    passwordForm: document.querySelector("[data-password-form]"),
    passwordSubmit: document.querySelector("[data-password-submit]")
};

function readResetTokenFromUrl() {
    try {
        const url = new URL(window.location.href);
        return url.searchParams.get("resetToken") || "";
    } catch (error) {
        console.warn("Reset token could not be read from the URL", error);
        return "";
    }
}

function clearResetTokenFromUrl() {
    try {
        const url = new URL(window.location.href);
        url.searchParams.delete("resetToken");
        window.history.replaceState(
            {},
            document.title,
            `${url.pathname}${url.search}${url.hash}`
        );
    } catch (error) {
        console.warn("Reset token could not be removed from the URL", error);
    }
}

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

function getBirthYearBounds() {
    return {
        min: 1900,
        max: new Date().getFullYear()
    };
}

function normalizeBirthYearInput(value) {
    const parsed = parseInt(value, 10);
    const bounds = getBirthYearBounds();

    if (
        !Number.isFinite(parsed) ||
        parsed < bounds.min ||
        parsed > bounds.max
    ) {
        return null;
    }

    return parsed;
}

function readAccountProfileFields(source = "register") {
    const inputs = source === "register"
        ? {
            firstName: elements.registerFirstNameInput,
            lastName: elements.registerLastNameInput,
            iaffLocalNumber: elements.registerIaffLocalInput,
            birthYear: elements.registerBirthYearInput
        }
        : {
            firstName: elements.firstNameInput,
            lastName: elements.lastNameInput,
            iaffLocalNumber: elements.iaffLocalInput,
            birthYear: elements.birthYearInput
        };

    return {
        firstName: inputs.firstName?.value?.trim() || "",
        lastName: inputs.lastName?.value?.trim() || "",
        iaffLocalNumber: inputs.iaffLocalNumber?.value?.trim() || "",
        birthYear: normalizeBirthYearInput(inputs.birthYear?.value)
    };
}

function validateRequiredProfile(profile) {
    if (!profile.firstName || !profile.lastName) {
        return "First name and last name are required.";
    }

    if (!profile.iaffLocalNumber) {
        return "IAFF local number is required.";
    }

    if (!profile.birthYear) {
        return "Enter a valid birth year.";
    }

    return "";
}

function initializeBirthYearInputs() {
    const bounds = getBirthYearBounds();

    [
        elements.registerBirthYearInput,
        elements.birthYearInput
    ].forEach(input => {
        if (!input) {
            return;
        }

        input.min = String(bounds.min);
        input.max = String(bounds.max);
    });
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

function formatRetirementCheckInFrequency(value) {
    return RETIREMENT_CHECK_IN_LABELS[String(value || "").trim().toLowerCase()] || "Never";
}

function formatPremiumSource(accountContext) {
    const entitlements = accountContext?.entitlements || {};

    if (!entitlements?.premium) {
        return "Not active";
    }

    const source = String(entitlements.premiumSource || "").trim().toLowerCase();

    if (
        source.includes("annual") ||
        source.includes("year") ||
        source.includes("subscription") ||
        source.includes("stripe")
    ) {
        return "Annual subscription";
    }

    if (source === "manual") {
        return "Manual / admin grant";
    }

    return "Premium access";
}

function formatPremiumExpiry(accountContext) {
    const entitlements = accountContext?.entitlements || {};

    if (!entitlements?.premium) {
        return "Not active";
    }

    if (!entitlements.premiumExpiresAt) {
        return "No renewal date set";
    }

    return formatTimestamp(entitlements.premiumExpiresAt);
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

function getAnonymousTitle() {
    if (state.view === "reset") {
        return VIEW_TITLE[state.view];
    }

    return MODE_TITLE[state.mode];
}

function getAnonymousCopy() {
    if (state.view === "reset") {
        return VIEW_COPY[state.view];
    }

    return MODE_COPY[state.mode];
}

function getAnonymousFooter() {
    if (state.view === "forgot") {
        return "If the email is recognized, the recovery link will help you get back into your account without contacting support.";
    }

    if (state.view === "reset") {
        return "After you save a new password, you can sign back in and continue working from your synced plans.";
    }

    return "New here? Create an account now so your saved-plan flow is ready as frontend syncing rolls out.";
}

function renderAnonymousView() {
    const authenticated = Boolean(state.user);
    const inAuthView = state.view === "auth";
    const inForgotView = state.view === "forgot";
    const inResetView = state.view === "reset";

    if (elements.authTitle) {
        elements.authTitle.textContent = getAnonymousTitle();
    }

    if (elements.copy) {
        elements.copy.textContent = getAnonymousCopy();
    }

    if (elements.modeControls) {
        elements.modeControls.hidden = authenticated || inResetView;
    }

    if (elements.form) {
        elements.form.hidden = authenticated || inResetView;
    }

    if (elements.registerProfileFields) {
        elements.registerProfileFields.hidden =
            authenticated ||
            inResetView ||
            state.mode !== "register";
    }

    if (elements.recoveryPanel) {
        elements.recoveryPanel.hidden = authenticated || (inAuthView && !inResetView);
    }

    if (elements.recoveryTitle) {
        elements.recoveryTitle.textContent = VIEW_TITLE[inResetView ? "reset" : "forgot"];
    }

    if (elements.recoveryCopy) {
        elements.recoveryCopy.textContent = VIEW_COPY[inResetView ? "reset" : "forgot"];
    }

    if (elements.resetRequestForm) {
        elements.resetRequestForm.hidden = authenticated || !inForgotView;
    }

    if (elements.resetPasswordForm) {
        elements.resetPasswordForm.hidden = authenticated || !inResetView;
    }

    if (elements.divider) {
        elements.divider.hidden = authenticated || inResetView;
    }

    if (elements.secondaryActions) {
        elements.secondaryActions.hidden = authenticated || inResetView;
    }

    if (elements.forgotPasswordTrigger) {
        elements.forgotPasswordTrigger.hidden =
            authenticated ||
            inResetView ||
            state.mode !== "login";
        elements.forgotPasswordTrigger.textContent = inForgotView
            ? "Hide password recovery"
            : "Forgot password?";
    }

    if (!authenticated && elements.footer) {
        elements.footer.textContent = getAnonymousFooter();
    }
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

    [
        elements.registerFirstNameInput,
        elements.registerLastNameInput,
        elements.registerIaffLocalInput,
        elements.registerBirthYearInput
    ].forEach(input => {
        if (input) {
            input.disabled = disabled;
        }
    });

    if (elements.submitButton) {
        elements.submitButton.disabled = disabled;
        elements.submitButton.textContent = pending
            ? (state.mode === "register" ? "Creating Account..." : "Logging In...")
            : MODE_TITLE[state.mode];
    }

    elements.modeButtons.forEach(button => {
        button.disabled = pending || Boolean(state.user);
    });

    renderAnonymousView();
}

function setProfilePending(pending) {
    state.profilePending = pending;

    [
        elements.firstNameInput,
        elements.lastNameInput,
        elements.iaffLocalInput,
        elements.birthYearInput
    ].forEach(input => {
        if (input) {
            input.disabled = pending;
        }
    });

    if (elements.displayNameInput) {
        elements.displayNameInput.disabled = pending;
    }

    if (elements.retirementCheckInFrequencySelect) {
        elements.retirementCheckInFrequencySelect.disabled = pending;
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

function setRecoveryPending(pending, type = "") {
    state.recoveryPending = pending;
    state.recoveryPendingType = pending ? type : "";

    if (elements.resetRequestForm) {
        Array.from(elements.resetRequestForm.querySelectorAll("input, button"))
            .forEach(field => {
                field.disabled = pending;
            });
    }

    if (elements.resetPasswordForm) {
        Array.from(elements.resetPasswordForm.querySelectorAll("input, button"))
            .forEach(field => {
                field.disabled = pending;
            });
    }

    if (elements.resetRequestSubmit) {
        elements.resetRequestSubmit.textContent =
            pending && type === "request"
                ? "Sending..."
                : "Send Reset Link";
    }

    if (elements.resetPasswordSubmit) {
        elements.resetPasswordSubmit.textContent =
            pending && type === "reset"
                ? "Saving..."
                : "Save New Password";
    }
}

function updateMode(mode, { preserveStatus = false } = {}) {
    state.mode = mode;

    elements.modeButtons.forEach(button => {
        const active = button.dataset.authModeToggle === mode;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
    });

    if (elements.passwordInput) {
        elements.passwordInput.autocomplete =
            mode === "register" ? "new-password" : "current-password";
    }

    renderAnonymousView();

    if (!preserveStatus) {
        setStatus("");
    }
}

function setAnonymousView(view, { preserveStatus = false } = {}) {
    state.view = view;
    renderAnonymousView();

    if (!preserveStatus) {
        setStatus("");
    }
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

    renderAnonymousView();

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
            : getAnonymousFooter();
    }

    if (elements.authenticatedEmail) {
        elements.authenticatedEmail.textContent = user?.email || "";
    }

    if (elements.authenticatedFullName) {
        elements.authenticatedFullName.textContent = authenticated
            ? (
                [user?.firstName, user?.lastName]
                    .map(value => String(value || "").trim())
                    .filter(Boolean)
                    .join(" ") || "Not set"
            )
            : "Unavailable";
    }

    if (elements.authenticatedIaffLocal) {
        elements.authenticatedIaffLocal.textContent = authenticated
            ? (user?.iaffLocalNumber || "Not set")
            : "Unavailable";
    }

    if (elements.authenticatedBirthYear) {
        elements.authenticatedBirthYear.textContent = authenticated
            ? (user?.birthYear || "Not set")
            : "Unavailable";
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

    if (elements.authenticatedPlanTier) {
        elements.authenticatedPlanTier.textContent = authenticated
            ? getPlanTierLabel(accountContext)
            : "Unavailable";
    }

    if (elements.authenticatedPremiumAccess) {
        elements.authenticatedPremiumAccess.textContent = authenticated
            ? (
                hasPremiumAccess(accountContext, "premium")
                    ? "Active"
                    : "Not active"
            )
            : "Unavailable";
    }

    if (elements.authenticatedPremiumSource) {
        elements.authenticatedPremiumSource.textContent = authenticated
            ? formatPremiumSource(accountContext)
            : "Unavailable";
    }

    if (elements.authenticatedPremiumExpires) {
        elements.authenticatedPremiumExpires.textContent = authenticated
            ? formatPremiumExpiry(accountContext)
            : "Unavailable";
    }

    if (elements.authenticatedCheckInFrequency) {
        elements.authenticatedCheckInFrequency.textContent = authenticated
            ? formatRetirementCheckInFrequency(user?.retirementCheckInFrequency)
            : "Unavailable";
    }

    if (elements.authenticatedCheckInLastSent) {
        elements.authenticatedCheckInLastSent.textContent = authenticated
            ? (
                user?.lastRetirementCheckInSentAt
                    ? formatTimestamp(user.lastRetirementCheckInSentAt)
                    : "Not sent yet"
            )
            : "Unavailable";
    }

    if (elements.displayNameInput) {
        elements.displayNameInput.value = user?.displayName || "";
    }

    if (elements.firstNameInput) {
        elements.firstNameInput.value = user?.firstName || "";
    }

    if (elements.lastNameInput) {
        elements.lastNameInput.value = user?.lastName || "";
    }

    if (elements.iaffLocalInput) {
        elements.iaffLocalInput.value = user?.iaffLocalNumber || "";
    }

    if (elements.birthYearInput) {
        elements.birthYearInput.value = user?.birthYear || "";
    }

    if (elements.retirementCheckInFrequencySelect) {
        elements.retirementCheckInFrequencySelect.value =
            String(user?.retirementCheckInFrequency || "never").trim().toLowerCase() || "never";
    }

    renderSessionInfo(session);
    setPending(false);
    setProfilePending(false);
    setPasswordPending(false);
    setRecoveryPending(false);
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

        if (!statusMessage) {
            setStatus("");
        }
    }
}

async function handleSubmit(event) {
    event.preventDefault();

    if (state.pending || state.user || state.view !== "auth") {
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

    const profile = readAccountProfileFields("register");
    const profileError =
        state.mode === "register"
            ? validateRequiredProfile(profile)
            : "";

    if (profileError) {
        setStatus(profileError, "error");
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
            await registerAccount(email, password, profile);
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
        setAnonymousView("auth", { preserveStatus: true });
        updateMode("login", { preserveStatus: true });
        renderAuthenticatedState(null);
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
    const profile = readAccountProfileFields("profile");
    const profileError = validateRequiredProfile(profile);
    const retirementCheckInFrequency =
        elements.retirementCheckInFrequencySelect?.value || "never";

    if (profileError) {
        setStatus(profileError, "error");
        return;
    }

    setProfilePending(true);
    setStatus("Saving account settings...", "neutral");

    try {
        const accountContext = await updateAccountProfile({
            firstName: profile.firstName,
            lastName: profile.lastName,
            iaffLocalNumber: profile.iaffLocalNumber,
            birthYear: profile.birthYear,
            displayName,
            retirementCheckInFrequency
        });
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

function openForgotPasswordView() {
    if (state.user || state.pending) {
        return;
    }

    if (state.view === "forgot") {
        handleRecoveryBack();
        return;
    }

    updateMode("login", { preserveStatus: true });

    if (
        elements.resetRequestEmailInput &&
        !elements.resetRequestEmailInput.value.trim()
    ) {
        elements.resetRequestEmailInput.value =
            elements.emailInput?.value?.trim() || "";
    }

    setAnonymousView("forgot");
}

function handleRecoveryBack() {
    if (state.view === "reset") {
        state.resetToken = "";
        clearResetTokenFromUrl();
        elements.resetPasswordForm?.reset();
    }

    setAnonymousView("auth", { preserveStatus: true });
    updateMode("login", { preserveStatus: true });
    setStatus("");
}

async function handleResetRequestSubmit(event) {
    event.preventDefault();

    if (state.user || state.recoveryPending) {
        return;
    }

    const email = elements.resetRequestEmailInput?.value?.trim() || "";

    if (!email) {
        setStatus("Enter the email address tied to your account.", "error");
        return;
    }

    setRecoveryPending(true, "request");
    setStatus("Sending your recovery link...", "neutral");

    try {
        const payload = await requestPasswordReset(email);

        if (elements.emailInput && !elements.emailInput.value.trim()) {
            elements.emailInput.value = email;
        }

        elements.resetRequestForm?.reset();
        setRecoveryPending(false);
        setAnonymousView("auth", { preserveStatus: true });
        updateMode("login", { preserveStatus: true });
        setStatus(
            payload?.message ||
                "If that email is registered, a password reset link is on the way.",
            "success"
        );
    } catch (error) {
        setRecoveryPending(false);
        setStatus(
            error.message || "A password reset link could not be requested.",
            "error"
        );
    }
}

async function handleResetPasswordSubmit(event) {
    event.preventDefault();

    if (state.user || state.recoveryPending || !state.resetToken) {
        return;
    }

    const newPassword =
        elements.resetPasswordForm
            ?.querySelector('input[name="resetNewPassword"]')
            ?.value || "";
    const confirmPassword =
        elements.resetPasswordForm
            ?.querySelector('input[name="resetConfirmPassword"]')
            ?.value || "";

    if (!newPassword || !confirmPassword) {
        setStatus("Fill out both password fields before saving.", "error");
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

    setRecoveryPending(true, "reset");
    setStatus("Saving your new password...", "neutral");

    try {
        await resetAccountPassword(state.resetToken, newPassword);
        elements.resetPasswordForm?.reset();
        state.resetToken = "";
        clearResetTokenFromUrl();
        setRecoveryPending(false);
        setAnonymousView("auth", { preserveStatus: true });
        updateMode("login", { preserveStatus: true });
        setStatus(
            "Password reset successfully. You can log in with your new password now.",
            "success"
        );
    } catch (error) {
        setRecoveryPending(false);
        setStatus(error.message || "Your password could not be reset.", "error");
    }
}

async function handleSessionRefresh() {
    if (!state.user) {
        return;
    }

    setStatus("Refreshing your active session...", "neutral");

    try {
        await refreshAccountContext("Session refreshed.", "success");
    } catch (error) {
        setStatus(error.message || "The session could not be refreshed.", "error");
    }
}

function bindEvents() {
    elements.modeButtons.forEach(button => {
        button.addEventListener("click", () => {
            if (state.pending || state.user || state.view === "reset") {
                return;
            }

            if (state.view === "forgot") {
                setAnonymousView("auth", { preserveStatus: true });
            }

            updateMode(button.dataset.authModeToggle || "login");
        });
    });

    elements.form?.addEventListener("submit", handleSubmit);
    elements.logoutButton?.addEventListener("click", handleLogout);
    elements.profileForm?.addEventListener("submit", handleProfileSubmit);
    elements.passwordForm?.addEventListener("submit", handlePasswordSubmit);
    elements.sessionRefreshButton?.addEventListener("click", handleSessionRefresh);
    elements.forgotPasswordTrigger?.addEventListener("click", openForgotPasswordView);
    elements.resetRequestForm?.addEventListener("submit", handleResetRequestSubmit);
    elements.resetPasswordForm?.addEventListener("submit", handleResetPasswordSubmit);
    elements.resetBackButtons.forEach(button => {
        button.addEventListener("click", handleRecoveryBack);
    });

    window.addEventListener("leoff-auth-state", event => {
        const type = event.detail?.type || "";

        if (type === "logout" || type === "expired") {
            elements.form?.reset();
            elements.passwordForm?.reset();
            setAnonymousView("auth", { preserveStatus: true });
            updateMode("login", { preserveStatus: true });
            renderAuthenticatedState(null);
            setStatus(
                type === "expired"
                    ? "Your session timed out after 15 minutes of inactivity."
                    : "You have been signed out.",
                type === "expired" ? "error" : "success"
            );
        }
    });
}

initializeBirthYearInputs();
updateMode("login", { preserveStatus: true });
setAnonymousView(state.view, { preserveStatus: true });
bindEvents();
refreshAccountContext();
