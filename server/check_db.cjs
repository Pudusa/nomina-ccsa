const Database = require('better-sqlite3');
const db = new Database('server/nomina.db');
const dists = db.prepare("SELECT * FROM shift_monthly_distributions LIMIT 10").all();
console.log('Monthly distributions sample:', dists);
