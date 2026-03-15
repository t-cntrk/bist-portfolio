const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// ENHANCED CONNECTION POOL: Better SQLite connection management
const dbPath = path.join(__dirname, '..', 'users.db');
const connectionPool = [];
const maxConnections = 5;
const connectionTimeout = 5000; // 5 seconds timeout

function getConnection() {
  try {
    if (connectionPool.length > 0) {
      return connectionPool.pop();
    }
    return new sqlite3.Database(dbPath);
  } catch (error) {
    console.error('Failed to get database connection:', error);
    throw error;
  }
}

function releaseConnection(connection) {
  try {
    if (connectionPool.length < maxConnections) {
      // Test connection before returning to pool
      connection.get('SELECT 1', (err) => {
        if (err) {
          console.warn('Invalid connection, closing instead of returning to pool');
          connection.close();
        } else {
          connectionPool.push(connection);
        }
      });
    } else {
      connection.close();
    }
  } catch (error) {
    console.error('Error releasing connection:', error);
    try {
      connection.close();
    } catch (closeErr) {
      console.error('Error closing connection:', closeErr);
    }
  }
}

// Connection pool health check (avoid mutating array during iteration)
setInterval(() => {
  if (connectionPool.length === 0) return;
  const snapshot = connectionPool.slice();
  snapshot.forEach((connection) => {
    try {
      connection.get('SELECT 1', (err) => {
        if (err) {
          console.warn('Removing stale connection from pool');
          connection.close();
          const i = connectionPool.indexOf(connection);
          if (i !== -1) connectionPool.splice(i, 1);
        }
      });
    } catch (error) {
      console.warn('Error checking connection health:', error);
      connection.close();
      const i = connectionPool.indexOf(connection);
      if (i !== -1) connectionPool.splice(i, 1);
    }
  });
}, 300000); // Check every 5 minutes

// Database initialization
function initializeDatabase() {
  const db = getConnection();
  
  db.on('error', (err) => {
    console.error('Database connection error:', err);
    process.exit(1);
  });

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
  });

  // Add email_sending_status column to users table if it doesn't exist
  db.run(`ALTER TABLE users ADD COLUMN email_sending_status INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding email_sending_status column:', err);
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

  return db;
}

// Graceful shutdown
function shutdownDatabase() {
  console.log('Shutting down database gracefully...');
  
  // Close all connections in the pool
  connectionPool.forEach(connection => {
    try {
      connection.close();
    } catch (err) {
      console.error('Error closing connection from pool:', err);
    }
  });
  
  console.log('Database connections closed.');
}

module.exports = {
  getConnection,
  releaseConnection,
  initializeDatabase,
  shutdownDatabase,
  dbPath
};