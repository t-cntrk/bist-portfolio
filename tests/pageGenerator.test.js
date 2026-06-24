const {
    generateErrorPage,
    generatePasswordChangeForm,
    generateAccountDeletionConfirm
} = require('../services/pageGenerator');

describe('pageGenerator XSS escaping', () => {
    test('generateErrorPage escapes HTML in interpolated values', () => {
        const html = generateErrorPage('<script>', '<b>x</b>', '"><img src=x>');
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
        expect(html).toContain('&quot;&gt;&lt;img src=x&gt;');
    });

    test('generatePasswordChangeForm escapes the token in the hidden input', () => {
        const html = generatePasswordChangeForm('"><script>alert(1)</script>');
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&quot;&gt;&lt;script&gt;');
    });

    test('generateAccountDeletionConfirm escapes the token', () => {
        const html = generateAccountDeletionConfirm('"><img src=x onerror=alert(1)>');
        expect(html).not.toContain('<img src=x onerror=alert(1)>');
        expect(html).toContain('&quot;&gt;&lt;img');
    });
});
