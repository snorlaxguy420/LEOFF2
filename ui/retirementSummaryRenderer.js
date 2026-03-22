// retirementSummaryRenderer.js
// Renders the retirement summary panel above the chart

export function renderRetirementSummary(results, firstDeficitYear) {

    const container = document.getElementById("retirementSummary");
    if (!container) return;

    if (!results || results.length === 0) {
        container.innerHTML = "";
        return;
    }

    const avgIncome =
        results.reduce((sum, r) => sum + r.income, 0) / results.length;

    const avgExpenses =
        results.reduce((sum, r) => sum + r.expenses, 0) / results.length;

    const avgSurplus = avgIncome - avgExpenses;

    container.innerHTML = `
        <div class="summary-grid">

            <div class="summary-card">
                <div class="summary-label">Projected Income</div>
                <div class="summary-value">
                    $${Math.round(avgIncome).toLocaleString()}
                </div>
            </div>

            <div class="summary-card">
                <div class="summary-label">Projected Expenses</div>
                <div class="summary-value">
                    $${Math.round(avgExpenses).toLocaleString()}
                </div>
            </div>

            <div class="summary-card">
                <div class="summary-label">Safety Margin</div>
                <div class="summary-value">
                    $${Math.round(avgSurplus).toLocaleString()}
                </div>
            </div>

            <div class="summary-card">
                <div class="summary-label">First Deficit Age</div>
                <div class="summary-value">
                    ${firstDeficitYear || "Never"}
                </div>
            </div>

        </div>
    `;
}