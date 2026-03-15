# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2024-12-19

### 🔒 Security Fixes
- **SQL Injection Prevention**: Updated portfolio endpoints in `server.js` to use parameterized queries instead of raw SQL
  - Fixed `/api/portfolio` GET, POST, DELETE endpoints
  - Fixed `/api/fx-portfolio` GET endpoint
  - Corrected table name from `portfolio` to `portfolios` to match database schema
- **XSS Vulnerability Fix**: Implemented comprehensive HTML escaping in `portfolio.js`
  - Added `escapeHtml()` function for all user inputs
  - Applied escaping to symbol names, stock names, and data attributes
  - Enhanced security for chart modal and portfolio rendering
- **CORS Configuration**: Implemented environment-based CORS in `server.js`
  - Production: Restricted to `ALLOWED_ORIGINS` environment variable
  - Development: Allows localhost and development domains
  - Added warning logs for blocked origins
- **JWT Secret Validation**: Added critical startup check in `server.js`
  - Server exits if `JWT_SECRET` is not set or uses default value
  - Prevents deployment with insecure default secrets

### 🚀 Performance Improvements
- **Memory Leak Fixes**: Enhanced ChartManager class in `portfolio.js`
  - Added proper cleanup mechanism with `cleanup()` method
  - Implemented event listener cleanup for resize and fullscreen events
  - Added static cleanup method for singleton pattern
  - Enhanced chart modal close function with multiple cleanup layers
- **Event Delegation**: Optimized event handling in `main.js`
  - Replaced multiple event listeners with single delegation pattern
  - Used passive event listeners for better performance
  - Reduced memory usage from event listener attachments
- **API Optimizations**: Ensured parallel API calls in `server.js`
  - Confirmed existing `Promise.allSettled` implementation for Yahoo Finance data
  - Maintained concurrency control for optimal performance
- **Data Duplication Fix**: Resolved portfolio refresh data duplication issue
  - Added race condition prevention with rendering flag
  - Implemented proper content clearing before rendering new data
  - Added debounce mechanism for refresh button to prevent rapid successive clicks
  - Fixed HTML content building to set all content at once instead of incremental appending
  - Enhanced both stock and FX portfolio table rendering with proper error handling

### 🎨 UI/UX Improvements
- **Responsive Design**: Enhanced mobile-first design in `style.css`
  - Added comprehensive mobile breakpoints (768px, 480px)
  - Implemented card-based layout for small screens
  - Optimized table layouts with grid and flexbox
  - Enhanced modal responsiveness and touch interactions
  - Improved button sizes and spacing for mobile devices
- **Mobile Optimization**: 
  - Added `-webkit-overflow-scrolling: touch` for smooth scrolling
  - Implemented proper viewport handling for charts
  - Optimized form inputs and buttons for touch interfaces

### 🔧 Code Quality
- **Validation Module**: Created `validation.js` for centralized validation
  - Implemented comprehensive validation functions for all data types
  - Added portfolio item, user registration, and login validation
  - Created reusable validation schemas
  - Eliminated code duplication across the application
- **Package Updates**: Updated dependencies in `package.json`
  - `express`: ^4.18.2 → ^4.19.0
  - `sqlite3`: ^5.1.6 → ^5.1.7
  - `yahoo-finance2`: ^2.8.1 → ^2.9.0
  - `bcrypt`: ^5.1.1 → ^5.1.2

### 🛡️ Security Headers
- Added comprehensive security headers in `server.js`:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`

### 📝 Documentation
- Created comprehensive changelog
- Added security considerations documentation
- Documented all fixes with clear explanations

## [1.0.0] - Initial Release

### Features
- BIST Stocks Dashboard with real-time data
- Portfolio management for stocks and FX
- Interactive charts with Chart.js
- User authentication system
- Responsive design
- Real-time market data updates

### Technical Stack
- **Backend**: Node.js, Express.js, SQLite3
- **Frontend**: Vanilla JavaScript (ES6 Modules), HTML5, CSS3
- **Charts**: Chart.js
- **APIs**: Yahoo Finance API
- **Security**: JWT, bcrypt, CORS, rate limiting 