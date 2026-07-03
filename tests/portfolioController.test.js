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
            // Buy INSERT has no realized_pl column; sell INSERT appends it as param 8.
            const hasRealized = /realized_pl/i.test(sql);
            const [user_id, symbol, asset_type, transaction_type, quantity, unit_price, total_amount, currency] = params;
            const realized_pl = hasRealized ? params[8] : null;
            const id = ++mockStore.txSeq;
            mockStore.txRows.push({ id, user_id, symbol, asset_type, transaction_type, quantity, unit_price, total_amount, currency, realized_pl, created_at: '2026-07-03 06:00:00' });
            return cb.call({ lastID: id, changes: 1 }, null);
        }
        if (/^\s*UPDATE/i.test(sql)) {
            if (/quantity = quantity -/i.test(sql)) {
                // Partial sell decrement: WHERE id=? AND user_id=? AND quantity >= ?
                const [sellQty, id, userId, minQty] = params;
                const row = mockStore.rows.find(r => r.id === id && r.user_id === userId && r.quantity >= minQty);
                if (!row) return cb.call({ changes: 0 }, null);
                row.quantity = row.quantity - sellQty;
                return cb.call({ changes: 1 }, null);
            }
            // addAsset merge update: SET quantity=?, purchase_price=? WHERE id=? AND user_id=?
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
            if (/quantity >=/i.test(sql)) {
                // Full sell delete: WHERE id=? AND user_id=? AND quantity >= ?
                const [id, userId, minQty] = params;
                const idx = mockStore.rows.findIndex(r => r.id === id && r.user_id === userId && r.quantity >= minQty);
                if (idx === -1) return cb.call({ changes: 0 }, null);
                mockStore.rows.splice(idx, 1);
                return cb.call({ changes: 1 }, null);
            }
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
function sellAsset(userId, body) {
    const c = creds(userId);
    return request(app).post('/api/portfolio/sell').set('Cookie', c.cookie).set('x-csrf-token', c.csrf).send(body);
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

describe('portfolio — sell transactions', () => {
    // Sets up the scenario from the spec: buy 50@50 then 30@30 → 80 @ avg 42.50.
    async function buildPosition(userId = 1) {
        await addAsset(userId, { symbol: 'THYAO.IS', quantity: 50, purchase: 50, type: 'stock' });
        await addAsset(userId, { symbol: 'THYAO.IS', quantity: 30, purchase: 30, type: 'stock' });
    }

    test('partial sell: quantity drops, average cost unchanged, realized P/L correct', async () => {
        await buildPosition(1);

        const sell = await sellAsset(1, { symbol: 'THYAO.IS', quantity: 20, price: 60, type: 'stock' });
        expect(sell.status).toBe(200);
        expect(sell.body.closed).toBe(false);
        expect(sell.body.remaining).toBeCloseTo(60, 6);          // 80 - 20
        expect(sell.body.purchase_price).toBeCloseTo(42.5, 6);   // avg cost preserved
        // realized P/L = 20 * (60 - 42.50) = 350
        expect(sell.body.realized_pl).toBeCloseTo(350, 6);

        // Position reflects the sell; average cost is untouched.
        const list = await getPortfolio(1);
        expect(list.body).toHaveLength(1);
        expect(list.body[0].quantity).toBeCloseTo(60, 6);
        expect(list.body[0].purchase_price).toBeCloseTo(42.5, 6);
    });

    test('partial sell appends a SELL row to the append-only ledger with persisted P/L', async () => {
        await buildPosition(1);
        await sellAsset(1, { symbol: 'THYAO.IS', quantity: 20, price: 60, type: 'stock' });

        const tx = await getTransactions(1);
        // 2 buys + 1 sell, newest first
        expect(tx.body).toHaveLength(3);
        const sellRow = tx.body[0];
        expect(sellRow.transaction_type).toBe('sell');
        expect(sellRow.quantity).toBe(20);
        expect(sellRow.unit_price).toBe(60);
        expect(sellRow.total_amount).toBe(1200);      // 20 * 60 proceeds
        expect(sellRow.realized_pl).toBeCloseTo(350, 6);
        expect(sellRow.currency).toBe('TRY');         // exposed so the UI can label amounts

        // The original BUY rows are untouched (append-only): still 2 buys, P/L null.
        const buys = tx.body.filter(t => t.transaction_type === 'buy');
        expect(buys).toHaveLength(2);
        buys.forEach(b => expect(b.realized_pl == null).toBe(true));
    });

    test('full sell: position removed, history intact, realized P/L recorded', async () => {
        await buildPosition(1);
        // sell everything: 80 @ 40 → realized P/L = 80 * (40 - 42.50) = -200 (a loss)
        const sell = await sellAsset(1, { symbol: 'THYAO.IS', quantity: 80, price: 40, type: 'stock' });
        expect(sell.status).toBe(200);
        expect(sell.body.closed).toBe(true);
        expect(sell.body.remaining).toBe(0);
        expect(sell.body.realized_pl).toBeCloseTo(-200, 6);

        // Position is gone.
        const list = await getPortfolio(1);
        expect(list.body).toHaveLength(0);

        // History survives: 2 buys + 1 sell.
        const tx = await getTransactions(1);
        expect(tx.body).toHaveLength(3);
        expect(tx.body.filter(t => t.transaction_type === 'sell')).toHaveLength(1);
        expect(tx.body.filter(t => t.transaction_type === 'buy')).toHaveLength(2);
    });

    test('sequential partial sells keep average cost fixed and P/L per-sale correct', async () => {
        await buildPosition(1); // 80 @ 42.50

        const s1 = await sellAsset(1, { symbol: 'THYAO.IS', quantity: 30, price: 50, type: 'stock' });
        expect(s1.body.remaining).toBeCloseTo(50, 6);
        expect(s1.body.realized_pl).toBeCloseTo(30 * (50 - 42.5), 6); // 225

        const s2 = await sellAsset(1, { symbol: 'THYAO.IS', quantity: 50, price: 30, type: 'stock' });
        expect(s2.body.closed).toBe(true);
        expect(s2.body.realized_pl).toBeCloseTo(50 * (30 - 42.5), 6); // -625

        const list = await getPortfolio(1);
        expect(list.body).toHaveLength(0);
    });

    test('selling more than owned → 400 and nothing changes', async () => {
        await buildPosition(1); // 80 owned
        const sell = await sellAsset(1, { symbol: 'THYAO.IS', quantity: 81, price: 60, type: 'stock' });
        expect(sell.status).toBe(400);

        // Position untouched, no SELL row appended.
        const list = await getPortfolio(1);
        expect(list.body[0].quantity).toBe(80);
        const tx = await getTransactions(1);
        expect(tx.body.some(t => t.transaction_type === 'sell')).toBe(false);
    });

    test('selling an asset not in the portfolio → 404', async () => {
        const sell = await sellAsset(1, { symbol: 'ASELS.IS', quantity: 1, price: 10, type: 'stock' });
        expect(sell.status).toBe(404);
    });

    test('sell with invalid quantity (0) → 400', async () => {
        await buildPosition(1);
        const sell = await sellAsset(1, { symbol: 'THYAO.IS', quantity: 0, price: 60, type: 'stock' });
        expect(sell.status).toBe(400);
    });

    test('sell with invalid price (0) → 400', async () => {
        await buildPosition(1);
        const sell = await sellAsset(1, { symbol: 'THYAO.IS', quantity: 10, price: 0, type: 'stock' });
        expect(sell.status).toBe(400);
    });

    test('sell without CSRF token → 403', async () => {
        await buildPosition(1);
        const authToken = jwt.sign({ id: 1, username: 'u1' }, process.env.JWT_SECRET);
        const res = await request(app).post('/api/portfolio/sell')
            .set('Cookie', [`authToken=${authToken}`])
            .send({ symbol: 'THYAO.IS', quantity: 10, price: 60, type: 'stock' });
        expect(res.status).toBe(403);
    });

    test("a user cannot sell from another user's position", async () => {
        await buildPosition(1); // user 1 owns THYAO
        const sell = await sellAsset(2, { symbol: 'THYAO.IS', quantity: 10, price: 60, type: 'stock' });
        expect(sell.status).toBe(404); // user 2 has no such position

        // user 1's position is intact
        const list = await getPortfolio(1);
        expect(list.body[0].quantity).toBe(80);
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
