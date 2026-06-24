/**
 * portfolio.js — Barrel re-export file.
 *
 * All logic lives in:
 *   js/stocks.js          — stock data fetching & row rendering
 *   js/portfolio-crud.js  — CRUD ops, modals, initPortfolio
 *   js/portfolio-render.js — stock portfolio table rendering
 *   js/fx-portfolio.js    — FX market data & FX portfolio rendering
 *   portfolio-chart.js    — Chart modal
 *
 * External modules (app.js, ui.js) still import from this file unchanged.
 */

// ─── Chart module ─────────────────────────────────────────────────────────────
export { showChartModal, closeChartModal, toggleChartFullscreen, ChartButtonManager } from './portfolio-chart.js';

// ─── Stock data & rows ────────────────────────────────────────────────────────
export { fetchStock, fetchAllStocks, renderRow, getStockName } from './stocks.js';

// ─── Portfolio CRUD ───────────────────────────────────────────────────────────
export {
    fetchPortfolio, fetchFxPortfolio,
    addPortfolioItem, deletePortfolioItem,
    showDeleteConfirmationModal, showPortfolioModal,
    initPortfolio
} from './portfolio-crud.js';

// ─── Stock portfolio rendering ────────────────────────────────────────────────
export {
    renderUnifiedPortfolio,
    renderPortfolioTable
} from './portfolio-render.js';

// Legacy alias — same unified render path
export { renderUnifiedPortfolio as renderFxPortfolioTable } from './portfolio-render.js';

// ─── FX market data (row helpers used by unified portfolio render) ───────────
export { fetchFxData } from './fx-portfolio.js';
