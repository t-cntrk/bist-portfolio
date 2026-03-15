'use strict';

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'users.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Could not open database:', err.message);
        process.exit(1);
    }
    console.log(`Connected to: ${DB_PATH}`);
});

db.serialize(() => {
    db.get('SELECT COUNT(*) AS cnt FROM users', (err, row) => {
        const userCount = err ? '?' : row.cnt;

        db.get('SELECT COUNT(*) AS cnt FROM portfolios', (err2, row2) => {
            const portfolioCount = err2 ? '?' : row2.cnt;

            console.log(`\nFound:`);
            console.log(`  users      : ${userCount} row(s)`);
            console.log(`  portfolios : ${portfolioCount} row(s)`);
            console.log('\nClearing tables...');

            db.run('DELETE FROM portfolios', function (e1) {
                if (e1) { console.error('  ✗ portfolios:', e1.message); }
                else     { console.log(`  ✓ portfolios cleared (${this.changes} row(s) deleted)`); }

                db.run('DELETE FROM users', function (e2) {
                    if (e2) { console.error('  ✗ users:', e2.message); }
                    else     { console.log(`  ✓ users cleared (${this.changes} row(s) deleted)`); }

                    // Reset autoincrement counters
                    db.run("DELETE FROM sqlite_sequence WHERE name IN ('users','portfolios')", (e3) => {
                        if (!e3) console.log('  ✓ autoincrement counters reset');

                        db.close(() => {
                            console.log('\nDone. Database is now empty.');
                        });
                    });
                });
            });
        });
    });
});
