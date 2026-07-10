const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const portfolioController = require('../controllers/portfolioController');
const { authenticateToken, validateCSRF, importLimiter } = require('../middleware/securityMiddleware');

const addAssetValidation = [
  body('symbol')
    .trim()
    .notEmpty().withMessage('Sembol gereklidir')
    .isLength({ max: 50 })
    // Whitelist the characters real tickers use (BIST .IS, FX =X, ^index, GC=F,
    // XAU/TRY). Crucially blocks < > " ' so a symbol can never carry markup —
    // defence-in-depth alongside output escaping in the frontend renderers.
    .matches(/^[A-Za-z0-9.=^/&#;_-]+$/).withMessage('Sembol geçersiz karakter içeriyor'),
  // Upper bounds keep absurd/Infinity values out: a value that overflows to
  // Infinity serializes back as null (JSON.stringify(Infinity) === 'null'),
  // corrupting the stored quantity/price. 1e9 is far above any real BIST value.
  body('quantity').isFloat({ min: 0.0001, max: 1e9 }).withMessage('Miktar 0 ile 1.000.000.000 arasında olmalıdır').toFloat(),
  body('purchase').isFloat({ min: 0.01, max: 1e9 }).withMessage('Alış fiyatı 0 ile 1.000.000.000 arasında olmalıdır').toFloat(),
  body('type').optional().isIn(['stock', 'fx']).withMessage('Tür stock veya fx olmalıdır')
];

// Sell reuses the same symbol/quantity/type guards; only the price field differs
// (`price` = sale price, vs `purchase` for a buy).
const sellAssetValidation = [
  body('symbol')
    .trim()
    .notEmpty().withMessage('Sembol gereklidir')
    .isLength({ max: 50 })
    .matches(/^[A-Za-z0-9.=^/&#;_-]+$/).withMessage('Sembol geçersiz karakter içeriyor'),
  body('quantity').isFloat({ min: 0.0001, max: 1e9 }).withMessage('Miktar 0 ile 1.000.000.000 arasında olmalıdır').toFloat(),
  body('price').isFloat({ min: 0.01, max: 1e9 }).withMessage('Satış fiyatı 0 ile 1.000.000.000 arasında olmalıdır').toFloat(),
  body('type').optional().isIn(['stock', 'fx']).withMessage('Tür stock veya fx olmalıdır')
];

// Generic express-validator result handler shared by the mutating routes.
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  }
  next();
}

/**
 * @route   GET /api/portfolio
 * @desc    Get user's portfolio assets
 */
router.get('/portfolio', authenticateToken, portfolioController.getPortfolio);

/**
 * @route   GET /api/portfolio/transactions
 * @desc    Get the user's transaction history (append-only ledger)
 */
router.get('/portfolio/transactions', authenticateToken, portfolioController.getTransactions);

/**
 * @route   POST /api/portfolio
 * @desc    Add new stock or FX to portfolio
 */
router.post('/portfolio', authenticateToken, validateCSRF, addAssetValidation, handleValidation, portfolioController.addAsset);

/**
 * @route   POST /api/portfolio/sell
 * @desc    Sell part or all of an existing position (records a SELL in the ledger)
 */
router.post('/portfolio/sell', authenticateToken, validateCSRF, sellAssetValidation, handleValidation, portfolioController.sellAsset);

/**
 * @route   POST /api/portfolio/import
 * @desc    Validate + replay an imported CSV transaction history (preview when
 *          confirm !== true, commit when confirm === true). Per-row validation and
 *          business rules are enforced inside the controller.
 */
router.post('/portfolio/import', importLimiter, authenticateToken, validateCSRF, portfolioController.importTransactions);

/**
 * @route   DELETE /api/portfolio/:id
 * @desc    Delete a specific asset from portfolio
 */
router.delete('/portfolio/:id', authenticateToken, validateCSRF, portfolioController.deleteAsset);

module.exports = router;