/**
 * transaction-schema.js — the single source of truth for the transaction→export
 * schema, shared by every export format (CSV today, Excel too).
 *
 * Each column carries:
 *   - header: the column title (also the Excel/CSV header text)
 *   - type:   a format hint consumers may act on ('date' | 'text' | 'quantity' |
 *             'money' | 'realized'); CSV ignores it, Excel uses it for number
 *             formats and P/L colouring.
 *   - get(tx): the RAW typed value for one ledger row — a Number for numeric
 *             columns, a String for text/date, or '' when the cell is blank.
 *             Numbers are returned raw (not locale-formatted) so Excel stores
 *             real numbers and CSV can emit dot-decimals; keeping the canonical
 *             symbol/currency means the file round-trips for a future import.
 *
 * No DOM, no imports — safe to load in the browser and in Node (tests/exports).
 */

// Raw numeric value for a column, or '' when missing/NaN so the cell stays blank.
function num(value) {
    if (value == null || value === '' || isNaN(Number(value))) return '';
    return Number(value);
}

// Realized P/L is a real number only on sells that carry one; blank otherwise
// (buys, or a sell without a computed figure), per the export spec.
function realized(tx) {
    if (tx.transaction_type === 'sell' && tx.realized_pl != null && !isNaN(Number(tx.realized_pl))) {
        return Number(tx.realized_pl);
    }
    return '';
}

export const TX_EXPORT_COLUMNS = [
    // executed_at is the real trade time; older rows/endpoints may omit it, so
    // fall back to created_at (identical for every non-imported row).
    { header: 'Executed Date', type: 'date', get: (tx) => tx.executed_at || tx.created_at || '' },
    { header: 'Symbol', type: 'text', get: (tx) => tx.symbol || '' },
    { header: 'Transaction Type', type: 'text', get: (tx) => tx.transaction_type || '' },
    { header: 'Quantity', type: 'quantity', get: (tx) => num(tx.quantity) },
    { header: 'Unit Price', type: 'money', get: (tx) => num(tx.unit_price) },
    { header: 'Total Amount', type: 'money', get: (tx) => num(tx.total_amount) },
    { header: 'Currency', type: 'text', get: (tx) => tx.currency || 'TRY' },
    { header: 'Realized P/L', type: 'realized', get: realized }
];
