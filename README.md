# BIST Stocks Dashboard

A full-stack web application for tracking Turkish BIST (Borsa İstanbul) stocks in real time. It combines live market data, a weighted-average-cost portfolio, buy/sell transactions with realized and unrealized profit/loss, currency and gold rates, and interactive historical charts — all behind secure JWT authentication with email verification.

Built with a Node.js + Express backend and a dependency-free vanilla JavaScript frontend (ES modules, no build step), backed by SQLite and Yahoo Finance market data.

## Features

- **Stock Tracking**: Live BIST stock prices and market data
- **Portfolio Management**: Add and track stock and FX holdings with a weighted-average cost basis
- **Buy & Sell Transactions**: Record buys and sells, with partial and full position support
- **Profit/Loss Analysis**: Unrealized P/L on open positions, realized P/L crystallized on sells, and a combined Total Return
- **Transaction Ledger & History**: Append-only ledger with a filterable history (by type and symbol)
- **Interactive Charts**: Historical price charts with multiple timeframes
- **Döviz Kurları**: USD/TRY, EUR/TRY, Gold, and Gram Gold rates
- **User Authentication**: Secure register/login with JWT and email verification
- **Responsive Design**: Modern UI for all devices

## Screenshots

Screenshots will be added in a future update.

## Project structure

```
proxy/
├── server.js              # Express entry point
├── controllers/           # HTTP handlers
├── routes/                # Route definitions
├── services/              # DB, email, Yahoo Finance, cache
├── middleware/            # Security, CSRF, rate limiting
├── utils/                 # Config and error handling
├── email-templates/       # HTML email templates
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/                # Frontend ES modules
├── docs/                  # Documentation (see docs/README.md)
├── scripts/               # CLI utilities
└── tests/                 # Jest unit tests
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd proxy
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your values (JWT_SECRET, COOKIE_SECRET, EMAIL_USER, EMAIL_PASS).

4. **Reset database (optional)**
   ```bash
   node scripts/clear-db.js
   ```

5. **Start the server**
   ```bash
   npm start
   ```

6. Open `http://localhost:3100` in your browser.

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start the server |
| `npm test` | Run security + unit tests |
| `npm run backup` | Backup `users.db` |
| `npm run backup:full` | Backup DB + stock cache |

## Documentation

See [docs/README.md](./docs/README.md) for setup guides, security notes, and archived refactor reports.

## Technologies

| Layer | Technologies |
|---|---|
| Backend | Node.js, Express |
| Frontend | Vanilla JavaScript (ES modules), HTML5, CSS3 |
| Database | SQLite |
| Charts | Chart.js |
| Auth & Security | JWT, bcrypt, CSRF tokens, rate limiting |
| Market data | Yahoo Finance API |
| Email | Nodemailer |

## Roadmap

### Completed

- [x] Live BIST stock prices and market data
- [x] Portfolio management with weighted-average cost basis
- [x] Buy & sell transactions with partial/full position support
- [x] Unrealized, realized, and total profit/loss analysis
- [x] Append-only transaction ledger with filterable history
- [x] Interactive historical price charts
- [x] Currency & gold rates (USD/TRY, EUR/TRY, Gold, Gram Gold)
- [x] JWT authentication with email verification
- [x] Responsive, mobile-friendly UI

### Planned

- [ ] Portfolio performance analytics over time
- [ ] Configurable stock watchlist

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for the full version history. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## License

ISC
