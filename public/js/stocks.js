/**
 * stocks.js — Stock data fetching, row rendering, and status/progress helpers.
 * Handles /api/stocks and /api/stocks/quote/:symbol endpoints.
 */
import { createApiRequest, handleApiResponse } from './api.js';
import { showErrorMessage, showSuccessMessage, showDataUpdateAnimation } from './notifications.js';
import { formatTime, formatVolume } from './formatters.js';
import { safeGetElementById, escapeHtml } from './dom-helpers.js';

let isLoading = false;
const REQUEST_DELAY = 100;

// ─── Status / progress helpers ────────────────────────────────────────────────
function updateStatus(status, text) {
    const statusElement = document.getElementById('statusValue');
    const lastUpdateElement = document.getElementById('lastUpdate');

    if (statusElement) {
        statusElement.textContent = text;
        statusElement.className = `stat-value ${status}`;
    }

    if (lastUpdateElement && status === 'success') {
        lastUpdateElement.textContent = formatTime(Date.now());
    }
}

function updateProgress(current, total) {
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const btnText = document.getElementById('btnText');

    if (progressBar && progressFill) {
        const percentage = (current / total) * 100;
        progressFill.style.width = percentage + '%';

        if (current === total) {
            setTimeout(() => {
                progressBar.style.display = 'none';
                if (btnText) btnText.textContent = (window.getCurrentLang && window.getCurrentLang() === 'en' ? 'Refresh' : 'Yenile');
            }, 500);
        }
    }

    if (btnText && current < total) {
        btnText.textContent = `${current}/${total}`;
    }
}

// ─── Stock name lookup ────────────────────────────────────────────────────────
export function getStockName(symbol) {
    const names = {
        'DOAS':  'Doğan Şirketler Grubu',
        'ALTNY': 'Altyn Gold',
        'ALARK': 'Alarko Holding',
        'ASELS': 'Aselsan',
        'ASTOR': 'Astor Enerji',
        'FROTO': 'Ford Otosan',
        'ISMEN': 'İskur Enerji',
        'KLSER': 'Kaleseramik',
        'EREGL': 'Ereğli Demir ve Çelik',
        'KONTR': 'Kontrolmatik',
        'MIATK': 'Miatk Holding',
        'TUPRS': 'Tüpraş',
        'SASA':  'Sasa Polyester',
        'EGPRO': 'Ege Profil',
        'THYAO': 'Türk Hava Yolları'
    };
    return names[symbol] || symbol;
}

// ─── Row rendering ────────────────────────────────────────────────────────────
export function renderRow(symbol, data, status = 'success') {
    const stocksContainer = document.getElementById('stocksData');
    if (!stocksContainer) return;

    const cleanSymbol = symbol.replace('.IS', '');
    const price      = data?.regularMarketPrice         || 0;
    const prevClose  = data?.regularMarketPreviousClose || 0;
    const volume     = data?.regularMarketVolume        || 0;
    const change     = price - prevClose;
    const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

    let changeClass = 'neutral';
    if (change > 0)      changeClass = 'change-positive';
    else if (change < 0) changeClass = 'change-negative';

    const stockName       = getStockName(cleanSymbol);
    const escapedSymbol   = escapeHtml(cleanSymbol);
    const escapedStockName = escapeHtml(stockName);
    const escapedFullSym  = escapeHtml(symbol);

    const rowHTML = `
        <tr data-symbol="${escapedFullSym}">
            <td>
                <div class="stock-info">
                    <span class="symbol">${escapedSymbol}</span>
                    <span class="name">${escapedStockName}</span>
                </div>
            </td>
            <td class="price-cell" style="text-align:right;">${price ? price.toFixed(2) + ' ₺' : '-'}</td>
            <td style="text-align:right;">${prevClose ? prevClose.toFixed(2) + ' ₺' : '-'}</td>
            <td class="${changeClass}" style="text-align:right;">${change > 0 ? '+' : ''}${change.toFixed(2)} ₺</td>
            <td class="${changeClass}" style="text-align:right;">${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%</td>
            <td class="volume-cell" style="text-align:right;">${formatVolume(volume)}</td>
            <td style="text-align:center;">
                <button class="chart-icon" aria-label="${window.t ? window.t('tbl.chart') : 'Grafik göster'}" data-symbol="${escapedFullSym}" data-clean-symbol="${escapedSymbol}" title="${window.t ? window.t('tbl.chart') : 'Grafik göster'}">📈</button>
            </td>
            <td style="text-align:center;">
                <button class="add-portfolio-btn" aria-label="${window.t ? window.t('tbl.portfolio') : 'Portföye ekle'}" data-symbol="${escapedFullSym}" title="${window.t ? window.t('tbl.portfolio') : 'Portföye ekle'}">+</button>
            </td>
        </tr>
    `;

    const existingRow = stocksContainer.querySelector(`[data-symbol="${escapedFullSym}"]`);
    if (existingRow) {
        existingRow.outerHTML = rowHTML;
    } else {
        stocksContainer.insertAdjacentHTML('beforeend', rowHTML);
    }
}

// Internal alias used by retryStock
function updateRowBySymbol(symbol, data, status) {
    renderRow(symbol, data, status);
}

// ─── API fetching ─────────────────────────────────────────────────────────────
export async function fetchStock(symbol) {
    try {
        const response = await createApiRequest(`/api/stocks/quote/${symbol}`);
        return await handleApiResponse(response);
    } catch (error) {
        console.error(`Error fetching stock ${symbol}:`, error);
        return null;
    }
}

export async function fetchAllStocks() {
    if (isLoading) return;

    isLoading = true;
    updateStatus('loading', window.t ? window.t('status.loading') : 'Veriler yükleniyor...');

    try {
        const response = await createApiRequest('/api/stocks');
        const stocksData = await handleApiResponse(response);

        if (!Array.isArray(stocksData)) throw new Error('Invalid data format received');

        const stocksContainer = safeGetElementById('stocksData');
        if (stocksContainer) stocksContainer.textContent = '';

        let processedCount = 0;
        const totalStocks = stocksData.length;

        for (const stock of stocksData) {
            if (stock && stock.symbol) {
                renderRow(stock.symbol, stock.data || stock);
                processedCount++;
                updateProgress(processedCount, totalStocks);

                if (processedCount < totalStocks) {
                    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
                }
            }
        }

        updateStatus('success', window.t ? window.t('status.updated') : 'Veriler güncellendi');
        showDataUpdateAnimation('stocksData');

        if (window.refreshSorting) window.refreshSorting();

    } catch (error) {
        console.error('Error fetching all stocks:', error);
        updateStatus('error', window.t ? window.t('status.error') : 'Veri yükleme hatası');
        showErrorMessage('Hisse verileri yüklenirken hata oluştu: ' + error.message);
    } finally {
        isLoading = false;
    }
}

// Retry handler — called from inline onclick attributes
window.retryStock = async function(symbol) {
    try {
        const data = await fetchStock(symbol);
        updateRowBySymbol(symbol, data, 'success');
        showSuccessMessage(`${symbol} güncellendi`);
    } catch (error) {
        showErrorMessage(`${symbol} güncellenemedi`);
    }
};
