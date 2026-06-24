const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { validateCSRF, authLimiter, forgotPasswordLimiter, authenticateToken, handleValidationErrors } = require('../middleware/securityMiddleware');

const registerValidation = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('İsim 2 ile 50 karakter arasında olmalıdır')
        .escape(),
    body('surname')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Soyisim 2 ile 50 karakter arasında olmalıdır')
        .escape(),
    body('email')
        .isEmail()
        .withMessage('Geçerli bir e-posta adresi giriniz')
        .normalizeEmail(),
    body('birthdate')
        .notEmpty()
        .withMessage('Doğum tarihi boş bırakılamaz')
        .isISO8601({ strict: false })
        .withMessage('Doğum tarihi geçersiz — YYYY-AA-GG formatında giriniz')
        .toDate(),
    body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Kullanıcı adı 3 ile 30 karakter arasında olmalıdır')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Kullanıcı adı sadece harf, rakam ve alt çizgi (_) içerebilir')
        .escape(),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Şifre en az 8 karakter olmalıdır')
        // Lookahead: uppercase, lowercase, digit, any common special char
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_.+=[\]{}|;:'"<>,/])/)
        .withMessage('Şifre en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir')
];
/**
 * @route   POST /api/auth/register
 * @desc    Handle user signup
 */
// NOTE: register builds its own field-aware Turkish error message from
// validationResult, so we intentionally do NOT use handleValidationErrors here.
router.post('/register', validateCSRF, authLimiter, registerValidation, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Handle user login
 */
const loginValidation = [
    body('username').trim().notEmpty().withMessage('Kullanıcı adı gereklidir'),
    body('password').notEmpty().withMessage('Şifre gereklidir')
];
router.post('/login', validateCSRF, authLimiter, loginValidation, handleValidationErrors, authController.login);

/**
 * @route   POST /api/auth/forgot
 * @desc    Request password reset
 */
router.post('/forgot', forgotPasswordLimiter, [
    body('email').isEmail().withMessage('Geçerli bir e-posta adresi giriniz').normalizeEmail()
], handleValidationErrors, authController.forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 */
router.post('/reset-password', authLimiter, [
    body('token').notEmpty().withMessage('Geçersiz sıfırlama bağlantısı'),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('Şifre en az 8 karakter olmalıdır')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_.+=[\]{}|;:'"<>,/])/)
        .withMessage('Şifre en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir')
], authController.resetPassword);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification link
 */
router.post('/resend-verification', authLimiter, [
    body('email').isEmail().normalizeEmail()
], authController.resendVerification);

/**
 * @route   GET /api/auth/userinfo
 * @desc    Get current logged-in user's profile data
 */
router.get('/userinfo', authenticateToken, authController.getUserInfo);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and clear cookie
 */
router.post('/logout', authController.logout);

/**
 * @route   POST /api/auth/request-password-change
 * @desc    Send a password-change verification code to the user's email
 */
router.post('/request-password-change', authenticateToken, authLimiter, authController.requestPasswordChange);

/**
 * @route   POST /api/auth/verify-password-change
 * @desc    Verify the code and set a new password
 */
// NOTE: No authenticateToken here — authorization is the single-use email action
// token + current password (verified in the controller), so the link works even
// when logged out or on another device.
router.post('/verify-password-change', authLimiter, [
    body('token').notEmpty(),
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 })
], handleValidationErrors, authController.verifyPasswordChange);

/**
 * @route   POST /api/auth/request-account-deletion
 * @desc    Send an account-deletion verification code to the user's email
 */
router.post('/request-account-deletion', authenticateToken, authLimiter, authController.requestAccountDeletion);

/**
 * @route   POST /api/auth/verify-account-deletion
 * @desc    Verify the code and permanently delete the account
 */
// NOTE: No authenticateToken here — authorization is the single-use email action
// token + account password (verified in the controller).
router.post('/verify-account-deletion', authLimiter, [
    body('token').notEmpty(),
    body('password').notEmpty()
], handleValidationErrors, authController.verifyAccountDeletion);

module.exports = router;