// portfolio-chart.js – chart modal, ChartManager, and chart-related UI
import { createApiRequest, handleApiResponse } from './js/api.js';
import { showErrorMessage } from './js/notifications.js';

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function loadChart(symbol, cleanSymbol, range = '1m') {
    try {
        const chartContainer = document.getElementById('stockChart');
        if (!chartContainer) throw new Error('Grafik konteyneri bulunamadı');

        chartContainer.textContent = '';
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chart-loading';
        loadingDiv.textContent = 'Grafik hazırlanıyor...';
        chartContainer.appendChild(loadingDiv);

        const response = await createApiRequest(`/api/stocks/${symbol}/chart?range=${range}`);
        const data = await handleApiResponse(response);
        const prices = data.prices || [];

        if (prices.length < 2) {
            throw new Error('Yeterli veri yok');
        }

        renderChart(chartContainer, prices, cleanSymbol);
    } catch (error) {
        console.error('Grafik hatası:', error);
        const errorContainer = document.getElementById('chartErrorMsg') || document.getElementById('stockChart');
        if (errorContainer) {
            errorContainer.textContent = '';
            const errorDiv = document.createElement('div');
            errorDiv.className = 'chart-error';
            const errorP = document.createElement('p');
            errorP.textContent = 'Grafik yüklenemedi';
            errorDiv.appendChild(errorP);
            const errorSmall = document.createElement('small');
            errorSmall.textContent = escapeHtml(error.message);
            errorDiv.appendChild(errorSmall);
            const reloadBtn = document.createElement('button');
            reloadBtn.textContent = 'Yenile';
            reloadBtn.style.cssText = 'margin-top: 10px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;';
            reloadBtn.onclick = () => window.location.reload();
            errorDiv.appendChild(reloadBtn);
            errorContainer.appendChild(errorDiv);
        }
    }
}

class ChartManager {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.chart = null;
        this.isInitialized = false;
        this.eventListeners = new Map();
        this.lastData = null;
        this.resizeHandler = null;
        this.fullscreenHandler = null;
    }

    static getInstance(canvasId) {
        if (!this._instance) {
            this._instance = new ChartManager(canvasId);
        }
        return this._instance;
    }

    static cleanup() {
        if (this._instance) {
            this._instance.cleanup();
            this._instance = null;
        }
    }

    init(data) {
        console.log('ChartManager: Initializing chart...');
        this.destroy();

        const canvas = document.getElementById(this.canvasId);
        if (!canvas) {
            console.warn('ChartManager: Canvas element not found');
            return false;
        }

        try {
            const processedData = this.processChartData(data);
            if (!processedData) {
                console.warn('ChartManager: Invalid data provided');
                return false;
            }

            const chartConfig = {
                type: 'line',
                data: {
                    labels: processedData.labels,
                    datasets: [{
                        label: (window.t ? `${data.symbol} ${window.getCurrentLang && window.getCurrentLang()==='en' ? 'Price' : 'Fiyat'} (₺)` : `${data.symbol} Fiyat (₺)`),
                        data: processedData.data,
                        borderColor: '#22c55e',
                        backgroundColor: (context) => {
                            const chart = context.chart;
                            const {ctx, chartArea} = chart;
                            if (!chartArea) return null;
                            const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                            gradient.addColorStop(0, 'rgba(34, 197, 94, 0.1)');
                            gradient.addColorStop(0.5, 'rgba(34, 197, 94, 0.05)');
                            gradient.addColorStop(1, 'rgba(34, 197, 94, 0.2)');
                            return gradient;
                        },
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#22c55e',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointHoverBackgroundColor: '#ffffff',
                        pointHoverBorderColor: '#22c55e',
                        pointHoverBorderWidth: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 1000, easing: 'easeInOutQuart' },
                    interaction: { intersect: false, mode: 'index' },
                    plugins: {
                        legend: {
                            display: true,
                            labels: {
                                color: '#ffffff',
                                font: { size: 13, weight: '600' },
                                usePointStyle: true,
                                pointStyle: 'circle'
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(15, 15, 35, 0.98)',
                            titleColor: '#ffffff',
                            bodyColor: '#e5e7eb',
                            borderColor: 'rgba(34, 197, 94, 0.4)',
                            borderWidth: 1,
                            cornerRadius: 12,
                            displayColors: false,
                            titleFont: { size: 14, weight: '600' },
                            bodyFont: { size: 13 },
                            padding: 12,
                            callbacks: {
                                title: (context) => `${data.symbol} - ${context[0].label}`,
                                label: (ctx) => (window.getCurrentLang && window.getCurrentLang()==='en' ? `Price: ${ctx.parsed.y.toFixed(2)} ₺` : `Fiyat: ${ctx.parsed.y.toFixed(2)} ₺`)
                            },
                            position: 'nearest',
                            mode: 'index',
                            intersect: false
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255, 255, 255, 0.08)', drawBorder: false },
                            ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45, font: { size: 11, weight: '500' }, padding: 8 },
                            border: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        y: {
                            grid: { color: 'rgba(255, 255, 255, 0.08)', drawBorder: false },
                            ticks: { color: '#94a3b8', callback: (value) => `${value.toFixed(0)} ₺`, font: { size: 11, weight: '500' }, padding: 8 },
                            border: { color: 'rgba(255, 255, 255, 0.1)' }
                        }
                    }
                }
            };

            this.chart = new Chart(canvas, chartConfig);
            this.isInitialized = true;
            this.lastData = data;
            this.setupEventListeners();
            return true;
        } catch (error) {
            console.error('ChartManager: Chart init failed:', error);
            return false;
        }
    }

    setupEventListeners() {
        this.removeEventListeners();
        this.resizeHandler = this.handleResize.bind(this);
        this.fullscreenHandler = this.handleFullscreenChange.bind(this);
        window.addEventListener('resize', this.resizeHandler);
        document.addEventListener('fullscreenchange', this.fullscreenHandler);
    }

    handleResize() {
        if (this.isInitialized && this.chart) {
            setTimeout(() => {
                try {
                    this.chart.resize();
                    this.chart.update();
                } catch (error) {
                    console.warn('Chart resize failed:', error);
                }
            }, 100);
        }
    }

    handleFullscreenChange() {
        if (this.isInitialized && this.chart) {
            setTimeout(() => {
                try {
                    this.chart.resize();
                    this.chart.update();
                } catch (error) {
                    console.warn('Chart fullscreen update failed:', error);
                }
            }, 300);
        }
    }

    processChartData(data) {
        try {
            const prices = data.prices || [];
            if (prices.length < 2) return null;

            const labels = prices.map(p => {
                const date = new Date(p.date || p.timestamp * 1000);
                const locale = (typeof window !== 'undefined' && window.getCurrentLang && window.getCurrentLang()==='en') ? 'en-US' : 'tr-TR';
                return date.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
            });

            const chartData = prices.map(p => {
                const value = p.close || p.price || 0;
                return typeof value === 'number' ? value : parseFloat(value) || 0;
            });

            const validData = chartData.filter(v => !isNaN(v) && v !== null && v !== undefined);
            const validLabels = labels.filter(l => l && l !== 'Invalid Date');
            if (validData.length < 2) return null;
            return { labels: validLabels, data: validData };
        } catch (error) {
            console.error('ChartManager: Error processing chart data:', error);
            return null;
        }
    }

    toggleFullscreen() {
        if (!this.isInitialized || !this.chart) return false;
        const canvas = this.chart.canvas;
        if (!canvas) return false;
        try {
            if (!document.fullscreenElement) {
                canvas.requestFullscreen().catch(e => console.warn('ChartManager: Fullscreen request failed:', e));
            } else {
                document.exitFullscreen();
            }
            return true;
        } catch (error) {
            console.error('ChartManager: Fullscreen toggle failed:', error);
            return false;
        }
    }

    resize() {
        if (!this.isInitialized || !this.chart) return false;
        try {
            this.chart.resize();
            this.chart.update();
            return true;
        } catch (error) {
            console.warn('ChartManager: Chart resize failed:', error);
            return false;
        }
    }

    destroy() {
        if (this.chart) {
            try {
                this.chart.destroy();
            } catch (e) {
                console.warn('ChartManager: Chart destroy error:', e);
            }
            this.chart = null;
        }
        this.isInitialized = false;
        this.lastData = null;
    }

    removeEventListeners() {
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }
        if (this.fullscreenHandler) {
            document.removeEventListener('fullscreenchange', this.fullscreenHandler);
            this.fullscreenHandler = null;
        }
        this.eventListeners.forEach((callback, type) => {
            document.removeEventListener(type, callback);
        });
        this.eventListeners.clear();
    }

    cleanup() {
        this.removeEventListeners();
        this.destroy();
    }
}

let chartManager = null;

function renderChart(container, prices, symbol) {
    if (!container || !prices || !Array.isArray(prices)) {
        console.error('Invalid parameters for renderChart:', { container, prices, symbol });
        return;
    }
    if (prices.length < 2) {
        container.textContent = '';
        const noDataDiv = document.createElement('div');
        noDataDiv.style.cssText = 'color:#b0b3c6;text-align:center;padding:40px;';
        noDataDiv.textContent = 'Yeterli veri yok';
        container.appendChild(noDataDiv);
        return;
    }
    if (!chartManager) {
        chartManager = ChartManager.getInstance('stockChart');
    }
    const success = chartManager.init({ prices, symbol });
    if (!success) {
        container.textContent = '';
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'color:#ef4444;text-align:center;padding:40px;';
        errorDiv.textContent = 'Grafik oluşturulamadı';
        container.appendChild(errorDiv);
        return;
    }
    setTimeout(() => {
        if (chartManager && chartManager.isInitialized) {
            const fullscreenBtn = document.getElementById('chartFullscreenBtn');
            if (fullscreenBtn) {
                fullscreenBtn.disabled = false;
                fullscreenBtn.style.opacity = '1';
                fullscreenBtn.style.cursor = 'pointer';
                fullscreenBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleChartFullscreen();
                };
                fullscreenBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleChartFullscreen();
                }, { once: false });
            }
        }
    }, 800);
}

export async function showChartModal(symbol, cleanSymbol, range = '1m') {
    try {
        const modal = document.getElementById('chartModal');
        const symbolElement = document.getElementById('modalSymbol');
        const rangeSelect = document.getElementById('chartRange');
        const errorMsg = document.getElementById('chartErrorMsg');

        if (!modal || !symbolElement) {
            console.error('Chart modal elements not found');
            return;
        }
        if (errorMsg) errorMsg.style.display = 'none';

        symbolElement.textContent = cleanSymbol;
        if (rangeSelect) rangeSelect.value = range;

        modal.style.display = 'flex';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        await loadChart(symbol, cleanSymbol, range);

        const closeBtn = document.getElementById('closeChartBtn');
        const fullscreenBtn = document.getElementById('chartFullscreenBtn');

        if (closeBtn) {
            closeBtn.replaceWith(closeBtn.cloneNode(true));
            document.getElementById('closeChartBtn').onclick = closeChartModal;
        }
        if (fullscreenBtn) {
            fullscreenBtn.replaceWith(fullscreenBtn.cloneNode(true));
            const newFullscreenBtn = document.getElementById('chartFullscreenBtn');
            if (newFullscreenBtn) {
                newFullscreenBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleChartFullscreen();
                };
                newFullscreenBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleChartFullscreen();
                }, { once: false });
                newFullscreenBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleChartFullscreen();
                }, { once: false });
            }
        }
        if (rangeSelect) {
            rangeSelect.replaceWith(rangeSelect.cloneNode(true));
            const newRangeSelect = document.getElementById('chartRange');
            newRangeSelect.onchange = async (e) => {
                await loadChart(symbol, cleanSymbol, e.target.value);
            };
        }
        modal.onclick = (e) => {
            if (e.target === modal) closeChartModal();
        };
    } catch (error) {
        console.error('Chart modal error:', error);
        showErrorMessage('Grafik yüklenirken hata oluştu');
    }
}

export function closeChartModal() {
    const modal = document.getElementById('chartModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
        document.body.style.overflow = '';
        modal.classList.remove('fullscreen');
        if (chartManager) {
            chartManager.cleanup();
            chartManager = null;
        }
        ChartManager.cleanup();
        const canvas = document.getElementById('stockChart');
        if (canvas && typeof Chart !== 'undefined') {
            const existingChart = Chart.getChart(canvas);
            if (existingChart) {
                try {
                    existingChart.destroy();
                } catch (error) {
                    console.warn('Error destroying existing chart:', error);
                }
            }
        }
    }
}

export function toggleChartFullscreen() {
    try {
        const modal = document.getElementById('chartModal');
        if (!modal) return;
        if (!chartManager || !chartManager.isInitialized) {
            setTimeout(() => {
                if (chartManager && chartManager.isInitialized) {
                    toggleChartFullscreen();
                } else {
                    setTimeout(() => {
                        if (chartManager && chartManager.isInitialized) toggleChartFullscreen();
                    }, 500);
                }
            }, 300);
            return;
        }
        if (modal.classList.contains('fullscreen')) {
            modal.classList.remove('fullscreen');
            document.body.style.overflow = '';
            if (chartManager) {
                setTimeout(() => {
                    try { chartManager.resize(); } catch (err) { console.warn(err); }
                }, 400);
            }
        } else {
            modal.classList.add('fullscreen');
            document.body.style.overflow = 'hidden';
            if (chartManager) {
                setTimeout(() => {
                    try { chartManager.resize(); } catch (err) { console.warn(err); }
                }, 200);
            }
        }
    } catch (error) {
        const modal = document.getElementById('chartModal');
        if (modal) {
            if (modal.classList.contains('fullscreen')) {
                modal.classList.remove('fullscreen');
                document.body.style.overflow = '';
            } else {
                modal.classList.add('fullscreen');
                document.body.style.overflow = 'hidden';
            }
        }
    }
}

export const ChartButtonManager = {
    initialized: false,
    observer: null,
    clickCount: 0,

    init() {
        if (this.initialized) return;
        document.querySelectorAll('.chart-btn, .chart-icon, [data-chart-symbol]').forEach(btn => {
            btn.removeEventListener('click', this.handleChartClick);
            btn.removeEventListener('touchstart', this.handleChartClick);
        });
        document.addEventListener('click', (e) => {
            const chartBtn = e.target.closest('.chart-btn, .chart-icon, [data-chart-symbol]');
            if (chartBtn) this.handleChartClick(e, chartBtn);
        }, true);
        document.addEventListener('touchstart', (e) => {
            const chartBtn = e.target.closest('.chart-btn, .chart-icon, [data-chart-symbol]');
            if (chartBtn) this.handleChartClick(e, chartBtn);
        }, true);
        this.observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        node.querySelectorAll?.('.chart-btn, .chart-icon, [data-chart-symbol]') || [];
                    }
                });
            });
        });
        this.observer.observe(document.body, { childList: true, subtree: true });
        this.initialized = true;
    },

    handleChartClick(e, button) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (button.disabled || button.classList.contains('disabled')) return;
        if (button.dataset.lastClick && Date.now() - parseInt(button.dataset.lastClick) < 500) return;
        button.dataset.lastClick = Date.now().toString();

        const symbol = button.dataset.symbol || button.dataset.chartSymbol || button.getAttribute('data-symbol');
        if (!symbol) {
            console.warn('ChartButtonManager: Button missing symbol data:', button);
            return;
        }
        button.classList.add('chart-btn-loading');
        const originalContent = button.textContent;
        try {
            showChartModal(symbol, symbol.replace('.IS', ''), '1m');
        } catch (error) {
            console.error('ChartButtonManager: Chart open failed:', error);
            showErrorMessage('Grafik açılırken hata oluştu');
        } finally {
            setTimeout(() => {
                button.classList.remove('chart-btn-loading');
                button.textContent = originalContent;
            }, 300);
        }
    },

    cleanup() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.initialized = false;
    }
};

export function testChartFunctionality() {
    const modal = document.getElementById('chartModal');
    const canvas = document.getElementById('stockChart');
    console.log('Chart modal found:', !!modal, 'Chart canvas found:', !!canvas, 'Chart.js:', typeof Chart !== 'undefined');
    if (canvas && typeof Chart !== 'undefined') {
        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();
    }
    createApiRequest('/api/stocks/DOAS.IS/chart?range=1m')
        .then(response => handleApiResponse(response))
        .then(data => console.log('API chart data:', data))
        .catch(error => console.error('API test failed:', error));
    if (canvas) {
        for (let i = 0; i < 3; i++) {
            const testData = [
                { date: Date.now() - 86400000, close: 100 + i * 10 },
                { date: Date.now(), close: 110 + i * 10 }
            ];
            renderChart(canvas.parentElement, testData, 'TEST');
            const chartInstance = Chart.getChart(canvas);
            if (chartInstance) console.log('Chart created:', i + 1);
        }
    }
    if (modal) modal.style.display = 'flex';
}

export function testChartWithData() {
    const testData = [
        { date: Date.now() - 86400000, close: 185 },
        { date: Date.now(), close: 186 }
    ];
    const container = document.getElementById('stockChart');
    if (container && typeof Chart !== 'undefined') {
        for (let i = 0; i < 5; i++) {
            const canvas = document.getElementById('stockChart');
            renderChart(container, testData, 'TEST');
            const newChart = Chart.getChart(canvas);
            if (newChart) console.log('Chart creation', i + 1, 'ok');
        }
    }
}

if (typeof window !== 'undefined') {
    window.testChartFunctionality = testChartFunctionality;
    window.testChartWithData = testChartWithData;
}
