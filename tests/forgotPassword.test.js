// Unit tests for the forgotPassword controller (ANALYSIS 2.5).
// A reset link must be sent ONLY to an existing, email-verified account, while
// every branch returns the same generic response so the caller cannot enumerate
// accounts. The DB connection and email service are mocked — no real email is sent.
process.env.JWT_SECRET = 'test-secret-at-least-16-chars-long';

const mockDb = { get: jest.fn(), run: jest.fn() };
jest.mock('../services/databaseService', () => ({ getConnection: () => mockDb }));

jest.mock('../services/emailService', () => ({
    sendVerificationEmail: jest.fn(() => Promise.resolve()),
    sendPasswordResetEmail: jest.fn(() => Promise.resolve()),
    sendPasswordChangeEmail: jest.fn(() => Promise.resolve()),
    sendAccountDeletionEmail: jest.fn(() => Promise.resolve())
}));

const { forgotPassword } = require('../controllers/authController');
const { sendPasswordResetEmail } = require('../services/emailService');

const GENERIC = 'Bu e-posta kayıtlıysa, şifre sıfırlama bağlantısı gönderilecektir.';

// Express res double whose `done` promise resolves once json() is called, so the
// test can await the async DB/email callbacks the controller runs internally.
function makeRes() {
    let resolve;
    const done = new Promise((r) => { resolve = r; });
    return {
        statusCode: 200,
        body: null,
        done,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; resolve(); return this; }
    };
}

// db.run succeeds by default (used only in the verified-user path).
beforeEach(() => {
    mockDb.run.mockImplementation((sql, params, cb) => cb && cb(null));
});

async function callForgot(user) {
    mockDb.get.mockImplementation((sql, params, cb) => cb(null, user));
    const res = makeRes();
    await forgotPassword({ body: { email: 'user@example.com' } }, res);
    await res.done;
    return res;
}

describe('forgotPassword — email_verified gate (ANALYSIS 2.5)', () => {
    test('unverified user: generic response, no reset_token written, no email sent', async () => {
        const res = await callForgot({ id: 1, username: 'u', name: 'n', email_verified: 0 });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe(GENERIC);
        expect(mockDb.run).not.toHaveBeenCalled();
        expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    test('unknown email: generic response, no email sent', async () => {
        const res = await callForgot(undefined);

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe(GENERIC);
        expect(mockDb.run).not.toHaveBeenCalled();
        expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    test('verified user: generic response, reset_token written, email sent', async () => {
        const res = await callForgot({ id: 42, username: 'u', name: 'n', email_verified: 1 });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe(GENERIC);

        expect(mockDb.run).toHaveBeenCalledTimes(1);
        const [sql, params] = mockDb.run.mock.calls[0];
        expect(sql).toMatch(/UPDATE users SET reset_token/);
        expect(params[2]).toBe(42); // user id

        expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
        const [toEmail, token] = sendPasswordResetEmail.mock.calls[0];
        expect(toEmail).toBe('user@example.com');
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(0);
    });
});
