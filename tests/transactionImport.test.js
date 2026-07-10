// Unit tests for the pure CSV-import validation/normalization layer
// (services/importValidation.js). The replay path that touches the DB reuses the
// same buy/sell logic already covered by portfolioController.test.js.
const { validateImportRows, inferAssetType, parseExecutedAt, countDuplicateRows, MAX_ROWS } = require('../services/importValidation');

const row = (over = {}) => ({
    executedAt: '2026-07-03 06:00:00',
    symbol: 'THYAO.IS',
    transactionType: 'buy',
    quantity: '10',
    unitPrice: '100',
    ...over
});

describe('inferAssetType', () => {
    test('BIST equities (.IS) → stock', () => {
        expect(inferAssetType('THYAO.IS')).toBe('stock');
        expect(inferAssetType('aselsan.is')).toBe('stock');
    });
    test('FX / gold instruments → fx', () => {
        expect(inferAssetType('USDTRY=X')).toBe('fx');
        expect(inferAssetType('GC=F')).toBe('fx');
        expect(inferAssetType('XAUTRY=X')).toBe('fx');
    });
});

describe('parseExecutedAt', () => {
    test('accepts the export "YYYY-MM-DD HH:MM:SS" form (as UTC)', () => {
        const p = parseExecutedAt('2026-07-03 06:00:00');
        expect(p).not.toBeNull();
        expect(p.ms).toBe(Date.parse('2026-07-03T06:00:00Z'));
        expect(p.value).toBe('2026-07-03 06:00:00');
    });
    test('accepts ISO 8601', () => {
        expect(parseExecutedAt('2026-07-03T06:00:00Z')).not.toBeNull();
    });
    test('rejects junk / empty', () => {
        expect(parseExecutedAt('not-a-date')).toBeNull();
        expect(parseExecutedAt('')).toBeNull();
        expect(parseExecutedAt(null)).toBeNull();
    });
});

describe('validateImportRows — happy path', () => {
    test('valid rows are normalized and sorted chronologically by executed_at', () => {
        const rows = [
            row({ executedAt: '2026-07-05 09:00:00', symbol: 'GARAN.IS', transactionType: 'sell', quantity: '5', unitPrice: '90' }),
            row({ executedAt: '2026-07-03 06:00:00', symbol: 'THYAO.IS', transactionType: 'buy', quantity: '10', unitPrice: '100' }),
            row({ executedAt: '2026-07-04 08:00:00', symbol: 'USDTRY=X', transactionType: 'buy', quantity: '2', unitPrice: '30' })
        ];
        const { valid, errors, normalized } = validateImportRows(rows);
        expect(valid).toBe(true);
        expect(errors).toHaveLength(0);
        expect(normalized.map(r => r.executedAt)).toEqual([
            '2026-07-03 06:00:00',
            '2026-07-04 08:00:00',
            '2026-07-05 09:00:00'
        ]);
        // asset_type inferred, numbers coerced, type lower-cased
        expect(normalized[1]).toMatchObject({ symbol: 'USDTRY=X', type: 'fx', transactionType: 'buy', quantity: 2, unitPrice: 30 });
        expect(normalized[0]).toMatchObject({ symbol: 'THYAO.IS', type: 'stock' });
    });

    test('stable order for equal timestamps (keeps original order)', () => {
        const rows = [
            row({ symbol: 'AAA.IS' }),
            row({ symbol: 'BBB.IS' })
        ];
        const { normalized } = validateImportRows(rows);
        expect(normalized.map(r => r.symbol)).toEqual(['AAA.IS', 'BBB.IS']);
    });
});

describe('validateImportRows — whole-file rejection', () => {
    test('empty / non-array input is rejected', () => {
        expect(validateImportRows([]).valid).toBe(false);
        expect(validateImportRows(null).valid).toBe(false);
        expect(validateImportRows(undefined).valid).toBe(false);
    });

    test('too many rows rejected', () => {
        const many = Array.from({ length: MAX_ROWS + 1 }, () => row());
        const res = validateImportRows(many);
        expect(res.valid).toBe(false);
        expect(res.normalized).toHaveLength(0);
    });

    test('one bad row rejects the entire file (nothing normalized)', () => {
        const rows = [row(), row({ transactionType: 'gift' })];
        const res = validateImportRows(rows);
        expect(res.valid).toBe(false);
        expect(res.normalized).toHaveLength(0);
        expect(res.errors.some(e => e.row === 2)).toBe(true);
    });

    test.each([
        ['markup symbol', { symbol: "'><img src=x onerror=alert(1)>" }],
        ['empty symbol', { symbol: '' }],
        ['symbol too long', { symbol: 'A'.repeat(51) }],
        ['invalid type', { transactionType: 'crypto' }],
        ['zero quantity', { quantity: '0' }],
        ['negative quantity', { quantity: '-5' }],
        ['huge quantity', { quantity: '1e12' }],
        ['non-numeric quantity', { quantity: 'abc' }],
        ['zero price', { unitPrice: '0' }],
        ['huge price', { unitPrice: '1e12' }],
        ['bad date', { executedAt: 'yesterday' }]
    ])('rejects %s', (_label, over) => {
        const res = validateImportRows([row(over)]);
        expect(res.valid).toBe(false);
        expect(res.errors.length).toBeGreaterThan(0);
    });

    test('collects errors for every bad row', () => {
        const rows = [row({ quantity: '0' }), row({ symbol: '' }), row({ executedAt: 'x' })];
        const res = validateImportRows(rows);
        expect(res.valid).toBe(false);
        expect(new Set(res.errors.map(e => e.row))).toEqual(new Set([1, 2, 3]));
    });
});

describe('countDuplicateRows — preview duplicate warning heuristic', () => {
    // A ledger row as stored by the transactions table (snake_case columns).
    const ledger = (over = {}) => ({
        executed_at: '2026-07-03 06:00:00',
        symbol: 'THYAO.IS',
        transaction_type: 'buy',
        quantity: 10,
        unit_price: 100,
        ...over
    });

    test('no existing ledger → no duplicates', () => {
        const { normalized } = validateImportRows([row()]);
        expect(countDuplicateRows(normalized, [])).toBe(0);
        expect(countDuplicateRows(normalized, null)).toBe(0);
    });

    test('re-importing the same file flags every row as a duplicate', () => {
        const rows = [
            row({ executedAt: '2026-07-03 06:00:00', symbol: 'THYAO.IS', transactionType: 'buy', quantity: '10', unitPrice: '100' }),
            row({ executedAt: '2026-07-04 08:00:00', symbol: 'GARAN.IS', transactionType: 'sell', quantity: '5', unitPrice: '90' })
        ];
        const { normalized } = validateImportRows(rows);
        const existing = [
            ledger({ executed_at: '2026-07-03 06:00:00', symbol: 'THYAO.IS', transaction_type: 'buy', quantity: 10, unit_price: 100 }),
            ledger({ executed_at: '2026-07-04 08:00:00', symbol: 'GARAN.IS', transaction_type: 'sell', quantity: 5, unit_price: 90 })
        ];
        expect(countDuplicateRows(normalized, existing)).toBe(2);
    });

    test('counts only the rows that match an existing entry', () => {
        const rows = [
            row({ symbol: 'THYAO.IS' }),               // matches existing
            row({ symbol: 'ASELS.IS' })                // new
        ];
        const { normalized } = validateImportRows(rows);
        expect(countDuplicateRows(normalized, [ledger({ symbol: 'THYAO.IS' })])).toBe(1);
    });

    test('any of the five fields differing means not a duplicate', () => {
        const { normalized } = validateImportRows([row()]);
        expect(countDuplicateRows(normalized, [ledger({ quantity: 11 })])).toBe(0);
        expect(countDuplicateRows(normalized, [ledger({ unit_price: 101 })])).toBe(0);
        expect(countDuplicateRows(normalized, [ledger({ transaction_type: 'sell' })])).toBe(0);
        expect(countDuplicateRows(normalized, [ledger({ symbol: 'GARAN.IS' })])).toBe(0);
        expect(countDuplicateRows(normalized, [ledger({ executed_at: '2026-07-03 07:00:00' })])).toBe(0);
    });

    test('matches across timestamp forms (space form vs ISO) and numeric formatting', () => {
        const { normalized } = validateImportRows([row({ executedAt: '2026-07-03 06:00:00', quantity: '10', unitPrice: '100' })]);
        const existing = [ledger({ executed_at: '2026-07-03T06:00:00Z', quantity: 10.0, unit_price: 100.0 })];
        expect(countDuplicateRows(normalized, existing)).toBe(1);
    });
});
