import { assetRegistry } from "../../core/assetRegistry.js";
import { createCollapsibleCard } from "../../core/createCollapsibleCard.js";

function readNumber(el) {
    return parseFloat(el?.value || 0);
}

function readPercent(el) {
    return parseFloat(el?.value || 0) / 100;
}

function formatMoney(value) {
    return "$" + Number(value).toLocaleString();
}

function saveFieldState(card, ids) {
    const state = {};

    ids.forEach(id => {
        const el = card.querySelector("#" + id);

        if (!el) return;

        state[id] = el.value;
    });

    return state;
}

function restoreFieldState(card, state) {
    Object.entries(state).forEach(([id, value]) => {
        const el = card.querySelector("#" + id);

        if (!el) return;

        el.value = value;
    });
}

const liquidAccounts = [
    {
        id: "checkingCash",
        name: "Checking / Cash",
        heading: "Checking / Cash",
        labelId: "checkingCashLabel",
        balanceId: "checkingCashBalance",
        rateId: "checkingCashRate",
        withdrawAgeId: "checkingCashWithdrawAge",
        withdrawTypeId: "checkingCashWithdrawType",
        withdrawValueId: "checkingCashWithdrawValue",
        growthLabel: "Annual Interest Rate (%)",
        growthSummaryLabel: "Interest",
        defaultRate: 1.5,
        defaultWithdrawalType: "amount",
        defaultWithdrawalValue: 12000
    },
    {
        id: "savings",
        name: "Savings / HYSA",
        heading: "Savings / HYSA",
        labelId: "savingsLabel",
        balanceId: "savingsBalance",
        rateId: "savingsRate",
        withdrawAgeId: "savingsWithdrawAge",
        withdrawTypeId: "savingsWithdrawType",
        withdrawValueId: "savingsWithdrawValue",
        growthLabel: "Annual Interest Rate (%)",
        growthSummaryLabel: "Interest",
        defaultRate: 4.0,
        defaultWithdrawalType: "amount",
        defaultWithdrawalValue: 12000
    },
    {
        id: "brokerage",
        name: "Taxable Brokerage",
        heading: "Taxable Brokerage",
        labelId: "brokerageLabel",
        balanceId: "brokerageBalance",
        rateId: "brokerageRate",
        withdrawAgeId: "brokerageWithdrawAge",
        withdrawTypeId: "brokerageWithdrawType",
        withdrawValueId: "brokerageWithdrawValue",
        growthLabel: "Expected Annual Return (%)",
        growthSummaryLabel: "Return",
        defaultRate: 7.0,
        defaultWithdrawalType: "percent",
        defaultWithdrawalValue: 4
    }
];

liquidAccounts.forEach(account => {
    function getCards() {
        return Array.from(
            document.querySelectorAll(`[data-module="${account.id}"]`)
        );
    }

    function validateLiquidAccountForm(form) {
        const balance =
            readNumber(form.querySelector(`#${account.balanceId}`));
        const growth =
            readNumber(form.querySelector(`#${account.rateId}`));
        const withdrawAge =
            readNumber(form.querySelector(`#${account.withdrawAgeId}`));
        const withdrawalType =
            form.querySelector(`#${account.withdrawTypeId}`)?.value || "amount";
        const withdrawalValue =
            readNumber(form.querySelector(`#${account.withdrawValueId}`));

        if (balance <= 0) {
            return "Enter an account balance greater than $0 before saving.";
        }

        if (growth <= -100) {
            return "Annual rate must be greater than -100%.";
        }

        if (withdrawAge <= 0) {
            return "Enter a valid first withdrawal age before saving.";
        }

        if (withdrawalValue <= 0) {
            return withdrawalType === "percent"
                ? "Enter a withdrawal percent greater than 0 before saving."
                : "Enter a fixed withdrawal amount greater than $0 before saving.";
        }

        return null;
    }

    function buildSummaryHTML(form) {
        const customLabel =
            form.querySelector(`#${account.labelId}`)?.value?.trim();
        const displayLabel = customLabel || account.name;
        const balance =
            form.querySelector(`#${account.balanceId}`)?.value || 0;
        const growth =
            form.querySelector(`#${account.rateId}`)?.value || 0;
        const withdrawAge =
            form.querySelector(`#${account.withdrawAgeId}`)?.value || 0;
        const withdrawalType =
            form.querySelector(`#${account.withdrawTypeId}`)?.value || "amount";
        const withdrawalValue =
            form.querySelector(`#${account.withdrawValueId}`)?.value || 0;

        return `
            <strong>${displayLabel}</strong><br>
            Balance: ${formatMoney(balance)}<br>
            ${account.growthSummaryLabel}: ${growth}% annually<br>
            Withdrawal Plan: ${withdrawalType === "percent"
                ? `${withdrawalValue}%`
                : formatMoney(withdrawalValue)} at age ${withdrawAge}
        `;
    }

    assetRegistry.registerAsset({
        id: account.id,
        name: account.name,
        type: "asset",
        mount: "assetTypeContainer",
        stateFields: [
            account.labelId,
            account.balanceId,
            account.rateId,
            account.withdrawAgeId,
            account.withdrawTypeId,
            account.withdrawValueId
        ],

        createCard() {
            const cardUi = createCollapsibleCard({
                moduleId: account.id,
                formClass: `${account.id}-form`,
                summaryClass: `${account.id}-summary`,
                saveSelector: ".save-liquid-account",
                removeSelector: ".remove-liquid-account",
                editButtonClass: "edit-liquid-account",
                validate: ({ form }) => validateLiquidAccountForm(form),
                formHTML: `
                    <h3>${account.heading}</h3>

                    <label>Account Label</label>
                    <input id="${account.labelId}" type="text" value="${account.name}">

                    <label>Current Balance</label>
                    <input id="${account.balanceId}" type="number" value="0">

                    <label>${account.growthLabel}</label>
                    <input id="${account.rateId}" type="number" value="${account.defaultRate}">

                    <label>First Withdrawal Age</label>
                    <input id="${account.withdrawAgeId}" type="number" value="55">

                    <label>Withdrawal Type</label>
                    <select id="${account.withdrawTypeId}">
                        <option value="amount" ${account.defaultWithdrawalType === "amount" ? "selected" : ""}>Fixed Dollar Amount</option>
                        <option value="percent" ${account.defaultWithdrawalType === "percent" ? "selected" : ""}>Percent of Account</option>
                    </select>

                    <label>Withdrawal Value</label>
                    <input id="${account.withdrawValueId}" type="number" value="${account.defaultWithdrawalValue}">

                    <button class="save-liquid-account">Save Asset</button>
                    <button class="remove-liquid-account">Remove</button>
                `,
                buildSummary: ({ form }) => buildSummaryHTML(form)
            });

            return cardUi.card;
        },

        getState() {
            const cards = getCards();

            if (!cards.length) return null;

            const state = [];

            cards.forEach(card => {
                const form =
                    card.querySelector(`.${account.id}-form`);

                state.push(
                    saveFieldState(form, this.stateFields)
                );
            });

            return state;
        },

        restoreState(state) {
            const savedCards = Array.isArray(state) ? state : [state];

            if (!savedCards.length || !savedCards[0]) return null;

            const cards = [];

            savedCards.forEach(savedAccount => {
                const card = this.createCard();
                const form =
                    card.querySelector(`.${account.id}-form`);

                restoreFieldState(form, savedAccount);

                const inputs = form.querySelectorAll("input, select");
                inputs.forEach(input => {
                    input.disabled = true;
                });

                card.querySelector(".summary-text").innerHTML =
                    buildSummaryHTML(form);
                form.style.display = "none";
                card.querySelector(`.${account.id}-summary`).style.display = "block";

                cards.push(card);
            });

            return cards.length === 1 ? cards[0] : cards;
        },

        getSimulationPayloads() {
            const cards = getCards();

            if (!cards.length) return null;

            const payloads = [];

            cards.forEach(card => {
                const form =
                    card.querySelector(`.${account.id}-form`);
                const balance =
                    readNumber(form.querySelector(`#${account.balanceId}`));
                const withdrawalType =
                    form.querySelector(`#${account.withdrawTypeId}`)?.value || "amount";
                const withdrawalValue =
                    readNumber(form.querySelector(`#${account.withdrawValueId}`));

                if (!balance || !withdrawalValue) return;

                payloads.push({
                    type: "portfolio",
                    name:
                        form.querySelector(`#${account.labelId}`)?.value?.trim() ||
                        account.name,
                    balance,
                    startAge:
                        readNumber(form.querySelector(`#${account.withdrawAgeId}`)),
                    growthRate:
                        readPercent(form.querySelector(`#${account.rateId}`)),
                    withdrawalType,
                    withdrawal:
                        withdrawalType === "amount"
                            ? withdrawalValue
                            : null,
                    withdrawalRate:
                        withdrawalType === "percent"
                            ? withdrawalValue / 100
                            : null,
                    taxable: false
                });
            });

            if (!payloads.length) return null;

            return payloads.length === 1
                ? payloads[0]
                : payloads;
        }
    });
});
