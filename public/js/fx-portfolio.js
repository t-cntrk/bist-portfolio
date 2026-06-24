/**
 * fx-portfolio.js — FX portfolio rendering and FX market data fetching.
 *
 * Dependency chain (no cycles):
 *   fx-portfolio.js → portfolio-crud.js (fetchFxPortfolio)
 *   portfolio-crud.js → portfolio-render.js (renderPortfolioTable)
 *   portfolio-render.js → portfolio-crud.js (fetchPortfolio)   ← cycle, but safe
 *   fx-portfolio.js is NOT imported by portfolio-render.js → no new cycle.
 */
import { createApiRequest, handleApiResponse } from './api.js';
import { FX_SYMBOL_TO_YAHOO } from './dom-helpers.js';
import { fetchFxPortfolio } from './portfolio-crud.js';
import { setAllocationSegment } from './portfolio-allocation.js';

// ─── FX market data ───────────────────────────────────────────────────────────
function normalizeFxResponse(data) {
    if (!data) return {};
    if (Array.isArray(data)) return Object.fromEntries(data.map(d => [d.symbol, d]));
    return data;
}

export async function fetchFxData() {
    try {
        const response = await createApiRequest('/api/stocks/fx');
        const data     = await handleApiResponse(response);
        return normalizeFxResponse(data);
    } catch (error) {
        console.error('FX fetch error:', error);
        return {};
    }
}

// NOTE: The Döviz Kurları (currency rates) table is rendered by
// fx.js → updateCurrencyDisplay. A parallel renderFxTable() used to live here
// but was never called from the live app path, so it has been removed.

// ─── FX portfolio table rendering ────────────────────────────────────────────
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

function getCurrencyName(symbol) {
    const names = { 'USD': 'Amerikan Doları', 'EUR': 'Euro', 'GBP': 'İngiliz Sterlini', 'JPY': 'Japon Yeni', 'TRY': 'Türk Lirası' };
    return names[symbol] || symbol;
}

// Resolve the current TRY price for an FX/gold holding (gold ounce converted to
// gram-TRY). Shared by the table row and the allocation chart so both agree.
function computeFxCurrentPrice(item, fxData) {
    const yahooSymbol = FX_SYMBOL_TO_YAHOO[item.symbol] || item.symbol;
    let currentPrice = 0;
    if (fxData && fxData[yahooSymbol] && fxData[yahooSymbol].regularMarketPrice) {
        currentPrice = fxData[yahooSymbol].regularMarketPrice;
        if ((item.symbol === 'XAU/TRY' || item.symbol === 'XAU&#x2F;TRY') && fxData['USDTRY=X']) {
            currentPrice = (currentPrice * fxData['USDTRY=X'].regularMarketPrice) / 31.1035;
        }
    }
    return currentPrice;
}

export function createModernFxPortfolioRowHTML(item, fxData) {
    const cleanSymbol = item.symbol.replace('=X', '');

    const currentPrice  = computeFxCurrentPrice(item, fxData);
    const totalValue    = item.quantity * currentPrice;
    const purchaseValue = item.quantity * item.purchase_price;
    const profitLoss    = totalValue - purchaseValue;
    const profitLossPct = purchaseValue !== 0 ? (profitLoss / purchaseValue) * 100 : 0;

    let profitLossClass = 'neutral';
    if (profitLoss > 0)      profitLossClass = 'profit';
    else if (profitLoss < 0) profitLossClass = 'loss';

    const sign = profitLoss > 0 ? '+' : '';
    const lang = window.getCurrentLang ? window.getCurrentLang() : 'tr';

    return `<tr>
        <td data-label="VARLIK">
            <div class="stock-info">
                <span class="symbol" style="color:#f59e0b;">${cleanSymbol}</span>
                <span class="name" style="color:#f59e0b;">${getCurrencyName(cleanSymbol)}</span>
            </div>
        </td>
        <td data-label="MIKTAR">${item.quantity.toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR')}</td>
        <td data-label="ALIŞ FİYATI">${formatCurrency(item.purchase_price)}</td>
        <td data-label="TOPLAM YATIRIM (₺)">${formatCurrency(purchaseValue)}</td>
        <td data-label="GÜNCEL DEĞER (₺)">${currentPrice > 0 ? formatCurrency(totalValue) : '-'}</td>
        <td data-label="KAR/ZARAR (₺)" class="${profitLossClass}">${sign}${formatCurrency(profitLoss)}</td>
        <td data-label="KAR/ZARAR (%)" class="${profitLossClass}">${sign}${profitLossPct.toFixed(2)}%</td>
        <td data-label="İŞLEM">
            <button class="btn-action delete-portfolio-btn" onclick="showDeleteConfirmationModal(${item.id}, '${cleanSymbol}', 'döviz öğesini')" title="Sil">
                <i>✕</i>
            </button>
        </td>
    </tr>`;
}

export async function renderModernFxPortfolioTable() {
    const fxPortfolioCard = document.getElementById('fxPortfolioCard');
    const fxPortfolioBody = document.getElementById('fxPortfolioBody');

    if (!fxPortfolioCard || !fxPortfolioBody) return;

    try {
        const portfolio = await fetchFxPortfolio();

        if (portfolio.length === 0) {
            fxPortfolioCard.style.display = 'none';
            setAllocationSegment('fx', []);
            return;
        }

        const fxData      = await fetchFxData();
        const allRowsHTML = portfolio.map(item => createModernFxPortfolioRowHTML(item, fxData));

        fxPortfolioCard.style.display = 'block';
        fxPortfolioBody.innerHTML = allRowsHTML.join('');

        const allocationItems = portfolio.map(item => ({
            label: item.symbol.replace('=X', ''),
            value: item.quantity * computeFxCurrentPrice(item, fxData),
        }));
        setAllocationSegment('fx', allocationItems);

        if (typeof window.applyPortfolioFixes === 'function') {
            setTimeout(() => window.applyPortfolioFixes(), 10);
        }
    } catch (error) {
        console.error('FX portfolio render error:', error);
        fxPortfolioCard.style.display = 'block';
    }
}

export const renderFxPortfolioTable = renderModernFxPortfolioTable;

// NOTE: The "Add FX to portfolio" modal is provided by fx.js → showFxPortfolioModal
// (wired via the .currency-add-btn delegation in app.js). A duplicate
// window.addFxToPortfolio implementation used to live here but was never called,
// so it has been removed.
