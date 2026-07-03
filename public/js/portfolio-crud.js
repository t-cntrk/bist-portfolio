/**
 * portfolio-crud.js — Portfolio CRUD operations, modals, and FX data helpers.
 *
 * Circular-dependency note: deletePortfolioItem and showPortfolioModal both
 * call renderPortfolioTable from portfolio-render.js. ES-module live bindings
 * ensure that by the time these functions are *called* (after DOMContentLoaded),
 * portfolio-render.js is fully initialized. This is safe.
 */
import { createApiRequest, handleApiResponse } from './api.js';
import { showErrorMessage, showSuccessMessage } from './notifications.js';
import { createModal, closeModal, escapeHtml } from './dom-helpers.js';
import { validatePortfolioData } from './validation.js';
import { getStockName, fetchAllStocks } from './stocks.js';
import { showChartModal, toggleChartFullscreen } from './portfolio-chart.js';
import { formatTRY } from './formatters.js';
// Circular dep (safe): renderPortfolioTable is only called inside function bodies.
import { renderPortfolioTable } from './portfolio-render.js';

// Small helper: translate with a fallback so the module works before i18n loads.
const tr = (key, fallback) => (window.t ? window.t(key) : fallback);

// ─── Portfolio data fetching ───────────────────────────────────────────────────
export async function fetchPortfolio() {
    try {
        const response  = await createApiRequest('/api/portfolio');
        const portfolio = await handleApiResponse(response);
        const rows = Array.isArray(portfolio) ? portfolio : [];
        return rows.filter(r => r.type !== 'fx');
    } catch (error) {
        console.error('Error fetching portfolio:', error);
        showErrorMessage('Portföy verileri yüklenirken hata oluştu');
        return [];
    }
}

export async function fetchFxPortfolio() {
    try {
        const response  = await createApiRequest('/api/portfolio');
        const portfolio = await handleApiResponse(response);
        const rows = Array.isArray(portfolio) ? portfolio : [];
        return rows.filter(r => r.type === 'fx');
    } catch (error) {
        console.error('Error fetching FX portfolio:', error);
        showErrorMessage('Döviz portföyü yüklenirken hata oluştu');
        return [];
    }
}

// ─── Add / Delete ─────────────────────────────────────────────────────────────
export async function addPortfolioItem(symbol, quantity, purchase, type = 'stock') {
    try {
        const requestBody = { symbol, quantity, purchase, type };
        console.log('Sending portfolio request:', requestBody);

        const response = await createApiRequest('/api/portfolio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Server response error:', errorData);
            throw new Error(errorData.message || errorData.error || 'Portföye ekleme başarısız');
        }

        showSuccessMessage(window.t ? window.t('msg.addSuccess') : 'Portföye başarıyla eklendi');
        return true;
    } catch (error) {
        console.error('Error adding portfolio item:', error);
        showErrorMessage((window.t ? window.t('msg.addError') : 'Portföye ekleme hatası: ') + error.message);
        return false;
    }
}

// Sell part or all of an existing position. Returns the server result
// ({ sold, remaining, closed, realized_pl, ... }) on success, or null on failure.
export async function sellPortfolioItem(symbol, quantity, price, type = 'stock') {
    try {
        const response = await createApiRequest('/api/portfolio/sell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol, quantity, price, type })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.message || data.error || tr('msg.sellError', 'Satış başarısız'));
        }

        showSuccessMessage(tr('msg.sellSuccess', 'Satış başarıyla gerçekleşti'));
        return data;
    } catch (error) {
        console.error('Error selling portfolio item:', error);
        showErrorMessage(tr('msg.sellError', 'Satış hatası: ') + error.message);
        return null;
    }
}

export async function deletePortfolioItem(id) {
    try {
        const response  = await createApiRequest(`/api/portfolio/${id}`, { method: 'DELETE' });
        const errorData = await response.json();
        if (!response.ok) {
            throw new Error(errorData.message || (window.t ? 'Delete failed' : 'Silme işlemi başarısız'));
        }
        showSuccessMessage(window.t ? window.t('msg.delSuccess') : 'Portföy öğesi silindi');
        // The deleted item may be a stock OR an FX asset; refresh both tables in
        // parallel so the row disappears and totals update immediately.
        await renderPortfolioTable();
        return true;
    } catch (error) {
        console.error('Error deleting portfolio item:', error);
        showErrorMessage((window.t ? window.t('msg.delError') : 'Silme hatası: ') + error.message);
        return false;
    }
}

// ─── Delete confirmation modal ────────────────────────────────────────────────
export function showDeleteConfirmationModal(id, itemName, itemType = 'portfolio item') {
    const modalContent = `
        <div style="background:rgba(255,255,255,0.07);backdrop-filter:blur(20px);border-radius:20px;border:1px solid rgba(255,255,255,0.13);box-shadow:0 25px 45px rgba(0,0,0,0.25);padding:38px 32px 24px 32px;min-width:320px;max-width:95vw;position:relative;display:flex;flex-direction:column;align-items:center;">
            <div style='position:absolute;top:12px;right:12px;display:flex;gap:4px;z-index:1100;'>
                <button class="close-btn" onclick="closeModal('deleteConfirmationModal')" style="background:transparent;border:none;box-shadow:none;padding:0;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
                    <span style="font-size:1.1em;color:#e57373;">&#10005;</span>
                </button>
            </div>
            <h3 style="margin-top:0;margin-bottom:22px;text-align:center;font-size:1.35em;font-weight:700;color:#fff;">
                ${window.t ? window.t('modal.deleteTitle') : 'Silme Onayı'}
            </h3>
            <p style="color:rgba(255,255,255,0.8);margin-bottom:28px;text-align:center;font-size:1.08em;line-height:1.5;">
                ${window.t
                    ? window.t('modal.deleteBody', { item: escapeHtml(itemName), type: (window.getCurrentLang && window.getCurrentLang() === 'en') ? 'stock' : 'hisse senedi' })
                    : '<strong style="color:#ef4444;">' + escapeHtml(itemName) + '</strong> ' + itemType + 'ni silmek istediğinizden emin misiniz?'}
            </p>
            <div style="display:flex;gap:12px;width:100%;justify-content:center;">
                <button onclick="closeModal('deleteConfirmationModal')" style="padding:12px 24px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;color:white;font-size:16px;font-weight:600;cursor:pointer;min-width:100px;">
                    ${window.t ? window.t('modal.cancel') : 'İptal'}
                </button>
                <button onclick="confirmDelete(${id})" style="padding:12px 24px;background:linear-gradient(135deg,#ef4444,#dc2626);border:none;border-radius:10px;color:white;font-size:16px;font-weight:600;cursor:pointer;min-width:100px;box-shadow:0 4px 12px rgba(239,68,68,0.3);">
                    ${window.t ? window.t('modal.delete') : 'Sil'}
                </button>
            </div>
        </div>
    `;
    return createModal('deleteConfirmationModal', modalContent);
}

window.confirmDelete = async function(id) {
    closeModal('deleteConfirmationModal');
    await deletePortfolioItem(id);
};

// ─── Add-to-portfolio modal (stock) ──────────────────────────────────────────
export function showPortfolioModal(symbol) {
    const cleanSymbol = symbol.replace('.IS', '');
    const stockName   = getStockName(cleanSymbol);

    const modalContent = `
        <div style="background:rgba(255,255,255,0.07);backdrop-filter:blur(20px);border-radius:20px;border:1px solid rgba(255,255,255,0.13);box-shadow:0 25px 45px rgba(0,0,0,0.25);padding:38px 32px 24px 32px;min-width:320px;max-width:95vw;position:relative;display:flex;flex-direction:column;align-items:center;">
            <div style='position:absolute;top:12px;right:12px;display:flex;gap:4px;z-index:1100;'>
                <button class="close-btn" style="background:transparent;border:none;box-shadow:none;padding:0;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
                    <span style="font-size:1.1em;color:#e57373;">&#10005;</span>
                </button>
            </div>
            <h3 style="margin-top:0;margin-bottom:22px;text-align:center;font-size:1.35em;font-weight:700;color:#fff;">
                ${cleanSymbol} - ${stockName}
            </h3>
            <form id="portfolioForm" style="width:100%;max-width:320px;display:flex;flex-direction:column;gap:18px;">
                <label style="display:block;color:rgba(255,255,255,0.8);margin-bottom:8px;font-size:14px;font-weight:500;">${window.t ? window.t('modal.addQty') : 'Miktar'}
                    <input type="text" id="quantity" inputmode="decimal" style="width:100%;margin-top:10px;padding:12px 18px;box-sizing:border-box;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;color:white;font-size:16px;">
                </label>
                <label style="display:block;color:rgba(255,255,255,0.8);margin-bottom:8px;font-size:14px;font-weight:500;">${window.t ? window.t('modal.addPrice') : 'Alış Fiyatı (₺)'}
                    <input type="text" id="purchasePrice" inputmode="decimal" style="width:100%;margin-top:10px;padding:12px 18px;box-sizing:border-box;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;color:white;font-size:16px;">
                </label>
            </form>
            <div style="text-align:center;margin-top:24px;width:100%;">
                <button type="submit" form="portfolioForm" style="width:100%;padding:12px;background:linear-gradient(135deg,#3b82f6,#22c55e);border:none;border-radius:10px;color:white;font-size:16px;font-weight:600;cursor:pointer;">${window.t ? window.t('modal.addSubmit') : 'Ekle'}</button>
            </div>
        </div>
    `;

    const modal = createModal('portfolioModal', modalContent);

    const form = modal.querySelector('#portfolioForm');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const quantity      = modal.querySelector('#quantity').value.trim();
        const purchasePrice = modal.querySelector('#purchasePrice').value.trim();

        let quantityNum, purchasePriceNum;
        try {
            quantityNum      = parseFloat(quantity.replace(/[^\d,.-]/g, '').replace(/,/g, '.'));
            purchasePriceNum = parseFloat(purchasePrice.replace(/[^\d,.-]/g, '').replace(/,/g, '.'));
        } catch (err) {
            showErrorMessage('Sayısal değerler dönüştürülürken hata oluştu');
            return;
        }

        const errors = validatePortfolioData(symbol, quantityNum, purchasePriceNum);
        if (errors.length > 0) { showErrorMessage(errors.join(', ')); return; }

        const success = await addPortfolioItem(symbol, quantityNum, purchasePriceNum, 'stock');
        if (success) {
            closeModal('portfolioModal');
            await renderPortfolioTable();
        }
    };
}

// ─── Sell modal (stock or FX) ────────────────────────────────────────────────
// Opened from the per-row Sat/Sell button via event delegation (app.js). Reuses
// the same glassmorphism styling as the add modal. `symbol`/`type` are the exact
// stored values so the sale targets the right position; `available` (current
// quantity) and `avgCost` (weighted-average cost, never changed by a sell) come
// straight from the rendered row.
export function showSellModal({ symbol, name, type = 'stock', available, avgCost }) {
    const fullSymbol  = String(symbol || '');
    const cleanSymbol = fullSymbol.replace('.IS', '').replace('=X', '');
    const displayName = name || cleanSymbol;
    const maxQty      = Number(available) || 0;
    const cost        = Number(avgCost) || 0;

    const escSymbol = escapeHtml(cleanSymbol);
    const escName   = escapeHtml(displayName);

    const modalContent = `
        <div style="background:rgba(255,255,255,0.07);backdrop-filter:blur(20px);border-radius:20px;border:1px solid rgba(255,255,255,0.13);box-shadow:0 25px 45px rgba(0,0,0,0.25);padding:38px 32px 24px 32px;min-width:320px;max-width:95vw;position:relative;display:flex;flex-direction:column;align-items:center;">
            <div style='position:absolute;top:12px;right:12px;display:flex;gap:4px;z-index:1100;'>
                <button class="close-btn" style="background:transparent;border:none;box-shadow:none;padding:0;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
                    <span style="font-size:1.1em;color:#e57373;">&#10005;</span>
                </button>
            </div>
            <h3 style="margin-top:0;margin-bottom:6px;text-align:center;font-size:1.35em;font-weight:700;color:#fff;">
                ${escSymbol} - ${escName}
            </h3>
            <div style="margin-bottom:18px;padding:4px 14px;border-radius:999px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.4);color:#6ee7b7;font-size:0.82em;font-weight:700;letter-spacing:.5px;">
                ${escapeHtml(tr('modal.sellTitle', 'Sat'))}
            </div>
            <div style="width:100%;max-width:320px;display:flex;justify-content:space-between;gap:12px;margin-bottom:16px;font-size:13px;">
                <span style="color:rgba(255,255,255,0.6);">${escapeHtml(tr('modal.sellAvailable', 'Mevcut'))}:
                    <strong style="color:#fff;">${maxQty.toLocaleString('tr-TR')}</strong>
                </span>
                <span style="color:rgba(255,255,255,0.6);">${escapeHtml(tr('modal.sellAvgCost', 'Ort. Maliyet'))}:
                    <strong style="color:#fff;">${escapeHtml(formatTRY(cost))}</strong>
                </span>
            </div>
            <form id="sellForm" style="width:100%;max-width:320px;display:flex;flex-direction:column;gap:18px;">
                <label style="display:block;color:rgba(255,255,255,0.8);font-size:14px;font-weight:500;">${escapeHtml(tr('modal.sellQty', 'Satılacak Miktar'))}
                    <div style="display:flex;gap:8px;margin-top:10px;">
                        <input type="text" id="sellQuantity" inputmode="decimal" style="flex:1;min-width:0;padding:12px 18px;box-sizing:border-box;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;color:white;font-size:16px;">
                        <button type="button" id="sellAllBtn" style="padding:0 16px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:10px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;">${escapeHtml(tr('modal.sellAll', 'Tümü'))}</button>
                    </div>
                </label>
                <label style="display:block;color:rgba(255,255,255,0.8);font-size:14px;font-weight:500;">${escapeHtml(tr('modal.sellPrice', 'Satış Fiyatı (₺)'))}
                    <input type="text" id="sellPrice" inputmode="decimal" style="width:100%;margin-top:10px;padding:12px 18px;box-sizing:border-box;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;color:white;font-size:16px;">
                </label>
                <div id="sellRealizedRow" style="display:flex;justify-content:space-between;align-items:center;font-size:14px;color:rgba(255,255,255,0.7);">
                    <span>${escapeHtml(tr('modal.sellRealized', 'Tahmini K/Z'))}</span>
                    <strong id="sellRealizedValue" style="color:rgba(255,255,255,0.5);">—</strong>
                </div>
            </form>
            <div style="text-align:center;margin-top:24px;width:100%;max-width:320px;">
                <button type="submit" form="sellForm" style="width:100%;padding:12px;background:linear-gradient(135deg,#10b981,#059669);border:none;border-radius:10px;color:white;font-size:16px;font-weight:600;cursor:pointer;">${escapeHtml(tr('modal.sellSubmit', 'Sat'))}</button>
            </div>
        </div>
    `;

    const modal = createModal('sellModal', modalContent);

    const qtyInput   = modal.querySelector('#sellQuantity');
    const priceInput = modal.querySelector('#sellPrice');
    const realizedEl = modal.querySelector('#sellRealizedValue');
    const allBtn     = modal.querySelector('#sellAllBtn');

    const parseInput = (raw) => parseFloat(String(raw || '').replace(/[^\d,.-]/g, '').replace(/,/g, '.'));

    // Live estimated realized P/L = quantity * (sellPrice - avgCost). Mirrors the
    // server's calculation so the user sees the outcome before confirming.
    const updateRealized = () => {
        const q = parseInput(qtyInput.value);
        const p = parseInput(priceInput.value);
        if (!isFinite(q) || !isFinite(p) || q <= 0 || p <= 0) {
            realizedEl.textContent = '—';
            realizedEl.style.color = 'rgba(255,255,255,0.5)';
            return;
        }
        const pl = q * (p - cost);
        const sign = pl > 0 ? '+' : '';
        realizedEl.textContent = `${sign}${formatTRY(pl)}`;
        realizedEl.style.color = pl > 0 ? '#34d399' : (pl < 0 ? '#f87171' : 'rgba(255,255,255,0.7)');
    };

    qtyInput.addEventListener('input', updateRealized);
    priceInput.addEventListener('input', updateRealized);
    allBtn.addEventListener('click', () => { qtyInput.value = String(maxQty); updateRealized(); });

    const form = modal.querySelector('#sellForm');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const quantityNum = parseInput(qtyInput.value);
        const priceNum    = parseInput(priceInput.value);

        // Reuse the shared quantity/price validator (same rules as the add modal),
        // then add the sell-specific rule: never sell more than is owned. The
        // backend enforces the same limits; this just avoids a needless round-trip.
        const errors = validatePortfolioData(fullSymbol, quantityNum, priceNum);
        if (isFinite(quantityNum) && quantityNum > maxQty + 1e-9) {
            errors.push(tr('msg.sellQtyError', 'Miktar mevcut miktarı aşamaz'));
        }
        if (errors.length > 0) { showErrorMessage(errors.join(', ')); return; }

        const result = await sellPortfolioItem(fullSymbol, quantityNum, priceNum, type);
        if (result) {
            closeModal('sellModal');
            // Re-render portfolio (summary + tables); this also refreshes the
            // transaction-history ledger via window.renderTransactions.
            await renderPortfolioTable();
        }
    };
}

// window.addFxToPortfolio is in js/fx-portfolio.js (ADIM 4)

// ─── Global window assignments ────────────────────────────────────────────────
window.showPortfolioModal          = showPortfolioModal;
window.deletePortfolioItem         = deletePortfolioItem;
window.addPortfolioItem            = addPortfolioItem;
window.sellPortfolioItem           = sellPortfolioItem;
window.showSellModal               = showSellModal;
window.showDeleteConfirmationModal = showDeleteConfirmationModal;
window.closeModal                  = closeModal;

// ─── Portfolio initialization (orchestrates sub-modules) ─────────────────────
export function initPortfolio() {
    fetchAllStocks();

    // NOTE: Refreshing is handled solely by the header #globalRefreshBtn
    // (wired in app.js → refreshAll). The old per-table #refreshPortfolioBtn
    // was removed along with the legacy portfolio layout.

    const chartRange = document.getElementById('chartRange');
    if (chartRange) {
        chartRange.onchange = function() {
            const symbol = document.getElementById('modalSymbol')?.textContent;
            if (symbol) {
                const range = this.value;
                const apiRange = ['1w', '1m', '1y', '10y'].includes(range) ? range : '1m';
                showChartModal(symbol + '.IS', symbol, apiRange);
            }
        };
    }

    // Refresh global references after init
    window.showPortfolioModal    = showPortfolioModal;
    window.showChartModal        = showChartModal;
    window.toggleChartFullscreen = toggleChartFullscreen;
    window.deletePortfolioItem   = deletePortfolioItem;
    window.addPortfolioItem      = addPortfolioItem;
    window.sellPortfolioItem     = sellPortfolioItem;
    window.showSellModal         = showSellModal;
    window.renderPortfolioTable  = renderPortfolioTable;
}
