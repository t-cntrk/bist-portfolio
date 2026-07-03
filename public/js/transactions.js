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
import { formatNumber } from './formatters.js';

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

export async function renderTransactions() {
    const tbody = document.getElementById('transactionHistoryBody');
    if (!tbody) return;

    const rows = await fetchTransactions();

    if (rows.length === 0) {
        const empty = window.t ? window.t('tx.empty') : 'Henüz işlem bulunmuyor';
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:28px;color:rgba(255,255,255,0.5);">${escapeHtml(empty)}</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map((tx) => {
        const typeLabel = (TX_TYPE_LABELS[tx.transaction_type] || (() => escapeHtml(tx.transaction_type || '')))();
        const symbol = escapeHtml(String(tx.symbol || '').replace('.IS', ''));
        const qty = formatNumber(Number(tx.quantity) || 0, 2);
        const unit = formatNumber(Number(tx.unit_price) || 0, 2);
        const total = formatNumber(Number(tx.total_amount) || 0, 2);
        const typeClass = tx.transaction_type === 'sell' ? 'change-negative' : 'change-positive';
        return `
            <tr>
                <td>${formatTxDate(tx.created_at)}</td>
                <td>${symbol}</td>
                <td class="${typeClass}">${escapeHtml(typeLabel)}</td>
                <td>${qty}</td>
                <td>${unit} ₺</td>
                <td>${total} ₺</td>
            </tr>`;
    }).join('');
}

// Global hook so renderUnifiedPortfolio can refresh history without importing this module.
window.renderTransactions = renderTransactions;
