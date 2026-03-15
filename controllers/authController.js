const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const { getConnection, releaseConnection } = require('../services/databaseService');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

const JWT_SECRET = process.env.JWT_SECRET;


// @desc    Register new user
// @route   POST /api/auth/register
exports.register = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const fieldLabels = {
            name: 'İsim',
            surname: 'Soyisim',
            email: 'E-posta',
            birthdate: 'Doğum tarihi',
            username: 'Kullanıcı adı',
            password: 'Şifre'
        };
        // Return first error's message as the main message for the frontend toast
        const firstError = errors.array()[0];
        const fieldLabel = fieldLabels[firstError.path] || firstError.path;
        const message = `${fieldLabel}: ${firstError.msg}`;
        return res.status(400).json({ message, errors: errors.array() });
    }

    const { name, surname, email, birthdate, username, password } = req.body;
    const db = getConnection();

    db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email], async (err, row) => {
        if (err) {
            console.error('Database error:', err);
            releaseConnection(db);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (row) {
            // Fake bcrypt hash to prevent timing attacks
            await bcrypt.hash('fake-password-to-prevent-timing-attack', 12);
            releaseConnection(db);
            return res.status(400).json({ message: 'Registration failed. Please check your information and try again.' });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

        bcrypt.hash(password, 12, (err, hashed) => {
            if (err) {
                releaseConnection(db);
                return res.status(500).json({ message: 'Password hashing failed' });
            }

            const sql = 'INSERT INTO users (name, surname, email, birthdate, username, password, email_verified, verification_token, token_expires) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)';
            db.run(sql, [name, surname, email, birthdate, username, hashed, verificationToken, tokenExpires], function(err) {
                if (err) {
                    releaseConnection(db);
                    return res.status(500).json({ message: 'User registration failed' });
                }
                const lastID = this.lastID;
                sendVerificationEmail(email, verificationToken, name)
                    .then(() => {
                        releaseConnection(db);
                        res.json({ message: 'Registration successful! Please check your email.', userId: lastID });
                    })
                    .catch((emailError) => {
                        console.error('Verification email error:', emailError);
                        releaseConnection(db);
                        res.json({ message: 'Registered successfully, but verification email failed to send.', userId: lastID });
                    });
            });
        });
    });
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
exports.login = (req, res) => {
    const { username, password } = req.body;
    const db = getConnection();

    db.get('SELECT id, username, password, email_verified FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error('Database error during login:', err);
            releaseConnection(db);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (!user) {
            releaseConnection(db);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (user.email_verified === 0) {
            releaseConnection(db);
            return res.status(401).json({ message: 'Please verify your email first' });
        }

        bcrypt.compare(password, user.password, (err, valid) => {
            if (err) {
                console.error('Bcrypt error:', err);
                releaseConnection(db);
                return res.status(500).json({ message: 'Internal server error' });
            }

            if (!valid) {
                releaseConnection(db);
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            const token = jwt.sign(
                { username: user.username, id: user.id }, 
                JWT_SECRET, 
                { expiresIn: '24h' }
            );
            
            // Set HttpOnly cookie instead of sending token in JSON
            res.cookie('authToken', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });

            releaseConnection(db);
            res.json({ 
                success: true,
                username: user.username 
            });
        });
    });
};

// @desc    Request password reset
// @route   POST /api/auth/forgot
exports.forgotPassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Invalid email address' });
    }

    const { email } = req.body;
    const db = getConnection();

    db.get('SELECT id, username, name FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            console.error('Database error:', err);
            releaseConnection(db);
            return res.status(500).json({ message: 'Internal server error' });
        }

        // Always return same response to prevent email enumeration
        const genericMessage = 'If this email is registered, you will receive a password reset link.';

        if (!user) {
            // Fake bcrypt to prevent timing attacks
            await bcrypt.hash('fake-password-timing-attack-prevention', 12);
            releaseConnection(db);
            return res.json({ message: genericMessage });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpires = Date.now() + 60 * 60 * 1000; // 1 hour expiration

        db.run(
            'UPDATE users SET verification_token = ?, token_expires = ? WHERE id = ?',
            [resetToken, tokenExpires, user.id],
            (err) => {
                if (err) {
                    console.error('Token update error:', err);
                    releaseConnection(db);
                    return res.status(500).json({ message: 'Internal server error' });
                }

                sendPasswordResetEmail(email, resetToken)
                    .then(() => {
                        releaseConnection(db);
                        res.json({ message: genericMessage });
                    })
                    .catch((emailError) => {
                        console.error('Password reset email error:', emailError);
                        releaseConnection(db);
                        res.json({ message: genericMessage });
                    });
            }
        );
    });
};

// @desc    Resend email verification link
// @route   POST /api/auth/resend-verification
exports.resendVerification = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Invalid email address' });
    }

    const { email } = req.body;
    const db = getConnection();

    db.get(
        'SELECT id, name, username, email_verified FROM users WHERE email = ?',
        [email],
        async (err, user) => {
            if (err) {
                console.error('Database error:', err);
                releaseConnection(db);
                return res.status(500).json({ message: 'Internal server error' });
            }

            const genericMessage = 'If this email is registered, a verification email has been sent.';

            // If user not found or already verified, return generic response
            if (!user || user.email_verified === 1) {
                // Fake hash to mitigate timing attacks
                await bcrypt.hash('fake-password-timing-attack-prevention', 12);
                releaseConnection(db);
                return res.json({ message: genericMessage });
            }

            const verificationToken = crypto.randomBytes(32).toString('hex');
            const tokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

            db.run(
                'UPDATE users SET verification_token = ?, token_expires = ? WHERE id = ?',
                [verificationToken, tokenExpires, user.id],
                (updateErr) => {
                    if (updateErr) {
                        console.error('Token update error:', updateErr);
                        releaseConnection(db);
                        return res.status(500).json({ message: 'Internal server error' });
                    }

                    const displayName = user.name || user.username;

                    sendVerificationEmail(email, verificationToken, displayName)
                        .then(() => {
                            releaseConnection(db);
                            res.json({ message: genericMessage });
                        })
                        .catch((emailError) => {
                            console.error('Resend verification email error:', emailError);
                            releaseConnection(db);
                            res.json({ message: genericMessage });
                        });
                }
            );
        }
    );
};

// @desc    Reset password with token
// @route   POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { token, newPassword } = req.body;
    const db = getConnection();

    db.get(
        'SELECT id FROM users WHERE verification_token = ? AND token_expires > ?',
        [token, Date.now()],
        (err, user) => {
            if (err) {
                console.error('Database error:', err);
                releaseConnection(db);
                return res.status(500).json({ message: 'Internal server error' });
            }

            if (!user) {
                releaseConnection(db);
                return res.status(400).json({ message: 'Invalid or expired reset token' });
            }

            bcrypt.hash(newPassword, 12, (err, hashed) => {
                if (err) {
                    console.error('Bcrypt error:', err);
                    releaseConnection(db);
                    return res.status(500).json({ message: 'Password reset failed' });
                }

                db.run(
                    'UPDATE users SET password = ?, verification_token = NULL, token_expires = NULL WHERE id = ?',
                    [hashed, user.id],
                    (err) => {
                        releaseConnection(db);
                        
                        if (err) {
                            console.error('Password update error:', err);
                            return res.status(500).json({ message: 'Password reset failed' });
                        }

                        res.json({ message: 'Password reset successful. You can now login with your new password.' });
                    }
                );
            });
        }
    );
};

// @desc    Get current user info
// @route   GET /api/auth/userinfo
exports.getUserInfo = (req, res) => {
    const db = getConnection();
    db.get(
        'SELECT id, username, name, surname, birthdate, email FROM users WHERE id = ?',
        [req.user.id],
        (err, row) => {
            releaseConnection(db);
            if (err) {
                console.error('getUserInfo DB error:', err);
                return res.status(500).json({ message: 'Internal server error' });
            }
            if (!row) {
                return res.status(404).json({ message: 'User not found' });
            }
            res.json({
                id: row.id,
                username: row.username,
                name: row.name,
                surname: row.surname,
                birthdate: row.birthdate,
                email: row.email
            });
        }
    );
};

// @desc    Logout user
// @route   POST /api/auth/logout
exports.logout = (req, res) => {
    res.clearCookie('authToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    res.json({ message: 'Logged out successfully' });
};

// @desc    Verify email address via token link
// @route   GET /verify-email?token=...
exports.verifyEmail = (req, res) => {
    const { generateErrorPage, generateSuccessPage } = require('../services/pageGenerator');
    const { token } = req.query;

    if (!token) {
        return res.status(400).send(generateErrorPage(
            'Doğrulama Hatası',
            '❌ Doğrulama Hatası',
            'Geçersiz doğrulama bağlantısı.'
        ));
    }

    const db = getConnection();

    db.get(
        'SELECT * FROM users WHERE verification_token = ? AND token_expires > ?',
        [token, Date.now()],
        (err, user) => {
            if (err) {
                console.error('Verification error:', err);
                releaseConnection(db);
                return res.status(500).send('Doğrulama sırasında hata oluştu');
            }

            if (!user) {
                releaseConnection(db);
                return res.status(400).send(generateErrorPage(
                    'Doğrulama Hatası',
                    '❌ Doğrulama Hatası',
                    'Geçersiz veya süresi dolmuş doğrulama bağlantısı.'
                ));
            }

            db.run(
                'UPDATE users SET email_verified = 1, verification_token = NULL, token_expires = NULL WHERE id = ?',
                [user.id],
                (updateErr) => {
                    if (updateErr) {
                        console.error('Update error:', updateErr);
                        releaseConnection(db);
                        return res.status(500).send('Doğrulama sırasında hata oluştu');
                    }

                    releaseConnection(db);
                    res.send(generateSuccessPage(
                        'E-posta Doğrulandı',
                        '✅ E-posta Doğrulandı!',
                        'Hesabınız başarıyla doğrulandı. Artık giriş yapabilirsiniz.',
                        'Giriş Yap'
                    ));
                }
            );
        }
    );
};

// @desc    Show password reset form page
// @route   GET /reset-password?token=...
exports.resetPasswordPage = (req, res) => {
    const { generateErrorPage, generatePasswordResetForm } = require('../services/pageGenerator');
    const { token } = req.query;

    if (!token) {
        return res.status(400).send(generateErrorPage(
            'Şifre Sıfırlama Hatası',
            '❌ Şifre Sıfırlama Hatası',
            'Geçersiz şifre sıfırlama bağlantısı.'
        ));
    }

    const db = getConnection();

    db.get(
        'SELECT id, username FROM users WHERE verification_token = ? AND token_expires > ?',
        [token, Date.now()],
        (err, user) => {
            if (err) {
                console.error('Reset token check error:', err);
                releaseConnection(db);
                return res.status(500).send('Şifre sıfırlama sırasında hata oluştu');
            }

            if (!user) {
                releaseConnection(db);
                return res.status(400).send(generateErrorPage(
                    'Şifre Sıfırlama Hatası',
                    '❌ Şifre Sıfırlama Hatası',
                    'Geçersiz veya süresi dolmuş şifre sıfırlama bağlantısı.'
                ));
            }

            releaseConnection(db);
            res.send(generatePasswordResetForm(user.username, token));
        }
    );
};