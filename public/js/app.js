/**
 * app.js — Application entry point.
 * Wires together all modules, sets up event delegation, and boots the app.
 */
import { initAuth } from './auth.js';
import { initPortfolio, showPortfolioModal, renderPortfolioTable, renderFxPortfolioTable, showChartModal, toggleChartFullscreen, deletePortfolioItem, addPortfolioItem, closeChartModal, fetchAllStocks, fetchStock, fetchPortfolio, fetchFxPortfolio, getStockName, renderRow, ChartButtonManager } from './portfolio.js';
import { initFx, showFxPortfolioModal, fetchCurrencyData, updateCurrencyDisplay } from './fx.js';
import { initUI } from './ui.js';
import { showErrorMessage, showSuccessMessage } from './notifications.js';
import { getApiUrl } from './api.js';
import { closeModal } from './dom-helpers.js';
import { sendErrorLog } from './helpers.js';
// Side-effect import: registers window.renderTransactions, called by the
// portfolio render flow to keep the transaction-history table in sync.
import './transactions.js';
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

// Expose init/render functions so auth.js can boot portfolio & FX after login
window.initPortfolio = initPortfolio;
window.initFx = initFx;
window.renderPortfolioTable = renderPortfolioTable;
window.renderFxPortfolioTable = renderFxPortfolioTable;
window.fetchCurrencyData = fetchCurrencyData;

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
        '.sell-portfolio-btn': (target) => {
            if (!window.showSellModal) return;
            window.showSellModal({
                id: target.getAttribute('data-id'),
                symbol: target.getAttribute('data-symbol') || '',
                name: target.getAttribute('data-name') || '',
                type: target.getAttribute('data-type') || 'stock',
                available: target.getAttribute('data-quantity') || '0',
                avgCost: target.getAttribute('data-price') || '0'
            });
        },
        '.delete-portfolio-btn': (target) => {
            const itemId = target.getAttribute('data-id');
            const symbol = target.getAttribute('data-symbol') || '';
            const itemType = target.getAttribute('data-itemtype') || 'portfolio item';
            if (itemId) {
                window.showDeleteConfirmationModal(itemId, symbol, itemType);
            }
        },
        '.chart-btn, .chart-icon': (target) => {
            const symbol = target.getAttribute('data-symbol');
            if (symbol) {
                const cleanSymbol = symbol.replace('.IS', '');
                functionRegistry.showChartModal(symbol, cleanSymbol, '1m');
            }
        },
        '.fx-retry-btn': () => {
            // Retry loading FX data from the currency-table error state.
            if (window.fetchCurrencyData) window.fetchCurrencyData();
        },
        '#closeChartBtn': () => functionRegistry.closeChartModal()
        // NOTE: #chartFullscreenBtn is intentionally NOT delegated here.
        // It is bound directly (onclick) in portfolio-chart.js/showChartModal.
        // Having both caused the fullscreen toggle to fire twice and cancel out.
    };

    document.addEventListener('click', (e) => {
        for (const [selector, handler] of Object.entries(eventHandlers)) {
            // closest() so a click on an inner icon (e.g. the ✕ <i> inside a
            // delete button) still resolves to the delegated control.
            const el = e.target.closest(selector);
            if (el) { handler(el); break; }
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

    // NOTE: #chartRange changes are handled by the select's own onchange
    // (set in showChartModal), which reloads only the chart data. Delegating
    // here previously re-ran showChartModal and loaded the chart twice per change.
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

        // fetchAllStocks() renders the stock table AND updates AppState.stocks itself,
        // so we only fetch FX separately here (avoids a duplicate /api/stocks request).
        const fxRes = await fetch(getApiUrl('/api/stocks/fx'), { credentials: 'include' });
        if (!fxRes.ok) {
            throw new Error(`HTTP error! fx: ${fxRes.status}`);
        }

        const fxData = await fxRes.json();
        const fxArray = Array.isArray(fxData) ? fxData : [];
        AppState.set('fx', fxArray);

        // Update the Döviz Kurları table DOM too (previously only the 15s FX
        // interval did this, so "Yenile" left the currency table stale).
        const fxKeyed = Object.fromEntries(fxArray.map(d => [d.symbol, d]));
        window.fxLatestPrices = fxKeyed;
        updateCurrencyDisplay(fxKeyed);

        await functionRegistry.fetchAllStocks();
        const stocksArray = AppState.get('stocks') || [];
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

// ─── Global "Yenile" handler ──────────────────────────────────────────────────
// Single entry point for the header refresh button: updates market/FX data AND
// the user's portfolio tables together, with a spinning-icon loading state.
async function refreshAll() {
    const btn = document.getElementById('globalRefreshBtn');
    if (btn) { btn.disabled = true; btn.classList.add('refreshing'); }
    try {
        await refreshData();
        if (sessionStorage.getItem('currentUser')) {
            await functionRegistry.renderPortfolioTable();
        }
    } finally {
        if (btn) { btn.disabled = false; btn.classList.remove('refreshing'); }
    }
}
window.refreshAll = refreshAll;

// ─── Single auto-refresh loop ─────────────────────────────────────────────────
let autoRefreshInterval = null;
function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(async () => {
        await refreshData();
        if (sessionStorage.getItem('currentUser')) {
            functionRegistry.renderPortfolioTable();
        }
    }, 60000);
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

        const globalRefreshBtn = document.getElementById('globalRefreshBtn');
        if (globalRefreshBtn) globalRefreshBtn.addEventListener('click', refreshAll);

        // Wire the language toggle button (was never connected)
        const langBtn = document.getElementById('langBtn');
        if (langBtn && window.toggleLanguage) {
            langBtn.addEventListener('click', () => window.toggleLanguage());
        }

        const storedUser = sessionStorage.getItem('currentUser');
        if (storedUser) {
            const loginOverlay = document.getElementById('loginOverlay');
            if (loginOverlay) loginOverlay.style.display = 'none';

            functionRegistry.initPortfolio();
            functionRegistry.initFx();
            functionRegistry.renderPortfolioTable();

            console.log('✅ Portföy sistemi başlatıldı ve veriler yüklendi');
        }

        // i18n + initial data load + sorting (single boot path)
        applyI18n();
        refreshData().then(() => {
            initSorting();
            if (window.refreshSorting) window.refreshSorting();
        });

        // Single master auto-refresh loop (replaces the previously overlapping
        // 15s FX / 30s portfolio / 60s data timers). refreshData() already
        // refreshes stocks, FX, ticker and the currency table together.
        startAutoRefresh();

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
