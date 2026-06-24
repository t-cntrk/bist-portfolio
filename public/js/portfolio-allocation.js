/**
 * portfolio-allocation.js — "Varlık Dağılımı" (Asset Allocation) donut chart.
 *
 * Uses the Chart.js instance already loaded globally (CDN in index.html).
 * Stock and FX portfolios feed their per-asset current TRY values here via
 * setAllocationSegment(); the chart merges both sources, recomputes each asset's
 * share of the total and re-renders the donut + legend. When nothing is held it
 * shows a greyed-out empty circle with a "Varlık Bulunmuyor" message.
 */
import { escapeHtml } from './dom-helpers.js';

// Dark-mode friendly, vivid and mutually distinguishable palette.
const PALETTE = [
    '#3b82f6', // blue
    '#22c55e', // green
    '#8b5cf6', // purple
    '#06b6d4', // turquoise
    '#f59e0b', // amber
    '#ec4899', // pink
    '#14b8a6', // teal
    '#6366f1', // indigo
    '#ef4444', // red
    '#84cc16', // lime
];

let chartInstance = null;
const segments = { stock: [], fx: [] };

function formatTRY(value) {
    return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

/**
 * Register the per-asset values for a source ('stock' | 'fx').
 * @param {'stock'|'fx'} source
 * @param {{label:string,value:number}[]} items
 */
export function setAllocationSegment(source, items) {
    segments[source] = Array.isArray(items)
        ? items.filter(i => i && i.label && Number.isFinite(i.value) && i.value > 0)
        : [];
    renderAllocation();
}

export function renderAllocation() {
    const canvas   = document.getElementById('allocationChart');
    const emptyEl  = document.getElementById('allocationEmpty');
    const legendEl = document.getElementById('allocationLegend');
    if (!canvas || typeof Chart === 'undefined') return;

    const merged = [...segments.stock, ...segments.fx];
    const total  = merged.reduce((sum, i) => sum + i.value, 0);

    // ── Empty state ──────────────────────────────────────────────────────────
    if (!merged.length || total <= 0) {
        if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
        canvas.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'flex';
        if (legendEl) legendEl.innerHTML = '';
        return;
    }

    canvas.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';

    const labels = merged.map(i => i.label);
    const values = merged.map(i => i.value);
    const colors = merged.map((_, i) => PALETTE[i % PALETTE.length]);

    if (chartInstance) {
        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = values;
        chartInstance.data.datasets[0].backgroundColor = colors;
        chartInstance.update();
    } else {
        chartInstance = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderColor: 'rgba(15, 15, 35, 0.9)',
                    borderWidth: 2,
                    hoverOffset: 6,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '66%',
                animation: { duration: 400 },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(20, 22, 40, 0.95)',
                        borderColor: 'rgba(255, 255, 255, 0.12)',
                        borderWidth: 1,
                        titleColor: '#ffffff',
                        bodyColor: '#cbd5e1',
                        padding: 12,
                        cornerRadius: 10,
                        callbacks: {
                            label(ctx) {
                                const v = ctx.parsed;
                                const sum = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = sum > 0 ? (v / sum) * 100 : 0;
                                return ` ${formatTRY(v)}  (%${pct.toFixed(2)})`;
                            },
                        },
                    },
                },
            },
        });
    }

    if (legendEl) {
        legendEl.innerHTML = merged.map((i, idx) => {
            const pct = (i.value / total) * 100;
            const color = PALETTE[idx % PALETTE.length];
            return `<div class="allocation-legend-item">
                <span class="allocation-legend-dot" style="background:${color};"></span>
                <span class="allocation-legend-label" title="${escapeHtml(i.label)}">${escapeHtml(i.label)}</span>
                <span class="allocation-legend-pct">%${pct.toFixed(1)}</span>
            </div>`;
        }).join('');
    }
}

window.renderAllocation = renderAllocation;
