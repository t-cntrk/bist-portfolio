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
// Circular dep (safe): renderPortfolioTable is only called inside function bodies.
import { renderPortfolioTable } from './portfolio-render.js';

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
        await Promise.all([
            renderPortfolioTable(),
            (typeof window.renderFxPortfolioTable === 'function')
                ? window.renderFxPortfolioTable()
                : Promise.resolve()
        ]);
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

// window.addFxToPortfolio is in js/fx-portfolio.js (ADIM 4)

// ─── Global window assignments ────────────────────────────────────────────────
window.showPortfolioModal          = showPortfolioModal;
window.deletePortfolioItem         = deletePortfolioItem;
window.addPortfolioItem            = addPortfolioItem;
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
    window.renderPortfolioTable  = renderPortfolioTable;
}
