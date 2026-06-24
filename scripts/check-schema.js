const sqlite3 = require('sqlite3').verbose();
const path = require('path');
// Resolve relative to project root so it works regardless of CWD
const db = new sqlite3.Database(path.join(__dirname, '..', 'users.db'));
db.all("SELECT sql FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) console.error(err);
    else rows.forEach(r => console.log(r.sql));
    db.close();
});
