const { PASSWORD_COMPLEXITY } = require('../utils/passwordPolicy');

describe('PASSWORD_COMPLEXITY', () => {
    test.each([
        'Aa1!aaaa',
        'Strong#Pass9',
        'xX9$kkkkk'
    ])('accepts a compliant password: %s', (pw) => {
        expect(PASSWORD_COMPLEXITY.test(pw)).toBe(true);
    });

    test.each([
        ['no uppercase', 'aa1!aaaa'],
        ['no lowercase', 'AA1!AAAA'],
        ['no digit', 'Aa!aaaaa'],
        ['no special char', 'Aa1aaaaa']
    ])('rejects when %s', (_label, pw) => {
        expect(PASSWORD_COMPLEXITY.test(pw)).toBe(false);
    });
});
