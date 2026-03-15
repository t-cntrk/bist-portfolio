/**
 * fx-portfolio.js — FX portfolio rendering, FX market data fetching, and
 * "Add FX to portfolio" modal.
 *
 * Dependency chain (no cycles):
 *   fx-portfolio.js → portfolio-crud.js (fetchFxPortfolio, addPortfolioItem)
 *   portfolio-crud.js → portfolio-render.js (renderPortfolioTable)
 *   portfolio-render.js → portfolio-crud.js (fetchPortfolio)   ← cycle, but safe
 *   fx-portfolio.js is NOT imported by portfolio-render.js → no new cycle.
 */
import { createApiRequest, handleApiResponse } from './api.js';
import { showErrorMessage } from './notifications.js';
import { FX_SYMBOL_TO_YAHOO, createModal, closeModal } from './dom-helpers.js';
import { validatePortfolioData } from './validation.js';
import { fetchFxPortfolio, addPortfolioItem } from './portfolio-crud.js';

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

// ─── Currency rates table (Döviz Kurları) ────────────────────────────────────
export function renderFxTable(fxData) {
    const currencyData = document.getElementById('currencyData');
    if (!currencyData) return;

    const usdData = fxData['USDTRY=X'];
    if (usdData && !usdData.error) {
        const p  = usdData.regularMarketPrice          || 0;
        const c  = usdData.regularMarketChange         || 0;
        const cp = usdData.regularMarketChangePercent  || 0;
        const el = cls => currencyData.querySelector(`.${cls}`);
        if (el('usd-price')) el('usd-price').textContent = p.toFixed(4) + ' ₺';
        if (el('usd-change')) {
            el('usd-change').textContent = (c > 0 ? '+' : '') + c.toFixed(4) + ' ₺';
            el('usd-change').className = `cell ${c > 0 ? 'change-positive' : c < 0 ? 'change-negative' : 'neutral'}`;
        }
        if (el('usd-change-percent')) {
            el('usd-change-percent').textContent = (cp > 0 ? '+' : '') + cp.toFixed(2) + '%';
            el('usd-change-percent').className = `cell ${cp > 0 ? 'change-positive' : cp < 0 ? 'change-negative' : 'neutral'}`;
        }
    }

    const eurData = fxData['EURTRY=X'];
    if (eurData && !eurData.error) {
        const p  = eurData.regularMarketPrice          || 0;
        const c  = eurData.regularMarketChange         || 0;
        const cp = eurData.regularMarketChangePercent  || 0;
        const el = cls => currencyData.querySelector(`.${cls}`);
        if (el('eur-price')) el('eur-price').textContent = p.toFixed(4) + ' ₺';
        if (el('eur-change')) {
            el('eur-change').textContent = (c > 0 ? '+' : '') + c.toFixed(4) + ' ₺';
            el('eur-change').className = `cell ${c > 0 ? 'change-positive' : c < 0 ? 'change-negative' : 'neutral'}`;
        }
        if (el('eur-change-percent')) {
            el('eur-change-percent').textContent = (cp > 0 ? '+' : '') + cp.toFixed(2) + '%';
            el('eur-change-percent').className = `cell ${cp > 0 ? 'change-positive' : cp < 0 ? 'change-negative' : 'neutral'}`;
        }
    }

    const goldData = fxData['GC=F'];
    if (goldData && !goldData.error) {
        const p  = goldData.regularMarketPrice         || 0;
        const c  = goldData.regularMarketChange        || 0;
        const cp = goldData.regularMarketChangePercent || 0;
        const el = cls => currencyData.querySelector(`.${cls}`);
        if (el('ons-price')) el('ons-price').textContent = p.toFixed(2) + ' $';
        if (el('ons-change')) {
            el('ons-change').textContent = (c > 0 ? '+' : '') + c.toFixed(2) + ' $';
            el('ons-change').className = `cell ${c > 0 ? 'change-positive' : c < 0 ? 'change-negative' : 'neutral'}`;
        }
        if (el('ons-change-percent')) {
            el('ons-change-percent').textContent = (cp > 0 ? '+' : '') + cp.toFixed(2) + '%';
            el('ons-change-percent').className = `cell ${cp > 0 ? 'change-positive' : cp < 0 ? 'change-negative' : 'neutral'}`;
        }
    }

    // Gram Gold (calculated from XAU/USD × USD/TRY)
    const usdTryData = fxData['USDTRY=X'];
    if (goldData && usdTryData && !goldData.error && !usdTryData.error) {
        const goldPriceUSD  = goldData.regularMarketPrice   || 0;
        const usdTryRate    = usdTryData.regularMarketPrice || 0;
        const gramPrice     = (goldPriceUSD * usdTryRate) / 31.1035;
        const prevGoldUSD   = goldPriceUSD - (goldData.regularMarketChange   || 0);
        const prevUsdTry    = usdTryRate   - (usdTryData.regularMarketChange || 0);
        const prevGramPrice = (prevGoldUSD * prevUsdTry) / 31.1035;
        const gramChange    = gramPrice - prevGramPrice;
        const gramChangePct = prevGramPrice !== 0 ? (gramChange / prevGramPrice) * 100 : 0;
        const el = cls => currencyData.querySelector(`.${cls}`);
        if (el('gram-price')) el('gram-price').textContent = gramPrice.toFixed(2) + ' ₺';
        if (el('gram-change')) {
            el('gram-change').textContent = (gramChange > 0 ? '+' : '') + gramChange.toFixed(2) + ' ₺';
            el('gram-change').className = `cell ${gramChange > 0 ? 'change-positive' : gramChange < 0 ? 'change-negative' : 'neutral'}`;
        }
        if (el('gram-change-percent')) {
            el('gram-change-percent').textContent = (gramChangePct > 0 ? '+' : '') + gramChangePct.toFixed(2) + '%';
            el('gram-change-percent').className = `cell ${gramChangePct > 0 ? 'change-positive' : gramChangePct < 0 ? 'change-negative' : 'neutral'}`;
        }
    }
}

// ─── FX portfolio table rendering ────────────────────────────────────────────
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

function getCurrencyName(symbol) {
    const names = { 'USD': 'Amerikan Doları', 'EUR': 'Euro', 'GBP': 'İngiliz Sterlini', 'JPY': 'Japon Yeni', 'TRY': 'Türk Lirası' };
    return names[symbol] || symbol;
}

export function createModernFxPortfolioRowHTML(item, fxData) {
    const cleanSymbol = item.symbol.replace('=X', '');
    const yahooSymbol = FX_SYMBOL_TO_YAHOO[item.symbol] || item.symbol;

    let currentPrice = 0;
    if (fxData && fxData[yahooSymbol] && fxData[yahooSymbol].regularMarketPrice) {
        currentPrice = fxData[yahooSymbol].regularMarketPrice;
        if ((item.symbol === 'XAU/TRY' || item.symbol === 'XAU&#x2F;TRY') && fxData['USDTRY=X']) {
            currentPrice = (currentPrice * fxData['USDTRY=X'].regularMarketPrice) / 31.1035;
        }
    }

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
            return;
        }

        const fxData      = await fetchFxData();
        const allRowsHTML = portfolio.map(item => createModernFxPortfolioRowHTML(item, fxData));

        fxPortfolioCard.style.display = 'block';
        fxPortfolioBody.innerHTML = allRowsHTML.join('');
    } catch (error) {
        console.error('FX portfolio render error:', error);
        fxPortfolioCard.style.display = 'block';
    }
}

export const renderFxPortfolioTable = renderModernFxPortfolioTable;

// ─── Add FX to portfolio modal ────────────────────────────────────────────────
window.addFxToPortfolio = function(symbol) {
    const fxName = symbol.replace('=X', '').replace('=', '');

    const modalContent = `
        <div style="background:rgba(255,255,255,0.07);backdrop-filter:blur(20px);border-radius:20px;border:1px solid rgba(255,255,255,0.13);box-shadow:0 25px 45px rgba(0,0,0,0.25);padding:38px 32px 24px 32px;min-width:320px;max-width:95vw;position:relative;display:flex;flex-direction:column;align-items:center;">
            <div style='position:absolute;top:12px;right:12px;z-index:1100;'>
                <button class="close-btn" style="background:transparent;border:none;box-shadow:none;padding:0;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
                    <span style="font-size:1.1em;color:#e57373;">&#10005;</span>
                </button>
            </div>
            <h3 style="margin-top:0;margin-bottom:22px;text-align:center;font-size:1.35em;font-weight:700;color:#f59e0b;">${fxName} Portföye Ekle</h3>
            <form id="fxPortfolioForm" style="width:100%;max-width:320px;display:flex;flex-direction:column;gap:18px;">
                <label style="display:block;color:rgba(255,255,255,0.8);font-size:14px;font-weight:500;">${window.t ? window.t('modal.addQty') : 'Miktar'}
                    <input type="text" id="fxQtyInput" inputmode="decimal" placeholder="Örn: 1000" style="width:100%;margin-top:10px;padding:12px 18px;box-sizing:border-box;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;color:white;font-size:16px;">
                </label>
                <label style="display:block;color:rgba(255,255,255,0.8);font-size:14px;font-weight:500;">${window.t ? window.t('modal.addPrice') : 'Alış Fiyatı (₺)'}
                    <input type="text" id="fxPriceInput" inputmode="decimal" placeholder="Örn: 32.50" style="width:100%;margin-top:10px;padding:12px 18px;box-sizing:border-box;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;color:white;font-size:16px;">
                </label>
            </form>
            <div style="text-align:center;margin-top:24px;width:100%;">
                <button type="submit" form="fxPortfolioForm" style="width:100%;padding:12px;background:linear-gradient(135deg,#f59e0b,#ef4444);border:none;border-radius:10px;color:white;font-size:16px;font-weight:600;cursor:pointer;">${window.t ? window.t('modal.addSubmit') : 'Ekle'}</button>
            </div>
        </div>
    `;

    const modal = createModal('fxPortfolioModal', modalContent);

    const form = modal.querySelector('#fxPortfolioForm');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const rawQty   = modal.querySelector('#fxQtyInput').value.trim();
        const rawPrice = modal.querySelector('#fxPriceInput').value.trim();

        const quantityNum = parseFloat(rawQty.replace(/[^\d,.-]/g, '').replace(/,/g, '.'));
        const priceNum    = parseFloat(rawPrice.replace(/[^\d,.-]/g, '').replace(/,/g, '.'));

        const errors = validatePortfolioData(symbol, quantityNum, priceNum);
        if (errors.length > 0) { showErrorMessage(errors.join(', ')); return; }

        const success = await addPortfolioItem(symbol, quantityNum, priceNum, 'fx');
        if (success) {
            closeModal('fxPortfolioModal');
            await renderModernFxPortfolioTable();
            // Also refresh stock portfolio totals if present
            if (typeof window.renderPortfolioTable === 'function') {
                window.renderPortfolioTable();
            }
        }
    };
};
