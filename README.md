# BIST Stocks Dashboard

A stock market dashboard for Turkish BIST stocks with real-time data, portfolio management, currency tracking, and interactive charts.

## Features

- **Stock Tracking**: Live BIST stock prices and market data
- **Portfolio Management**: Track investments with profit/loss calculations
- **Interactive Charts**: Historical price charts with multiple timeframes
- **Döviz Kurları**: USD/TRY, EUR/TRY, Gold, and Gram Gold rates
- **User Authentication**: Secure login/register with JWT tokens
- **Responsive Design**: Modern UI for all devices

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

- **Backend**: Node.js, Express
- **Database**: SQLite
- **Frontend**: Vanilla JavaScript (ES modules)
- **Auth**: JWT, bcrypt
- **Data**: Yahoo Finance API

## License

ISC
