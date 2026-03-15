const fs = require('fs');
const path = require('path');
const NodeCache = require('node-cache');

const {
    delay,
    isRateLimitError,
    getMockPrice,
    getStockDisplayName,
    buildMockStocks,
    buildMockFX,
    fetchOneViaYahooV8,
    fetchQuotes,
    FETCH_TIMEOUT_MS
} = require('./yahooService');

// ============================================================
// CACHE SETUP
// ============================================================

const CACHE_TTL_SECONDS = parseInt(process.env.STOCK_CACHE_TTL || '1800', 10) || 1800;
const stockCache = new NodeCache({ stdTTL: CACHE_TTL_SECONDS, checkperiod: 120 });

// Persist the last successful stock cache to disk so the server can return recent quotes
// even when live APIs are temporarily unreachable.
const STOCK_CACHE_KEY = 'bist_stocks_final';
const CACHE_DIR = path.join(__dirname, '..', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'stockCache.json');

// Minimum time between background refresh attempts — matches cache TTL
const REFRESH_COOLDOWN_MS = 29 * 60 * 1000; // 29 min

// How long to wait after a Yahoo rate limit before retrying (runs in background)
const RATE_LIMIT_RETRY_WAIT_MS = 5 * 60 * 1000; // 5 min

// Track pending fetch operations so concurrent requests share the same in-flight work
let pendingStocksFetch = null;
let pendingFXFetch = null;

// Background refresh tracking (to avoid spamming Yahoo when it rate-limits)
let lastStockRefresh = 0;
let lastFXRefresh = 0;

// ============================================================
// DISK CACHE HELPERS
// ============================================================

const ensureCacheDir = () => {
    try {
        if (!fs.existsSync(CACHE_DIR)) {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
        }
    } catch (err) {
        console.warn('Unable to create cache directory:', err.message || err);
    }
};

// Returns { data: [...], savedAt: number } or null.
// Handles both old format (plain array) and new format ({ savedAt, data }).
const loadCachedStocksFromDisk = () => {
    try {
        if (!fs.existsSync(CACHE_FILE)) return null;
        const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return { data: parsed, savedAt: 0 }; // old format — treat as expired
        }
        if (parsed && Array.isArray(parsed.data)) {
            return parsed;
        }
        return null;
    } catch (err) {
        console.warn('Unable to load cached stocks from disk:', err.message || err);
        return null;
    }
};

const saveCachedStocksToDisk = (items) => {
    try {
        ensureCacheDir();
        fs.writeFileSync(CACHE_FILE, JSON.stringify({ savedAt: Date.now(), data: items }, null, 2), 'utf-8');
    } catch (err) {
        console.warn('Unable to persist stock cache to disk:', err.message || err);
    }
};

// ============================================================
// STARTUP: Load disk cache
// ============================================================
// If the saved data is still fresh (< 30 min old), also set lastStockRefresh so the
// cooldown guard prevents an immediate Yahoo fetch when the login screen fires /api/stocks.

const diskCacheResult = loadCachedStocksFromDisk();
if (diskCacheResult) {
    stockCache.set(STOCK_CACHE_KEY, diskCacheResult.data);
    const cacheAgeMs = Date.now() - (diskCacheResult.savedAt || 0);
    if (cacheAgeMs < CACHE_TTL_SECONDS * 1000) {
        lastStockRefresh = diskCacheResult.savedAt || Date.now();
        console.log(`📦 Loaded fresh disk cache (${Math.round(cacheAgeMs / 60000)} min old) — Yahoo fetch deferred until cache expires.`);
    } else {
        console.log(`📦 Loaded stale disk cache (${Math.round(cacheAgeMs / 60000)} min old) — will refresh on first request.`);
    }
}

// ============================================================
// REFRESH FUNCTIONS
// ============================================================

function refreshStockCache(symbols, cacheKey) {
    const now = Date.now();
    if (now - lastStockRefresh < REFRESH_COOLDOWN_MS) {
        return pendingStocksFetch || Promise.resolve();
    }
    lastStockRefresh = now;

    if (pendingStocksFetch) {
        return pendingStocksFetch;
    }

    pendingStocksFetch = (async () => {
        try {
            const yahooNpmFields = ['regularMarketPrice', 'regularMarketPreviousClose', 'regularMarketChangePercent', 'longName', 'regularMarketVolume'];
            const resultMap = new Map(); // symbol → quote object
            const npmQueue = [];         // symbols that need yahoo-finance2 npm fallback

            // ── PASS 1: Yahoo Finance v8 direct HTTP (no crumb / auth) ─
            console.log(`🔄 [Yahoo-v8] Fetching ${symbols.length} stocks (1s delay)...`);
            for (let i = 0; i < symbols.length; i++) {
                const symbol = symbols[i];
                if (i > 0) await delay(1000);
                try {
                    const quote = await fetchOneViaYahooV8(symbol);
                    resultMap.set(symbol, quote);
                    console.log(`  ✓ [v8] ${symbol}: ${quote.regularMarketPrice} ₺`);
                } catch (err) {
                    console.warn(`  ⚠ [v8] ${symbol}: ${err.message} → queued for npm`);
                    npmQueue.push(symbol);
                }
            }

            // ── PASS 2: yahoo-finance2 npm for any v8 failures ──────────
            if (npmQueue.length > 0) {
                console.log(`🔄 [Yahoo-npm] Fetching ${npmQueue.length} fallback symbols (2s delay)...`);
                for (let i = 0; i < npmQueue.length; i++) {
                    const symbol = npmQueue[i];
                    if (i > 0) await delay(2000);

                    try {
                        const fetchPromise = require('yahoo-finance2').default.quote(symbol, { fields: yahooNpmFields });
                        const timeoutPromise = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Timeout')), FETCH_TIMEOUT_MS)
                        );
                        const quote = await Promise.race([fetchPromise, timeoutPromise]);

                        if (quote && quote.regularMarketPrice) {
                            resultMap.set(symbol, {
                                symbol,
                                regularMarketPrice: quote.regularMarketPrice,
                                regularMarketPreviousClose: quote.regularMarketPreviousClose ?? 0,
                                regularMarketChangePercent: quote.regularMarketChangePercent ?? 0,
                                regularMarketVolume: quote.regularMarketVolume ?? 0,
                                longName: quote.longName || getStockDisplayName(symbol),
                                source: 'yahoo'
                            });
                            console.log(`  ✓ [npm] ${symbol}: ${quote.regularMarketPrice} ₺`);
                        } else {
                            throw new Error('Empty quote response');
                        }
                    } catch (err) {
                        if (isRateLimitError(err)) {
                            console.warn(`  ⚡ [npm] Rate limited at ${symbol}. Checking disk cache...`);

                            // Priority 1: disk cache
                            const diskFallback = loadCachedStocksFromDisk();
                            if (diskFallback && diskFallback.data && diskFallback.data.length > 0) {
                                console.warn(`  📦 Disk cache available — using ${diskFallback.data.length} cached symbols.`);
                                stockCache.set(cacheKey, diskFallback.data);
                                return diskFallback.data;
                            }

                            // Priority 2: wait 5 min and retry with v8 first, then npm
                            console.warn(`  ⏳ No disk cache. Waiting ${RATE_LIMIT_RETRY_WAIT_MS / 60000} min then retrying...`);
                            await delay(RATE_LIMIT_RETRY_WAIT_MS);
                            try {
                                const retryQuote = await fetchOneViaYahooV8(symbol);
                                resultMap.set(symbol, retryQuote);
                                console.log(`  ✓ [v8-retry] ${symbol}: ${retryQuote.regularMarketPrice} ₺`);
                                continue;
                            } catch (v8RetryErr) {
                                console.warn(`  ⚠ [v8-retry] ${symbol}: ${v8RetryErr.message}`);
                            }

                            // Priority 3: mock for remaining npm queue
                            console.warn(`  ⚠ Both sources failed — mock for remaining ${npmQueue.length - i} symbols.`);
                            for (let j = i; j < npmQueue.length; j++) {
                                const s = npmQueue[j];
                                if (!resultMap.has(s)) {
                                    resultMap.set(s, {
                                        symbol: s,
                                        regularMarketPrice: getMockPrice(s),
                                        regularMarketPreviousClose: 0,
                                        regularMarketChangePercent: (Math.random() - 0.5) * 3,
                                        regularMarketVolume: 0,
                                        longName: getStockDisplayName(s),
                                        source: 'mock'
                                    });
                                }
                            }
                            break;
                        }

                        // Non-rate-limit error: mock for this symbol only
                        console.warn(`  ⚠ [npm] ${symbol}: mock fallback (${err.message || err})`);
                        resultMap.set(symbol, {
                            symbol,
                            regularMarketPrice: getMockPrice(symbol),
                            regularMarketPreviousClose: 0,
                            regularMarketChangePercent: (Math.random() - 0.5) * 3,
                            regularMarketVolume: 0,
                            longName: getStockDisplayName(symbol),
                            source: 'mock'
                        });
                    }
                }
            }

            // ── Build final ordered results ────────────────────────────
            const results = symbols.map(sym => resultMap.get(sym) || {
                symbol: sym,
                regularMarketPrice: getMockPrice(sym),
                regularMarketPreviousClose: 0,
                regularMarketChangePercent: (Math.random() - 0.5) * 3,
                regularMarketVolume: 0,
                longName: getStockDisplayName(sym),
                source: 'mock'
            });

            const liveCount = results.filter(r => r.source !== 'mock').length;
            if (liveCount > 0) {
                stockCache.set(cacheKey, results);
                saveCachedStocksToDisk(results);
                const bySource = results.reduce((acc, r) => { acc[r.source] = (acc[r.source] || 0) + 1; return acc; }, {});
                console.log(`✅ Stock cache updated: ${liveCount}/${results.length} live.`, bySource);
            }

            return results;
        } catch (err) {
            console.warn('⚠️ Failed to refresh stock cache:', err.message || err);
            return buildMockStocks(symbols);
        } finally {
            pendingStocksFetch = null;
        }
    })();

    return pendingStocksFetch;
}

function refreshFXCache(symbols, cacheKey) {
    const now = Date.now();
    if (now - lastFXRefresh < REFRESH_COOLDOWN_MS) {
        return pendingFXFetch || Promise.resolve();
    }
    lastFXRefresh = now;

    if (pendingFXFetch) {
        return pendingFXFetch;
    }

    pendingFXFetch = (async () => {
        try {
            console.log(`🔄 [Yahoo-v8] Fetching ${symbols.length} FX/index symbols...`);
            const results = [];

            for (let i = 0; i < symbols.length; i++) {
                const symbol = symbols[i];
                if (i > 0) await delay(500);
                try {
                    const quote = await fetchOneViaYahooV8(symbol);
                    // Calculate change% from prevClose since v8 gives us both
                    const changePercent = (quote.regularMarketPreviousClose > 0)
                        ? ((quote.regularMarketPrice - quote.regularMarketPreviousClose) / quote.regularMarketPreviousClose * 100)
                        : 0;
                    results.push({
                        symbol,
                        regularMarketPrice: quote.regularMarketPrice,
                        regularMarketPreviousClose: quote.regularMarketPreviousClose,
                        regularMarketChange: quote.regularMarketPrice - quote.regularMarketPreviousClose,
                        regularMarketChangePercent: changePercent,
                        source: 'yahoo-v8'
                    });
                    console.log(`  ✓ [v8] ${symbol}: ${quote.regularMarketPrice}`);
                } catch (err) {
                    console.warn(`  ⚠ [v8] ${symbol}: ${err.message} → mock`);
                    results.push({
                        symbol,
                        regularMarketPrice: getMockPrice(symbol),
                        regularMarketChangePercent: (Math.random() - 0.5) * 1,
                        source: 'mock'
                    });
                }
            }

            const liveCount = results.filter(r => r.source !== 'mock').length;
            if (liveCount > 0) {
                stockCache.set(cacheKey, results);
                console.log(`✅ Cached ${liveCount}/${results.length} live FX rates.`);
            }

            return results;
        } catch (err) {
            console.warn('⚠️ Failed to refresh FX cache:', err.message || err);
            return buildMockFX(symbols);
        } finally {
            pendingFXFetch = null;
        }
    })();

    return pendingFXFetch;
}

module.exports = {
    stockCache,
    STOCK_CACHE_KEY,
    refreshStockCache,
    refreshFXCache
};
