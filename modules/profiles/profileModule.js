import { assetRegistry } from "../../core/assetRegistry.js";

console.log("Profile module loaded");

/* -----------------------------
Age calculation
----------------------------- */

function calculateAge(month, year) {

    if (!month || !year) return null;

    const today = new Date();

    let age = today.getFullYear() - year;

    if (today.getMonth() + 1 < month) {
        age--;
    }

    return age;

}

function syncSocialSecurityBirthYear(value) {

    const ssBirthYear = document.getElementById("ssBirthYear");

    if (!ssBirthYear || !value) return;

    ssBirthYear.value = value;
}

/* -----------------------------
Module registration
----------------------------- */

assetRegistry.registerAsset({

    id: "profile",
    name: "Household Profile",
    type: "system",

    mount: "profileModuleContainer",

    stateFields: [
        "userName",
        "birthMonth",
        "birthYear",
        "maritalStatus",
        "spouseName",
        "spouseCurrentAge",
        "spouseRetirementAge",
        "spouseAnnualIncome"
    ],

/* --------------------------------
Create UI card
-------------------------------- */

createCard() {

    const card = document.createElement("div");
    card.className = "module-card";
    card.dataset.module = "profile";

    card.innerHTML = `

        <h2>Household Profile</h2>

        <div class="grid-2">

            <label>Name
                <input id="userName" type="text">
            </label>

            <label>Birth Month
                <select id="birthMonth">
                    <option value="">Month</option>
                    ${Array.from({length:12},(_,i)=>
                        `<option value="${i+1}">${new Date(0,i).toLocaleString('default',{month:'long'})}</option>`
                    ).join("")}
                </select>
            </label>

            <label>Birth Year
                <input id="birthYear" type="number">
            </label>

            <label>Marital Status
                <select id="maritalStatus">
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                </select>
            </label>

        </div>

        <div id="spouseSection" style="display:none;margin-top:20px;">

            <h3>Spouse</h3>

            <div class="grid-2">

                <label>Spouse Name
                    <input id="spouseName" type="text">
                </label>

                <label>Spouse Current Age
                    <input id="spouseCurrentAge" type="number">
                </label>

                <label>Spouse Retirement Age
                    <input id="spouseRetirementAge" type="number" value="65">
                </label>

                <label>Spouse Current Annual Income
                    <input id="spouseAnnualIncome" type="number" value="0">
                </label>

            </div>

        </div>
    `;

    const maritalStatus = card.querySelector("#maritalStatus");
    const spouseSection = card.querySelector("#spouseSection");
    const birthYearInput = card.querySelector("#birthYear");

    maritalStatus.addEventListener("change", () => {

        spouseSection.style.display =
            maritalStatus.value === "married" ? "block" : "none";

    });

    if (birthYearInput) {
        const syncBirthYear = () => {
            syncSocialSecurityBirthYear(birthYearInput.value);
        };

        birthYearInput.addEventListener("input", syncBirthYear);
        birthYearInput.addEventListener("change", syncBirthYear);
        syncBirthYear();
    }

    return card;
},

/* --------------------------------
Save state
-------------------------------- */

getState(){

    const form = document.querySelector('[data-module="profile"]');

    if(!form) return null;

    const state = {};

    this.stateFields.forEach(id => {

        const el = form.querySelector("#"+id);

        if(!el) return;

        state[id] = el.value;

    });

    return state;

},

/* --------------------------------
Restore state
-------------------------------- */

restoreState(state){

    if(!state) return null;

    const card = this.createCard();

    Object.entries(state).forEach(([id,val]) => {

        const el = card.querySelector("#"+id);

        if(el) el.value = val;

    });

    const marital = card.querySelector("#maritalStatus");
    const spouseSection = card.querySelector("#spouseSection");

    if(marital.value === "married"){
        spouseSection.style.display = "block";
    }

    syncSocialSecurityBirthYear(
        card.querySelector("#birthYear")?.value
    );

    return card;

},

/* --------------------------------
Expose profile object
-------------------------------- */

getProfile(){

    const name = document.getElementById("userName")?.value;

    const birthMonth =
        parseInt(document.getElementById("birthMonth")?.value);

    const birthYear =
        parseInt(document.getElementById("birthYear")?.value);

    const maritalStatus =
        document.getElementById("maritalStatus")?.value;

    const spouseName =
        document.getElementById("spouseName")?.value;

    const currentAge =
        calculateAge(birthMonth, birthYear);

    const spouseCurrentAge =
        parseInt(document.getElementById("spouseCurrentAge")?.value) || null;
    const spouseRetirementAge =
        parseInt(document.getElementById("spouseRetirementAge")?.value) || null;
    const spouseAnnualIncome =
        parseFloat(document.getElementById("spouseAnnualIncome")?.value || 0) || 0;

    return {

        name,
        birthMonth,
        birthYear,
        maritalStatus,
        currentAge,

        spouse: maritalStatus === "married" ? {

            name: spouseName,
            currentAge: spouseCurrentAge,
            age: spouseCurrentAge,
            retirementAge: spouseRetirementAge,
            annualIncome: spouseAnnualIncome

        } : null

    };

}

});
