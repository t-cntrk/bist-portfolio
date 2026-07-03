const { getConnection } = require('../services/databaseService');

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
exports.addAsset = (req, res) => {
    const { symbol, quantity, purchase } = req.body;
    const type = req.body.type || 'stock';
    const userId = req.user.id;
    const db = getConnection();

    // executed_at is the actual trade time. Normal buys don't send one, so it
    // falls back (via COALESCE) to CURRENT_TIMESTAMP — the same value the
    // created_at default resolves to within this statement, so it stays identical
    // to the audit stamp and nothing changes for existing clients. A future import
    // path can pass an explicit ISO trade time here without ever touching created_at.
    const executedAt = (typeof req.body.executedAt === 'string' && req.body.executedAt.trim())
        ? req.body.executedAt.trim()
        : null;

    // Append the immutable buy to the transaction ledger (this buy's own quantity
    // and unit price — NOT the merged position), then reply with the position
    // result. A ledger failure is logged but doesn't fail the buy, since the
    // position summary (what the UI reads) is already updated.
    const recordThenRespond = (positionResult) => {
        db.run(
            `INSERT INTO transactions
                (user_id, symbol, asset_type, transaction_type, quantity, unit_price, total_amount, currency, created_at, executed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, COALESCE(?, CURRENT_TIMESTAMP))`,
            [userId, symbol, type, 'buy', quantity, purchase, quantity * purchase, getTransactionCurrency(symbol), executedAt],
            (txErr) => {
                if (txErr) console.error('Transaction ledger insert error:', txErr);
                return res.json(positionResult);
            }
        );
    };

    // Buying more of an asset already held is a valid action, not a duplicate.
    // If the user already holds this symbol+type, merge the buy into the existing
    // position: sum the quantity and recompute the weighted-average purchase price.
    // Scoped by user_id, so other users' identical symbols are untouched; a
    // different `type` for the same symbol is a separate position.
    db.get(
        'SELECT id, quantity, purchase_price FROM portfolios WHERE user_id = ? AND symbol = ? AND type = ?',
        [userId, symbol, type],
        (selErr, existing) => {
            if (selErr) {
                console.error('Portfolio lookup error:', selErr);
                return res.status(500).json({ message: 'Portföy eklenemedi' });
            }

            if (existing) {
                const totalQuantity = existing.quantity + quantity;
                const avgPrice = ((existing.purchase_price * existing.quantity) + (purchase * quantity)) / totalQuantity;
                db.run(
                    'UPDATE portfolios SET quantity = ?, purchase_price = ? WHERE id = ? AND user_id = ?',
                    [totalQuantity, avgPrice, existing.id, userId],
                    (updErr) => {
                        if (updErr) {
                            console.error('Portfolio update error:', updErr);
                            return res.status(500).json({ message: 'Portföy güncellenemedi' });
                        }
                        return recordThenRespond({ id: existing.id, merged: true, quantity: totalQuantity, purchase_price: avgPrice });
                    }
                );
                return;
            }

            db.run(
                'INSERT INTO portfolios (user_id, symbol, quantity, purchase_price, type) VALUES (?, ?, ?, ?, ?)',
                [userId, symbol, quantity, purchase, type],
                function (insErr) {
                    if (insErr) {
                        // The UNIQUE index still guards against a concurrent insert
                        // racing the lookup above.
                        if (insErr.code === 'SQLITE_CONSTRAINT') {
                            return res.status(409).json({ message: 'Bu varlık az önce eklendi, lütfen tekrar deneyin' });
                        }
                        console.error('Portfolio insert error:', insErr);
                        return res.status(500).json({ message: 'Portföy eklenemedi' });
                    }
                    return recordThenRespond({ id: this.lastID });
                }
            );
        }
    );
};

// @desc    Get the user's transaction history (append-only ledger)
// @route   GET /api/portfolio/transactions?symbol=OPTIONAL
exports.getTransactions = (req, res) => {
    const db = getConnection();
    const userId = req.user.id;
    const symbol = req.query.symbol;

    // Newest first. Optional symbol filter supports future per-asset views.
    let sql = 'SELECT id, symbol, asset_type, transaction_type, quantity, unit_price, total_amount, created_at FROM transactions WHERE user_id = ?';
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