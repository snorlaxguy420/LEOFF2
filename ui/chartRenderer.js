// chartRenderer.js
// Responsible for rendering stacked income vs expense bar chart
// Includes hover tooltips and rounded top segment logic

let hoverRegions = [];

function totalPortfolio(result) {
    if (!result?.portfolios) return 0;

    return Object.values(result.portfolios)
        .reduce((sum, value) => sum + (value || 0), 0);
}

function findAssetDepletionAge(results) {
    let sawPositiveAssets = false;

    for (const result of results || []) {
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
    ctx.font = "12px 'Segoe UI', Tahoma, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(label, x, top - 6);
    ctx.restore();
}

/**
 * Draw a rectangle with optional rounded top corners
 */
function drawRoundedTopRect(ctx, x, y, width, height, radius = 6) {
    const r = Math.min(radius, width / 2, height);

    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height);
    ctx.closePath();
    ctx.fill();
}

/**
 * Main render function
 */
export function renderChart({
    canvasId,
    results,
    incomeColors,
    expenseColor = "#38220F",
    yScaleMultiplier = 1.25,
    showExpenseSeries = true,
    tooltipId = "tooltip"
}) {

    const canvas = document.getElementById(canvasId);
    if (!canvas || !Array.isArray(results) || results.length === 0) {
        const ctx = canvas?.getContext?.("2d");

        if (ctx) {
            ctx.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
        }

        return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        return;
    }

    const renderToken = (canvas.__chartRenderToken || 0) + 1;
    const tooltip = document.getElementById(tooltipId);

    canvas.__chartRenderToken = renderToken;

    // Retina / display scaling: draw in CSS pixel coordinates
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    canvas.width = Math.max(1, Math.floor(displayWidth * dpr));
    canvas.height = Math.max(1, Math.floor(displayHeight * dpr));

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = displayWidth;
    const height = displayHeight;
    const isNarrowScreen = width <= 640;

    ctx.clearRect(0, 0, width, height);
    hoverRegions = [];

    const padding = isNarrowScreen ? 48 : 90;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // ---------- SAMPLING ----------
    const samplingSelect = document.getElementById("samplingInterval");
    const interval = samplingSelect
        ? parseInt(samplingSelect.value)
        : (isNarrowScreen ? 8 : 5);
    const sampledResults = results.filter((r, i) => i % interval === 0);

    // ---------- SCALE ----------
    let maxMonthly = 0;

    sampledResults.forEach(r => {
        maxMonthly = Math.max(
            maxMonthly,
            (r.income || 0) / 12,
            showExpenseSeries ? ((r.expenses || 0) / 12) : 0
        );
    });

    const yMax = maxMonthly * yScaleMultiplier;

    if (!Number.isFinite(yMax) || yMax <= 0) {
        ctx.clearRect(0, 0, width, height);
        return;
    }

    function scaleY(value) {
        return (value / yMax) * chartHeight;
    }

    const retirementAge = sampledResults[0]?.age ?? null;
    const assetDepletionAge = findAssetDepletionAge(results);

    // ---------- AXES (DARKENED) ----------
    // Draw Y axis first; we'll draw the X axis after bars so it appears on top
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#000000"; // Darkened axis lines

    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.stroke();

    // ---------- Y GRID + LABELS ----------
    const tickCount = 5;
    const tickStep = yMax / tickCount;

    for (let i = 1; i <= tickCount; i++) {

        const value = tickStep * i;
        const y = height - padding - scaleY(value);

        ctx.strokeStyle = "#e5e5e5";
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();

        ctx.fillStyle = "#000000";
        ctx.font = isNarrowScreen
            ? "11px 'Segoe UI', Tahoma, sans-serif"
            : "15px 'Segoe UI', Tahoma, sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";

        ctx.fillText(
            `$${Math.round(value).toLocaleString()}`,
            padding - 18,
            y
        );
    }

    // ---------- BARS ----------
    const sampleCount = Math.max(sampledResults.length, 1);
    const groupSpacing = chartWidth / sampleCount;
    const maxUsableGroupWidth =
        Math.max(18, groupSpacing - (isNarrowScreen ? 8 : 12));
    const preferredGroupWidth =
        Math.min(
            isNarrowScreen ? 44 : 72,
            groupSpacing * (isNarrowScreen ? 0.82 : 0.74)
        );
    const totalGroupWidth =
        Math.max(18, Math.min(preferredGroupWidth, maxUsableGroupWidth));
    const barGap =
        Math.max(3, Math.min(8, totalGroupWidth * 0.14));
    const barWidth =
        Math.max(6, (totalGroupWidth - barGap) / 2);

    sampledResults.forEach((r, index) => {

        const centerX = padding + index * groupSpacing + groupSpacing / 2;
        const leftX = centerX - totalGroupWidth / 2;

        // ============================
        // EXPENSE BAR (rounded top)
        // ============================

        if (showExpenseSeries) {
            const expenseHeight = scaleY((r.expenses || 0) / 12);
            const expenseX = leftX + barWidth + barGap;
            const expenseY = height - padding - expenseHeight;

            ctx.fillStyle = expenseColor;

            if (expenseHeight > 0) {
                drawRoundedTopRect(
                    ctx,
                    expenseX,
                    expenseY,
                    barWidth,
                    expenseHeight,
                    6
                );
            }

            hoverRegions.push({
                x: expenseX,
                y: expenseY,
                w: barWidth,
                h: expenseHeight,
                text: `<strong>Age ${r.age}</strong><br>Expenses: $${Math.round((r.expenses || 0) / 12).toLocaleString()}`
            });
        }

        // ============================
        // INCOME STACK
        // ============================

        const breakdown = r.breakdown || {};
        const segments = Object.entries(breakdown)
            .filter(([_, amount]) => amount > 0);

        let runningHeight = 0;

        segments.forEach(([name, amount], segIndex) => {

            const monthly = amount / 12;
            const segmentHeight = scaleY(monthly);

            const x = leftX;
            const y =
                height -
                padding -
                runningHeight -
                segmentHeight;

            ctx.fillStyle = incomeColors[name] || "#7DCD85";

            const isTopSegment = segIndex === segments.length - 1;

            if (isTopSegment) {
                drawRoundedTopRect(
                    ctx,
                    x,
                    y,
                    barWidth,
                    segmentHeight,
                    6
                );
            } else {
                ctx.fillRect(x, y, barWidth, segmentHeight);
            }

            hoverRegions.push({
                x,
                y,
                w: barWidth,
                h: segmentHeight,
                text: `<strong>Age ${r.age}</strong><br>${name}: $${Math.round(monthly).toLocaleString()}`
            });

            runningHeight += segmentHeight;
        });

        // ---------- X LABEL (14px, no bold) ----------
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.font = isNarrowScreen
            ? "11px 'Segoe UI', Tahoma, sans-serif"
            : "15px 'Segoe UI', Tahoma, sans-serif";

        ctx.fillText(
            isNarrowScreen ? `${r.age}` : `Age ${r.age}`,
            centerX,
            height - padding + (isNarrowScreen ? 16 : 24)
        );
    });

    const markerConfigs = [
        {
            age: retirementAge,
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

        const markerX =
            padding + markerIndex * groupSpacing + groupSpacing / 2;

        drawVerticalMarker(ctx, {
            x: markerX,
            top: padding,
            bottom: height - padding,
            label: marker.label,
            color: marker.color
        });
    });

    // ---------- X AXIS ON TOP ----------
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#000000";
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // -----------------------------
    // Tooltip (line-chart style)
    // -----------------------------

let hoverEvent = null;

canvas.onmousemove = e => {
    hoverEvent = e;
};

// collect income names for tooltip display
const incomeNames = new Set();
sampledResults.forEach(r => {
    if (!r.breakdown) return;
    Object.entries(r.breakdown).forEach(([name, val]) => {
        if (val !== 0) incomeNames.add(name);
    });
});
const names = Array.from(incomeNames);

function processHover() {

    if (canvas.__chartRenderToken !== renderToken) {
        return;
    }

    if (!hoverEvent) {
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

    const rawIndex =
        Math.round((relativeX - groupSpacing / 2) / groupSpacing);
    const index =
        Math.max(0, Math.min(sampledResults.length - 1, rawIndex));
    const r = sampledResults[index];
    if (!r) {
        requestAnimationFrame(processHover);
        return;
    }

    // redraw chart so crosshair clears previous state
    renderChart({
        canvasId,
        results,
        incomeColors,
        expenseColor,
        yScaleMultiplier,
        showExpenseSeries,
        tooltipId
    });

    // draw hover crosshair
    const crossX = padding + index * groupSpacing + groupSpacing / 2;

    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.setLineDash([5, 4]);
    ctx.moveTo(crossX, padding);
    ctx.lineTo(crossX, height - padding);
    ctx.stroke();
    ctx.restore();

    let html = `<strong>Age ${r.age}</strong><br><br>`;

    if (r.age === retirementAge) {
        html += `Retirement marker<br>`;
    }

    if (assetDepletionAge !== null && r.age === assetDepletionAge) {
        html += `Asset depletion marker<br>`;
    }

    if (r.age === retirementAge || r.age === assetDepletionAge) {
        html += `<br>`;
    }

    names.forEach(name => {
        const income = r.breakdown?.[name] || 0;
        html += `${name}: $${Math.round(income).toLocaleString()}<br>`;
    });

    html += `<br>Total Income: $${Math.round(r.totalIncome || r.income).toLocaleString()}`;

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
