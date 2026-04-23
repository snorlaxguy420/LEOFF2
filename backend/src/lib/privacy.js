const SENSITIVE_KEY_PATTERNS = [
    /^fullName$/i,
    /^(first|middle|last|preferred)name$/i,
    /^spouseName$/i,
    /^beneficiary/i,
    /^ssn$/i,
    /^socialSecurityNumber$/i,
    /^tax(Id|Identifier)$/i,
    /^account(Number|Id|Identifier)$/i,
    /^routing(Number)?$/i,
    /^member(Id|Number)$/i,
    /^employee(Id|Number)$/i,
    /^phone(Number)?$/i,
    /^address(Line)?[0-9]*$/i,
    /^street(Address)?$/i
];

function isPlainObject(value) {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}

function isSensitiveKey(key, path) {
    const normalizedPath = path.join(".");

    if (
        key === "name" &&
        (
            normalizedPath.endsWith("profile") ||
            normalizedPath.endsWith("profile.spouse")
        )
    ) {
        return true;
    }

    return SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
}

export function minimizePersistedPlannerState(value, path = []) {
    if (Array.isArray(value)) {
        return value.map(entry => minimizePersistedPlannerState(entry, path));
    }

    if (!isPlainObject(value)) {
        return value;
    }

    const minimized = {};

    for (const [key, childValue] of Object.entries(value)) {
        if (isSensitiveKey(key, path)) {
            continue;
        }

        minimized[key] = minimizePersistedPlannerState(
            childValue,
            [...path, key]
        );
    }

    return minimized;
}

export function normalizePersistedPlanPayload({
    simulationState,
    workspaceState
}) {
    const minimizedSimulationState =
        minimizePersistedPlannerState(simulationState || {});
    const minimizedWorkspaceState =
        minimizePersistedPlannerState(workspaceState || {});

    return {
        simulationState: minimizedSimulationState,
        workspaceState: {
            ...minimizedWorkspaceState,
            simulationState: minimizedSimulationState,
            moduleState:
                minimizedWorkspaceState?.moduleState &&
                typeof minimizedWorkspaceState.moduleState === "object"
                    ? minimizedWorkspaceState.moduleState
                    : {}
        }
    };
}
