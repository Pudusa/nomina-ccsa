const db = require('better-sqlite3')('server/nomina.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables);

try {
    const shifts = db.prepare("SELECT * FROM shift_configs").all();
    console.log('Shift configs count:', shifts.length);
    const day1 = shifts.filter(s => s.shift_name && s.shift_name.toLowerCase().includes('1') && s.day_index === 0);
    console.log('Day 1 for Turno 1:', day1);
} catch (e) {
    console.log('Error querying shift_configs:', e.message);
}
