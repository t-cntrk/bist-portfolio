// Unit tests for the stock cache refresh cooldown logic (ANALYSIS 2.2).
// A failed refresh must NOT lock refreshing for the full cooldown; a successful
// one must. Concurrent calls must share one in-flight fetch. Yahoo and fs are
// mocked so nothing hits the network or disk.

// Neutralize disk cache load at module require time so `lastStockRefresh` starts
// at 0 (otherwise a fresh on-disk cache would engage the success cooldown).
jest.mock('fs', () => {
    const actual = jest.requireActual('fs');
    return {
        ...actual,
        existsSync: jest.fn(() => false),
        mkdirSync: jest.fn(),
        writeFileSync: jest.fn(),
        readFileSync: jest.fn(() => '')
    };
});

jest.mock('../services/yahooService', () => ({
    delay: () => Promise.resolve(),
    isRateLimitError: () => false,
    getMockPrice: () => 1,
    getStockDisplayName: (s) => s,
    buildMockStocks: (syms) => syms.map((s) => ({ symbol: s, source: 'mock' })),
    buildMockFX: (syms) => syms.map((s) => ({ symbol: s, source: 'mock' })),
    fetchOneViaYahooV8: jest.fn(),
    fetchQuotes: jest.fn(),
    FETCH_TIMEOUT_MS: 100
}));

const yahoo = require('../services/yahooService');
const { refreshStockCache } = require('../services/stockCacheService');

const SYMBOLS = ['A.IS'];
const MIN = 60 * 1000;

// Controllable clock so cooldown windows can be crossed without real waiting.
let nowVal = 0;
beforeAll(() => jest.spyOn(Date, 'now').mockImplementation(() => nowVal));
afterAll(() => Date.now.mockRestore());

const liveQuote = (sym) => ({
    symbol: sym,
    regularMarketPrice: 10,
    regularMarketPreviousClose: 9,
    regularMarketVolume: 100,
    longName: 'X',
    source: 'yahoo-v8'
});
// v8 "resolved but not live" — produces liveCount 0, i.e. a failed refresh.
const deadQuote = (sym) => ({ symbol: sym, regularMarketPrice: 1, regularMarketPreviousClose: 1, source: 'mock' });

const calls = () => yahoo.fetchOneViaYahooV8.mock.calls.length;

describe('refreshStockCache cooldown (ANALYSIS 2.2)', () => {
    test('a failed refresh retries after the short cooldown, not the full one', async () => {
        yahoo.fetchOneViaYahooV8.mockImplementation((s) => Promise.resolve(deadQuote(s)));
        nowVal = 1_000_000_000_000;

        await refreshStockCache(SYMBOLS, 'kA');
        expect(calls()).toBe(1); // attempt 1

        nowVal += 30 * 1000; // +30s (< 1 min retry cooldown)
        await refreshStockCache(SYMBOLS, 'kA');
        expect(calls()).toBe(1); // throttled — no new attempt

        nowVal += 90 * 1000; // now +2 min total (> 1 min retry, far below 29 min)
        await refreshStockCache(SYMBOLS, 'kA');
        expect(calls()).toBe(2); // retried — NOT locked for the full cooldown
    });

    test('a successful refresh engages the full cooldown', async () => {
        yahoo.fetchOneViaYahooV8.mockImplementation((s) => Promise.resolve(liveQuote(s)));
        nowVal = 1_000_100_000_000;

        await refreshStockCache(SYMBOLS, 'kB');
        expect(calls()).toBe(1); // success

        nowVal += 5 * MIN; // +5 min (< 29 min)
        await refreshStockCache(SYMBOLS, 'kB');
        expect(calls()).toBe(1); // blocked by the full cooldown

        nowVal += 30 * MIN; // +35 min (> 29 min)
        await refreshStockCache(SYMBOLS, 'kB');
        expect(calls()).toBe(2); // cooldown elapsed — refetches
    });

    test('a concurrent call shares the in-flight fetch instead of duplicating it', async () => {
        let resolveFetch;
        yahoo.fetchOneViaYahooV8.mockImplementation(
            (s) => new Promise((res) => { resolveFetch = () => res(liveQuote(s)); })
        );
        nowVal = 1_000_200_000_000;

        const p1 = refreshStockCache(SYMBOLS, 'kC');
        const p2 = refreshStockCache(SYMBOLS, 'kC'); // in-flight → should share p1
        expect(calls()).toBe(1); // only one fetch started

        resolveFetch();
        await Promise.all([p1, p2]);
        expect(calls()).toBe(1);
    });
});
