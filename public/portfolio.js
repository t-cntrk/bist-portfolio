/**
 * portfolio.js — Barrel re-export file.
 *
 * All logic lives in:
 *   js/stocks.js          — stock data fetching & row rendering
 *   js/portfolio-crud.js  — CRUD ops, modals, initPortfolio
 *   js/portfolio-render.js — stock portfolio table rendering
 *   js/fx-portfolio.js    — FX market data, FX portfolio rendering, addFxToPortfolio modal
 *   portfolio-chart.js    — Chart modal
 *
 * External modules (app.js, ui.js) still import from this file unchanged.
 */

// ─── Chart module ─────────────────────────────────────────────────────────────
export { showChartModal, closeChartModal, toggleChartFullscreen, ChartButtonManager } from './portfolio-chart.js';

// ─── Stock data & rows ────────────────────────────────────────────────────────
export { fetchStock, fetchAllStocks, renderRow, getStockName } from './js/stocks.js';

// ─── Portfolio CRUD ───────────────────────────────────────────────────────────
export {
    fetchPortfolio, fetchFxPortfolio,
    addPortfolioItem, deletePortfolioItem,
    showDeleteConfirmationModal, showPortfolioModal,
    initPortfolio
} from './js/portfolio-crud.js';

// ─── Stock portfolio rendering ────────────────────────────────────────────────
export { renderPortfolioTable } from './js/portfolio-render.js';

// ─── FX market data & FX portfolio rendering ─────────────────────────────────
export {
    fetchFxData,
    renderFxTable,
    renderModernFxPortfolioTable,
    renderFxPortfolioTable
} from './js/fx-portfolio.js';
