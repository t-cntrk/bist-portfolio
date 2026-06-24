/**
 * portfolio-render.js — Stock portfolio table rendering.
 *
 * FX rendering (renderFxTable, renderModernFxPortfolioTable, etc.) has moved
 * to js/fx-portfolio.js (ADIM 4).
 *
 * Circular-dependency note:
 *   deletePortfolioItem / showPortfolioModal (in portfolio-crud.js) call
 *   renderPortfolioTable from here.  fetchPortfolio (in portfolio-crud.js) is
 *   imported here.  Both are function-body-only references — safe for ES modules.
 */
import { escapeHtml } from './dom-helpers.js';
import { fetchStock, getStockName } from './stocks.js';
import { fetchPortfolio } from './portfolio-crud.js';
import { AppState } from './state.js';
import { setAllocationSegment } from './portfolio-allocation.js';

// ─── Local helpers ────────────────────────────────────────────────────────────
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

// ─── Stock portfolio row HTML ─────────────────────────────────────────────────
// currentPrice is fetched once by the caller and passed in (avoids duplicate,
// sequential network requests per row).
function createModernPortfolioRowHTML(item, currentPrice) {
    const cleanSymbol = item.symbol.replace('.IS', '');
    const stockName   = getStockName(cleanSymbol);

    const totalValue    = item.quantity * currentPrice;
    const purchaseValue = item.quantity * item.purchase_price;
    const profitLoss    = totalValue - purchaseValue;
    const profitLossPct = purchaseValue !== 0 ? (profitLoss / purchaseValue) * 100 : 0;

    let profitLossClass = 'neutral';
    if (profitLoss > 0)      profitLossClass = 'profit';
    else if (profitLoss < 0) profitLossClass = 'loss';

    const sign = profitLoss > 0 ? '+' : '';

    return `<tr>
        <td data-label="HISSE">
            <div class="stock-info">
                <span class="symbol">${cleanSymbol}</span>
                <span class="name">${stockName}</span>
            </div>
        </td>
        <td data-label="MIKTAR">${item.quantity.toLocaleString('tr-TR')}</td>
        <td data-label="ALIŞ">${formatCurrency(item.purchase_price)}</td>
        <td data-label="YATIRIM">${formatCurrency(purchaseValue)}</td>
        <td data-label="GÜNCEL DEĞER">${currentPrice > 0 ? formatCurrency(totalValue) : '-'}</td>
        <td data-label="K/Z (₺)" class="${profitLossClass}">${sign}${formatCurrency(profitLoss)}</td>
        <td data-label="K/Z (%)" class="${profitLossClass}">${sign}${profitLossPct.toFixed(2)}%</td>
        <td data-label="İŞLEM">
            <button class="btn-action delete-portfolio-btn" onclick="showDeleteConfirmationModal(${item.id}, '${cleanSymbol}', 'hisse senedini')" title="Sil">
                <i>✕</i>
            </button>
        </td>
    </tr>`;
}

// ─── Stock portfolio table ────────────────────────────────────────────────────
export async function renderPortfolioTable() {
    const stockPortfolioBody = document.getElementById('newUnifiedPortfolioBody');
    const lastUpdateTime     = document.getElementById('newLastUpdateTime');
    const totalInvestment    = document.getElementById('newTotalInvestment');
    const totalProfit        = document.getElementById('newTotalProfit');

    if (!stockPortfolioBody) {
        console.error('Portfolio table body not found: newUnifiedPortfolioBody');
        return;
    }

    try {
        const portfolio = await fetchPortfolio();

        if (portfolio.length === 0) {
            stockPortfolioBody.innerHTML = '';
            const row  = document.createElement('tr');
            const cell = document.createElement('td');
            cell.setAttribute('colspan', '8');
            // Override the table's per-column width + flex rules so the message
            // spans every column and stays perfectly centered.
            cell.style.cssText = 'display:table-cell;width:auto;text-align:center;color:rgba(255,255,255,0.6);padding:48px 20px;font-size:1.05em;font-weight:500;background:transparent;border:none;';
            cell.textContent = 'Portföyünüzde henüz hisse senedi bulunmuyor.';
            row.appendChild(cell);
            stockPortfolioBody.appendChild(row);
            setAllocationSegment('stock', []);
            return;
        }

        if (lastUpdateTime) lastUpdateTime.textContent = new Date().toLocaleTimeString('tr-TR');

        let totalInvestmentValue = 0;
        let totalCurrentValue    = 0;
        let totalProfitValue     = 0;

        // Reuse prices already loaded into AppState by fetchAllStocks; only hit the
        // network for symbols we don't have cached (avoids the previous N+1 fetches).
        const cachedStocks = AppState.get('stocks') || [];
        const priceMap = new Map(
            cachedStocks
                .filter(s => s && s.symbol && s.regularMarketPrice)
                .map(s => [s.symbol, s.regularMarketPrice])
        );

        const prices = await Promise.all(portfolio.map(async (item) => {
            if (priceMap.has(item.symbol)) return priceMap.get(item.symbol);
            try {
                const stockData = await fetchStock(item.symbol);
                return stockData && stockData.regularMarketPrice ? stockData.regularMarketPrice : 0;
            } catch (error) {
                console.warn(`Failed to fetch current price for ${item.symbol}:`, error);
                return 0;
            }
        }));

        const allRowsHTML = [];
        const allocationItems = [];

        portfolio.forEach((item, i) => {
            const currentPrice = prices[i];
            allRowsHTML.push(createModernPortfolioRowHTML(item, currentPrice));

            const currentValue    = item.quantity * currentPrice;
            const investmentValue = item.quantity * item.purchase_price;

            totalInvestmentValue += investmentValue;
            totalCurrentValue    += currentValue;
            totalProfitValue     += (currentValue - investmentValue);

            allocationItems.push({ label: item.symbol.replace('.IS', ''), value: currentValue });
        });

        stockPortfolioBody.innerHTML = allRowsHTML.join('');
        setAllocationSegment('stock', allocationItems);

        if (typeof window.applyPortfolioFixes === 'function') {
            setTimeout(() => window.applyPortfolioFixes(), 10);
        }

        if (totalInvestment) totalInvestment.textContent = formatCurrency(totalInvestmentValue);

        const currentValueElement = document.getElementById('newCurrentValue');
        if (currentValueElement) currentValueElement.textContent = formatCurrency(totalCurrentValue);

        if (totalProfit) {
            const profitClass = totalProfitValue >= 0 ? 'profit' : 'loss';
            const profitSign  = totalProfitValue >= 0 ? '+' : '';
            totalProfit.innerHTML = `<strong>${profitSign}${escapeHtml(formatCurrency(totalProfitValue))}</strong>`;
            const profitCard = document.getElementById('newTotalProfitCard');
            if (profitCard) profitCard.className = `new-summary-card ${profitClass}`;
        }

        const totalProfitPercentElement = document.getElementById('newTotalProfitPercent');
        if (totalProfitPercentElement) {
            const profitPercent = totalInvestmentValue > 0 ? (totalProfitValue / totalInvestmentValue) * 100 : 0;
            const profitSign    = totalProfitValue >= 0 ? '+' : '';
            const profitClass   = totalProfitValue >= 0 ? 'profit' : 'loss';
            totalProfitPercentElement.textContent = `${profitSign}${profitPercent.toFixed(2)}%`;
            const profitPercentCard = document.getElementById('newTotalProfitPercentCard');
            if (profitPercentCard) profitPercentCard.className = `new-summary-card ${profitClass}`;
        }

    } catch (error) {
        console.error('Error rendering portfolio table:', error);
        if (stockPortfolioBody) {
            stockPortfolioBody.innerHTML = '';
            const row  = document.createElement('tr');
            const cell = document.createElement('td');
            cell.setAttribute('colspan', '8');
            cell.style.cssText = 'text-align:center;color:#dc3545;padding:40px;';
            cell.textContent = 'Portföy yüklenirken hata oluştu.';
            row.appendChild(cell);
            stockPortfolioBody.appendChild(row);
        }
    }
}

// Make renderPortfolioTable available globally for inline onclick handlers and legacy calls
window.renderPortfolioTable = renderPortfolioTable;
