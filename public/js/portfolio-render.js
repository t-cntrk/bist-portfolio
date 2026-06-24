/**
 * portfolio-render.js — Unified portfolio table, summary cards, and donut segments.
 *
 * renderUnifiedPortfolio() fetches stocks + FX in parallel, renders one table,
 * updates combined summary totals, and feeds portfolio-allocation.js.
 *
 * Circular-dependency note:
 *   deletePortfolioItem / showPortfolioModal (in portfolio-crud.js) call
 *   renderPortfolioTable from here.  fetchPortfolio (in portfolio-crud.js) is
 *   imported here.  Both are function-body-only references — safe for ES modules.
 */
import { escapeHtml } from './dom-helpers.js';
import { fetchStock, getStockName } from './stocks.js';
import { fetchPortfolio, fetchFxPortfolio } from './portfolio-crud.js';
import { AppState } from './state.js';
import { setAllocationSegment } from './portfolio-allocation.js';
import { formatTRY as formatCurrency } from './formatters.js';
import {
    fetchFxData,
    createModernFxPortfolioRowHTML,
    computeFxCurrentPrice
} from './fx-portfolio.js';

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

function showEmptyPortfolioRow(tbody, message) {
    tbody.innerHTML = '';
    const row  = document.createElement('tr');
    const cell = document.createElement('td');
    cell.setAttribute('colspan', '8');
    cell.style.cssText = 'display:table-cell;width:auto;text-align:center;color:rgba(255,255,255,0.6);padding:48px 20px;font-size:1.05em;font-weight:500;background:transparent;border:none;';
    cell.textContent = message;
    row.appendChild(cell);
    tbody.appendChild(row);
}

function updateSummaryCards(totalInvestmentValue, totalCurrentValue, totalProfitValue) {
    const totalInvestment = document.getElementById('newTotalInvestment');
    const totalProfit     = document.getElementById('newTotalProfit');

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
}

// ─── Unified portfolio (stocks + FX + summary + donut) ───────────────────────
export async function renderUnifiedPortfolio() {
    const portfolioBody  = document.getElementById('newUnifiedPortfolioBody');
    const lastUpdateTime = document.getElementById('newLastUpdateTime');

    if (!portfolioBody) {
        console.error('Portfolio table body not found: newUnifiedPortfolioBody');
        return;
    }

    try {
        const [stockPortfolio, fxPortfolio] = await Promise.all([
            fetchPortfolio(),
            fetchFxPortfolio()
        ]);

        if (stockPortfolio.length === 0 && fxPortfolio.length === 0) {
            showEmptyPortfolioRow(portfolioBody, 'Portföyünüzde henüz varlık bulunmuyor.');
            setAllocationSegment('stock', []);
            setAllocationSegment('fx', []);
            updateSummaryCards(0, 0, 0);
            return;
        }

        if (lastUpdateTime) lastUpdateTime.textContent = new Date().toLocaleTimeString('tr-TR');

        let totalInvestmentValue = 0;
        let totalCurrentValue    = 0;
        let totalProfitValue     = 0;

        const cachedStocks = AppState.get('stocks') || [];
        const priceMap = new Map(
            cachedStocks
                .filter(s => s && s.symbol && s.regularMarketPrice)
                .map(s => [s.symbol, s.regularMarketPrice])
        );

        const [stockPrices, fxData] = await Promise.all([
            Promise.all(stockPortfolio.map(async (item) => {
                if (priceMap.has(item.symbol)) return priceMap.get(item.symbol);
                try {
                    const stockData = await fetchStock(item.symbol);
                    return stockData && stockData.regularMarketPrice ? stockData.regularMarketPrice : 0;
                } catch (error) {
                    console.warn(`Failed to fetch current price for ${item.symbol}:`, error);
                    return 0;
                }
            })),
            fetchFxData()
        ]);

        const allRowsHTML = [];
        const stockAllocationItems = [];
        const fxAllocationItems = [];

        stockPortfolio.forEach((item, i) => {
            const currentPrice  = stockPrices[i];
            const currentValue    = item.quantity * currentPrice;
            const investmentValue = item.quantity * item.purchase_price;

            allRowsHTML.push(createModernPortfolioRowHTML(item, currentPrice));
            totalInvestmentValue += investmentValue;
            totalCurrentValue    += currentValue;
            totalProfitValue     += (currentValue - investmentValue);
            stockAllocationItems.push({ label: item.symbol.replace('.IS', ''), value: currentValue });
        });

        fxPortfolio.forEach((item) => {
            const currentPrice  = computeFxCurrentPrice(item, fxData);
            const currentValue    = item.quantity * currentPrice;
            const investmentValue = item.quantity * item.purchase_price;

            allRowsHTML.push(createModernFxPortfolioRowHTML(item, fxData));
            totalInvestmentValue += investmentValue;
            totalCurrentValue    += currentValue;
            totalProfitValue     += (currentValue - investmentValue);
            fxAllocationItems.push({ label: item.symbol.replace('=X', ''), value: currentValue });
        });

        portfolioBody.innerHTML = allRowsHTML.join('');
        setAllocationSegment('stock', stockAllocationItems);
        setAllocationSegment('fx', fxAllocationItems);
        updateSummaryCards(totalInvestmentValue, totalCurrentValue, totalProfitValue);

    } catch (error) {
        console.error('Error rendering unified portfolio:', error);
        portfolioBody.innerHTML = '';
        const row  = document.createElement('tr');
        const cell = document.createElement('td');
        cell.setAttribute('colspan', '8');
        cell.style.cssText = 'text-align:center;color:#dc3545;padding:40px;';
        cell.textContent = 'Portföy yüklenirken hata oluştu.';
        row.appendChild(cell);
        portfolioBody.appendChild(row);
    }
}

/** @deprecated Use renderUnifiedPortfolio — kept as alias for legacy callers. */
export const renderPortfolioTable = renderUnifiedPortfolio;

window.renderUnifiedPortfolio  = renderUnifiedPortfolio;
window.renderPortfolioTable    = renderUnifiedPortfolio;
window.renderFxPortfolioTable  = renderUnifiedPortfolio;
