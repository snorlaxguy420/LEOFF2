/* =========================================================
   TAX ADVANTAGED RETIREMENT ACCOUNTS MODULE
   ---------------------------------------------------------
   Handles:
   - 401k
   - Roth 401k
   - Traditional IRA
   - Roth IRA
   - 457b
   - 403(b)
   - 401(a)
   - TSP
========================================================= */

import { assetRegistry } from "../../core/assetRegistry.js";
import { createCollapsibleCard } from "../../core/createCollapsibleCard.js";

/* =========================================================
   ACCOUNT DEFINITIONS
========================================================= */

const accounts = [

{
    id: "401k",
    label: "401k",
    labelId: "four01kLabel",
    taxable: true,
    accountType: "401k",
    balanceId: "four01kBalance",
    growthId: "four01kGrowth",
    employeeContributionRateId: "four01kEmployeeContributionRate",
    employerMatchRateId: "four01kEmployerMatchRate",
    withdrawAgeId: "four01kWithdrawAge",
    withdrawTypeId: "four01kWithdrawType",
    withdrawValueId: "four01kWithdrawValue",
    penaltyExceptionId: "four01kPenaltyException"
},

{
    id: "roth401k",
    label: "Roth 401k",
    labelId: "roth401kLabel",
    taxable: false,
    accountType: "roth_401k",
    balanceId: "roth401kBalance",
    growthId: "roth401kGrowth",
    employeeContributionRateId: "roth401kEmployeeContributionRate",
    employerMatchRateId: "roth401kEmployerMatchRate",
    withdrawAgeId: "roth401kWithdrawAge",
    withdrawTypeId: "roth401kWithdrawType",
    withdrawValueId: "roth401kWithdrawValue",
    penaltyExceptionId: "roth401kPenaltyException"
},

{
    id: "ira",
    label: "Traditional IRA",
    labelId: "iraLabel",
    taxable: true,
    accountType: "traditional_ira",
    balanceId: "iraBalance",
    growthId: "iraGrowth",
    employeeContributionRateId: "iraEmployeeContributionRate",
    employerMatchRateId: "iraEmployerMatchRate",
    withdrawAgeId: "iraWithdrawAge",
    withdrawTypeId: "iraWithdrawType",
    withdrawValueId: "iraWithdrawValue",
    penaltyExceptionId: "iraPenaltyException"
},

{
    id: "roth",
    label: "Roth IRA",
    labelId: "rothLabel",
    taxable: false,
    accountType: "roth_ira",
    balanceId: "rothBalance",
    growthId: "rothGrowth",
    employeeContributionRateId: "rothEmployeeContributionRate",
    employerMatchRateId: "rothEmployerMatchRate",
    withdrawAgeId: "rothWithdrawAge",
    withdrawTypeId: "rothWithdrawType",
    withdrawValueId: "rothWithdrawValue",
    penaltyExceptionId: "rothPenaltyException"
},

{
    id: "457b",
    label: "457b",
    labelId: "four57bLabel",
    taxable: true,
    accountType: "457b",
    balanceId: "four57bBalance",
    growthId: "four57bGrowth",
    employeeContributionRateId: "four57bEmployeeContributionRate",
    employerMatchRateId: "four57bEmployerMatchRate",
    withdrawAgeId: "four57bWithdrawAge",
    withdrawTypeId: "four57bWithdrawType",
    withdrawValueId: "four57bWithdrawValue",
    penaltyExceptionId: "four57bPenaltyException"
},

{
    id: "403b",
    label: "403(b)",
    labelId: "four03bLabel",
    taxable: true,
    accountType: "403b",
    balanceId: "four03bBalance",
    growthId: "four03bGrowth",
    employeeContributionRateId: "four03bEmployeeContributionRate",
    employerMatchRateId: "four03bEmployerMatchRate",
    withdrawAgeId: "four03bWithdrawAge",
    withdrawTypeId: "four03bWithdrawType",
    withdrawValueId: "four03bWithdrawValue",
    penaltyExceptionId: "four03bPenaltyException"
},

{
    id: "401a",
    label: "401(a)",
    labelId: "four01aLabel",
    taxable: true,
    accountType: "401a",
    balanceId: "four01aBalance",
    growthId: "four01aGrowth",
    employeeContributionRateId: "four01aEmployeeContributionRate",
    employerMatchRateId: "four01aEmployerMatchRate",
    withdrawAgeId: "four01aWithdrawAge",
    withdrawTypeId: "four01aWithdrawType",
    withdrawValueId: "four01aWithdrawValue",
    penaltyExceptionId: "four01aPenaltyException"
},

{
    id: "tsp",
    label: "TSP",
    labelId: "tspLabel",
    taxable: true,
    accountType: "tsp",
    balanceId: "tspBalance",
    growthId: "tspGrowth",
    employeeContributionRateId: "tspEmployeeContributionRate",
    employerMatchRateId: "tspEmployerMatchRate",
    withdrawAgeId: "tspWithdrawAge",
    withdrawTypeId: "tspWithdrawType",
    withdrawValueId: "tspWithdrawValue",
    penaltyExceptionId: "tspPenaltyException"
}

];

/* =========================================================
   REGISTER EACH ACCOUNT
========================================================= */

accounts.forEach(account => {

    function getCards() {
        return Array.from(
            document.querySelectorAll(`[data-module="${account.id}"]`)
        );
    }

    function buildSummaryHTML(form) {
        const customLabel =
            form.querySelector(`#${account.labelId}`)?.value?.trim();
        const displayLabel = customLabel || account.label;
        const balance =
            form.querySelector(`#${account.balanceId}`)?.value || 0;
        const employeeContributionRate =
            parseFloat(
                form.querySelector(`#${account.employeeContributionRateId}`)?.value || 0
            ) || 0;
        const employerMatchRate =
            account.employerMatchRateId
                ? (parseFloat(
                    form.querySelector(`#${account.employerMatchRateId}`)?.value || 0
                ) || 0)
                : 0;
        const withdrawAge =
            form.querySelector(`#${account.withdrawAgeId}`)?.value || 0;
        const withdrawalType =
            form.querySelector(`#${account.withdrawTypeId}`)?.value || "percent";
        const withdrawalValue =
            form.querySelector(`#${account.withdrawValueId}`)?.value || 0;
        const contributionSummary =
            employeeContributionRate > 0 || employerMatchRate > 0
                ? `Employee: ${employeeContributionRate}% of pay${employerMatchRate > 0 ? ` | Match: ${employerMatchRate}% of pay` : ""}<br>`
                : "";

        return `
            <strong>${displayLabel}</strong><br>
            Balance: $${Number(balance).toLocaleString()}<br>
            ${contributionSummary}
            Withdrawal Plan: ${withdrawalType === "percent"
                ? `${withdrawalValue}%`
                : `$${Number(withdrawalValue).toLocaleString()}`} at age ${withdrawAge}
        `;
    }

    function validateAccountForm(form) {
        const balance =
            parseFloat(form.querySelector(`#${account.balanceId}`)?.value || 0);
        const growth =
            parseFloat(form.querySelector(`#${account.growthId}`)?.value || 0);
        const employeeContributionRate =
            parseFloat(
                form.querySelector(`#${account.employeeContributionRateId}`)?.value || 0
            );
        const employerMatchRate =
            account.employerMatchRateId
                ? parseFloat(
                    form.querySelector(`#${account.employerMatchRateId}`)?.value || 0
                )
                : 0;
        const withdrawAge =
            parseFloat(form.querySelector(`#${account.withdrawAgeId}`)?.value || 0);
        const withdrawalType =
            form.querySelector(`#${account.withdrawTypeId}`)?.value || "percent";
        const withdrawalValue =
            parseFloat(form.querySelector(`#${account.withdrawValueId}`)?.value || 0);

        if (balance <= 0) {
            return "Enter an account balance greater than $0 before saving.";
        }

        if (growth <= -100) {
            return "Expected annual return must be greater than -100%.";
        }

        if (employeeContributionRate < 0) {
            return "Employee contribution rate cannot be negative.";
        }

        if (employerMatchRate < 0) {
            return "Employer match rate cannot be negative.";
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

    function buildSimulationSourceFromCard(card) {
        const form = card.querySelector(`.${account.id}-form`);

        if (!form) return null;

        const withdrawalType =
            form.querySelector(`#${account.withdrawTypeId}`)?.value;

        const source = {
            type: "portfolio",
            name:
                form.querySelector(`#${account.labelId}`)?.value?.trim() ||
                account.label,
            balance: parseFloat(
                form.querySelector(`#${account.balanceId}`)?.value || 0
            ),
            startAge: parseFloat(
                form.querySelector(`#${account.withdrawAgeId}`)?.value || 0
            ),
            growthRate:
                (parseFloat(
                    form.querySelector(`#${account.growthId}`)?.value || 0
                ) || 0) / 100,
            employeeContributionRate:
                (parseFloat(
                    form.querySelector(`#${account.employeeContributionRateId}`)?.value || 0
                ) || 0) / 100,
            employerMatchRate:
                account.employerMatchRateId
                    ? ((parseFloat(
                        form.querySelector(`#${account.employerMatchRateId}`)?.value || 0
                    ) || 0) / 100)
                    : 0,
            withdrawalType,
            withdrawalRate:
                withdrawalType === "percent"
                    ? ((parseFloat(
                        form.querySelector(`#${account.withdrawValueId}`)?.value || 0
                    ) || 0) / 100)
                    : null,
            withdrawal:
                withdrawalType === "amount"
                    ? parseFloat(
                        form.querySelector(`#${account.withdrawValueId}`)?.value || 0
                    )
                    : null,
            taxable: account.taxable,
            accountType: account.accountType,
            penaltyExceptionType:
                form.querySelector(`#${account.penaltyExceptionId}`)?.value ||
                "standard"
        };

        if (!source.balance || source.balance <= 0) {
            return null;
        }

        return source;
    }

    assetRegistry.registerAsset({

        id: account.id,
        name: account.label,
        type: "retirement",
        mount: "retirementTypeContainer",
        stateFields: [
            account.labelId,
            account.balanceId,
            account.growthId,
            account.employeeContributionRateId,
            account.employerMatchRateId,
            account.withdrawAgeId,
            account.withdrawTypeId,
            account.withdrawValueId,
            account.penaltyExceptionId
        ].filter(Boolean),

        /* -----------------------------------------
           UI CARD
        ----------------------------------------- */

        createCard() {

            const cardUi = createCollapsibleCard({
                moduleId: account.id,
                formClass: `${account.id}-form`,
                summaryClass: `${account.id}-summary`,
                saveSelector: ".save-account",
                removeSelector: ".remove-account",
                editButtonClass: "edit-account",
                validate: ({ form }) => validateAccountForm(form),
                formHTML: `

                <h3>${account.label}</h3>

                <label>Account Label</label>
                <input id="${account.labelId}" type="text" value="${account.label}">

                <label>Current Balance</label>
                <input id="${account.balanceId}" type="number" value="0">

                <label>Expected Annual Return (%)</label>
                <input id="${account.growthId}" type="number" value="7">

                <label>Employee Contribution (% of Annual Pay)</label>
                <input id="${account.employeeContributionRateId}" type="number" value="0">

                ${account.employerMatchRateId ? `
                <label>Employer Match (% of Annual Pay)</label>
                <input id="${account.employerMatchRateId}" type="number" value="0">
                ` : ""}

                <label>First Withdrawal Age</label>
                <input id="${account.withdrawAgeId}" type="number" value="55">

                <label>Withdrawal Type</label>
                <select id="${account.withdrawTypeId}">
                    <option value="percent">Percent of Portfolio</option>
                    <option value="amount">Fixed Dollar Amount</option>
                </select>

                <label>Withdrawal Value</label>
                <input id="${account.withdrawValueId}" type="number" value="4">

                <label>Early Withdrawal Rule</label>
                <select id="${account.penaltyExceptionId}">
                    <option value="standard">Standard age 59.5 rule</option>
                    <option value="age55">Separated from service in/after age 55 year</option>
                    <option value="public_safety_age50">Public safety separation at age 50+</option>
                </select>

                <button class="save-account">Save Asset</button>
                <button class="remove-account">Remove</button>

            `,
                buildSummary: ({ form }) => buildSummaryHTML(form)
            });

            return cardUi.card;

        },

        /* -----------------------------------------
           INTERNAL SOURCE BUILDER
        ----------------------------------------- */

        getSimulationSource() {

            return buildSimulationSourceFromCard(getCards()[0]);

        },

        getState() {
            const cards = getCards();

            if (!cards.length) return null;

            return cards.map(card => {
                const form = card.querySelector(`.${account.id}-form`);
                const state = {};

                this.stateFields.forEach(fieldId => {
                    const el = form?.querySelector(`#${fieldId}`);
                    if (!el) return;
                    state[fieldId] = el.value;
                });

                return state;
            });
        },

        restoreState(state) {
            const savedCards = Array.isArray(state) ? state : [state];

            if (!savedCards.length || !savedCards[0]) return null;

            const restoredCards = savedCards.map(savedCard => {
                const card = this.createCard();
                card.dataset.module = this.id;
                const form = card.querySelector(`.${account.id}-form`);

                this.stateFields.forEach(fieldId => {
                    const el = form?.querySelector(`#${fieldId}`);
                    if (!el || savedCard[fieldId] === undefined) return;
                    el.value = savedCard[fieldId];
                });

                const inputs = form.querySelectorAll("input, select");
                inputs.forEach(input => {
                    input.disabled = true;
                });

                card.querySelector(".summary-text").innerHTML =
                    buildSummaryHTML(form);

                card.querySelector(`.${account.id}-form`).style.display = "none";
                card.querySelector(`.${account.id}-summary`).style.display = "block";

                return card;
            });

            return restoredCards.length === 1
                ? restoredCards[0]
                : restoredCards;
        },

        /* -----------------------------------------
           REQUIRED BY APP.JS
        ----------------------------------------- */

        getSimulationPayloads() {

            const payloads = getCards()
                .map(card => buildSimulationSourceFromCard(card))
                .filter(Boolean);

            if (!payloads.length) return null;

            return payloads.length === 1
                ? payloads[0]
                : payloads;

        }

    });

});
