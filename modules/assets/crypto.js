import { assetRegistry } from "../../core/assetRegistry.js";
import { createCollapsibleCard } from "../../core/createCollapsibleCard.js";

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

function validateCryptoForm(form) {
    const balance = readNumber(form.querySelector("#cryptoBalance"));
    const growth = readNumber(form.querySelector("#cryptoGrowth"));

    if (balance <= 0) {
        return "Enter a crypto holding value greater than $0 before saving.";
    }

    if (growth <= -100) {
        return "Expected growth must be greater than -100%.";
    }

    return null;
}

function buildCryptoSummaryHTML(form) {
    const label =
        form.querySelector("#cryptoLabel").value || "Crypto";
    const balance =
        form.querySelector("#cryptoBalance").value;
    const growth =
        form.querySelector("#cryptoGrowth").value;

    return `
            <strong>${label}</strong><br>
            Value: ${formatMoney(balance)}<br>
            Growth: ${growth}% annually
        `;
}

/* ------------------------------------------------
Module
------------------------------------------------ */

assetRegistry.registerAsset({

    id: "crypto",
    name: "Crypto",
    type: "asset",
    mount: "assetTypeContainer",

    stateFields: [
        "cryptoLabel",
        "cryptoBalance",
        "cryptoGrowth"
    ],

createCard() {
    const cardUi = createCollapsibleCard({
        moduleId: "crypto",
        formClass: "crypto-form",
        summaryClass: "crypto-summary",
        saveSelector: ".save-crypto",
        removeSelector: ".remove-crypto",
        editButtonClass: "edit-crypto",
        inputSelector: "input",
        validate: ({ form }) => validateCryptoForm(form),
        formHTML: `

        <h3>Crypto</h3>

        <label>Holding Label</label>
        <input id="cryptoLabel" type="text" placeholder="Bitcoin">

        <label>Current Value ($)</label>
        <input id="cryptoBalance" type="number" value="0">

        <label>Expected Growth (%)</label>
        <input id="cryptoGrowth" type="number" value="7">

        <button class="save-crypto">Save Holding</button>
        <button class="remove-crypto">Remove</button>

    `,
        buildSummary: ({ form }) => buildCryptoSummaryHTML(form)
    });
    return cardUi.card;

},

/* ------------------------------------------------
State Save
------------------------------------------------ */

getState(){

    const cards =
        document.querySelectorAll('[data-module="crypto"]');

    if (!cards.length) return null;

    const state = [];

    cards.forEach(card => {

        const form = card.querySelector(".crypto-form");

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

    savedCards.forEach(asset => {

        const card = this.createCard();
        card.dataset.module = this.id;

        const form =
            card.querySelector(".crypto-form");

        restoreFieldState(form, asset);
        const inputs = form.querySelectorAll("input");
        inputs.forEach(input => {
            input.disabled = true;
        });
        card.querySelector(".summary-text").innerHTML =
            buildCryptoSummaryHTML(form);
        card.querySelector(".crypto-form").style.display = "none";
        card.querySelector(".crypto-summary").style.display = "block";

        cards.push(card);

    });

    return cards.length === 1 ? cards[0] : cards;

},

/* ------------------------------------------------
Simulation Payloads
------------------------------------------------ */

getSimulationPayloads(inputs) {

    const cards =
        document.querySelectorAll('[data-module="crypto"]');

    if (!cards.length) return null;

    const payloads = [];

    cards.forEach(card => {

        const form =
            card.querySelector(".crypto-form");

        const label =
            form.querySelector("#cryptoLabel")?.value || "Crypto";

        const balance =
            readNumber(form.querySelector("#cryptoBalance"));

        const growth =
            readPercent(form.querySelector("#cryptoGrowth"));

        if (!balance) return;

        payloads.push({
            type: "portfolio",
            name: label,
            balance: balance,
            growthRate: growth,
            taxable: true
        });

    });

    if (!payloads.length) return null;

    return payloads.length === 1
        ? payloads[0]
        : payloads;

}

});
