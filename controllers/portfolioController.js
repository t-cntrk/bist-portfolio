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
                        return res.json({ id: existing.id, merged: true, quantity: totalQuantity, purchase_price: avgPrice });
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
                    return res.json({ id: this.lastID });
                }
            );
        }
    );
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