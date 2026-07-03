const { getConnection } = require('../services/databaseService');

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

    // Append the immutable buy to the transaction ledger (this buy's own quantity
    // and unit price — NOT the merged position), then reply with the position
    // result. A ledger failure is logged but doesn't fail the buy, since the
    // position summary (what the UI reads) is already updated.
    const recordThenRespond = (positionResult) => {
        db.run(
            'INSERT INTO transactions (user_id, symbol, asset_type, transaction_type, quantity, unit_price, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, symbol, type, 'buy', quantity, purchase, quantity * purchase],
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