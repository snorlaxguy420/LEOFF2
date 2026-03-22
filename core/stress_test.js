export function classifyOutcome(firstDeficitYear, highInflation) {
    if (!firstDeficitYear) {
        return { label: "STRUCTURALLY SECURE", level: "secure" };
    }

    if (highInflation) {
        return { label: "INFLATION SENSITIVE", level: "warning" };
    }

    return { label: "STRUCTURAL DEFICIT", level: "danger" };
}

export function estimateSupplementNeeded(shortfall, withdrawalRate = 0.04) {
    return shortfall / withdrawalRate;
}