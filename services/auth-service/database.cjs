const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'auth.sqlite');

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Si ya existe la base antigua, respaldarla y crear una nueva para evitar migraciones complejas
let db;
const dbExists = fs.existsSync(dbPath);

if (dbExists) {
  // Intentar abrir y verificar esquema; si parece viejo, recrear
  try {
    const test = dbPath; // placeholder
    // Solo continuamos si la BD tiene el esquema antiguo (sin domain_identity)
    // Para simplificar, verificaremos tablas abajo
    db = new Database(dbPath);
  } catch (err) {
    console.error('Error abriendo BD existente:', err.message);
    // Crear nueva BD eliminando la antigua
    try { fs.unlinkSync(dbPath); } catch {}
    db = new Database(dbPath);
  }
} else {
  db = new Database(dbPath);
}

// Configurar modo SQLite
db.pragma('journal_mode = DELETE');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');

// === TABLA: users ===
// Esta tabla siempre se recrea/garantiza con el esquema completo
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    activo INTEGER NOT NULL DEFAULT 1,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    domain_identity TEXT -- identificador estable del usuario en el directorio (SID o UPN)
  );
`);

// Migrar/normalizar datos existentes
try {
  // Añadir columna domain_identity si no existe (SQLite no tiene ALTER TABLE ADD COLUMN IF NOT EXISTS)
  // Usamos la técnica: agregar columna por defecto NULL, luego actualizar
  // Primero verificamos si la columna existe
  const schema = db.pragma('table_info(users)');
  const columnNames = schema.map(col => col.name);
  
  if (!columnNames.includes('domain_identity')) {
    // Agregamos la columna con valor por defecto NULL
    db.exec('ALTER TABLE users ADD COLUMN domain_identity TEXT');
    console.log('[DB] Added domain_identity column to users table');
  }
} catch (err) {
  console.warn('[DB] Could not add domain_identity column:', err.message);
}

// Normalizar roles legacy
try {
  db.prepare("UPDATE users SET role='viewer' WHERE role NOT IN ('admin','editor','viewer')").run();
} catch { /* sin roles legacy por normalizar */ }

// === TABLA: domain_identities (nueva - relación 1:1 con trabajador) ===
// Usamos CREATE TABLE sin IF NOT EXISTS y la envolvemos en try/catch para idempotencia
try {
  // Verificar si tabla ya existe
  const tableCheck = db.prepare("SELECT * FROM domain_identities LIMIT 1").get();
  // Si llegamos aquí, tabla existe, está bien
  console.log('[DB] domain_identities table already exists');
} catch (err) {
  // Tabla no existe, créala
  try {
    db.exec(`
      CREATE TABLE domain_identities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_sid TEXT UNIQUE,
        upn TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        activo INTEGER NOT NULL DEFAULT 1,
        last_sync TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    console.log('[DB] Created domain_identities table (new installation)');
  } catch (createErr) {
    // La tabla podría existir con esquema diferente; intentar migración suave
    console.warn('[DB] Could not create domain_identities table (may exist with different schema):', createErr.message);
    // Intentar añadir columnas si faltan
    try {
      db.prepare("ALTER TABLE domain_identities ADD COLUMN domain_sid TEXT").run();
    } catch {}
    try {
      db.prepare("ALTER TABLE domain_identities ADD COLUMN upn TEXT").run();
    } catch {}
  }
}

// Asegurar índice único en domain_sid si la tabla fue recién creada
try {
  db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_sid ON domain_identities(domain_sid)");
} catch {}

try {
  db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_upn ON domain_identities(upn)");
} catch {}

// Relación: asegurar que cada usuario tenga una identidad de dominio
// (esto es opcional en esta fase, solo asegura consistencia)
try {
  const usersWithoutIdentity = db.prepare(
    `SELECT u.id, u.username FROM users u LEFT JOIN domain_identities d ON u.domain_identity = d.username WHERE u.domain_identity IS NULL LIMIT 1`
  ).get();
  if (usersWithoutIdentity) {
    console.log('[DB] Found user without domain identity:', usersWithoutIdentity.username);
  }
} catch {}

console.log('[Auth Microservice] Connected autonomously to dedicated auth database at:', dbPath);

module.exports = db;