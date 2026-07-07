# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Sell transactions with partial and full position support (overselling is rejected).
- Realized profit/loss on sells, computed at sale time as `quantity × (sell price − weighted-average cost)`.
- Total Return summary card, combining Unrealized P/L and Realized P/L (TRY-denominated).
- Append-only transaction ledger recording every buy and sell.
- Transaction history view showing per-sell realized P/L.
- Client-side transaction filtering by type (Buy / Sell / All) and by symbol.
- Per-transaction `currency` and `executed_at` (trade time) columns on the ledger, with currency-aware amounts.
- CSV export of the transaction history — the full ledger (not the active filter view) — with RFC 4180 escaping and a UTF-8 BOM for correct display in Excel.
- Excel (`.xlsx`) export as a formatted workbook: bold, filled header row, frozen header, auto filter, content-fit columns, numeric cell formats, and green/red realized P/L.
- Shared transaction-to-export schema, reused by both the CSV and Excel exports so the column set and mapping are defined once.

### Changed
- Renamed the portfolio profit/loss summary card to "Unrealized P/L" (TR/EN) to distinguish it from realized and total figures.

### Notes
- Realized-P/L and Total Return figures aggregate only TRY-denominated amounts. Non-TRY sells (e.g. USD-quoted gold) are shown per row but excluded from cross-currency totals.
- Both export formats read the same in-memory transaction data and share one column mapping, so their contents always match the transaction history.

## [1.1.0] - 2024-12-19

### Security
- **SQL injection prevention**: portfolio endpoints in `server.js` now use parameterized queries instead of raw SQL — `/api/portfolio` GET/POST/DELETE and `/api/fx-portfolio` GET. Corrected the table name from `portfolio` to `portfolios` to match the schema.
- **XSS prevention**: added an `escapeHtml()` helper in `portfolio.js` and applied it to all user inputs — symbol names, stock names, and data attributes — across chart-modal and portfolio rendering.
- **CORS**: environment-based configuration in `server.js` — production restricted to the `ALLOWED_ORIGINS` variable, development allows localhost/dev domains, with warning logs for blocked origins.
- **JWT secret validation**: startup check in `server.js` exits the process if `JWT_SECRET` is unset or left at its default value.
- **Security headers**: added `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Strict-Transport-Security: max-age=31536000; includeSubDomains`.

### Changed
- **Event delegation**: replaced multiple listeners in `main.js` with a single delegation pattern using passive listeners, reducing listener count and memory use.
- **Parallel market-data fetching**: verified Yahoo Finance requests run concurrently via `Promise.allSettled` with concurrency control.
- **Responsive design**: mobile-first breakpoints (768px, 480px) in `style.css`, card-based layout for small screens, grid/flexbox table layouts, and improved modal responsiveness and touch interactions.
- **Mobile optimization**: `-webkit-overflow-scrolling: touch` for smooth scrolling, viewport handling for charts, and touch-optimized inputs and buttons.
- **Centralized validation**: added `validation.js` with reusable validation functions and schemas (portfolio item, registration, login), eliminating duplicated validation logic.
- **Dependency updates**: `express` ^4.18.2 → ^4.19.0, `sqlite3` ^5.1.6 → ^5.1.7, `yahoo-finance2` ^2.8.1 → ^2.9.0, `bcrypt` ^5.1.1 → ^5.1.2.
- **Documentation**: added this changelog and security-considerations notes, documenting the fixes above.

### Fixed
- **Memory leaks**: `ChartManager` now exposes a `cleanup()` method, tears down resize/fullscreen listeners, adds a static cleanup for the singleton, and closes the chart modal through layered cleanup.
- **Portfolio refresh duplication**: added a rendering flag to prevent a race condition, clear existing content before rendering, debounce the refresh button, build table HTML in a single pass instead of incremental appends, and improve error handling in stock and FX table rendering.

## [1.0.0] - Initial Release

### Added
- BIST stocks dashboard with real-time data.
- Portfolio management for stocks and FX.
- Interactive charts (Chart.js).
- User authentication system.
- Responsive design.
- Real-time market-data updates.

### Notes
- **Technical stack**: Node.js, Express.js, SQLite3 (backend); vanilla JavaScript ES modules, HTML5, CSS3 (frontend); Chart.js; Yahoo Finance API; JWT, bcrypt, CORS, and rate limiting for security.
