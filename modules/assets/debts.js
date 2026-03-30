import { assetRegistry } from "../../core/assetRegistry.js";
import { createCollapsibleCard } from "../../core/createCollapsibleCard.js";

console.log("Debt asset module loaded");

/* ------------------------------------------------
Helpers
------------------------------------------------ */

function readNumber(el) {
    return parseFloat(el?.value || 0);
}

function readPercent(el) {
    return parseFloat(el?.value || 0) / 100;
}

function formatMoney(v) {
    return "$" + Number(v).toLocaleString();
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

    Object.entries(state).forEach(([id,value]) => {

        const el = card.querySelector("#" + id);

        if (!el) return;

        el.value = value;

    });

}

/* ------------------------------------------------
Loan payoff math
------------------------------------------------ */

function calculateYearsToPayoff(balance, rate, monthlyPayment) {

    if (!balance || !monthlyPayment) return 0;

    const r = rate / 12;

    if (r === 0) {
        return (balance / monthlyPayment) / 12;
    }

    const months =
        Math.log(monthlyPayment / (monthlyPayment - balance * r)) /
        Math.log(1 + r);

    return months / 12;

}

function buildDebtSummaryHTML(form) {
    const name =
        form.querySelector("#debtName").value || "Debt";
    const balance =
        form.querySelector("#debtBalance").value;
    const payment =
        form.querySelector("#debtPayment").value;

    return `
            <strong>${name}</strong><br>
            Balance: ${formatMoney(balance)}<br>
            Payment: ${formatMoney(payment)}/mo
        `;
}

function validateDebtForm(form) {
    const balance = readNumber(form.querySelector("#debtBalance"));
    const rate = readPercent(form.querySelector("#debtRate"));
    const minimumPayment = readNumber(form.querySelector("#debtPayment"));
    const extraPayment = readNumber(form.querySelector("#debtExtra"));
    const totalPayment = minimumPayment + extraPayment;
    const monthlyInterestOnly = balance * (rate / 12);

    if (balance <= 0) {
        return "Enter a debt balance greater than $0 before saving.";
    }

    if (totalPayment <= 0) {
        return "Enter a monthly payment greater than $0 before saving.";
    }

    if (rate > 0 && totalPayment <= monthlyInterestOnly) {
        return "Monthly payment must be high enough to reduce principal, not just cover interest.";
    }

    return null;
}

/* ------------------------------------------------
Module
------------------------------------------------ */

assetRegistry.registerAsset({

    id: "debt",
    name: "Debt",
    type: "debt",
    mount: "debtTypeContainer",

    stateFields: [
        "debtName",
        "debtBalance",
        "debtRate",
        "debtPayment",
        "debtExtra"
    ],

/* ------------------------------------------------
Create Card
------------------------------------------------ */

createCard() {
    const cardUi = createCollapsibleCard({
        moduleId: "debt",
        formClass: "debt-form",
        summaryClass: "debt-summary",
        saveSelector: ".save-debt",
        removeSelector: ".remove-debt",
        editButtonClass: "edit-debt",
        inputSelector: "input",
        validate: ({ form }) => validateDebtForm(form),
        formHTML: `

        <h3>Debt</h3>

        <label>Debt Name</label>
        <input id="debtName" type="text" placeholder="Car Loan">

        <label>Current Balance</label>
        <input id="debtBalance" type="number" value="0">

        <label>Interest Rate (%)</label>
        <input id="debtRate" type="number" value="6">

        <label>Minimum Monthly Payment</label>
        <input id="debtPayment" type="number" value="0">

        <label>Extra Monthly Payment</label>
        <input id="debtExtra" type="number" value="0">

        <button class="save-debt">Save Liability</button>
        <button class="remove-debt">Remove</button>

    `,
        buildSummary: ({ form }) => buildDebtSummaryHTML(form)
    });
    return cardUi.card;

},

/* ------------------------------------------------
State Save
------------------------------------------------ */

getState(){

    const cards =
        document.querySelectorAll('[data-module="debt"]');

    if (!cards.length) return null;

    const state = [];

    cards.forEach(card => {

        const form = card.querySelector(".debt-form");

        state.push(
            saveFieldState(form, this.stateFields)
        );

    });

    return state;

},

/* ------------------------------------------------
State Restore
------------------------------------------------ */

restoreState(state){

    const savedCards = Array.isArray(state) ? state : [state];

    if (!savedCards.length || !savedCards[0]) return null;

    const cards = [];

    savedCards.forEach(debt => {

        const card = this.createCard();
        card.dataset.module = this.id;

        const form =
            card.querySelector(".debt-form");

        restoreFieldState(form, debt);
        const inputs = form.querySelectorAll("input");
        inputs.forEach(input => {
            input.disabled = true;
        });
        card.querySelector(".summary-text").innerHTML =
            buildDebtSummaryHTML(form);
        card.querySelector(".debt-form").style.display = "none";
        card.querySelector(".debt-summary").style.display = "block";

        cards.push(card);

    });

    return cards.length === 1 ? cards[0] : cards;

},

/* ------------------------------------------------
Simulation Payloads
------------------------------------------------ */

getSimulationPayloads(inputs) {

    const cards =
        document.querySelectorAll('[data-module="debt"]');

    if (!cards.length) return null;

    const payloads = [];

    cards.forEach(card => {

        const form =
            card.querySelector(".debt-form");

        const name =
            form.querySelector("#debtName")?.value || "Debt";

        const balance =
            readNumber(form.querySelector("#debtBalance"));

        const rate =
            readPercent(form.querySelector("#debtRate"));

        const monthlyPayment =
            readNumber(form.querySelector("#debtPayment")) +
            readNumber(form.querySelector("#debtExtra"));

        if (!balance || !monthlyPayment) return;

        const years =
            calculateYearsToPayoff(balance, rate, monthlyPayment);

        const endAge =
            inputs.currentAge + years;

        payloads.push({
            type: "expense",
            name: name,
            startAge: inputs.currentAge,
            endAge: endAge,
            annualAmount: monthlyPayment * 12,
            growthRate: 0,
            taxable: false

        });

    });

    if (!payloads.length) return null;

    return payloads.length === 1
        ? payloads[0]
        : payloads;

}

});
