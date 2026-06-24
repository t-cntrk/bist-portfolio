'use strict';

/**
 * Wipes all accounts (users + portfolios) and creates a single admin user.
 * Usage: node scripts/create-admin.js
 *
 * Admin credentials: username "admin", password "admin1234".
 * The account is created pre-verified (email_verified = 1) so it can log in.
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const DB_PATH = path.join(__dirname, '..', 'users.db');

const ADMIN = {
    name: 'Admin',
    surname: 'User',
    email: 'admin@local',
    birthdate: '2000-01-01',
    username: 'admin',
    password: 'admin1234'
};

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Could not open database:', err.message);
        process.exit(1);
    }
    console.log(`Connected to: ${DB_PATH}`);
});

db.serialize(async () => {
    console.log('Clearing existing accounts...');

    db.run('DELETE FROM portfolios', function (e1) {
        if (e1) console.error('  x portfolios:', e1.message);
        else console.log(`  ok portfolios cleared (${this.changes} row(s) deleted)`);
    });

    db.run('DELETE FROM users', function (e2) {
        if (e2) console.error('  x users:', e2.message);
        else console.log(`  ok users cleared (${this.changes} row(s) deleted)`);
    });

    db.run("DELETE FROM sqlite_sequence WHERE name IN ('users','portfolios')", () => {
        console.log('  ok autoincrement counters reset');
    });

    let hashed;
    try {
        hashed = await bcrypt.hash(ADMIN.password, 12);
    } catch (err) {
        console.error('Password hashing failed:', err.message);
        db.close();
        process.exit(1);
    }

    const sql = `INSERT INTO users
        (name, surname, email, birthdate, username, password, email_verified, verification_token, token_expires)
        VALUES (?, ?, ?, ?, ?, ?, 1, NULL, NULL)`;

    db.run(sql, [ADMIN.name, ADMIN.surname, ADMIN.email, ADMIN.birthdate, ADMIN.username, hashed], function (err) {
        if (err) {
            console.error('  x admin creation failed:', err.message);
            db.close();
            process.exit(1);
        }
        console.log(`\nAdmin user created (id=${this.lastID}).`);
        console.log('  username: admin');
        console.log('  password: admin1234');
        db.close(() => console.log('\nDone.'));
    });
});
