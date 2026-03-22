export function renderModuleInputs(containerId, modules) {

    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    const grid = document.createElement("div");
    grid.className = "module-grid";

    modules.forEach(module => {

        const card = document.createElement("div");
        card.className = "module-card";

        const title = document.createElement("h3");
        title.innerText = module.name;

        const summary = document.createElement("div");
        summary.className = "module-summary";

        // simple summary line
        summary.innerText = module.inputs
            .map(i => `${i.label}: ${i.default ?? "-"}`)
            .join(" | ");

        const editBtn = document.createElement("button");
        editBtn.className = "btn-edit";
        editBtn.innerText = "Edit";

        const editor = document.createElement("div");
        editor.className = "module-editor";

        module.inputs.forEach(input => {

            const label = document.createElement("label");
            label.innerText = input.label;

            const field = document.createElement("input");
            field.type = input.type || "number";
            field.id = `${module.id}_${input.id}`;
            field.value = input.default || "";

            label.appendChild(field);
            editor.appendChild(label);

        });

        const actions = document.createElement("div");
        actions.className = "module-actions";

        const saveBtn = document.createElement("button");
        saveBtn.className = "btn-edit";
        saveBtn.innerText = "Save";

        actions.appendChild(saveBtn);
        editor.appendChild(actions);

        editBtn.onclick = () => {

            editor.style.display =
                editor.style.display === "block"
                ? "none"
                : "block";

        };

        card.appendChild(title);
        card.appendChild(summary);
        card.appendChild(editBtn);
        card.appendChild(editor);

        grid.appendChild(card);

    });

    container.appendChild(grid);

}