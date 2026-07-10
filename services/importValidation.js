/**
 * importValidation.js — pure validation + normalization for CSV transaction import.
 *
 * No DB, no I/O: it takes the client-parsed rows, validates every field, and
 * returns either the full list of errors (whole file rejected) or the normalized
 * rows sorted chronologically by executed_at — ready for the controller to replay
 * through the existing buy/sell logic. Keeping this pure makes it directly unit
 * testable and keeps the replay path (which does touch the DB) small.
 */

// Same character whitelist the add/sell routes enforce on `symbol`, so an
// imported symbol can never carry markup and matches what the app already stores.
const SYMBOL_RE = /^[A-Za-z0-9.=^/&#;_-]+$/;

// Upper bound on rows per import. Keeps a single request comfortably under the
// 1 MB JSON body limit and bounds the replay work.
const MAX_ROWS = 2000;

// Field bounds mirror the route validators (addAssetValidation / sellAssetValidation).
const QTY_MIN = 0.0001, QTY_MAX = 1e9;
const PRICE_MIN = 0.01, PRICE_MAX = 1e9;

// The app holds BIST equities (".IS") and FX/gold instruments. Export omits the
// internal asset_type, so infer it: equities carry the exchange suffix, every
// other instrument on the platform (USDTRY=X, GC=F, XAUTRY=X, ...) is FX. This
// mirrors how the frontend splits stock vs fx positions.
function inferAssetType(symbol) {
    return String(symbol).toUpperCase().endsWith('.IS') ? 'stock' : 'fx';
}

// Parse an executed_at string to a sortable timestamp. Accepts the export format
// "YYYY-MM-DD HH:MM:SS" (treated as UTC, matching how it was written) and ISO 8601.
// Returns { ms, value } or null when unparseable.
function parseExecutedAt(raw) {
    if (typeof raw !== 'string') return null;
    const s = raw.trim();
    if (!s) return null;
    // "YYYY-MM-DD HH:MM:SS" → ISO-ish; append Z so the space form is read as UTC.
    const spaceForm = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/;
    const iso = spaceForm.test(s) ? s.replace(' ', 'T') + 'Z' : s;
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return null;
    return { ms, value: s };
}

// Canonical key identifying a transaction for the "looks like a duplicate" check,
// built from the same five fields the user cares about: executed_at, symbol,
// transaction_type, quantity, unit_price. Timestamps are compared by parsed value
// (so the space-form and ISO-form of the same instant collide) and numbers by
// numeric value (so "10" and "10.0" collide). This is a preview-only heuristic —
// import performs no deduplication.
function transactionKey({ executedAt, symbol, transactionType, quantity, unitPrice }) {
    const when = parseExecutedAt(executedAt);
    const ms = when ? when.ms : String(executedAt).trim();
    return [
        ms,
        String(symbol).trim().toUpperCase(),
        String(transactionType).trim().toLowerCase(),
        Number(quantity),
        Number(unitPrice)
    ].join('|');
}

/**
 * Count how many of the normalized import rows already exist in the user's ledger.
 * A lightweight heuristic that powers the preview's duplicate warning; it never
 * blocks or removes rows — the user can acknowledge and import anyway.
 * @param {Array} normalized  rows from validateImportRows (executedAt/symbol/…)
 * @param {Array} existing    ledger rows { executed_at, symbol, transaction_type,
 *                            quantity, unit_price }
 * @returns {number} how many import rows match an existing ledger entry
 */
function countDuplicateRows(normalized, existing) {
    const seen = new Set((existing || []).map(e => transactionKey({
        executedAt: e.executed_at,
        symbol: e.symbol,
        transactionType: e.transaction_type,
        quantity: e.quantity,
        unitPrice: e.unit_price
    })));
    let duplicates = 0;
    for (const r of (normalized || [])) {
        if (seen.has(transactionKey(r))) duplicates++;
    }
    return duplicates;
}

/**
 * Validate the entire set of client-parsed rows.
 * @param {Array<{executedAt,symbol,transactionType,quantity,unitPrice}>} rows
 * @returns {{valid:boolean, errors:Array<{row:number,message:string}>, normalized:Array}}
 *   On any error, `valid` is false and `normalized` is empty (nothing imported).
 */
function validateImportRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return { valid: false, errors: [{ row: 0, message: 'Boş veya geçersiz veri' }], normalized: [] };
    }
    if (rows.length > MAX_ROWS) {
        return { valid: false, errors: [{ row: 0, message: `Çok fazla satır (en fazla ${MAX_ROWS})` }], normalized: [] };
    }

    const errors = [];
    const normalized = [];

    rows.forEach((r, idx) => {
        const rowNum = idx + 1; // 1-based, matches the data row (excludes header)
        const symbol = typeof r.symbol === 'string' ? r.symbol.trim() : '';
        const txType = String(r.transactionType || '').trim().toLowerCase();
        const qty = Number(r.quantity);
        const price = Number(r.unitPrice);
        const when = parseExecutedAt(r.executedAt);

        let rowOk = true;
        if (!symbol) { errors.push({ row: rowNum, message: 'Sembol boş' }); rowOk = false; }
        else if (symbol.length > 50 || !SYMBOL_RE.test(symbol)) { errors.push({ row: rowNum, message: `Geçersiz sembol: ${symbol}` }); rowOk = false; }

        if (txType !== 'buy' && txType !== 'sell') { errors.push({ row: rowNum, message: `Geçersiz işlem türü: ${r.transactionType}` }); rowOk = false; }
        if (!Number.isFinite(qty) || qty < QTY_MIN || qty > QTY_MAX) { errors.push({ row: rowNum, message: 'Geçersiz miktar' }); rowOk = false; }
        if (!Number.isFinite(price) || price < PRICE_MIN || price > PRICE_MAX) { errors.push({ row: rowNum, message: 'Geçersiz birim fiyat' }); rowOk = false; }
        if (!when) { errors.push({ row: rowNum, message: 'Geçersiz tarih' }); rowOk = false; }

        if (rowOk) {
            normalized.push({
                index: idx,
                executedAt: when.value,
                sortKey: when.ms,
                symbol,
                type: inferAssetType(symbol),
                transactionType: txType,
                quantity: qty,
                unitPrice: price
            });
        }
    });

    if (errors.length > 0) {
        return { valid: false, errors, normalized: [] };
    }

    // Replay in trade order: chronological by executed_at, stable on original index.
    normalized.sort((a, b) => a.sortKey - b.sortKey || a.index - b.index);
    return { valid: true, errors: [], normalized };
}

module.exports = { validateImportRows, inferAssetType, parseExecutedAt, countDuplicateRows, MAX_ROWS };
