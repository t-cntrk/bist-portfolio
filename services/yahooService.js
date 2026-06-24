const yahooFinance = require('yahoo-finance2').default;

yahooFinance.suppressNotices(['yahooSurvey']);

// Timeout for external Yahoo Finance calls (ms)
const FETCH_TIMEOUT_MS = 5000;

// How many times to retry after a rate-limit response
const RETRY_AFTER_RATE_LIMIT = 2;

// Base backoff wait time (ms) — doubled on each retry
const RATE_LIMIT_WAIT_MS = 5000;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Yahoo often returns 429 "Too Many Requests" (body is plain text, not JSON)
const isRateLimitError = (err) =>
    (err && err.message && (err.message.includes('Too Many Requests') || err.message.includes('is not valid JSON'))) ||
    (err && err.statusCode === 429);

/**
 * Returns a realistic mock price for development when Yahoo is unavailable.
 */
const getMockPrice = (symbol) => {
    const basePrices = {
        'DOAS.IS': 250.5, 'ALTNY.IS': 85.2, 'ALARK.IS': 115.0,
        'ASELS.IS': 62.3, 'ASTOR.IS': 95.8, 'FROTO.IS': 1050.0,
        'ISMEN.IS': 35.4, 'KLSER.IS': 68.9, 'EREGL.IS': 45.1,
        'KONTR.IS': 210.5, 'MIATK.IS': 55.2, 'TUPRS.IS': 165.4,
        'SASA.IS': 38.9, 'EGPRO.IS': 215.0, 'THYAO.IS': 285.5,
        '^XU100': 9150.0, 'USDTRY=X': 31.2, 'EURTRY=X': 33.8, 'GC=F': 2050.5
    };
    const base = basePrices[symbol] || 100;
    return base + (Math.random() - 0.5) * (base * 0.02);
};

// Curated Turkish display names. Keep these in sync with the frontend's
// getStockName() in public/js/stocks.js (same symbols/names, without ".IS").
const getStockDisplayName = (symbol) => {
    const names = {
        'DOAS.IS': 'Doğuş Otomotiv',
        'ALTNY.IS': 'Altınay Savunma',
        'ALARK.IS': 'Alarko Holding',
        'ASELS.IS': 'Aselsan',
        'ASTOR.IS': 'Astor Enerji',
        'FROTO.IS': 'Ford Otosan',
        'ISMEN.IS': 'İş Yatırım Menkul Değerler',
        'KLSER.IS': 'Kaleseramik',
        'EREGL.IS': 'Ereğli Demir ve Çelik',
        'KONTR.IS': 'Kontrolmatik Teknoloji',
        'MIATK.IS': 'Mia Teknoloji',
        'TUPRS.IS': 'Tüpraş',
        'SASA.IS': 'Sasa Polyester',
        'EGPRO.IS': 'Ege Profil',
        'THYAO.IS': 'Türk Hava Yolları'
    };
    return names[symbol] || symbol.replace('.IS', '');
};

function buildMockStocks(symbols) {
    return symbols.map(symbol => ({
        symbol,
        regularMarketPrice: getMockPrice(symbol),
        regularMarketChangePercent: 0,
        longName: getStockDisplayName(symbol),
        source: 'mock'
    }));
}

function buildMockFX(symbols) {
    return symbols.map(symbol => ({
        symbol,
        regularMarketPrice: getMockPrice(symbol),
        regularMarketChangePercent: 0,
        source: 'mock'
    }));
}

// ============================================================
// YAHOO FINANCE v8 DIRECT HTTP HELPER
// ============================================================
// Uses Yahoo's public chart endpoint which has a separate (more lenient)
// rate limit from the crumb-based quote API used by yahoo-finance2.
// Returns the same shape as yahoo-finance2 quote objects.

async function fetchOneViaYahooV8(symbol) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2d&interval=1d`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

    let json;
    try {
        const resp = await fetch(url, {
            signal: ctrl.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        json = await resp.json();
    } finally {
        clearTimeout(timer);
    }

    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta || !meta.regularMarketPrice) {
        const errMsg = json?.chart?.error?.description || 'No data';
        throw new Error(`Yahoo v8: ${errMsg}`);
    }

    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose ?? 0;
    const changePercent = prevClose > 0 ? ((price - prevClose) / prevClose * 100) : 0;

    return {
        symbol,
        regularMarketPrice: price,
        regularMarketPreviousClose: prevClose,
        regularMarketChangePercent: changePercent,
        regularMarketVolume: meta.regularMarketVolume ?? 0,
        longName: meta.longName || getStockDisplayName(symbol),
        source: 'yahoo-v8'
    };
}

/**
 * Fetch multiple quotes in ONE request (Yahoo API supports comma-separated symbols).
 * Reduces 429 rate limits vs. one request per symbol.
 * Falls back to per-symbol fetches if the batch request is rate-limited.
 */
async function fetchQuotes(symbols, options = {}) {
    if (process.env.USE_MOCK_DATA === 'true') {
        const list = symbols.map(symbol => ({
            symbol,
            regularMarketPrice: getMockPrice(symbol),
            regularMarketChangePercent: 0,
            longName: symbol
        }));
        return { ok: true, results: list };
    }

    const fields = options.fields || ['regularMarketPrice', 'regularMarketPreviousClose', 'regularMarketChangePercent', 'longName', 'regularMarketVolume'];

    const queryHost = Math.random() < 0.5 ? 'query1.finance.yahoo.com' : 'query2.finance.yahoo.com';
    const requestOptions = {
        fields,
        YF_QUERY_HOST: queryHost,
        fetchOptions: {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://finance.yahoo.com/',
                'Connection': 'keep-alive'
            }
        }
    };

    for (let attempt = 0; attempt <= RETRY_AFTER_RATE_LIMIT; attempt++) {
        try {
            const fetchPromise = yahooFinance.quote(symbols, requestOptions);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), FETCH_TIMEOUT_MS));

            const results = await Promise.race([fetchPromise, timeoutPromise]);
            const list = Array.isArray(results) ? results : (results ? [results] : []);
            return { ok: true, results: list };
        } catch (err) {
            if (isRateLimitError(err) && attempt < RETRY_AFTER_RATE_LIMIT) {
                const backoff = RATE_LIMIT_WAIT_MS * Math.pow(2, attempt);
                console.warn(`⚠️  Yahoo rate limit or timeout (attempt ${attempt + 1}), waiting ${backoff / 1000}s before retry...`);
                await delay(backoff);
                continue;
            }

            console.warn(`⚠️  Yahoo batch fetch failed (attempt ${attempt + 1}):`, err.message || err);
            break;
        }
    }

    // Fall back to fetching each symbol separately (slower but often avoids throttling).
    const perSymbolDelay = 1500;
    const individualResults = [];

    for (let i = 0; i < symbols.length; i++) {
        const symbol = symbols[i];
        let rateLimited = false;

        try {
            const quote = await (async () => {
                for (let attempt = 0; attempt <= RETRY_AFTER_RATE_LIMIT; attempt++) {
                    try {
                        const fetchPromise = yahooFinance.quote(symbol, requestOptions);
                        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), FETCH_TIMEOUT_MS));
                        return await Promise.race([fetchPromise, timeoutPromise]);
                    } catch (innerErr) {
                        if (isRateLimitError(innerErr) && attempt < RETRY_AFTER_RATE_LIMIT) {
                            const backoff = RATE_LIMIT_WAIT_MS * Math.pow(2, attempt);
                            console.warn(`⚠️  Yahoo per-symbol rate limit (symbol=${symbol}, attempt ${attempt + 1}), waiting ${backoff / 1000}s...`);
                            await delay(backoff);
                            continue;
                        }
                        throw innerErr;
                    }
                }
                throw new Error('Exceeded retries');
            })();

            if (quote) {
                individualResults.push(quote);
            } else {
                throw new Error('Empty quote');
            }
        } catch (innerErr) {
            rateLimited = isRateLimitError(innerErr);
            console.warn(`⚠️  Yahoo quote failed for ${symbol}, using mock:`, innerErr.message || innerErr);
            individualResults.push({
                symbol,
                regularMarketPrice: getMockPrice(symbol),
                regularMarketChangePercent: 0,
                longName: symbol,
                source: 'mock'
            });
        }

        if (rateLimited) {
            console.warn('⚠️  Rate limited by Yahoo; aborting remaining symbols to avoid further throttling.');
            for (let j = i + 1; j < symbols.length; j++) {
                const s = symbols[j];
                individualResults.push({
                    symbol: s,
                    regularMarketPrice: getMockPrice(s),
                    regularMarketChangePercent: 0,
                    longName: s,
                    source: 'mock'
                });
            }
            break;
        }

        await delay(perSymbolDelay);
    }

    return { ok: true, results: individualResults };
}

/** Single-symbol quote (for getQuote endpoint: GC=F, USDTRY=X, individual stocks). */
async function fetchQuote(symbol, fields = ['regularMarketPrice', 'regularMarketPreviousClose', 'regularMarketChangePercent']) {
    // 1. Yahoo Finance v8 direct HTTP (fastest, no crumb/auth needed)
    try {
        const quote = await fetchOneViaYahooV8(symbol);
        if (quote && quote.regularMarketPrice) {
            return { ok: true, quote };
        }
    } catch (err) {
        console.warn(`  [v8] fetchQuote ${symbol} failed, trying npm: ${err.message}`);
    }

    // 2. yahoo-finance2 npm fallback → 3. mock (handled inside fetchQuotes)
    const { ok, results } = await fetchQuotes([symbol], { fields });
    const quote = ok && results && results[0] ? results[0] : null;
    return { ok: !!quote, quote };
}

module.exports = {
    FETCH_TIMEOUT_MS,
    RETRY_AFTER_RATE_LIMIT,
    RATE_LIMIT_WAIT_MS,
    delay,
    isRateLimitError,
    getMockPrice,
    getStockDisplayName,
    buildMockStocks,
    buildMockFX,
    fetchOneViaYahooV8,
    fetchQuotes,
    fetchQuote
};
