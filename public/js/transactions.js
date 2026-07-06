/**
 * transactions.js — renders the user's transaction history (append-only ledger)
 * from GET /api/portfolio/transactions into #transactionHistoryBody.
 *
 * Kept intentionally read-only and self-contained: the portfolio summary/render
 * flow is untouched. renderTransactions() is called from renderUnifiedPortfolio
 * (via window.renderTransactions) so history stays in sync with the portfolio.
 */
import { createApiRequest, handleApiResponse } from './api.js';
import { escapeHtml } from './dom-helpers.js';
import { formatNumber, formatTRY } from './formatters.js';

const TX_TYPE_LABELS = {
    buy: () => (window.t ? window.t('tx.buy') : 'Alış'),
    sell: () => (window.t ? window.t('tx.sell') : 'Satış')
};

// SQLite stores created_at as UTC "YYYY-MM-DD HH:MM:SS"; render it in local time.
function formatTxDate(createdAt) {
    if (!createdAt) return '-';
    const d = new Date(String(createdAt).replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) return escapeHtml(String(createdAt));
    return d.toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

export async function fetchTransactions() {
    try {
        const response = await createApiRequest('/api/portfolio/transactions');
        const data = await handleApiResponse(response);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('Error fetching transactions:', error);
        return [];
    }
}

// Currency symbol for a ledger row. Amounts are stored in the transaction's own
// currency (TRY for everything except USD-quoted GC=F).
function currencySign(currency) {
    return currency === 'USD' ? '$' : '₺';
}

// Signed, colored realized-P/L cell content for a sell row; buys show a dash.
function realizedCellHTML(tx) {
    const pl = tx.realized_pl;
    if (tx.transaction_type !== 'sell' || pl == null || isNaN(Number(pl))) {
        return '<td style="color:rgba(255,255,255,0.35);">—</td>';
    }
    const value = Number(pl);
    const cls = value > 0 ? 'profit' : (value < 0 ? 'loss' : 'neutral');
    const sign = value > 0 ? '+' : '';
    return `<td class="${cls}">${sign}${formatNumber(value, 2)} ${currencySign(tx.currency)}</td>`;
}

// Aggregate realized P/L across TRY-denominated sells, shown in the history
// header. Non-TRY sells (currently only GC=F/USD) are excluded rather than
// summed across currencies; hidden entirely until at least one sell exists.
// Returns the TRY realized total (0 when no TRY sells) so Total Return can reuse it.
function updateRealizedTotal(rows) {
    const container = document.getElementById('txRealizedTotal');
    const valueEl = document.getElementById('txRealizedTotalValue');

    const sells = rows.filter(tx =>
        tx.transaction_type === 'sell' &&
        tx.realized_pl != null && !isNaN(Number(tx.realized_pl)) &&
        (!tx.currency || tx.currency === 'TRY')
    );
    const total = sells.reduce((sum, tx) => sum + Number(tx.realized_pl), 0);

    if (!container || !valueEl) return total;

    if (sells.length === 0) {
        container.style.display = 'none';
        return total;
    }
    const sign = total > 0 ? '+' : '';
    valueEl.textContent = `${sign}${formatNumber(total, 2)} ₺`;
    valueEl.className = total > 0 ? 'profit' : (total < 0 ? 'loss' : 'neutral');
    container.style.display = '';
    return total;
}

// Total Return = Unrealized P/L (passed in by renderUnifiedPortfolio, always TRY)
// + Realized P/L (TRY sells only). Both inputs are TRY-denominated, so the total
// never mixes currencies. Always visible: equals the unrealized figure when no
// realized sells exist.
function updateTotalReturn(unrealizedPL, realizedTotalTRY) {
    const card = document.getElementById('newTotalReturnCard');
    const valueEl = document.getElementById('newTotalReturn');
    if (!valueEl) return;

    const total = (Number(unrealizedPL) || 0) + (Number(realizedTotalTRY) || 0);

    const profitClass = total >= 0 ? 'profit' : 'loss';
    const sign = total >= 0 ? '+' : '';
    valueEl.innerHTML = `<strong>${sign}${escapeHtml(formatTRY(total))}</strong>`;
    if (card) card.className = `new-summary-card total-return-card ${profitClass}`;
}

// unrealizedPL is passed by renderUnifiedPortfolio (its only caller) so Total
// Return can combine it with the realized total computed here.
export async function renderTransactions(unrealizedPL = 0) {
    const tbody = document.getElementById('transactionHistoryBody');
    if (!tbody) return;

    const rows = await fetchTransactions();
    const realizedTotalTRY = updateRealizedTotal(rows);
    updateTotalReturn(unrealizedPL, realizedTotalTRY);

    if (rows.length === 0) {
        const empty = window.t ? window.t('tx.empty') : 'Henüz işlem bulunmuyor';
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:28px;color:rgba(255,255,255,0.5);">${escapeHtml(empty)}</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map((tx) => {
        const typeLabel = (TX_TYPE_LABELS[tx.transaction_type] || (() => escapeHtml(tx.transaction_type || '')))();
        const symbol = escapeHtml(String(tx.symbol || '').replace('.IS', ''));
        const qty = formatNumber(Number(tx.quantity) || 0, 2);
        const unit = formatNumber(Number(tx.unit_price) || 0, 2);
        const total = formatNumber(Number(tx.total_amount) || 0, 2);
        const typeClass = tx.transaction_type === 'sell' ? 'change-negative' : 'change-positive';
        const money = currencySign(tx.currency);
        return `
            <tr>
                <td>${formatTxDate(tx.created_at)}</td>
                <td>${symbol}</td>
                <td class="${typeClass}">${escapeHtml(typeLabel)}</td>
                <td>${qty}</td>
                <td>${unit} ${money}</td>
                <td>${total} ${money}</td>
                ${realizedCellHTML(tx)}
            </tr>`;
    }).join('');
}

// Global hook so renderUnifiedPortfolio can refresh history without importing this module.
window.renderTransactions = renderTransactions;
