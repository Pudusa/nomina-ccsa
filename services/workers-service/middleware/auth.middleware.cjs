// Middleware duplicado intentionalmente por servicio (CommonJS independiente, sin paquete compartido).
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('Falta JWT_SECRET en el entorno');
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token de acceso requerido.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ error: 'Token inválido o expirado.' });
  }
}

function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user || !req.user.role) return res.status(401).json({ error: 'Usuario no autenticado.' });
    if (!allowed.includes(req.user.role)) return res.status(403).json({ error: 'Acceso denegado: rol insuficiente.' });
    next();
  };
}

module.exports = { authenticateToken, requireRole };
