import { assetRegistry } from "../../core/assetRegistry.js";
import { generateRealEstatePayloads } from "../../core/realEstateEngine.js";
import { createCollapsibleCard } from "../../core/createCollapsibleCard.js";

console.log("Real estate asset module loaded");

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

    Object.entries(state).forEach(([id, value]) => {

        const el = card.querySelector("#" + id);

        if (!el) return;

        if (el.type === "checkbox") {
            el.checked = value;
        } else {
            el.value = value;
        }

    });

}

function validateRealEstateForm(form) {
    const propertyValue = readNumber(form.querySelector("#propertyValue"));
    const monthlyRent = readNumber(form.querySelector("#monthlyRent"));
    const mortgageBalance = readNumber(form.querySelector("#mortgageBalance"));
    const mortgageRate = readNumber(form.querySelector("#mortgageRate"));
    const mortgageYearsRemaining =
        readNumber(form.querySelector("#mortgageYearsRemaining"));

    if (propertyValue <= 0 && monthlyRent <= 0) {
        return "Enter either a property value or monthly rent greater than $0 before saving.";
    }

    if (mortgageBalance > 0 && mortgageYearsRemaining <= 0) {
        return "Enter mortgage years remaining greater than 0 when a mortgage balance is present.";
    }

    if (mortgageBalance > 0 && mortgageRate < 0) {
        return "Mortgage rate cannot be negative.";
    }

    return null;
}

function buildPropertySummaryHTML(form) {
    const label =
        form.querySelector("#propertyLabel").value || "Real Estate";
    const type =
        form.querySelector("#propertyType").value;
    const value =
        form.querySelector("#propertyValue").value;
    const rent =
        form.querySelector("#monthlyRent").value;

    return `
            <strong>${label}</strong><br>
            Value: ${formatMoney(value)}<br>
            Type: ${type}${Number(rent) > 0 ? ` | Rent: ${formatMoney(rent)}/mo` : ""}
        `;
}

/* ------------------------------------------------
Module
------------------------------------------------ */

assetRegistry.registerAsset({

    id: "realEstate",
    name: "Real Estate",
    type: "asset",
    mount: "assetTypeContainer",

    stateFields: [
        "propertyLabel",
        "propertyType",
        "propertyValue",
        "monthlyRent",
        "rentalGrowthRate",
        "vacancyRate",
        "mortgageBalance",
        "mortgageRate",
        "mortgageYearsRemaining",
        "propertyAppreciation",
        "propertyTaxRate",
        "insuranceCost",
        "maintenanceRate"
    ],

/* ------------------------------------------------
Create Card
------------------------------------------------ */

createCard() {

    const cardUi = createCollapsibleCard({
        moduleId: "realEstate",
        formClass: "property-form",
        summaryClass: "property-summary",
        saveSelector: ".save-property",
        removeSelector: ".remove-property",
        editButtonClass: "edit-property",
        validate: ({ form }) => validateRealEstateForm(form),
        formHTML: `

        <h3>Real Estate</h3>

        <label>Property Label</label>
        <input id="propertyLabel" type="text" placeholder="Lake Cabin">

        <label>Property Type</label>
        <select id="propertyType">
            <option value="primary">Primary Residence</option>
            <option value="rental">Rental Property</option>
            <option value="commercial">Commercial Property</option>
            <option value="land">Land</option>
        </select>

        <label>Property Value</label>
        <input id="propertyValue" type="number" value="500000">

        <label>Monthly Rent</label>
        <input id="monthlyRent" type="number" value="0">

        <label class="inline-tooltip">Rent Growth (%)
            <span class="inline-tooltip-text">
            Suggested default is 2.35%, based on the Washington Center for Real Estate Research Apartment Market Report cited in a December 1, 2025 Lakewood agenda item summarizing statewide Washington rent growth from Q3 2024 to Q3 2025. Sources: WCRER Apartment Market Reports, https://wcrer.be.uw.edu/housing-market-data-toolkit/apartment-market-reports/ ; City of Lakewood agenda packet, December 1, 2025, quoting the WCRER Q3 2025 report.
            </span>
        </label>
        <input id="rentalGrowthRate" type="number" value="2.35">

        <label>Vacancy Rate (%)</label>
        <input id="vacancyRate" type="number" value="5">

        <hr>

        <label>Mortgage Balance</label>
        <input id="mortgageBalance" type="number" value="0">

        <label>Mortgage Rate (%)</label>
        <input id="mortgageRate" type="number" value="6">

        <label>Mortgage Years Remaining</label>
        <input id="mortgageYearsRemaining" type="number" value="25">

        <hr>

        <label>Appreciation (%)</label>
        <input id="propertyAppreciation" type="number" value="4">

        <label>Property Tax (% of value)</label>
        <input id="propertyTaxRate" type="number" value="1.1">

        <label>Insurance (annual $)</label>
        <input id="insuranceCost" type="number" value="1800">

        <label>Maintenance (% of value)</label>
        <input id="maintenanceRate" type="number" value="1">

        <button class="save-property">Save Asset</button>
        <button class="remove-property">Remove</button>

    `,
        buildSummary: ({ form }) => buildPropertySummaryHTML(form)
    });

    return cardUi.card;

},

/* ------------------------------------------------
State Save
------------------------------------------------ */

getState() {

    const cards =
        document.querySelectorAll('[data-module="realEstate"]');

    if (!cards.length) return null;

    const state = [];

    cards.forEach(card => {

        const form = card.querySelector(".property-form");

        const inputs = form.querySelectorAll("input, select");

        const wasDisabled = [];

        inputs.forEach(input => {
            wasDisabled.push(input.disabled);
            input.disabled = false;
        });

        state.push(
            saveFieldState(form, this.stateFields)
        );

        inputs.forEach((input, index) => {
            input.disabled = wasDisabled[index];
        });

    });

    return state;

},

/* ------------------------------------------------
State Restore
------------------------------------------------ */

restoreState(state) {

    const savedCards = Array.isArray(state) ? state : [state];

    if (!savedCards.length || !savedCards[0]) return null;

    const cards = [];

    savedCards.forEach(property => {

        const card = this.createCard();
        card.dataset.module = this.id;
        const form = card.querySelector(".property-form");

        restoreFieldState(form, property);

        const inputs = form.querySelectorAll("input, select");
        inputs.forEach(input => {
            input.disabled = true;
        });

        card.querySelector(".summary-text").innerHTML =
            buildPropertySummaryHTML(form);

        card.querySelector(".property-form").style.display = "none";
        card.querySelector(".property-summary").style.display = "block";

        cards.push(card);

    });

    return cards.length === 1 ? cards[0] : cards;
},

/* ------------------------------------------------
Simulation Payloads
------------------------------------------------ */

getSimulationPayloads(inputs) {

    const cards =
        document.querySelectorAll('[data-module="realEstate"]');

    if (!cards.length) return null;

    const payloads = [];
    let totalRentalIncome = 0;
    let rentalIncomeGrowthRate = 0;
    let hasRentalIncome = false;
    let rentalIncomeStartAge =
        inputs.profile?.currentAge ??
        inputs.retireAge ??
        0;

    cards.forEach(card => {

        const form =
            card.querySelector(".property-form");

        const type =
            form.querySelector("#propertyType")?.value;

        const label =
            form.querySelector("#propertyLabel")?.value || "Real Estate";

        const value =
            readNumber(form.querySelector("#propertyValue"));

        const vacancy =
            readPercent(form.querySelector("#vacancyRate"));

        const mortgageBalance =
            readNumber(form.querySelector("#mortgageBalance"));

        const mortgageRate =
            readPercent(form.querySelector("#mortgageRate"));

        const mortgageYears =
            readNumber(form.querySelector("#mortgageYearsRemaining"));

        const appreciation =
            readPercent(form.querySelector("#propertyAppreciation"));
        const rentalGrowthRate =
            readPercent(form.querySelector("#rentalGrowthRate"));

        const taxRate =
            readPercent(form.querySelector("#propertyTaxRate"));

        const maintenanceRate =
            readPercent(form.querySelector("#maintenanceRate"));

        const insurance =
            readNumber(form.querySelector("#insuranceCost"));

        const enginePayloads = generateRealEstatePayloads({

            label,
            type,

            propertyValue: value,

            monthlyRent: readNumber(
                form.querySelector("#monthlyRent")
            ),

            vacancyRate: vacancy,

            mortgageBalance,
            mortgageRate,
            mortgageYearsRemaining: mortgageYears,

            appreciation,
            rentalGrowthRate,

            propertyTaxRate: taxRate,

            maintenanceRate,

            insuranceCost: insurance,

            currentAge:
                inputs.profile?.currentAge ??
                inputs.retireAge ??
                0,

            inflation:
                inputs.assumptions?.housingInflationRate ??
                inputs.assumptions?.inflationRate ??
                0

        });

        if (!value && !enginePayloads.some(payload => payload.name === "Rental Income")) {
            return;
        }

        enginePayloads.forEach(payload => {
            if (
                payload.type === "fixed" &&
                payload.name === "Rental Income"
            ) {
                totalRentalIncome += payload.annualAmount || 0;
                rentalIncomeGrowthRate = Math.max(
                    rentalIncomeGrowthRate,
                    payload.growthRate || 0
                );
                rentalIncomeStartAge = Math.min(
                    rentalIncomeStartAge,
                    payload.startAge ?? rentalIncomeStartAge
                );
                hasRentalIncome = true;
                return;
            }

            payloads.push(payload);
        });

    });

    if (hasRentalIncome && totalRentalIncome > 0) {
        payloads.push({
            type: "fixed",
            name: "Rental Income",
            startAge: rentalIncomeStartAge,
            annualAmount: totalRentalIncome,
            growthRate: rentalIncomeGrowthRate,
            taxable: true,
            taxCategory: "ordinary_income"
        });
    }

    if (!payloads.length) return null;

    return payloads.length === 1
        ? payloads[0]
        : payloads;

}

});
