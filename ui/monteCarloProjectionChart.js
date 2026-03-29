function formatAxisCurrency(value) {
    const absoluteValue = Math.abs(value || 0);

    if (absoluteValue >= 1000000) {
        return `${value < 0 ? "-" : ""}$${(absoluteValue / 1000000).toFixed(1)}M`;
    }

    if (absoluteValue >= 1000) {
        return `${value < 0 ? "-" : ""}$${Math.round(absoluteValue / 1000)}k`;
    }

    return `${value < 0 ? "-" : ""}$${Math.round(absoluteValue)}`;
}

function getValueBounds(series = []) {
    let min = Infinity;
    let max = -Infinity;

    series.forEach(entry => {
        (entry?.values || []).forEach(value => {
            if (!Number.isFinite(value)) {
                return;
            }

            min = Math.min(min, value);
            max = Math.max(max, value);
        });
    });

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return {
            min: 0,
            max: 1
        };
    }

    if (min === max) {
        const padding = Math.max(1, Math.abs(min) * 0.1);
        return {
            min: min - padding,
            max: max + padding
        };
    }

    const range = max - min;
    const padding = range * 0.12;

    return {
        min: min - padding,
        max: max + padding
    };
}

function drawSeries({
    ctx,
    ages,
    values,
    color,
    dash = [],
    padding,
    width,
    height,
    minValue,
    maxValue
}) {
    if (!Array.isArray(values) || values.length !== ages.length) {
        return;
    }

    const chartWidth = width - (padding.left + padding.right);
    const chartHeight = height - (padding.top + padding.bottom);
    const scaleX = index => {
        return padding.left + ((index / (ages.length - 1)) * chartWidth);
    };
    const scaleY = value => {
        return padding.top + (((maxValue - value) / (maxValue - minValue)) * chartHeight);
    };

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash(dash);

    values.forEach((value, index) => {
        const x = scaleX(index);
        const y = scaleY(value);

        if (index === 0) {
            ctx.moveTo(x, y);
            return;
        }

        ctx.lineTo(x, y);
    });

    ctx.stroke();
    ctx.setLineDash([]);

    const lastValue = values[values.length - 1];
    const lastX = scaleX(values.length - 1);
    const lastY = scaleY(lastValue);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

export function renderMonteCarloProjectionChart({
    canvasId,
    chart
}) {
    const canvas = document.getElementById(canvasId);

    if (!canvas) {
        return;
    }

    const ages = chart?.ages || [];
    const series = chart?.series || [];

    if (ages.length < 2 || !series.length) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth || canvas.width;
    const displayHeight = canvas.clientHeight || canvas.height;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    const padding = {
        top: 28,
        right: 24,
        bottom: 44,
        left: displayWidth <= 640 ? 58 : 82
    };
    const chartWidth = displayWidth - (padding.left + padding.right);
    const chartHeight = displayHeight - (padding.top + padding.bottom);
    const { min, max } = getValueBounds(series);
    const scaleX = index => {
        return padding.left + ((index / (ages.length - 1)) * chartWidth);
    };
    const scaleY = value => {
        return padding.top + (((max - value) / (max - min)) * chartHeight);
    };

    ctx.strokeStyle = "rgba(30, 47, 68, 0.12)";
    ctx.lineWidth = 1;

    for (let tick = 0; tick <= 4; tick += 1) {
        const value = min + (((max - min) / 4) * tick);
        const y = scaleY(value);

        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(displayWidth - padding.right, y);
        ctx.stroke();

        ctx.fillStyle = "rgba(30, 47, 68, 0.72)";
        ctx.font = displayWidth <= 640 ? "11px Segoe UI" : "12px Segoe UI";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(formatAxisCurrency(value), padding.left - 10, y);
    }

    if (min < 0 && max > 0) {
        const zeroY = scaleY(0);
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = "rgba(179, 58, 58, 0.25)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.moveTo(padding.left, zeroY);
        ctx.lineTo(displayWidth - padding.right, zeroY);
        ctx.stroke();
        ctx.restore();
    }

    ctx.beginPath();
    ctx.strokeStyle = "rgba(30, 47, 68, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, displayHeight - padding.bottom);
    ctx.lineTo(displayWidth - padding.right, displayHeight - padding.bottom);
    ctx.stroke();

    const targetLabels = displayWidth <= 640 ? 4 : 6;
    const labelStep = Math.max(1, Math.ceil(ages.length / targetLabels));

    ctx.fillStyle = "rgba(30, 47, 68, 0.78)";
    ctx.font = displayWidth <= 640 ? "11px Segoe UI" : "12px Segoe UI";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    ages.forEach((age, index) => {
        if (index % labelStep !== 0 && index !== ages.length - 1) {
            return;
        }

        ctx.fillText(`Age ${age}`, scaleX(index), displayHeight - padding.bottom + 12);
    });

    series.forEach(entry => {
        drawSeries({
            ctx,
            ages,
            values: entry?.values || [],
            color: entry?.color || "#1F4D3A",
            dash: entry?.dash || [],
            padding,
            width: displayWidth,
            height: displayHeight,
            minValue: min,
            maxValue: max
        });
    });
}
