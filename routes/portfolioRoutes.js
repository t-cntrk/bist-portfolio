const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const portfolioController = require('../controllers/portfolioController');
const { authenticateToken } = require('../middleware/securityMiddleware');

const addAssetValidation = [
  body('symbol').trim().notEmpty().withMessage('Symbol is required').isLength({ max: 50 }),
  body('quantity').isFloat({ min: 0.0001 }).withMessage('Quantity must be a positive number').toFloat(),
  body('purchase').isFloat({ min: 0.01 }).withMessage('Alış fiyatı 0\'dan büyük olmalıdır').toFloat(),
  body('type').optional().isIn(['stock', 'fx']).withMessage('Type must be stock or fx')
];

function validateAddAsset(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
  }
  next();
}

/**
 * @route   GET /api/portfolio
 * @desc    Get user's portfolio assets
 */
router.get('/portfolio', authenticateToken, portfolioController.getPortfolio);

/**
 * @route   POST /api/portfolio
 * @desc    Add new stock or FX to portfolio
 */
router.post('/portfolio', authenticateToken, addAssetValidation, validateAddAsset, portfolioController.addAsset);

/**
 * @route   DELETE /api/portfolio/:id
 * @desc    Delete a specific asset from portfolio
 */
router.delete('/portfolio/:id', authenticateToken, portfolioController.deleteAsset);

module.exports = router;