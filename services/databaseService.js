const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'users.db');

// SINGLE SHARED CONNECTION model.
//
// node-sqlite3 serializes all statements issued on one Database object through an
// internal queue, so a single shared connection is both safe and the recommended
// pattern. The previous "pool" opened a brand-new connection whenever the pool
// was empty, so the number of concurrently-open connections was effectively
// unbounded under load. Using one shared connection caps that at exactly one.
let sharedConnection = null;

function createConnection() {
  const conn = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Failed to open database connection:', err);
    }
  });
  conn.on('error', (err) => {
    console.error('Database connection error:', err);
  });
  return conn;
}

function getConnection() {
  if (!sharedConnection) {
    sharedConnection = createConnection();
  }
  return sharedConnection;
}

// Database initialization
function initializeDatabase() {
  const db = getConnection();

  console.log('Connected to SQLite database at:', dbPath);

  // Database initialization with error handling
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      surname TEXT NOT NULL,
      email TEXT,
      birthdate TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email_verified INTEGER DEFAULT 0,
      verification_token TEXT,
      token_expires INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Error creating users table:', err);
      } else {
        console.log('Users table ready');
      }
    });
    
    // Portfolios table
    db.run(`CREATE TABLE IF NOT EXISTS portfolios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      quantity REAL NOT NULL,
      purchase_price REAL NOT NULL,
      type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`, (err) => {
      if (err) {
        console.error('Error creating portfolios table:', err);
      } else {
        console.log('Portfolios table ready');
      }
    });

    // Append-only transaction ledger. `portfolios` holds the current position
    // (summary); this table records every individual buy/sell so users get a
    // permanent history. transaction_type defaults to 'buy' today but the column
    // exists so sells, realized P/L, filtering, export and analytics can be added
    // later without a schema change.
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      transaction_type TEXT NOT NULL DEFAULT 'buy',
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      total_amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`, (err) => {
      if (err) {
        console.error('Error creating transactions table:', err);
      } else {
        console.log('Transactions table ready');
      }
    });

    // Migrations (ALTER/INDEX) must run inside the same serialize() block AFTER
    // the CREATE TABLE statements, otherwise they can execute before the tables
    // exist on a cold start.

    // Dedicated columns for password-change / account-deletion flows so their
    // tokens don't collide with email-verification / password-reset tokens.
    db.run(`ALTER TABLE users ADD COLUMN action_token TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding action_token column:', err);
      }
    });
    db.run(`ALTER TABLE users ADD COLUMN action_token_expires INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding action_token_expires column:', err);
      }
    });
    db.run(`ALTER TABLE users ADD COLUMN action_type TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding action_type column:', err);
      }
    });

    // Dedicated columns for the password-reset flow so its token never collides
    // with the email-verification token (both previously shared verification_token,
    // which let a token minted for one flow be replayed against the other).
    db.run(`ALTER TABLE users ADD COLUMN reset_token TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding reset_token column:', err);
      }
    });
    db.run(`ALTER TABLE users ADD COLUMN reset_token_expires INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding reset_token_expires column:', err);
      }
    });

    // Add UNIQUE constraint to email column
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`, (err) => {
      if (err) {
        console.error('Error adding unique constraint to email:', err);
      } else {
        console.log('Email unique constraint ensured');
      }
    });

    // Prevent duplicate portfolio entries for same user/symbol/type combination
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_unique ON portfolios(user_id, symbol, type)`, (err) => {
      if (err && !err.message.includes('already exists')) {
        console.error('Error adding unique constraint to portfolio:', err);
      } else {
        console.log('Portfolio unique constraint ensured');
      }
    });

    // Speeds up per-user (and per-symbol) transaction-history reads.
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, symbol, created_at)`, (err) => {
      if (err && !err.message.includes('already exists')) {
        console.error('Error creating transactions index:', err);
      }
    });
  });

  return db;
}

// Graceful shutdown
function shutdownDatabase() {
  console.log('Shutting down database gracefully...');

  if (sharedConnection) {
    try {
      sharedConnection.close();
    } catch (err) {
      console.error('Error closing shared connection:', err);
    }
    sharedConnection = null;
  }

  console.log('Database connections closed.');
}

module.exports = {
  getConnection,
  initializeDatabase,
  shutdownDatabase,
  dbPath
};