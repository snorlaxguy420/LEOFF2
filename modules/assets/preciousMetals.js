import { assetRegistry } from "../../core/assetRegistry.js";
import { createCollapsibleCard } from "../../core/createCollapsibleCard.js";

console.log("Precious metals asset module loaded");

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

        if (el.type === "checkbox") {
            state[id] = el.checked;
        } else {
            state[id] = el.value;
        }

    });

    return state;

}

function restoreFieldState(card, state) {

    Object.entries(state).forEach(([id,value]) => {

        const el = card.querySelector("#" + id);

        if (!el) return;

        if (el.type === "checkbox") {
            el.checked = value;
        } else {
            el.value = value;
        }

    });

}

function validateMetalForm(form) {
    const ounces = readNumber(form.querySelector("#ouncesOwned"));
    const spot = readNumber(form.querySelector("#spotPrice"));
    const growth = readNumber(form.querySelector("#growthRate"));

    if (ounces <= 0) {
        return "Enter ounces owned greater than 0 before saving.";
    }

    if (spot <= 0) {
        return "Enter a spot price greater than $0 before saving.";
    }

    if (growth <= -100) {
        return "Expected growth must be greater than -100%.";
    }

    return null;
}

function buildMetalSummaryHTML(form) {
    const metal =
        form.querySelector("#metalType").value;
    const ounces =
        form.querySelector("#ouncesOwned").value;
    const spot =
        form.querySelector("#spotPrice").value;
    const value = ounces * spot;

    return `
            <strong>${metal}</strong><br>
            Value: ${formatMoney(value)}<br>
            Position: ${Number(ounces).toLocaleString()} oz at ${formatMoney(spot)}/oz
        `;
}

/* ------------------------------------------------
Module
------------------------------------------------ */

assetRegistry.registerAsset({

    id: "preciousMetals",
    name: "Precious Metals",
    type: "asset",
    mount: "assetTypeContainer",

    stateFields: [
        "metalType",
        "spotPrice",
        "ouncesOwned",
        "growthRate"
    ],

/* ------------------------------------------------
Create Card
------------------------------------------------ */

createCard() {
    const cardUi = createCollapsibleCard({
        moduleId: "preciousMetals",
        formClass: "metal-form",
        summaryClass: "metal-summary",
        saveSelector: ".save-metal",
        removeSelector: ".remove-metal",
        editButtonClass: "edit-metal",
        validate: ({ form }) => validateMetalForm(form),
        formHTML: `

        <h3>Precious Metals</h3>

        <label>Metal</label>
        <select id="metalType">
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="platinum">Platinum</option>
            <option value="palladium">Palladium</option>
        </select>

        <label>Spot Price ($ / oz)</label>
        <input id="spotPrice" type="number" value="2000">

        <label>Ounces Owned</label>
        <input id="ouncesOwned" type="number" value="10">

        <label>Expected Growth (%)</label>
        <input id="growthRate" type="number" value="2">

        <button class="save-metal">Save Holding</button>
        <button class="remove-metal">Remove</button>

    `,
        buildSummary: ({ form }) => buildMetalSummaryHTML(form)
    });
    return cardUi.card;

},

/* ------------------------------------------------
State Save
------------------------------------------------ */

getState(){

    const cards =
        document.querySelectorAll('[data-module="preciousMetals"]');

    if (!cards.length) return null;

    const state = [];

    cards.forEach(card => {

        const form = card.querySelector(".metal-form");

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

    savedCards.forEach(metal => {

        const card = this.createCard();
        card.dataset.module = this.id;

        const form =
            card.querySelector(".metal-form");

        restoreFieldState(form, metal);
        const inputs = form.querySelectorAll("input, select");
        inputs.forEach(input => {
            input.disabled = true;
        });
        card.querySelector(".summary-text").innerHTML =
            buildMetalSummaryHTML(form);
        card.querySelector(".metal-form").style.display = "none";
        card.querySelector(".metal-summary").style.display = "block";

        cards.push(card);

    });

    return cards.length === 1 ? cards[0] : cards;

},

/* ------------------------------------------------
Simulation Payloads
------------------------------------------------ */

getSimulationPayloads(inputs) {

    const cards =
        document.querySelectorAll('[data-module="preciousMetals"]');

    if (!cards.length) return null;

    const payloads = [];

    cards.forEach(card => {

        const form =
            card.querySelector(".metal-form");

        const metal =
            form.querySelector("#metalType")?.value;

        const ounces =
            readNumber(form.querySelector("#ouncesOwned"));

        const spot =
            readNumber(form.querySelector("#spotPrice"));

        const growth =
            readPercent(form.querySelector("#growthRate"));

        const value = ounces * spot;

        if (!value) return;

        payloads.push({
            type: "portfolio",
            name: metal + " bullion",
            balance: value,
            growthRate: growth,
            taxable: false
        });

    });

    if (!payloads.length) return null;

    return payloads.length === 1
        ? payloads[0]
        : payloads;

}

});
