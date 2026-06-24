const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');
const { yahooLimiter, chartLimiter, authenticateToken } = require('../middleware/securityMiddleware');

/**
 * @route   GET /api/stocks
 * @desc    Get list of 15 BIST stocks from cache or Yahoo Finance
 * Note: Mounted under /api so GET /api/stocks, GET /api/stocks/fx, etc.
 */
router.get('/stocks', yahooLimiter, stockController.getStocks);

/**
 * @route   GET /api/stocks/fx
 * @desc    Get currency, gold, and index data
 */
router.get('/stocks/fx', yahooLimiter, stockController.getFX);

/**
 * @route   GET /api/stocks/quote/:symbol
 * @desc    Get single symbol quote (e.g. GC=F, USDTRY=X)
 */
router.get('/stocks/quote/:symbol', yahooLimiter, stockController.getQuote);

/**
 * @route   POST /api/stocks/clear-cache
 * @desc    Clear stock/FX cache (for force refresh) — requires authentication
 */
router.post('/stocks/clear-cache', authenticateToken, yahooLimiter, stockController.clearCache);

/**
 * @route   GET /api/stocks/:symbol/chart
 * @desc    Get historical closing prices for Chart.js
 * @query   range: 1d|1w|1m|3m|1y|10y  (default: 1m)
 * @example /api/stocks/DOAS.IS/chart?range=1m
 * Note: Must be defined AFTER /stocks/fx and /stocks/quote/:symbol
 *       so those literal paths are matched first by Express.
 */
router.get('/stocks/:symbol/chart', chartLimiter, stockController.getChart);

module.exports = router;