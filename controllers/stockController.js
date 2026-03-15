const { getMockPrice, buildMockStocks, buildMockFX, fetchQuote, FETCH_TIMEOUT_MS } = require('../services/yahooService');
const { stockCache, refreshStockCache, refreshFXCache } = require('../services/stockCacheService');

// ============================================================
// STOCK & FX HANDLERS
// ============================================================

exports.getStocks = async (req, res) => {
    const symbols = [
        'DOAS.IS', 'ALTNY.IS', 'ALARK.IS', 'ASELS.IS', 'ASTOR.IS',
        'FROTO.IS', 'ISMEN.IS', 'KLSER.IS', 'EREGL.IS', 'KONTR.IS',
        'MIATK.IS', 'TUPRS.IS', 'SASA.IS', 'EGPRO.IS', 'THYAO.IS'
    ];
    const cacheKey = 'bist_stocks_final';

    try {
        const cached = stockCache.get(cacheKey);
        if (cached) {
            // Keep the cache fresh in the background.
            refreshStockCache(symbols, cacheKey).catch(() => {});
            return res.json(cached);
        }

        // First request after a cache miss: kick off a background refresh and return mock data fast.
        // Subsequent requests will return live results once the refresh succeeds.
        refreshStockCache(symbols, cacheKey).catch(() => {});
        return res.json(buildMockStocks(symbols));
    } catch (err) {
        console.error('Stock controller error:', err);
        return res.status(500).json({
            message: 'Failed to fetch stock data',
            error: err.message
        });
    }
};

exports.getFX = async (req, res) => {
    const fxSymbols = ['^XU100', 'USDTRY=X', 'EURTRY=X', 'GC=F'];
    const cacheKey = 'fx_rates_final';

    try {
        const cached = stockCache.get(cacheKey);
        if (cached) {
            // Refresh cache in background
            refreshFXCache(fxSymbols, cacheKey).catch(() => {});
            return res.json(cached);
        }

        // No cache yet: return mock data fast while we try to refresh in the background
        refreshFXCache(fxSymbols, cacheKey).catch(() => {});
        return res.json(buildMockFX(fxSymbols));
    } catch (err) {
        console.error('FX controller error:', err);
        return res.status(500).json({
            message: 'Failed to fetch FX data',
            error: err.message
        });
    }
};

/** GET /api/stocks/quote/:symbol - single symbol quote (for FX/gram altin etc.) */
exports.getQuote = async (req, res) => {
    const symbol = (req.params.symbol || '').replace(/[^a-zA-Z0-9.=^\-]/g, '');
    if (!symbol) {
        return res.status(400).json({ message: 'Invalid symbol' });
    }
    const { ok, quote } = await fetchQuote(symbol, ['regularMarketPrice', 'regularMarketPreviousClose', 'regularMarketChangePercent']);
    const price = (ok && quote && quote.regularMarketPrice) ? quote.regularMarketPrice : getMockPrice(symbol);
    const prev = (ok && quote && quote.regularMarketPreviousClose) ? quote.regularMarketPreviousClose : price;
    return res.json({
        symbol,
        regularMarketPrice: price,
        regularMarketPreviousClose: prev,
        regularMarketChangePercent: (ok && quote && quote.regularMarketChangePercent) ? quote.regularMarketChangePercent : 0
    });
};

/** POST /api/stocks/clear-cache - clear stock/FX cache for force refresh */
exports.clearCache = (req, res) => {
    try {
        stockCache.flushAll();
        console.log('Stock/FX cache cleared');
        return res.json({ message: 'Cache cleared' });
    } catch (err) {
        return res.status(500).json({ message: 'Failed to clear cache' });
    }
};

// ============================================================
// CHART HISTORICAL DATA
// ============================================================

const VALID_CHART_RANGES = ['1d', '1w', '1m', '3m', '1y', '10y'];

/**
 * Maps a frontend range string to Yahoo Finance v8 chart API query parameters.
 * v8 endpoint: /v8/finance/chart/{symbol}?range={v8Range}&interval={interval}
 */
function toV8ChartParams(range) {
    switch (range) {
        case '1d':  return { v8Range: '1d',  interval: '5m'  };
        case '1w':  return { v8Range: '5d',  interval: '1d'  };
        case '1m':  return { v8Range: '1mo', interval: '1d'  };
        case '3m':  return { v8Range: '3mo', interval: '1d'  };
        case '1y':  return { v8Range: '1y',  interval: '1wk' };
        case '10y': return { v8Range: '10y', interval: '1mo' };
        default:    return { v8Range: '1mo', interval: '1d'  };
    }
}

/**
 * Generates a realistic mock price series for fallback when Yahoo is unavailable.
 * Produces a smooth random-walk starting slightly below the current mock price.
 */
function buildMockChartData(symbol, range) {
    const basePrice = getMockPrice(symbol);
    // Approximate date range for mock data generation
    const now = new Date();
    const rangeDays = { '1d': 7, '1w': 7, '1m': 31, '3m': 93, '1y': 365, '10y': 3650 };
    const days = rangeDays[range] || 31;
    const period1 = new Date(now.getTime() - days * 86400000);
    const msPerDay = 86400000;
    const totalDays = days;

    // Target at most ~60 data points regardless of range
    const step = Math.max(1, Math.floor(totalDays / 60));

    let price = basePrice * 0.85;
    const prices = [];

    for (let d = 0; d <= totalDays; d += step) {
        const date = new Date(period1.getTime() + d * msPerDay);
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekends

        price += (Math.random() - 0.47) * basePrice * 0.02;
        price = Math.max(price, basePrice * 0.4);

        prices.push({
            date: date.getTime(),
            close: parseFloat(price.toFixed(2))
        });
    }

    return prices;
}

/**
 * GET /api/stocks/:symbol/chart?range=1m
 * Returns historical closing prices for Chart.js via Yahoo Finance v8 chart API.
 * Response: { symbol, range, prices: [{ date: ms, close: number }], source: 'yahoo-v8'|'mock' }
 */
exports.getChart = async (req, res) => {
    const symbol = (req.params.symbol || '').replace(/[^a-zA-Z0-9.=^\-]/g, '');
    if (!symbol) {
        return res.status(400).json({ message: 'Invalid symbol' });
    }

    const range = VALID_CHART_RANGES.includes(req.query.range) ? req.query.range : '1m';
    const cacheKey = `chart_${symbol}_${range}`;

    const cached = stockCache.get(cacheKey);
    if (cached) {
        return res.json(cached);
    }

    try {
        const { v8Range, interval } = toV8ChartParams(range);
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${v8Range}&interval=${interval}`;

        console.log(`📈 [v8] Fetching chart: ${symbol} range=${v8Range} interval=${interval}`);

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

        const chartResult = json?.chart?.result?.[0];
        if (!chartResult) {
            const errDesc = json?.chart?.error?.description || 'No chart result';
            throw new Error(`Yahoo v8: ${errDesc}`);
        }

        const timestamps = chartResult.timestamp || [];
        const closes = chartResult.indicators?.quote?.[0]?.close || [];

        const prices = timestamps
            .map((ts, i) => ({ date: ts * 1000, close: closes[i] }))
            .filter(p => p.close != null && !isNaN(p.close))
            .map(p => ({ date: p.date, close: parseFloat(p.close.toFixed(2)) }));

        if (prices.length < 2) {
            throw new Error(`Only ${prices.length} valid price point(s) returned`);
        }

        const result = { symbol, range, prices, source: 'yahoo-v8' };
        stockCache.set(cacheKey, result, 600); // cache 10 minutes
        console.log(`✅ Chart cached: ${symbol} ${range} (${prices.length} points)`);
        return res.json(result);

    } catch (err) {
        console.warn(`⚠️  Chart fetch failed for ${symbol} (${range}):`, err.message || err);

        const mockPrices = buildMockChartData(symbol, range);
        const result = { symbol, range, prices: mockPrices, source: 'mock' };
        stockCache.set(cacheKey, result, 300); // cache mock for 5 minutes
        return res.json(result);
    }
};
