// =========================================================
// incomeTimelineRenderer.js
// STABILIZED VERSION
// =========================================================

export function renderIncomeTimeline({
    canvasId,
    results,
    incomeColors = {},
    yScaleMultiplier = 1.15,
    showExpenseSeries = true,
    totalSeriesLabel = "Total Income",
    totalSeriesColor = "#1F4D3A",
    retirementAge = null,
    tooltipId = "tooltip",
    legendId = "timelineLegend"
}) {

    function totalPortfolio(result) {
        if (!result?.portfolios) return 0;

        return Object.values(result.portfolios)
            .reduce((sum, value) => sum + (value || 0), 0);
    }

    function findAssetDepletionAge(allResults) {
        let sawPositiveAssets = false;

        for (const result of allResults || []) {
            const portfolioTotal = totalPortfolio(result);

            if (portfolioTotal > 0) {
                sawPositiveAssets = true;
            }

            if (sawPositiveAssets && portfolioTotal <= 0) {
                return result.age;
            }
        }

        return null;
    }

    function drawVerticalMarker(ctx, {
        x,
        top,
        bottom,
        label,
        color
    }) {

        ctx.save();
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.setLineDash([8, 6]);
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.font = "12px Segoe UI";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(label, x, top - 6);
        ctx.restore();
    }

    if (!results || results.length < 2) return;

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const renderToken = (canvas.__chartRenderToken || 0) + 1;

    canvas.__chartRenderToken = renderToken;

    const tooltip = document.getElementById(tooltipId);
    const legendContainer = document.getElementById(legendId);

    // -----------------------------
    // Retina scaling
    // -----------------------------

    const dpr = window.devicePixelRatio || 1;

    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = displayWidth;
    const height = displayHeight;
    const isNarrowScreen = width <= 640;

    ctx.clearRect(0, 0, width, height);

    const padding = isNarrowScreen ? 48 : 90;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // -----------------------------
    // Sampling
    // -----------------------------

    const samplingSelect = document.getElementById("samplingInterval");
    const interval = samplingSelect
        ? parseInt(samplingSelect.value)
        : (isNarrowScreen ? 2 : 1);

    const sampledResults = results.filter((r, i) => i % interval === 0);

    if (sampledResults.length < 2) return;

    // -----------------------------
    // Collect active income names
    // -----------------------------

    const incomeNames = new Set();

    sampledResults.forEach(r => {

        if (!r.breakdown) return;

        Object.entries(r.breakdown).forEach(([name, val]) => {
            if (val !== 0) incomeNames.add(name);
        });

    });

    const names = Array.from(incomeNames);

    if (legendContainer) {
        const legendItems = [
            {
                label: totalSeriesLabel,
                color: totalSeriesColor,
                dashed: true
            },
            ...names.map(name => ({
                label: name,
                color: incomeColors[name] || "#3F7C85",
                dashed: false
            }))
        ];

        if (showExpenseSeries) {
            legendItems.splice(1, 0, {
                label: "Expenses",
                color: "#DB2B39",
                dashed: true
            });
        }

        legendContainer.innerHTML = "";

        legendItems.forEach(item => {
            const legendItem = document.createElement("div");
            legendItem.className = "timeline-legend-item";

            const swatch = document.createElement("span");
            swatch.className =
                `timeline-legend-swatch${item.dashed ? " is-dashed" : ""}`;
            swatch.style.setProperty("--legend-color", item.color);

            const label = document.createElement("span");
            label.textContent = item.label;

            legendItem.appendChild(swatch);
            legendItem.appendChild(label);
            legendContainer.appendChild(legendItem);
        });
    }

    // -----------------------------
    // Stable Y scale
    // -----------------------------

    let maxAnnual = 0;

    sampledResults.forEach(r => {

        maxAnnual = Math.max(maxAnnual, r.totalIncome || r.income || 0);
        if (showExpenseSeries) {
            maxAnnual = Math.max(maxAnnual, r.expenses || 0);
        }

        if (r.breakdown) {
            Object.values(r.breakdown).forEach(v => {
                maxAnnual = Math.max(maxAnnual, v || 0);
            });
        }

    });

    const yMax = Math.max(maxAnnual * yScaleMultiplier, 1);

    const scaleY = v => (v / yMax) * chartHeight;
    const scaleX = i => (i / (sampledResults.length - 1)) * chartWidth;
    const markerRetirementAge =
        Number.isFinite(Number(retirementAge))
            ? Number(retirementAge)
            : sampledResults[0]?.age ?? null;
    const assetDepletionAge = findAssetDepletionAge(results);

    // -----------------------------
    // Axes
    // -----------------------------

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#000";

    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // -----------------------------
    // Y grid + labels
    // -----------------------------

    const ticks = 5;
    const step = yMax / ticks;

    for (let i = 0; i <= ticks; i++) {

        const value = step * i;
        const y = height - padding - scaleY(value);

        ctx.strokeStyle = "#e5e5e5";
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();

        ctx.fillStyle = "#000";
        ctx.font = isNarrowScreen ? "11px Segoe UI" : "14px Segoe UI";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";

        ctx.fillText(
            "$" + Math.round(value).toLocaleString(),
            padding - 18,
            y
        );
    }

    // -----------------------------
    if (showExpenseSeries) {
        // EXPENSE LINE
        // -----------------------------

        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#DB2B39";
        ctx.setLineDash([10, 6]);

        sampledResults.forEach((r, i) => {

            const x = padding + scaleX(i);
            const y = height - padding - scaleY(r.expenses || 0);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);

        });

        ctx.stroke();
        ctx.setLineDash([]);
    }

    // -----------------------------
    // TOTAL INCOME LINE
    // -----------------------------

    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = totalSeriesColor;
    ctx.setLineDash([10, 6]);

    sampledResults.forEach((r, i) => {

        const x = padding + scaleX(i);
        const y = height - padding - scaleY(r.totalIncome || r.income || 0);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

    });

    ctx.stroke();
    ctx.setLineDash([]);

    // -----------------------------
    // INDIVIDUAL INCOME SOURCES
    // -----------------------------

    names.forEach(name => {

        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = incomeColors[name] || "#3F7C85";

        sampledResults.forEach((r, i) => {

            const value = r.breakdown?.[name] || 0;

            const x = padding + scaleX(i);
            const y = height - padding - scaleY(value);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);

        });

        ctx.stroke();

    });

    // -----------------------------
    // Age labels (limited)
    // -----------------------------

    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.font = isNarrowScreen ? "11px Segoe UI" : "14px Segoe UI";

    const targetLabels = isNarrowScreen ? 4 : 8;
    const labelStep = Math.ceil(sampledResults.length / targetLabels);

    sampledResults.forEach((r, i) => {

        if (i % labelStep !== 0 && i !== sampledResults.length - 1) return;

        const x = padding + scaleX(i);

        ctx.fillText(
            isNarrowScreen ? String(r.age) : "Age " + r.age,
            x,
            height - padding + (isNarrowScreen ? 16 : 24)
        );

    });

    const markerConfigs = [
        {
            age: markerRetirementAge,
            label: "Retirement",
            color: "#1F4D3A"
        },
        {
            age: assetDepletionAge,
            label: "Asset Depletion",
            color: "#DB2B39"
        }
    ].filter(marker => marker.age !== null);

    markerConfigs.forEach(marker => {
        const markerIndex = sampledResults
            .findIndex(result => result.age >= marker.age);

        if (markerIndex < 0) return;

        const markerX = padding + scaleX(markerIndex);

        drawVerticalMarker(ctx, {
            x: markerX,
            top: padding,
            bottom: height - padding,
            label: marker.label,
            color: marker.color
        });
    });

    // -----------------------------
    // Tooltip
    // -----------------------------

let hoverEvent = null;

canvas.onmousemove = e => {
    hoverEvent = e;
};

function processHover(){

    if (canvas.__chartRenderToken !== renderToken) {
        return;
    }

    if(!hoverEvent){
        requestAnimationFrame(processHover);
        return;
    }

    const e = hoverEvent;
    hoverEvent = null;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const relativeX = mouseX - padding;

    if (relativeX < 0 || relativeX > chartWidth) {
        if (tooltip) tooltip.style.opacity = 0;
        requestAnimationFrame(processHover);
        return;
    }

    const index = Math.round(
        (relativeX / chartWidth) * (sampledResults.length - 1)
    );

    const r = sampledResults[index];
    if (!r) {
        requestAnimationFrame(processHover);
        return;
    }
// -----------------------------
// Hover crosshair
// -----------------------------

// redraw chart
renderIncomeTimeline({
    canvasId,
    results,
    incomeColors,
    yScaleMultiplier,
    showExpenseSeries,
    totalSeriesLabel,
    totalSeriesColor,
    retirementAge: markerRetirementAge,
    tooltipId,
    legendId
});

const crossX = padding + scaleX(index);

ctx.save();

ctx.beginPath();
ctx.lineWidth = 1;
ctx.strokeStyle = "rgba(0,0,0,0.35)";
ctx.setLineDash([5,4]);

ctx.moveTo(crossX, padding);
ctx.lineTo(crossX, height - padding);

ctx.stroke();
ctx.restore();

    let html = `<strong>Age ${r.age}</strong><br><br>`;

    if (r.age === markerRetirementAge) {
        html += `Retirement marker<br>`;
    }

    if (assetDepletionAge !== null && r.age === assetDepletionAge) {
        html += `Asset depletion marker<br>`;
    }

    if (r.age === markerRetirementAge || r.age === assetDepletionAge) {
        html += `<br>`;
    }

    names.forEach(name => {
        const income = r.breakdown?.[name] || 0;
        html += `${name}: $${Math.round(income).toLocaleString()}<br>`;
    });

    html += `<br>${totalSeriesLabel}: $${Math.round(r.totalIncome || r.income || 0).toLocaleString()}`;

    if (showExpenseSeries) {
        html += `<br>Expenses: $${Math.round(r.expenses || 0).toLocaleString()}`;
    }

    if (tooltip) {
        tooltip.innerHTML = html;
        tooltip.style.left = e.clientX + 15 + "px";
        tooltip.style.top = e.clientY + 15 + "px";
        tooltip.style.opacity = 1;
    }

    requestAnimationFrame(processHover);
}
 canvas.onmouseleave = () => {
    hoverEvent = null;
    if (tooltip) tooltip.style.opacity = 0;
};
requestAnimationFrame(processHover);
}
