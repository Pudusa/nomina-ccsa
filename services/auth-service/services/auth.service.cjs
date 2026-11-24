const db = require('../database.cjs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Configuración LDAP/Active Directory - desactivada por defecto si no hay configuración
const LDAP_CONFIG = {
  url: process.env.LDAP_URL,
  bindDn: process.env.LDAP_BIND_DN,
  bindPassword: process.env.LDAP_PASSWORD,
  searchBase: process.env.LDAP_SEARCH_BASE,
  searchFilter: process.env.LDAP_SEARCH_FILTER,
  // Si LDAP_URL no está definido, el cliente no se creará y usaremos solo validación local
};

// Cliente LDAP - se inicializa vagamente; los métodos reales se llaman bajo demanda
let ldapClient = null;

// Intentar crear cliente LDAP solo si está configurado
if (LDAP_CONFIG.url) {
  try {
    const ldap = require('ldapjs');
    ldapClient = ldap.createClient({
      url: LDAP_CONFIG.url
    });
    console.log('[Auth] LDAP client created at:', LDAP_CONFIG.url);
  } catch (err) {
    console.warn('[Auth] Could not create LDAP client:', err.message);
    console.warn('[Auth] Falling back to local password verification only');
    ldapClient = null;
  }
} else {
  console.log('[Auth] No LDAP URL configured - using local password verification only');
}

/**
 * Verificar credenciales contra Active Directory si está disponible,
 * o contra la base de datos local si LDAP no está configurado/falló.
 * @param {string} username - nombre de usuario
 * @param {string} password - contraseña en texto plano
 * @returns {Promise<object>} - objeto de usuario con role, activo, etc.
 */
async function verifyLdapCredentials(username, password) {
  // Si no hay cliente LDAP configurado, retornar null para usar validación local
  if (!ldapClient) {
    return null;
  }

  try {
    // Buscar el usuario en el directorio primero
    const searchFilter = LDAP_CONFIG.searchFilter || '(sAMAccountName={username})';
    const searchBase = LDAP_CONFIG.searchBase || 'dc=nomina,dc=ccsa';

    const searchResult = await ldapClient.searchAsync(
      searchBase,
      {
        filter: searchFilter.replace('{username}', username),
        scope: 'sub'
      }
    );

    // Verificar que el usuario existe en el directorio
    let userEntryFound = false;
    let userDn = null;

    for await (const entry of searchResult) {
      userEntryFound = true;
      userDn = entry.dn || entry.distinguishedName;
      break;
    }

    if (!userEntryFound) {
      // Usuario no existe en directorio
      return null;
    }

    // Intentar bind (autenticación) con las credenciales del usuario
    // Usamos el DN obtenido de la búsqueda
    try {
      await ldapClient.bindAsync(userDn, password);
      // Bind exitoso = contraseña correcta
      return { ldapAuthenticated: true, username, userDn };
    } catch (bindErr) {
      // Bind falló = contraseña incorrecta
      console.warn('[Auth] LDAP bind failed for user:', username);
      return null;
    }
  } catch (err) {
    console.error('[Auth] Error en validación LDAP:', err.message);
    // En caso de cualquier error durante la búsqueda o bind, fallback a local
    return null;
  }
}

/**
 * Validación local contra la base de datos (bcrypt).
 * Esta es la vía principal cuando LDAP no está configurado o falla.
 * @param {string} username - nombre de usuario
 * @param {string} password - contraseña en texto plano
 * @returns {object|null} - objeto de usuario o null si inválido
 */
function verifyLocalUser(username, password) {
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !user.activo) {
      return null;
    }
    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      return null;
    }
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      activo: user.activo,
      must_change_password: user.must_change_password
    };
  } catch (err) {
    console.error('[Auth] Error en validación local:', err.message);
    return null;
  }
}

/**
 * Función principal de verificación de usuario.
 * Intenta LDAP primero, si falla o no está configurado, usa validación local.
 * @param {string} username - nombre de usuario
 * @param {string} password - contraseña en texto plano
 * @returns {object|Promise<object>} - objeto de usuario o null
 */
function verifyUser(username, password) {
  // 1. Si hay LDAP configurado, intentar autenticación asíncrona
  if (ldapClient) {
    return verifyLdapCredentials(username, password).then(ldapResult => {
      if (ldapResult && ldapResult.ldapAuthenticated) {
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!user) {
          const passwordHash = bcrypt.hashSync(password, 10);
          db.prepare(
            'INSERT INTO users (username, password_hash, role, activo, must_change_password) VALUES (?, ?, ?, 1, 0)'
          ).run(username, passwordHash, 'viewer');
        }
        return {
          id: user ? user.id : 0,
          username: user ? user.username : username,
          role: user ? user.role : 'viewer',
          activo: user ? user.activo : 1,
          must_change_password: user ? user.must_change_password : 0,
          ldapAuthenticated: true
        };
      }
      return verifyLocalUser(username, password);
    }).catch(() => verifyLocalUser(username, password));
  }

  // 2. Si no hay LDAP configurado, ejecución síncrona directa (evita problemas de Promises)
  return verifyLocalUser(username, password);
}

/**
 * Generar token JWT para un usuario verificado.
 * @param {object} user - objeto de usuario de verifyUser
 * @returns {string} - token JWT firmado
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, roles: [user.role] },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
}

/**
 * Verificar token JWT.
 * @param {string} token - token JWT para verificar
 * @returns {object|null} - payload del token o null si inválido
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Crear un nuevo usuario en la base de datos local.
 * @param {string} username - nombre de usuario
 * @param {string} password - contraseña en texto plano (se hasheará)
 * @param {string} role - rol del usuario
 * @returns {object} - resultado de la inserción
 */
function createUser(username, password, role) {
  const passwordHash = bcrypt.hashSync(password, 10);
  return db.prepare(
    'INSERT INTO users (username, password_hash, role, activo) VALUES (?, ?, ?, 1)'
  ).run(username, passwordHash, role);
}

// Exportar módulo
module.exports = {
  verifyUser,
  generateToken,
  verifyToken,
  createUser,
  LDAP_CONFIG,
  verifyLocalUser
};