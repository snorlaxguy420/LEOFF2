export function createCollapsibleCard({
    moduleId,
    formClass,
    summaryClass,
    formHTML,
    saveSelector,
    removeSelector,
    editButtonClass,
    editButtonText = "Edit",
    removeButtonText = "Remove",
    inputSelector = "input, select, textarea",
    buildSummary,
    validate = null
}) {

    const card = document.createElement("div");
    card.className = "asset-card";
    card.dataset.moduleCard = moduleId;

    const form = document.createElement("div");
    form.className = formClass;
    form.innerHTML = formHTML;
    form.insertAdjacentHTML(
        "beforeend",
        '<div class="card-validation-message" style="display:none;"></div>'
    );

    const summary = document.createElement("div");
    summary.className = summaryClass;
    summary.style.display = "none";
    summary.innerHTML = `
        <div class="summary-text"></div>
        <div class="card-action-row">
            <button class="card-action-btn card-action-edit ${editButtonClass}">${editButtonText}</button>
            <button class="card-action-btn card-action-remove ${removeSelector.replace(".", "")}">${removeButtonText}</button>
        </div>
    `;

    card.appendChild(form);
    card.appendChild(summary);

    const inputs = Array.from(form.querySelectorAll(inputSelector));
    const saveBtn = form.querySelector(saveSelector);
    const editBtn = summary.querySelector(`.${editButtonClass}`);
    const removeBtns = card.querySelectorAll(removeSelector);
    const summaryText = summary.querySelector(".summary-text");
    const validationMessage = form.querySelector(".card-validation-message");

    function showValidationMessage(message) {
        if (!validationMessage) return;

        validationMessage.textContent = message || "";
        validationMessage.style.display = message ? "block" : "none";
    }

    function setSavedState(saved) {
        if (saved) {
            card.dataset.module = moduleId;
            return;
        }

        card.removeAttribute("data-module");
    }

    function collapse() {
        summaryText.innerHTML = buildSummary({ form, card, inputs });
        form.style.display = "none";
        summary.style.display = "block";
    }

    function expand() {
        form.style.display = "block";
        summary.style.display = "none";
        showValidationMessage("");
    }

    function setInputsDisabled(disabled) {
        inputs.forEach(input => {
            input.disabled = disabled;
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener("click", event => {
            event.preventDefault();
            const validationError =
                typeof validate === "function"
                    ? validate({ form, card, inputs })
                    : null;

            if (validationError) {
                showValidationMessage(validationError);
                return;
            }

            showValidationMessage("");
            setSavedState(true);
            setInputsDisabled(true);
            collapse();
        });
    }

    inputs.forEach(input => {
        input.addEventListener("input", () => showValidationMessage(""));
        input.addEventListener("change", () => showValidationMessage(""));
    });

    if (editBtn) {
        editBtn.addEventListener("click", () => {
            setInputsDisabled(false);
            expand();
        });
    }

    removeBtns.forEach(button => {
        button.addEventListener("click", () => {
            card.remove();
        });
    });

    return {
        card,
        form,
        summary,
        inputs,
        summaryText,
        showValidationMessage,
        collapse,
        expand,
        setCollapsed(collapsed) {
            if (collapsed) {
                setSavedState(true);
                setInputsDisabled(true);
                collapse();
                return;
            }

            setInputsDisabled(false);
            expand();
        }
    };
}
