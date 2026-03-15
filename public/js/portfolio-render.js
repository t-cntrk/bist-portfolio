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

// ─── Local helpers ────────────────────────────────────────────────────────────
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

async function getCurrentStockPrice(symbol) {
    try {
        const stockData = await fetchStock(symbol);
        return stockData && stockData.regularMarketPrice ? stockData.regularMarketPrice : 0;
    } catch (error) { return 0; }
}

// ─── Stock portfolio row HTML ─────────────────────────────────────────────────
async function createModernPortfolioRowHTML(item) {
    const cleanSymbol = item.symbol.replace('.IS', '');
    const stockName   = getStockName(cleanSymbol);

    let currentPrice = 0;
    try {
        const stockData = await fetchStock(item.symbol);
        if (stockData && stockData.regularMarketPrice) currentPrice = stockData.regularMarketPrice;
    } catch (error) {
        console.warn(`Failed to fetch current price for ${item.symbol}:`, error);
    }

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
            cell.style.cssText = 'text-align:center;color:#6c757d;padding:40px;';
            cell.textContent = 'Portföyünüzde henüz hisse senedi bulunmuyor.';
            row.appendChild(cell);
            stockPortfolioBody.appendChild(row);
            return;
        }

        if (lastUpdateTime) lastUpdateTime.textContent = new Date().toLocaleTimeString('tr-TR');

        let totalInvestmentValue = 0;
        let totalCurrentValue    = 0;
        let totalProfitValue     = 0;

        const allRowsHTML = [];

        for (const item of portfolio) {
            const rowHTML = await createModernPortfolioRowHTML(item);
            allRowsHTML.push(rowHTML);

            const currentPrice    = await getCurrentStockPrice(item.symbol);
            const currentValue    = item.quantity * currentPrice;
            const investmentValue = item.quantity * item.purchase_price;

            totalInvestmentValue += investmentValue;
            totalCurrentValue    += currentValue;
            totalProfitValue     += (currentValue - investmentValue);
        }

        stockPortfolioBody.innerHTML = allRowsHTML.join('');

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
