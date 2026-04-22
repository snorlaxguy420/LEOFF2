function formatCurrency(value) {
    return "$" + Math.round(value || 0).toLocaleString();
}

function sumBalances(sources = []) {
    return (sources || []).reduce(
        (sum, source) => sum + (source?.balance || 0),
        0
    );
}

function totalPortfolio(result) {
    if (!result?.portfolios) {
        return 0;
    }

    return Object.values(result.portfolios)
        .reduce((sum, value) => sum + (value || 0), 0);
}

function findRetirementYearResult(results = [], retireAge = null) {
    if (!results.length) {
        return null;
    }

    return results.find(result => {
        if (!Number.isFinite(retireAge)) {
            return true;
        }

        return (result?.age ?? retireAge) >= retireAge;
    }) || results[0];
}

function isLiquidReserve(source = {}) {
    const label = String(source?.name || "").toLowerCase();

    return (
        source?.type === "portfolio" &&
        !source?.accountType &&
        (
            label.includes("checking") ||
            label.includes("cash") ||
            label.includes("savings") ||
            label.includes("hysa")
        )
    );
}

function isTaxableBrokerage(source = {}) {
    const label = String(source?.name || "").toLowerCase();

    return (
        source?.type === "portfolio" &&
        !source?.accountType &&
        label.includes("brokerage")
    );
}

function isRothAccount(source = {}) {
    return (
        source?.type === "portfolio" &&
        (
            source?.accountType === "roth_ira" ||
            source?.accountType === "roth_401k"
        )
    );
}

function isTaxDeferredAccount(source = {}) {
    return (
        source?.type === "portfolio" &&
        [
            "401k",
            "403b",
            "401a",
            "tsp",
            "traditional_ira",
            "457b"
        ].includes(source?.accountType)
    );
}

function isQualifiedPlan(source = {}) {
    return (
        source?.type === "portfolio" &&
        [
            "401k",
            "403b",
            "401a",
            "tsp",
            "roth_401k"
        ].includes(source?.accountType)
    );
}

function canUsePublicSafetyException(source = {}, retireAge = null) {
    return (
        Number.isFinite(retireAge) &&
        retireAge >= 50 &&
        retireAge < 59.5 &&
        isQualifiedPlan(source) &&
        source?.penaltyExceptionType === "public_safety_age50"
    );
}

function buildSequenceEntry(title, rationale) {
    return { title, rationale };
}

function buildNote(label, value) {
    return { label, value };
}

function getHouseholdSocialSecurityStartAge(simulationState = {}) {
    const claimAges = [
        simulationState?.socialSecurity?.claimAge,
        simulationState?.socialSecurity?.spouse?.claimAge
    ].filter(age => Number.isFinite(age));

    if (!claimAges.length) {
        return null;
    }

    return Math.min(...claimAges);
}

function findBridgeResults(results = [], retireAge = null, socialSecurityClaimAge = null) {
    if (!Number.isFinite(retireAge) || !Number.isFinite(socialSecurityClaimAge)) {
        return [];
    }

    return (results || []).filter(result => {
        const age = result?.age ?? null;

        return (
            Number.isFinite(age) &&
            age >= retireAge &&
            age < socialSecurityClaimAge
        );
    });
}

function getBridgeNeedTotals(bridgeResults = []) {
    return bridgeResults.reduce((totals, result) => {
        const expenses = result?.expenses || 0;
        const income = result?.income || 0;
        const gap = Math.max(0, expenses - income);

        return {
            totalNeed: totals.totalNeed + expenses,
            coveredIncome: totals.coveredIncome + income,
            cumulativeGap: totals.cumulativeGap + gap
        };
    }, {
        totalNeed: 0,
        coveredIncome: 0,
        cumulativeGap: 0
    });
}

function buildBridgeFundingEntry(title, rationale, amount = 0) {
    return {
        title,
        rationale,
        amount
    };
}

function buildBridgePressureLabel({ cumulativeGap = 0, bridgeYears = 0, accessibleBridgeBalance = 0 }) {
    if (bridgeYears <= 0 || cumulativeGap <= 0) {
        return "Low";
    }

    const coverageRatio =
        accessibleBridgeBalance / Math.max(cumulativeGap, 1);

    if (coverageRatio < 0.75 || bridgeYears >= 8) {
        return "High";
    }

    if (coverageRatio < 1.35 || bridgeYears >= 4) {
        return "Moderate";
    }

    return "Low";
}

function pickPrimaryBridgeSource({
    liquidReserve = 0,
    taxableBrokerage = 0,
    publicSafetyException = 0,
    taxDeferred457 = 0,
    roth = 0,
    taxDeferred = 0
}) {
    const ranked = [
        { label: "Checking / savings reserve", amount: liquidReserve },
        { label: "Taxable brokerage", amount: taxableBrokerage },
        { label: "Public-safety exception dollars", amount: publicSafetyException },
        { label: "457(b) balance", amount: taxDeferred457 },
        { label: "Roth reserve", amount: roth },
        { label: "Tax-deferred balances", amount: taxDeferred }
    ].sort((left, right) => right.amount - left.amount);

    return ranked[0]?.amount > 0
        ? ranked[0].label
        : "No obvious bridge funding source";
}

export function buildWithdrawalStrategyOptimization({
    simulationState = {},
    projection = null
} = {}) {
    const incomeSources = simulationState?.incomeSources || [];
    const results = projection?.results || [];
    const retireAge =
        simulationState?.profile?.retirementAge ??
        simulationState?.pension?.retirementAge ??
        null;
    const socialSecurityClaimAge =
        getHouseholdSocialSecurityStartAge(simulationState);
    const retirementYearResult =
        findRetirementYearResult(results, retireAge);
    const annualGap =
        Math.max(
            0,
            (retirementYearResult?.expenses || 0) -
            (retirementYearResult?.income || 0)
        );
    const bridgeYears =
        Number.isFinite(retireAge) &&
        Number.isFinite(socialSecurityClaimAge) &&
        socialSecurityClaimAge > retireAge
            ? socialSecurityClaimAge - retireAge
            : 0;
    const bridgeResults =
        findBridgeResults(results, retireAge, socialSecurityClaimAge);
    const bridgeNeedTotals =
        getBridgeNeedTotals(bridgeResults);

    const liquidReserveAccounts =
        incomeSources.filter(isLiquidReserve);
    const taxableBrokerageAccounts =
        incomeSources.filter(isTaxableBrokerage);
    const rothAccounts =
        incomeSources.filter(isRothAccount);
    const taxDeferredAccounts =
        incomeSources.filter(isTaxDeferredAccount);
    const publicSafetyExceptionAccounts =
        incomeSources.filter(source =>
            canUsePublicSafetyException(source, retireAge)
        );
    const accountBalances = {
        liquidReserve: sumBalances(liquidReserveAccounts),
        taxableBrokerage: sumBalances(taxableBrokerageAccounts),
        roth: sumBalances(rothAccounts),
        taxDeferred: sumBalances(taxDeferredAccounts),
        publicSafetyException: sumBalances(publicSafetyExceptionAccounts),
        taxDeferred457: sumBalances(
            taxDeferredAccounts.filter(source => source?.accountType === "457b")
        ),
        totalPortfolio: totalPortfolio(retirementYearResult)
    };
    const accessibleBridgeBalance =
        accountBalances.liquidReserve +
        accountBalances.taxableBrokerage +
        accountBalances.publicSafetyException +
        accountBalances.taxDeferred457;
    const bridgePressure =
        buildBridgePressureLabel({
            cumulativeGap: bridgeNeedTotals.cumulativeGap,
            bridgeYears,
            accessibleBridgeBalance
        });
    const primaryBridgeSource =
        pickPrimaryBridgeSource(accountBalances);
    const sequence = [];
    const bridgePlan = [];
    const notes = [];

    if (accountBalances.totalPortfolio <= 0) {
        return {
            headline: "No portfolio withdrawal strategy to optimize yet",
            summary:
                "The current plan does not have portfolio balances available at retirement, so there is no withdrawal sequence to optimize yet.",
            sequence: [],
            bridgePlan: [],
            notes: [],
            highlights: {
                bridgeYears,
                annualGap,
                taxDeferredBalance: accountBalances.taxDeferred,
                cumulativeBridgeGap: bridgeNeedTotals.cumulativeGap,
                primaryBridgeSource,
                bridgePressure
            }
        };
    }

    if (bridgeYears > 0 && accountBalances.liquidReserve > 0) {
        bridgePlan.push(
            buildBridgeFundingEntry(
                "Spend cash reserves first",
                `Use about ${formatCurrency(accountBalances.liquidReserve)} of checking, savings, or cash-like reserves before pulling on more strategic accounts.`,
                accountBalances.liquidReserve
            )
        );
        sequence.push(
            buildSequenceEntry(
                "Use checking and savings reserves for the first bridge years",
                `You have ${formatCurrency(accountBalances.liquidReserve)} in lower-volatility cash reserves. That is usually the cleanest place to cover early retirement spending before larger income sources arrive.`
            )
        );
    }

    if (bridgeYears > 0 && accountBalances.taxableBrokerage > 0) {
        bridgePlan.push(
            buildBridgeFundingEntry(
                "Use taxable brokerage next",
                `About ${formatCurrency(accountBalances.taxableBrokerage)} is available in taxable brokerage, which is usually the next-cleanest source after cash reserves during the bridge window.`,
                accountBalances.taxableBrokerage
            )
        );
        sequence.push(
            buildSequenceEntry(
                "Use taxable brokerage before Roth whenever possible",
                `You have ${formatCurrency(accountBalances.taxableBrokerage)} in taxable brokerage assets. That usually makes more sense as a bridge asset than spending Roth flexibility too early.`
            )
        );
    }

    if (bridgeYears > 0 && accountBalances.publicSafetyException > 0) {
        bridgePlan.push(
            buildBridgeFundingEntry(
                "Use penalty-free qualified-plan dollars after age 50",
                `About ${formatCurrency(accountBalances.publicSafetyException)} appears eligible under the public-safety age-50 exception, which can reduce bridge friction before age 59 1/2.`,
                accountBalances.publicSafetyException
            )
        );
        sequence.push(
            buildSequenceEntry(
                "Lean on penalty-free public-safety qualified plan dollars after age 50",
                `This plan includes ${formatCurrency(accountBalances.publicSafetyException)} in qualified-plan assets marked with the public-safety age-50 exception, which can reduce early-bridge friction before age 59 1/2.`
            )
        );
    } else if (bridgeYears > 0) {
        const balance457b = accountBalances.taxDeferred457;

        if (balance457b > 0) {
            bridgePlan.push(
                buildBridgeFundingEntry(
                    "Prioritize 457(b) withdrawals in the bridge",
                    `About ${formatCurrency(balance457b)} sits in 457(b) dollars, which are usually the cleanest tax-deferred bridge source because they avoid the standard early-withdrawal penalty.`,
                    balance457b
                )
            );
            sequence.push(
                buildSequenceEntry(
                    "Prioritize 457(b) dollars during the bridge window",
                    `You have ${formatCurrency(balance457b)} in 457(b) assets, which are usually the cleanest tax-deferred source to tap before age 59 1/2 because they do not carry the standard early-withdrawal penalty.`
                )
            );
        }
    }

    if (accountBalances.taxDeferred > 0) {
        sequence.push(
            buildSequenceEntry(
                "Draw tax-deferred balances gradually before RMD age",
                `You carry about ${formatCurrency(accountBalances.taxDeferred)} in tax-deferred retirement assets. Smoothing some withdrawals before age 73 can reduce the chance of oversized required distributions later.`
            )
        );
    }

    if (accountBalances.roth > 0) {
        sequence.push(
            buildSequenceEntry(
                "Keep Roth assets as a later-stage flexibility reserve",
                `You have ${formatCurrency(accountBalances.roth)} in Roth balances. Preserving Roth dollars can leave you with a cleaner late-retirement buffer for healthcare shocks, tax management, or legacy goals.`
            )
        );
    }

    if (bridgeYears > 0 && !bridgePlan.length) {
        bridgePlan.push(
            buildBridgeFundingEntry(
                "Bridge funding needs a custom manual plan",
                "The current account mix does not show an obvious low-friction bridge source, so this decision likely needs a more intentional tradeoff between current cash flow, penalties, taxes, and preserving later flexibility.",
                0
            )
        );
    }

    if (!sequence.length) {
        sequence.push(
            buildSequenceEntry(
                "Match withdrawals to the account mix you actually have",
                "The current account mix does not create a strong sequencing edge yet, so the main optimizer job is preserving flexibility and avoiding unnecessary taxes or penalties."
            )
        );
    }

    if (bridgeYears > 0) {
        notes.push(
            buildNote(
                "Bridge Window",
                `${bridgeYears} year${bridgeYears === 1 ? "" : "s"} until Social Security at age ${socialSecurityClaimAge}`
            )
        );
        notes.push(
            buildNote(
                "Cumulative Bridge Gap",
                bridgeNeedTotals.cumulativeGap > 0
                    ? `${formatCurrency(bridgeNeedTotals.cumulativeGap)} of uncovered spending before Social Security begins`
                    : "Bridge years appear covered before Social Security begins"
            )
        );
        notes.push(
            buildNote(
                "Primary Bridge Source",
                primaryBridgeSource
            )
        );
        notes.push(
            buildNote(
                "Bridge Pressure",
                `${bridgePressure} pressure based on bridge length and accessible bridge assets`
            )
        );
    }

    notes.push(
        buildNote(
            "Retirement-Year Gap",
            annualGap > 0
                ? `${formatCurrency(annualGap)} of spending pressure in the first retirement year`
                : "Current retirement-year income covers planned spending"
        )
    );

    if (accountBalances.taxDeferred > 0) {
        notes.push(
            buildNote(
                "RMD Exposure",
                `${formatCurrency(accountBalances.taxDeferred)} may eventually face required minimum distributions`
            )
        );
    }

    if (accountBalances.roth > 0) {
        notes.push(
            buildNote(
                "Roth Reserve",
                `${formatCurrency(accountBalances.roth)} available as a later-stage tax-free reserve`
            )
        );
    }

    const summary =
        annualGap > 0
            ? `The first retirement year shows about ${formatCurrency(annualGap)} of spending pressure, so withdrawal order matters. ${bridgeYears > 0 ? `This plan also needs to carry a ${bridgeYears}-year bridge to Social Security with ${bridgePressure.toLowerCase()} bridge pressure, so the planner focuses on cumulative bridge funding first, then tax order and Roth preservation.` : "The planner focuses on reducing penalty risk and preserving Roth flexibility for later years."}`
            : `Current retirement-year income appears to cover planned spending, so the optimizer focuses less on plugging an immediate gap and more on ${bridgeYears > 0 ? `managing the ${bridgeYears}-year bridge to Social Security with ${bridgePressure.toLowerCase()} pressure, ` : ""}tax order, and preserving Roth capacity for later years.`;

    return {
        headline: "Suggested withdrawal order for this plan",
        summary,
        sequence,
        bridgePlan,
        notes,
        highlights: {
            bridgeYears,
            annualGap,
            taxDeferredBalance: accountBalances.taxDeferred,
            cumulativeBridgeGap: bridgeNeedTotals.cumulativeGap,
            primaryBridgeSource,
            bridgePressure
        }
    };
}
