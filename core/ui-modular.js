/***********************************************************************
 LEOFF 2 RETIREMENT STRUCTURAL SIMULATOR
 UI-MODULAR.JS — FULL DYNAMIC UI SYSTEM
 
 This file:
 - Adds dynamic "Other Pensions"
 - Adds dynamic "Other Income"
 - Adds dynamic "Additional Assets"
 - Adds dynamic "Custom Events"
 - Does NOT remove or interfere with existing inputs
 - Exposes structured data to engine.js
 
 Fully commented for maintainability.
************************************************************************/

document.addEventListener("DOMContentLoaded", () => {

    /*******************************************************************
     SECTION 1 — GLOBAL REGISTRIES
     These arrays store dynamic user-created objects.
    ********************************************************************/

    window.dynamicPensions = [];
    window.dynamicIncome = [];
    window.dynamicAssets = [];
    window.dynamicEvents = [];

    /*******************************************************************
     SECTION 2 — HELPERS
    ********************************************************************/

    function createInput(labelText, type = "number", defaultValue = "") {
        const wrapper = document.createElement("div");
        wrapper.className = "input-group";

        const label = document.createElement("label");
        label.textContent = labelText;

        const input = document.createElement("input");
        input.type = type;
        input.value = defaultValue;

        wrapper.appendChild(label);
        wrapper.appendChild(input);

        return { wrapper, input };
    }

    function createSelect(labelText, options) {
        const wrapper = document.createElement("div");
        wrapper.className = "input-group";

        const label = document.createElement("label");
        label.textContent = labelText;

        const select = document.createElement("select");

        options.forEach(opt => {
            const option = document.createElement("option");
            option.value = opt.value;
            option.textContent = opt.label;
            select.appendChild(option);
        });

        wrapper.appendChild(label);
        wrapper.appendChild(select);

        return { wrapper, select };
    }

    function createCard(title) {
        const card = document.createElement("div");
        card.className = "dynamic-card";

        const header = document.createElement("h4");
        header.textContent = title;

        card.appendChild(header);

        return card;
    }

    function addRemoveButton(card, registryArray, objectRef) {
        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remove";
        removeBtn.className = "remove-btn";

        removeBtn.addEventListener("click", () => {
            const index = registryArray.indexOf(objectRef);
            if (index > -1) registryArray.splice(index, 1);
            card.remove();
        });

        card.appendChild(removeBtn);
    }

    /*******************************************************************
     SECTION 3 — OTHER PENSIONS UI
    ********************************************************************/

    const pensionContainer = document.getElementById("otherPensionsContainer");
    const addPensionBtn = document.getElementById("addPensionBtn");

    if (addPensionBtn && pensionContainer) {

        addPensionBtn.addEventListener("click", () => {

            const pension = {};
            const card = createCard("Additional Pension");

            const nameField = createInput("Name", "text", "Pension");
            const startAgeField = createInput("Start Age", "number", 60);
            const endAgeField = createInput("End Age (optional)", "number", "");
            const annualField = createInput("Annual Amount", "number", 20000);
            const growthField = createInput("COLA %", "number", 2);

            const taxableSelect = createSelect("Taxable?", [
                { value: "true", label: "Yes" },
                { value: "false", label: "No" }
            ]);

            card.appendChild(nameField.wrapper);
            card.appendChild(startAgeField.wrapper);
            card.appendChild(endAgeField.wrapper);
            card.appendChild(annualField.wrapper);
            card.appendChild(growthField.wrapper);
            card.appendChild(taxableSelect.wrapper);

            pensionContainer.appendChild(card);

            pension.name = nameField.input;
            pension.startAge = startAgeField.input;
            pension.endAge = endAgeField.input;
            pension.annual = annualField.input;
            pension.growthRate = growthField.input;
            pension.taxable = taxableSelect.select;

            window.dynamicPensions.push(pension);

            addRemoveButton(card, window.dynamicPensions, pension);
        });
    }

    /*******************************************************************
     SECTION 4 — OTHER INCOME UI
    ********************************************************************/

    const incomeContainer = document.getElementById("otherIncomeContainer");
    const addIncomeBtn = document.getElementById("addIncomeBtn");

    if (addIncomeBtn && incomeContainer) {

        addIncomeBtn.addEventListener("click", () => {

            const income = {};
            const card = createCard("Additional Income Source");

            const nameField = createInput("Name", "text", "Income");
            const startAgeField = createInput("Start Age", "number", 60);
            const endAgeField = createInput("End Age (optional)", "number", "");
            const annualField = createInput("Annual Amount", "number", 10000);

            card.appendChild(nameField.wrapper);
            card.appendChild(startAgeField.wrapper);
            card.appendChild(endAgeField.wrapper);
            card.appendChild(annualField.wrapper);

            incomeContainer.appendChild(card);

            income.name = nameField.input;
            income.startAge = startAgeField.input;
            income.endAge = endAgeField.input;
            income.annual = annualField.input;

            window.dynamicIncome.push(income);

            addRemoveButton(card, window.dynamicIncome, income);
        });
    }

 
    /*******************************************************************
     SECTION 6 — CUSTOM EVENTS UI
    ********************************************************************/

    const eventContainer = document.getElementById("customEventsContainer");
    const addEventBtn = document.getElementById("addEventBtn");

    if (addEventBtn && eventContainer) {

        addEventBtn.addEventListener("click", () => {

            const event = {};
            const card = createCard("Custom Event");

            const ageField = createInput("Age", "number", 70);
            const amountField = createInput("Amount (+income / -expense)", "number", 10000);

            card.appendChild(ageField.wrapper);
            card.appendChild(amountField.wrapper);

            eventContainer.appendChild(card);

            event.age = ageField.input;
            event.amount = amountField.input;

            window.dynamicEvents.push(event);

            addRemoveButton(card, window.dynamicEvents, event);
        });
    }
/* =========================================================
   NON-LIQUID ASSETS MODULE
========================================================= */

const assetContainer = document.getElementById("assetsContainer");
const addAssetBtn = document.getElementById("addAssetBtn");

if (addAssetBtn && assetContainer) {

    addAssetBtn.addEventListener("click", () => {

        const index = assetContainer.children.length;

        const wrapper = document.createElement("div");
        wrapper.className = "asset-entry";

        wrapper.innerHTML = `
            <hr>
            <label>
                Asset Name
                <input type="text" class="assetName"
                       value="Asset ${index + 1}">
            </label>

            <label>
                Current Value
                <input type="number" class="assetValue"
                       value="100000">
            </label>

            <label>
                Annual Growth Rate (%)
                <input type="number" class="assetGrowth"
                       value="3">
            </label>

            <label>
                Liquidation Age (optional)
                <input type="number" class="assetLiquidationAge">
            </label>

            <label>
                % To Liquidate (1 = 100%)
                <input type="number" class="assetLiquidationPercent"
                       value="1" step="0.1">
            </label>
        `;

        assetContainer.appendChild(wrapper);
    });
}

});