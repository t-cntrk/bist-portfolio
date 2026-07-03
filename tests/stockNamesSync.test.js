// Guard test for ANALYSIS.md item 5.2.
//
// The 15 BIST stock display names live in TWO places that must stay identical:
//   - backend:  services/yahooService.js  -> getStockDisplayName()  (keys: 'DOAS.IS')
//   - frontend: public/js/stocks.js        -> getStockName()         (keys: 'DOAS')
//
// We can't simply require() the frontend file (it's a browser ES module), so we
// read both files as text and extract their `const names = { ... }` map, then
// assert they match. This changes NO runtime behaviour — it only fails CI/tests
// if the two lists ever drift apart, so a name edited in one place but not the
// other gets caught immediately.
const fs = require('fs');
const path = require('path');

function extractNames(filePath) {
    const src = fs.readFileSync(filePath, 'utf8');
    const start = src.indexOf('const names = {');
    if (start === -1) throw new Error(`'const names = {' not found in ${filePath}`);
    const blockStart = src.indexOf('{', start);
    const blockEnd = src.indexOf('};', blockStart);
    if (blockEnd === -1) throw new Error(`names map closing '};' not found in ${filePath}`);

    const block = src.slice(blockStart, blockEnd);
    const map = {};
    const re = /'([^']+)'\s*:\s*'([^']+)'/g;
    let m;
    while ((m = re.exec(block)) !== null) {
        map[m[1]] = m[2];
    }
    return map;
}

describe('stock display names stay in sync (backend ↔ frontend)', () => {
    const backendPath = path.join(__dirname, '..', 'services', 'yahooService.js');
    const frontendPath = path.join(__dirname, '..', 'public', 'js', 'stocks.js');

    test('backend and frontend define the same set of names', () => {
        const backend = extractNames(backendPath);    // keys like 'DOAS.IS'
        const frontend = extractNames(frontendPath);   // keys like 'DOAS'

        // Normalise backend keys by stripping the BIST '.IS' suffix.
        const backendNorm = {};
        for (const [key, value] of Object.entries(backend)) {
            backendNorm[key.replace('.IS', '')] = value;
        }

        // toEqual checks both directions: any added/removed/renamed name fails.
        expect(backendNorm).toEqual(frontend);
    });
});
