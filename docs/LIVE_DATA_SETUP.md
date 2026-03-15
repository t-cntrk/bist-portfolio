# Setup Guide for Live Stock Data

This BIST Stocks Dashboard supports multiple data sources for live stock pricing:

## Option 1: Yahoo Finance (Default)

The server automatically fetches live prices from Yahoo Finance v8 HTTP API.
No API key required.

### Features:
- ✅ Free, no registration required
- ✅ Supports BIST symbols (e.g., DOAS.IS, TUPRS.IS)
- ✅ Supports FX pairs (USDTRY=X, EURTRY=X) and commodities (GC=F)
- ⚠️ Has rate limiting on high-volume requests (handled with 2s delays + retry)

## Option 2: Mock Data (Development)

For testing without live API calls:
```
USE_MOCK_DATA=true
```

## Response Examples

### Live Data (Yahoo):
```json
{
  "symbol": "DOAS.IS",
  "regularMarketPrice": 248.50,
  "regularMarketChangePercent": 1.23,
  "source": "yahoo"
}
```

### Mock Data (Fallback):
```json
{
  "symbol": "DOAS.IS",
  "regularMarketPrice": 249.91,
  "regularMarketChangePercent": 0,
  "source": "mock"
}
```

## Caching

The server caches quotes for 30 minutes (configurable via `STOCK_CACHE_TTL` env var). Recently fetched data is persisted to disk in `cache/stockCache.json`, allowing the API to serve the last known prices even if the upstream API is temporarily unavailable.

## Testing

```bash
curl http://localhost:3000/api/stocks
```

Look for `"source":"yahoo"` in the response to confirm live data is being used.

## Troubleshooting

- **Still seeing "mock" data**: Check server logs for API errors; Yahoo may be rate-limiting
- **Prices not updating**: Force a cache clear: `curl -X POST http://localhost:3000/api/stocks/clear-cache`
- **Rate limiting from Yahoo**: Handled automatically with retry and exponential backoff
