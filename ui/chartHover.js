export function attachTimelineHover({
    canvas,
    tooltip,
    padding,
    chartWidth,
    sampledResults,
    onCrosshair
}){

let hoverEvent = null;

canvas.onmousemove = e => {
    hoverEvent = e;
};

function processHover(){

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
        tooltip.style.opacity = 0;
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

    if(onCrosshair){
        onCrosshair(index);
    }

    let html = `<strong>Age ${r.age}</strong><br><br>`;

    Object.entries(r.breakdown || {}).forEach(([name,val])=>{
        if(val){
            html += `${name}: $${Math.round(val).toLocaleString()}<br>`;
        }
    });

    html += `<br>Total Income: $${Math.round(r.income).toLocaleString()}<br>`;
    html += `Expenses: $${Math.round(r.expenses).toLocaleString()}`;

    tooltip.innerHTML = html;
    tooltip.style.left = e.clientX + 15 + "px";
    tooltip.style.top = e.clientY + 15 + "px";
    tooltip.style.opacity = 1;

    requestAnimationFrame(processHover);
}

canvas.onmouseleave = () => {
    hoverEvent = null;
    tooltip.style.opacity = 0;
};

requestAnimationFrame(processHover);

}