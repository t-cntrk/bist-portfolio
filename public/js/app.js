/**
 * app.js — Application entry point.
 * Wires together all modules, sets up event delegation, and boots the app.
 */
import { initAuth } from '../auth.js';
import { initPortfolio, showPortfolioModal, renderPortfolioTable, renderFxPortfolioTable, showChartModal, toggleChartFullscreen, deletePortfolioItem, addPortfolioItem, closeChartModal, fetchAllStocks, fetchStock, fetchPortfolio, fetchFxPortfolio, getStockName, renderRow, ChartButtonManager } from '../portfolio.js';
import { initFx, showFxPortfolioModal, fetchCurrencyData } from '../fx.js';
import { initUI } from '../ui.js';
import { showErrorMessage, showSuccessMessage } from './notifications.js';
import { showRemoveConfirmationModal, closeModal } from './dom-helpers.js';
import { sendErrorLog } from './helpers.js';
import { AppState } from './state.js';
import { getCurrentLang, applyI18n } from './i18n.js';
import { initSorting } from './sorting.js';
import { updateTickerUI } from './ticker.js';
import './error-handler.js';

// ─── Function registry ────────────────────────────────────────────────────────
window.renderFxPortfolioTable = renderFxPortfolioTable;

const functionRegistry = {
    initPortfolio,
    initFx,
    showPortfolioModal,
    showFxPortfolioModal,
    renderPortfolioTable,
    renderFxPortfolioTable,
    showChartModal,
    toggleChartFullscreen,
    deletePortfolioItem,
    addPortfolioItem,
    closeChartModal,
    showRemoveConfirmationModal,
    fetchAllStocks,
    fetchStock,
    fetchPortfolio,
    fetchFxPortfolio,
    getStockName,
    renderRow,
    fetchCurrencyData
};

window.showErrorMessage = showErrorMessage;
window.showSuccessMessage = showSuccessMessage;
window.closeModal = closeModal;

// ─── Event delegation ─────────────────────────────────────────────────────────
function setupEventDelegation() {
    const eventHandlers = {
        '.add-portfolio-btn[data-symbol]': (target) => {
            const symbol = target.getAttribute('data-symbol');
            if (symbol) functionRegistry.showPortfolioModal(symbol);
        },
        '.currency-add-btn': (target) => {
            const fxName = target.getAttribute('data-fxname') || 'XAU/TRY';
            functionRegistry.showFxPortfolioModal(fxName);
        },
        '.delete-portfolio-btn': (target) => {
            const row = target.closest('.table-row');
            if (!row) return;
            const onclickAttr = target.getAttribute('onclick');
            const match = onclickAttr ? onclickAttr.match(/deletePortfolioItem\((\d+)\)/) : null;
            const itemId = match ? match[1] : null;
            if (itemId && confirm('Bu öğeyi silmek istediğinize emin misiniz?')) {
                functionRegistry.deletePortfolioItem(itemId);
            }
        },
        '.chart-btn, .chart-icon': (target) => {
            const symbol = target.getAttribute('data-symbol');
            if (symbol) {
                const cleanSymbol = symbol.replace('.IS', '');
                functionRegistry.showChartModal(symbol, cleanSymbol, '1m');
            }
        },
        '#closeChartBtn': () => functionRegistry.closeChartModal(),
        '#chartFullscreenBtn': () => functionRegistry.toggleChartFullscreen()
    };

    document.addEventListener('click', (e) => {
        for (const [selector, handler] of Object.entries(eventHandlers)) {
            if (e.target.matches(selector)) { handler(e.target); break; }
        }
    }, { passive: true });

    document.addEventListener('submit', (e) => {
        if (e.target.id === 'portfolioForm') {
            e.preventDefault();
            const form = e.target;
            const symbol = form.getAttribute('data-symbol');
            const quantity = form.querySelector('#quantity')?.value;
            const price = form.querySelector('#purchasePrice')?.value;
            if (symbol && quantity && price) {
                functionRegistry.addPortfolioItem(symbol, parseFloat(quantity), parseFloat(price), 'stock');
            }
        }
    }, { passive: false });

    document.addEventListener('change', (e) => {
        if (e.target.id === 'chartRange') {
            const modal = document.getElementById('chartModal');
            if (modal && modal.style.display !== 'none') {
                const symbolElement = document.getElementById('modalSymbol');
                if (symbolElement && symbolElement.textContent) {
                    const symbol = symbolElement.textContent + '.IS';
                    const range = e.target.value;
                    const apiRange = ['1w', '1m', '1y', '10y'].includes(range) ? range : '1m';
                    functionRegistry.showChartModal(symbol, symbolElement.textContent, apiRange);
                }
            }
        }
    }, { passive: true });
}

window.retryStock = window.retryStock || function() {};
window.showMessage = window.showMessage || function() {};
window.updateHeaderAvatar = window.updateHeaderAvatar || function() {};

// ─── UI helpers ───────────────────────────────────────────────────────────────
function showLoading(elementId, text = 'Yükleniyor...') {
    const el = document.getElementById(elementId);
    if (el) { el.innerHTML = `<span class="spinner"></span>${text}`; el.classList.add('loading'); }
}

function hideLoading(elementId, originalText) {
    const el = document.getElementById(elementId);
    if (el) { el.innerHTML = originalText; el.classList.remove('loading'); }
}

function updateStatusIndicator(status) {
    const statusElement = document.getElementById('statusValue');
    if (!statusElement) return;
    const lang = getCurrentLang();
    const statusText = lang === 'en'
        ? { online: 'Online', offline: 'Offline', loading: 'Loading' }
        : { online: 'Çevrimiçi', offline: 'Çevrimdışı', loading: 'Yükleniyor' };
    const indicator = document.createElement('span');
    indicator.className = `status-indicator status-${status}`;
    statusElement.innerHTML = '';
    statusElement.appendChild(indicator);
    statusElement.appendChild(document.createTextNode(statusText[status] || status));
}

// ─── Data refresh ─────────────────────────────────────────────────────────────
async function refreshData() {
    const btnText = document.getElementById('btnText');
    const originalText = btnText ? btnText.textContent : 'Yenile';

    try {
        if (btnText) showLoading('btnText', 'Yenileniyor...');
        console.log('🔄 Fetching stocks and FX data...');

        const [stocksRes, fxRes] = await Promise.all([
            fetch('/api/stocks'),
            fetch('/api/stocks/fx')
        ]);

        if (!stocksRes.ok || !fxRes.ok) {
            throw new Error(`HTTP error! stocks: ${stocksRes.status}, fx: ${fxRes.status}`);
        }

        const stocksData = await stocksRes.json();
        const fxData = await fxRes.json();

        const stocksArray = Array.isArray(stocksData) ? stocksData : [];
        const fxArray = Array.isArray(fxData) ? fxData : [];

        AppState.set('stocks', stocksArray);
        AppState.set('fx', fxArray);

        functionRegistry.fetchAllStocks();
        updateTickerUI(stocksArray, fxArray);

        if (window.refreshSorting) window.refreshSorting();

        showSuccessMessage('Veriler güncellendi!');
    } catch (error) {
        console.error('❌ Yenileme hatası:', error);
        showErrorMessage('Veriler alınamadı: ' + error.message);
    } finally {
        if (btnText) hideLoading('btnText', originalText);
    }
}

// ─── App initialization ───────────────────────────────────────────────────────
function initializeApp() {
    try {
        AppState.init();

        if (window._chartManager) window._chartManager.cleanup();

        ['chartModal', 'profileModal', 'registerModal', 'forgotPasswordModal'].forEach(id => {
            const modal = document.getElementById(id);
            if (modal) modal.style.display = 'none';
        });

        if (window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        const currentUser = localStorage.getItem('currentUser');
        if (currentUser === 'testuser' || currentUser === 'test') {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('authToken');
        }

        initUI();
        initAuth();
        setupEventDelegation();

        try {
            ChartButtonManager.init();
            console.log('ChartButtonManager initialized successfully');
        } catch (error) {
            console.warn('ChartButtonManager initialization failed:', error);
        }

        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) refreshBtn.addEventListener('click', refreshData);

        const storedUser = sessionStorage.getItem('currentUser');
        if (storedUser) {
            const loginOverlay = document.getElementById('loginOverlay');
            if (loginOverlay) loginOverlay.style.display = 'none';

            functionRegistry.initPortfolio();
            functionRegistry.initFx();
            functionRegistry.renderPortfolioTable();
            functionRegistry.renderFxPortfolioTable();

            console.log('✅ Portföy sistemi başlatıldı ve veriler yüklendi');

            setInterval(() => {
                if (sessionStorage.getItem('currentUser')) {
                    functionRegistry.renderPortfolioTable();
                    functionRegistry.renderFxPortfolioTable();
                }
            }, 30000);
        }

        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Application initialization error:', error);
        showErrorMessage('Uygulama başlatılırken hata oluştu: ' + error.message);
    }
}

function handleFullscreenChange() {
    if (!window._chartManager) return;
    setTimeout(() => {
        try { if (window._chartManager.isInitialized) window._chartManager.resize(); }
        catch (e) { console.warn('Chart update after fullscreen failed:', e); }
    }, 300);
}

function safeInitializeApp() {
    try {
        initializeApp();
    } catch (error) {
        console.error('Application initialization failed:', error);
        try { showErrorMessage('Uygulama başlatılırken hata oluştu. Lütfen sayfayı yenileyin.'); }
        catch (fe) {
            console.error('Fallback error handling failed:', fe);
            alert('Uygulama başlatılamadı. Lütfen sayfayı yenileyin.');
        }
        if (typeof sendErrorLog === 'function') sendErrorLog(error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInitializeApp);
} else {
    safeInitializeApp();
}

export { initializeApp, refreshData };

// ─── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    applyI18n();
    initSorting();
    refreshData();
    setInterval(refreshData, 60000);
});
