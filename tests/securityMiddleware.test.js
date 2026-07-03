// Unit tests for the two security gates that protect every mutating route:
// CSRF validation and JWT authentication. JWT_SECRET must be set BEFORE the
// middleware module is required, because it reads the secret at module load.
process.env.JWT_SECRET = 'test-secret-at-least-16-chars-long';

const jwt = require('jsonwebtoken');
const {
    validateCSRF,
    authenticateToken,
    csrfTokens,
    generateCSRFToken
} = require('../middleware/securityMiddleware');

const JWT_SECRET = process.env.JWT_SECRET;

// Minimal Express res double: records status + json payload, supports chaining.
function makeRes() {
    return {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; }
    };
}

describe('validateCSRF', () => {
    afterEach(() => csrfTokens.clear());

    test('rejects when session cookie or token is missing', () => {
        const res = makeRes();
        let nextCalled = false;
        validateCSRF({ cookies: {}, headers: {}, body: {} }, res, () => { nextCalled = true; });
        expect(res.statusCode).toBe(403);
        expect(nextCalled).toBe(false);
    });

    test('rejects when the token does not match the stored one', () => {
        csrfTokens.set('sess-1', { token: 'real-token', timestamp: Date.now() });
        const res = makeRes();
        let nextCalled = false;
        validateCSRF(
            { cookies: { sessionId: 'sess-1' }, headers: { 'x-csrf-token': 'wrong' }, body: {} },
            res,
            () => { nextCalled = true; }
        );
        expect(res.statusCode).toBe(403);
        expect(nextCalled).toBe(false);
    });

    test('passes when session + matching token are present', () => {
        const token = generateCSRFToken();
        csrfTokens.set('sess-2', { token, timestamp: Date.now() });
        const res = makeRes();
        let nextCalled = false;
        validateCSRF(
            { cookies: { sessionId: 'sess-2' }, headers: { 'x-csrf-token': token }, body: {} },
            res,
            () => { nextCalled = true; }
        );
        expect(nextCalled).toBe(true);
        expect(res.statusCode).toBeNull();
    });
});

describe('authenticateToken', () => {
    test('401 when no authToken cookie is present', () => {
        const res = makeRes();
        let nextCalled = false;
        authenticateToken({ cookies: {} }, res, () => { nextCalled = true; });
        expect(res.statusCode).toBe(401);
        expect(nextCalled).toBe(false);
    });

    test('403 when the token is malformed/invalid', () => {
        const res = makeRes();
        let nextCalled = false;
        authenticateToken({ cookies: { authToken: 'not-a-jwt' } }, res, () => { nextCalled = true; });
        expect(res.statusCode).toBe(403);
        expect(nextCalled).toBe(false);
    });

    test('401 when the token is expired', () => {
        const expired = jwt.sign({ id: 1, username: 'a' }, JWT_SECRET, { expiresIn: -10 });
        const res = makeRes();
        let nextCalled = false;
        authenticateToken({ cookies: { authToken: expired } }, res, () => { nextCalled = true; });
        expect(res.statusCode).toBe(401);
        expect(nextCalled).toBe(false);
    });

    test('passes and populates req.user for a valid token', () => {
        const token = jwt.sign({ id: 42, username: 'tolga' }, JWT_SECRET, { expiresIn: '1h' });
        const req = { cookies: { authToken: token } };
        const res = makeRes();
        let nextCalled = false;
        authenticateToken(req, res, () => { nextCalled = true; });
        expect(nextCalled).toBe(true);
        expect(req.user.id).toBe(42);
        expect(req.user.username).toBe('tolga');
    });
});
