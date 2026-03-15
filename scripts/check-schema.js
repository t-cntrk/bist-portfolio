const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./users.db');
db.all("SELECT sql FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) console.error(err);
    else rows.forEach(r => console.log(r.sql));
    db.close();
});
