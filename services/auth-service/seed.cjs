const db = require('./database.cjs');
const bcrypt = require('bcryptjs');

const required = ['SEED_ADMIN_PASSWORD', 'SEED_EDITOR_PASSWORD', 'SEED_VIEWER_PASSWORD'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error('[FATAL] Faltan variables de entorno:', missing.join(', '));
  process.exit(1);
}

function ensureUser(username, password, role) {
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  const hash = bcrypt.hashSync(password, 10);
  if (exists) {
    db.prepare('UPDATE users SET password_hash = ?, role = ?, activo = 1 WHERE username = ?').run(hash, role, username);
    console.log(`[seed] Usuario actualizado: ${username} (${role})`);
  } else {
    db.prepare('INSERT INTO users (username, password_hash, role, activo, must_change_password) VALUES (?, ?, ?, 1, 1)').run(username, hash, role);
    console.log(`[seed] Usuario creado: ${username} (${role})`);
  }
}

ensureUser('admin', process.env.SEED_ADMIN_PASSWORD, 'admin');
ensureUser('editor', process.env.SEED_EDITOR_PASSWORD, 'editor');
ensureUser('viewer', process.env.SEED_VIEWER_PASSWORD, 'viewer');

console.log('[seed] Completado: 3 usuarios locales semeados.');
db.close();
