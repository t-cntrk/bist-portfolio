const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const { getConnection } = require('../services/databaseService');
const { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangeEmail, sendAccountDeletionEmail } = require('../services/emailService');
const { PASSWORD_COMPLEXITY, PASSWORD_COMPLEXITY_MESSAGE } = require('../utils/passwordPolicy');

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
            return res.status(500).json({ message: 'Sunucu hatası' });
        }
        
        if (row) {
            // Fake bcrypt hash to prevent timing attacks
            await bcrypt.hash('fake-password-to-prevent-timing-attack', 12);
            return res.status(400).json({ message: 'Kayıt başarısız. Lütfen bilgilerinizi kontrol edip tekrar deneyin.' });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

        bcrypt.hash(password, 12, (err, hashed) => {
            if (err) {
                return res.status(500).json({ message: 'Şifre işlenemedi' });
            }

            // In development, auto-verify accounts so users can log in even when
            // email delivery is unreliable (spam/SMTP issues). Production still
            // requires email verification.
            const autoVerify = process.env.NODE_ENV !== 'production';
            const emailVerified = autoVerify ? 1 : 0;

            const sql = 'INSERT INTO users (name, surname, email, birthdate, username, password, email_verified, verification_token, token_expires) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
            db.run(sql, [name, surname, email, birthdate, username, hashed, emailVerified, verificationToken, tokenExpires], function(err) {
                if (err) {
                    return res.status(500).json({ message: 'Kullanıcı kaydı oluşturulamadı' });
                }
                const lastID = this.lastID;

                if (autoVerify) {
                    const verifyLink = `${require('../utils/envConfig').getBaseUrl()}/verify-email?token=${verificationToken}`;
                    console.log('🔗 Verification Link (Development Mode):', verifyLink);
                }

                // Send the email but don't let its outcome block the response.
                sendVerificationEmail(email, verificationToken, name)
                    .then(() => {
                        const message = autoVerify
                            ? 'Kayıt başarılı! Giriş yapabilirsiniz.'
                            : 'Kayıt başarılı! Lütfen e-postanızı kontrol edin.';
                        res.json({ message, userId: lastID, autoVerified: autoVerify });
                    })
                    .catch((emailError) => {
                        console.error('Verification email error:', emailError);
                        const message = autoVerify
                            ? 'Kayıt başarılı! Giriş yapabilirsiniz. (Doğrulama e-postası gönderilemedi)'
                            : 'Kayıt başarılı, ancak doğrulama e-postası gönderilemedi.';
                        res.json({ message, userId: lastID, autoVerified: autoVerify });
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
            return res.status(500).json({ message: 'Sunucu hatası' });
        }

        if (!user) {
            return res.status(401).json({ message: 'Kullanıcı adı veya şifre yanlış' });
        }

        if (user.email_verified === 0) {
            // The frontend (auth.js) looks for 'doğrulamanız gerekiyor' to show the
            // "resend verification" notice — keep this exact phrase.
            return res.status(401).json({ message: 'Giriş yapmadan önce e-posta adresinizi doğrulamanız gerekiyor.' });
        }

        bcrypt.compare(password, user.password, (err, valid) => {
            if (err) {
                console.error('Bcrypt error:', err);
                return res.status(500).json({ message: 'Sunucu hatası' });
            }

            if (!valid) {
                return res.status(401).json({ message: 'Kullanıcı adı veya şifre yanlış' });
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
        return res.status(400).json({ message: 'Geçersiz e-posta adresi' });
    }

    const { email } = req.body;
    const db = getConnection();

    db.get('SELECT id, username, name, email_verified FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Sunucu hatası' });
        }

        // Always return same response to prevent email enumeration
        const genericMessage = 'Bu e-posta kayıtlıysa, şifre sıfırlama bağlantısı gönderilecektir.';

        // Do not send a reset link to a non-existent account or one whose email
        // was never verified. The response is identical in every branch so the
        // caller cannot tell which case applies (no account enumeration).
        if (!user || user.email_verified !== 1) {
            // Fake bcrypt to keep timing comparable to the real path.
            await bcrypt.hash('fake-password-timing-attack-prevention', 12);
            return res.json({ message: genericMessage });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpires = Date.now() + 60 * 60 * 1000; // 1 hour expiration

        db.run(
            'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
            [resetToken, tokenExpires, user.id],
            (err) => {
                if (err) {
                    console.error('Token update error:', err);
                    return res.status(500).json({ message: 'Sunucu hatası' });
                }

                sendPasswordResetEmail(email, resetToken)
                    .then(() => {
                        res.json({ message: genericMessage });
                    })
                    .catch((emailError) => {
                        console.error('Password reset email error:', emailError);
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
        return res.status(400).json({ message: 'Geçersiz e-posta adresi' });
    }

    const { email } = req.body;
    const db = getConnection();

    db.get(
        'SELECT id, name, username, email_verified FROM users WHERE email = ?',
        [email],
        async (err, user) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Sunucu hatası' });
            }

            const genericMessage = 'Bu e-posta kayıtlıysa, doğrulama e-postası gönderilmiştir.';

            // If user not found or already verified, return generic response
            if (!user || user.email_verified === 1) {
                // Fake hash to mitigate timing attacks
                await bcrypt.hash('fake-password-timing-attack-prevention', 12);
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
                        return res.status(500).json({ message: 'Sunucu hatası' });
                    }

                    const displayName = user.name || user.username;

                    sendVerificationEmail(email, verificationToken, displayName)
                        .then(() => {
                            res.json({ message: genericMessage });
                        })
                        .catch((emailError) => {
                            console.error('Resend verification email error:', emailError);
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
        return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
    }

    const { token, newPassword } = req.body;
    const db = getConnection();

    db.get(
        'SELECT id, password FROM users WHERE reset_token = ? AND reset_token_expires > ?',
        [token, Date.now()],
        (err, user) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Sunucu hatası' });
            }

            if (!user) {
                return res.status(400).json({ message: 'Geçersiz veya süresi dolmuş sıfırlama bağlantısı' });
            }

            // Prevent reusing the current password — guide the user to pick a new one.
            bcrypt.compare(newPassword, user.password, (cmpErr, isSame) => {
                if (cmpErr) {
                    console.error('Bcrypt compare error:', cmpErr);
                    return res.status(500).json({ message: 'Şifre sıfırlanamadı' });
                }
                if (isSame) {
                    return res.status(400).json({
                        message: 'Bu, mevcut şifrenizle aynı. Lütfen daha önce kullanmadığınız yeni bir şifre belirleyin.'
                    });
                }

                bcrypt.hash(newPassword, 12, (err, hashed) => {
                if (err) {
                    console.error('Bcrypt error:', err);
                    return res.status(500).json({ message: 'Şifre sıfırlanamadı' });
                }

                db.run(
                    'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
                    [hashed, user.id],
                    (err) => {

                        if (err) {
                            console.error('Password update error:', err);
                            return res.status(500).json({ message: 'Şifre sıfırlanamadı' });
                        }

                        res.json({ message: 'Şifreniz başarıyla sıfırlandı. Artık yeni şifrenizle giriş yapabilirsiniz.' });
                    }
                );
                });
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
            if (err) {
                console.error('getUserInfo DB error:', err);
                return res.status(500).json({ message: 'Sunucu hatası' });
            }
            if (!row) {
                return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
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
    res.json({ message: 'Başarıyla çıkış yapıldı' });
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
                return res.status(500).send('Doğrulama sırasında hata oluştu');
            }

            if (!user) {
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
                        return res.status(500).send('Doğrulama sırasında hata oluştu');
                    }

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
        'SELECT id, username FROM users WHERE reset_token = ? AND reset_token_expires > ?',
        [token, Date.now()],
        (err, user) => {
            if (err) {
                console.error('Reset token check error:', err);
                return res.status(500).send('Şifre sıfırlama sırasında hata oluştu');
            }

            if (!user) {
                return res.status(400).send(generateErrorPage(
                    'Şifre Sıfırlama Hatası',
                    '❌ Şifre Sıfırlama Hatası',
                    'Geçersiz veya süresi dolmuş şifre sıfırlama bağlantısı.'
                ));
            }

            res.send(generatePasswordResetForm(user.username, token));
        }
    );
};

// ── Helper: issue a short-lived action token for the logged-in user ──────────────
function issueActionToken(req, res, actionType, sendEmailFn, okMessage) {
    const db = getConnection();
    db.get('SELECT id, email FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
            console.error('Action token DB error:', err);
            return res.status(500).json({ message: 'Sunucu hatası' });
        }
        if (!user || !user.email) {
            return res.status(400).json({ message: 'Hesabınızda kayıtlı bir e-posta bulunamadı' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expires = Date.now() + 15 * 60 * 1000; // 15 minutes

        db.run(
            'UPDATE users SET action_token = ?, action_token_expires = ?, action_type = ? WHERE id = ?',
            [token, expires, actionType, user.id],
            (updateErr) => {
                if (updateErr) {
                    console.error('Action token update error:', updateErr);
                    return res.status(500).json({ message: 'Sunucu hatası' });
                }

                sendEmailFn(user.email, token)
                    .then(() => {
                        res.json({ message: okMessage });
                    })
                    .catch((emailError) => {
                        console.error('Action email error:', emailError);
                        res.json({ message: okMessage });
                    });
            }
        );
    });
}

// ── Helper: render an action page after validating its token/type/expiry ─────────
function renderActionPage(req, res, actionType, renderFormFn) {
    const { generateErrorPage } = require('../services/pageGenerator');
    const { token } = req.query;

    if (!token) {
        return res.status(400).send(generateErrorPage(
            'Geçersiz Bağlantı', '❌ Geçersiz Bağlantı', 'Doğrulama kodu eksik veya geçersiz.'
        ));
    }

    const db = getConnection();
    db.get(
        'SELECT id FROM users WHERE action_token = ? AND action_type = ? AND action_token_expires > ?',
        [token, actionType, Date.now()],
        (err, user) => {
            if (err) {
                console.error('Action page DB error:', err);
                return res.status(500).send('İşlem sırasında hata oluştu');
            }
            if (!user) {
                return res.status(400).send(generateErrorPage(
                    'Geçersiz Bağlantı', '❌ Geçersiz veya Süresi Dolmuş Bağlantı',
                    'Bu doğrulama bağlantısı geçersiz veya süresi dolmuş.'
                ));
            }
            res.send(renderFormFn(token));
        }
    );
}

// @desc    Show password-change form page (from email link)
// @route   GET /verify-password-change?token=...
exports.passwordChangePage = (req, res) => {
    const { generatePasswordChangeForm } = require('../services/pageGenerator');
    renderActionPage(req, res, 'password_change', generatePasswordChangeForm);
};

// @desc    Show account-deletion confirmation page (from email link)
// @route   GET /verify-account-deletion?token=...
exports.accountDeletionPage = (req, res) => {
    const { generateAccountDeletionConfirm } = require('../services/pageGenerator');
    renderActionPage(req, res, 'account_deletion', generateAccountDeletionConfirm);
};

// @desc    Request password change (sends verification token to email)
// @route   POST /api/auth/request-password-change   (authenticated)
exports.requestPasswordChange = (req, res) => {
    issueActionToken(
        req, res, 'password_change', sendPasswordChangeEmail,
        'Doğrulama kodu e-posta adresinize gönderildi.'
    );
};

// @desc    Verify password change with token and set new password
// @route   POST /api/auth/verify-password-change
// Authorization = single-use email action token + current password (NOT the
// session cookie), so the email link also works when logged out / on another device.
exports.verifyPasswordChange = (req, res) => {
    const { token, currentPassword, newPassword } = req.body;

    if (!token || !currentPassword || !newPassword || newPassword.length < 8) {
        return res.status(400).json({ message: 'Geçersiz istek veya şifre çok kısa (en az 8 karakter)' });
    }

    // Enforce the same complexity rules as register/reset.
    if (!PASSWORD_COMPLEXITY.test(newPassword)) {
        return res.status(400).json({ message: PASSWORD_COMPLEXITY_MESSAGE });
    }

    const db = getConnection();
    db.get(
        'SELECT id, password FROM users WHERE action_token = ? AND action_type = ? AND action_token_expires > ?',
        [token, 'password_change', Date.now()],
        (err, user) => {
            if (err) {
                console.error('Verify password change DB error:', err);
                return res.status(500).json({ message: 'Sunucu hatası' });
            }
            if (!user) {
                return res.status(400).json({ message: 'Geçersiz veya süresi dolmuş doğrulama kodu' });
            }

            // Require the current password to be correct before changing it.
            bcrypt.compare(currentPassword, user.password, (cmpErr, valid) => {
                if (cmpErr) {
                    console.error('Bcrypt compare error:', cmpErr);
                    return res.status(500).json({ message: 'Şifre değiştirilemedi' });
                }
                if (!valid) {
                    return res.status(401).json({ message: 'Mevcut şifreniz yanlış' });
                }

                // Block setting the same password as the current one.
                if (newPassword === currentPassword) {
                    return res.status(400).json({
                        message: 'Yeni şifre mevcut şifrenizle aynı olamaz. Lütfen farklı bir şifre belirleyin.'
                    });
                }

                bcrypt.hash(newPassword, 12, (hashErr, hashed) => {
                    if (hashErr) {
                        console.error('Bcrypt error:', hashErr);
                        return res.status(500).json({ message: 'Şifre değiştirilemedi' });
                    }
                    db.run(
                        'UPDATE users SET password = ?, action_token = NULL, action_token_expires = NULL, action_type = NULL WHERE id = ?',
                        [hashed, user.id],
                        (updateErr) => {
                            if (updateErr) {
                                console.error('Password update error:', updateErr);
                                return res.status(500).json({ message: 'Şifre değiştirilemedi' });
                            }
                            res.json({ message: 'Şifreniz başarıyla değiştirildi.' });
                        }
                    );
                });
            });
        }
    );
};

// @desc    Request account deletion (sends verification token to email)
// @route   POST /api/auth/request-account-deletion   (authenticated)
exports.requestAccountDeletion = (req, res) => {
    issueActionToken(
        req, res, 'account_deletion', sendAccountDeletionEmail,
        'Hesap silme doğrulama kodu e-posta adresinize gönderildi.'
    );
};

// @desc    Verify account deletion with token and delete the account
// @route   POST /api/auth/verify-account-deletion
// Authorization = single-use email action token + account password (NOT the
// session cookie), so the email link also works when logged out / on another device.
exports.verifyAccountDeletion = (req, res) => {
    const { token, password } = req.body;

    if (!token || !password) {
        return res.status(400).json({ message: 'Doğrulama kodu ve şifre gereklidir' });
    }

    const db = getConnection();
    db.get(
        'SELECT id, password FROM users WHERE action_token = ? AND action_type = ? AND action_token_expires > ?',
        [token, 'account_deletion', Date.now()],
        (err, user) => {
            if (err) {
                console.error('Verify account deletion DB error:', err);
                return res.status(500).json({ message: 'Sunucu hatası' });
            }
            if (!user) {
                return res.status(400).json({ message: 'Geçersiz veya süresi dolmuş doğrulama kodu' });
            }

            // Require the account password before permanently deleting.
            bcrypt.compare(password, user.password, (cmpErr, valid) => {
                if (cmpErr) {
                    console.error('Bcrypt compare error:', cmpErr);
                    return res.status(500).json({ message: 'Hesap silinemedi' });
                }
                if (!valid) {
                    return res.status(401).json({ message: 'Şifreniz yanlış' });
                }

                db.run('DELETE FROM users WHERE id = ?', [user.id], (delErr) => {
                    if (delErr) {
                        console.error('Account deletion error:', delErr);
                        return res.status(500).json({ message: 'Hesap silinemedi' });
                    }
                    res.clearCookie('authToken', {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'strict'
                    });
                    res.json({ message: 'Hesabınız kalıcı olarak silindi.' });
                });
            });
        }
    );
};