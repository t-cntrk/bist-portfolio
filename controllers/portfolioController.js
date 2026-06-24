const { getConnection, releaseConnection } = require('../services/databaseService');

// @desc    Get user's complete portfolio
// @route   GET /api/portfolio
exports.getPortfolio = (req, res) => {
    const db = getConnection();
    const userId = req.user.id; // Decoded from JWT in middleware

    // SQL to fetch user's assets
    const sql = 'SELECT id, symbol, quantity, purchase_price, type FROM portfolios WHERE user_id = ?';
    
    db.all(sql, [userId], (err, rows) => {
        releaseConnection(db);
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

    const sql = 'INSERT INTO portfolios (user_id, symbol, quantity, purchase_price, type) VALUES (?, ?, ?, ?, ?)';
    
    db.run(sql, [userId, symbol, quantity, purchase, type], function(err) {
        releaseConnection(db);
        if (err) {
            if (err.code === 'SQLITE_CONSTRAINT') {
                return res.status(400).json({ message: 'Bu hisse zaten portföyünüzde mevcut' });
            }
            console.error('Portfolio insert error:', err);
            return res.status(500).json({ message: 'Portföy eklenemedi' });
        }
        res.json({ id: this.lastID });
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
        releaseConnection(db);
        if (err) {
            return res.status(500).json({ message: 'Silme işlemi başarısız' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Öğe bulunamadı veya yetkiniz yok' });
        }
        res.json({ message: 'Öğe portföyden kaldırıldı' });
    });
};