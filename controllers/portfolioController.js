const { getConnection } = require('../services/databaseService');
const { validateImportRows, countDuplicateRows } = require('../services/importValidation');

// Currency of a transaction's monetary amounts (unit_price, total_amount),
// resolved from the symbol at write time and then stored immutably on the ledger
// row. Rather than one per-symbol table that grows with every ticker, we resolve
// through progressively more specific rules so each asset class is handled where
// its currency actually lives:
//
//   1. Forex pair "XXXYYY=X" → the quote currency is the trailing 3 letters (a
//      pair's price is expressed in its second currency). USDTRY=X→TRY,
//      EURUSD=X→USD, gram-gold XAUTRY=X→TRY. Scales to any pair, zero upkeep.
//   2. Crypto / dashed pair "BASE-QUOTE" → the currency after the dash.
//      BTC-USD→USD, ETH-EUR→EUR. Scales to any pair, zero upkeep.
//   3. Exchange suffix → that market's currency. One entry per *exchange*, not
//      per ticker, so a whole market is one line. THYAO.IS→TRY.
//   4. Explicit overrides for irregular symbols with no exploitable pattern —
//      chiefly commodity/futures roots. GC=F (COMEX gold)→USD.
//   5. Default: TRY, this platform's home currency.
//
// So the combinatorial classes (forex, crypto) cost nothing as they grow, a new
// equity market costs one suffix entry, and only genuinely irregular instruments
// need a per-symbol line — which for commodities is the correct representation.
const EXCHANGE_SUFFIX_CURRENCY = { '.IS': 'TRY' }; // Borsa İstanbul
const SYMBOL_CURRENCY_OVERRIDES = { 'GC=F': 'USD' }; // COMEX gold futures

const getTransactionCurrency = (rawSymbol) => {
    const symbol = String(rawSymbol || '').toUpperCase();

    // 1. Forex pair, e.g. USDTRY=X → TRY
    const fxPair = symbol.match(/^[A-Z]{3}([A-Z]{3})=X$/);
    if (fxPair) return fxPair[1];

    // 2. Crypto / dashed pair, e.g. BTC-USD → USD
    const dashedPair = symbol.match(/-([A-Z]{3,4})$/);
    if (dashedPair) return dashedPair[1];

    // 3. Exchange suffix, e.g. THYAO.IS → TRY
    const dot = symbol.lastIndexOf('.');
    if (dot !== -1 && EXCHANGE_SUFFIX_CURRENCY[symbol.slice(dot)]) {
        return EXCHANGE_SUFFIX_CURRENCY[symbol.slice(dot)];
    }

    // 4. Irregular per-symbol overrides (commodities / futures)
    if (SYMBOL_CURRENCY_OVERRIDES[symbol]) return SYMBOL_CURRENCY_OVERRIDES[symbol];

    // 5. Platform default
    return 'TRY';
};

// ─── Promisified DB helpers + shared buy/sell operations ──────────────────────
// The weighted-average accounting, oversell rules and realized-P/L math live here
// ONCE, so both the HTTP handlers (addAsset/sellAsset) and the CSV import replay
// use the exact same logic — import never bypasses or re-implements it.
const dbGet = (db, sql, params = []) => new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))));
const dbAll = (db, sql, params = []) => new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));
const dbRun = (db, sql, params = []) => new Promise((resolve, reject) =>
    db.run(sql, params, function (err) { return err ? reject(err) : resolve(this); }));

// A business-rule failure carrying the HTTP status the caller should surface.
class BusinessError extends Error {
    constructor(status, message) { super(message); this.name = 'BusinessError'; this.status = status; }
}

const SELL_EPS = 1e-9;

// Merge a buy into an existing position (summing quantity, recomputing the
// weighted-average cost) or open a new position. Returns the same result shape
// the add endpoint has always returned.
async function mergeOrInsertPosition(db, userId, { symbol, quantity, purchase, type }) {
    const existing = await dbGet(db,
        'SELECT id, quantity, purchase_price FROM portfolios WHERE user_id = ? AND symbol = ? AND type = ?',
        [userId, symbol, type]);

    if (existing) {
        const totalQuantity = existing.quantity + quantity;
        const avgPrice = ((existing.purchase_price * existing.quantity) + (purchase * quantity)) / totalQuantity;
        await dbRun(db, 'UPDATE portfolios SET quantity = ?, purchase_price = ? WHERE id = ? AND user_id = ?',
            [totalQuantity, avgPrice, existing.id, userId]);
        return { id: existing.id, merged: true, quantity: totalQuantity, purchase_price: avgPrice };
    }

    try {
        const r = await dbRun(db,
            'INSERT INTO portfolios (user_id, symbol, quantity, purchase_price, type) VALUES (?, ?, ?, ?, ?)',
            [userId, symbol, quantity, purchase, type]);
        return { id: r.lastID };
    } catch (err) {
        // UNIQUE index guards against a concurrent insert racing the lookup above.
        if (err && err.code === 'SQLITE_CONSTRAINT') {
            throw new BusinessError(409, 'Bu varlık az önce eklendi, lütfen tekrar deneyin');
        }
        throw err;
    }
}

// Append an immutable BUY row to the ledger (this buy's own quantity/price).
function insertBuyLedger(db, { userId, symbol, type, quantity, purchase, executedAt }) {
    return dbRun(db,
        `INSERT INTO transactions
            (user_id, symbol, asset_type, transaction_type, quantity, unit_price, total_amount, currency, created_at, executed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, COALESCE(?, CURRENT_TIMESTAMP))`,
        [userId, symbol, type, 'buy', quantity, purchase, quantity * purchase, getTransactionCurrency(symbol), executedAt || null]);
}

// Apply a sell to a position: enforces "must be held" and "cannot oversell",
// crystallizes realized P/L against the fixed average cost (never recomputed),
// and updates or removes the position. Returns the position result plus the
// realized figures for the ledger row.
async function applySellPosition(db, userId, { symbol, quantity, price, type }) {
    const position = await dbGet(db,
        'SELECT id, quantity, purchase_price FROM portfolios WHERE user_id = ? AND symbol = ? AND type = ?',
        [userId, symbol, type]);

    if (!position) throw new BusinessError(404, 'Satılacak varlık portföyünüzde bulunamadı');
    if (quantity > position.quantity + SELL_EPS) {
        throw new BusinessError(400, `Sahip olduğunuzdan fazlasını satamazsınız (mevcut miktar: ${position.quantity})`);
    }

    const avgCost = position.purchase_price;
    const proceeds = quantity * price;
    const realizedPl = quantity * (price - avgCost);
    const remaining = position.quantity - quantity;
    const fullSell = remaining <= SELL_EPS;

    if (fullSell) {
        const r = await dbRun(db, 'DELETE FROM portfolios WHERE id = ? AND user_id = ? AND quantity >= ?',
            [position.id, userId, quantity - SELL_EPS]);
        if (r.changes === 0) throw new BusinessError(409, 'Pozisyon değişti, lütfen tekrar deneyin');
        return { positionResult: { id: position.id, sold: quantity, remaining: 0, closed: true, realized_pl: realizedPl, purchase_price: avgCost }, realizedPl, proceeds };
    }

    const r = await dbRun(db, 'UPDATE portfolios SET quantity = quantity - ? WHERE id = ? AND user_id = ? AND quantity >= ?',
        [quantity, position.id, userId, quantity]);
    if (r.changes === 0) throw new BusinessError(409, 'Pozisyon değişti, lütfen tekrar deneyin');
    return { positionResult: { id: position.id, sold: quantity, remaining, closed: false, realized_pl: realizedPl, purchase_price: avgCost }, realizedPl, proceeds };
}

// Append an immutable SELL row to the ledger, with the crystallized realized P/L.
function insertSellLedger(db, { userId, symbol, type, quantity, price, proceeds, realizedPl, executedAt }) {
    return dbRun(db,
        `INSERT INTO transactions
            (user_id, symbol, asset_type, transaction_type, quantity, unit_price, total_amount, currency, realized_pl, created_at, executed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, COALESCE(?, CURRENT_TIMESTAMP))`,
        [userId, symbol, type, 'sell', quantity, price, proceeds, getTransactionCurrency(symbol), realizedPl, executedAt || null]);
}

// @desc    Get user's complete portfolio
// @route   GET /api/portfolio
exports.getPortfolio = (req, res) => {
    const db = getConnection();
    const userId = req.user.id; // Decoded from JWT in middleware

    // SQL to fetch user's assets
    const sql = 'SELECT id, symbol, quantity, purchase_price, type FROM portfolios WHERE user_id = ?';
    
    db.all(sql, [userId], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Portföy verileri alınamadı' });
        }
        res.json(rows);
    });
};

// @desc    Add a new asset to user's portfolio
// @route   POST /api/portfolio
// Thin wrapper over the shared position/ledger operations. Buying more of a held
// asset merges into it (weighted-average). A ledger failure is logged but doesn't
// fail the buy — the position summary the UI reads is already updated.
exports.addAsset = async (req, res) => {
    const { symbol, quantity, purchase } = req.body;
    const type = req.body.type || 'stock';
    const userId = req.user.id;
    const db = getConnection();

    // executed_at is the actual trade time. Normal buys don't send one, so it
    // falls back (via COALESCE) to CURRENT_TIMESTAMP. The import path passes an
    // explicit ISO trade time here without ever touching created_at.
    const executedAt = (typeof req.body.executedAt === 'string' && req.body.executedAt.trim())
        ? req.body.executedAt.trim()
        : null;

    try {
        const positionResult = await mergeOrInsertPosition(db, userId, { symbol, quantity, purchase, type });
        try {
            await insertBuyLedger(db, { userId, symbol, type, quantity, purchase, executedAt });
        } catch (txErr) {
            console.error('Transaction ledger insert error:', txErr);
        }
        return res.json(positionResult);
    } catch (err) {
        if (err instanceof BusinessError) return res.status(err.status).json({ message: err.message });
        console.error('Portfolio add error:', err);
        return res.status(500).json({ message: 'Portföy eklenemedi' });
    }
};

// @desc    Sell part or all of an existing position
// @route   POST /api/portfolio/sell
// Thin wrapper over applySellPosition (oversell rules + realized-P/L math) and the
// ledger append. Mirrors addAsset: a ledger failure is logged but doesn't fail the
// request, since the position is already updated.
exports.sellAsset = async (req, res) => {
    const { symbol, quantity, price } = req.body;
    const type = req.body.type || 'stock';
    const userId = req.user.id;
    const db = getConnection();

    const executedAt = (typeof req.body.executedAt === 'string' && req.body.executedAt.trim())
        ? req.body.executedAt.trim()
        : null;

    try {
        const { positionResult, realizedPl, proceeds } = await applySellPosition(db, userId, { symbol, quantity, price, type });
        try {
            await insertSellLedger(db, { userId, symbol, type, quantity, price, proceeds, realizedPl, executedAt });
        } catch (txErr) {
            console.error('Sell ledger insert error:', txErr);
        }
        return res.json(positionResult);
    } catch (err) {
        if (err instanceof BusinessError) return res.status(err.status).json({ message: err.message });
        console.error('Sell error:', err);
        return res.status(500).json({ message: 'Satış işlemi başarısız' });
    }
};

// @desc    Get the user's transaction history (append-only ledger)
// @route   GET /api/portfolio/transactions?symbol=OPTIONAL
exports.getTransactions = (req, res) => {
    const db = getConnection();
    const userId = req.user.id;
    const symbol = req.query.symbol;

    // Newest first. Optional symbol filter supports future per-asset views.
    // realized_pl is included so history can show the P/L crystallized by sells
    // (NULL for buys); currency lets the client label amounts honestly instead
    // of assuming TRY (GC=F sells are USD-denominated). executed_at (the real
    // trade time) is exposed for CSV export; it equals created_at for every
    // non-imported row and is ignored by the history renderer.
    let sql = 'SELECT id, symbol, asset_type, transaction_type, quantity, unit_price, total_amount, realized_pl, currency, created_at, executed_at FROM transactions WHERE user_id = ?';
    const params = [userId];
    if (symbol) {
        sql += ' AND symbol = ?';
        params.push(symbol);
    }
    sql += ' ORDER BY created_at DESC, id DESC';

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Transaction history error:', err);
            return res.status(500).json({ message: 'İşlem geçmişi alınamadı' });
        }
        res.json(rows);
    });
};
// Serialize imports so one file's BEGIN…COMMIT transaction cannot interleave with
// another import on the shared single connection. A tiny promise-chain mutex.
let importLock = Promise.resolve();
function acquireImportLock() {
    let release;
    const prev = importLock;
    importLock = new Promise((resolve) => { release = resolve; });
    return prev.then(() => release);
}

// @desc    Validate + import a CSV transaction history, replaying each row through
//          the SAME buy/sell logic in chronological (executed_at) order.
// @route   POST /api/portfolio/import   body: { rows: [...], confirm: boolean }
// The whole file is validated first (nothing partial). With confirm !== true the
// replay runs inside a transaction that is ROLLED BACK — a dry run that returns a
// preview of the outcome. With confirm === true the transaction is COMMITTED. Any
// business failure (e.g. overselling) rolls everything back: import is all-or-nothing.
exports.importTransactions = async (req, res) => {
    const db = getConnection();
    const userId = req.user.id;
    const confirm = !!(req.body && req.body.confirm === true);

    const { valid, errors, normalized } = validateImportRows(req.body && req.body.rows);
    if (!valid) {
        return res.status(400).json({ message: 'CSV doğrulaması başarısız', valid: false, errors });
    }

    const release = await acquireImportLock();
    try {
        await dbRun(db, 'BEGIN IMMEDIATE');

        // Before the replay writes any ledger rows, sample the user's existing
        // ledger to warn (in the preview) when this file re-imports transactions
        // that are already recorded. This does not deduplicate — importing anyway
        // is allowed; it only surfaces that duplicates would be created.
        const existingLedger = await dbAll(db,
            'SELECT executed_at, symbol, transaction_type, quantity, unit_price FROM transactions WHERE user_id = ?', [userId]);
        const duplicates = countDuplicateRows(normalized, existingLedger);

        let buys = 0, sells = 0, realizedTotalTRY = 0;
        try {
            for (const row of normalized) {
                if (row.transactionType === 'buy') {
                    await mergeOrInsertPosition(db, userId, { symbol: row.symbol, quantity: row.quantity, purchase: row.unitPrice, type: row.type });
                    await insertBuyLedger(db, { userId, symbol: row.symbol, type: row.type, quantity: row.quantity, purchase: row.unitPrice, executedAt: row.executedAt });
                    buys++;
                } else {
                    const { realizedPl, proceeds } = await applySellPosition(db, userId, { symbol: row.symbol, quantity: row.quantity, price: row.unitPrice, type: row.type });
                    await insertSellLedger(db, { userId, symbol: row.symbol, type: row.type, quantity: row.quantity, price: row.unitPrice, proceeds, realizedPl, executedAt: row.executedAt });
                    sells++;
                    if (getTransactionCurrency(row.symbol) === 'TRY') realizedTotalTRY += realizedPl;
                }
            }
        } catch (rowErr) {
            await dbRun(db, 'ROLLBACK').catch(() => {});
            const status = rowErr instanceof BusinessError ? 400 : 500;
            return res.status(status).json({
                message: `İçe aktarma durduruldu: ${rowErr.message || 'işlem uygulanamadı'}`,
                valid: false,
                imported: 0,
                errors: [{ message: rowErr.message || 'İşlem uygulanamadı' }]
            });
        }

        // Resulting positions for the affected symbols, read inside the transaction
        // (before rollback/commit) so the preview reflects the post-import state.
        const symbols = [...new Set(normalized.map(r => r.symbol))];
        const positions = [];
        for (const sym of symbols) {
            const rows = await dbAll(db, 'SELECT symbol, type, quantity, purchase_price FROM portfolios WHERE user_id = ? AND symbol = ?', [userId, sym]);
            positions.push(...rows);
        }

        const summary = {
            total: normalized.length,
            buys,
            sells,
            symbols: symbols.length,
            duplicates,
            realizedTotalTRY,
            from: normalized[0].executedAt,
            to: normalized[normalized.length - 1].executedAt,
            positions
        };

        if (!confirm) {
            await dbRun(db, 'ROLLBACK');
            return res.json({ preview: true, valid: true, summary });
        }
        await dbRun(db, 'COMMIT');
        return res.json({ preview: false, valid: true, imported: normalized.length, summary });
    } catch (err) {
        await dbRun(db, 'ROLLBACK').catch(() => {});
        console.error('Import error:', err);
        return res.status(500).json({ message: 'İçe aktarma başarısız' });
    } finally {
        release();
    }
};

// @desc    Remove an asset from portfolio
// @route   DELETE /api/portfolio/:id
exports.deleteAsset = (req, res) => {
    const assetId = req.params.id;
    const userId = req.user.id;
    const db = getConnection();

    // Safety: Only delete if the asset belongs to the requesting user
    db.run('DELETE FROM portfolios WHERE id = ? AND user_id = ?', [assetId, userId], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Silme işlemi başarısız' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Öğe bulunamadı veya yetkiniz yok' });
        }
        res.json({ message: 'Öğe portföyden kaldırıldı' });
    });
};