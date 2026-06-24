# Documentation

## Quick links

| Document | Description |
|---|---|
| [QUICK_START.md](./QUICK_START.md) | Setup and first run |
| [LIVE_DATA_SETUP.md](./LIVE_DATA_SETUP.md) | Yahoo Finance / market data configuration |
| [EMAIL_SETUP.md](./EMAIL_SETUP.md) | Gmail SMTP and email templates |
| [EMAIL_TESTING.md](./EMAIL_TESTING.md) | Manual email verification steps |
| [SECURITY.md](./SECURITY.md) | Security overview |
| [SECURITY_IMPROVEMENTS.md](./SECURITY_IMPROVEMENTS.md) | Security hardening checklist |
| [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | Feature status tracker |

## Archive

Historical refactor notes (kept for reference):

- [archive/REFACTOR_REPORT.md](./archive/REFACTOR_REPORT.md)
- [archive/FIXES_SUMMARY.md](./archive/FIXES_SUMMARY.md)

## Project structure

```
proxy/
├── server.js                 # Express entry point
├── package.json
├── controllers/              # HTTP handlers
├── routes/                   # Route definitions
├── services/                 # Business logic (DB, email, Yahoo, cache)
├── middleware/               # Security, CSRF, rate limiting
├── utils/                    # envConfig, errorHandler
├── email-templates/          # HTML email templates
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/                   # Frontend ES modules
├── docs/                     # All documentation (this folder)
├── scripts/                  # CLI utilities (admin, tests, deploy)
├── tests/                    # Jest unit tests
└── cache/                    # Runtime stock cache (gitignored)
```
