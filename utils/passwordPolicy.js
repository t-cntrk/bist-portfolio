/**
 * Single source of truth for password complexity.
 *
 * Previously this regex was copy-pasted across authController, authRoutes
 * (register + reset) and the inline reset/change form scripts, which made it
 * easy for the rules to drift apart. Backend code should import from here.
 *
 * Rule: at least one lowercase, one uppercase, one digit and one special char.
 */
const PASSWORD_COMPLEXITY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_.+=[\]{}|;:'"<>,/])/;

const PASSWORD_COMPLEXITY_MESSAGE =
    'Şifre en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir';

module.exports = {
    PASSWORD_COMPLEXITY,
    PASSWORD_COMPLEXITY_MESSAGE
};
