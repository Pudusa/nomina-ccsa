const db = require('./database.cjs');
const bcrypt = require('bcryptjs');
const argon2 = require('argon2'); // Argon2id para cuenta de emergencia

const required = ['SEED_ADMIN_PASSWORD', 'SEED_EDITOR_PASSWORD', 'SEED_VIEWER_PASSWORD'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error('[FATAL] Faltan variables de entorno:', missing.join(', '));
  process.exit(1);
}

// Hash Argon2id para la cuenta local de emergencia (solo si no existe)
async function ensureEmergencyAdmin() {
  const emergencyUsername = 'admin_emergency';
  const emergencyPassword = process.env.SEED_EMERGENCY_PASSWORD || 'EmergencyPass123';
  
  // Verificar si ya existe
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(emergencyUsername);
  
  if (!exists) {
    try {
      // Usar Argon2id para el hash de la cuenta de emergencia
      const hash = await argon2.hash(emergencyPassword);
      db.prepare(
        'INSERT INTO users (username, password_hash, role, activo, must_change_password) VALUES (?, ?, ?, 1, 1)'
      ).run(emergencyUsername, hash, 'admin');
      console.log(`[seed] Cuenta de emergencia creada con Argon2id: ${emergencyUsername}`);
    } catch (err) {
      console.warn('[seed] Argon2 no disponible, usando bcrypt fallback para cuenta de emergencia:', err.message);
      // Fallback a bcrypt si Argon2 no está disponible
      const hash = bcrypt.hashSync(emergencyPassword, 12);
      db.prepare(
        'INSERT INTO users (username, password_hash, role, activo, must_change_password) VALUES (?, ?, ?, 1, 1)'
      ).run(emergencyUsername, hash, 'admin');
      console.log('[seed] Cuenta de emergencia creada con bcrypt (fallback): ' + emergencyUsername);
    }
  } else {
    console.log('[seed] Cuenta de emergencia ya existe: ' + emergencyUsername);
  }
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

// Asegurar cuenta de emergencia después de los usuarios normales
ensureEmergencyAdmin()
  .then(() => {
    console.log('[seed] Completado: 3 usuarios locales semeados + cuenta de emergencia.');
    db.close();
  })
  .catch(err => {
    console.error('[seed] Error al crear cuenta de emergencia:', err);
    console.log('[seed] Completado: 3 usuarios locales semeados (error en emergencia).');
    db.close();
  });
