const authService = require('../services/auth.service.cjs');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[0] === 'Bearer' ? authHeader.split(' ')[1] : authHeader;

  if (!token) {
    return res.status(401).json({ error: 'Acceso no autorizado. Token JWT requerido.' });
  }

  const decoded = authService.verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ error: 'Token inválido o expirado.' });
  }

  req.user = decoded;
  next();
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuario no autenticado.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes permisos suficientes para realizar esta acción.' });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole
};
