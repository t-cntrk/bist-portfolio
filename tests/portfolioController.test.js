// Integration tests for the portfolio endpoints (ANALYSIS 4.3).
// Exercises the REAL router chain — authenticateToken (JWT), validateCSRF, the
// express-validator rules, and the controller — with only the SQLite connection
// replaced by an in-memory fake. No real DB, no network.
process.env.JWT_SECRET = 'test-secret-at-least-16-chars-long';

// ── In-memory DB double (behaves like the sqlite3 callback API used by the
// controller: cb is invoked with `this` bound to { lastID, changes }). ─────────
const mockStore = { rows: [], seq: 0, txRows: [], txSeq: 0 };
const mockDb = {
    all(sql, params, cb) {
        if (/FROM transactions/i.test(sql)) {
            // getTransactions: WHERE user_id = ? [AND symbol = ?] ORDER BY newest first
            const userId = params[0];
            const symbol = params.length > 1 ? params[1] : null;
            const rows = mockStore.txRows
                .filter(r => r.user_id === userId && (!symbol || r.symbol === symbol))
                .slice()
                .sort((a, b) => b.id - a.id);
            return cb(null, rows);
        }
        const userId = params[0];
        const rows = mockStore.rows
            .filter(r => r.user_id === userId)
            .map(({ id, symbol, quantity, purchase_price, type }) => ({ id, symbol, quantity, purchase_price, type }));
        cb(null, rows);
    },
    get(sql, params, cb) {
        // addAsset lookup: WHERE user_id = ? AND symbol = ? AND type = ?
        const [userId, symbol, type] = params;
        const row = mockStore.rows.find(r => r.user_id === userId && r.symbol === symbol && r.type === type);
        cb(null, row);
    },
    run(sql, params, cb) {
        if (/INSERT INTO transactions/i.test(sql)) {
            const [user_id, symbol, asset_type, transaction_type, quantity, unit_price, total_amount] = params;
            const id = ++mockStore.txSeq;
            mockStore.txRows.push({ id, user_id, symbol, asset_type, transaction_type, quantity, unit_price, total_amount, created_at: '2026-07-03 06:00:00' });
            return cb.call({ lastID: id, changes: 1 }, null);
        }
        if (/^\s*UPDATE/i.test(sql)) {
            const [quantity, purchase_price, id, userId] = params;
            const row = mockStore.rows.find(r => r.id === id && r.user_id === userId);
            if (!row) return cb.call({ changes: 0 }, null);
            row.quantity = quantity;
            row.purchase_price = purchase_price;
            return cb.call({ changes: 1 }, null);
        }
        if (/^\s*INSERT/i.test(sql)) {
            const [user_id, symbol, quantity, purchase_price, type] = params;
            const dup = mockStore.rows.find(r => r.user_id === user_id && r.symbol === symbol && r.type === type);
            if (dup) {
                const e = new Error('UNIQUE constraint failed');
                e.code = 'SQLITE_CONSTRAINT';
                return cb.call({ lastID: 0, changes: 0 }, e);
            }
            const id = ++mockStore.seq;
            mockStore.rows.push({ id, user_id, symbol, quantity, purchase_price, type });
            return cb.call({ lastID: id, changes: 1 }, null);
        }
        if (/^\s*DELETE/i.test(sql)) {
            const [assetId, userId] = params;
            const idx = mockStore.rows.findIndex(r => String(r.id) === String(assetId) && r.user_id === userId);
            if (idx === -1) return cb.call({ changes: 0 }, null);
            mockStore.rows.splice(idx, 1);
            return cb.call({ changes: 1 }, null);
        }
        return cb.call({ changes: 0 }, null);
    }
};
jest.mock('../services/databaseService', () => ({ getConnection: () => mockDb }));

const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { csrfTokens } = require('../middleware/securityMiddleware');

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api', require('../routes/portfolioRoutes'));
    return app;
}
const app = makeApp();

// Build the cookies + CSRF header a mutating request needs for a given user.
function creds(userId) {
    const authToken = jwt.sign({ id: userId, username: 'user' + userId }, process.env.JWT_SECRET);
    const sessionId = 'sess-' + userId;
    const csrf = 'csrf-' + userId;
    csrfTokens.set(sessionId, { token: csrf, timestamp: Date.now() });
    return { cookie: [`authToken=${authToken}`, `sessionId=${sessionId}`], csrf };
}

function addAsset(userId, body) {
    const c = creds(userId);
    return request(app).post('/api/portfolio').set('Cookie', c.cookie).set('x-csrf-token', c.csrf).send(body);
}
function getPortfolio(userId) {
    const c = creds(userId);
    return request(app).get('/api/portfolio').set('Cookie', c.cookie);
}
function deleteAsset(userId, id) {
    const c = creds(userId);
    return request(app).delete('/api/portfolio/' + id).set('Cookie', c.cookie).set('x-csrf-token', c.csrf);
}
function getTransactions(userId) {
    const c = creds(userId);
    return request(app).get('/api/portfolio/transactions').set('Cookie', c.cookie);
}

const VALID = { symbol: 'THYAO.IS', quantity: 10, purchase: 100, type: 'stock' };

beforeEach(() => {
    mockStore.rows = [];
    mockStore.seq = 0;
    mockStore.txRows = [];
    mockStore.txSeq = 0;
    csrfTokens.clear();
});

describe('portfolio — authentication required', () => {
    test('GET without auth cookie → 401', async () => {
        const res = await request(app).get('/api/portfolio');
        expect(res.status).toBe(401);
    });
    test('POST without auth cookie → 401', async () => {
        const res = await request(app).post('/api/portfolio').send(VALID);
        expect(res.status).toBe(401);
    });
    test('DELETE without auth cookie → 401', async () => {
        const res = await request(app).delete('/api/portfolio/1');
        expect(res.status).toBe(401);
    });
    test('POST with auth but no CSRF token → 403', async () => {
        const authToken = jwt.sign({ id: 1, username: 'u1' }, process.env.JWT_SECRET);
        const res = await request(app).post('/api/portfolio').set('Cookie', [`authToken=${authToken}`]).send(VALID);
        expect(res.status).toBe(403);
    });
});

describe('portfolio — ownership isolation', () => {
    test("user A cannot see or delete user B's records; A sees only its own", async () => {
        const a = await addAsset(1, { symbol: 'THYAO.IS', quantity: 5, purchase: 50, type: 'stock' });
        const b = await addAsset(2, { symbol: 'ASELS.IS', quantity: 3, purchase: 30, type: 'stock' });
        expect(a.status).toBe(200);
        expect(b.status).toBe(200);
        const bId = b.body.id;

        // A's portfolio contains only A's symbol
        const listA = await getPortfolio(1);
        expect(listA.status).toBe(200);
        expect(listA.body.map(r => r.symbol)).toEqual(['THYAO.IS']);
        expect(listA.body.some(r => r.symbol === 'ASELS.IS')).toBe(false);

        // A deleting B's row → 404 (no enumeration), and B's row survives
        const del = await deleteAsset(1, bId);
        expect(del.status).toBe(404);
        const listB = await getPortfolio(2);
        expect(listB.body.map(r => r.symbol)).toEqual(['ASELS.IS']);
    });

    test('deleting a non-existent id → 404', async () => {
        const res = await deleteAsset(1, 9999);
        expect(res.status).toBe(404);
    });

    test('user can delete its own record → 200 and it is gone', async () => {
        const add = await addAsset(1, VALID);
        const del = await deleteAsset(1, add.body.id);
        expect(del.status).toBe(200);
        const list = await getPortfolio(1);
        expect(list.body).toHaveLength(0);
    });
});

describe('portfolio — symbol / type validation', () => {
    test('valid FX symbol + type fx → 200', async () => {
        const res = await addAsset(1, { symbol: 'USDTRY=X', quantity: 100, purchase: 30.5, type: 'fx' });
        expect(res.status).toBe(200);
    });
    test('symbol with HTML/script payload → 400 (XSS regression guard)', async () => {
        const res = await addAsset(1, { symbol: "'><img src=x onerror=alert(1)>", quantity: 1, purchase: 1, type: 'stock' });
        expect(res.status).toBe(400);
        // Nothing was persisted
        const list = await getPortfolio(1);
        expect(list.body).toHaveLength(0);
    });
    test('empty symbol → 400', async () => {
        const res = await addAsset(1, { symbol: '', quantity: 1, purchase: 1, type: 'stock' });
        expect(res.status).toBe(400);
    });
    test('symbol longer than 50 chars → 400', async () => {
        const res = await addAsset(1, { symbol: 'A'.repeat(51), quantity: 1, purchase: 1, type: 'stock' });
        expect(res.status).toBe(400);
    });
    test('invalid type → 400', async () => {
        const res = await addAsset(1, { symbol: 'THYAO.IS', quantity: 1, purchase: 1, type: 'crypto' });
        expect(res.status).toBe(400);
    });
});

describe('portfolio — repeated buys merge with weighted average', () => {
    test('buying more of the same symbol+type sums quantity and averages price', async () => {
        const first = await addAsset(1, { symbol: 'USDTRY=X', quantity: 50, purchase: 50, type: 'fx' });
        expect(first.status).toBe(200);

        const second = await addAsset(1, { symbol: 'USDTRY=X', quantity: 30, purchase: 30, type: 'fx' });
        expect(second.status).toBe(200);

        // Same position updated in place (no new row, same id)
        expect(second.body.id).toBe(first.body.id);
        const list = await getPortfolio(1);
        expect(list.body).toHaveLength(1);

        const pos = list.body[0];
        expect(pos.quantity).toBe(80);                 // 50 + 30
        expect(pos.purchase_price).toBeCloseTo(42.5, 6); // (50*50 + 30*30) / 80
    });

    test("another user's identical symbol is not affected by the merge", async () => {
        await addAsset(1, { symbol: 'THYAO.IS', quantity: 10, purchase: 100, type: 'stock' });
        await addAsset(2, { symbol: 'THYAO.IS', quantity: 5, purchase: 200, type: 'stock' });
        // User 1 buys more
        await addAsset(1, { symbol: 'THYAO.IS', quantity: 10, purchase: 300, type: 'stock' });

        const list1 = await getPortfolio(1);
        expect(list1.body).toHaveLength(1);
        expect(list1.body[0].quantity).toBe(20);                 // 10 + 10
        expect(list1.body[0].purchase_price).toBeCloseTo(200, 6); // (100*10 + 300*10)/20

        const list2 = await getPortfolio(2);
        expect(list2.body).toHaveLength(1);
        expect(list2.body[0].quantity).toBe(5);                  // untouched
        expect(list2.body[0].purchase_price).toBe(200);
    });

    test('same symbol with a different type stays a separate position', async () => {
        await addAsset(1, { symbol: 'GC=F', quantity: 2, purchase: 1000, type: 'fx' });
        await addAsset(1, { symbol: 'GC=F', quantity: 3, purchase: 2000, type: 'stock' });

        const list = await getPortfolio(1);
        expect(list.body).toHaveLength(2);
        const fx = list.body.find(r => r.type === 'fx');
        const stock = list.body.find(r => r.type === 'stock');
        expect(fx.quantity).toBe(2);
        expect(stock.quantity).toBe(3);
    });
});

describe('portfolio — transaction history ledger', () => {
    test('GET /portfolio/transactions without auth → 401', async () => {
        const res = await request(app).get('/api/portfolio/transactions');
        expect(res.status).toBe(401);
    });

    test('a buy records one transaction with the correct details', async () => {
        await addAsset(1, { symbol: 'USDTRY=X', quantity: 50, purchase: 50, type: 'fx' });

        const tx = await getTransactions(1);
        expect(tx.status).toBe(200);
        expect(tx.body).toHaveLength(1);
        const t = tx.body[0];
        expect(t.symbol).toBe('USDTRY=X');
        expect(t.asset_type).toBe('fx');
        expect(t.transaction_type).toBe('buy');
        expect(t.quantity).toBe(50);
        expect(t.unit_price).toBe(50);
        expect(t.total_amount).toBe(2500); // 50 * 50
    });

    test('repeated buys append a ledger row each while the position merges', async () => {
        await addAsset(1, { symbol: 'USDTRY=X', quantity: 50, purchase: 50, type: 'fx' });
        await addAsset(1, { symbol: 'USDTRY=X', quantity: 30, purchase: 30, type: 'fx' });

        // Ledger has BOTH buys (with their own prices), newest first
        const tx = await getTransactions(1);
        expect(tx.body).toHaveLength(2);
        expect(tx.body.map(t => t.unit_price)).toEqual([30, 50]);
        expect(tx.body.map(t => t.total_amount)).toEqual([900, 2500]);

        // Position is still a single merged row (weighted average)
        const list = await getPortfolio(1);
        expect(list.body).toHaveLength(1);
        expect(list.body[0].quantity).toBe(80);
        expect(list.body[0].purchase_price).toBeCloseTo(42.5, 6);
    });

    test("transactions are scoped per user", async () => {
        await addAsset(1, { symbol: 'THYAO.IS', quantity: 10, purchase: 100, type: 'stock' });
        await addAsset(2, { symbol: 'ASELS.IS', quantity: 5, purchase: 50, type: 'stock' });

        const tx1 = await getTransactions(1);
        expect(tx1.body).toHaveLength(1);
        expect(tx1.body[0].symbol).toBe('THYAO.IS');

        const tx2 = await getTransactions(2);
        expect(tx2.body).toHaveLength(1);
        expect(tx2.body[0].symbol).toBe('ASELS.IS');
    });
});

describe('portfolio — numeric validation', () => {
    test('quantity = 0 → 400', async () => {
        const res = await addAsset(1, { symbol: 'THYAO.IS', quantity: 0, purchase: 10, type: 'stock' });
        expect(res.status).toBe(400);
    });
    test('quantity negative → 400', async () => {
        const res = await addAsset(1, { symbol: 'THYAO.IS', quantity: -5, purchase: 10, type: 'stock' });
        expect(res.status).toBe(400);
    });
    test('purchase = 0 → 400', async () => {
        const res = await addAsset(1, { symbol: 'THYAO.IS', quantity: 5, purchase: 0, type: 'stock' });
        expect(res.status).toBe(400);
    });
    test('non-numeric quantity → 400', async () => {
        const res = await addAsset(1, { symbol: 'THYAO.IS', quantity: 'abc', purchase: 10, type: 'stock' });
        expect(res.status).toBe(400);
    });
    test('absurdly large quantity → 400', async () => {
        const res = await addAsset(1, { symbol: 'THYAO.IS', quantity: 1e300, purchase: 10, type: 'stock' });
        expect(res.status).toBe(400);
    });
    test('absurdly large purchase price → 400', async () => {
        const res = await addAsset(1, { symbol: 'THYAO.IS', quantity: 10, purchase: 1e300, type: 'stock' });
        expect(res.status).toBe(400);
    });
});
