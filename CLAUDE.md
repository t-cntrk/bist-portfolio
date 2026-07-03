# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start               # Start server (node server.js)
npm test                # Run security tests + Jest unit tests
npm run test:unit       # Jest unit tests only (tests/*.test.js)
npm run test:security   # Custom security test suite (scripts/test-security.js)
npm run test:regression # Regression tests (scripts/test-regression.js)
npm run lint            # ESLint
npm run format          # Prettier check
npm run backup          # Backup users.db
npm run backup:full     # Backup users.db + cache/stockCache.json
node scripts/clear-db.js      # Reset SQLite database
node scripts/check-schema.js  # Inspect current DB schema
```

Run a single Jest test file:
```bash
npx jest tests/envConfig.test.js --runInBand
```

Dev-only debug endpoints (when `NODE_ENV != production`): `GET /test`, `GET /test-email`, `GET /debug-tokens`.

## Architecture

**Stack**: Node.js + Express backend, vanilla JS ES-module frontend, SQLite database, Yahoo Finance API for market data.

### Backend (`server.js` → routes → controllers → services)

`server.js` is the entry point. It wires middleware, registers routes, initializes the database, and starts the server. Route files (`routes/`) are thin — they attach rate limiters and validators from `middleware/securityMiddleware.js`, then delegate to controllers.

**Services** (stateful/external integrations):
- `services/yahooService.js` — fetches quotes from Yahoo Finance. Tries the v8 chart endpoint first (no auth needed), falls back to the `yahoo-finance2` npm package, and finally returns mock data when both fail. Handles 429 rate limits with exponential backoff.
- `services/stockCacheService.js` — in-memory cache (node-cache, TTL 30 min) + disk fallback at `cache/stockCache.json`. Concurrent requests share a single in-flight fetch via `pendingStocksFetch`/`pendingFXFetch` promises.
- `services/databaseService.js` — single shared SQLite connection (node-sqlite3 serializes internally). Schema is initialized on boot via `initializeDatabase()`; migrations run as `ALTER TABLE` inside the same `serialize()` block.
- `services/emailService.js` — Nodemailer for verification/reset emails.
- `services/pageGenerator.js` — renders server-side HTML pages for email verification/password-reset flows.

**Security** (`middleware/securityMiddleware.js`):
- Session-based CSRF tokens (Map, 24 h TTL); CSRF required on all auth mutation routes via `validateCSRF`.
- JWT auth via `authenticateToken` middleware; JWT_SECRET must be ≥16 chars in production or the process exits.
- Rate limiters: `authLimiter`, `yahooLimiter`, `chartLimiter`, `forgotPasswordLimiter`.
- Security headers, enforced HTTPS, and CSP are applied globally in `server.js`.

**Database schema** (SQLite, `users.db`):
- `users`: id, name, surname, email (unique), birthdate, username (unique), password (bcrypt), email_verified, verification_token, token_expires, action_token, action_token_expires, action_type.
- `portfolios`: id, user_id (FK→users), symbol, quantity, purchase_price, type — unique on `(user_id, symbol, type)`.

**Stock symbols**: 15 hardcoded BIST tickers with `.IS` suffix (e.g. `THYAO.IS`). FX/gold symbols: `USDTRY=X`, `EURTRY=X`, `GC=F` (gold oz), `XAUTRY=X` (gram gold). Display names are maintained in two places that must stay in sync: `yahooService.getStockDisplayName()` (backend) and `public/js/stocks.js getStockName()` (frontend). Portfolio items have `type` field: `'stock'` or `'fx'`.

### Frontend (`public/js/` — ES modules)

All frontend code is loaded as ES modules via `<script type="module" src="js/app.js">` in `public/index.html`. No build step or bundler.

**Module topology**:
- `app.js` — entry point; imports from all other modules, wires event delegation, boots the app, runs the 60 s auto-refresh loop.
- `state.js` — `AppState` singleton; persists non-ephemeral keys to `localStorage`. `stocks` and `fx` are ephemeral (in-memory only, re-fetched on boot).
- `portfolio.js` — barrel re-export only; actual logic is split across:
  - `stocks.js` — fetches `/api/stocks`, renders stock table rows.
  - `portfolio-crud.js` — add/delete portfolio items, modals, `initPortfolio`.
  - `portfolio-render.js` — `renderUnifiedPortfolio` renders both stock and FX portfolio rows in a single pass; exported as both `renderPortfolioTable` and `renderFxPortfolioTable`.
  - `fx-portfolio.js` — FX market data helpers used by the unified render.
  - `portfolio-chart.js` — Chart.js modal for historical prices; `ChartButtonManager` prevents duplicate bindings.
- `fx.js` — currency table (Döviz Kurları); `updateCurrencyDisplay` updates the DOM from a keyed FX object.
- `auth.js` — login/register/logout flows; calls `window.initPortfolio` and `window.initFx` after successful login.
- `api.js` — `getApiUrl()` returns the base API URL (reads from `window.API_BASE_URL` or defaults to `''`).
- `i18n.js` — TR/EN toggle; `applyI18n()` swaps `data-i18n` attribute values.
- `formatters.js` — number/currency formatting, including TRY locale.

**Event delegation**: `app.js setupEventDelegation()` handles clicks for `.add-portfolio-btn`, `.currency-add-btn`, `.delete-portfolio-btn`, `.chart-btn`/`.chart-icon`, and `#closeChartBtn` via a single document-level listener. Do not add direct `onclick` listeners for these selectors — it causes double-firing.

## Environment variables

Copy `.env.example` to `.env`. Required for full functionality:

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Must be ≥16 chars in production |
| `COOKIE_SECRET` | Signs the session cookie used for CSRF |
| `EMAIL_USER` / `EMAIL_PASS` | Gmail + App Password for Nodemailer |
| `NODE_ENV` | `development` (default) or `production` |
| `BASE_URL_PROD` | Used to build email links in production |
| `ALLOWED_ORIGINS` | Comma-separated CORS whitelist (prod) |

Set `USE_MOCK_DATA=true` to bypass Yahoo Finance entirely and use hardcoded prices — useful when Yahoo is throttling.
