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

// ─── Client-side filtering ────────────────────────────────────────────────────
// The endpoint returns the full ledger and we already hold every row in memory,
// so filtering is a pure in-memory view — no extra request. Aggregates (realized
// total, Total Return) are always computed over the FULL set, never the filtered
// view. txFilter maps 1:1 to future query params (?type=&symbol=&page=), so
// server-side filtering / pagination can later replace the data source without
// touching these controls or their handlers.
let allTransactions = [];
const txFilter = { type: 'all', symbol: 'all' };
let filtersBound = false;

function applyTxFilters(rows) {
    return rows.filter(tx => {
        if (txFilter.type !== 'all' && tx.transaction_type !== txFilter.type) return false;
        if (txFilter.symbol !== 'all' && tx.symbol !== txFilter.symbol) return false;
        return true;
    });
}

// Rebuild the symbol dropdown from the distinct symbols in the ledger (append-only,
// so the set only grows). Preserves the current selection across auto-refreshes and
// only rewrites the options when the set actually changed.
function populateSymbolFilter(rows) {
    const select = document.getElementById('txSymbolFilter');
    if (!select) return;

    const symbols = [...new Set(rows.map(tx => tx.symbol).filter(Boolean))].sort();
    const allLabel = window.t ? window.t('tx.filterAllSymbols') : 'Tüm Varlıklar';

    const existing = [...select.options].slice(1).map(o => o.value);
    const changed = existing.length !== symbols.length ||
        symbols.some((s, i) => s !== existing[i]);
    if (changed) {
        const opts = [`<option value="all" data-i18n="tx.filterAllSymbols">${escapeHtml(allLabel)}</option>`];
        for (const sym of symbols) {
            opts.push(`<option value="${escapeHtml(sym)}">${escapeHtml(String(sym).replace('.IS', ''))}</option>`);
        }
        select.innerHTML = opts.join('');
    } else if (select.options[0]) {
        select.options[0].textContent = allLabel; // keep "all" label in sync with language
    }

    // Append-only ledger means a selected symbol never vanishes, but guard anyway.
    if (txFilter.symbol !== 'all' && !symbols.includes(txFilter.symbol)) txFilter.symbol = 'all';
    select.value = txFilter.symbol;
}

function txRowHTML(tx) {
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
}

function emptyRow(messageKey, fallback) {
    const msg = window.t ? window.t(messageKey) : fallback;
    return `<tr><td colspan="7" style="text-align:center;padding:28px;color:rgba(255,255,255,0.5);">${escapeHtml(msg)}</td></tr>`;
}

// Render the tbody from the current filter view over the cached ledger.
// Distinguishes "no transactions at all" from "none match the active filter".
function renderTransactionRows() {
    const tbody = document.getElementById('transactionHistoryBody');
    if (!tbody) return;

    if (allTransactions.length === 0) {
        tbody.innerHTML = emptyRow('tx.empty', 'Henüz işlem bulunmuyor');
        return;
    }
    const view = applyTxFilters(allTransactions);
    if (view.length === 0) {
        tbody.innerHTML = emptyRow('tx.noMatch', 'Eşleşen işlem bulunmuyor');
        return;
    }
    tbody.innerHTML = view.map(txRowHTML).join('');
}

// Bind filter controls once: one delegated listener on the type-button group plus
// a change listener on the symbol select. Both only re-render the cached view —
// no re-fetch, aggregates untouched. DOM is static (module scripts are deferred),
// so binding on first render is safe.
function ensureFiltersBound() {
    if (filtersBound) return;
    const container = document.getElementById('txFilters');
    if (!container) return;

    const group = container.querySelector('.tx-filter-group');
    if (group) {
        group.addEventListener('click', (e) => {
            const btn = e.target.closest('.tx-filter-btn');
            if (!btn || !group.contains(btn)) return;
            const type = btn.dataset.txtype || 'all';
            if (type === txFilter.type) return;
            txFilter.type = type;
            group.querySelectorAll('.tx-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
            renderTransactionRows();
        });
    }

    const select = document.getElementById('txSymbolFilter');
    if (select) {
        select.addEventListener('change', () => {
            txFilter.symbol = select.value || 'all';
            renderTransactionRows();
        });
    }
    filtersBound = true;
}

// unrealizedPL is passed by renderUnifiedPortfolio (its only caller) so Total
// Return can combine it with the realized total computed here. Aggregates run
// over the full ledger; only the table body reflects the active filter.
export async function renderTransactions(unrealizedPL = 0) {
    const tbody = document.getElementById('transactionHistoryBody');
    if (!tbody) return;

    allTransactions = await fetchTransactions();
    const realizedTotalTRY = updateRealizedTotal(allTransactions);
    updateTotalReturn(unrealizedPL, realizedTotalTRY);

    ensureFiltersBound();
    populateSymbolFilter(allTransactions);
    renderTransactionRows();
}

// Global hook so renderUnifiedPortfolio can refresh history without importing this module.
window.renderTransactions = renderTransactions;
