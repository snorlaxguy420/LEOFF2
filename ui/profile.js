import {
    cancelPremiumSubscription,
    changeAccountPassword,
    getAccountContext,
    logoutAccount,
    updateAccountProfile
} from "./apiClient.js";
import {
    getPlanTierLabel,
    hasPremiumAccess
} from "./accountEntitlements.js";

const AUTH_SYNC_KEY = "leoffHelperAuthSync";
const WORKSPACE_STATE_KEY = "leoffSimulationState";
const RETIREMENT_CHECK_IN_LABELS = {
    never: "Never",
    monthly: "Monthly",
    every_6_months: "Every 6 Months",
    yearly: "Every Year"
};

const state = {
    accountContext: null,
    profilePending: false,
    passwordPending: false,
    cancellationPending: false
};

const elements = {
    content: document.querySelector("[data-profile-content]"),
    status: document.querySelector("[data-profile-status]"),
    email: document.querySelector("[data-auth-email]"),
    createdAt: document.querySelector("[data-auth-created-at]"),
    planTier: document.querySelector("[data-auth-plan-tier]"),
    premiumAccess: document.querySelector("[data-auth-premium-access]"),
    premiumSource: document.querySelector("[data-auth-premium-source]"),
    premiumExpires: document.querySelector("[data-auth-premium-expires]"),
    premiumSummary: document.querySelector("[data-premium-summary]"),
    premiumBuy: document.querySelector("[data-premium-buy]"),
    premiumCancel: document.querySelector("[data-premium-cancel]"),
    premiumCancelConfirm: document.querySelector("[data-premium-cancel-confirm]"),
    premiumCancelConfirmButton: document.querySelector("[data-premium-cancel-confirm-button]"),
    premiumCancelKeepButton: document.querySelector("[data-premium-cancel-keep]"),
    sessionStatus: document.querySelector("[data-session-status]"),
    sessionExpiry: document.querySelector("[data-session-expiry]"),
    sessionRefreshButton: document.querySelector("[data-session-refresh]"),
    logoutButton: document.querySelector("[data-auth-logout]"),
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

function getSavedPlannerProfileFallback() {
    try {
        const raw = localStorage.getItem(WORKSPACE_STATE_KEY);
        const workspaceState = raw ? JSON.parse(raw) : null;
        const profile =
            workspaceState?.simulationState?.profile ||
            workspaceState?.profile ||
            {};
        const displayName = String(profile?.name || "").trim();
        const nameParts = displayName.split(/\s+/).filter(Boolean);

        return {
            firstName: nameParts[0] || "",
            lastName:
                nameParts.length > 1
                    ? nameParts.slice(1).join(" ")
                    : "",
            birthYear: profile?.birthYear || "",
            displayName
        };
    } catch (error) {
        return {};
    }
}

function firstNonEmpty(...values) {
    const value = values.find(entry => {
        return entry !== undefined &&
            entry !== null &&
            String(entry).trim() !== "";
    });

    return value === undefined || value === null
        ? ""
        : String(value).trim();
}

function setInputValue(input, value) {
    if (!input) {
        return;
    }

    const normalizedValue =
        value === undefined || value === null
            ? ""
            : String(value);

    if (normalizedValue || !input.value) {
        input.value = normalizedValue;
    }
}

function buildEditableProfileValues(user = {}) {
    const plannerProfile = getSavedPlannerProfileFallback();
    const firstName = firstNonEmpty(
        user.firstName,
        plannerProfile.firstName
    );
    const lastName = firstNonEmpty(
        user.lastName,
        plannerProfile.lastName
    );
    const displayName = firstNonEmpty(
        user.displayName,
        plannerProfile.displayName,
        [firstName, lastName].filter(Boolean).join(" ")
    );

    return {
        firstName,
        lastName,
        iaffLocalNumber: firstNonEmpty(user.iaffLocalNumber),
        birthYear: firstNonEmpty(
            user.birthYear,
            plannerProfile.birthYear
        ),
        displayName,
        retirementCheckInFrequency:
            firstNonEmpty(
                user.retirementCheckInFrequency,
                "never"
            )
    };
}

function mergeSubmittedProfile(accountContext, profile, frequency) {
    if (!accountContext?.user) {
        return accountContext;
    }

    return {
        ...accountContext,
        user: {
            ...accountContext.user,
            firstName: profile.firstName,
            lastName: profile.lastName,
            iaffLocalNumber: profile.iaffLocalNumber,
            birthYear: profile.birthYear,
            displayName: profile.displayName,
            retirementCheckInFrequency: frequency
        }
    };
}

function readAccountProfileFields() {
    return {
        firstName: elements.firstNameInput?.value?.trim() || "",
        lastName: elements.lastNameInput?.value?.trim() || "",
        iaffLocalNumber: elements.iaffLocalInput?.value?.trim() || "",
        birthYear: normalizeBirthYearInput(elements.birthYearInput?.value),
        displayName: elements.displayNameInput?.value?.trim() || ""
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

function setProfilePending(pending) {
    state.profilePending = pending;

    [
        elements.firstNameInput,
        elements.lastNameInput,
        elements.iaffLocalInput,
        elements.birthYearInput,
        elements.displayNameInput,
        elements.retirementCheckInFrequencySelect
    ].forEach(input => {
        if (input) {
            input.disabled = pending;
        }
    });

    if (elements.profileSubmit) {
        elements.profileSubmit.disabled = pending;
        elements.profileSubmit.textContent = pending
            ? "Saving..."
            : "Save Settings";
    }
}

function setPasswordPending(pending) {
    state.passwordPending = pending;

    if (elements.passwordForm) {
        Array.from(elements.passwordForm.querySelectorAll("input"))
            .forEach(input => {
                input.disabled = pending;
            });
    }

    if (elements.passwordSubmit) {
        elements.passwordSubmit.disabled = pending;
        elements.passwordSubmit.textContent = pending
            ? "Updating..."
            : "Update Password";
    }
}

function buildSubscriptionMailto(type, user) {
    const email = user?.email || "";
    const name = [user?.firstName, user?.lastName]
        .map(value => String(value || "").trim())
        .filter(Boolean)
        .join(" ");
    const subject =
        type === "cancel"
            ? "LEOFF Helper Subscription Cancellation"
            : "LEOFF Helper Annual Subscription";
    const body =
        type === "cancel"
            ? [
                "I would like to cancel my LEOFF Helper premium subscription.",
                "",
                `Name: ${name}`,
                `Account email: ${email}`
            ].join("\n")
            : [
                "I'd like to buy a LEOFF Helper annual subscription for $15/year.",
                "",
                `Name: ${name}`,
                `Account email: ${email}`
            ].join("\n");

    return `mailto:leoffhelper@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function renderAccount(accountContext) {
    const user = accountContext?.user || null;

    if (!user) {
        window.location.assign("/ui/login.html");
        return;
    }

    state.accountContext = accountContext;

    if (elements.content) {
        elements.content.hidden = false;
    }

    if (elements.email) {
        elements.email.textContent = user.email || "";
    }

    if (elements.createdAt) {
        elements.createdAt.textContent = formatTimestamp(user.createdAt);
    }

    if (elements.planTier) {
        elements.planTier.textContent = getPlanTierLabel(accountContext);
    }

    if (elements.premiumAccess) {
        elements.premiumAccess.textContent =
            hasPremiumAccess(accountContext, "premium")
                ? "Active"
                : "Not active";
    }

    if (elements.premiumSource) {
        elements.premiumSource.textContent = formatPremiumSource(accountContext);
    }

    if (elements.premiumExpires) {
        elements.premiumExpires.textContent = formatPremiumExpiry(accountContext);
    }

    const premiumActive = hasPremiumAccess(accountContext, "premium");

    if (elements.premiumSummary) {
        elements.premiumSummary.textContent = premiumActive
            ? "Premium access is active for this account. You can use the subscriber-only planning tools anywhere they appear."
            : "Premium is not active. Annual support is $15/year and unlocks the subscriber planning tools listed below.";
    }

    if (elements.premiumBuy) {
        elements.premiumBuy.hidden = premiumActive;
        elements.premiumBuy.href = buildSubscriptionMailto("buy", user);
    }

    if (elements.premiumCancel) {
        elements.premiumCancel.hidden = !premiumActive;
    }

    if (elements.premiumCancelConfirm) {
        elements.premiumCancelConfirm.hidden = true;
    }

    if (elements.premiumCancelConfirmButton) {
        elements.premiumCancelConfirmButton.disabled = false;
        elements.premiumCancelConfirmButton.textContent = "Confirm Cancellation";
    }

    if (elements.sessionStatus) {
        elements.sessionStatus.textContent = accountContext.session
            ? `Active (${accountContext.session.idleTimeoutMinutes || 15}-minute inactivity timeout)`
            : "Active";
    }

    if (elements.sessionExpiry) {
        elements.sessionExpiry.textContent = formatTimestamp(accountContext.session?.expiresAt);
    }

    const profileValues = buildEditableProfileValues(user);

    setInputValue(elements.firstNameInput, profileValues.firstName);
    setInputValue(elements.lastNameInput, profileValues.lastName);
    setInputValue(elements.iaffLocalInput, profileValues.iaffLocalNumber);
    setInputValue(elements.birthYearInput, profileValues.birthYear);
    setInputValue(elements.displayNameInput, profileValues.displayName);

    if (elements.retirementCheckInFrequencySelect) {
        const frequency = String(
            profileValues.retirementCheckInFrequency || "never"
        )
            .trim()
            .toLowerCase();
        elements.retirementCheckInFrequencySelect.value =
            RETIREMENT_CHECK_IN_LABELS[frequency]
                ? frequency
                : "never";
    }

    setProfilePending(false);
    setPasswordPending(false);
}

async function refreshAccountContext(statusMessage = "", tone = "success") {
    try {
        const accountContext = await getAccountContext();
        renderAccount(accountContext);

        if (statusMessage) {
            setStatus(statusMessage, tone);
        } else {
            setStatus("");
        }
    } catch (error) {
        window.location.assign("/ui/login.html");
    }
}

async function handleProfileSubmit(event) {
    event.preventDefault();

    if (!state.accountContext?.user || state.profilePending) {
        return;
    }

    const profile = readAccountProfileFields();
    const profileError = validateRequiredProfile(profile);

    if (profileError) {
        setStatus(profileError, "error");
        return;
    }

    setProfilePending(true);
    setStatus("Saving account settings...", "neutral");

    try {
        const retirementCheckInFrequency =
            elements.retirementCheckInFrequencySelect?.value || "never";
        const accountContext = await updateAccountProfile({
            firstName: profile.firstName,
            lastName: profile.lastName,
            iaffLocalNumber: profile.iaffLocalNumber,
            birthYear: profile.birthYear,
            displayName: profile.displayName,
            retirementCheckInFrequency
        });
        const mergedAccountContext = mergeSubmittedProfile(
            accountContext,
            profile,
            retirementCheckInFrequency
        );

        renderAccount(mergedAccountContext);
        setStatus("Account settings updated.", "success");
        broadcastAuthChange("profile", mergedAccountContext?.user || null);
    } catch (error) {
        setProfilePending(false);
        setStatus(error.message || "Account settings could not be saved.", "error");
    }
}

async function handlePasswordSubmit(event) {
    event.preventDefault();

    if (!state.accountContext?.user || state.passwordPending || !elements.passwordForm) {
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

async function handleLogout() {
    if (!state.accountContext?.user) {
        window.location.assign("/ui/login.html");
        return;
    }

    setStatus("Signing you out...", "neutral");

    try {
        await logoutAccount();
        broadcastAuthChange("logout", null);
        window.location.assign("/ui/login.html");
    } catch (error) {
        setStatus(error.message || "Unable to sign out right now.", "error");
    }
}

function showCancellationConfirm() {
    if (!hasPremiumAccess(state.accountContext, "premium")) {
        return;
    }

    if (elements.premiumCancelConfirm) {
        elements.premiumCancelConfirm.hidden = false;
    }
}

function hideCancellationConfirm() {
    if (elements.premiumCancelConfirm) {
        elements.premiumCancelConfirm.hidden = true;
    }
}

async function handleConfirmCancellation() {
    if (
        state.cancellationPending ||
        !hasPremiumAccess(state.accountContext, "premium")
    ) {
        return;
    }

    state.cancellationPending = true;

    if (elements.premiumCancelConfirmButton) {
        elements.premiumCancelConfirmButton.disabled = true;
        elements.premiumCancelConfirmButton.textContent = "Cancelling...";
    }

    setStatus("Cancelling premium access...", "neutral");

    try {
        const accountContext = await cancelPremiumSubscription();
        state.cancellationPending = false;
        renderAccount(accountContext);
        setStatus("Premium has been cancelled. Your account is back on the free tier.", "success");
        broadcastAuthChange("profile", accountContext?.user || null);
    } catch (error) {
        state.cancellationPending = false;

        if (elements.premiumCancelConfirmButton) {
            elements.premiumCancelConfirmButton.disabled = false;
            elements.premiumCancelConfirmButton.textContent = "Confirm Cancellation";
        }

        setStatus(error.message || "Premium could not be cancelled right now.", "error");
    }
}

function initializeBirthYearInput() {
    const bounds = getBirthYearBounds();

    if (elements.birthYearInput) {
        elements.birthYearInput.min = String(bounds.min);
        elements.birthYearInput.max = String(bounds.max);
    }
}

function bindEvents() {
    elements.profileForm?.addEventListener("submit", handleProfileSubmit);
    elements.profileSubmit?.addEventListener("click", handleProfileSubmit);
    elements.passwordForm?.addEventListener("submit", handlePasswordSubmit);
    elements.logoutButton?.addEventListener("click", handleLogout);
    elements.premiumCancel?.addEventListener("click", showCancellationConfirm);
    elements.premiumCancelKeepButton?.addEventListener("click", hideCancellationConfirm);
    elements.premiumCancelConfirmButton?.addEventListener("click", handleConfirmCancellation);
    elements.sessionRefreshButton?.addEventListener("click", () => {
        void refreshAccountContext("Session refreshed.", "success");
    });

    window.addEventListener("leoff-auth-state", event => {
        const type = event.detail?.type || "";

        if (type === "logout" || type === "expired") {
            window.location.assign("/ui/login.html");
        }
    });
}

initializeBirthYearInput();
bindEvents();
refreshAccountContext();
